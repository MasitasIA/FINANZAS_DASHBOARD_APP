import { api } from "@/lib/api";
import { mockBudgetHandlers } from "@/lib/mock/handlers";
import type { ApiResponse, Budget, SetBudgetPayload, Currency } from "@/types";

const USE_MOCK = process.env.EXPO_PUBLIC_USE_MOCK === "true";

export const budgetsService = {
  list: (
    currency?: Currency,
    month?: number,
    year?: number,
  ): Promise<ApiResponse<Budget[]>> => {
    if (USE_MOCK) return mockBudgetHandlers.list(currency, month, year);
    const params = new URLSearchParams();
    if (currency) params.set("currency", currency);
    if (month) params.set("month", String(month));
    if (year) params.set("year", String(year));
    const qs = params.toString();
    return api.get<ApiResponse<Budget[]>>(`/budgets${qs ? `?${qs}` : ""}`);
  },

  set: (data: SetBudgetPayload): Promise<ApiResponse<Budget>> => {
    if (USE_MOCK) return mockBudgetHandlers.set(data);
    return api.put<ApiResponse<Budget>>("/budgets", data);
  },

  delete: (id: string): Promise<ApiResponse<null>> => {
    if (USE_MOCK) return mockBudgetHandlers.delete(id);
    return api.delete<ApiResponse<null>>(`/budgets/${id}`);
  },
};

