import { api } from "@/lib/api";
import {
  mockAccountHandlers,
} from "@/lib/mock/handlers";
import type { Account, ApiResponse, PaginatedResponse } from "@/types";

const USE_MOCK = process.env.EXPO_PUBLIC_USE_MOCK === "true";

export const accountsService = {
  list: (): Promise<PaginatedResponse<Account>> =>
    USE_MOCK
      ? mockAccountHandlers.list()
      : api.get<PaginatedResponse<Account>>("/accounts"),

  get: (id: string): Promise<ApiResponse<Account>> =>
    USE_MOCK
      ? mockAccountHandlers.get(id)
      : api.get<ApiResponse<Account>>(`/accounts/${id}`),

  create: (
    data: Omit<Account, "id" | "createdAt" | "updatedAt">
  ): Promise<ApiResponse<Account>> =>
    USE_MOCK
      ? mockAccountHandlers.create(data)
      : api.post<ApiResponse<Account>>("/accounts", data),

  update: (
    id: string,
    data: Partial<Omit<Account, "id" | "createdAt" | "updatedAt">>
  ): Promise<ApiResponse<Account>> =>
    USE_MOCK
      ? mockAccountHandlers.update(id, data)
      : api.patch<ApiResponse<Account>>(`/accounts/${id}`, data),

  delete: (id: string): Promise<ApiResponse<null>> =>
    USE_MOCK
      ? mockAccountHandlers.delete(id)
      : api.delete<ApiResponse<null>>(`/accounts/${id}`),
};
