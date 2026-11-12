import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { accountsService } from "@/services/accounts.service";
import type { Account } from "@/types";

// ─── Query Keys ──────────────────────────────────────────────────────────────

export const accountKeys = {
  all:    () => ["accounts"] as const,
  lists:  () => [...accountKeys.all(), "list"] as const,
  detail: (id: string) => [...accountKeys.all(), id] as const,
};

// ─── Queries ─────────────────────────────────────────────────────────────────

export function useAccounts() {
  return useQuery({
    queryKey: accountKeys.lists(),
    queryFn:  () => accountsService.list(),
    staleTime: 1000 * 60 * 2, // 2 minutos
  });
}

export function useAccount(id: string) {
  return useQuery({
    queryKey: accountKeys.detail(id),
    queryFn:  () => accountsService.get(id),
    enabled:  Boolean(id),
  });
}

// ─── Mutations ────────────────────────────────────────────────────────────────

export function useCreateAccount() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: Omit<Account, "id" | "createdAt" | "updatedAt">) =>
      accountsService.create(data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: accountKeys.lists() });
    },
  });
}

export function useUpdateAccount() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({
      id,
      data,
    }: {
      id: string;
      data: Partial<Omit<Account, "id" | "createdAt" | "updatedAt">>;
    }) => accountsService.update(id, data),
    onSuccess: (_res, { id }) => {
      qc.invalidateQueries({ queryKey: accountKeys.lists() });
      qc.invalidateQueries({ queryKey: accountKeys.detail(id) });
    },
  });
}

export function useDeleteAccount() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => accountsService.delete(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: accountKeys.lists() });
      qc.invalidateQueries({ queryKey: ["transactions"] });
      qc.invalidateQueries({ queryKey: ["reports"] });
    },
  });
}

// ─── Re-exports for backward compatibility ──────────────────────────────────
export {
  useCreateShareInvite,
  useJoinSharedResource,
  useLeaveSharedResource,
} from "./useShare";
