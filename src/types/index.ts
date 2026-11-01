// ─── Tipos base ─────────────────────────────────────────────────────────────

export type Currency = "ARS" | "USD" | "EUR";

export type AccountType =
  | "checking"
  | "savings"
  | "investment"
  | "cash"
  | "credit";

export type TransactionType = "income" | "expense" | "transfer";

export type GoalStatus = "active" | "completed" | "paused";

// ─── Account ─────────────────────────────────────────────────────────────────

export interface Account {
  id: string;
  name: string;
  type: AccountType;
  currency: Currency;
  balance: number;
  color: string; // hex color para el avatar
  icon: string; // nombre del ícono de @expo/vector-icons
  creditLimit?: number; // Límite de crédito asignado (para tarjetas)
  closingDay?: number; // Día del mes en que cierra el resumen (1-31)
  dueDay?: number; // Día del mes en que vence el pago (1-31)
  createdAt: string; // ISO 8601
  updatedAt: string;
}

// ─── Category ────────────────────────────────────────────────────────────────

export interface Category {
  id: string;
  name: string;
  icon: string;
  color: string;
  type: TransactionType;
  isDefault: boolean;
}

// ─── Transaction ─────────────────────────────────────────────────────────────

export interface Transaction {
  id: string;
  accountId: string;
  categoryId: string;
  type: TransactionType;
  amount: number;
  currency: Currency;
  description: string;
  note?: string;
  date: string; // ISO 8601
  createdAt: string;
  updatedAt: string;
  // Para transferencias
  toAccountId?: string;
  // Vinculación con meta de ahorro
  goalId?: string;
}

// ─── Savings Goal ────────────────────────────────────────────────────────────

export interface SavingsGoal {
  id: string;
  name: string;
  targetAmount: number;
  currentAmount: number;
  currency: Currency;
  deadline?: string; // ISO 8601
  icon: string;
  color: string;
  status: GoalStatus;
  createdAt: string;
  updatedAt: string;
}

export interface GoalContributionPayload {
  accountId: string;
  amount: number;
  note?: string;
  date?: string;
}

export interface GoalWithdrawPayload {
  accountId: string;
  amount: number;
  note?: string;
  date?: string;
}

// ─── Reportes ────────────────────────────────────────────────────────────────

export interface MonthlyReport {
  month: number; // 1-12
  year: number;
  totalIncome: number;
  totalExpenses: number;
  netBalance: number;
  byCategory: CategorySummary[]; // Para retrocompatibilidad (gastos)
  byExpenseCategory: CategorySummary[]; // Rubros de gastos
  byIncomeCategory: CategorySummary[]; // Rubros de ingresos
}

export interface AnnualReport {
  year: number;
  totalIncome: number;
  totalExpenses: number;
  netBalance: number;
  savingsRate?: number;
  byExpenseCategory: CategorySummary[]; // Rubros de gastos anuales
  byIncomeCategory: CategorySummary[]; // Rubros de ingresos anuales
  monthlyBreakdown: MonthlyBreakdownItem[]; // Evolución mes a mes
}

export interface MonthlyBreakdownItem {
  month: number; // 1-12
  monthName: string; // Ene, Feb, ...
  income: number;
  expense: number;
  net: number;
}

export interface CategorySummary {
  categoryId: string;
  categoryName: string;
  categoryIcon: string;
  categoryColor: string;
  total: number;
  transactionCount: number;
  percentage: number;
}

// ─── API Response ─────────────────────────────────────────────────────────────

export interface ApiResponse<T> {
  data: T;
  success: boolean;
  error?: string;
}

export interface PaginatedResponse<T> {
  data: T[];
  total: number;
  page: number;
  pageSize: number;
  hasNextPage: boolean;
}
