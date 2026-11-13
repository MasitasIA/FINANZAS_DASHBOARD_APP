import { json, error, success } from "../lib/response";
import {
  sanitizeText,
  sanitizeIdentifier,
  sanitizeAmount,
  sanitizeDate,
  parseSafeJsonBody,
} from "../lib/sanitize";
import { verifyAccountOwnership } from "../lib/rls";
import { toCamelCaseInstallment } from "../lib/formatters";
import type { Env, AuthenticatedUser } from "../types";

export async function handleInstallments(
  request: Request,
  env: Env,
  url: URL,
  user: AuthenticatedUser,
): Promise<Response> {
  const path = url.pathname;
  const method = request.method;
  const { userId } = user;

  // GET /installments?accountId=...
  if (path === "/installments" && method === "GET") {
    const accountId = sanitizeIdentifier(url.searchParams.get("accountId"));
    let query = `
      SELECT i.*,
             (SELECT COUNT(*) FROM transactions t WHERE t.installment_id = i.id) AS paid_installments_count,
             (i.total_amount_cents - (SELECT COALESCE(SUM(t.amount_cents), 0) FROM transactions t WHERE t.installment_id = i.id)) AS remaining_amount_cents
      FROM credit_card_installments i
      WHERE (i.user_id = ? OR EXISTS (
        SELECT 1 FROM shared_members sm
        WHERE sm.resource_type = 'account' AND sm.resource_id = i.account_id AND sm.user_id = ?
      ))
    `;
    const params: any[] = [userId, userId];

    if (accountId) {
      const hasAccess = await verifyAccountOwnership(env.DB, accountId, userId);
      if (!hasAccess) return success([]);
      query += " AND i.account_id = ?";
      params.push(accountId);
    }

    query += " ORDER BY i.created_at DESC";

    const rows = (await env.DB.prepare(query).bind(...params).all()).results;
    return success(rows.map(toCamelCaseInstallment));
  }

  // POST /installments
  if (path === "/installments" && method === "POST") {
    const parsed = await parseSafeJsonBody(request);
    if (!parsed.ok) return parsed.response;
    const body = parsed.data;

    const accountId = sanitizeIdentifier(body.accountId);
    if (!accountId) return error("La cuenta de tarjeta es requerida", 400);

    const hasAccess = await verifyAccountOwnership(env.DB, accountId, userId);
    if (!hasAccess) return error("No tienes acceso a esta cuenta", 403);

    const account = await env.DB.prepare(
      "SELECT * FROM accounts WHERE id = ?",
    )
      .bind(accountId)
      .first();

    if (!account || account.type !== "credit") {
      return error("La cuenta debe ser una tarjeta de crédito", 400);
    }

    const description = sanitizeText(body.description, 160);
    if (!description) return error("La descripción es obligatoria", 400);

    const totalAmount = sanitizeAmount(body.totalAmount, false, false);
    if (totalAmount === null || totalAmount <= 0) {
      return error("El monto total debe ser mayor a 0", 400);
    }

    const cashPrice =
      body.cashPrice != null
        ? sanitizeAmount(body.cashPrice, false, false) ?? totalAmount
        : totalAmount;

    const installmentsCount = Math.trunc(Number(body.installmentsCount));
    if (isNaN(installmentsCount) || installmentsCount < 2 || installmentsCount > 60) {
      return error("La cantidad de cuotas debe ser entre 2 y 60", 400);
    }

    const totalAmountCents = Math.round(totalAmount * 100);
    const cashPriceCents = Math.round(cashPrice * 100);
    const installmentAmountCents = Math.round(totalAmountCents / installmentsCount);
    const firstDueDate = sanitizeDate(body.firstDueDate || new Date().toISOString().slice(0, 10));

    const installmentId = crypto.randomUUID().replace(/-/g, "").slice(0, 16);
    const txId = crypto.randomUUID().replace(/-/g, "").slice(0, 16);
    const categoryId = sanitizeIdentifier(body.categoryId) || "cat-other-exp";

    // Insertar compra en cuotas y registrar primera cuota en transactions
    await env.DB.batch([
      env.DB.prepare(
        `INSERT INTO credit_card_installments (
           id, user_id, account_id, transaction_id, description,
           total_amount_cents, cash_price_cents, installments_count,
           installment_amount_cents, first_due_date, status
         ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'active')`,
      ).bind(
        installmentId,
        userId,
        accountId,
        txId,
        description,
        totalAmountCents,
        cashPriceCents,
        installmentsCount,
        installmentAmountCents,
        firstDueDate,
      ),
      env.DB.prepare(
        `INSERT INTO transactions (
           id, user_id, author_name, account_id, category_id, type,
           amount, amount_cents, currency, description, date,
           installment_id, installment_number, installments_total
         ) VALUES (?, ?, ?, ?, ?, 'expense', ?, ?, ?, ?, ?, ?, 1, ?)`,
      ).bind(
        txId,
        userId,
        user.displayName,
        accountId,
        categoryId,
        installmentAmountCents / 100,
        installmentAmountCents,
        account.currency,
        `${description} (Cuota 1/${installmentsCount})`,
        firstDueDate,
        installmentId,
        installmentsCount,
      ),
    ]);

    const created = await env.DB.prepare(
      `SELECT i.*, 1 AS paid_installments_count,
              (i.total_amount_cents - i.installment_amount_cents) AS remaining_amount_cents
       FROM credit_card_installments i WHERE i.id = ?`,
    )
      .bind(installmentId)
      .first();

    return success(toCamelCaseInstallment(created), 201);
  }

  // POST /installments/:id/cancel
  if (path.startsWith("/installments/") && path.endsWith("/cancel") && method === "POST") {
    const id = sanitizeIdentifier(path.split("/")[2]);
    const row = await env.DB.prepare(
      "SELECT * FROM credit_card_installments WHERE id = ? AND user_id = ?",
    )
      .bind(id, userId)
      .first();

    if (!row) return error("Plan de cuotas no encontrado", 404);

    await env.DB.prepare(
      "UPDATE credit_card_installments SET status = 'cancelled' WHERE id = ?",
    )
      .bind(id)
      .run();

    return success({ success: true });
  }

  return error("Ruta de cuotas no encontrada", 404);
}

