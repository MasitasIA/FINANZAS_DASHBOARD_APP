import { error, success } from "../lib/response";
import type { Env, AuthenticatedUser } from "../types";

export async function handleReports(
  request: Request,
  env: Env,
  url: URL,
  user: AuthenticatedUser,
): Promise<Response> {
  const path = url.pathname;
  const method = request.method;
  const { userId } = user;

  if (path === "/reports/monthly" && method === "GET") {
    const rawYear = parseInt(
      url.searchParams.get("year") || String(new Date().getFullYear()),
      10,
    );
    const rawMonth = parseInt(
      url.searchParams.get("month") || String(new Date().getMonth() + 1),
      10,
    );
    const year = Math.min(2100, Math.max(2000, rawYear || new Date().getFullYear()));
    const month = Math.min(12, Math.max(1, rawMonth || new Date().getMonth() + 1));
    const monthPattern = `${year}-${String(month).padStart(2, "0")}%`;

    // Incluye transacciones normales + ingresos directos a metas que NO sean transferencias ('cat-savings')
    const txRows = await env.DB.prepare(
      `SELECT t.*, c.name as cat_name, c.color as cat_color, c.icon as cat_icon
       FROM transactions t
       LEFT JOIN categories c ON t.category_id = c.id
       WHERE t.user_id = ?
         AND t.date LIKE ?
         AND (t.category_id != 'cat-savings' OR t.category_id IS NULL)
         AND (t.goal_id IS NULL OR (t.type = 'income' AND t.category_id != 'cat-savings'))`,
    )
      .bind(userId, monthPattern)
      .all();

    const txs = (txRows.results || []) as any[];
    let totalIncome = 0;
    let totalExpenses = 0;
    const expMap = new Map<string, any>();
    const incMap = new Map<string, any>();

    for (const tx of txs) {
      if (tx.category_id === "cat-savings") continue;
      if (tx.goal_id && tx.type !== "income") continue;

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
    const rawYear = parseInt(
      url.searchParams.get("year") || String(new Date().getFullYear()),
      10,
    );
    const year = Math.min(2100, Math.max(2000, rawYear || new Date().getFullYear()));
    const yearPattern = `${year}%`;

    // Incluye transacciones normales + ingresos directos a metas que NO sean transferencias ('cat-savings')
    const txRows = await env.DB.prepare(
      `SELECT t.*, c.name as cat_name, c.color as cat_color, c.icon as cat_icon
       FROM transactions t
       LEFT JOIN categories c ON t.category_id = c.id
       WHERE t.user_id = ?
         AND t.date LIKE ?
         AND (t.category_id != 'cat-savings' OR t.category_id IS NULL)
         AND (t.goal_id IS NULL OR (t.type = 'income' AND t.category_id != 'cat-savings'))`,
    )
      .bind(userId, yearPattern)
      .all();

    const txs = (txRows.results || []) as any[];
    let totalIncome = 0;
    let totalExpenses = 0;
    const expMap = new Map<string, any>();
    const incMap = new Map<string, any>();

    for (const tx of txs) {
      if (tx.category_id === "cat-savings") continue;
      if (tx.goal_id && tx.type !== "income") continue;

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
        if (tx.category_id === "cat-savings") continue;
        if (tx.goal_id && tx.type !== "income") continue;
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
}

