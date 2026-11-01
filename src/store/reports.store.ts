import { create } from "zustand";

export type ReportView = "monthly" | "consolidated";
export type ReportCategoryType = "expense" | "income";

interface ReportsState {
  reportView: ReportView;
  categoryType: ReportCategoryType;
  selectedYear: number;
  selectedMonth: number; // 1-12

  setReportView: (view: ReportView) => void;
  setCategoryType: (type: ReportCategoryType) => void;
  setYear: (year: number) => void;
  setMonth: (year: number, month: number) => void;
  prevYear: () => void;
  nextYear: () => void;
  prevMonth: () => void;
  nextMonth: () => void;
}

const now = new Date();

export const useReportsStore = create<ReportsState>((set) => ({
  reportView: "monthly",
  categoryType: "expense",
  selectedYear: now.getFullYear(),
  selectedMonth: now.getMonth() + 1,

  setReportView: (reportView) => set({ reportView }),
  setCategoryType: (categoryType) => set({ categoryType }),
  setYear: (selectedYear) => set({ selectedYear }),
  setMonth: (selectedYear, selectedMonth) =>
    set({ selectedYear, selectedMonth }),

  prevYear: () => set((state) => ({ selectedYear: state.selectedYear - 1 })),
  nextYear: () => set((state) => ({ selectedYear: state.selectedYear + 1 })),

  prevMonth: () =>
    set((state) => {
      if (state.selectedMonth === 1) {
        return { selectedYear: state.selectedYear - 1, selectedMonth: 12 };
      }
      return { selectedMonth: state.selectedMonth - 1 };
    }),

  nextMonth: () =>
    set((state) => {
      if (state.selectedMonth === 12) {
        return { selectedYear: state.selectedYear + 1, selectedMonth: 1 };
      }
      return { selectedMonth: state.selectedMonth + 1 };
    }),
}));
