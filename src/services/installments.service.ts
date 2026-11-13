import { api } from "@/lib/api";
import { mockInstallmentHandlers } from "@/lib/mock/handlers";
import type {
  ApiResponse,
  CreditCardInstallment,
  CreateInstallmentPayload,
} from "@/types";

const USE_MOCK = process.env.EXPO_PUBLIC_USE_MOCK === "true";

export const installmentsService = {
  list: (accountId?: string): Promise<ApiResponse<CreditCardInstallment[]>> => {
    if (USE_MOCK) return mockInstallmentHandlers.list(accountId);
    const qs = accountId ? `?accountId=${encodeURIComponent(accountId)}` : "";
    return api.get<ApiResponse<CreditCardInstallment[]>>(`/installments${qs}`);
  },

  create: (
    data: CreateInstallmentPayload,
  ): Promise<ApiResponse<CreditCardInstallment>> => {
    if (USE_MOCK) return mockInstallmentHandlers.create(data);
    return api.post<ApiResponse<CreditCardInstallment>>("/installments", data);
  },

  cancel: (id: string): Promise<ApiResponse<{ success: boolean }>> => {
    if (USE_MOCK) return mockInstallmentHandlers.cancel(id);
    return api.post<ApiResponse<{ success: boolean }>>(
      `/installments/${id}/cancel`,
      {},
    );
  },
};

