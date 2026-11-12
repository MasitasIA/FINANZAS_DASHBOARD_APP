import { api } from "@/lib/api";
import type { Account, ApiResponse, PaginatedResponse } from "@/types";

const USE_MOCK = process.env.EXPO_PUBLIC_USE_MOCK === "true";
const getMock = () => import("@/lib/mock/handlers");

export const accountsService = {
  list: async (): Promise<PaginatedResponse<Account>> => {
    if (USE_MOCK) return (await getMock()).mockAccountHandlers.list();
    return api.get<PaginatedResponse<Account>>("/accounts");
  },

  get: async (id: string): Promise<ApiResponse<Account>> => {
    if (USE_MOCK) return (await getMock()).mockAccountHandlers.get(id);
    return api.get<ApiResponse<Account>>(`/accounts/${id}`);
  },

  create: async (
    data: Omit<Account, "id" | "createdAt" | "updatedAt">
  ): Promise<ApiResponse<Account>> => {
    if (USE_MOCK) return (await getMock()).mockAccountHandlers.create(data);
    return api.post<ApiResponse<Account>>("/accounts", data);
  },

  update: async (
    id: string,
    data: Partial<Omit<Account, "id" | "createdAt" | "updatedAt">>
  ): Promise<ApiResponse<Account>> => {
    if (USE_MOCK) return (await getMock()).mockAccountHandlers.update(id, data);
    return api.patch<ApiResponse<Account>>(`/accounts/${id}`, data);
  },

  delete: async (id: string): Promise<ApiResponse<null>> => {
    if (USE_MOCK) return (await getMock()).mockAccountHandlers.delete(id);
    return api.delete<ApiResponse<null>>(`/accounts/${id}`);
  },
};

export { shareService } from "./share.service";
