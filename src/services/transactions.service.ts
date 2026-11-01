import { api } from "@/lib/api";
import {
  mockTransactionHandlers,
} from "@/lib/mock/handlers";
import type { ApiResponse, PaginatedResponse, Transaction } from "@/types";

const USE_MOCK = process.env.EXPO_PUBLIC_USE_MOCK === "true";

export interface TransactionFilters {
  accountId?:  string;
  categoryId?: string;
  goalId?:     string;
  type?:       "income" | "expense" | "transfer";
  startDate?:  string;
  endDate?:    string;
  page?:       number;
  pageSize?:   number;
}

export const transactionsService = {
  list: (filters: TransactionFilters = {}): Promise<PaginatedResponse<Transaction>> => {
    if (USE_MOCK) return mockTransactionHandlers.list(filters);

    const params = new URLSearchParams();
    Object.entries(filters).forEach(([k, v]) => {
      if (v !== undefined) params.set(k, String(v));
    });
    const qs = params.toString();
    return api.get<PaginatedResponse<Transaction>>(
      `/transactions${qs ? `?${qs}` : ""}`
    );
  },

  get: (id: string): Promise<ApiResponse<Transaction>> =>
    USE_MOCK
      ? mockTransactionHandlers.get(id)
      : api.get<ApiResponse<Transaction>>(`/transactions/${id}`),

  create: (
    data: Omit<Transaction, "id" | "createdAt" | "updatedAt">
  ): Promise<ApiResponse<Transaction>> =>
    USE_MOCK
      ? mockTransactionHandlers.create(data)
      : api.post<ApiResponse<Transaction>>("/transactions", data),

  update: (
    id: string,
    data: Partial<Omit<Transaction, "id" | "createdAt" | "updatedAt">>
  ): Promise<ApiResponse<Transaction>> =>
    USE_MOCK
      ? mockTransactionHandlers.update(id, data)
      : api.patch<ApiResponse<Transaction>>(`/transactions/${id}`, data),

  delete: (id: string): Promise<ApiResponse<null>> =>
    USE_MOCK
      ? mockTransactionHandlers.delete(id)
      : api.delete<ApiResponse<null>>(`/transactions/${id}`),
};
