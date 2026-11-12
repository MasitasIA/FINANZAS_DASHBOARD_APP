import { error, success } from "../lib/response";
import { sanitizeTime, sanitizeTheme, parseSafeJsonBody } from "../lib/sanitize";
import type { Env, AuthenticatedUser } from "../types";

export async function handleUserSettings(
  request: Request,
  env: Env,
  url: URL,
  user: AuthenticatedUser,
): Promise<Response> {
  const path = url.pathname;
  const method = request.method;
  const { userId } = user;

  if (path === "/user-settings" && method === "GET") {
    const row = await env.DB.prepare(
      "SELECT * FROM user_settings WHERE user_id = ?",
    )
      .bind(userId)
      .first();

    return success({
      userId,
      reminderTime: row ? String(row.reminder_time || "09:00") : "09:00",
      theme: sanitizeTheme(row?.theme) ?? "light",
      updatedAt: row
        ? String(row.updated_at)
        : new Date().toISOString(),
    });
  }

  if (
    path === "/user-settings" &&
    (method === "PUT" || method === "PATCH" || method === "POST")
  ) {
    const parsed = await parseSafeJsonBody(request);
    if (!parsed.ok) return parsed.response;

    const hasReminder = parsed.data?.reminderTime !== undefined;
    const hasTheme = parsed.data?.theme !== undefined;
    if (!hasReminder && !hasTheme) {
      return error("Debes enviar reminderTime y/o theme", 400);
    }

    let reminderTime: string | null = null;
    if (hasReminder) {
      reminderTime = sanitizeTime(parsed.data?.reminderTime, "");
      if (!reminderTime) {
        return error(
          "Formato de hora inválido. Usa el formato 24h HH:mm (ej. 09:00 o 20:30)",
          400,
        );
      }
    }

    let theme: "light" | "dark" | null = null;
    if (hasTheme) {
      theme = sanitizeTheme(parsed.data?.theme);
      if (!theme) {
        return error('Tema inválido. Usa "light" o "dark"', 400);
      }
    }

    // Los campos no enviados (null) conservan su valor actual / por defecto
    await env.DB.prepare(
      `INSERT INTO user_settings (user_id, reminder_time, theme, updated_at)
       VALUES (?, COALESCE(?, '09:00'), COALESCE(?, 'light'), datetime('now'))
       ON CONFLICT(user_id) DO UPDATE SET
         reminder_time = COALESCE(?, user_settings.reminder_time),
         theme         = COALESCE(?, user_settings.theme),
         updated_at    = datetime('now')`,
    )
      .bind(userId, reminderTime, theme, reminderTime, theme)
      .run();

    const updated = await env.DB.prepare(
      "SELECT * FROM user_settings WHERE user_id = ?",
    )
      .bind(userId)
      .first();

    return success({
      userId,
      reminderTime: updated
        ? String(updated.reminder_time || "09:00")
        : (reminderTime ?? "09:00"),
      theme: sanitizeTheme(updated?.theme) ?? theme ?? "light",
      updatedAt: updated
        ? String(updated.updated_at)
        : new Date().toISOString(),
    });
  }

  return error("Método no permitido", 405);
}

