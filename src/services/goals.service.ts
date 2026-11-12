import { api } from "@/lib/api";
import type {
  ApiResponse,
  GoalContributionPayload,
  GoalWithdrawPayload,
  PaginatedResponse,
  SavingsGoal,
  Transaction,
} from "@/types";

const USE_MOCK = process.env.EXPO_PUBLIC_USE_MOCK === "true";
const getMock = () => import("@/lib/mock/handlers");

export const goalsService = {
  list: async (): Promise<PaginatedResponse<SavingsGoal>> => {
    if (USE_MOCK) return (await getMock()).mockGoalHandlers.list();
    return api.get<PaginatedResponse<SavingsGoal>>("/goals");
  },

  get: async (id: string): Promise<ApiResponse<SavingsGoal>> => {
    if (USE_MOCK) return (await getMock()).mockGoalHandlers.get(id);
    return api.get<ApiResponse<SavingsGoal>>(`/goals/${id}`);
  },

  create: async (
    data: Omit<SavingsGoal, "id" | "createdAt" | "updatedAt">
  ): Promise<ApiResponse<SavingsGoal>> => {
    if (USE_MOCK) return (await getMock()).mockGoalHandlers.create(data);
    return api.post<ApiResponse<SavingsGoal>>("/goals", data);
  },

  update: async (
    id: string,
    data: Partial<Omit<SavingsGoal, "id" | "createdAt" | "updatedAt">>
  ): Promise<ApiResponse<SavingsGoal>> => {
    if (USE_MOCK) return (await getMock()).mockGoalHandlers.update(id, data);
    return api.patch<ApiResponse<SavingsGoal>>(`/goals/${id}`, data);
  },

  delete: async (id: string): Promise<ApiResponse<null>> => {
    if (USE_MOCK) return (await getMock()).mockGoalHandlers.delete(id);
    return api.delete<ApiResponse<null>>(`/goals/${id}`);
  },

  contribute: async (
    id: string,
    payload: GoalContributionPayload
  ): Promise<ApiResponse<{ goal: SavingsGoal; transaction: Transaction }>> => {
    if (USE_MOCK)
      return (await getMock()).mockGoalHandlers.contribute(id, payload);
    return api.post<ApiResponse<{ goal: SavingsGoal; transaction: Transaction }>>(
      `/goals/${id}/contribute`,
      payload
    );
  },

  withdraw: async (
    id: string,
    payload: GoalWithdrawPayload
  ): Promise<ApiResponse<{ goal: SavingsGoal; transaction: Transaction }>> => {
    if (USE_MOCK)
      return (await getMock()).mockGoalHandlers.withdraw(id, payload);
    return api.post<ApiResponse<{ goal: SavingsGoal; transaction: Transaction }>>(
      `/goals/${id}/withdraw`,
      payload
    );
  },
};

export { reportsService, statsService } from "./reports.service";
