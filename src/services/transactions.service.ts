import { api } from "@/lib/api";
import type { ApiResponse, PaginatedResponse, Transaction } from "@/types";

const USE_MOCK = process.env.EXPO_PUBLIC_USE_MOCK === "true";
const getMock = () => import("@/lib/mock/handlers");

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
  list: async (
    filters: TransactionFilters = {}
  ): Promise<PaginatedResponse<Transaction>> => {
    if (USE_MOCK) return (await getMock()).mockTransactionHandlers.list(filters);

    const params = new URLSearchParams();
    Object.entries(filters).forEach(([k, v]) => {
      if (v !== undefined) params.set(k, String(v));
    });
    const qs = params.toString();
    return api.get<PaginatedResponse<Transaction>>(
      `/transactions${qs ? `?${qs}` : ""}`
    );
  },

  get: async (id: string): Promise<ApiResponse<Transaction>> => {
    if (USE_MOCK) return (await getMock()).mockTransactionHandlers.get(id);
    return api.get<ApiResponse<Transaction>>(`/transactions/${id}`);
  },

  create: async (
    data: Omit<Transaction, "id" | "createdAt" | "updatedAt">
  ): Promise<ApiResponse<Transaction>> => {
    if (USE_MOCK) return (await getMock()).mockTransactionHandlers.create(data);
    return api.post<ApiResponse<Transaction>>("/transactions", data);
  },

  update: async (
    id: string,
    data: Partial<Omit<Transaction, "id" | "createdAt" | "updatedAt">>
  ): Promise<ApiResponse<Transaction>> => {
    if (USE_MOCK) return (await getMock()).mockTransactionHandlers.update(id, data);
    return api.patch<ApiResponse<Transaction>>(`/transactions/${id}`, data);
  },

  delete: async (id: string): Promise<ApiResponse<null>> => {
    if (USE_MOCK) return (await getMock()).mockTransactionHandlers.delete(id);
    return api.delete<ApiResponse<null>>(`/transactions/${id}`);
  },
};
