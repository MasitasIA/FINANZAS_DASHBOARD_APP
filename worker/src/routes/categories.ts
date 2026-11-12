import { json, error } from "../lib/response";
import { toCamelCaseCategory } from "../lib/formatters";
import type { Env, AuthenticatedUser } from "../types";

export async function handleCategories(
  request: Request,
  env: Env,
  url: URL,
  _user: AuthenticatedUser,
): Promise<Response> {
  const path = url.pathname;
  const method = request.method;

  if (path === "/categories" && method === "GET") {
    const typeParam = url.searchParams.get("type");
    const validCatTypes = ["income", "expense", "transfer"];
    const type =
      typeParam && validCatTypes.includes(typeParam) ? typeParam : null;
    const query = type
      ? "SELECT * FROM categories WHERE type = ? ORDER BY is_default DESC, rowid ASC"
      : "SELECT * FROM categories ORDER BY is_default DESC, rowid ASC";
    const stmt = env.DB.prepare(query);
    const rows = type ? await stmt.bind(type).all() : await stmt.all();
    const data = (rows.results || []).map(toCamelCaseCategory);
    return json({
      data,
      total: data.length,
      page: 1,
      pageSize: data.length,
      hasNextPage: false,
    });
  }

  return error("Método no permitido", 405);
}

