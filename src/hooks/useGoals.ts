import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { goalsService, reportsService } from "@/services/goals.service";
import { useReportsStore } from "@/store/reports.store";
import type { SavingsGoal } from "@/types";

// ─── Query Keys ──────────────────────────────────────────────────────────────

export const goalKeys = {
  all:    () => ["goals"] as const,
  lists:  () => [...goalKeys.all(), "list"] as const,
  detail: (id: string) => [...goalKeys.all(), id] as const,
};

export const reportKeys = {
  monthly: (year: number, month: number) =>
    ["reports", "monthly", year, month] as const,
  annual: (year: number) =>
    ["reports", "annual", year] as const,
  stats: () => ["reports", "stats"] as const,
};

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

// ─── Reports Query ────────────────────────────────────────────────────────────

export function useMonthlyReport() {
  const { selectedYear, selectedMonth } = useReportsStore();

  return useQuery({
    queryKey: reportKeys.monthly(selectedYear, selectedMonth),
    queryFn:  () => reportsService.monthly(selectedYear, selectedMonth),
    staleTime: 1000 * 60 * 10, // 10 minutos
  });
}

export function useAnnualReport(year?: number) {
  const { selectedYear } = useReportsStore();
  const targetYear = year ?? selectedYear;

  return useQuery({
    queryKey: reportKeys.annual(targetYear),
    queryFn:  () => reportsService.annual(targetYear),
    staleTime: 1000 * 60 * 10, // 10 minutos
  });
}

export function useSystemStats(enabled = true) {
  return useQuery({
    queryKey: reportKeys.stats(),
    queryFn:  () => reportsService.stats(),
    enabled,
    staleTime: 1000 * 60 * 10, // 10 minutos
  });
}
