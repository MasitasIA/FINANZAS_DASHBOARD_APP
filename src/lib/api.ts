/**
 * Cloudflare D1 API client
 * Todas las peticiones van a tu Cloudflare Worker que expone la base D1.
 * Envía automáticamente el Firebase ID Token del usuario autenticado.
 */

import { auth } from "./firebase";

const BASE_URL = (process.env.EXPO_PUBLIC_API_URL ?? "").trim();
const FALLBACK_TOKEN = (process.env.EXPO_PUBLIC_API_TOKEN ?? "").trim();

interface RequestOptions extends Omit<RequestInit, "body"> {
  body?: unknown;
}

async function getBearerToken(): Promise<string> {
  try {
    const currentUser = auth.currentUser;
    if (currentUser) {
      return await currentUser.getIdToken();
    }
  } catch {
    // Fallback al token estático si existiera
  }
  return FALLBACK_TOKEN;
}

async function request<T>(
  path: string,
  options: RequestOptions = {},
): Promise<T> {
  const { body, headers = {}, ...rest } = options;
  const token = await getBearerToken();

  const response = await fetch(`${BASE_URL}${path}`, {
    ...rest,
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(headers as Record<string, string>),
    },
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });

  if (!response.ok) {
    const text = await response.text().catch(() => response.statusText);
    if (__DEV__ && response.status === 401) {
      console.warn(
        `[API 401] Petición no autorizada a ${path}. Token enviado: ${token ? "PRESENTE" : "VACÍO"}.`,
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
