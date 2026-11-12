interface RateBucket {
  count: number;
  resetAt: number;
}

const rateLimitStore = new Map<string, RateBucket>();
export const RATE_WINDOW_MS = 60_000; // 1 minuto
export const IP_LIMIT_PER_MIN = 90; // Máx 90 peticiones/min por IP (pre-autenticación)
export const USER_READ_LIMIT_PER_MIN = 120; // Máx 120 lecturas/min por usuario
export const USER_WRITE_LIMIT_PER_MIN = 30; // Máx 30 escrituras/min por usuario

export function checkRateLimit(
  key: string,
  maxRequests: number,
): { allowed: boolean; remaining: number; retryAfterSec: number } {
  const now = Date.now();

  // Limpieza preventiva para evitar crecimiento de memoria
  if (rateLimitStore.size > 2000) {
    for (const [k, v] of rateLimitStore.entries()) {
      if (v.resetAt <= now) rateLimitStore.delete(k);
    }
  }

  const current = rateLimitStore.get(key);
  if (!current || current.resetAt <= now) {
    rateLimitStore.set(key, { count: 1, resetAt: now + RATE_WINDOW_MS });
    return {
      allowed: true,
      remaining: maxRequests - 1,
      retryAfterSec: 0,
    };
  }

  current.count += 1;
  if (current.count > maxRequests) {
    const retryAfterSec = Math.max(
      1,
      Math.ceil((current.resetAt - now) / 1000),
    );
    return { allowed: false, remaining: 0, retryAfterSec };
  }

  return {
    allowed: true,
    remaining: maxRequests - current.count,
    retryAfterSec: 0,
  };
}

