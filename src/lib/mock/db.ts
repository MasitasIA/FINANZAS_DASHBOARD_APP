/**
 * Base de datos en memoria para desarrollo sin backend.
 * Simula la estructura de Cloudflare D1.
 */

import type {
  Account,
  Budget,
  Category,
  CreditCardInstallment,
  CreditCardStatement,
  RecurringExpense,
  SavingsGoal,
  Transaction,
} from "@/types";
import { colors } from "../../../tailwind.config";

// ─── Cuentas ──────────────────────────────────────────────────────────────────

export const mockAccounts: Account[] = [
  {
    id:        "acc-1",
    name:      "Cuenta corriente",
    type:      "checking",
    currency:  "ARS",
    balance:   1_850_000,
    color:     colors.primary[500],
    icon:      "bank",
    createdAt: "2024-01-10T00:00:00Z",
    updatedAt: "2024-10-20T00:00:00Z",
  },
  {
    id:        "acc-2",
    name:      "Caja de ahorro USD",
    type:      "savings",
    currency:  "USD",
    balance:   3_200,
    color:     colors.success[500],
    icon:      "currency-usd",
    createdAt: "2024-03-01T00:00:00Z",
    updatedAt: "2024-10-15T00:00:00Z",
  },
  {
    id:        "acc-3",
    name:      "Billetera Mercado Pago",
    type:      "cash",
    currency:  "ARS",
    balance:   98_500,
    color:     colors.warning[500],
    icon:      "wallet",
    createdAt: "2024-05-15T00:00:00Z",
    updatedAt: "2024-10-22T00:00:00Z",
  },
  {
    id:          "acc-4",
    name:        "Visa Santander",
    type:        "credit",
    currency:    "ARS",
    balance:     -142_500,
    creditLimit: 600_000,
    closingDay:  22,
    dueDay:      5,
    color:       colors.accent.pink,
    icon:        "credit-card",
    createdAt:   "2024-06-01T00:00:00Z",
    updatedAt:   "2024-10-25T00:00:00Z",
  },
];

// ─── Categorías ───────────────────────────────────────────────────────────────

export const mockCategories: Category[] = [
  // Gastos
  { id: "cat-leisure",    name: "Ocio",             icon: "gamepad-variant",            color: colors.accent.violet,  type: "expense",  isDefault: true },
  { id: "cat-services",   name: "Servicios",        icon: "lightning-bolt",             color: colors.warning[400],   type: "expense",  isDefault: true },
  { id: "cat-studies",    name: "Estudios",         icon: "school",                     color: colors.accent.cyan,    type: "expense",  isDefault: true },
  { id: "cat-food",       name: "Comida",           icon: "food-fork-drink",            color: colors.danger[400],    type: "expense",  isDefault: true },
  { id: "cat-transport",  name: "Transporte",       icon: "car",                        color: colors.accent.indigo,  type: "expense",  isDefault: true },
  { id: "cat-health",     name: "Salud",            icon: "heart-pulse",                color: colors.success[400],   type: "expense",  isDefault: true },
  { id: "cat-housing",    name: "Vivienda",         icon: "home",                       color: colors.primary[400],   type: "expense",  isDefault: true },
  { id: "cat-other-exp",  name: "Otros",            icon: "dots-horizontal",            color: colors.text.secondary, type: "expense",  isDefault: false },

  // Ingresos
  { id: "cat-salary",       name: "Trabajo",        icon: "briefcase",                  color: colors.success[500],   type: "income",   isDefault: true },
  { id: "cat-grant",        name: "Beca",           icon: "school",                     color: colors.accent.cyan,    type: "income",   isDefault: true },
  { id: "cat-contribution", name: "Aporte",         icon: "hand-coin",                  color: colors.accent.purple,  type: "income",   isDefault: true },
  { id: "cat-pension",      name: "Pensión",        icon: "shield-account",             color: colors.accent.indigo,  type: "income",   isDefault: true },
  { id: "cat-freelance",    name: "Freelance",      icon: "laptop",                     color: colors.primary[500],   type: "income",   isDefault: true },
  { id: "cat-investment",   name: "Inversión",      icon: "chart-line",                 color: colors.success[400],   type: "income",   isDefault: true },
  { id: "cat-yield",        name: "Rendimientos",   icon: "trending-up",                color: "#34d399",             type: "income",   isDefault: true },
  { id: "cat-other-inc",    name: "Otros",          icon: "cash-plus",                  color: colors.text.secondary, type: "income",   isDefault: false },

  // Transferencias
  { id: "cat-transfer",       name: "Entre cuentas",   icon: "swap-horizontal",         color: colors.accent.slate,   type: "transfer", isDefault: true },
  { id: "cat-card-payment",   name: "Pago de tarjeta", icon: "credit-card-check",       color: colors.accent.pink,    type: "transfer", isDefault: true },
  { id: "cat-family-transfer",name: "Aporte familiar", icon: "account-group",           color: colors.accent.purple,  type: "transfer", isDefault: true },
  { id: "cat-savings",        name: "Ahorro",          icon: "piggy-bank",              color: colors.success[500],   type: "transfer", isDefault: true },
];

