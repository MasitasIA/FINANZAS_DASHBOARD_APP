import { api } from "@/lib/api";
import { mockStatementHandlers } from "@/lib/mock/handlers";
import type {
  ApiResponse,
  CreditCardStatement,
  PayStatementPayload,
} from "@/types";

const USE_MOCK = process.env.EXPO_PUBLIC_USE_MOCK === "true";

export const statementsService = {
  list: (accountId?: string): Promise<ApiResponse<CreditCardStatement[]>> => {
    if (USE_MOCK) return mockStatementHandlers.list(accountId);
    const qs = accountId ? `?accountId=${encodeURIComponent(accountId)}` : "";
    return api.get<ApiResponse<CreditCardStatement[]>>(`/statements${qs}`);
  },

  generate: (
    accountId: string,
    closingDate?: string,
    dueDate?: string,
  ): Promise<ApiResponse<CreditCardStatement>> => {
    if (USE_MOCK)
      return mockStatementHandlers.generate(accountId, closingDate, dueDate);
    return api.post<ApiResponse<CreditCardStatement>>("/statements/generate", {
      accountId,
      closingDate,
      dueDate,
    });
  },

  pay: (
    statementId: string,
    data: PayStatementPayload,
  ): Promise<ApiResponse<CreditCardStatement>> => {
    if (USE_MOCK) return mockStatementHandlers.pay(statementId, data);
    return api.post<ApiResponse<CreditCardStatement>>(
      `/statements/${statementId}/pay`,
      data,
    );
  },
};

