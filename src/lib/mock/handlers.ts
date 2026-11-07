/**
 * Mock API handlers — interceptan las rutas REST y devuelven
 * datos desde la base de datos en memoria (mock/db.ts).
 *
 * Activo cuando EXPO_PUBLIC_USE_MOCK=true
 */

import type {
  Account,
  AnnualReport,
  ApiResponse,
  Category,
  GoalContributionPayload,
  GoalWithdrawPayload,
  MonthlyReport,
  PaginatedResponse,
  SavingsGoal,
  SystemStats,
  Transaction,
} from "@/types";
import { colors } from "../../../tailwind.config";
import {
  delay,
  generateId,
  mockAccounts,
  mockCategories,
  mockGoals,
  mockTransactions,
} from "./db";

// Clones mutables para simular escritura
let accounts: Account[] = [...mockAccounts];
let transactions: Transaction[] = [...mockTransactions];
let goals: SavingsGoal[] = [...mockGoals];

// ─── Util ─────────────────────────────────────────────────────────────────────

function ok<T>(data: T): ApiResponse<T> {
  return { data, success: true };
}

function paginate<T>(
  items: T[],
  page = 1,
  pageSize = 20,
): PaginatedResponse<T> {
  const start = (page - 1) * pageSize;
  const data = items.slice(start, start + pageSize);
  return {
    data,
    total: items.length,
    page,
    pageSize,
    hasNextPage: start + pageSize < items.length,
  };
}

// ─── Accounts ─────────────────────────────────────────────────────────────────

export const mockAccountHandlers = {
  async list(): Promise<PaginatedResponse<Account>> {
    await delay();
    return paginate(accounts);
  },

  async get(id: string): Promise<ApiResponse<Account>> {
    await delay(80);
    const found = accounts.find((a) => a.id === id);
    if (!found) throw new Error(`Cuenta ${id} no encontrada`);
    return ok(found);
  },

  async create(
    data: Omit<Account, "id" | "createdAt" | "updatedAt">,
  ): Promise<ApiResponse<Account>> {
    await delay();
    const now = new Date().toISOString();
    const account = {
      ...data,
      id: generateId(),
      createdAt: now,
      updatedAt: now,
    };
    accounts.push(account);
    return ok(account);
  },

  async update(
    id: string,
    data: Partial<Omit<Account, "id" | "createdAt" | "updatedAt">>,
  ): Promise<ApiResponse<Account>> {
    await delay();
    const idx = accounts.findIndex((a) => a.id === id);
    if (idx === -1) throw new Error(`Cuenta ${id} no encontrada`);
    accounts[idx] = {
      ...accounts[idx],
      ...data,
      updatedAt: new Date().toISOString(),
    };
    return ok(accounts[idx]);
  },

  async delete(id: string): Promise<ApiResponse<null>> {
    await delay();
    accounts = accounts.filter((a) => a.id !== id);
    return ok(null);
  },
};

// ─── Categories ───────────────────────────────────────────────────────────────

export const mockCategoryHandlers = {
  async list(type?: string): Promise<PaginatedResponse<Category>> {
    await delay(60);
    const filtered = type
      ? mockCategories.filter((c) => c.type === type)
      : [...mockCategories];
    return paginate(filtered, 1, Math.max(filtered.length, 20));
  },
};

// ─── Transactions ──────────────────────────────────────────────────────────────

interface TxFilters {
  accountId?: string;
  categoryId?: string;
  goalId?: string;
  type?: string;
  startDate?: string;
  endDate?: string;
  page?: number;
  pageSize?: number;
}