// ─── Transacciones ────────────────────────────────────────────────────────────

export const mockTransactions: Transaction[] = [
  {
    id: "tx-1", accountId: "acc-1", categoryId: "cat-salary",
    type: "income", amount: 900_000, currency: "ARS",
    description: "Sueldo octubre", date: "2024-10-01T10:00:00Z",
    createdAt: "2024-10-01T10:00:00Z", updatedAt: "2024-10-01T10:00:00Z",
  },
  {
    id: "tx-2", accountId: "acc-1", categoryId: "cat-freelance",
    type: "income", amount: 450_000, currency: "ARS",
    description: "Proyecto web cliente", date: "2024-10-05T14:00:00Z",
    createdAt: "2024-10-05T14:00:00Z", updatedAt: "2024-10-05T14:00:00Z",
  },
  {
    id: "tx-3", accountId: "acc-1", categoryId: "cat-food",
    type: "expense", amount: 85_000, currency: "ARS",
    description: "Supermercado Coto", date: "2024-10-08T18:30:00Z",
    createdAt: "2024-10-08T18:30:00Z", updatedAt: "2024-10-08T18:30:00Z",
  },
  {
    id: "tx-4", accountId: "acc-3", categoryId: "cat-food",
    type: "expense", amount: 12_500, currency: "ARS",
    description: "Almuerzo con equipo", date: "2024-10-10T13:00:00Z",
    createdAt: "2024-10-10T13:00:00Z", updatedAt: "2024-10-10T13:00:00Z",
  },
  {
    id: "tx-5", accountId: "acc-1", categoryId: "cat-housing",
    type: "expense", amount: 280_000, currency: "ARS",
    description: "Alquiler octubre", date: "2024-10-10T09:00:00Z",
    createdAt: "2024-10-10T09:00:00Z", updatedAt: "2024-10-10T09:00:00Z",
  },
  {
    id: "tx-6", accountId: "acc-1", categoryId: "cat-transport",
    type: "expense", amount: 35_000, currency: "ARS",
    description: "Nafta", date: "2024-10-14T17:00:00Z",
    createdAt: "2024-10-14T17:00:00Z", updatedAt: "2024-10-14T17:00:00Z",
  },
  {
    id: "tx-7", accountId: "acc-1", categoryId: "cat-health",
    type: "expense", amount: 22_000, currency: "ARS",
    description: "Farmacia", date: "2024-10-16T11:00:00Z",
    createdAt: "2024-10-16T11:00:00Z", updatedAt: "2024-10-16T11:00:00Z",
  },
  {
    id: "tx-8", accountId: "acc-3", categoryId: "cat-leisure",
    type: "expense", amount: 28_000, currency: "ARS",
    description: "Streaming + suscripciones", date: "2024-10-18T20:00:00Z",
    createdAt: "2024-10-18T20:00:00Z", updatedAt: "2024-10-18T20:00:00Z",
  },
  {
    id: "tx-9", accountId: "acc-1", categoryId: "cat-food",
    type: "expense", amount: 47_500, currency: "ARS",
    description: "Verdulería + carnicería", date: "2024-10-20T10:00:00Z",
    createdAt: "2024-10-20T10:00:00Z", updatedAt: "2024-10-20T10:00:00Z",
  },
  {
    id: "tx-10", accountId: "acc-1", categoryId: "cat-leisure",
    type: "expense", amount: 60_000, currency: "ARS",
    description: "Cena cumpleaños", date: "2024-10-22T21:00:00Z",
    createdAt: "2024-10-22T21:00:00Z", updatedAt: "2024-10-22T21:00:00Z",
  },
  {
    id: "tx-11", accountId: "acc-4", categoryId: "cat-leisure",
    type: "expense", amount: 95_000, currency: "ARS",
    description: "Compra electrodomésticos (3 cuotas)", date: "2024-10-23T16:00:00Z",
    createdAt: "2024-10-23T16:00:00Z", updatedAt: "2024-10-23T16:00:00Z",
  },
  {
    id: "tx-12", accountId: "acc-4", categoryId: "cat-food",
    type: "expense", amount: 47_500, currency: "ARS",
    description: "Supermercado Jumbo", date: "2024-10-24T19:30:00Z",
    createdAt: "2024-10-24T19:30:00Z", updatedAt: "2024-10-24T19:30:00Z",
  },
  {
    id: "tx-13", accountId: "acc-2", categoryId: "cat-savings",
    type: "expense", amount: 500, currency: "USD",
    description: "Aporte a meta: Viaje a Europa", note: "Ahorro del mes",
    goalId: "goal-1", date: "2024-10-18T12:00:00Z",
    createdAt: "2024-10-18T12:00:00Z", updatedAt: "2024-10-18T12:00:00Z",
  },
  {
    id: "tx-14", accountId: "acc-1", categoryId: "cat-savings",
    type: "expense", amount: 200_000, currency: "ARS",
    description: "Aporte a meta: Fondo de emergencia", note: "Depósito inicial de seguridad",
    goalId: "goal-2", date: "2024-10-15T09:00:00Z",
    createdAt: "2024-10-15T09:00:00Z", updatedAt: "2024-10-15T09:00:00Z",
  },
];

