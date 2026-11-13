import { useMemo, useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { router } from "expo-router";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { Card, Typography } from "@/components/ui";
import { useAccounts } from "@/hooks/useAccounts";
import { useRecurringExpenses } from "@/hooks/useRecurringExpenses";
import { useInstallments } from "@/hooks/useInstallments";
import { useAppTheme } from "@/theme/useAppTheme";
import { formatCurrency } from "@/utils/formatters";
import type { Currency } from "@/types";

type FilterType = "all" | "expenses" | "incomes" | "cards";
type ViewMode = "agenda" | "grid";

interface CalendarEvent {
  id: string;
  day: number;
  dateStr: string; // YYYY-MM-DD
  title: string;
  subtitle?: string;
  amount?: number;
  currency?: string;
  type: "income" | "expense" | "card_closing" | "card_due" | "installment";
  color?: string;
  icon?: string;
  accountId?: string;
}

const MONTH_NAMES = [
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

const WEEKDAY_NAMES = ["Dom", "Lun", "Mar", "Mié", "Jue", "Vie", "Sáb"];

export default function CalendarScreen() {
  const { colors } = useAppTheme();

  // Fecha seleccionada (año y mes)
  const now = new Date();
  const [selectedYear, setSelectedYear] = useState(now.getFullYear());
  const [selectedMonth, setSelectedMonth] = useState(now.getMonth()); // 0-indexed
  const [selectedFilter, setSelectedFilter] = useState<FilterType>("all");
  const [viewMode, setViewMode] = useState<ViewMode>("agenda");
  const [selectedGridDay, setSelectedGridDay] = useState<number | null>(now.getDate());

  // Carga de datos
  const { data: accountsData, isLoading: loadingAccounts } = useAccounts();
  const { data: recurringData, isLoading: loadingRecurring } = useRecurringExpenses();
  const { data: installmentsData, isLoading: loadingInstallments } = useInstallments();

  const accounts = useMemo(() => accountsData?.data ?? [], [accountsData]);
  const recurring = useMemo(() => recurringData?.data ?? [], [recurringData]);
  const installments = useMemo(
    () => installmentsData?.data ?? [],
    [installmentsData],
  );

  const isCurrentMonth =
    selectedYear === now.getFullYear() && selectedMonth === now.getMonth();

  // Navegación de mes
  const handlePrevMonth = () => {
    if (selectedMonth === 0) {
      setSelectedMonth(11);
      setSelectedYear((y) => y - 1);
    } else {
      setSelectedMonth((m) => m - 1);
    }
    setSelectedGridDay(null);
  };

  const handleNextMonth = () => {
    if (selectedMonth === 11) {
      setSelectedMonth(0);
      setSelectedYear((y) => y + 1);
    } else {
      setSelectedMonth((m) => m + 1);
    }
    setSelectedGridDay(null);
  };

  const handleGoToday = () => {
    setSelectedYear(now.getFullYear());
    setSelectedMonth(now.getMonth());
    setSelectedGridDay(now.getDate());
  };

  // Días en el mes
  const daysInMonth = new Date(selectedYear, selectedMonth + 1, 0).getDate();
  const firstDayWeekday = new Date(selectedYear, selectedMonth, 1).getDay();

  // Construcción de eventos del mes seleccionado
  const events = useMemo<CalendarEvent[]>(() => {
    const list: CalendarEvent[] = [];
    const monthPadded = String(selectedMonth + 1).padStart(2, "0");

    // 1. Recurrentes (Gastos e Ingresos fijos/variables)
    recurring
      .filter((r) => r.isActive)
      .forEach((r) => {
        const day = Math.min(r.dueDay || 1, daysInMonth);
        const dayPadded = String(day).padStart(2, "0");
        const dateStr = `${selectedYear}-${monthPadded}-${dayPadded}`;
        const isInc = r.type === "income";

        list.push({
          id: `rec-${r.id}`,
          day,
          dateStr,
          title: r.name,
          subtitle: isInc ? "Ingreso recurrente" : "Gasto recurrente",
          amount: r.amount,
          currency: r.currency || "ARS",
          type: isInc ? "income" : "expense",
          color: r.color || (isInc ? "#17b26a" : "#f04438"),
          icon: r.icon || (isInc ? "cash-plus" : "calendar-sync"),
          accountId: r.accountId,
        });
      });

    // 2. Tarjetas de crédito (Cierre y Vencimiento)
    const creditAccounts = accounts.filter((a) => a.type === "credit");
    creditAccounts.forEach((acc) => {
      // Cierre
      if (acc.closingDay) {
        const day = Math.min(acc.closingDay, daysInMonth);
        const dayPadded = String(day).padStart(2, "0");
        const dateStr = `${selectedYear}-${monthPadded}-${dayPadded}`;
        list.push({
          id: `card-close-${acc.id}`,
          day,
          dateStr,
          title: `Cierre: ${acc.name}`,
          subtitle: "Cierre de facturación del período",
          type: "card_closing",
          color: "#f79009",
          icon: "calendar-lock",
          accountId: acc.id,
        });
      }

      // Vencimiento de pago
      if (acc.dueDay) {
        const day = Math.min(acc.dueDay, daysInMonth);
        const dayPadded = String(day).padStart(2, "0");
        const dateStr = `${selectedYear}-${monthPadded}-${dayPadded}`;
        const pendingDebt = Math.abs(acc.balance || 0);

        list.push({
          id: `card-due-${acc.id}`,
          day,
          dateStr,
          title: `Vencimiento: ${acc.name}`,
          subtitle: pendingDebt > 0 ? "Vencimiento para abonar resumen" : "Sin deuda pendiente",
          amount: pendingDebt > 0 ? pendingDebt : undefined,
          currency: acc.currency,
          type: "card_due",
          color: colors.primary[600],
          icon: "credit-card-check",
          accountId: acc.id,
        });
      }
    });

    // 3. Cuotas activas en este mes
    installments
      .filter((plan) => plan.status === "active")
      .forEach((plan) => {
        const acc = accounts.find((a) => a.id === plan.accountId);
        const dueDay = acc?.dueDay ? Math.min(acc.dueDay, daysInMonth) : 10;
        const dayPadded = String(dueDay).padStart(2, "0");
        const dateStr = `${selectedYear}-${monthPadded}-${dayPadded}`;

        // Determinar qué cuota cae en este mes
        const start = new Date(plan.firstDueDate);
        const currentSelectedDate = new Date(selectedYear, selectedMonth, 1);
        const monthsDiff =
          (currentSelectedDate.getFullYear() - start.getFullYear()) * 12 +
          (currentSelectedDate.getMonth() - start.getMonth());

        const currentInstallmentNum = monthsDiff + 1;
        if (
          currentInstallmentNum >= 1 &&
          currentInstallmentNum <= plan.installmentsCount
        ) {
          list.push({
            id: `inst-${plan.id}-${selectedYear}-${selectedMonth}`,
            day: dueDay,
            dateStr,
            title: plan.description,
            subtitle: `Cuota ${currentInstallmentNum}/${plan.installmentsCount} (${acc?.name ?? "Tarjeta"})`,
            amount: plan.installmentAmount,
            currency: acc?.currency || "ARS",
            type: "installment",
            color: "#e23d28",
            icon: "credit-card-clock",
            accountId: plan.accountId,
          });
        }
      });

    // Ordenar cronológicamente por día
    return list.sort((a, b) => a.day - b.day);
  }, [
    recurring,
    accounts,
    installments,
    selectedYear,
    selectedMonth,
    daysInMonth,
    colors.primary,
  ]);

  // Filtrado de eventos
  const filteredEvents = useMemo(() => {
    return events.filter((e) => {
      if (selectedFilter === "expenses") {
        return e.type === "expense" || e.type === "installment";
      }
      if (selectedFilter === "incomes") {
        return e.type === "income";
      }
      if (selectedFilter === "cards") {
        return (
          e.type === "card_closing" ||
          e.type === "card_due" ||
          e.type === "installment"
        );
      }
      return true;
    });
  }, [events, selectedFilter]);

  // Totales previstos del mes (filtrados por moneda principal ARS o de las cuentas)
  const totals = useMemo(() => {
    let income = 0;
    let expense = 0;

    filteredEvents.forEach((e) => {
      if (e.amount && e.amount > 0) {
        if (e.type === "income") {
          income += e.amount;
        } else if (e.type === "expense" || e.type === "installment" || e.type === "card_due") {
          expense += e.amount;
        }
      }
    });

    return { income, expense, balance: income - expense };
  }, [filteredEvents]);

  // Agrupación por día para vista Agenda
  const eventsByDay = useMemo(() => {
    const map = new Map<number, CalendarEvent[]>();
    filteredEvents.forEach((e) => {
      const arr = map.get(e.day) ?? [];
      arr.push(e);
      map.set(e.day, arr);
    });
    return Array.from(map.entries()).sort(([d1], [d2]) => d1 - d2);
  }, [filteredEvents]);

  // Eventos para el día seleccionado en modo Grilla
  const gridSelectedDayEvents = useMemo(() => {
    if (!selectedGridDay) return [];
    return filteredEvents.filter((e) => e.day === selectedGridDay);
  }, [filteredEvents, selectedGridDay]);

  const isLoading = loadingAccounts || loadingRecurring || loadingInstallments;

  return (
    <SafeAreaView edges={["top"]} className="flex-1 bg-surface-900">
      <ScrollView
        contentContainerClassName="px-4 pb-12 pt-2 gap-4"
        showsVerticalScrollIndicator={false}
      >
        {/* ── Encabezado: Título y Navegación de Mes ─────────────── */}
        <View className="gap-3">
          <View className="flex-row items-center justify-between">
            <Typography variant="h1">Calendario</Typography>
            <View className="flex-row items-center gap-1 bg-surface-800 p-1 rounded-2xl border border-surface-600/70">
              <Pressable
                onPress={() => setViewMode("agenda")}
                className={`px-3 py-1.5 rounded-xl flex-row items-center gap-1 ${
                  viewMode === "agenda" ? "bg-primary-600" : ""
                }`}
              >
                <MaterialCommunityIcons
                  name="view-agenda-outline"
                  size={15}
                  color={viewMode === "agenda" ? colors.white : colors.text.secondary}
                />
                <Typography
                  className={`text-xs font-semibold ${
                    viewMode === "agenda" ? "text-white" : "text-text-secondary"
                  }`}
                >
                  Agenda
                </Typography>
              </Pressable>
              <Pressable
                onPress={() => setViewMode("grid")}
                className={`px-3 py-1.5 rounded-xl flex-row items-center gap-1 ${
                  viewMode === "grid" ? "bg-primary-600" : ""
                }`}
              >
                <MaterialCommunityIcons
                  name="calendar-month-outline"
                  size={15}
                  color={viewMode === "grid" ? colors.white : colors.text.secondary}
                />
                <Typography
                  className={`text-xs font-semibold ${
                    viewMode === "grid" ? "text-white" : "text-text-secondary"
                  }`}
                >
                  Mes
                </Typography>
              </Pressable>
            </View>
          </View>

          {/* Selector de Mes con Flechas */}
          <Card className="flex-row items-center justify-between p-2.5">
            <Pressable
              onPress={handlePrevMonth}
              className="w-9 h-9 rounded-xl bg-surface-700 items-center justify-center active:bg-surface-600"
            >
              <MaterialCommunityIcons
                name="chevron-left"
                size={22}
                color={colors.text.primary}
              />
            </Pressable>

            <View className="items-center">
              <Typography variant="h3">
                {MONTH_NAMES[selectedMonth]} {selectedYear}
              </Typography>
              {!isCurrentMonth && (
                <Pressable onPress={handleGoToday}>
                  <Typography
                    variant="caption"
                    className="text-primary-600 font-semibold text-[11px]"
                  >
                    Volver a hoy
                  </Typography>
                </Pressable>
              )}
            </View>

            <Pressable
              onPress={handleNextMonth}
              className="w-9 h-9 rounded-xl bg-surface-700 items-center justify-center active:bg-surface-600"
            >
              <MaterialCommunityIcons
                name="chevron-right"
                size={22}
                color={colors.text.primary}
              />
            </Pressable>
          </Card>
        </View>

        {/* ── Resumen Consolidado del Mes ──────────────────────── */}
        <View className="gap-2.5">
          {/* Ingresos previstos */}
          <Card className="flex-row items-center justify-between p-3.5 bg-success-500/10 border-success-500/20">
            <View className="flex-row items-center gap-3 flex-1 mr-3">
              <View className="w-10 h-10 rounded-xl bg-success-500/15 items-center justify-center shrink-0">
                <MaterialCommunityIcons
                  name="cash-plus"
                  size={20}
                  color="#17b26a"
                />
              </View>
              <View className="flex-1">
                <Typography className="text-sm font-semibold text-success-500">
                  Ingresos previstos
                </Typography>
                <Typography variant="caption" muted className="text-[11px] mt-0.5">
                  Fijos y recurrentes del mes
                </Typography>
              </View>
            </View>
            <Typography
              numberOfLines={1}
              adjustsFontSizeToFit
              className="text-lg font-bold text-success-500 text-right shrink-0"
            >
              +{formatCurrency(totals.income, "ARS")}
            </Typography>
          </Card>

          {/* Gastos y tarjetas */}
          <Card className="flex-row items-center justify-between p-3.5 bg-danger-500/10 border-danger-500/20">
            <View className="flex-row items-center gap-3 flex-1 mr-3">
              <View className="w-10 h-10 rounded-xl bg-danger-500/15 items-center justify-center shrink-0">
                <MaterialCommunityIcons
                  name="calendar-sync"
                  size={20}
                  color="#f04438"
                />
              </View>
              <View className="flex-1">
                <Typography className="text-sm font-semibold text-danger-500">
                  Gastos y tarjetas
                </Typography>
                <Typography variant="caption" muted className="text-[11px] mt-0.5">
                  Recurrentes, cuotas y resúmenes
                </Typography>
              </View>
            </View>
            <Typography
              numberOfLines={1}
              adjustsFontSizeToFit
              className="text-lg font-bold text-danger-500 text-right shrink-0"
            >
              -{formatCurrency(totals.expense, "ARS")}
            </Typography>
          </Card>

          {/* Balance neto */}
          <Card className="flex-row items-center justify-between p-3.5">
            <View className="flex-row items-center gap-3 flex-1 mr-3">
              <View className="w-10 h-10 rounded-xl bg-surface-700 items-center justify-center shrink-0">
                <MaterialCommunityIcons
                  name="scale-balance"
                  size={20}
                  color={colors.primary[500]}
                />
              </View>
              <View className="flex-1">
                <Typography className="text-sm font-semibold text-text-primary">
                  Balance neto previsto
                </Typography>
                <Typography variant="caption" muted className="text-[11px] mt-0.5">
                  {totals.balance >= 0 ? "Superávit estimado" : "Déficit estimado"}
                </Typography>
              </View>
            </View>
            <Typography
              numberOfLines={1}
              adjustsFontSizeToFit
              className={`text-lg font-bold text-right shrink-0 ${
                totals.balance >= 0 ? "text-text-primary" : "text-danger-500"
              }`}
            >
              {totals.balance >= 0 ? "+" : ""}
              {formatCurrency(totals.balance, "ARS")}
            </Typography>
          </Card>
        </View>

        {/* ── Filtros rápidos ─────────────────────────────────── */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerClassName="gap-2 py-1"
        >
          {(
            [
              { key: "all", label: "Todos" },
              { key: "expenses", label: "Gastos" },
              { key: "incomes", label: "Ingresos" },
              { key: "cards", label: "Tarjetas y cuotas" },
            ] as const
          ).map((item) => {
            const isSel = selectedFilter === item.key;
            return (
              <Pressable
                key={item.key}
                onPress={() => setSelectedFilter(item.key)}
                className={`px-3.5 py-1.5 rounded-2xl border ${
                  isSel
                    ? "bg-primary-600 border-primary-600"
                    : "bg-surface-800 border-surface-600/70 active:bg-surface-700"
                }`}
              >
                <Typography
                  className={`text-xs ${
                    isSel ? "font-semibold text-white" : "text-text-secondary"
                  }`}
                >
                  {item.label}
                </Typography>
              </Pressable>
            );
          })}
        </ScrollView>

        {/* ── Vista: Cuadrícula del Mes (Grid) ────────────────── */}
        {viewMode === "grid" && (
          <Card className="p-3 gap-2">
            {/* Cabecera días de la semana */}
            <View className="flex-row items-center justify-between pb-1 border-b border-surface-600/40">
              {WEEKDAY_NAMES.map((d) => (
                <Typography
                  key={d}
                  variant="caption"
                  className="w-10 text-center font-bold text-[11px] text-text-secondary"
                >
                  {d}
                </Typography>
              ))}
            </View>

            {/* Días en cuadrícula */}
            <View className="flex-row flex-wrap">
              {/* Espacios vacíos antes del día 1 */}
              {Array.from({ length: firstDayWeekday }).map((_, i) => (
                <View key={`empty-${i}`} className="w-[14.28%] h-12" />
              ))}

              {/* Días del mes */}
              {Array.from({ length: daysInMonth }).map((_, i) => {
                const day = i + 1;
                const isToday =
                  isCurrentMonth && day === now.getDate();
                const isSelected = selectedGridDay === day;

                const dayEvents = filteredEvents.filter((e) => e.day === day);
                const hasIncome = dayEvents.some((e) => e.type === "income");
                const hasExpense = dayEvents.some(
                  (e) => e.type === "expense" || e.type === "installment",
                );
                const hasCardEvent = dayEvents.some(
                  (e) => e.type === "card_closing" || e.type === "card_due",
                );

                return (
                  <Pressable
                    key={`day-${day}`}
                    onPress={() => setSelectedGridDay(day)}
                    className="w-[14.28%] h-12 items-center justify-center p-0.5"
                  >
                    <View
                      className={`w-9 h-9 items-center justify-center rounded-2xl ${
                        isSelected
                          ? "bg-primary-600"
                          : isToday
                            ? "bg-primary-600/20 border border-primary-600/40"
                            : ""
                      }`}
                    >
                      <Typography
                        className={`text-xs font-semibold ${
                          isSelected
                            ? "text-white"
                            : isToday
                              ? "text-primary-600 font-bold"
                              : "text-text-primary"
                        }`}
                      >
                        {day}
                      </Typography>

                      {/* Puntos de eventos */}
                      <View className="flex-row items-center gap-0.5 mt-0.5">
                        {hasIncome && (
                          <View
                            className={`w-1 h-1 rounded-full ${
                              isSelected ? "bg-white" : "bg-success-500"
                            }`}
                          />
                        )}
                        {hasExpense && (
                          <View
                            className={`w-1 h-1 rounded-full ${
                              isSelected ? "bg-white" : "bg-danger-500"
                            }`}
                          />
                        )}
                        {hasCardEvent && (
                          <View
                            className={`w-1 h-1 rounded-full ${
                              isSelected ? "bg-white" : "bg-warning-500"
                            }`}
                          />
                        )}
                      </View>
                    </View>
                  </Pressable>
                );
              })}
            </View>

            {/* Eventos del día seleccionado en la cuadrícula */}
            {selectedGridDay && (
              <View className="mt-3 pt-3 border-t border-surface-600/50 gap-2">
                <Typography variant="label" className="text-xs">
                  Eventos del día {selectedGridDay} de {MONTH_NAMES[selectedMonth]}
                </Typography>
                {gridSelectedDayEvents.length === 0 ? (
                  <Typography variant="caption" muted className="text-xs py-2">
                    No hay vencimientos programados para este día.
                  </Typography>
                ) : (
                  gridSelectedDayEvents.map((evt) => (
                    <Pressable
                      key={evt.id}
                      onPress={() => {
                        if (evt.accountId) {
                          router.push(`/accounts/${evt.accountId}`);
                        } else {
                          router.push("/recurring");
                        }
                      }}
                    >
                      <Card className="flex-row items-center justify-between p-3">
                        <View className="flex-row items-center gap-2.5 flex-1 mr-2">
                          <View
                            className="w-8 h-8 rounded-xl items-center justify-center shrink-0"
                            style={{ backgroundColor: `${evt.color || colors.primary[500]}20` }}
                          >
                            <MaterialCommunityIcons
                              name={(evt.icon as keyof typeof MaterialCommunityIcons.glyphMap) || "calendar"}
                              size={16}
                              color={evt.color || colors.primary[500]}
                            />
                          </View>
                          <View className="flex-1">
                            <Typography
                              numberOfLines={1}
                              className="font-semibold text-xs text-text-primary"
                            >
                              {evt.title}
                            </Typography>
                            {Boolean(evt.subtitle) && (
                              <Typography variant="caption" muted className="text-[10px]">
                                {evt.subtitle}
                              </Typography>
                            )}
                          </View>
                        </View>
                        {evt.amount !== undefined && (
                          <Typography
                            className={`font-bold text-xs ${
                              evt.type === "income" ? "text-success-500" : "text-danger-500"
                            }`}
                          >
                            {evt.type === "income" ? "+" : "-"}
                            {formatCurrency(evt.amount, (evt.currency as Currency) || "ARS")}
                          </Typography>
                        )}
                      </Card>
                    </Pressable>
                  ))
                )}
              </View>
            )}
          </Card>
        )}

        {/* ── Vista: Agenda / Línea de Tiempo (Timeline) ──────── */}
        {viewMode === "agenda" && (
          <View className="gap-3">
            {isLoading ? (
              <View className="py-8 items-center justify-center">
                <ActivityIndicator color={colors.primary[500]} />
              </View>
            ) : eventsByDay.length === 0 ? (
              <Card className="p-6 items-center justify-center gap-2">
                <MaterialCommunityIcons
                  name="calendar-check-outline"
                  size={36}
                  color={colors.text.muted}
                />
                <Typography className="font-semibold text-sm text-text-primary text-center">
                  Sin vencimientos en este período
                </Typography>
                <Typography variant="caption" muted className="text-center text-xs">
                  No se registraron gastos fijos, ingresos o cuotas con el filtro seleccionado.
                </Typography>
              </Card>
            ) : (
              eventsByDay.map(([day, dayEvents]) => {
                const isToday = isCurrentMonth && day === now.getDate();
                const dayDate = new Date(selectedYear, selectedMonth, day);
                const weekdayName = WEEKDAY_NAMES[dayDate.getDay()];

                return (
                  <View key={`agenda-day-${day}`} className="gap-2">
                    {/* Encabezado del día */}
                    <View className="flex-row items-center gap-2 px-1">
                      <View
                        className={`px-2.5 py-0.5 rounded-full ${
                          isToday ? "bg-primary-600" : "bg-surface-700"
                        }`}
                      >
                        <Typography
                          className={`text-xs font-bold ${
                            isToday ? "text-white" : "text-text-primary"
                          }`}
                        >
                          Día {day} • {weekdayName}
                        </Typography>
                      </View>
                      {isToday && (
                        <Typography
                          variant="caption"
                          className="text-primary-600 font-semibold text-[11px]"
                        >
                          Hoy
                        </Typography>
                      )}
                    </View>

                    {/* Lista de eventos del día */}
                    {dayEvents.map((evt) => (
                      <Pressable
                        key={evt.id}
                        onPress={() => {
                          if (evt.accountId) {
                            router.push(`/accounts/${evt.accountId}`);
                          } else {
                            router.push("/recurring");
                          }
                        }}
                      >
                        <Card className="flex-row items-center justify-between p-3.5">
                          <View className="flex-row items-center gap-3 flex-1 mr-3">
                            <View
                              className="w-10 h-10 rounded-2xl items-center justify-center shrink-0"
                              style={{
                                backgroundColor: `${evt.color || colors.primary[500]}20`,
                              }}
                            >
                              <MaterialCommunityIcons
                                name={
                                  (evt.icon as keyof typeof MaterialCommunityIcons.glyphMap) ||
                                  "calendar"
                                }
                                size={18}
                                color={evt.color || colors.primary[500]}
                              />
                            </View>
                            <View className="flex-1">
                              <Typography
                                numberOfLines={1}
                                className="font-semibold text-sm text-text-primary"
                              >
                                {evt.title}
                              </Typography>
                              {Boolean(evt.subtitle) && (
                                <Typography
                                  variant="caption"
                                  muted
                                  className="text-[11px] mt-0.5"
                                >
                                  {evt.subtitle}
                                </Typography>
                              )}
                            </View>
                          </View>

                          <View className="items-end shrink-0">
                            {evt.amount !== undefined ? (
                              <Typography
                                numberOfLines={1}
                                adjustsFontSizeToFit
                                className={`font-bold text-sm ${
                                  evt.type === "income"
                                    ? "text-success-500"
                                    : "text-danger-500"
                                }`}
                              >
                                {evt.type === "income" ? "+" : "-"}
                                {formatCurrency(evt.amount, (evt.currency as Currency) || "ARS")}
                              </Typography>
                            ) : (
                              <View className="px-2 py-0.5 rounded-full bg-warning-500/15">
                                <Typography className="text-[10px] font-bold text-warning-500">
                                  Informativo
                                </Typography>
                              </View>
                            )}
                          </View>
                        </Card>
                      </Pressable>
                    ))}
                  </View>
                );
              })
            )}
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}