export const mockTransactionHandlers = {
  async list(filters: TxFilters = {}): Promise<PaginatedResponse<Transaction>> {
    await delay();
    let result = [...transactions];

    if (filters.accountId) {
      result = result.filter(
        (t) =>
          t.accountId === filters.accountId ||
          t.toAccountId === filters.accountId,
      );
    }
    if (filters.categoryId)
      result = result.filter((t) => t.categoryId === filters.categoryId);
    if (filters.goalId)
      result = result.filter((t) => t.goalId === filters.goalId);
    if (filters.type) result = result.filter((t) => t.type === filters.type);
    if (filters.startDate)
      result = result.filter((t) => t.date >= filters.startDate!);
    if (filters.endDate)
      result = result.filter((t) => t.date <= filters.endDate!);

    // Más recientes primero
    result.sort((a, b) => b.date.localeCompare(a.date));

    return paginate(result, filters.page, filters.pageSize);
  },

  async get(id: string): Promise<ApiResponse<Transaction>> {
    await delay(80);
    const found = transactions.find((t) => t.id === id);
    if (!found) throw new Error(`Transacción ${id} no encontrada`);
    return ok(found);
  },

  async create(
    data: Omit<Transaction, "id" | "createdAt" | "updatedAt">,
  ): Promise<ApiResponse<Transaction>> {
    await delay();
    const now = new Date().toISOString();
    const tx = { ...data, id: generateId(), createdAt: now, updatedAt: now };
    transactions.push(tx);

    // Actualiza balance de la cuenta origen
    const accIdx = accounts.findIndex((a) => a.id === data.accountId);
    if (accIdx !== -1) {
      const delta =
        data.type === "income"
          ? data.amount
          : data.type === "expense"
            ? -data.amount
            : data.type === "transfer"
              ? -data.amount
              : 0;
      accounts[accIdx].balance += delta;
      accounts[accIdx].updatedAt = now;
    }

    // Actualiza balance de la cuenta destino si es transferencia
    if (data.type === "transfer" && data.toAccountId) {
      const toAccIdx = accounts.findIndex((a) => a.id === data.toAccountId);
      if (toAccIdx !== -1) {
        accounts[toAccIdx].balance += data.amount;
        accounts[toAccIdx].updatedAt = now;
      }
    }

    return ok(tx);
  },

  async update(
    id: string,
    data: Partial<Omit<Transaction, "id" | "createdAt" | "updatedAt">>,
  ): Promise<ApiResponse<Transaction>> {
    await delay();
    const idx = transactions.findIndex((t) => t.id === id);
    if (idx === -1) throw new Error(`Transacción ${id} no encontrada`);

    const oldTx = transactions[idx];

    // Revertir efecto previo en cuenta origen
    const oldAccIdx = accounts.findIndex((a) => a.id === oldTx.accountId);
    if (oldAccIdx !== -1) {
      const oldDelta =
        oldTx.type === "income"
          ? -oldTx.amount
          : oldTx.type === "expense"
            ? oldTx.amount
            : oldTx.type === "transfer"
              ? oldTx.amount
              : 0;
      accounts[oldAccIdx].balance += oldDelta;
    }

    // Revertir efecto previo en cuenta destino si era transferencia
    if (oldTx.type === "transfer" && oldTx.toAccountId) {
      const oldToAccIdx = accounts.findIndex((a) => a.id === oldTx.toAccountId);
      if (oldToAccIdx !== -1) {
        accounts[oldToAccIdx].balance -= oldTx.amount;
      }
    }

    // Revertir efecto previo en meta de ahorro si existía
    if (oldTx.goalId) {
      const goal = goals.find((g) => g.id === oldTx.goalId);
      if (goal) {
        if (oldTx.type === "expense" || oldTx.type === "transfer") {
          goal.currentAmount = Math.max(0, goal.currentAmount - oldTx.amount);
        } else if (oldTx.type === "income") {
          goal.currentAmount = Math.max(0, goal.currentAmount + oldTx.amount);
        }
      }
    }

    // Crear versión actualizada
    const now = new Date().toISOString();
    const updatedTx: Transaction = {
      ...oldTx,
      ...data,
      updatedAt: now,
    };
    transactions[idx] = updatedTx;

    // Aplicar nuevo efecto en cuenta origen
    const newAccIdx = accounts.findIndex((a) => a.id === updatedTx.accountId);
    if (newAccIdx !== -1) {
      const newDelta =
        updatedTx.type === "income"
          ? updatedTx.amount
          : updatedTx.type === "expense"
            ? -updatedTx.amount
            : updatedTx.type === "transfer"
              ? -updatedTx.amount
              : 0;
      accounts[newAccIdx].balance += newDelta;
      accounts[newAccIdx].updatedAt = now;
    }

    // Aplicar nuevo efecto en cuenta destino
    if (updatedTx.type === "transfer" && updatedTx.toAccountId) {
      const newToAccIdx = accounts.findIndex(
        (a) => a.id === updatedTx.toAccountId,
      );
      if (newToAccIdx !== -1) {
        accounts[newToAccIdx].balance += updatedTx.amount;
        accounts[newToAccIdx].updatedAt = now;
      }
    }

    // Aplicar nuevo efecto en meta de ahorro
    if (updatedTx.goalId) {
      const goal = goals.find((g) => g.id === updatedTx.goalId);
      if (goal) {
        if (updatedTx.type === "expense" || updatedTx.type === "transfer") {
          goal.currentAmount = Math.max(
            0,
            goal.currentAmount + updatedTx.amount,
          );
        } else if (updatedTx.type === "income") {
          goal.currentAmount = Math.max(
            0,
            goal.currentAmount - updatedTx.amount,
          );
        }
        if (goal.currentAmount >= goal.targetAmount) {
          goal.status = "completed";
        } else if (goal.status === "completed") {
          goal.status = "active";
        }
        goal.updatedAt = now;
      }
    }

    return ok(updatedTx);
  },

  async delete(id: string): Promise<ApiResponse<null>> {
    await delay();
    const tx = transactions.find((t) => t.id === id);
    if (tx) {
      // Revierte el efecto en el balance origen
      const accIdx = accounts.findIndex((a) => a.id === tx.accountId);
      if (accIdx !== -1) {
        const delta =
          tx.type === "income"
            ? -tx.amount
            : tx.type === "expense"
              ? tx.amount
              : tx.type === "transfer"
                ? tx.amount
                : 0;
        accounts[accIdx].balance += delta;
      }

      // Revierte el efecto en la cuenta destino si era transferencia
      if (tx.type === "transfer" && tx.toAccountId) {
        const toAccIdx = accounts.findIndex((a) => a.id === tx.toAccountId);
        if (toAccIdx !== -1) {
          accounts[toAccIdx].balance -= tx.amount;
        }
      }

      // Revierte el efecto en la meta de ahorro
      if (tx.goalId) {
        const goal = goals.find((g) => g.id === tx.goalId);
        if (goal) {
          if (tx.type === "expense" || tx.type === "transfer") {
            goal.currentAmount = Math.max(0, goal.currentAmount - tx.amount);
          } else if (tx.type === "income") {
            goal.currentAmount = Math.max(0, goal.currentAmount + tx.amount);
          }
          if (goal.currentAmount >= goal.targetAmount) {
            goal.status = "completed";
          } else if (goal.status === "completed") {
            goal.status = "active";
          }
          goal.updatedAt = new Date().toISOString();
        }
      }

      transactions = transactions.filter((t) => t.id !== id);
    }
    return ok(null);
  },
};

