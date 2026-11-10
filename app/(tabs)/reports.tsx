import React, { useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  RefreshControl,
  ScrollView,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import Svg, {
  Circle,
  Defs,
  Line,
  LinearGradient,
  Path,
  Stop,
} from "react-native-svg";
import { router } from "expo-router";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { Button, Card, PieChart, Typography } from "@/components/ui";
import type { PieChartDataItem } from "@/components/ui/PieChart";
import { useAccounts } from "@/hooks/useAccounts";
import { useAnnualReport, useGoals, useMonthlyReport } from "@/hooks/useGoals";
import {
  type ProjectionScenario,
  useReportsStore,
} from "@/store/reports.store";
import type { CategorySummary } from "@/types";
import { formatCurrency } from "@/utils/formatters";
import { useAppTheme } from "@/theme/useAppTheme";

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
  const { colors } = useAppTheme();
  const {
    reportView,
    categoryType,
    projectionScenario,
    selectedYear,
    selectedMonth,
    setReportView,
    setCategoryType,
    setProjectionScenario,
    prevMonth,
    nextMonth,
    prevYear,
    nextYear,
  } = useReportsStore();

  const [selectedHorizonIdx, setSelectedHorizonIdx] = useState<number>(4); // Por defecto +12 meses

  // Queries para mensual, consolidado anual, cuentas y metas (para proyección)
  const monthlyQuery = useMonthlyReport();
  const annualQuery = useAnnualReport();
  const { data: accountsData } = useAccounts();
  const { data: goalsData } = useGoals();

  const isMonthly = reportView === "monthly";
  const isConsolidated = reportView === "consolidated";
  const isProjection = reportView === "projection";

  const activeQuery = isMonthly ? monthlyQuery : annualQuery;
  const isLoading = activeQuery.isLoading;
  const isRefetching = activeQuery.isRefetching;

  const monthlyReport = monthlyQuery.data?.data;
  const annualReport = annualQuery.data?.data;
  const accounts = accountsData?.data ?? [];
  const goals = goalsData?.data ?? [];

  const currentReport = isMonthly ? monthlyReport : annualReport;

  // ── Cálculos de Proyección Financiera ───────────────────────────────────────
  // 1. Patrimonio inicial actual (Cuentas con saldos negativos descontados + Metas en ARS)
  const currentNetWorth =
    accounts
      .filter((a) => (a.currency || "ARS") === "ARS")
      .reduce(
        (sum, a) =>
          sum + (a.type === "credit" ? -Math.abs(a.balance) : a.balance),
        0,
      ) +
    goals
      .filter((g) => (g.currency || "ARS") === "ARS")
      .reduce((sum, g) => sum + (g.currentAmount || 0), 0);

  // 2. Meses con actividad real en el año seleccionado para calcular el promedio mensual
  const activeMonths =
    annualReport?.monthlyBreakdown?.filter(
      (m) => m.income > 0 || m.expense > 0,
    ) ?? [];
  const monthsCount = Math.max(1, activeMonths.length);

  const baseAvgMonthlyIncome =
    activeMonths.length > 0
      ? activeMonths.reduce((sum, m) => sum + m.income, 0) / monthsCount
      : (monthlyReport?.totalIncome ?? 0);

  const baseAvgMonthlyExpense =
    activeMonths.length > 0
      ? activeMonths.reduce((sum, m) => sum + m.expense, 0) / monthsCount
      : (monthlyReport?.totalExpenses ?? 0);

  // 3. Ajuste según escenario seleccionado (Realista / Optimista -15% gastos / Conservador +15% gastos)
  const expenseMultiplier =
    projectionScenario === "optimistic"
      ? 0.85
      : projectionScenario === "conservative"
        ? 1.15
        : 1.0;

  const projectedMonthlyIncome = baseAvgMonthlyIncome;
  const projectedMonthlyExpense = baseAvgMonthlyExpense * expenseMultiplier;
  const projectedMonthlyNet = projectedMonthlyIncome - projectedMonthlyExpense;
  const savingsRatePercent =
    projectedMonthlyIncome > 0
      ? ((projectedMonthlyIncome - projectedMonthlyExpense) /
          projectedMonthlyIncome) *
        100
      : 0;

  // 4. Puntos de la curva de proyección (Hoy, +3m, +6m, +9m, +12m)
  const projectionPoints = [0, 3, 6, 9, 12].map((monthsAhead) => ({
    monthsAhead,
    label: monthsAhead === 0 ? "Hoy" : `+${monthsAhead}m`,
    balance: currentNetWorth + projectedMonthlyNet * monthsAhead,
    delta: projectedMonthlyNet * monthsAhead,
  }));

  // Dimensiones del gráfico SVG de proyección
  const chartWidth = 300;
  const chartHeight = 140;
  const padX = 24;
  const padY = 22;
  const minVal = Math.min(...projectionPoints.map((p) => p.balance));
  const maxVal = Math.max(...projectionPoints.map((p) => p.balance));
  const valRange = maxVal - minVal === 0 ? 1 : maxVal - minVal;

  const svgCoords = projectionPoints.map((pt, idx) => {
    const x =
      padX +
      (idx / (projectionPoints.length - 1)) * (chartWidth - padX * 2);
    const normalizedY =
      maxVal === minVal ? 0.5 : (pt.balance - minVal) / valRange;
    const y = chartHeight - padY - normalizedY * (chartHeight - padY * 2);
    return { ...pt, x, y, idx };
  });

  const linePath = svgCoords
    .map((pt, idx) => `${idx === 0 ? "M" : "L"} ${pt.x.toFixed(1)} ${pt.y.toFixed(1)}`)
    .join(" ");

  const areaPath = `${linePath} L ${svgCoords[svgCoords.length - 1].x.toFixed(1)} ${(chartHeight - padY + 8).toFixed(1)} L ${svgCoords[0].x.toFixed(1)} ${(chartHeight - padY + 8).toFixed(1)} Z`;

  const selectedPoint = svgCoords[selectedHorizonIdx] ?? svgCoords[4];
  const trendColor =
    projectedMonthlyNet >= 0 ? colors.success[500] : colors.danger[500];

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
          <View className="flex-1 mr-2">
            <Typography variant="h1">Reportes</Typography>
            <Typography variant="caption" className="mt-0.5">
              {isMonthly
                ? "Resumen mensual detallado"
                : isConsolidated
                  ? "Consolidado anual integral"
                  : `Proyección futura (base ${activeMonths.length || 1} ${activeMonths.length === 1 ? "mes" : "meses"})`}
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

        {/* ── Segmented Control: Mensual vs Consolidado vs Proyección ── */}
        <View className="flex-row bg-surface-700/80 p-1 rounded-2xl mb-4 border border-surface-600/40">
          <Pressable
            onPress={() => setReportView("monthly")}
            className={`flex-1 py-2 rounded-xl items-center justify-center flex-row gap-1 ${
              isMonthly ? "bg-surface-800 shadow-sm" : ""
            }`}
          >
            <MaterialCommunityIcons
              name="calendar-month-outline"
              size={14}
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
            className={`flex-1 py-2 rounded-xl items-center justify-center flex-row gap-1 ${
              isConsolidated ? "bg-surface-800 shadow-sm" : ""
            }`}
          >
            <MaterialCommunityIcons
              name="chart-box-outline"
              size={14}
              color={isConsolidated ? colors.primary[500] : colors.text.muted}
            />
            <Typography
              className={`text-xs font-semibold ${
                isConsolidated ? "text-text-primary" : "text-text-muted"
              }`}
            >
              Consolidado
            </Typography>
          </Pressable>

          <Pressable
            onPress={() => setReportView("projection")}
            className={`flex-1 py-2 rounded-xl items-center justify-center flex-row gap-1 ${
              isProjection ? "bg-surface-800 shadow-sm" : ""
            }`}
          >
            <MaterialCommunityIcons
              name="trending-up"
              size={15}
              color={isProjection ? colors.primary[500] : colors.text.muted}
            />
            <Typography
              className={`text-xs font-semibold ${
                isProjection ? "text-text-primary" : "text-text-muted"
              }`}
            >
              Proyección
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
        ) : isProjection ? (
          <View className="gap-4">
            {/* ── Selector de Escenario de Proyección ─────────────────── */}
            <View className="flex-row gap-2">
              {(
                [
                  {
                    id: "realistic",
                    label: "Ritmo actual",
                    sub: "Promedio real",
                    icon: "scale-balance",
                  },
                  {
                    id: "optimistic",
                    label: "Ahorrador",
                    sub: "-15% gastos",
                    icon: "rocket-launch-outline",
                  },
                  {
                    id: "conservative",
                    label: "Prudente",
                    sub: "+15% gastos",
                    icon: "shield-outline",
                  },
                ] as {
                  id: ProjectionScenario;
                  label: string;
                  sub: string;
                  icon: keyof typeof MaterialCommunityIcons.glyphMap;
                }[]
              ).map((scen) => {
                const active = projectionScenario === scen.id;
                return (
                  <Pressable
                    key={scen.id}
                    onPress={() => setProjectionScenario(scen.id)}
                    className={`flex-1 p-2.5 rounded-2xl border items-center gap-0.5 ${
                      active
                        ? "bg-primary-600/10 border-primary-600"
                        : "bg-surface-800 border-surface-600/70"
                    }`}
                  >
                    <MaterialCommunityIcons
                      name={scen.icon}
                      size={16}
                      color={
                        active ? colors.primary[600] : colors.text.secondary
                      }
                    />
                    <Typography
                      className={`text-xs font-bold ${
                        active ? "text-primary-600" : "text-text-primary"
                      }`}
                    >
                      {scen.label}
                    </Typography>
                    <Typography variant="caption" muted className="text-[10px]">
                      {scen.sub}
                    </Typography>
                  </Pressable>
                );
              })}
            </View>

            {/* ── Tarjeta Principal: Gráfico SVG de Trayectoria a 12 Meses ── */}
            <Card className="p-4 gap-3">
              <View className="flex-row items-center justify-between">
                <View className="flex-1 mr-2">
                  <Typography variant="label">
                    Patrimonio estimado ({selectedPoint.label})
                  </Typography>
                  <Typography
                    numberOfLines={1}
                    adjustsFontSizeToFit
                    className="text-3xl font-bold text-text-primary mt-0.5"
                  >
                    {formatCurrency(selectedPoint.balance)}
                  </Typography>
                </View>

                <View
                  className={`px-2.5 py-1 rounded-xl ${
                    selectedPoint.delta >= 0
                      ? "bg-success-500/15"
                      : "bg-danger-500/15"
                  }`}
                >
                  <Typography
                    className={`text-xs font-bold ${
                      selectedPoint.delta >= 0
                        ? "text-success-500"
                        : "text-danger-500"
                    }`}
                  >
                    {selectedPoint.delta >= 0 ? "+" : ""}
                    {formatCurrency(selectedPoint.delta)}
                  </Typography>
                </View>
              </View>

              {/* Curva SVG Interactiva */}
              <View className="items-center my-1">
                <Svg
                  width="100%"
                  height={chartHeight}
                  viewBox={`0 0 ${chartWidth} ${chartHeight}`}
                >
                  <Defs>
                    <LinearGradient id="projGrad" x1="0" y1="0" x2="0" y2="1">
                      <Stop
                        offset="0%"
                        stopColor={trendColor}
                        stopOpacity="0.28"
                      />
                      <Stop
                        offset="100%"
                        stopColor={trendColor}
                        stopOpacity="0.0"
                      />
                    </LinearGradient>
                  </Defs>

                  {/* Líneas guía horizontales */}
                  {[0.2, 0.5, 0.8].map((ratio, i) => (
                    <Line
                      key={i}
                      x1={padX}
                      y1={chartHeight * ratio}
                      x2={chartWidth - padX}
                      y2={chartHeight * ratio}
                      stroke={colors.surface[600]}
                      strokeDasharray="3 3"
                      strokeWidth={1}
                    />
                  ))}

                  {/* Área sombreada bajo la curva */}
                  <Path d={areaPath} fill="url(#projGrad)" />

                  {/* Línea principal de tendencia */}
                  <Path
                    d={linePath}
                    fill="none"
                    stroke={trendColor}
                    strokeWidth={3}
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />

                  {/* Línea vertical del punto seleccionado */}
                  <Line
                    x1={selectedPoint.x}
                    y1={padY - 6}
                    x2={selectedPoint.x}
                    y2={chartHeight - padY + 8}
                    stroke={colors.primary[500]}
                    strokeDasharray="2 2"
                    strokeWidth={1.2}
                  />

                  {/* Puntos de control */}
                  {svgCoords.map((pt) => {
                    const isSelected = pt.idx === selectedHorizonIdx;
                    return (
                      <Circle
                        key={pt.monthsAhead}
                        cx={pt.x}
                        cy={pt.y}
                        r={isSelected ? 6.5 : 4.5}
                        fill={isSelected ? colors.primary[600] : colors.white}
                        stroke={
                          isSelected ? colors.white : trendColor
                        }
                        strokeWidth={2.5}
                      />
                    );
                  })}
                </Svg>

                {/* Botones táctiles para cada horizonte debajo del gráfico */}
                <View className="flex-row justify-between w-full px-1 mt-1">
                  {svgCoords.map((pt) => {
                    const isSelected = pt.idx === selectedHorizonIdx;
                    return (
                      <Pressable
                        key={pt.monthsAhead}
                        onPress={() => setSelectedHorizonIdx(pt.idx)}
                        className={`px-2.5 py-1 rounded-xl ${
                          isSelected ? "bg-primary-600" : "bg-surface-700"
                        }`}
                      >
                        <Typography
                          className={`text-[11px] font-bold ${
                            isSelected ? "text-white" : "text-text-secondary"
                          }`}
                        >
                          {pt.label}
                        </Typography>
                      </Pressable>
                    );
                  })}
                </View>
              </View>
            </Card>

            {/* ── Promedios Mensuales y Tasa de Ahorro ────────────────── */}
            <Card className="p-4 gap-3">
              <View className="flex-row items-center justify-between">
                <Typography variant="label">
                  Flujo mensual promedio proyectado
                </Typography>
                <View
                  className={`px-2 py-0.5 rounded-lg ${
                    savingsRatePercent >= 20
                      ? "bg-success-500/15"
                      : savingsRatePercent > 0
                        ? "bg-warning-500/15"
                        : "bg-danger-500/15"
                  }`}
                >
                  <Typography
                    className={`text-[11px] font-bold ${
                      savingsRatePercent >= 20
                        ? "text-success-500"
                        : savingsRatePercent > 0
                          ? "text-warning-500"
                          : "text-danger-500"
                    }`}
                  >
                    Tasa de ahorro: {savingsRatePercent.toFixed(1)}%
                  </Typography>
                </View>
              </View>

              <View className="flex-row flex-wrap gap-2.5">
                <View className="flex-1 min-w-[125px] bg-surface-900 p-3 rounded-2xl border border-surface-600/60">
                  <Typography variant="caption" muted className="text-[11px]">
                    Ingreso mensual prom.
                  </Typography>
                  <Typography
                    numberOfLines={1}
                    adjustsFontSizeToFit
                    className="text-base font-bold text-success-500 mt-0.5"
                  >
                    +{formatCurrency(projectedMonthlyIncome)}
                  </Typography>
                </View>

                <View className="flex-1 min-w-[125px] bg-surface-900 p-3 rounded-2xl border border-surface-600/60">
                  <Typography variant="caption" muted className="text-[11px]">
                    Gasto mensual prom.
                  </Typography>
                  <Typography
                    numberOfLines={1}
                    adjustsFontSizeToFit
                    className="text-base font-bold text-danger-500 mt-0.5"
                  >
                    -{formatCurrency(projectedMonthlyExpense)}
                  </Typography>
                </View>
              </View>

              {/* Barra comparativa Ingresos vs Gastos */}
              <View className="gap-1">
                <View className="flex-row justify-between">
                  <Typography variant="caption" muted className="text-[11px]">
                    Capacidad de ahorro mensual neta
                  </Typography>
                  <Typography
                    className={`text-xs font-bold ${
                      projectedMonthlyNet >= 0
                        ? "text-success-500"
                        : "text-danger-500"
                    }`}
                  >
                    {projectedMonthlyNet >= 0 ? "+" : ""}
                    {formatCurrency(projectedMonthlyNet)} / mes
                  </Typography>
                </View>
                <View className="h-2 bg-surface-700 rounded-full overflow-hidden flex-row">
                  <View
                    className="h-full bg-danger-500"
                    style={{
                      width: `${
                        projectedMonthlyIncome > 0
                          ? Math.min(
                              100,
                              (projectedMonthlyExpense /
                                projectedMonthlyIncome) *
                                100,
                            )
                          : 100
                      }%`,
                    }}
                  />
                  <View className="flex-1 h-full bg-success-500" />
                </View>
              </View>
            </Card>

            {/* ── Hitos de Patrimonio en el Futuro (3m, 6m, 1 año, 2 años) ── */}
            <View className="gap-2.5">
              <Typography variant="h2">Hitos de patrimonio</Typography>
              <View className="flex-row flex-wrap gap-3">
                {[
                  { months: 3, title: "En 3 meses", icon: "calendar-clock" },
                  { months: 6, title: "En 6 meses", icon: "calendar-range" },
                  { months: 12, title: "En 1 año", icon: "calendar-star" },
                  { months: 24, title: "En 2 años", icon: "trophy-outline" },
                ].map((milestone) => {
                  const estTotal =
                    currentNetWorth + projectedMonthlyNet * milestone.months;
                  const estDelta = projectedMonthlyNet * milestone.months;
                  return (
                    <Card
                      key={milestone.months}
                      className="flex-1 min-w-[145px] p-3.5 gap-1"
                    >
                      <View className="flex-row items-center justify-between">
                        <Typography variant="label">
                          {milestone.title}
                        </Typography>
                        <MaterialCommunityIcons
                          name={
                            milestone.icon as keyof typeof MaterialCommunityIcons.glyphMap
                          }
                          size={15}
                          color={colors.primary[500]}
                        />
                      </View>
                      <Typography
                        numberOfLines={1}
                        adjustsFontSizeToFit
                        className="text-lg font-bold text-text-primary mt-0.5"
                      >
                        {formatCurrency(estTotal)}
                      </Typography>
                      <Typography
                        variant="caption"
                        className={`text-[11px] font-semibold ${
                          estDelta >= 0 ? "text-success-500" : "text-danger-500"
                        }`}
                      >
                        {estDelta >= 0 ? "+" : ""}
                        {formatCurrency(estDelta)} acumulados
                      </Typography>
                    </Card>
                  );
                })}
              </View>
            </View>

            {/* ── Tiempo estimado para alcanzar tus Metas Activas ──────── */}
            {goals.filter((g) => g.status === "active").length > 0 && (
              <View className="gap-2.5">
                <Typography variant="h2">
                  Proyección de tus metas activas
                </Typography>
                <Card className="p-3.5 gap-3">
                  {goals
                    .filter((g) => g.status === "active")
                    .map((goal) => {
                      const remaining = Math.max(
                        0,
                        goal.targetAmount - goal.currentAmount,
                      );
                      const monthsToComplete =
                        remaining <= 0
                          ? 0
                          : projectedMonthlyNet > 0
                            ? Math.ceil(remaining / projectedMonthlyNet)
                            : null;
                      return (
                        <View
                          key={goal.id}
                          className="flex-row items-center justify-between py-1.5 border-b border-surface-600/30 last:border-b-0"
                        >
                          <View className="flex-1 mr-2">
                            <Typography className="font-semibold text-sm text-text-primary">
                              {goal.name}
                            </Typography>
                            <Typography variant="caption" muted>
                              Faltan{" "}
                              {formatCurrency(
                                remaining,
                                goal.currency as any,
                              )}
                            </Typography>
                          </View>
                          <View className="items-end">
                            <Typography
                              className={`text-xs font-bold ${
                                monthsToComplete !== null
                                  ? "text-success-500"
                                  : "text-warning-500"
                              }`}
                            >
                              {monthsToComplete === 0
                                ? "¡Completada!"
                                : monthsToComplete !== null
                                  ? `~${monthsToComplete} ${monthsToComplete === 1 ? "mes" : "meses"}`
                                  : "Requiere superávit"}
                            </Typography>
                            <Typography
                              variant="caption"
                              muted
                              className="text-[10px]"
                            >
                              a tu ritmo mensual
                            </Typography>
                          </View>
                        </View>
                      );
                    })}
                </Card>
              </View>
            )}
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
