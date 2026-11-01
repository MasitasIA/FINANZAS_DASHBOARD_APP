/**
 * Cloudflare D1 API client
 * Todas las peticiones van a tu Cloudflare Worker que expone la base D1.
 *
 * Configuración: en .env (o app.config.ts con process.env):
 *   EXPO_PUBLIC_API_URL=https://tu-worker.tu-usuario.workers.dev
 *   EXPO_PUBLIC_API_TOKEN=<bearer-token>  (solo si usas autenticación)
 */

const BASE_URL = (process.env.EXPO_PUBLIC_API_URL ?? "").trim();
const TOKEN = (process.env.EXPO_PUBLIC_API_TOKEN ?? "").trim();

interface RequestOptions extends Omit<RequestInit, "body"> {
  body?: unknown;
}

async function request<T>(
  path: string,
  options: RequestOptions = {},
): Promise<T> {
  const { body, headers = {}, ...rest } = options;

  const response = await fetch(`${BASE_URL}${path}`, {
    ...rest,
    headers: {
      "Content-Type": "application/json",
      ...(TOKEN ? { Authorization: `Bearer ${TOKEN}` } : {}),
      ...(headers as Record<string, string>),
    },
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });

  if (!response.ok) {
    const text = await response.text().catch(() => response.statusText);
    if (__DEV__ && response.status === 401) {
      console.warn(
        `[API 401] Petición no autorizada a ${path}. Token enviado: ${TOKEN ? "PRESENTE" : "VACÍO/NO CONFIGURADO"}. ` +
          `Si actualizaste .env recientemente, reinicia el servidor de Expo con 'npx expo start --clear'.`,
      );
    }
    throw new Error(`[API ${response.status}] ${text}`);
  }

  return response.json() as Promise<T>;
}

// ─── Helpers de conveniencia ──────────────────────────────────────────────────

export const api = {
  get: <T>(path: string, opts?: RequestOptions) =>
    request<T>(path, { method: "GET", ...opts }),

  post: <T>(path: string, body: unknown, opts?: RequestOptions) =>
    request<T>(path, { method: "POST", body, ...opts }),

  put: <T>(path: string, body: unknown, opts?: RequestOptions) =>
    request<T>(path, { method: "PUT", body, ...opts }),

  patch: <T>(path: string, body: unknown, opts?: RequestOptions) =>
    request<T>(path, { method: "PATCH", body, ...opts }),

  delete: <T>(path: string, opts?: RequestOptions) =>
    request<T>(path, { method: "DELETE", ...opts }),
};
