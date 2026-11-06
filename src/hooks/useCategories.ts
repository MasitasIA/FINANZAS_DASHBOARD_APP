import { useQuery } from "@tanstack/react-query";
import { categoriesService } from "@/services/categories.service";
import type { TransactionType } from "@/types";

export const categoryKeys = {
  all: () => ["categories"] as const,
  lists: (type?: TransactionType) =>
    [...categoryKeys.all(), "list", type] as const,
};

export function useCategories(type?: TransactionType) {
  return useQuery({
    queryKey: categoryKeys.lists(type),
    queryFn: () => categoriesService.list(type),
    staleTime: 1000 * 60 * 5,
  });
}

