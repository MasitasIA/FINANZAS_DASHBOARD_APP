import { useQuery } from "@tanstack/react-query";
import { reportsService } from "@/services/reports.service";
import { useReportsStore } from "@/store/reports.store";

// ─── Query Keys ──────────────────────────────────────────────────────────────

export const reportKeys = {
  monthly: (year: number, month: number) =>
    ["reports", "monthly", year, month] as const,
  annual: (year: number) =>
    ["reports", "annual", year] as const,
  stats: () => ["reports", "stats"] as const,
};

// ─── Reports Queries ──────────────────────────────────────────────────────────

export function useMonthlyReport() {
  const { selectedYear, selectedMonth } = useReportsStore();

  return useQuery({
    queryKey: reportKeys.monthly(selectedYear, selectedMonth),
    queryFn: () => reportsService.monthly(selectedYear, selectedMonth),
    staleTime: 1000 * 60 * 10, // 10 minutos
  });
}

export function useAnnualReport(year?: number) {
  const { selectedYear } = useReportsStore();
  const targetYear = year ?? selectedYear;

  return useQuery({
    queryKey: reportKeys.annual(targetYear),
    queryFn: () => reportsService.annual(targetYear),
    staleTime: 1000 * 60 * 10, // 10 minutos
  });
}

export function useSystemStats(enabled = true) {
  return useQuery({
    queryKey: reportKeys.stats(),
    queryFn: () => reportsService.stats(),
    enabled,
    staleTime: 1000 * 60 * 10, // 10 minutos
  });
}

