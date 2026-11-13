import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { statementsService } from "@/services/statements.service";
import type { PayStatementPayload } from "@/types";

export const STATEMENTS_KEY = ["statements"];

export function useStatements(accountId?: string) {
  return useQuery({
    queryKey: [...STATEMENTS_KEY, accountId],
    queryFn: () => statementsService.list(accountId),
  });
}

export function useGenerateStatement() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      accountId,
      closingDate,
      dueDate,
    }: {
      accountId: string;
      closingDate?: string;
      dueDate?: string;
    }) => statementsService.generate(accountId, closingDate, dueDate),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: STATEMENTS_KEY });
      queryClient.invalidateQueries({
        queryKey: ["account", variables.accountId],
      });
    },
  });
}

export function usePayStatement() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      statementId,
      data,
    }: {
      statementId: string;
      data: PayStatementPayload;
    }) => statementsService.pay(statementId, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: STATEMENTS_KEY });
      queryClient.invalidateQueries({ queryKey: ["accounts"] });
      queryClient.invalidateQueries({ queryKey: ["transactions"] });
    },
  });
}

