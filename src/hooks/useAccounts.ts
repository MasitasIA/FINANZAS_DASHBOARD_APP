import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { accountsService, shareService } from "@/services/accounts.service";
import type { Account, SharedResourceType } from "@/types";

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

// ─── Hooks de Cuentas y Metas Compartidas ────────────────────────────────────

export function useCreateShareInvite() {
  return useMutation({
    mutationFn: ({
      resourceType,
      resourceId,
    }: {
      resourceType: SharedResourceType;
      resourceId: string;
    }) => shareService.createInvite(resourceType, resourceId),
  });
}

export function useJoinSharedResource() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (code: string) => shareService.join(code),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: accountKeys.all() });
      qc.invalidateQueries({ queryKey: ["goals"] });
      qc.invalidateQueries({ queryKey: ["transactions"] });
    },
  });
}

export function useLeaveSharedResource() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({
      resourceType,
      resourceId,
      targetUserId,
    }: {
      resourceType: SharedResourceType;
      resourceId: string;
      targetUserId?: string;
    }) => shareService.leave(resourceType, resourceId, targetUserId),
    onSuccess: (_res, { resourceType, resourceId }) => {
      if (resourceType === "account") {
        qc.invalidateQueries({ queryKey: accountKeys.lists() });
        qc.invalidateQueries({ queryKey: accountKeys.detail(resourceId) });
      } else {
        qc.invalidateQueries({ queryKey: ["goals"] });
      }
      qc.invalidateQueries({ queryKey: ["transactions"] });
    },
  });
}
