import { api } from "@/lib/api";
import type {
  ApiResponse,
  PaginatedResponse,
  RecurringApplyPayload,
  RecurringExpense,
  RecurringProcessResult,
  UserSettings,
  UserSettingsPatch,
} from "@/types";

const USE_MOCK = process.env.EXPO_PUBLIC_USE_MOCK === "true";
const getMock = () => import("@/lib/mock/handlers");

export const recurringExpensesService = {
  list: async () => {
    if (USE_MOCK) return (await getMock()).mockRecurringExpenseHandlers.list();
    return api.get<PaginatedResponse<RecurringExpense>>("/recurring-expenses");
  },

  create: async (
    payload: Omit<RecurringExpense, "id" | "createdAt" | "updatedAt">,
  ) => {
    if (USE_MOCK)
      return (await getMock()).mockRecurringExpenseHandlers.create(payload);
    return api.post<ApiResponse<RecurringExpense>>("/recurring-expenses", payload);
  },

  update: async (
    id: string,
    payload: Partial<Omit<RecurringExpense, "id" | "createdAt" | "updatedAt">>,
  ) => {
    if (USE_MOCK)
      return (await getMock()).mockRecurringExpenseHandlers.update(id, payload);
    return api.patch<ApiResponse<RecurringExpense>>(
      `/recurring-expenses/${id}`,
      payload,
    );
  },

  remove: async (id: string) => {
    if (USE_MOCK)
      return (await getMock()).mockRecurringExpenseHandlers.remove(id);
    return api.delete<ApiResponse<null>>(`/recurring-expenses/${id}`);
  },

  pay: async (id: string, payload?: RecurringApplyPayload) => {
    if (USE_MOCK)
      return (await getMock()).mockRecurringExpenseHandlers.pay(id, payload);
    return api.post<ApiResponse<RecurringExpense>>(
      `/recurring-expenses/${id}/pay`,
      payload ?? {},
    );
  },

  skip: async (id: string) => {
    if (USE_MOCK)
      return (await getMock()).mockRecurringExpenseHandlers.skip(id);
    return api.post<ApiResponse<RecurringExpense>>(
      `/recurring-expenses/${id}/skip`,
      {},
    );
  },

  getSettings: async () => {
    if (USE_MOCK)
      return (await getMock()).mockRecurringExpenseHandlers.getSettings();
    return api.get<ApiResponse<UserSettings>>("/user-settings");
  },

  updateSettings: async (patch: UserSettingsPatch) => {
    if (USE_MOCK)
      return (await getMock()).mockRecurringExpenseHandlers.updateSettings(
        patch,
      );
    return api.put<ApiResponse<UserSettings>>("/user-settings", patch);
  },

  processDue: async (payload?: { localDate?: string; localTime?: string }) => {
    if (USE_MOCK)
      return (await getMock()).mockRecurringExpenseHandlers.processDue(payload);
    return api.post<ApiResponse<RecurringProcessResult>>(
      "/recurring-expenses/process-due",
      payload ?? {},
    );
  },
};

