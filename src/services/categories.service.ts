import { api } from "@/lib/api";
import { mockCategoryHandlers } from "@/lib/mock/handlers";
import type { Category, PaginatedResponse, TransactionType } from "@/types";

const USE_MOCK = process.env.EXPO_PUBLIC_USE_MOCK === "true";

export const categoriesService = {
  list: (type?: TransactionType): Promise<PaginatedResponse<Category>> => {
    if (USE_MOCK) return mockCategoryHandlers.list(type);
    const qs = type ? `?type=${encodeURIComponent(type)}` : "";
    return api.get<PaginatedResponse<Category>>(`/categories${qs}`);
  },
};

