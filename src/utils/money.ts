import { formatCurrency } from "./formatters";
import type { Currency } from "@/types";

/**
 * Convierte un monto en coma flotante (ej: 1250.50) a centavos enteros (ej: 125050).
 * Utiliza Math.round para neutralizar imprecisiones de punto flotante de IEEE 754.
 */
export function toCents(amount?: number | null): number {
  if (amount === undefined || amount === null || isNaN(amount)) return 0;
  return Math.round(amount * 100);
}

/**
 * Convierte centavos enteros a monto en coma flotante estándar (ej: 125050 -> 1250.50).
 */
export function fromCents(cents?: number | null): number {
  if (cents === undefined || cents === null || isNaN(cents)) return 0;
  return Math.round(cents) / 100;
}

/**
 * Suma múltiples montos en centavos de forma exacta.
 */
export function addCents(...values: (number | undefined | null)[]): number {
  return values.reduce<number>((sum, val) => sum + (val ? Math.round(val) : 0), 0);
}

/**
 * Resta dos montos en centavos de forma exacta (a - b).
 */
export function subtractCents(a?: number | null, b?: number | null): number {
  return (a ? Math.round(a) : 0) - (b ? Math.round(b) : 0);
}

/**
 * Multiplica centavos por un factor escalar (ej: cálculo de impuestos o porcentajes),
 * redondeando el resultado al centavo más próximo.
 */
export function multiplyCents(cents: number, factor: number): number {
  if (!cents || !factor || isNaN(cents) || isNaN(factor)) return 0;
  return Math.round(cents * factor);
}

/**
 * Divide centavos por un divisor entero o escalar, redondeando al centavo más próximo.
 */
export function divideCents(cents: number, divisor: number): number {
  if (!cents || !divisor || isNaN(cents) || isNaN(divisor)) return 0;
  return Math.round(cents / divisor);
}

/**
 * Reparte un monto total en centavos entre N cuotas según el estándar bancario:
 * La base se calcula con Math.floor y cualquier centavo sobrante de redondeo
 * se asigna a las primeras cuotas, garantizando que la suma sea exactamente igual al total.
 *
 * Ej: $100.00 (10000 centavos) en 3 cuotas -> [3334, 3333, 3333] (Suma = 10000)
 */
export function splitInstallments(totalCents: number, count: number): number[] {
  if (count <= 0) return [];
  if (count === 1) return [Math.round(totalCents)];

  const total = Math.round(totalCents);
  const base = Math.floor(total / count);
  const remainder = total - base * count;

  const result: number[] = [];
  for (let i = 0; i < count; i++) {
    // Si hay resto, distribuimos 1 centavo extra a cada cuota inicial
    result.push(base + (i < remainder ? 1 : 0));
  }
  return result;
}

/**
 * Calcula el recargo financiero total y porcentaje entre precio de contado y total financiado.
 */
export function calculateInterest(
  cashPriceCents: number,
  totalCents: number,
): { interestCents: number; surchargePercent: number } {
  const cash = Math.round(cashPriceCents);
  const total = Math.round(totalCents);
  const interestCents = Math.max(0, total - cash);
  const surchargePercent =
    cash > 0 ? Number(((interestCents / cash) * 100).toFixed(2)) : 0;

  return {
    interestCents,
    surchargePercent,
  };
}

/**
 * Formatea un valor en centavos al formato monetario correspondiente.
 */
export function formatCents(cents?: number | null, currency: Currency = "ARS"): string {
  return formatCurrency(fromCents(cents), currency);
}

