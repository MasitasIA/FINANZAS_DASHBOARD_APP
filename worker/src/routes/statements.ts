import { json, error, success } from "../lib/response";
import {
  sanitizeText,
  sanitizeIdentifier,
  sanitizeAmount,
  sanitizeDate,
  parseSafeJsonBody,
} from "../lib/sanitize";
import { verifyAccountOwnership } from "../lib/rls";
import { toCamelCaseStatement } from "../lib/formatters";
import type { Env, AuthenticatedUser } from "../types";

export async function handleStatements(
  request: Request,
  env: Env,
  url: URL,
  user: AuthenticatedUser,
): Promise<Response> {
  const path = url.pathname;
  const method = request.method;
  const { userId } = user;

  // GET /statements?accountId=...
  if (path === "/statements" && method === "GET") {
    const accountId = sanitizeIdentifier(url.searchParams.get("accountId"));
    let query = `
      SELECT s.* FROM credit_card_statements s
      WHERE (s.user_id = ? OR EXISTS (
        SELECT 1 FROM shared_members sm
        WHERE sm.resource_type = 'account' AND sm.resource_id = s.account_id AND sm.user_id = ?
      ))
    `;
    const params: any[] = [userId, userId];

    if (accountId) {
      const hasAccess = await verifyAccountOwnership(env.DB, accountId, userId);
      if (!hasAccess) return success([]);
      query += " AND s.account_id = ?";
      params.push(accountId);
    }

    query += " ORDER BY s.closing_date DESC";

    const rows = (await env.DB.prepare(query).bind(...params).all()).results;
    return success(rows.map(toCamelCaseStatement));
  }

  // POST /statements/generate
  // Genera un resumen del período para una tarjeta de crédito
  if (path === "/statements/generate" && method === "POST") {
    const parsed = await parseSafeJsonBody(request);
    if (!parsed.ok) return parsed.response;
    const body = parsed.data;

    const accountId = sanitizeIdentifier(body.accountId);
    if (!accountId) return error("La cuenta es obligatoria", 400);

    const hasAccess = await verifyAccountOwnership(env.DB, accountId, userId);
    if (!hasAccess) return error("No tienes acceso a esta tarjeta", 403);

    const account = await env.DB.prepare(
      "SELECT * FROM accounts WHERE id = ?",
    )
      .bind(accountId)
      .first();

    if (!account || account.type !== "credit") {
      return error("La cuenta debe ser una tarjeta de crédito", 400);
    }

    const today = new Date().toISOString().slice(0, 10);
    const closingDay = Number(account.closing_day || 20);
    const dueDay = Number(account.due_day || 5);

    // Calcular fechas del período
    const now = new Date();
    const curYear = now.getFullYear();
    const curMonth = now.getMonth(); // 0-based
    const closingDate = sanitizeDate(
      body.closingDate ||
        `${curYear}-${String(curMonth + 1).padStart(2, "0")}-${String(closingDay).padStart(2, "0")}`,
    );
    const dueDate = sanitizeDate(
      body.dueDate ||
        `${curMonth === 11 ? curYear + 1 : curYear}-${String(((curMonth + 1) % 12) + 1).padStart(2, "0")}-${String(dueDay).padStart(2, "0")}`,
    );

    // Period start = 1 mes antes del cierre
    const periodStartDate = new Date(closingDate);
    periodStartDate.setMonth(periodStartDate.getMonth() - 1);
    periodStartDate.setDate(periodStartDate.getDate() + 1);
    const periodStart = periodStartDate.toISOString().slice(0, 10);

    // Consumos del período en centavos
    const chargesRes = await env.DB.prepare(
      `SELECT COALESCE(SUM(amount_cents), 0) AS total_cents
       FROM transactions
       WHERE account_id = ? AND type = 'expense'
         AND date BETWEEN ? AND ?`,
    )
      .bind(accountId, periodStart, closingDate)
      .first();

    const chargesCents = Number(chargesRes?.total_cents || 0);

    // Saldo impago de resumen anterior
    const lastStatement = await env.DB.prepare(
      `SELECT * FROM credit_card_statements
       WHERE account_id = ? AND closing_date < ?
       ORDER BY closing_date DESC LIMIT 1`,
    )
      .bind(accountId, closingDate)
      .first();

    let previousBalanceCents = 0;
    if (lastStatement) {
      previousBalanceCents = Math.max(
        0,
        Number(lastStatement.total_due_cents || 0) -
          Number(lastStatement.paid_amount_cents || 0),
      );
    }

    const interestCents = body.interestCents
      ? Math.round(Number(body.interestCents))
      : 0;
    const totalDueCents = previousBalanceCents + chargesCents + interestCents;
    const minimumDueCents = Math.round(totalDueCents * 0.1); // 10% pago mínimo habitual

    const id = crypto.randomUUID().replace(/-/g, "").slice(0, 16);

    await env.DB.prepare(
      `INSERT INTO credit_card_statements (
         id, user_id, account_id, period_start, closing_date, due_date,
         previous_balance_cents, charges_cents, installments_cents,
         interest_cents, total_due_cents, minimum_due_cents,
         paid_amount_cents, status
       ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 0, ?, ?, ?, 0, 'closed')`,
    )
      .bind(
        id,
        userId,
        accountId,
        periodStart,
        closingDate,
        dueDate,
        previousBalanceCents,
        chargesCents,
        interestCents,
        totalDueCents,
        minimumDueCents,
      )
      .run();

    const created = await env.DB.prepare(
      "SELECT * FROM credit_card_statements WHERE id = ?",
    )
      .bind(id)
      .first();

    return success(toCamelCaseStatement(created), 201);
  }

  // POST /statements/:id/pay
  // Registra el pago total o parcial de un resumen
  if (
    path.startsWith("/statements/") &&
    path.endsWith("/pay") &&
    method === "POST"
  ) {
    const statementId = sanitizeIdentifier(path.split("/")[2]);
    const parsed = await parseSafeJsonBody(request);
    if (!parsed.ok) return parsed.response;
    const body = parsed.data;

    const statement = await env.DB.prepare(
      "SELECT * FROM credit_card_statements WHERE id = ? AND (user_id = ? OR EXISTS (SELECT 1 FROM shared_members sm WHERE sm.resource_type = 'account' AND sm.resource_id = credit_card_statements.account_id AND sm.user_id = ?))",
    )
      .bind(statementId, userId, userId)
      .first();

    if (!statement) return error("Resumen no encontrado", 404);

    const fromAccountId = sanitizeIdentifier(body.fromAccountId);
    if (!fromAccountId) return error("Debes seleccionar una cuenta de origen", 400);

    const hasFromAccess = await verifyAccountOwnership(
      env.DB,
      fromAccountId,
      userId,
    );
    if (!hasFromAccess) return error("No tienes acceso a la cuenta de pago", 403);

    const payAmount = sanitizeAmount(body.amount, false, false);
    if (payAmount === null || payAmount <= 0) {
      return error("El importe a pagar debe ser mayor a 0", 400);
    }

    const payAmountCents = Math.round(payAmount * 100);
    const newPaidAmountCents =
      Number(statement.paid_amount_cents || 0) + payAmountCents;
    const totalDueCents = Number(statement.total_due_cents || 0);
    const newStatus =
      newPaidAmountCents >= totalDueCents ? "paid_full" : "paid_partial";

    const txId = crypto.randomUUID().replace(/-/g, "").slice(0, 16);
    const txDate = sanitizeDate(body.date || new Date().toISOString().slice(0, 10));
    const txNote = sanitizeText(body.note || `Pago de resumen vencimiento ${statement.due_date}`, 200);

    // Registrar pago como transferencia desde la cuenta de débito/caja a la tarjeta
    await env.DB.batch([
      env.DB.prepare(
        `INSERT INTO transactions (
           id, user_id, author_name, account_id, to_account_id,
           category_id, type, amount, amount_cents, currency,
           description, note, date
         ) VALUES (?, ?, ?, ?, ?, 'cat-card-payment', 'transfer', ?, ?, ?, 'Pago de tarjeta de crédito', ?, ?)`,
      ).bind(
        txId,
        userId,
        user.displayName,
        fromAccountId,
        statement.account_id,
        payAmount,
        payAmountCents,
        "ARS",
        txNote,
        txDate,
      ),
      env.DB.prepare(
        `UPDATE credit_card_statements
         SET paid_amount_cents = ?, status = ?, updated_at = datetime('now')
         WHERE id = ?`,
      ).bind(newPaidAmountCents, newStatus, statementId),
    ]);

    const updated = await env.DB.prepare(
      "SELECT * FROM credit_card_statements WHERE id = ?",
    )
      .bind(statementId)
      .first();

    return success(toCamelCaseStatement(updated));
  }

  return error("Ruta de resúmenes no encontrada", 404);
}

