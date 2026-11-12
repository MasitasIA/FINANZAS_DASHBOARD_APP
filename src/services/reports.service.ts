import { api } from "@/lib/api";
import type {
  AnnualReport,
  ApiResponse,
  MonthlyReport,
  SystemStats,
} from "@/types";

const USE_MOCK = process.env.EXPO_PUBLIC_USE_MOCK === "true";
const getMock = () => import("@/lib/mock/handlers");

export const reportsService = {
  monthly: async (
    year: number,
    month: number,
  ): Promise<ApiResponse<MonthlyReport>> => {
    if (USE_MOCK) return (await getMock()).mockReportHandlers.monthly(year, month);
    return api.get<ApiResponse<MonthlyReport>>(
      `/reports/monthly?year=${year}&month=${month}`,
    );
  },

  annual: async (year: number): Promise<ApiResponse<AnnualReport>> => {
    if (USE_MOCK) return (await getMock()).mockReportHandlers.annual(year);
    return api.get<ApiResponse<AnnualReport>>(`/reports/annual?year=${year}`);
  },

  stats: async (): Promise<ApiResponse<SystemStats>> => {
    if (USE_MOCK) return (await getMock()).mockReportHandlers.stats();
    return api.get<ApiResponse<SystemStats>>("/stats");
  },
};

export const statsService = {
  get: () => reportsService.stats(),
};

