import { json, error, success } from "../lib/response";
import {
  sanitizeText,
  sanitizeIdentifier,
  sanitizeColor,
  sanitizeIcon,
  sanitizeCurrency,
  sanitizeAmount,
  sanitizeDate,
  parseSafeJsonBody,
} from "../lib/sanitize";
import { verifyAccountOwnership, verifyGoalOwnership } from "../lib/rls";
import {
  toCamelCaseGoal,
  toCamelCaseTransaction,
  enrichResourcesWithShared,
} from "../lib/formatters";
import type { Env, AuthenticatedUser } from "../types";

export async function handleGoals(
  request: Request,
  env: Env,
  url: URL,
  user: AuthenticatedUser,
): Promise<Response> {
  const path = url.pathname;
  const method = request.method;
  const { userId, displayName: userDisplayName } = user;

  if (path === "/goals" && method === "GET") {
    const rows = await env.DB.prepare(
      `SELECT * FROM savings_goals g
       WHERE g.user_id = ?
          OR EXISTS (
            SELECT 1 FROM shared_members sm
            WHERE sm.resource_type = 'goal' AND sm.resource_id = g.id AND sm.user_id = ?
          )
       ORDER BY g.created_at ASC`,
    )
      .bind(userId, userId)
      .all();
    const data = await enrichResourcesWithShared(
      env.DB,
      "goal",
      (rows.results || []) as any[],
      userId,
      toCamelCaseGoal,
    );
    return json({
      data,
      total: data.length,
      page: 1,
      pageSize: data.length,
      hasNextPage: false,
    });
  }

  if (path === "/goals" && method === "POST") {
    const parsed = await parseSafeJsonBody(request);
    if (!parsed.ok) return parsed.response;
    const body = parsed.data;

    const name = sanitizeText(body.name, 80);
    if (!name) return error("El nombre de la meta es obligatorio", 400);

    const targetAmount = sanitizeAmount(body.targetAmount, false, false);
    if (targetAmount === null) {
      return error("El monto objetivo debe ser mayor a 0", 400);
    }

    const currentAmount =
      sanitizeAmount(body.currentAmount ?? 0, true, false) ?? 0;
    const currency = sanitizeCurrency(body.currency);
    const deadline =
      body.deadline && /^\d{4}-\d{2}-\d{2}$/.test(String(body.deadline))
        ? String(body.deadline)
        : null;
    const icon = sanitizeIcon(body.icon, "piggy-bank");
    const color = sanitizeColor(body.color, "#e23d28");
    const validStatuses = ["active", "completed", "paused"];
    const status = validStatuses.includes(body.status)
      ? body.status
      : "active";

    const id = crypto.randomUUID().replace(/-/g, "").slice(0, 16);
    const targetAmountCents =
      body.targetAmountCents != null
        ? Math.round(Number(body.targetAmountCents))
        : Math.round(targetAmount * 100);
    const currentAmountCents =
      body.currentAmountCents != null
        ? Math.round(Number(body.currentAmountCents))
        : Math.round(currentAmount * 100);

    await env.DB.prepare(
      `INSERT INTO savings_goals (id, user_id, name, target_amount, target_amount_cents, current_amount, current_amount_cents, currency, deadline, icon, color, status)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    )
      .bind(
        id,
        userId,
        name,
        targetAmount,
        targetAmountCents,
        currentAmount,
        currentAmountCents,
        currency,
        deadline,
        icon,
        color,
        status,
      )
      .run();

    const created = await env.DB.prepare(
      "SELECT * FROM savings_goals WHERE id = ? AND user_id = ?",
    )
      .bind(id, userId)
      .first();
    return success(
      {
        ...toCamelCaseGoal(created),
        isOwner: true,
        isShared: false,
        members: [],
      },
      201,
    );
  }

  // Aporte a meta (transferencia desde cuenta O ingreso directo a la meta)
  if (
    path.startsWith("/goals/") &&
    path.endsWith("/contribute") &&
    method === "POST"
  ) {
    const goalId = sanitizeIdentifier(path.split("/")[2]);
    const parsed = await parseSafeJsonBody(request);
    if (!parsed.ok) return parsed.response;
    const body = parsed.data;

    const rawAccountId = sanitizeIdentifier(body.accountId);
    const isDirectIncome =
      body.isDirectIncome === true ||
      !rawAccountId ||
      rawAccountId === "direct-goal";
    const amount = sanitizeAmount(body.amount, false, false);
    if (amount === null) return error("Monto de aporte inválido", 400);

    const hasGoalAccess = await verifyGoalOwnership(env.DB, goalId, userId);
    if (!hasGoalAccess) return error("Meta no encontrada", 404);

    const goal = await env.DB.prepare(
      "SELECT * FROM savings_goals WHERE id = ?",
    )
      .bind(goalId)
      .first();
    if (!goal) return error("Meta no encontrada", 404);

    let effectiveAccountId = "direct-goal";
    let effectiveType = "income";
    let effectiveCategoryId =
      sanitizeIdentifier(body.categoryId) || "cat-contribution";
    if (effectiveCategoryId === "cat-savings") {
      effectiveCategoryId = "cat-contribution";
    }
    let effectiveDesc = `Ingreso directo a meta: ${goal.name}`;

    if (!isDirectIncome) {
      // ── RLS: Verificar que la cuenta origen pertenezca o sea compartida con el usuario
      const ownsAccount = await verifyAccountOwnership(
        env.DB,
        rawAccountId,
        userId,
      );
      if (!ownsAccount) {
        return error(
          "Acceso denegado: la cuenta seleccionada no te pertenece",
          403,
        );
      }
      effectiveAccountId = rawAccountId;
      effectiveType = "expense";
      effectiveCategoryId = "cat-savings";
      effectiveDesc = `Aporte a meta: ${goal.name}`;
    }

    const txId = crypto.randomUUID().replace(/-/g, "").slice(0, 16);
    const date = sanitizeDate(body.date);
    const note =
      body.note != null ? sanitizeText(body.note, 400) || null : null;

    const amountCents =
      body.amountCents != null
        ? Math.round(Number(body.amountCents))
        : Math.round(amount * 100);

    await env.DB.prepare(
      `INSERT INTO transactions (id, user_id, author_name, account_id, category_id, type, amount, amount_cents, currency, description, note, date, goal_id)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    )
      .bind(
        txId,
        userId,
        userDisplayName,
        effectiveAccountId,
        effectiveCategoryId,
        effectiveType,
        amount,
        amountCents,
        goal.currency,
        sanitizeText(effectiveDesc, 160),
        note,
        date,
        goalId,
      )
      .run();

    const updatedGoal = await env.DB.prepare(
      "SELECT * FROM savings_goals WHERE id = ?",
    )
      .bind(goalId)
      .first();
    const [enrichedGoal] = await enrichResourcesWithShared(
      env.DB,
      "goal",
      updatedGoal ? [updatedGoal] : [],
      userId,
      toCamelCaseGoal,
    );
    const createdTx = await env.DB.prepare(
      "SELECT * FROM transactions WHERE id = ? AND user_id = ?",
    )
      .bind(txId, userId)
      .first();

    return success({
      goal: enrichedGoal,
      transaction: toCamelCaseTransaction(createdTx),
    });
  }

  // Retiro de meta
  if (
    path.startsWith("/goals/") &&
    path.endsWith("/withdraw") &&
    method === "POST"
  ) {
    const goalId = sanitizeIdentifier(path.split("/")[2]);
    const parsed = await parseSafeJsonBody(request);
    if (!parsed.ok) return parsed.response;
    const body = parsed.data;

    const accountId = sanitizeIdentifier(body.accountId);
    const amount = sanitizeAmount(body.amount, false, false);
    if (amount === null) return error("Monto de retiro inválido", 400);

    const hasGoalAccess = await verifyGoalOwnership(env.DB, goalId, userId);
    if (!hasGoalAccess) return error("Meta no encontrada", 404);

    const goal = await env.DB.prepare(
      "SELECT * FROM savings_goals WHERE id = ?",
    )
      .bind(goalId)
      .first();
    if (!goal) return error("Meta no encontrada", 404);

    // ── RLS: Verificar que la cuenta destino pertenezca o sea compartida con el usuario
    const ownsAccount = await verifyAccountOwnership(
      env.DB,
      accountId,
      userId,
    );
    if (!ownsAccount) {
      return error(
        "Acceso denegado: la cuenta seleccionada no te pertenece",
        403,
      );
    }

    const txId = crypto.randomUUID().replace(/-/g, "").slice(0, 16);
    const date = sanitizeDate(body.date);
    const note =
      body.note != null ? sanitizeText(body.note, 400) || null : null;

    const amountCents = Math.round(amount * 100);

    await env.DB.prepare(
      `INSERT INTO transactions (id, user_id, author_name, account_id, category_id, type, amount, amount_cents, currency, description, note, date, goal_id)
       VALUES (?, ?, ?, ?, 'cat-savings', 'income', ?, ?, ?, ?, ?, ?, ?)`,
    )
      .bind(
        txId,
        userId,
        userDisplayName,
        accountId,
        amount,
        amountCents,
        goal.currency,
        sanitizeText(`Retiro de meta: ${goal.name}`, 160),
        note,
        date,
        goalId,
      )
      .run();

    const updatedGoal = await env.DB.prepare(
      "SELECT * FROM savings_goals WHERE id = ?",
    )
      .bind(goalId)
      .first();
    const [enrichedGoal] = await enrichResourcesWithShared(
      env.DB,
      "goal",
      updatedGoal ? [updatedGoal] : [],
      userId,
      toCamelCaseGoal,
    );
    const createdTx = await env.DB.prepare(
      "SELECT * FROM transactions WHERE id = ? AND user_id = ?",
    )
      .bind(txId, userId)
      .first();

    return success({
      goal: enrichedGoal,
      transaction: toCamelCaseTransaction(createdTx),
    });
  }

  if (path.startsWith("/goals/") && method === "GET") {
    const id = sanitizeIdentifier(path.split("/")[2]);
    const row = await env.DB.prepare(
      `SELECT * FROM savings_goals g
       WHERE g.id = ?
         AND (
           g.user_id = ?
           OR EXISTS (
             SELECT 1 FROM shared_members sm
             WHERE sm.resource_type = 'goal' AND sm.resource_id = g.id AND sm.user_id = ?
           )
         )`,
    )
      .bind(id, userId, userId)
      .first();
    if (!row) return error("Meta no encontrada", 404);
    const [enriched] = await enrichResourcesWithShared(
      env.DB,
      "goal",
      [row],
      userId,
      toCamelCaseGoal,
    );
    return success(enriched);
  }

  if (path.startsWith("/goals/") && method === "PATCH") {
    const id = sanitizeIdentifier(path.split("/")[2]);
    const hasAccess = await verifyGoalOwnership(env.DB, id, userId);
    if (!hasAccess) return error("Meta no encontrada", 404);

    const parsed = await parseSafeJsonBody(request);
    if (!parsed.ok) return parsed.response;
    const body = parsed.data;

    const fields: string[] = [];
    const values: any[] = [];

    if (body.name !== undefined) {
      const cleanName = sanitizeText(body.name, 80);
      if (!cleanName) return error("Nombre de meta inválido", 400);
      fields.push("name = ?");
      values.push(cleanName);
    }
    if (body.targetAmount !== undefined) {
      const targetAmount = sanitizeAmount(body.targetAmount, false, false);
      if (targetAmount === null) return error("Monto objetivo inválido", 400);
      fields.push("target_amount = ?", "target_amount_cents = ?");
      values.push(targetAmount, Math.round(targetAmount * 100));
    }
    if (body.currentAmount !== undefined) {
      const currentAmount = sanitizeAmount(body.currentAmount, true, false);
      if (currentAmount === null) return error("Monto actual inválido", 400);
      fields.push("current_amount = ?", "current_amount_cents = ?");
      values.push(currentAmount, Math.round(currentAmount * 100));
    }
    if (body.currency !== undefined) {
      fields.push("currency = ?");
      values.push(sanitizeCurrency(body.currency));
    }
    if (body.deadline !== undefined) {
      fields.push("deadline = ?");
      values.push(
        body.deadline && /^\d{4}-\d{2}-\d{2}$/.test(String(body.deadline))
          ? String(body.deadline)
          : null,
      );
    }
    if (body.icon !== undefined) {
      fields.push("icon = ?");
      values.push(sanitizeIcon(body.icon, "piggy-bank"));
    }
    if (body.color !== undefined) {
      fields.push("color = ?");
      values.push(sanitizeColor(body.color));
    }
    if (body.status !== undefined) {
      const validStatuses = ["active", "completed", "paused"];
      if (validStatuses.includes(body.status)) {
        fields.push("status = ?");
        values.push(body.status);
      }
    }

    if (fields.length > 0) {
      fields.push("updated_at = datetime('now')");
      values.push(id);
      await env.DB.prepare(
        `UPDATE savings_goals SET ${fields.join(", ")} WHERE id = ?`,
      )
        .bind(...values)
        .run();
    }

    const updated = await env.DB.prepare(
      "SELECT * FROM savings_goals WHERE id = ?",
    )
      .bind(id)
      .first();
    if (!updated) return error("Meta no encontrada", 404);
    const [enriched] = await enrichResourcesWithShared(
      env.DB,
      "goal",
      [updated],
      userId,
      toCamelCaseGoal,
    );
    return success(enriched);
  }

  if (path.startsWith("/goals/") && method === "DELETE") {
    const id = sanitizeIdentifier(path.split("/")[2]);
    await env.DB.batch([
      env.DB.prepare(
        "DELETE FROM shared_members WHERE resource_type = 'goal' AND resource_id = ? AND owner_id = ?",
      ).bind(id, userId),
      env.DB.prepare(
        "DELETE FROM share_invites WHERE resource_type = 'goal' AND resource_id = ? AND owner_id = ?",
      ).bind(id, userId),
      env.DB.prepare(
        "DELETE FROM savings_goals WHERE id = ? AND user_id = ?",
      ).bind(id, userId),
    ]);
    return success(null);
  }

  return error("Ruta no encontrada", 404);
}

