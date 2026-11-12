import type { Currency } from "@/types";

/**
 * Parsea una fecha ISO, SQLite ("YYYY-MM-DD HH:mm:ss") o cadena de fecha pura ("YYYY-MM-DD")
 * garantizando que no sufra desplazamientos de día por zonas horarias (ej. UTC-3 en Argentina).
 */
export function parseSafeDate(input: string | Date): Date {
  if (input instanceof Date) return input;
  if (!input || typeof input !== "string") return new Date();

  const trimmed = input.trim();

  // Caso 1: Cadena pura de fecha "YYYY-MM-DD"
  if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) {
    const [y, m, d] = trimmed.split("-").map((n) => parseInt(n, 10));
    // Construir al mediodía local (12:00) para evitar desbordes de día por DST o huso horario
    return new Date(y, m - 1, d, 12, 0, 0, 0);
  }

  // Caso 2: Formato SQLite "YYYY-MM-DD HH:mm:ss" (guardado en UTC)
  if (/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/.test(trimmed)) {
    return new Date(`${trimmed.replace(" ", "T")}Z`);
  }

  // Caso 3: ISO estándar u otros formatos
  const parsed = new Date(trimmed);
  return isNaN(parsed.getTime()) ? new Date() : parsed;
}

/**
 * Formatea un número como moneda según el código ISO.
 */
export function formatCurrency(
  amount: number,
  currency: Currency = "ARS"
): string {
  const hasDecimals = Math.abs(amount % 1) > 0.001;
  return new Intl.NumberFormat("es-AR", {
    style:                 "currency",
    currency,
    minimumFractionDigits: hasDecimals ? 2 : 0,
    maximumFractionDigits: 2,
  }).format(amount);
}

/**
 * Formatea una fecha ISO o string a texto legible en español.
 */
export function formatDate(
  isoString: string,
  options: Intl.DateTimeFormatOptions = { day: "numeric", month: "short", year: "numeric" }
): string {
  return parseSafeDate(isoString).toLocaleDateString("es-AR", options);
}

/**
 * Retorna "Hoy", "Ayer" o la fecha formateada.
 */
export function formatRelativeDate(isoString: string): string {
  const date = parseSafeDate(isoString);
  const now  = new Date();

  const isToday =
    date.getDate() === now.getDate() &&
    date.getMonth() === now.getMonth() &&
    date.getFullYear() === now.getFullYear();

  if (isToday) return "Hoy";

  const yesterday = new Date(now);
  yesterday.setDate(now.getDate() - 1);
  const isYesterday =
    date.getDate() === yesterday.getDate() &&
    date.getMonth() === yesterday.getMonth() &&
    date.getFullYear() === yesterday.getFullYear();

  if (isYesterday) return "Ayer";

  return formatDate(isoString);
}