// ─── Metas de ahorro ──────────────────────────────────────────────────────────

export const mockGoals: SavingsGoal[] = [
  {
    id:            "goal-1",
    name:          "Viaje a Europa",
    targetAmount:  5_000,
    currentAmount: 2_800,
    currency:      "USD",
    deadline:      "2025-07-01T00:00:00Z",
    icon:          "airplane",
    color:         colors.primary[500],
    status:        "active",
    createdAt:     "2024-01-01T00:00:00Z",
    updatedAt:     "2024-10-01T00:00:00Z",
  },
  {
    id:            "goal-2",
    name:          "Fondo de emergencia",
    targetAmount:  2_700_000,
    currentAmount: 1_200_000,
    currency:      "ARS",
    deadline:      undefined,
    icon:          "shield-check",
    color:         colors.success[500],
    status:        "active",
    createdAt:     "2024-02-01T00:00:00Z",
    updatedAt:     "2024-10-15T00:00:00Z",
  },
  {
    id:            "goal-3",
    name:          "Notebook nueva",
    targetAmount:  1_500_000,
    currentAmount: 1_500_000,
    currency:      "ARS",
    deadline:      "2024-09-01T00:00:00Z",
    icon:          "laptop",
    color:         colors.warning[500],
    status:        "completed",
    createdAt:     "2024-04-01T00:00:00Z",
    updatedAt:     "2024-09-01T00:00:00Z",
  },
];

// ─── Gastos Automáticos / Recurrentes ─────────────────────────────────────────

