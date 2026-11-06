import React from "react";
import {
  ActivityIndicator,
  Pressable,
  RefreshControl,
  ScrollView,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { router } from "expo-router";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { Button, Card, PieChart, Typography } from "@/components/ui";
import type { PieChartDataItem } from "@/components/ui/PieChart";
import { useAnnualReport, useMonthlyReport } from "@/hooks/useGoals";
import { useReportsStore } from "@/store/reports.store";
import type { CategorySummary } from "@/types";
import { formatCurrency } from "@/utils/formatters";
import { colors } from "../../tailwind.config";

const MONTHS = [
  "Enero",
  "Febrero",
  "Marzo",
  "Abril",
  "Mayo",
  "Junio",
  "Julio",
  "Agosto",
  "Septiembre",
  "Octubre",
  "Noviembre",
  "Diciembre",
];

export default function ReportsScreen() {
  const {
    reportView,
    categoryType,
    selectedYear,
    selectedMonth,
    setReportView,
    setCategoryType,
    prevMonth,
    nextMonth,
    prevYear,
    nextYear,
  } = useReportsStore();

  // Queries para mensual y consolidado anual
  const monthlyQuery = useMonthlyReport();
  const annualQuery = useAnnualReport();

  const isMonthly = reportView === "monthly";
  const activeQuery = isMonthly ? monthlyQuery : annualQuery;
  const isLoading = activeQuery.isLoading;
  const isRefetching = activeQuery.isRefetching;

  const monthlyReport = monthlyQuery.data?.data;
  const annualReport = annualQuery.data?.data;

  const currentReport = isMonthly ? monthlyReport : annualReport;

  // Manejo de categorías según el tipo seleccionado (gastos o ingresos)
  const expenseCategories: CategorySummary[] =
    currentReport?.byExpenseCategory ??
    (isMonthly ? monthlyReport?.byCategory ?? [] : []);

  const incomeCategories: CategorySummary[] =
    currentReport?.byIncomeCategory ?? [];

  const activeCategories =
    categoryType === "expense" ? expenseCategories : incomeCategories;

  const totalIncome = currentReport?.totalIncome ?? 0;
  const totalExpenses = currentReport?.totalExpenses ?? 0;
  const netBalance = currentReport?.netBalance ?? 0;

  // Datos formateados para el gráfico de torta / dona
  const pieChartData: PieChartDataItem[] = activeCategories.map((c) => ({
    id: c.categoryId,
    label: c.categoryName,
    value: c.total,
    color: c.categoryColor || colors.accent.slate,
    icon: c.categoryIcon,
    percentage: c.percentage,
  }));

  const onRefresh = () => {
    if (isMonthly) {
      void monthlyQuery.refetch();
    } else {
      void annualQuery.refetch();
    }
  };

  return (
    <SafeAreaView edges={["top"]} className="flex-1 bg-surface-900">
      <ScrollView
        className="flex-1"
        contentContainerClassName="px-4 pb-10"
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={isRefetching}
            onRefresh={onRefresh}
            tintColor={colors.primary[500]}
          />
        }
      >
        {/* ── Header con Título y Navegación Temporal ───────────────── */}
        <View className="flex-row items-center justify-between pt-6 pb-4">
          <View>
            <Typography variant="h1">Reportes</Typography>
            <Typography variant="caption" className="mt-0.5">
              {isMonthly ? "Resumen mensual detallado" : "Consolidado anual integral"}
            </Typography>
          </View>

          {/* Selector de Fecha (Mes/Año o Solo Año) */}
          <View className="flex-row items-center bg-surface-800 border border-surface-600/70 rounded-2xl p-1 gap-0.5 shadow-sm">
            <Pressable
              onPress={isMonthly ? prevMonth : prevYear}
              accessibilityLabel={isMonthly ? "Mes anterior" : "Año anterior"}
              className="w-8 h-8 rounded-xl items-center justify-center active:bg-surface-700"
            >
              <MaterialCommunityIcons
                name="chevron-left"
                size={20}
                color={colors.text.primary}
              />
            </Pressable>

            <Typography className="px-2 font-semibold text-xs text-text-primary">
              {isMonthly
                ? `${MONTHS[selectedMonth - 1]} ${selectedYear}`
                : `${selectedYear}`}
            </Typography>

            <Pressable
              onPress={isMonthly ? nextMonth : nextYear}
              accessibilityLabel={isMonthly ? "Mes siguiente" : "Año siguiente"}
              className="w-8 h-8 rounded-xl items-center justify-center active:bg-surface-700"
            >
              <MaterialCommunityIcons
                name="chevron-right"
                size={20}
                color={colors.text.primary}
              />
            </Pressable>
          </View>
        </View>

        {/* ── Segmented Control: Mensual vs Consolidado Anual ──────── */}
        <View className="flex-row bg-surface-700/80 p-1 rounded-2xl mb-4 border border-surface-600/40">
          <Pressable
            onPress={() => setReportView("monthly")}
            className={`flex-1 py-2 rounded-xl items-center justify-center flex-row gap-1.5 ${
              isMonthly ? "bg-surface-800 shadow-sm" : ""
            }`}
          >
            <MaterialCommunityIcons
              name="calendar-month-outline"
              size={15}
              color={isMonthly ? colors.primary[500] : colors.text.muted}
            />
            <Typography
              className={`text-xs font-semibold ${
                isMonthly ? "text-text-primary" : "text-text-muted"
              }`}
            >
              Mensual
            </Typography>
          </Pressable>

          <Pressable
            onPress={() => setReportView("consolidated")}
            className={`flex-1 py-2 rounded-xl items-center justify-center flex-row gap-1.5 ${
              !isMonthly ? "bg-surface-800 shadow-sm" : ""
            }`}
          >
            <MaterialCommunityIcons
              name="chart-box-outline"
              size={15}
              color={!isMonthly ? colors.primary[500] : colors.text.muted}
            />
            <Typography
              className={`text-xs font-semibold ${
                !isMonthly ? "text-text-primary" : "text-text-muted"
              }`}
            >
              Consolidado
            </Typography>
          </Pressable>
        </View>

        {isLoading ? (
          <View className="py-20 items-center justify-center">
            <ActivityIndicator size="large" color={colors.primary[500]} />
            <Typography variant="caption" muted className="mt-3">
              Cargando estadísticas...
            </Typography>
          </View>
        ) : !currentReport ? (
          <Typography variant="caption" muted className="text-center py-16">
            Sin datos para este período.
          </Typography>
        ) : (
          <>
            {/* ── Tarjetas Resumen (Totales) ─────────────────────────── */}
            <View className="flex-row flex-wrap gap-3 mb-3">
              <Card className="flex-1 min-w-[140px] items-center gap-1 p-3.5">
                <Typography variant="label" numberOfLines={1}>
                  {isMonthly ? "Ingresos del mes" : "Ingresos anuales"}
                </Typography>
                <Typography
                  numberOfLines={1}
                  adjustsFontSizeToFit
                  className="text-success-500 font-bold text-lg"
                >
                  +{formatCurrency(totalIncome)}
                </Typography>
              </Card>

              <Card className="flex-1 min-w-[140px] items-center gap-1 p-3.5">
                <Typography variant="label" numberOfLines={1}>
                  {isMonthly ? "Gastos del mes" : "Gastos anuales"}
                </Typography>
                <Typography
                  numberOfLines={1}
                  adjustsFontSizeToFit
                  className="text-danger-500 font-bold text-lg"
                >
                  -{formatCurrency(totalExpenses)}
                </Typography>
              </Card>
            </View>

            {/* Balance Neto */}
            <Card className="items-center gap-1 mb-4 p-4">
              <Typography variant="label">
                {isMonthly ? "Balance neto mensual" : "Balance neto anual"}
              </Typography>
              <Typography
                numberOfLines={1}
                adjustsFontSizeToFit
                className={`font-bold text-3xl ${
                  netBalance >= 0 ? "text-success-500" : "text-danger-500"
                }`}
              >
                {netBalance >= 0 ? "+" : ""}
                {formatCurrency(netBalance)}
              </Typography>
              <Typography variant="caption" muted>
                {netBalance >= 0
                  ? isMonthly
                    ? "Superávit neto en el mes"
                    : "Superávit financiero en el año"
                  : isMonthly
                    ? "Gastos superiores a ingresos este mes"
                    : "Déficit anual (gastos superan ingresos)"}
              </Typography>
            </Card>

            {/* ── Switcher de Rubros: Gastos vs Ingresos ────────────── */}
            <View className="flex-row items-center justify-between mt-2 mb-3">
              <Typography variant="h2">Rubros y distribución</Typography>

              <View className="flex-row bg-surface-800 border border-surface-600/70 p-0.5 rounded-xl">
                <Pressable
                  onPress={() => setCategoryType("expense")}
                  className={`px-3 py-1 rounded-lg flex-row items-center gap-1.5 ${
                    categoryType === "expense" ? "bg-danger-500/10" : ""
                  }`}
                >
                  <View className="w-2 h-2 rounded-full bg-danger-500" />
                  <Typography
                    className={`text-xs font-semibold ${
                      categoryType === "expense"
                        ? "text-danger-500"
                        : "text-text-muted"
                    }`}
                  >
                    Gastos
                  </Typography>
                </Pressable>

                <Pressable
                  onPress={() => setCategoryType("income")}
                  className={`px-3 py-1 rounded-lg flex-row items-center gap-1.5 ${
                    categoryType === "income" ? "bg-success-500/10" : ""
                  }`}
                >
                  <View className="w-2 h-2 rounded-full bg-success-500" />
                  <Typography
                    className={`text-xs font-semibold ${
                      categoryType === "income"
                        ? "text-success-500"
                        : "text-text-muted"
                    }`}
                  >
                    Ingresos
                  </Typography>
                </Pressable>
              </View>
            </View>

            {/* ── Gráfico de Torta / Dona ───────────────────────────── */}
            {activeCategories.length > 0 ? (
              <Card className="p-4 items-center mb-5">
                <View className="flex-row items-center justify-between w-full mb-2">
                  <Typography variant="label">
                    {categoryType === "expense"
                      ? isMonthly
                        ? "Torta de gastos del mes"
                        : "Torta de gastos anuales"
                      : isMonthly
                        ? "Torta de ingresos del mes"
                        : "Torta de ingresos anuales"}
                  </Typography>
                  <Typography variant="caption" muted>
                    Toca para inspeccionar
                  </Typography>
                </View>

                <PieChart
                  data={pieChartData}
                  size={210}
                  centerTitle={categoryType === "expense" ? "Total gastos" : "Total ingresos"}
                  centerSubtitle={formatCurrency(
                    categoryType === "expense" ? totalExpenses : totalIncome
                  )}
                  allowToggleMode={true}
                />
              </Card>
            ) : null}

            {/* ── Lista Detallada de Rubros ─────────────────────────── */}
            {activeCategories.length > 0 ? (
              <View className="gap-3 mb-6">
                <View className="flex-row items-center justify-between">
                  <Typography variant="label">
                    Ranking de {categoryType === "expense" ? "gastos" : "ingresos"}
                  </Typography>
                  <Typography variant="caption" muted>
                    {activeCategories.length}{" "}
                    {activeCategories.length === 1 ? "rubro" : "rubros"}
                  </Typography>
                </View>

                {activeCategories.map((cat) => (
                  <Card key={cat.categoryId} className="gap-2.5 p-3.5">
                    <View className="flex-row items-center justify-between">
                      <View className="flex-row items-center gap-2.5 flex-1 mr-2">
                        <View
                          className="w-8 h-8 rounded-xl items-center justify-center"
                          style={{ backgroundColor: `${cat.categoryColor}25` }}
                        >
                          <MaterialCommunityIcons
                            name={
                              (cat.categoryIcon as keyof typeof MaterialCommunityIcons.glyphMap) ||
                              (categoryType === "expense" ? "tag" : "cash")
                            }
                            size={18}
                            color={cat.categoryColor}
                          />
                        </View>
                        <View className="flex-1">
                          <Typography className="font-semibold text-text-primary text-sm">
                            {cat.categoryName}
                          </Typography>
                          <Typography variant="caption" muted>
                            {cat.transactionCount}{" "}
                            {cat.transactionCount === 1
                              ? "movimiento"
                              : "movimientos"}
                          </Typography>
                        </View>
                      </View>

                      <View className="items-end">
                        <Typography className="font-bold text-sm text-text-primary">
                          {formatCurrency(cat.total)}
                        </Typography>
                        <Typography variant="caption" className="font-medium">
                          {cat.percentage.toFixed(1)}%
                        </Typography>
                      </View>
                    </View>

                    {/* Barra visual de porcentaje proporcional */}
                    <View className="h-1.5 bg-surface-700 rounded-full overflow-hidden">
                      <View
                        className="h-full rounded-full"
                        style={{
                          width: `${Math.min(100, Math.max(3, cat.percentage))}%`,
                          backgroundColor: cat.categoryColor,
                        }}
                      />
                    </View>
                  </Card>
                ))}
              </View>
            ) : (
              <Card className="items-center py-8 px-4 gap-2.5 mb-6">
                <MaterialCommunityIcons
                  name="chart-pie"
                  size={42}
                  color={colors.text.muted}
                />
                <Typography variant="body" className="font-semibold text-center">
                  Sin {categoryType === "expense" ? "gastos" : "ingresos"}{" "}
                  registrados en{" "}
                  {isMonthly
                    ? `${MONTHS[selectedMonth - 1]} ${selectedYear}`
                    : `${selectedYear}`}
                </Typography>
                <Typography variant="caption" muted className="text-center">
                  Registra transacciones para visualizar gráficos de torta y
                  estadísticas detalladas aquí.
                </Typography>
                <Button
                  title="+ Registrar transacción"
                  size="sm"
                  variant="secondary"
                  className="mt-2"
                  onPress={() => router.push("/transaction/new")}
                />
              </Card>
            )}

            {/* ── Desglose Mensual (Solo en Vista Consolidado Anual) ─── */}
            {!isMonthly &&
              annualReport?.monthlyBreakdown &&
              annualReport.monthlyBreakdown.some((m) => m.income > 0 || m.expense > 0) && (
                <View className="gap-3 mt-2">
                  <View className="flex-row items-center justify-between">
                    <Typography variant="h2">Evolución mes a mes</Typography>
                    <Typography variant="caption" muted>
                      Año {selectedYear}
                    </Typography>
                  </View>

                  <Card className="p-3.5 gap-3">
                    {annualReport.monthlyBreakdown
                      .filter((m) => m.income > 0 || m.expense > 0)
                      .map((m) => (
                        <View
                          key={m.month}
                          className="flex-row items-center justify-between py-1.5 border-b border-surface-600/30 last:border-b-0"
                        >
                          <View className="w-12">
                            <Typography className="font-bold text-sm text-text-primary">
                              {m.monthName}
                            </Typography>
                          </View>

                          <View className="flex-1 flex-row justify-around px-2">
                            <Typography className="text-xs text-success-500 font-medium">
                              +{formatCurrency(m.income)}
                            </Typography>
                            <Typography className="text-xs text-danger-500 font-medium">
                              -{formatCurrency(m.expense)}
                            </Typography>
                          </View>

                          <View className="items-end min-w-[70px]">
                            <Typography
                              className={`text-xs font-bold ${
                                m.net >= 0 ? "text-success-500" : "text-danger-500"
                              }`}
                            >
                              {m.net >= 0 ? "+" : ""}
                              {formatCurrency(m.net)}
                            </Typography>
                          </View>
                        </View>
                      ))}
                  </Card>
                </View>
              )}
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}
