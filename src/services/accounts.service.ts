import { api } from "@/lib/api";
import {
  mockAccountHandlers,
  mockShareHandlers,
} from "@/lib/mock/handlers";
import type {
  Account,
  ApiResponse,
  PaginatedResponse,
  ShareInviteResponse,
  ShareJoinResponse,
  SharedResourceType,
} from "@/types";

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

export const shareService = {
  createInvite: (
    resourceType: SharedResourceType,
    resourceId: string
  ): Promise<ApiResponse<ShareInviteResponse>> =>
    USE_MOCK
      ? mockShareHandlers.createInvite(resourceType, resourceId)
      : api.post<ApiResponse<ShareInviteResponse>>("/share/invite", {
          resourceType,
          resourceId,
        }),

  join: (code: string): Promise<ApiResponse<ShareJoinResponse>> =>
    USE_MOCK
      ? mockShareHandlers.join(code)
      : api.post<ApiResponse<ShareJoinResponse>>("/share/join", { code }),

  leave: (
    resourceType: SharedResourceType,
    resourceId: string,
    targetUserId?: string
  ): Promise<ApiResponse<null>> =>
    USE_MOCK
      ? mockShareHandlers.leave(resourceType, resourceId, targetUserId)
      : api.post<ApiResponse<null>>("/share/leave", {
          resourceType,
          resourceId,
          targetUserId,
        }),
};
