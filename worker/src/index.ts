/**
 * Cloudflare Worker — REST API Multi-Usuario para Finanzas Dashboard
 * Autenticación vía Firebase ID Token (RS256) + Cloudflare D1
 * Con protección XSS, Rate Limiting y Row-Level Security (RLS)
 */

import type { Env } from "./types";
import { SECURITY_HEADERS, error } from "./lib/response";
import {
  checkRateLimit,
  IP_LIMIT_PER_MIN,
  USER_READ_LIMIT_PER_MIN,
  USER_WRITE_LIMIT_PER_MIN,
} from "./lib/rate-limit";
import { verifyFirebaseIdToken } from "./lib/auth";
import { claimLegacyDataIfAny } from "./lib/rls";

import { handleAccounts } from "./routes/accounts";
import { handleCategories } from "./routes/categories";
import { handleTransactions } from "./routes/transactions";
import { handleGoals } from "./routes/goals";
import { handleShare } from "./routes/share";
import { handleReports } from "./routes/reports";
import { handleUserSettings } from "./routes/user-settings";
import { handleRecurring } from "./routes/recurring";
import { handleSystemStats } from "./routes/system-stats";
import { handleInstallments } from "./routes/installments";
import { handleStatements } from "./routes/statements";
import { handleBudgets } from "./routes/budgets";

export type { Env };

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    if (request.method === "OPTIONS") {
      return new Response(null, { headers: SECURITY_HEADERS });
    }

    const url = new URL(request.url);
    const path = url.pathname;
    const method = request.method;

    // ─── 1. Rate Limiting por IP (Pre-Autenticación / Anti-DDoS) ─────────────
    const clientIp =
      request.headers.get("CF-Connecting-IP") ||
      request.headers.get("X-Forwarded-For")?.split(",")[0]?.trim() ||
      "unknown-ip";

    const ipRate = checkRateLimit(`ip:${clientIp}`, IP_LIMIT_PER_MIN);
    if (!ipRate.allowed) {
      return error(
        "Demasiadas peticiones desde tu dirección IP. Intenta nuevamente en unos segundos.",
        429,
        {
          "Retry-After": String(ipRate.retryAfterSec),
          "X-RateLimit-Remaining": "0",
        },
      );
    }

    // ─── 2. Autenticación: Exclusivamente Firebase ID Token (RS256) ──────────
    const authHeader = request.headers.get("Authorization") || "";
    const bearerToken = authHeader.startsWith("Bearer ")
      ? authHeader.slice(7).trim()
      : "";

    if (!bearerToken) {
      return error("No autorizado: falta token de sesión", 401);
    }

    const projectId = (env.FIREBASE_PROJECT_ID || "unpo-finanzas").trim();
    const authUser = await verifyFirebaseIdToken(bearerToken, projectId);

    if (!authUser) {
      return error("Sesión inválida o expirada", 401);
    }
    const { userId } = authUser;

    // ─── 3. Rate Limiting por Usuario (Lectura vs Escritura) ─────────────────
    const isWriteMethod =
      method === "POST" ||
      method === "PATCH" ||
      method === "PUT" ||
      method === "DELETE";

    const userRate = checkRateLimit(
      `user:${userId}:${isWriteMethod ? "write" : "read"}`,
      isWriteMethod ? USER_WRITE_LIMIT_PER_MIN : USER_READ_LIMIT_PER_MIN,
    );
    if (!userRate.allowed) {
      return error(
        "Has superado el límite de operaciones por minuto. Por favor espera unos segundos.",
        429,
        {
          "Retry-After": String(userRate.retryAfterSec),
          "X-RateLimit-Remaining": "0",
        },
      );
    }

    // Si es un usuario autenticado con Firebase, migrar datos 'legacy' la primera vez
    await claimLegacyDataIfAny(env.DB, userId);

    try {
      if (path === "/accounts" || path.startsWith("/accounts/")) {
        return await handleAccounts(request, env, url, authUser);
      }

      if (path === "/categories" || path.startsWith("/categories/")) {
        return await handleCategories(request, env, url, authUser);
      }

      if (path === "/transactions" || path.startsWith("/transactions/")) {
        return await handleTransactions(request, env, url, authUser);
      }

      if (path === "/goals" || path.startsWith("/goals/")) {
        return await handleGoals(request, env, url, authUser);
      }

      if (path.startsWith("/share/")) {
        return await handleShare(request, env, url, authUser);
      }

      if (path.startsWith("/reports/")) {
        return await handleReports(request, env, url, authUser);
      }

      if (path === "/user-settings") {
        return await handleUserSettings(request, env, url, authUser);
      }

      if (
        path === "/recurring-expenses" ||
        path.startsWith("/recurring-expenses/")
      ) {
        return await handleRecurring(request, env, url, authUser);
      }

      if (path === "/stats") {
        return await handleSystemStats(request, env, url, authUser);
      }

      if (path === "/installments" || path.startsWith("/installments/")) {
        return await handleInstallments(request, env, url, authUser);
      }

      if (path === "/statements" || path.startsWith("/statements/")) {
        return await handleStatements(request, env, url, authUser);
      }

      if (path === "/budgets" || path.startsWith("/budgets/")) {
        return await handleBudgets(request, env, url, authUser);
      }

      return error("Ruta no encontrada", 404);
    } catch {
      return error("Error interno al procesar la solicitud", 500);
    }
  },
};
