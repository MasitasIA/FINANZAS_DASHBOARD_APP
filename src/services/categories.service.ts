import { api } from "@/lib/api";
import type { Category, PaginatedResponse, TransactionType } from "@/types";

const USE_MOCK = process.env.EXPO_PUBLIC_USE_MOCK === "true";

export const categoriesService = {
  list: async (type?: TransactionType): Promise<PaginatedResponse<Category>> => {
    if (USE_MOCK) {
      const { mockCategoryHandlers } = await import("@/lib/mock/handlers");
      return mockCategoryHandlers.list(type);
    }
    const qs = type ? `?type=${encodeURIComponent(type)}` : "";
    return api.get<PaginatedResponse<Category>>(`/categories${qs}`);
  },
};

