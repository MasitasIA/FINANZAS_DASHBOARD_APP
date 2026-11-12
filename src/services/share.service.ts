import { api } from "@/lib/api";
import type {
  ApiResponse,
  ShareInviteResponse,
  ShareJoinResponse,
  SharedResourceType,
} from "@/types";

const USE_MOCK = process.env.EXPO_PUBLIC_USE_MOCK === "true";
const getMock = () => import("@/lib/mock/handlers");

export const shareService = {
  createInvite: async (
    resourceType: SharedResourceType,
    resourceId: string,
  ): Promise<ApiResponse<ShareInviteResponse>> => {
    if (USE_MOCK)
      return (await getMock()).mockShareHandlers.createInvite(
        resourceType,
        resourceId,
      );
    return api.post<ApiResponse<ShareInviteResponse>>("/share/invite", {
      resourceType,
      resourceId,
    });
  },

  join: async (code: string): Promise<ApiResponse<ShareJoinResponse>> => {
    if (USE_MOCK) return (await getMock()).mockShareHandlers.join(code);
    return api.post<ApiResponse<ShareJoinResponse>>("/share/join", { code });
  },

  leave: async (
    resourceType: SharedResourceType,
    resourceId: string,
    targetUserId?: string,
  ): Promise<ApiResponse<null>> => {
    if (USE_MOCK)
      return (await getMock()).mockShareHandlers.leave(
        resourceType,
        resourceId,
        targetUserId,
      );
    return api.post<ApiResponse<null>>("/share/leave", {
      resourceType,
      resourceId,
      targetUserId,
    });
  },
};

