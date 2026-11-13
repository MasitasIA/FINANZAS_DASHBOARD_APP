import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { installmentsService } from "@/services/installments.service";
import type { CreateInstallmentPayload } from "@/types";

export const INSTALLMENTS_KEY = ["installments"];

export function useInstallments(accountId?: string) {
  return useQuery({
    queryKey: [...INSTALLMENTS_KEY, accountId],
    queryFn: () => installmentsService.list(accountId),
  });
}

export function useCreateInstallment() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: CreateInstallmentPayload) =>
      installmentsService.create(data),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: INSTALLMENTS_KEY });
      queryClient.invalidateQueries({ queryKey: ["accounts"] });
      queryClient.invalidateQueries({ queryKey: ["account", variables.accountId] });
      queryClient.invalidateQueries({ queryKey: ["transactions"] });
      queryClient.invalidateQueries({ queryKey: ["statements"] });
    },
  });
}

export function useCancelInstallment() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) => installmentsService.cancel(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: INSTALLMENTS_KEY });
      queryClient.invalidateQueries({ queryKey: ["accounts"] });
    },
  });
}

