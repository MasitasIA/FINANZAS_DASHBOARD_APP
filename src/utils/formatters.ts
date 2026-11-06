import type { Currency } from "@/types";

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
 * Formatea una fecha ISO a texto legible en español.
 */
export function formatDate(
  isoString: string,
  options: Intl.DateTimeFormatOptions = { day: "numeric", month: "short", year: "numeric" }
): string {
  return new Date(isoString).toLocaleDateString("es-AR", options);
}

/**
 * Retorna "Hoy", "Ayer" o la fecha formateada.
 */
export function formatRelativeDate(isoString: string): string {
  const date = new Date(isoString);
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

