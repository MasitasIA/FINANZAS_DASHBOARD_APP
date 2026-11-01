/**
 * Cloudflare Worker — REST API para Finanzas Dashboard
 * Conexión nativa con SQLite Cloudflare D1
 */

// Type fallback para entornos sin @cloudflare/workers-types global
type D1DatabaseType = any;

export interface Env {
  DB: D1DatabaseType;
  API_TOKEN?: string;
}

// ─── CORS Headers ─────────────────────────────────────────────────────────────
const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PATCH, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
};

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      "Content-Type": "application/json",
      ...CORS_HEADERS,
    },
  });
}

function error(message: string, status = 400) {
  return json({ success: false, error: message }, status);
}

function success<T>(data: T, status = 200) {
  return json({ success: true, data }, status);
}

// ─── Helpers de formateo Snake <-> Camel ──────────────────────────────────────
function toCamelCaseAccount(row: any) {
  if (!row) return null;
  return {
    id: row.id,
    name: row.name,
    type: row.type,
    currency: row.currency,
    balance: row.balance,
    color: row.color,
    icon: row.icon,
    creditLimit: row.credit_limit,
    closingDay: row.closing_day,
    dueDay: row.due_day,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function toCamelCaseTransaction(row: any) {
  if (!row) return null;
  return {
    id: row.id,
    accountId: row.account_id,
    categoryId: row.category_id,
    type: row.type,
    amount: row.amount,
    currency: row.currency,
    description: row.description,
    note: row.note,
    date: row.date,
    toAccountId: row.to_account_id,
    goalId: row.goal_id,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function toCamelCaseGoal(row: any) {
  if (!row) return null;
  return {
    id: row.id,
    name: row.name,
    targetAmount: row.target_amount,
    currentAmount: row.current_amount,
    currency: row.currency,
    deadline: row.deadline,
    icon: row.icon,
    color: row.color,
    status: row.status,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

// ─── Entrypoint del Worker ───────────────────────────────────────────────────
export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    if (request.method === "OPTIONS") {
      return new Response(null, { headers: CORS_HEADERS });
    }

    const url = new URL(request.url);
    const path = url.pathname;
    const method = request.method;

    // Validación de Token si está configurado
    if (env.API_TOKEN && env.API_TOKEN.trim().length > 0) {
      const authHeader = request.headers.get("Authorization");
      const expected = `Bearer ${env.API_TOKEN.trim()}`;
      if (!authHeader || authHeader.trim() !== expected) {
        return error("No autorizado", 401);
      }
    }

    try {
      // ─── ACCOUNTS ──────────────────────────────────────────────────────────
      if (path === "/accounts" && method === "GET") {
        const rows = await env.DB.prepare(
          "SELECT * FROM accounts ORDER BY created_at ASC",
        ).all();
        const data = (rows.results || []).map(toCamelCaseAccount);
        return json({
          data,
          total: data.length,
          page: 1,
          pageSize: data.length,
          hasNextPage: false,
        });
      }

      if (path === "/accounts" && method === "POST") {
        const body: any = await request.json();
        const id =
          body.id || crypto.randomUUID().replace(/-/g, "").slice(0, 16);
        await env.DB.prepare(
          `INSERT INTO accounts (id, name, type, currency, balance, color, icon, credit_limit, closing_day, due_day)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        )
          .bind(
            id,
            body.name,
            body.type,
            body.currency || "ARS",
            body.balance || 0,
            body.color || "#e23d28",
            body.icon || "wallet",
            body.creditLimit ?? null,
            body.closingDay ?? null,
            body.dueDay ?? null,
          )
          .run();

        const created = await env.DB.prepare(
          "SELECT * FROM accounts WHERE id = ?",
        )
          .bind(id)
          .first();
        return success(toCamelCaseAccount(created), 201);
      }

      if (path.startsWith("/accounts/") && method === "GET") {
        const id = path.split("/")[2];
        const row = await env.DB.prepare("SELECT * FROM accounts WHERE id = ?")
          .bind(id)
          .first();
        if (!row) return error("Cuenta no encontrada", 404);
        return success(toCamelCaseAccount(row));
      }

      if (path.startsWith("/accounts/") && method === "PATCH") {
        const id = path.split("/")[2];
        const body: any = await request.json();
        const fields: string[] = [];
        const values: any[] = [];

        if (body.name !== undefined) {
          fields.push("name = ?");
          values.push(body.name);
        }
        if (body.type !== undefined) {
          fields.push("type = ?");
          values.push(body.type);
        }
        if (body.currency !== undefined) {
          fields.push("currency = ?");
          values.push(body.currency);
        }
        if (body.color !== undefined) {
          fields.push("color = ?");
          values.push(body.color);
        }
        if (body.icon !== undefined) {
          fields.push("icon = ?");
          values.push(body.icon);
        }
        if (body.creditLimit !== undefined) {
          fields.push("credit_limit = ?");
          values.push(body.creditLimit);
        }
        if (body.closingDay !== undefined) {
          fields.push("closing_day = ?");
          values.push(body.closingDay);
        }
        if (body.dueDay !== undefined) {
          fields.push("due_day = ?");
          values.push(body.dueDay);
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
        return success(toCamelCaseAccount(updated));
      }

      if (path.startsWith("/accounts/") && method === "DELETE") {
        const id = path.split("/")[2];
        await env.DB.prepare("DELETE FROM accounts WHERE id = ?")
          .bind(id)
          .run();
        return success(null);
      }

      // ─── TRANSACTIONS ──────────────────────────────────────────────────────
      if (path === "/transactions" && method === "GET") {
        const accountId = url.searchParams.get("accountId");
        const categoryId = url.searchParams.get("categoryId");
        const goalId = url.searchParams.get("goalId");
        const type = url.searchParams.get("type");
        const startDate = url.searchParams.get("startDate");
        const endDate = url.searchParams.get("endDate");
        const page = Math.max(
          1,
          parseInt(url.searchParams.get("page") || "1", 10),
        );
        const pageSize = Math.max(
          1,
          parseInt(url.searchParams.get("pageSize") || "30", 10),
        );
        const offset = (page - 1) * pageSize;

        const conditions: string[] = [];
        const bindings: any[] = [];

        if (accountId) {
          conditions.push("(account_id = ? OR to_account_id = ?)");
          bindings.push(accountId, accountId);
        }
        if (categoryId) {
          conditions.push("category_id = ?");
          bindings.push(categoryId);
        }
        if (goalId) {
          conditions.push("goal_id = ?");
          bindings.push(goalId);
        }
        if (type) {
          conditions.push("type = ?");
          bindings.push(type);
        }
        if (startDate) {
          conditions.push("date >= ?");
          bindings.push(startDate);
        }
        if (endDate) {
          conditions.push("date <= ?");
          bindings.push(endDate);
        }

        const whereClause =
          conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "";

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
        const body: any = await request.json();
        const id =
          body.id || crypto.randomUUID().replace(/-/g, "").slice(0, 16);
        await env.DB.prepare(
          `INSERT INTO transactions (id, account_id, category_id, type, amount, currency, description, note, date, to_account_id, goal_id)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        )
          .bind(
            id,
            body.accountId,
            body.categoryId,
            body.type,
            body.amount,
            body.currency || "ARS",
            body.description || "",
            body.note ?? null,
            body.date || new Date().toISOString().slice(0, 10),
            body.toAccountId ?? null,
            body.goalId ?? null,
          )
          .run();

        const created = await env.DB.prepare(
          "SELECT * FROM transactions WHERE id = ?",
        )
          .bind(id)
          .first();
        return success(toCamelCaseTransaction(created), 201);
      }

      if (path.startsWith("/transactions/") && method === "GET") {
        const id = path.split("/")[2];
        const row = await env.DB.prepare(
          "SELECT * FROM transactions WHERE id = ?",
        )
          .bind(id)
          .first();
        if (!row) return error("Transacción no encontrada", 404);
        return success(toCamelCaseTransaction(row));
      }

      if (path.startsWith("/transactions/") && method === "PATCH") {
        const id = path.split("/")[2];
        const body: any = await request.json();
        const fields: string[] = [];
        const values: any[] = [];

        if (body.description !== undefined) {
          fields.push("description = ?");
          values.push(body.description);
        }
        if (body.note !== undefined) {
          fields.push("note = ?");
          values.push(body.note);
        }
        if (body.amount !== undefined) {
          fields.push("amount = ?");
          values.push(body.amount);
        }
        if (body.date !== undefined) {
          fields.push("date = ?");
          values.push(body.date);
        }
        if (body.categoryId !== undefined) {
          fields.push("category_id = ?");
          values.push(body.categoryId);
        }

        if (fields.length > 0) {
          fields.push("updated_at = datetime('now')");
          values.push(id);
          await env.DB.prepare(
            `UPDATE transactions SET ${fields.join(", ")} WHERE id = ?`,
          )
            .bind(...values)
            .run();
        }

        const updated = await env.DB.prepare(
          "SELECT * FROM transactions WHERE id = ?",
        )
          .bind(id)
          .first();
        return success(toCamelCaseTransaction(updated));
      }

      if (path.startsWith("/transactions/") && method === "DELETE") {
        const id = path.split("/")[2];
        await env.DB.prepare("DELETE FROM transactions WHERE id = ?")
          .bind(id)
          .run();
        return success(null);
      }

      // ─── GOALS ─────────────────────────────────────────────────────────────
      if (path === "/goals" && method === "GET") {
        const rows = await env.DB.prepare(
          "SELECT * FROM savings_goals ORDER BY created_at ASC",
        ).all();
        const data = (rows.results || []).map(toCamelCaseGoal);
        return json({
          data,
          total: data.length,
          page: 1,
          pageSize: data.length,
          hasNextPage: false,
        });
      }

      if (path === "/goals" && method === "POST") {
        const body: any = await request.json();
        const id =
          body.id || crypto.randomUUID().replace(/-/g, "").slice(0, 16);
        await env.DB.prepare(
          `INSERT INTO savings_goals (id, name, target_amount, current_amount, currency, deadline, icon, color, status)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        )
          .bind(
            id,
            body.name,
            body.targetAmount,
            body.currentAmount || 0,
            body.currency || "ARS",
            body.deadline ?? null,
            body.icon || "piggy-bank",
            body.color || "#e23d28",
            body.status || "active",
          )
          .run();

        const created = await env.DB.prepare(
          "SELECT * FROM savings_goals WHERE id = ?",
        )
          .bind(id)
          .first();
        return success(toCamelCaseGoal(created), 201);
      }

      if (path.startsWith("/goals/") && method === "GET") {
        const id = path.split("/")[2];
        const row = await env.DB.prepare(
          "SELECT * FROM savings_goals WHERE id = ?",
        )
          .bind(id)
          .first();
        if (!row) return error("Meta no encontrada", 404);
        return success(toCamelCaseGoal(row));
      }

      if (path.startsWith("/goals/") && method === "PATCH") {
        const id = path.split("/")[2];
        const body: any = await request.json();
        const fields: string[] = [];
        const values: any[] = [];

        if (body.name !== undefined) {
          fields.push("name = ?");
          values.push(body.name);
        }
        if (body.targetAmount !== undefined) {
          fields.push("target_amount = ?");
          values.push(body.targetAmount);
        }
        if (body.currentAmount !== undefined) {
          fields.push("current_amount = ?");
          values.push(body.currentAmount);
        }
        if (body.currency !== undefined) {
          fields.push("currency = ?");
          values.push(body.currency);
        }
        if (body.deadline !== undefined) {
          fields.push("deadline = ?");
          values.push(body.deadline);
        }
        if (body.icon !== undefined) {
          fields.push("icon = ?");
          values.push(body.icon);
        }
        if (body.color !== undefined) {
          fields.push("color = ?");
          values.push(body.color);
        }
        if (body.status !== undefined) {
          fields.push("status = ?");
          values.push(body.status);
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
        return success(toCamelCaseGoal(updated));
      }

      if (path.startsWith("/goals/") && method === "DELETE") {
        const id = path.split("/")[2];
        await env.DB.prepare("DELETE FROM savings_goals WHERE id = ?")
          .bind(id)
          .run();
        return success(null);
      }

      // Aporte a meta
      if (
        path.startsWith("/goals/") &&
        path.endsWith("/contribute") &&
        method === "POST"
      ) {
        const goalId = path.split("/")[2];
        const body: any = await request.json();
        const goal = await env.DB.prepare(
          "SELECT * FROM savings_goals WHERE id = ?",
        )
          .bind(goalId)
          .first();
        if (!goal) return error("Meta no encontrada", 404);

        const txId = crypto.randomUUID().replace(/-/g, "").slice(0, 16);
        const date = body.date || new Date().toISOString().slice(0, 10);

        await env.DB.prepare(
          `INSERT INTO transactions (id, account_id, category_id, type, amount, currency, description, note, date, goal_id)
           VALUES (?, ?, 'cat-savings', 'expense', ?, ?, ?, ?, ?, ?)`,
        )
          .bind(
            txId,
            body.accountId,
            body.amount,
            goal.currency,
            `Aporte a meta: ${goal.name}`,
            body.note ?? null,
            date,
            goalId,
          )
          .run();

        const updatedGoal = await env.DB.prepare(
          "SELECT * FROM savings_goals WHERE id = ?",
        )
          .bind(goalId)
          .first();
        const createdTx = await env.DB.prepare(
          "SELECT * FROM transactions WHERE id = ?",
        )
          .bind(txId)
          .first();

        return success({
          goal: toCamelCaseGoal(updatedGoal),
          transaction: toCamelCaseTransaction(createdTx),
        });
      }

      // Retiro de meta
      if (
        path.startsWith("/goals/") &&
        path.endsWith("/withdraw") &&
        method === "POST"
      ) {
        const goalId = path.split("/")[2];
        const body: any = await request.json();
        const goal = await env.DB.prepare(
          "SELECT * FROM savings_goals WHERE id = ?",
        )
          .bind(goalId)
          .first();
        if (!goal) return error("Meta no encontrada", 404);

        const txId = crypto.randomUUID().replace(/-/g, "").slice(0, 16);
        const date = body.date || new Date().toISOString().slice(0, 10);

        await env.DB.prepare(
          `INSERT INTO transactions (id, account_id, category_id, type, amount, currency, description, note, date, goal_id)
           VALUES (?, ?, 'cat-savings', 'income', ?, ?, ?, ?, ?, ?)`,
        )
          .bind(
            txId,
            body.accountId,
            body.amount,
            goal.currency,
            `Retiro de meta: ${goal.name}`,
            body.note ?? null,
            date,
            goalId,
          )
          .run();

        const updatedGoal = await env.DB.prepare(
          "SELECT * FROM savings_goals WHERE id = ?",
        )
          .bind(goalId)
          .first();
        const createdTx = await env.DB.prepare(
          "SELECT * FROM transactions WHERE id = ?",
        )
          .bind(txId)
          .first();

        return success({
          goal: toCamelCaseGoal(updatedGoal),
          transaction: toCamelCaseTransaction(createdTx),
        });
      }

      // ─── REPORTS ───────────────────────────────────────────────────────────
      if (path === "/reports/monthly" && method === "GET") {
        const year = parseInt(
          url.searchParams.get("year") || String(new Date().getFullYear()),
          10,
        );
        const month = parseInt(
          url.searchParams.get("month") || String(new Date().getMonth() + 1),
          10,
        );
        const monthPattern = `${year}-${String(month).padStart(2, "0")}%`;

        // Transacciones del mes (excluyendo metas y aportes a ahorros)
        const txRows = await env.DB.prepare(
          `SELECT t.*, c.name as cat_name, c.color as cat_color, c.icon as cat_icon
           FROM transactions t
           LEFT JOIN categories c ON t.category_id = c.id
           WHERE t.date LIKE ? AND t.goal_id IS NULL AND (t.category_id != 'cat-savings' OR t.category_id IS NULL)`,
        )
          .bind(monthPattern)
          .all();

        const txs = (txRows.results || []) as any[];
        let totalIncome = 0;
        let totalExpenses = 0;
        const expMap = new Map<string, any>();
        const incMap = new Map<string, any>();

        for (const tx of txs) {
          if (tx.goal_id || tx.category_id === "cat-savings") continue;

          if (tx.type === "income") {
            totalIncome += tx.amount;
            const catId = tx.category_id || "cat-income-other";
            const current = incMap.get(catId) || {
              categoryId: catId,
              categoryName: tx.cat_name || "Otros ingresos",
              categoryIcon: tx.cat_icon || "cash",
              categoryColor: tx.cat_color || "#17b26a",
              total: 0,
              transactionCount: 0,
            };
            current.total += tx.amount;
            current.transactionCount += 1;
            incMap.set(catId, current);
          } else if (tx.type === "expense") {
            totalExpenses += tx.amount;
            const catId = tx.category_id || "cat-expense-other";
            const current = expMap.get(catId) || {
              categoryId: catId,
              categoryName: tx.cat_name || "Otros gastos",
              categoryIcon: tx.cat_icon || "tag",
              categoryColor: tx.cat_color || "#68615e",
              total: 0,
              transactionCount: 0,
            };
            current.total += tx.amount;
            current.transactionCount += 1;
            expMap.set(catId, current);
          }
        }

        const byExpenseCategory = Array.from(expMap.values()).map((c) => ({
          ...c,
          percentage: totalExpenses > 0 ? (c.total / totalExpenses) * 100 : 0,
        }));
        byExpenseCategory.sort((a, b) => b.total - a.total);

        const byIncomeCategory = Array.from(incMap.values()).map((c) => ({
          ...c,
          percentage: totalIncome > 0 ? (c.total / totalIncome) * 100 : 0,
        }));
        byIncomeCategory.sort((a, b) => b.total - a.total);

        return success({
          month,
          year,
          totalIncome,
          totalExpenses,
          netBalance: totalIncome - totalExpenses,
          byCategory: byExpenseCategory,
          byExpenseCategory,
          byIncomeCategory,
        });
      }

      if (path === "/reports/annual" && method === "GET") {
        const year = parseInt(
          url.searchParams.get("year") || String(new Date().getFullYear()),
          10,
        );
        const yearPattern = `${year}%`;

        // Transacciones del año (excluyendo metas y aportes a ahorros)
        const txRows = await env.DB.prepare(
          `SELECT t.*, c.name as cat_name, c.color as cat_color, c.icon as cat_icon
           FROM transactions t
           LEFT JOIN categories c ON t.category_id = c.id
           WHERE t.date LIKE ? AND t.goal_id IS NULL AND (t.category_id != 'cat-savings' OR t.category_id IS NULL)`,
        )
          .bind(yearPattern)
          .all();

        const txs = (txRows.results || []) as any[];
        let totalIncome = 0;
        let totalExpenses = 0;
        const expMap = new Map<string, any>();
        const incMap = new Map<string, any>();

        for (const tx of txs) {
          if (tx.goal_id || tx.category_id === "cat-savings") continue;

          if (tx.type === "income") {
            totalIncome += tx.amount;
            const catId = tx.category_id || "cat-income-other";
            const current = incMap.get(catId) || {
              categoryId: catId,
              categoryName: tx.cat_name || "Otros ingresos",
              categoryIcon: tx.cat_icon || "cash",
              categoryColor: tx.cat_color || "#17b26a",
              total: 0,
              transactionCount: 0,
            };
            current.total += tx.amount;
            current.transactionCount += 1;
            incMap.set(catId, current);
          } else if (tx.type === "expense") {
            totalExpenses += tx.amount;
            const catId = tx.category_id || "cat-expense-other";
            const current = expMap.get(catId) || {
              categoryId: catId,
              categoryName: tx.cat_name || "Otros gastos",
              categoryIcon: tx.cat_icon || "tag",
              categoryColor: tx.cat_color || "#68615e",
              total: 0,
              transactionCount: 0,
            };
            current.total += tx.amount;
            current.transactionCount += 1;
            expMap.set(catId, current);
          }
        }

        const byExpenseCategory = Array.from(expMap.values()).map((c) => ({
          ...c,
          percentage: totalExpenses > 0 ? (c.total / totalExpenses) * 100 : 0,
        }));
        byExpenseCategory.sort((a, b) => b.total - a.total);

        const byIncomeCategory = Array.from(incMap.values()).map((c) => ({
          ...c,
          percentage: totalIncome > 0 ? (c.total / totalIncome) * 100 : 0,
        }));
        byIncomeCategory.sort((a, b) => b.total - a.total);

        const netBalance = totalIncome - totalExpenses;

        // Desglose de 12 meses
        const MONTH_NAMES = [
          "Ene",
          "Feb",
          "Mar",
          "Abr",
          "May",
          "Jun",
          "Jul",
          "Ago",
          "Sep",
          "Oct",
          "Nov",
          "Dic",
        ];
        const monthlyBreakdown = MONTH_NAMES.map((name, idx) => {
          const m = idx + 1;
          const mPrefix = `${year}-${String(m).padStart(2, "0")}`;
          let inc = 0;
          let exp = 0;
          for (const tx of txs) {
            if (tx.goal_id || tx.category_id === "cat-savings") continue;
            if (tx.date && tx.date.startsWith(mPrefix)) {
              if (tx.type === "income") inc += tx.amount;
              else if (tx.type === "expense") exp += tx.amount;
            }
          }
          return {
            month: m,
            monthName: name,
            income: inc,
            expense: exp,
            net: inc - exp,
          };
        });

        return success({
          year,
          totalIncome,
          totalExpenses,
          netBalance,
          byExpenseCategory,
          byIncomeCategory,
          monthlyBreakdown,
        });
      }

      return error("Ruta no encontrada", 404);
    } catch (err: any) {
      return error(err.message || "Error interno del servidor", 500);
    }
  },
};
