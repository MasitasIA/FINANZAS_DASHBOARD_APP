import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { transactionsService, type TransactionFilters } from "@/services/transactions.service";
import type { Transaction } from "@/types";

// ─── Query Keys ──────────────────────────────────────────────────────────────

export const transactionKeys = {
  all:    () => ["transactions"] as const,
  lists:  (filters?: TransactionFilters) =>
            [...transactionKeys.all(), "list", filters] as const,
  detail: (id: string) => [...transactionKeys.all(), id] as const,
};

// ─── Queries ─────────────────────────────────────────────────────────────────

export function useTransactions(filters: TransactionFilters = {}) {
  return useQuery({
    queryKey: transactionKeys.lists(filters),
    queryFn:  () => transactionsService.list(filters),
    staleTime: 1000 * 60, // 1 minuto
  });
}

export function useTransaction(id: string) {
  return useQuery({
    queryKey: transactionKeys.detail(id),
    queryFn:  () => transactionsService.get(id),
    enabled:  Boolean(id),
  });
}

// ─── Mutations ────────────────────────────────────────────────────────────────

export function useCreateTransaction() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: Omit<Transaction, "id" | "createdAt" | "updatedAt">) =>
      transactionsService.create(data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: transactionKeys.all() });
      qc.invalidateQueries({ queryKey: ["accounts"] });
      qc.invalidateQueries({ queryKey: ["goals"] });
      qc.invalidateQueries({ queryKey: ["reports"] });
    },
  });
}

export function useUpdateTransaction() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({
      id,
      data,
    }: {
      id: string;
      data: Partial<Omit<Transaction, "id" | "createdAt" | "updatedAt">>;
    }) => transactionsService.update(id, data),
    onSuccess: (_res, { id }) => {
      qc.invalidateQueries({ queryKey: transactionKeys.all() });
      qc.invalidateQueries({ queryKey: transactionKeys.detail(id) });
      qc.invalidateQueries({ queryKey: ["accounts"] });
      qc.invalidateQueries({ queryKey: ["goals"] });
      qc.invalidateQueries({ queryKey: ["reports"] });
    },
  });
}

export function useDeleteTransaction() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => transactionsService.delete(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: transactionKeys.all() });
      qc.invalidateQueries({ queryKey: ["accounts"] });
      qc.invalidateQueries({ queryKey: ["goals"] });
      qc.invalidateQueries({ queryKey: ["reports"] });
    },
  });
}

