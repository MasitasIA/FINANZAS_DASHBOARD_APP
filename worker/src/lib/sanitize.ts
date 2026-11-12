import { error } from "./response";

/**
 * Elimina etiquetas HTML/SVG/Script, protocolos peligrosos (javascript:, data:, vbscript:)
 * y caracteres de control ASCII, limitando la longitud máxima.
 */
export function sanitizeText(input: unknown, maxLength = 120): string {
  if (typeof input !== "string") return "";
  return input
    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, "")
    .replace(/<\/?[a-z][^>]*>/gi, "")
    .replace(/(?:javascript|data|vbscript)\s*:/gi, "")
    .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, "")
    .trim()
    .slice(0, maxLength);
}

export function sanitizeIdentifier(input: unknown, maxLength = 64): string {
  if (typeof input !== "string") return "";
  return input.replace(/[^a-zA-Z0-9_-]/g, "").slice(0, maxLength);
}

export function sanitizeColor(input: unknown, fallback = "#e23d28"): string {
  if (typeof input !== "string") return fallback;
  const trimmed = input.trim();
  return /^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/.test(trimmed)
    ? trimmed.toLowerCase()
    : fallback;
}

export function sanitizeIcon(input: unknown, fallback = "wallet"): string {
  if (typeof input !== "string") return fallback;
  const trimmed = input.trim().toLowerCase();
  return /^[a-z0-9-]{1,40}$/.test(trimmed) ? trimmed : fallback;
}

export function sanitizeCurrency(input: unknown): "ARS" | "USD" | "EUR" {
  if (input === "USD" || input === "EUR" || input === "ARS") return input;
  return "ARS";
}

export function sanitizeDate(input: unknown): string {
  if (typeof input === "string" && /^\d{4}-\d{2}-\d{2}$/.test(input.trim())) {
    return input.trim();
  }
  return new Date().toISOString().slice(0, 10);
}

export function sanitizeAmount(
  input: unknown,
  allowZero = false,
  allowNegative = false,
): number | null {
  const num = typeof input === "number" ? input : Number(input);
  if (!Number.isFinite(num)) return null;
  if (Math.abs(num) > 1_000_000_000_000) return null; // Límite anti-desbordamiento (1 billón)
  if (!allowNegative && num < 0) return null;
  if (!allowZero && num === 0) return null;
  return Math.round(num * 100) / 100;
}

export function sanitizeTime(value: unknown, fallback = "09:00"): string {
  if (typeof value !== "string") return fallback;
  const trimmed = value.trim();
  if (/^([01]\d|2[0-3]):([0-5]\d)$/.test(trimmed)) return trimmed;
  return fallback;
}

/** Devuelve "light" | "dark" o null si el valor no es válido. */
export function sanitizeTheme(value: unknown): "light" | "dark" | null {
  if (value === "light" || value === "dark") return value;
  return null;
}

export async function parseSafeJsonBody(
  request: Request,
  maxBytes = 16_384,
): Promise<{ ok: true; data: any } | { ok: false; response: Response }> {
  const contentLength = Number(request.headers.get("Content-Length") || "0");
  if (contentLength > maxBytes) {
    return {
      ok: false,
      response: error(
        "El cuerpo de la petición excede el tamaño máximo permitido (16 KB)",
        413,
      ),
    };
  }
  try {
    const raw = await request.text();
    if (raw.length > maxBytes) {
      return {
        ok: false,
        response: error(
          "El cuerpo de la petición excede el tamaño máximo permitido (16 KB)",
          413,
        ),
      };
    }
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
      return {
        ok: false,
        response: error("Formato JSON inválido: se esperaba un objeto", 400),
      };
    }
    return { ok: true, data: parsed };
  } catch {
    return {
      ok: false,
      response: error("JSON malformado en el cuerpo de la petición", 400),
    };
  }
}

