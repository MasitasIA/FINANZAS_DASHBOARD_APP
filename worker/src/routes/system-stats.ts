import { error, success } from "../lib/response";
import type { Env, AuthenticatedUser } from "../types";

export async function handleSystemStats(
  request: Request,
  env: Env,
  url: URL,
  _user: AuthenticatedUser,
): Promise<Response> {
  const path = url.pathname;
  const method = request.method;

  if (path === "/stats" && method === "GET") {
    const statsRows = await env.DB.prepare(
      `SELECT
        (SELECT COUNT(DISTINCT user_id) FROM (
          SELECT user_id FROM accounts
          UNION
          SELECT user_id FROM transactions
          UNION
          SELECT user_id FROM savings_goals
        )) AS active_users,
        (SELECT COUNT(*) FROM accounts) AS total_accounts,
        (SELECT COUNT(*) FROM transactions) AS total_transactions,
        (SELECT COUNT(*) FROM savings_goals) AS total_goals`,
    ).all();

    const row: any = statsRows.results?.[0] || {};
    const activeUsers = Math.max(1, Number(row.active_users || 1));
    const totalAccounts = Number(row.total_accounts || 0);
    const totalTransactions = Number(row.total_transactions || 0);
    const totalGoals = Number(row.total_goals || 0);
    const dbSizeBytes =
      Number(statsRows.meta?.size_after) ||
      (totalAccounts + totalTransactions + totalGoals) * 512 + 32768;

    return success({
      activeUsers,
      totalAccounts,
      totalTransactions,
      totalGoals,
      dbSizeBytes,
      dbQuotaBytes: 5 * 1024 * 1024 * 1024, // 5 GB límite gratuito Cloudflare D1
    });
  }

  return error("Ruta no encontrada", 404);
}