// ─── Goals ────────────────────────────────────────────────────────────────────

export const mockGoalHandlers = {
  async list(): Promise<PaginatedResponse<SavingsGoal>> {
    await delay();
    return paginate(goals);
  },

  async get(id: string): Promise<ApiResponse<SavingsGoal>> {
    await delay(80);
    const found = goals.find((g) => g.id === id);
    if (!found) throw new Error(`Meta ${id} no encontrada`);
    return ok(found);
  },

  async create(
    data: Omit<SavingsGoal, "id" | "createdAt" | "updatedAt">,
  ): Promise<ApiResponse<SavingsGoal>> {
    await delay();
    const now = new Date().toISOString();
    const goal = { ...data, id: generateId(), createdAt: now, updatedAt: now };
    goals.push(goal);
    return ok(goal);
  },

  async update(
    id: string,
    data: Partial<Omit<SavingsGoal, "id" | "createdAt" | "updatedAt">>,
  ): Promise<ApiResponse<SavingsGoal>> {
    await delay();
    const idx = goals.findIndex((g) => g.id === id);
    if (idx === -1) throw new Error(`Meta ${id} no encontrada`);
    goals[idx] = {
      ...goals[idx],
      ...data,
      updatedAt: new Date().toISOString(),
    };
    // Auto-completar si alcanzó el objetivo
    if (goals[idx].currentAmount >= goals[idx].targetAmount) {
      goals[idx].status = "completed";
    }
    return ok(goals[idx]);
  },

  async delete(id: string): Promise<ApiResponse<null>> {
    await delay();
    goals = goals.filter((g) => g.id !== id);
    return ok(null);
  },

  async contribute(
    id: string,
    payload: GoalContributionPayload,
  ): Promise<ApiResponse<{ goal: SavingsGoal; transaction: Transaction }>> {
    await delay();
    const gIdx = goals.findIndex((g) => g.id === id);
    if (gIdx === -1) throw new Error(`Meta ${id} no encontrada`);

    const accIdx = accounts.findIndex((a) => a.id === payload.accountId);
    if (accIdx === -1) throw new Error(`Cuenta no encontrada`);

    const now = new Date().toISOString();
    const goal = goals[gIdx];

    // Descontar saldo de la cuenta
    accounts[accIdx].balance -= payload.amount;
    accounts[accIdx].updatedAt = now;

    // Aumentar monto ahorrado en la meta
    goal.currentAmount += payload.amount;
    goal.updatedAt = now;
    if (goal.currentAmount >= goal.targetAmount) {
      goal.status = "completed";
    }

    // Registrar transacción de ahorro
    const tx: Transaction = {
      id: generateId(),
      accountId: payload.accountId,
      categoryId: "cat-savings",
      goalId: id,
      type: "expense",
      amount: payload.amount,
      currency: goal.currency,
      description: `Aporte a meta: ${goal.name}`,
      note: payload.note,
      date: payload.date ?? now,
      createdAt: now,
      updatedAt: now,
    };
    transactions.push(tx);

    return ok({ goal, transaction: tx });
  },

  async withdraw(
    id: string,
    payload: GoalWithdrawPayload,
  ): Promise<ApiResponse<{ goal: SavingsGoal; transaction: Transaction }>> {
    await delay();
    const gIdx = goals.findIndex((g) => g.id === id);
    if (gIdx === -1) throw new Error(`Meta ${id} no encontrada`);

    const accIdx = accounts.findIndex((a) => a.id === payload.accountId);
    if (accIdx === -1) throw new Error(`Cuenta no encontrada`);

    const now = new Date().toISOString();
    const goal = goals[gIdx];

    // Reintegrar saldo a la cuenta
    accounts[accIdx].balance += payload.amount;
    accounts[accIdx].updatedAt = now;

    // Reducir monto ahorrado
    goal.currentAmount = Math.max(0, goal.currentAmount - payload.amount);
    goal.updatedAt = now;
    if (goal.currentAmount < goal.targetAmount && goal.status === "completed") {
      goal.status = "active";
    }

    // Registrar transacción de reintegro
    const tx: Transaction = {
      id: generateId(),
      accountId: payload.accountId,
      categoryId: "cat-savings",
      goalId: id,
      type: "income",
      amount: payload.amount,
      currency: goal.currency,
      description: `Retiro de meta: ${goal.name}`,
      note: payload.note,
      date: payload.date ?? now,
      createdAt: now,
      updatedAt: now,
    };
    transactions.push(tx);

    return ok({ goal, transaction: tx });
  },
};

