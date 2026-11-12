import { json, error, success } from "../lib/response";
import {
  sanitizeText,
  sanitizeIdentifier,
  sanitizeColor,
  sanitizeIcon,
  sanitizeCurrency,
  sanitizeAmount,
  parseSafeJsonBody,
} from "../lib/sanitize";
import { verifyAccountOwnership } from "../lib/rls";
import { toCamelCaseAccount, enrichResourcesWithShared } from "../lib/formatters";
import type { Env, AuthenticatedUser } from "../types";

export async function handleAccounts(
  request: Request,
  env: Env,
  url: URL,
  user: AuthenticatedUser,
): Promise<Response> {
  const path = url.pathname;
  const method = request.method;
  const { userId } = user;

  if (path === "/accounts" && method === "GET") {
    const rows = await env.DB.prepare(
      `SELECT * FROM accounts a
       WHERE a.user_id = ?
          OR EXISTS (
            SELECT 1 FROM shared_members sm
            WHERE sm.resource_type = 'account' AND sm.resource_id = a.id AND sm.user_id = ?
          )
       ORDER BY a.created_at ASC`,
    )
      .bind(userId, userId)
      .all();
    const data = await enrichResourcesWithShared(
      env.DB,
      "account",
      (rows.results || []) as any[],
      userId,
      toCamelCaseAccount,
    );
    return json({
      data,
      total: data.length,
      page: 1,
      pageSize: data.length,
      hasNextPage: false,
    });
  }

  if (path === "/accounts" && method === "POST") {
    const parsed = await parseSafeJsonBody(request);
    if (!parsed.ok) return parsed.response;
    const body = parsed.data;

    const name = sanitizeText(body.name, 80);
    if (!name) return error("El nombre de la cuenta es obligatorio", 400);

    const validTypes = [
      "checking",
      "savings",
      "investment",
      "cash",
      "credit",
    ];
    const type = validTypes.includes(body.type) ? body.type : "checking";
    const currency = sanitizeCurrency(body.currency);
    const balance = sanitizeAmount(body.balance ?? 0, true, true) ?? 0;
    const color = sanitizeColor(body.color, "#e23d28");
    const icon = sanitizeIcon(body.icon, "wallet");
    const creditLimit =
      body.creditLimit != null
        ? sanitizeAmount(body.creditLimit, true, false)
        : null;
    const closingDay =
      body.closingDay != null
        ? Math.min(31, Math.max(1, Math.trunc(Number(body.closingDay))))
        : null;
    const dueDay =
      body.dueDay != null
        ? Math.min(31, Math.max(1, Math.trunc(Number(body.dueDay))))
        : null;

    // ID siempre generado por el servidor (evita colisiones o inyección de ID)
    const id = crypto.randomUUID().replace(/-/g, "").slice(0, 16);

    await env.DB.prepare(
      `INSERT INTO accounts (id, user_id, name, type, currency, balance, color, icon, credit_limit, closing_day, due_day)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    )
      .bind(
        id,
        userId,
        name,
        type,
        currency,
        balance,
        color,
        icon,
        creditLimit,
        closingDay,
        dueDay,
      )
      .run();

    const created = await env.DB.prepare(
      "SELECT * FROM accounts WHERE id = ? AND user_id = ?",
    )
      .bind(id, userId)
      .first();
    return success(
      {
        ...toCamelCaseAccount(created),
        isOwner: true,
        isShared: false,
        members: [],
      },
      201,
    );
  }

  if (path.startsWith("/accounts/") && method === "GET") {
    const id = sanitizeIdentifier(path.split("/")[2]);
    const row = await env.DB.prepare(
      `SELECT * FROM accounts a
       WHERE a.id = ?
         AND (
           a.user_id = ?
           OR EXISTS (
             SELECT 1 FROM shared_members sm
             WHERE sm.resource_type = 'account' AND sm.resource_id = a.id AND sm.user_id = ?
           )
         )`,
    )
      .bind(id, userId, userId)
      .first();
    if (!row) return error("Cuenta no encontrada", 404);
    const [enriched] = await enrichResourcesWithShared(
      env.DB,
      "account",
      [row],
      userId,
      toCamelCaseAccount,
    );
    return success(enriched);
  }

  if (path.startsWith("/accounts/") && method === "PATCH") {
    const id = sanitizeIdentifier(path.split("/")[2]);
    const hasAccess = await verifyAccountOwnership(env.DB, id, userId);
    if (!hasAccess) return error("Cuenta no encontrada", 404);

    const parsed = await parseSafeJsonBody(request);
    if (!parsed.ok) return parsed.response;
    const body = parsed.data;

    const fields: string[] = [];
    const values: any[] = [];

    if (body.name !== undefined) {
      const cleanName = sanitizeText(body.name, 80);
      if (!cleanName) return error("Nombre de cuenta inválido", 400);
      fields.push("name = ?");
      values.push(cleanName);
    }
    if (body.type !== undefined) {
      const validTypes = [
        "checking",
        "savings",
        "investment",
        "cash",
        "credit",
      ];
      if (validTypes.includes(body.type)) {
        fields.push("type = ?");
        values.push(body.type);
      }
    }
    if (body.currency !== undefined) {
      fields.push("currency = ?");
      values.push(sanitizeCurrency(body.currency));
    }
    if (body.color !== undefined) {
      fields.push("color = ?");
      values.push(sanitizeColor(body.color));
    }
    if (body.icon !== undefined) {
      fields.push("icon = ?");
      values.push(sanitizeIcon(body.icon));
    }
    if (body.creditLimit !== undefined) {
      fields.push("credit_limit = ?");
      values.push(
        body.creditLimit != null
          ? sanitizeAmount(body.creditLimit, true, false)
          : null,
      );
    }
    if (body.closingDay !== undefined) {
      fields.push("closing_day = ?");
      values.push(
        body.closingDay != null
          ? Math.min(31, Math.max(1, Math.trunc(Number(body.closingDay))))
          : null,
      );
    }
    if (body.dueDay !== undefined) {
      fields.push("due_day = ?");
      values.push(
        body.dueDay != null
          ? Math.min(31, Math.max(1, Math.trunc(Number(body.dueDay))))
          : null,
      );
    }

    if (fields.length > 0) {
      fields.push("updated_at = datetime('now')");
      values.push(id);
      await env.DB.prepare(
        `UPDATE accounts SET ${fields.join(", ")} WHERE id = ?`,
      )
        .bind(...values)
        .run();
    }

    const updated = await env.DB.prepare(
      "SELECT * FROM accounts WHERE id = ?",
    )
      .bind(id)
      .first();
    if (!updated) return error("Cuenta no encontrada", 404);
    const [enriched] = await enrichResourcesWithShared(
      env.DB,
      "account",
      [updated],
      userId,
      toCamelCaseAccount,
    );
    return success(enriched);
  }

  if (path.startsWith("/accounts/") && method === "DELETE") {
    const id = sanitizeIdentifier(path.split("/")[2]);
    await env.DB.batch([
      env.DB.prepare(
        "DELETE FROM shared_members WHERE resource_type = 'account' AND resource_id = ? AND owner_id = ?",
      ).bind(id, userId),
      env.DB.prepare(
        "DELETE FROM share_invites WHERE resource_type = 'account' AND resource_id = ? AND owner_id = ?",
      ).bind(id, userId),
      env.DB.prepare(
        "DELETE FROM accounts WHERE id = ? AND user_id = ?",
      ).bind(id, userId),
    ]);
    return success(null);
  }

  return error("Ruta no encontrada", 404);
}

