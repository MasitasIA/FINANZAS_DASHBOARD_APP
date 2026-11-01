import { create } from "zustand";
import type { Account } from "@/types";

interface AccountsState {
  // Estado local derivado (caché optimista)
  selectedAccountId: string | null;

  // Acciones de UI
  selectAccount: (id: string | null) => void;

  // Estado offline/pendiente (para futura implementación offline-first)
  pendingCreates: Omit<Account, "id" | "createdAt" | "updatedAt">[];
  addPendingCreate: (account: Omit<Account, "id" | "createdAt" | "updatedAt">) => void;
  clearPendingCreates: () => void;
}

export const useAccountsStore = create<AccountsState>((set) => ({
  selectedAccountId: null,
  pendingCreates: [],

  selectAccount: (id) => set({ selectedAccountId: id }),

  addPendingCreate: (account) =>
    set((s) => ({ pendingCreates: [...s.pendingCreates, account] })),

  clearPendingCreates: () => set({ pendingCreates: [] }),
}));