// ─── Reports ──────────────────────────────────────────────────────────────────

export const mockReportHandlers = {
  async monthly(
    year: number,
    month: number,
  ): Promise<ApiResponse<MonthlyReport>> {
    await delay(150);

    // Filtra transacciones del mes (excluyendo metas y aportes a ahorros)
    const prefix = `${year}-${String(month).padStart(2, "0")}`;
    const monthTx = transactions.filter(
      (t) =>
        t.date.startsWith(prefix) &&
        !t.goalId &&
        t.categoryId !== "cat-savings",
    );

    const totalIncome = monthTx
      .filter((t) => t.type === "income")
      .reduce((s, t) => s + t.amount, 0);
    const totalExpenses = monthTx
      .filter((t) => t.type === "expense")
      .reduce((s, t) => s + t.amount, 0);

    // Agrupa gastos por categoría
    const expMap = new Map<string, number>();
    monthTx
      .filter((t) => t.type === "expense")
      .forEach((t) => {
        expMap.set(t.categoryId, (expMap.get(t.categoryId) ?? 0) + t.amount);
      });

    const byExpenseCategory = Array.from(expMap.entries())
      .map(([catId, total]) => {
        const cat = mockCategories.find((c) => c.id === catId) as Category;
        return {
          categoryId: catId,
          categoryName: cat?.name ?? catId,
          categoryIcon: cat?.icon ?? "tag",
          categoryColor: cat?.color ?? colors.accent.slate,
          total,
          transactionCount: monthTx.filter((t) => t.categoryId === catId)
            .length,
          percentage: totalExpenses > 0 ? (total / totalExpenses) * 100 : 0,
        };
      })
      .sort((a, b) => b.total - a.total);

    // Agrupa ingresos por categoría
    const incMap = new Map<string, number>();
    monthTx
      .filter((t) => t.type === "income")
      .forEach((t) => {
        incMap.set(t.categoryId, (incMap.get(t.categoryId) ?? 0) + t.amount);
      });

    const byIncomeCategory = Array.from(incMap.entries())
      .map(([catId, total]) => {
        const cat = mockCategories.find((c) => c.id === catId) as Category;
        return {
          categoryId: catId,
          categoryName: cat?.name ?? catId,
          categoryIcon: cat?.icon ?? "tag",
          categoryColor: cat?.color ?? colors.accent.slate,
          total,
          transactionCount: monthTx.filter((t) => t.categoryId === catId)
            .length,
          percentage: totalIncome > 0 ? (total / totalIncome) * 100 : 0,
        };
      })
      .sort((a, b) => b.total - a.total);

    return ok({
      month,
      year,
      totalIncome,
      totalExpenses,
      netBalance: totalIncome - totalExpenses,
      byCategory: byExpenseCategory,
      byExpenseCategory,
      byIncomeCategory,
    });
  },

  async annual(year: number): Promise<ApiResponse<AnnualReport>> {
    await delay(180);

    const yearPrefix = String(year);
    const yearTx = transactions.filter(
      (t) =>
        t.date.startsWith(yearPrefix) &&
        !t.goalId &&
        t.categoryId !== "cat-savings",
    );

    const totalIncome = yearTx
      .filter((t) => t.type === "income")
      .reduce((s, t) => s + t.amount, 0);
    const totalExpenses = yearTx
      .filter((t) => t.type === "expense")
      .reduce((s, t) => s + t.amount, 0);
    const netBalance = totalIncome - totalExpenses;

    // Agrupa gastos anuales por categoría
    const expMap = new Map<string, number>();
    yearTx
      .filter((t) => t.type === "expense")
      .forEach((t) => {
        expMap.set(t.categoryId, (expMap.get(t.categoryId) ?? 0) + t.amount);
      });

    const byExpenseCategory = Array.from(expMap.entries())
      .map(([catId, total]) => {
        const cat = mockCategories.find((c) => c.id === catId) as Category;
        return {
          categoryId: catId,
          categoryName: cat?.name ?? catId,
          categoryIcon: cat?.icon ?? "tag",
          categoryColor: cat?.color ?? colors.accent.slate,
          total,
          transactionCount: yearTx.filter((t) => t.categoryId === catId).length,
          percentage: totalExpenses > 0 ? (total / totalExpenses) * 100 : 0,
        };
      })
      .sort((a, b) => b.total - a.total);

    // Agrupa ingresos anuales por categoría
    const incMap = new Map<string, number>();
    yearTx
      .filter((t) => t.type === "income")
      .forEach((t) => {
        incMap.set(t.categoryId, (incMap.get(t.categoryId) ?? 0) + t.amount);
      });

    const byIncomeCategory = Array.from(incMap.entries())
      .map(([catId, total]) => {
        const cat = mockCategories.find((c) => c.id === catId) as Category;
        return {
          categoryId: catId,
          categoryName: cat?.name ?? catId,
          categoryIcon: cat?.icon ?? "tag",
          categoryColor: cat?.color ?? colors.accent.slate,
          total,
          transactionCount: yearTx.filter((t) => t.categoryId === catId).length,
          percentage: totalIncome > 0 ? (total / totalIncome) * 100 : 0,
        };
      })
      .sort((a, b) => b.total - a.total);

    // Desglose mes a mes
    const MONTH_NAMES = [
      "Ene",
      "Feb",
      "Mar",
      "Abr",
      "May",
      "Jun",
      "Jul",
      "Ago",
      "Sep",
      "Oct",
      "Nov",
      "Dic",
    ];
    const monthlyBreakdown = MONTH_NAMES.map((name, idx) => {
      const m = idx + 1;
      const mPrefix = `${year}-${String(m).padStart(2, "0")}`;
      const mTx = yearTx.filter((t) => t.date.startsWith(mPrefix));
      const inc = mTx
        .filter((t) => t.type === "income")
        .reduce((s, t) => s + t.amount, 0);
      const exp = mTx
        .filter((t) => t.type === "expense")
        .reduce((s, t) => s + t.amount, 0);
      return {
        month: m,
        monthName: name,
        income: inc,
        expense: exp,
        net: inc - exp,
      };
    });

    return ok({
      year,
      totalIncome,
      totalExpenses,
      netBalance,
      byExpenseCategory,
      byIncomeCategory,
      monthlyBreakdown,
    });
  },

  async stats(): Promise<ApiResponse<SystemStats>> {
    await delay(80);
    const totalRecords = accounts.length + transactions.length + goals.length;
    return ok({
      activeUsers: 1,
      totalAccounts: accounts.length,
      totalTransactions: transactions.length,
      totalGoals: goals.length,
      dbSizeBytes: 32768 + totalRecords * 512,
      dbQuotaBytes: 5 * 1024 * 1024 * 1024,
    });
  },
};
