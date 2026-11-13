import { json, error, success } from "../lib/response";
import {
  sanitizeIdentifier,
  sanitizeCurrency,
  sanitizeAmount,
  parseSafeJsonBody,
} from "../lib/sanitize";
import { toCamelCaseBudget } from "../lib/formatters";
import type { Env, AuthenticatedUser } from "../types";

export async function handleBudgets(
  request: Request,
  env: Env,
  url: URL,
  user: AuthenticatedUser,
): Promise<Response> {
  const path = url.pathname;
  const method = request.method;
  const { userId } = user;

  // GET /budgets
  if (path === "/budgets" && method === "GET") {
    const currency = sanitizeCurrency(url.searchParams.get("currency") || "ARS");
    const now = new Date();
    const year = parseInt(url.searchParams.get("year") || String(now.getFullYear()), 10) || now.getFullYear();
    const month = parseInt(url.searchParams.get("month") || String(now.getMonth() + 1), 10) || (now.getMonth() + 1);

    const mPrefix = `${year}-${String(month).padStart(2, "0")}`;
    const startDate = `${mPrefix}-01`;
    const lastDay = new Date(year, month, 0).getDate();
    const endDate = `${mPrefix}-${String(lastDay).padStart(2, "0")}`;

    const query = `
      SELECT b.*,
             c.name AS category_name, c.icon AS category_icon, c.color AS category_color,
             COALESCE((
               SELECT SUM(t.amount_cents)
               FROM transactions t
               WHERE t.category_id = b.category_id
                 AND t.type = 'expense'
                 AND (t.user_id = ? OR EXISTS (
                   SELECT 1 FROM shared_members sm
                   WHERE sm.resource_type = 'account' AND sm.resource_id = t.account_id AND sm.user_id = ?
                 ))
                 AND t.date BETWEEN ? AND ?
             ), 0) AS spent_amount_cents
      FROM budgets b
      JOIN categories c ON b.category_id = c.id
      WHERE b.user_id = ? AND b.currency = ?
      ORDER BY b.amount_cents DESC
    `;

    const rows = (
      await env.DB.prepare(query)
        .bind(userId, userId, startDate, endDate, userId, currency)
        .all()
    ).results;

    return success(rows.map(toCamelCaseBudget));
  }

  // PUT /budgets (Crear o actualizar presupuesto de categoría)
  if (path === "/budgets" && method === "PUT") {
    const parsed = await parseSafeJsonBody(request);
    if (!parsed.ok) return parsed.response;
    const body = parsed.data;

    const categoryId = sanitizeIdentifier(body.categoryId);
    if (!categoryId) return error("La categoría es obligatoria", 400);

    const category = await env.DB.prepare(
      "SELECT id FROM categories WHERE id = ?",
    )
      .bind(categoryId)
      .first();
    if (!category) return error("Categoría no encontrada", 404);

    const amount = sanitizeAmount(body.amount, false, false);
    if (amount === null || amount <= 0) {
      return error("El importe del presupuesto debe ser mayor a 0", 400);
    }

    const currency = sanitizeCurrency(body.currency || "ARS");
    const amountCents = Math.round(amount * 100);
    const id = crypto.randomUUID().replace(/-/g, "").slice(0, 16);

    await env.DB.prepare(
      `INSERT INTO budgets (id, user_id, category_id, currency, amount_cents)
       VALUES (?, ?, ?, ?, ?)
       ON CONFLICT(user_id, category_id, currency) DO UPDATE SET
         amount_cents = excluded.amount_cents,
         updated_at = datetime('now')`,
    )
      .bind(id, userId, categoryId, currency, amountCents)
      .run();

    const saved = await env.DB.prepare(
      `SELECT b.*, c.name AS category_name, c.icon AS category_icon, c.color AS category_color
       FROM budgets b
       JOIN categories c ON b.category_id = c.id
       WHERE b.user_id = ? AND b.category_id = ? AND b.currency = ?`,
    )
      .bind(userId, categoryId, currency)
      .first();

    return success(toCamelCaseBudget(saved));
  }

  // DELETE /budgets/:id
  if (path.startsWith("/budgets/") && method === "DELETE") {
    const id = sanitizeIdentifier(path.split("/")[2]);
    await env.DB.prepare(
      "DELETE FROM budgets WHERE id = ? AND user_id = ?",
    )
      .bind(id, userId)
      .run();
    return success(null);
  }

  return error("Ruta de presupuestos no encontrada", 404);
}

