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

// ─── Cuentas y Metas Compartidas ─────────────────────────────────────────────

export type SharedResourceType = "account" | "goal";

export interface SharedMember {
  userId: string;
  displayName: string;
  role: "owner" | "editor";
  joinedAt?: string;
}

export interface ShareInviteResponse {
  code: string;
  resourceType: SharedResourceType;
  resourceId: string;
  expiresAt: string;
}

export interface ShareJoinResponse {
  resourceType: SharedResourceType;
  resourceId: string;
  resourceName: string;
}

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
  isShared?: boolean; // Si la cuenta está compartida con otros usuarios
  isOwner?: boolean; // Si el usuario actual es el propietario
  members?: SharedMember[]; // Miembros con acceso a la cuenta
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
  userId?: string;
  authorName?: string; // Nombre del miembro que registró el movimiento en cuenta/meta compartida
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
  isShared?: boolean; // Si la meta está compartida con otros usuarios
  isOwner?: boolean; // Si el usuario actual es el propietario
  members?: SharedMember[]; // Miembros con acceso a la meta
  createdAt: string;
  updatedAt: string;
}

export interface GoalContributionPayload {
  accountId?: string;
  isDirectIncome?: boolean;
  categoryId?: string;
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

export interface SystemStats {
  activeUsers: number;
  totalAccounts: number;
  totalTransactions: number;
  totalGoals: number;
  dbSizeBytes: number;
  dbQuotaBytes: number;
}

// ─── Gastos Automáticos / Recurrentes ────────────────────────────────────────

export type RecurringFrequency = "monthly" | "yearly" | "weekly";
export type RecurringItemType = "expense" | "income";

export interface RecurringExpense {
  id: string;
  type: RecurringItemType; // 'expense' (gasto automático) | 'income' (ingreso automático)
  name: string; // Nombre (ej. "Netflix", "Alquiler", "Sueldo", "Honorarios")
  amount: number; // Monto fijado base
  currency: Currency;
  accountId: string; // Cuenta donde se descuenta o acredita
  accountName?: string;
  accountColor?: string;
  categoryId: string;
  dueDate: string; // Fecha de cobro / pago (YYYY-MM-DD)
  dueDay: number; // Día del mes (1-31)
  frequency: RecurringFrequency;
  isVariable: boolean; // false = monto fijo (descuenta/acredita solo), true = monto variable (pregunta a la hora del usuario)
  icon: string;
  color: string;
  isActive: boolean;
  lastPaidDate?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface RecurringApplyPayload {
  amount?: number; // Monto real del mes (si varió respecto al monto fijado)
  updateBaseAmount?: boolean; // Si true, actualiza también el monto fijado para futuros meses
  note?: string;
}

export interface UserSettings {
  userId: string;
  reminderTime: string; // Hora preferida del usuario "HH:mm" (ej: "09:00")
  updatedAt: string;
}

export interface RecurringProcessResult {
  appliedFixed: RecurringExpense[];
  dueVariable: RecurringExpense[];
  settings: UserSettings;
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