export const mockRecurringExpenses: RecurringExpense[] = [
  {
    id:           "rec-1",
    type:         "expense",
    name:         "Alquiler departamento",
    amount:       280_000,
    currency:     "ARS",
    accountId:    "acc-1",
    accountName:  "Cuenta corriente",
    accountColor: colors.primary[500],
    categoryId:   "cat-housing",
    dueDate:      "2026-11-10",
    dueDay:       10,
    frequency:    "monthly",
    isVariable:   false,
    icon:         "home",
    color:        colors.primary[500],
    isActive:     true,
    lastPaidDate: "2026-10-10",
    createdAt:    "2024-01-01T00:00:00Z",
    updatedAt:    "2026-10-10T00:00:00Z",
  },
  {
    id:           "rec-2",
    type:         "expense",
    name:         "Internet Fibra 300MB",
    amount:       24_500,
    currency:     "ARS",
    accountId:    "acc-3",
    accountName:  "Billetera Mercado Pago",
    accountColor: colors.warning[500],
    categoryId:   "cat-services",
    dueDate:      "2026-11-15",
    dueDay:       15,
    frequency:    "monthly",
    isVariable:   true,
    icon:         "wifi",
    color:        colors.accent.cyan,
    isActive:     true,
    lastPaidDate: null,
    createdAt:    "2024-02-01T00:00:00Z",
    updatedAt:    "2024-02-01T00:00:00Z",
  },
  {
    id:           "rec-3",
    type:         "income",
    name:         "Sueldo mensual",
    amount:       900_000,
    currency:     "ARS",
    accountId:    "acc-1",
    accountName:  "Cuenta corriente",
    accountColor: colors.primary[500],
    categoryId:   "cat-salary",
    dueDate:      "2026-11-01",
    dueDay:       1,
    frequency:    "monthly",
    isVariable:   false,
    icon:         "briefcase",
    color:        colors.success[500],
    isActive:     true,
    lastPaidDate: "2026-10-01",
    createdAt:    "2024-01-01T00:00:00Z",
    updatedAt:    "2026-10-01T00:00:00Z",
  },
];

// ─── Tarjetas de Crédito: Cuotas & Resúmenes Mock ─────────────────────────────
export const mockInstallments: CreditCardInstallment[] = [
  {
    id: "inst-1",
    accountId: "acc-4",
    description: "Smart TV 55 Pulgadas 4K",
    totalAmount: 480_000,
    totalAmountCents: 48_000_000,
    cashPrice: 420_000,
    cashPriceCents: 42_000_000,
    installmentsCount: 6,
    installmentAmount: 80_000,
    installmentAmountCents: 8_000_000,
    paidInstallmentsCount: 2,
    remainingAmountCents: 32_000_000,
    firstDueDate: "2026-10-05",
    status: "active",
    createdAt: "2026-09-15T00:00:00Z",
  },
];

export const mockStatements: CreditCardStatement[] = [
  {
    id: "stmt-1",
    accountId: "acc-4",
    periodStart: "2026-09-23",
    closingDate: "2026-10-22",
    dueDate: "2026-11-05",
    previousBalance: 0,
    previousBalanceCents: 0,
    charges: 142_500,
    chargesCents: 14_250_000,
    installments: 80_000,
    installmentsCents: 8_000_000,
    interest: 0,
    interestCents: 0,
    totalDue: 142_500,
    totalDueCents: 14_250_000,
    minimumDue: 14_250,
    minimumDueCents: 1_425_000,
    paidAmount: 0,
    paidAmountCents: 0,
    status: "closed",
    createdAt: "2026-10-22T00:00:00Z",
    updatedAt: "2026-10-22T00:00:00Z",
  },
];

export const mockBudgets: Budget[] = [
  {
    id: "bdg-1",
    categoryId: "cat-food",
    categoryName: "Comida",
    categoryIcon: "food-fork-drink",
    categoryColor: "#f97066",
    currency: "ARS",
    amount: 150_000,
    amountCents: 15_000_000,
    spentAmount: 85_000,
    spentAmountCents: 8_500_000,
    percentage: 57,
    createdAt: "2026-10-01T00:00:00Z",
    updatedAt: "2026-10-01T00:00:00Z",
  },
  {
    id: "bdg-2",
    categoryId: "cat-services",
    categoryName: "Servicios",
    categoryIcon: "lightning-bolt",
    categoryColor: "#fdb022",
    currency: "ARS",
    amount: 60_000,
    amountCents: 6_000_000,
    spentAmount: 55_000,
    spentAmountCents: 5_500_000,
    percentage: 92,
    createdAt: "2026-10-01T00:00:00Z",
    updatedAt: "2026-10-01T00:00:00Z",
  },
];

// ─── Helpers para el mock DB ──────────────────────────────────────────────────

/** Genera un ID random simple */
export function generateId(): string {
  return Math.random().toString(36).slice(2) + Date.now().toString(36);
}

/** Simula latencia de red (50–200ms) */
export function delay(ms = 120): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
