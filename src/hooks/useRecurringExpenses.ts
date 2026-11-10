import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { accountKeys } from "./useAccounts";
import { transactionKeys } from "./useTransactions";
import { recurringExpensesService } from "@/services/recurring.service";
import type {
  RecurringApplyPayload,
  RecurringExpense,
  UserSettingsPatch,
} from "@/types";

export const recurringExpenseKeys = {
  all: () => ["recurringExpenses"] as const,
  lists: () => [...recurringExpenseKeys.all(), "list"] as const,
  settings: () => ["userSettings"] as const,
};

export function useRecurringExpenses() {
  return useQuery({
    queryKey: recurringExpenseKeys.lists(),
    queryFn: () => recurringExpensesService.list(),
    staleTime: 1000 * 60 * 2,
  });
}

export function useUserSettings(enabled = true) {
  return useQuery({
    queryKey: recurringExpenseKeys.settings(),
    queryFn: async () => {
      const res = await recurringExpensesService.getSettings();
      return res.data;
    },
    enabled,
    staleTime: 1000 * 60 * 5,
  });
}

export function useUpdateUserSettings() {
  const qc = useQueryClient();
  return useMutation({
    // Acepta un patch (reminderTime y/o theme) o, por compatibilidad, la hora como string
    mutationFn: (patch: UserSettingsPatch | string) =>
      recurringExpensesService.updateSettings(
        typeof patch === "string" ? { reminderTime: patch } : patch,
      ),
    onSuccess: (res) => {
      qc.setQueryData(recurringExpenseKeys.settings(), res.data);
      qc.invalidateQueries({ queryKey: recurringExpenseKeys.settings() });
    },
  });
}

export function useSkipRecurringExpense() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => recurringExpensesService.skip(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: recurringExpenseKeys.lists() });
    },
  });
}

export function useProcessDueRecurring() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload?: { localDate?: string; localTime?: string }) =>
      recurringExpensesService.processDue(payload),
    onSuccess: (res) => {
      if (res.data.appliedFixed.length > 0) {
        qc.invalidateQueries({ queryKey: recurringExpenseKeys.lists() });
        qc.invalidateQueries({ queryKey: accountKeys.all() });
        qc.invalidateQueries({ queryKey: transactionKeys.all() });
        qc.invalidateQueries({ queryKey: ["reports"] });
      }
    },
  });
}

export function useCreateRecurringExpense() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (
      payload: Omit<RecurringExpense, "id" | "createdAt" | "updatedAt">,
    ) => recurringExpensesService.create(payload),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: recurringExpenseKeys.lists() });
    },
  });
}

export function useUpdateRecurringExpense() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({
      id,
      payload,
    }: {
      id: string;
      payload: Partial<
        Omit<RecurringExpense, "id" | "createdAt" | "updatedAt">
      >;
    }) => recurringExpensesService.update(id, payload),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: recurringExpenseKeys.lists() });
    },
  });
}

export function useDeleteRecurringExpense() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => recurringExpensesService.remove(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: recurringExpenseKeys.lists() });
    },
  });
}

export function usePayRecurringExpense() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({
      id,
      payload,
    }: {
      id: string;
      payload?: RecurringApplyPayload;
    }) => recurringExpensesService.pay(id, payload),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: recurringExpenseKeys.lists() });
      qc.invalidateQueries({ queryKey: accountKeys.all() });
      qc.invalidateQueries({ queryKey: transactionKeys.all() });
      qc.invalidateQueries({ queryKey: ["reports"] });
    },
  });
}
