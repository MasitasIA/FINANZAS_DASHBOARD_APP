import { api } from "@/lib/api";
import { mockRecurringExpenseHandlers } from "@/lib/mock/handlers";
import type {
  ApiResponse,
  PaginatedResponse,
  RecurringApplyPayload,
  RecurringExpense,
  RecurringProcessResult,
  UserSettings,
} from "@/types";

const USE_MOCK = process.env.EXPO_PUBLIC_USE_MOCK === "true";

export const recurringExpensesService = {
  list: () =>
    USE_MOCK
      ? mockRecurringExpenseHandlers.list()
      : api.get<PaginatedResponse<RecurringExpense>>("/recurring-expenses"),

  create: (
    payload: Omit<RecurringExpense, "id" | "createdAt" | "updatedAt">,
  ) =>
    USE_MOCK
      ? mockRecurringExpenseHandlers.create(payload)
      : api.post<ApiResponse<RecurringExpense>>("/recurring-expenses", payload),

  update: (
    id: string,
    payload: Partial<Omit<RecurringExpense, "id" | "createdAt" | "updatedAt">>,
  ) =>
    USE_MOCK
      ? mockRecurringExpenseHandlers.update(id, payload)
      : api.patch<ApiResponse<RecurringExpense>>(
          `/recurring-expenses/${id}`,
          payload,
        ),

  remove: (id: string) =>
    USE_MOCK
      ? mockRecurringExpenseHandlers.remove(id)
      : api.delete<ApiResponse<null>>(`/recurring-expenses/${id}`),

  pay: (id: string, payload?: RecurringApplyPayload) =>
    USE_MOCK
      ? mockRecurringExpenseHandlers.pay(id, payload)
      : api.post<ApiResponse<RecurringExpense>>(
          `/recurring-expenses/${id}/pay`,
          payload ?? {},
        ),

  skip: (id: string) =>
    USE_MOCK
      ? mockRecurringExpenseHandlers.skip(id)
      : api.post<ApiResponse<RecurringExpense>>(
          `/recurring-expenses/${id}/skip`,
          {},
        ),

  getSettings: () =>
    USE_MOCK
      ? mockRecurringExpenseHandlers.getSettings()
      : api.get<ApiResponse<UserSettings>>("/user-settings"),

  updateSettings: (reminderTime: string) =>
    USE_MOCK
      ? mockRecurringExpenseHandlers.updateSettings(reminderTime)
      : api.put<ApiResponse<UserSettings>>("/user-settings", { reminderTime }),

  processDue: (payload?: { localDate?: string; localTime?: string }) =>
    USE_MOCK
      ? mockRecurringExpenseHandlers.processDue(payload)
      : api.post<ApiResponse<RecurringProcessResult>>(
          "/recurring-expenses/process-due",
          payload ?? {},
        ),
};

