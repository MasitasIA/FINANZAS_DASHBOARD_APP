import { api } from "@/lib/api";
import {
  mockGoalHandlers,
  mockReportHandlers,
} from "@/lib/mock/handlers";
import type {
  AnnualReport,
  ApiResponse,
  GoalContributionPayload,
  GoalWithdrawPayload,
  MonthlyReport,
  PaginatedResponse,
  SavingsGoal,
  SystemStats,
  Transaction,
} from "@/types";

const USE_MOCK = process.env.EXPO_PUBLIC_USE_MOCK === "true";

export const goalsService = {
  list: (): Promise<PaginatedResponse<SavingsGoal>> =>
    USE_MOCK
      ? mockGoalHandlers.list()
      : api.get<PaginatedResponse<SavingsGoal>>("/goals"),

  get: (id: string): Promise<ApiResponse<SavingsGoal>> =>
    USE_MOCK
      ? mockGoalHandlers.get(id)
      : api.get<ApiResponse<SavingsGoal>>(`/goals/${id}`),

  create: (
    data: Omit<SavingsGoal, "id" | "createdAt" | "updatedAt">
  ): Promise<ApiResponse<SavingsGoal>> =>
    USE_MOCK
      ? mockGoalHandlers.create(data)
      : api.post<ApiResponse<SavingsGoal>>("/goals", data),

  update: (
    id: string,
    data: Partial<Omit<SavingsGoal, "id" | "createdAt" | "updatedAt">>
  ): Promise<ApiResponse<SavingsGoal>> =>
    USE_MOCK
      ? mockGoalHandlers.update(id, data)
      : api.patch<ApiResponse<SavingsGoal>>(`/goals/${id}`, data),

  delete: (id: string): Promise<ApiResponse<null>> =>
    USE_MOCK
      ? mockGoalHandlers.delete(id)
      : api.delete<ApiResponse<null>>(`/goals/${id}`),

  contribute: (
    id: string,
    payload: GoalContributionPayload
  ): Promise<ApiResponse<{ goal: SavingsGoal; transaction: Transaction }>> =>
    USE_MOCK
      ? mockGoalHandlers.contribute(id, payload)
      : api.post<ApiResponse<{ goal: SavingsGoal; transaction: Transaction }>>(
          `/goals/${id}/contribute`,
          payload
        ),

  withdraw: (
    id: string,
    payload: GoalWithdrawPayload
  ): Promise<ApiResponse<{ goal: SavingsGoal; transaction: Transaction }>> =>
    USE_MOCK
      ? mockGoalHandlers.withdraw(id, payload)
      : api.post<ApiResponse<{ goal: SavingsGoal; transaction: Transaction }>>(
          `/goals/${id}/withdraw`,
          payload
        ),
};

export const reportsService = {
  monthly: (year: number, month: number): Promise<ApiResponse<MonthlyReport>> =>
    USE_MOCK
      ? mockReportHandlers.monthly(year, month)
      : api.get<ApiResponse<MonthlyReport>>(
          `/reports/monthly?year=${year}&month=${month}`
        ),

  annual: (year: number): Promise<ApiResponse<AnnualReport>> =>
    USE_MOCK
      ? mockReportHandlers.annual(year)
      : api.get<ApiResponse<AnnualReport>>(`/reports/annual?year=${year}`),

  stats: (): Promise<ApiResponse<SystemStats>> =>
    USE_MOCK
      ? mockReportHandlers.stats()
      : api.get<ApiResponse<SystemStats>>("/stats"),
};
