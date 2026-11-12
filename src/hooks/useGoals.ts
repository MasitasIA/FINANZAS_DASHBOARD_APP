import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { goalsService } from "@/services/goals.service";
import type { SavingsGoal } from "@/types";

// ─── Query Keys ──────────────────────────────────────────────────────────────

export const goalKeys = {
  all:    () => ["goals"] as const,
  lists:  () => [...goalKeys.all(), "list"] as const,
  detail: (id: string) => [...goalKeys.all(), id] as const,
};

// Re-export query keys and report hooks for backward compatibility
export {
  reportKeys,
  useMonthlyReport,
  useAnnualReport,
  useSystemStats,
} from "./useReports";

// ─── Goals Queries & Mutations ───────────────────────────────────────────────

export function useGoals() {
  return useQuery({
    queryKey: goalKeys.lists(),
    queryFn:  () => goalsService.list(),
    staleTime: 1000 * 60 * 5, // 5 minutos
  });
}

export function useGoal(id: string) {
  return useQuery({
    queryKey: goalKeys.detail(id),
    queryFn:  () => goalsService.get(id),
    enabled:  Boolean(id),
  });
}

export function useCreateGoal() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: Omit<SavingsGoal, "id" | "createdAt" | "updatedAt">) =>
      goalsService.create(data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: goalKeys.lists() });
    },
  });
}

export function useUpdateGoal() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({
      id,
      data,
    }: {
      id: string;
      data: Partial<Omit<SavingsGoal, "id" | "createdAt" | "updatedAt">>;
    }) => goalsService.update(id, data),
    onSuccess: (_res, { id }) => {
      qc.invalidateQueries({ queryKey: goalKeys.lists() });
      qc.invalidateQueries({ queryKey: goalKeys.detail(id) });
    },
  });
}

export function useDeleteGoal() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => goalsService.delete(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: goalKeys.lists() });
    },
  });
}

export function useContributeToGoal() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({
      id,
      payload,
    }: {
      id: string;
      payload: import("@/types").GoalContributionPayload;
    }) => goalsService.contribute(id, payload),
    onSuccess: (_res, { id }) => {
      qc.invalidateQueries({ queryKey: goalKeys.lists() });
      qc.invalidateQueries({ queryKey: goalKeys.detail(id) });
      qc.invalidateQueries({ queryKey: ["accounts"] });
      qc.invalidateQueries({ queryKey: ["transactions"] });
      qc.invalidateQueries({ queryKey: ["reports"] });
    },
  });
}

export function useWithdrawFromGoal() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({
      id,
      payload,
    }: {
      id: string;
      payload: import("@/types").GoalWithdrawPayload;
    }) => goalsService.withdraw(id, payload),
    onSuccess: (_res, { id }) => {
      qc.invalidateQueries({ queryKey: goalKeys.lists() });
      qc.invalidateQueries({ queryKey: goalKeys.detail(id) });
      qc.invalidateQueries({ queryKey: ["accounts"] });
      qc.invalidateQueries({ queryKey: ["transactions"] });
      qc.invalidateQueries({ queryKey: ["reports"] });
    },
  });
}
