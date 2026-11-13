import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { budgetsService } from "@/services/budgets.service";
import type { SetBudgetPayload, Currency } from "@/types";

export const BUDGETS_KEY = ["budgets"];

export function useBudgets(currency?: Currency, month?: number, year?: number) {
  return useQuery({
    queryKey: [...BUDGETS_KEY, currency, month, year],
    queryFn: () => budgetsService.list(currency, month, year),
  });
}

export function useSetBudget() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: SetBudgetPayload) => budgetsService.set(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: BUDGETS_KEY });
    },
  });
}

export function useDeleteBudget() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) => budgetsService.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: BUDGETS_KEY });
    },
  });
}

