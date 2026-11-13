import { json, error, success } from "../lib/response";
import {
  sanitizeText,
  sanitizeIdentifier,
  sanitizeCurrency,
  sanitizeAmount,
  sanitizeDate,
  parseSafeJsonBody,
} from "../lib/sanitize";
import { verifyAccountOwnership, verifyGoalOwnership } from "../lib/rls";
import { toCamelCaseTransaction } from "../lib/formatters";
import type { Env, AuthenticatedUser } from "../types";

export async function handleTransactions(
  request: Request,
  env: Env,
  url: URL,
  user: AuthenticatedUser,
): Promise<Response> {
  const path = url.pathname;
  const method = request.method;
  const { userId, displayName: userDisplayName } = user;

  if (path === "/transactions" && method === "GET") {
    const accountId = sanitizeIdentifier(url.searchParams.get("accountId"));
    const categoryId = sanitizeIdentifier(url.searchParams.get("categoryId"));
    const goalId = sanitizeIdentifier(url.searchParams.get("goalId"));
    const typeParam = url.searchParams.get("type");
    const type =
      typeParam && ["income", "expense", "transfer"].includes(typeParam)
        ? typeParam
        : "";
    const startDate = url.searchParams.get("startDate");
    const endDate = url.searchParams.get("endDate");
    const page = Math.max(
      1,
      parseInt(url.searchParams.get("page") || "1", 10) || 1,
    );
    // Límite máximo de 100 registros por página para evitar volcados masivos
    const pageSize = Math.min(
      100,
      Math.max(
        1,
        parseInt(url.searchParams.get("pageSize") || "30", 10) || 30,
      ),
    );
    const offset = (page - 1) * pageSize;

    const conditions: string[] = [];
    const bindings: any[] = [];

    if (accountId) {
      const hasAccess = await verifyAccountOwnership(
        env.DB,
        accountId,
        userId,
      );
      if (!hasAccess) {
        return json({
          data: [],
          total: 0,
          page,
          pageSize,
          hasNextPage: false,
        });
      }
      conditions.push("(account_id = ? OR to_account_id = ?)");
      bindings.push(accountId, accountId);
    } else if (goalId) {
      const hasAccess = await verifyGoalOwnership(env.DB, goalId, userId);
      if (!hasAccess) {
        return json({
          data: [],
          total: 0,
          page,
          pageSize,
          hasNextPage: false,
        });
      }
      conditions.push("goal_id = ?");
      bindings.push(goalId);
    } else {
      conditions.push(
        `(user_id = ?
          OR EXISTS (
            SELECT 1 FROM shared_members sm
            WHERE sm.resource_type = 'account' AND sm.resource_id = transactions.account_id AND sm.user_id = ?
          )
          OR EXISTS (
            SELECT 1 FROM shared_members sm
            WHERE sm.resource_type = 'goal' AND sm.resource_id = transactions.goal_id AND sm.user_id = ?
          ))`,
      );
      bindings.push(userId, userId, userId);
    }

    if (categoryId) {
      conditions.push("category_id = ?");
      bindings.push(categoryId);
    }
    if (goalId && accountId) {
      conditions.push("goal_id = ?");
      bindings.push(goalId);
    }
    if (type) {
      conditions.push("type = ?");
      bindings.push(type);
    }
    if (startDate && /^\d{4}-\d{2}-\d{2}$/.test(startDate)) {
      conditions.push("date >= ?");
      bindings.push(startDate);
    }
    if (endDate && /^\d{4}-\d{2}-\d{2}$/.test(endDate)) {
      conditions.push("date <= ?");
      bindings.push(endDate);
    }

    const whereClause = `WHERE ${conditions.join(" AND ")}`;

    const countQuery = `SELECT COUNT(*) as count FROM transactions ${whereClause}`;
    const totalResult = await env.DB.prepare(countQuery)
      .bind(...bindings)
      .first();
    const total = (totalResult?.count as number) || 0;

    const listQuery = `SELECT * FROM transactions ${whereClause} ORDER BY date DESC, created_at DESC LIMIT ? OFFSET ?`;
    const rows = await env.DB.prepare(listQuery)
      .bind(...bindings, pageSize, offset)
      .all();
    const data = (rows.results || []).map(toCamelCaseTransaction);

    return json({
      data,
      total,
      page,
      pageSize,
      hasNextPage: offset + data.length < total,
    });
  }

  if (path === "/transactions" && method === "POST") {
    const parsed = await parseSafeJsonBody(request);
    if (!parsed.ok) return parsed.response;
    const body = parsed.data;

    const rawAccountId = sanitizeIdentifier(body.accountId);
    const rawCategoryId = sanitizeIdentifier(body.categoryId);
    const toAccountId = body.toAccountId
      ? sanitizeIdentifier(body.toAccountId)
      : null;
    const goalId = body.goalId ? sanitizeIdentifier(body.goalId) : null;

    const validTxTypes = ["income", "expense", "transfer"];
    if (!validTxTypes.includes(body.type)) {
      return error("Tipo de transacción inválido", 400);
    }

    const amount = sanitizeAmount(body.amount, false, false);
    if (amount === null) {
      return error("El monto debe ser un número positivo válido", 400);
    }

    const isDirectGoalIncome =
      Boolean(goalId) &&
      body.type === "income" &&
      (!rawAccountId || rawAccountId === "direct-goal");

    const accountId = isDirectGoalIncome ? "direct-goal" : rawAccountId;
    const categoryId =
      isDirectGoalIncome && (!rawCategoryId || rawCategoryId === "cat-savings")
        ? "cat-contribution"
        : rawCategoryId;

    if (!isDirectGoalIncome) {
      // ── RLS: Verificar que la cuenta origen pertenezca o sea compartida con el usuario autenticado
      const ownsOriginAccount = await verifyAccountOwnership(
        env.DB,
        accountId,
        userId,
      );
      if (!ownsOriginAccount) {
        return error(
          "Acceso denegado: la cuenta origen no existe o no tienes acceso",
          403,
        );
      }
    }

    // ── RLS: Si hay cuenta destino, verificar que también pertenezca o sea compartida
    if (toAccountId) {
      const ownsDestAccount = await verifyAccountOwnership(
        env.DB,
        toAccountId,
        userId,
      );
      if (!ownsDestAccount) {
        return error(
          "Acceso denegado: la cuenta destino no existe o no tienes acceso",
          403,
        );
      }
    }

    // ── RLS: Si hay meta asociada, verificar que pertenezca o sea compartida
    if (goalId) {
      const ownsGoal = await verifyGoalOwnership(env.DB, goalId, userId);
      if (!ownsGoal) {
        return error(
          "Acceso denegado: la meta de ahorro no existe o no tienes acceso",
          403,
        );
      }
    }

    const id = crypto.randomUUID().replace(/-/g, "").slice(0, 16);
    const description = sanitizeText(body.description, 160);
    const note =
      body.note != null ? sanitizeText(body.note, 400) || null : null;
    const currency = sanitizeCurrency(body.currency);
    const date = sanitizeDate(body.date);
    const amountCents =
      body.amountCents != null
        ? Math.round(Number(body.amountCents))
        : Math.round(amount * 100);

    await env.DB.prepare(
      `INSERT INTO transactions (id, user_id, author_name, account_id, category_id, type, amount, amount_cents, currency, description, note, date, to_account_id, goal_id)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    )
      .bind(
        id,
        userId,
        userDisplayName,
        accountId,
        categoryId,
        body.type,
        amount,
        amountCents,
        currency,
        description,
        note,
        date,
        toAccountId,
        goalId,
      )
      .run();

    const created = await env.DB.prepare(
      "SELECT * FROM transactions WHERE id = ? AND user_id = ?",
    )
      .bind(id, userId)
      .first();
    return success(toCamelCaseTransaction(created), 201);
  }

  if (path.startsWith("/transactions/") && method === "GET") {
    const id = sanitizeIdentifier(path.split("/")[2]);
    const row = await env.DB.prepare(
      "SELECT * FROM transactions WHERE id = ? AND user_id = ?",
    )
      .bind(id, userId)
      .first();
    if (!row) return error("Transacción no encontrada", 404);
    return success(toCamelCaseTransaction(row));
  }

  if (path.startsWith("/transactions/") && method === "PATCH") {
    const id = sanitizeIdentifier(path.split("/")[2]);
    const parsed = await parseSafeJsonBody(request);
    if (!parsed.ok) return parsed.response;
    const body = parsed.data;

    const fields: string[] = [];
    const values: any[] = [];

    if (body.description !== undefined) {
      fields.push("description = ?");
      values.push(sanitizeText(body.description, 160));
    }
    if (body.note !== undefined) {
      fields.push("note = ?");
      values.push(
        body.note != null ? sanitizeText(body.note, 400) || null : null,
      );
    }
    if (body.amount !== undefined) {
      const amount = sanitizeAmount(body.amount, false, false);
      if (amount === null) return error("Monto inválido", 400);
      const amountCents =
        body.amountCents != null
          ? Math.round(Number(body.amountCents))
          : Math.round(amount * 100);
      fields.push("amount = ?", "amount_cents = ?");
      values.push(amount, amountCents);
    }
    if (body.date !== undefined) {
      fields.push("date = ?");
      values.push(sanitizeDate(body.date));
    }
    if (body.categoryId !== undefined) {
      fields.push("category_id = ?");
      values.push(sanitizeIdentifier(body.categoryId));
    }

    if (fields.length > 0) {
      fields.push("updated_at = datetime('now')");
      values.push(id, userId);
      await env.DB.prepare(
        `UPDATE transactions SET ${fields.join(", ")} WHERE id = ? AND user_id = ?`,
      )
        .bind(...values)
        .run();
    }

    const updated = await env.DB.prepare(
      "SELECT * FROM transactions WHERE id = ? AND user_id = ?",
    )
      .bind(id, userId)
      .first();
    if (!updated) return error("Transacción no encontrada", 404);
    return success(toCamelCaseTransaction(updated));
  }

  if (path.startsWith("/transactions/") && method === "DELETE") {
    const id = sanitizeIdentifier(path.split("/")[2]);
    await env.DB.prepare(
      "DELETE FROM transactions WHERE id = ? AND user_id = ?",
    )
      .bind(id, userId)
      .run();
    return success(null);
  }

  return error("Ruta no encontrada", 404);
}

