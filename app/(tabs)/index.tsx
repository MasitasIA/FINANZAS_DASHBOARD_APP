import { useMemo, useState } from "react";
import {
  ActivityIndicator,
  Image,
  Modal,
  Pressable,
  ScrollView,
  TextInput,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { router } from "expo-router";
import Constants from "expo-constants";
import * as Updates from "expo-updates";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { signOut } from "firebase/auth";
import { Button, Card, ThemeToggle, Typography } from "@/components/ui";
import { AccountCard } from "@/components/accounts/AccountCard";
import { GoalCard } from "@/components/goals/GoalCard";
import { useAccounts } from "@/hooks/useAccounts";
import { useGoals, useSystemStats } from "@/hooks/useGoals";
import { useRecurringExpenses } from "@/hooks/useRecurringExpenses";
import { useTransactions } from "@/hooks/useTransactions";
import { useBudgets, useSetBudget, useDeleteBudget } from "@/hooks/useBudgets";
import { useCategories } from "@/hooks/useCategories";
import { auth } from "@/lib/firebase";
import { formatCurrency } from "@/utils/formatters";
import type { Currency } from "@/types";
import appConfig from "../../app.json";
import { useAppTheme } from "@/theme/useAppTheme";

function parseTime(dateStr?: string | null): number {
  if (!dateStr) return 0;
  if (dateStr.includes("T")) {
    const t = new Date(dateStr).getTime();
    return isNaN(t) ? 0 : t;
  }
  const iso = `${dateStr.trim().replace(" ", "T")}Z`;
  const t = new Date(iso).getTime();
  if (!isNaN(t)) return t;
  const fallback = new Date(dateStr).getTime();
  return isNaN(fallback) ? 0 : fallback;
}

function formatBytes(bytes: number): string {
  if (!bytes || bytes <= 0) return "0 B";
  const k = 1024;
  const sizes = ["B", "KB", "MB", "GB"];
  const i = Math.min(
    Math.floor(Math.log(bytes) / Math.log(k)),
    sizes.length - 1,
  );
  const val = bytes / Math.pow(k, i);
  return `${val < 10 && i > 0 ? val.toFixed(2) : val.toFixed(1)} ${sizes[i]}`;
}

export default function DashboardScreen() {
  const { colors } = useAppTheme();
  const [showInfoModal, setShowInfoModal] = useState(false);
  const [checkingUpdate, setCheckingUpdate] = useState(false);
  const [updateMessage, setUpdateMessage] = useState<string | null>(null);
  const { data: accountsData, isLoading: loadingAccounts } = useAccounts();
  const { data: goalsData, isLoading: loadingGoals } = useGoals();
  const { data: recurringData, isLoading: loadingRecurring } =
    useRecurringExpenses();
  const { data: transactionsData } = useTransactions({ pageSize: 50 });
  const { data: budgetsData, isLoading: loadingBudgets } = useBudgets();
  const budgets = budgetsData?.data ?? [];
  const { data: categoriesData } = useCategories();
  const allCategories = categoriesData?.data ?? [];
  const expenseCategories = allCategories.filter((c) => c.type === "expense");
  const setBudgetMutation = useSetBudget();
  const deleteBudgetMutation = useDeleteBudget();

  // Modal para agregar o editar presupuesto
  const [showBudgetModal, setShowBudgetModal] = useState(false);
  const [budgetCatId, setBudgetCatId] = useState("");
  const [budgetAmountStr, setBudgetAmountStr] = useState("");

  const { data: statsData, isLoading: loadingStats } =
    useSystemStats(showInfoModal);
  const systemStats = statsData?.data;

  const appName =
    appConfig.expo.name ?? Constants.expoConfig?.name ?? "UNPO: Finanzas";
  const appVersion =
    appConfig.expo.version ?? Constants.expoConfig?.version ?? "1.0.0";
  const otaShortId = Updates.updateId ? Updates.updateId.slice(0, 7) : null;

  async function handleCheckUpdate() {
    if (!Updates.isEnabled) {
      setUpdateMessage(
        "Modo desarrollo (las actualizaciones OTA solo funcionan en el APK instalado).",
      );
      return;
    }
    try {
      setCheckingUpdate(true);
      setUpdateMessage("Buscando nueva versión...");
      const update = await Updates.checkForUpdateAsync();
      if (update.isAvailable) {
        setUpdateMessage("Descargando actualización...");
        await Updates.fetchUpdateAsync();
        setUpdateMessage("Reiniciando con la nueva versión...");
        await Updates.reloadAsync();
      } else {
        setUpdateMessage("Ya tienes la última versión instalada.");
      }
    } catch {
      setUpdateMessage("No se pudo verificar actualizaciones en este momento.");
    } finally {
      setCheckingUpdate(false);
    }
  }

  const accounts = useMemo(
    () => accountsData?.data ?? [],
    [accountsData?.data],
  );
  const goals = useMemo(() => goalsData?.data ?? [], [goalsData?.data]);
  const recurringExpenses = useMemo(
    () => recurringData?.data ?? [],
    [recurringData?.data],
  );
  const transactions = useMemo(
    () => transactionsData?.data ?? [],
    [transactionsData?.data],
  );

  // Cuentas ordenadas por último uso (transacción reciente o fecha de actualización/creación)
  const sortedAccounts = useMemo(() => {
    const accountLastTxMap = transactions.reduce<Record<string, number>>(
      (acc, tx) => {
        const txTime = parseTime(tx.createdAt || tx.date);
        if (tx.accountId) {
          acc[tx.accountId] = Math.max(acc[tx.accountId] ?? 0, txTime);
        }
        if (tx.toAccountId) {
          acc[tx.toAccountId] = Math.max(acc[tx.toAccountId] ?? 0, txTime);
        }
        return acc;
      },
      {},
    );

    return [...accounts].sort((a, b) => {
      const lastUsedA = Math.max(
        parseTime(a.updatedAt),
        parseTime(a.createdAt),
        accountLastTxMap[a.id] ?? 0,
      );
      const lastUsedB = Math.max(
        parseTime(b.updatedAt),
        parseTime(b.createdAt),
        accountLastTxMap[b.id] ?? 0,
      );
      return lastUsedB - lastUsedA;
    });
  }, [accounts, transactions]);

  // Metas activas ordenadas por último uso (transacción/aporte reciente o fecha de actualización/creación)
  const sortedActiveGoals = useMemo(() => {
    const goalLastTxMap = transactions.reduce<Record<string, number>>(
      (acc, tx) => {
        if (tx.goalId) {
          const txTime = parseTime(tx.createdAt || tx.date);
          acc[tx.goalId] = Math.max(acc[tx.goalId] ?? 0, txTime);
        }
        return acc;
      },
      {},
    );

    return goals
      .filter((g) => g.status === "active")
      .sort((a, b) => {
        const lastUsedA = Math.max(
          parseTime(a.updatedAt),
          parseTime(a.createdAt),
          goalLastTxMap[a.id] ?? 0,
        );
        const lastUsedB = Math.max(
          parseTime(b.updatedAt),
          parseTime(b.createdAt),
          goalLastTxMap[b.id] ?? 0,
        );
        return lastUsedB - lastUsedA;
      });
  }, [goals, transactions]);

  // Ahorro acumulado en metas por moneda
  const goalsByCurrency = goals.reduce<Record<string, number>>((acc, g) => {
    const curr = g.currency || "ARS";
    acc[curr] = (acc[curr] ?? 0) + (g.currentAmount || 0);
    return acc;
  }, {});

  // Deuda / saldos negativos acumulados por moneda (tarjetas de crédito + cuentas en negativo)
  const debtByCurrency = accounts.reduce<Record<string, number>>((acc, a) => {
    const curr = a.currency || "ARS";
    const negativeAmount =
      a.type === "credit"
        ? Math.abs(a.balance)
        : a.balance < 0
          ? Math.abs(a.balance)
          : 0;
    acc[curr] = (acc[curr] ?? 0) + negativeAmount;
    return acc;
  }, {});

  // Balances desglosados por moneda (incluye cuentas positivas, resta saldos negativos/tarjetas y suma metas)
  const balancesByCurrency = accounts.reduce<Record<string, number>>(
    (acc, a) => {
      const effectiveBalance =
        a.type === "credit" ? -Math.abs(a.balance) : a.balance;
      acc[a.currency] = (acc[a.currency] ?? 0) + effectiveBalance;
      return acc;
    },
    {},
  );

  goals.forEach((g) => {
    const curr = g.currency || "ARS";
    balancesByCurrency[curr] =
      (balancesByCurrency[curr] ?? 0) + (g.currentAmount || 0);
  });

  const activeCurrencies = useMemo(() => {
    return Array.from(
      new Set([
        ...Object.keys(balancesByCurrency),
        ...Object.keys(goalsByCurrency),
      ]),
    ) as Currency[];
  }, [balancesByCurrency, goalsByCurrency]);

  const displayCurrencies = useMemo<Currency[]>(() => {
    return activeCurrencies.length > 0 ? activeCurrencies : ["ARS"];
  }, [activeCurrencies]);

  // Clasificación de Fondos: Disponible / Reservado / Comprometido
  const fundsClassification = useMemo(() => {
    const today = new Date().toISOString().slice(0, 10);
    const now = new Date();
    const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0)
      .toISOString()
      .slice(0, 10);

    const primaryCurr = displayCurrencies[0] || "ARS";

    // 1. Efectivo positivo en cuentas
    const cash = accounts
      .filter(
        (a) =>
          a.currency === primaryCurr && a.type !== "credit" && a.balance > 0,
      )
      .reduce((sum, a) => sum + a.balance, 0);

    // 2. Reservado en metas de ahorro activas
    const reserved = goals
      .filter(
        (g) => (g.currency || "ARS") === primaryCurr && g.status === "active",
      )
      .reduce((sum, g) => sum + (g.currentAmount || 0), 0);

    // 3. Comprometido: automáticos pendientes del mes + deuda de tarjetas
    const pendingRecurring = recurringExpenses
      .filter(
        (r) =>
          r.isActive &&
          r.type === "expense" &&
          (r.currency || "ARS") === primaryCurr &&
          r.dueDate >= today &&
          r.dueDate <= endOfMonth,
      )
      .reduce((sum, r) => sum + r.amount, 0);

    const creditDebt = accounts
      .filter((a) => a.currency === primaryCurr && a.type === "credit")
      .reduce((sum, a) => sum + Math.abs(a.balance), 0);

    const committed = pendingRecurring + creditDebt;

    // 4. Disponible libre
    const available = Math.max(0, cash - committed);

    return { cash, reserved, committed, available, currency: primaryCurr };
  }, [accounts, goals, recurringExpenses, displayCurrencies]);

  const handleOpenSetBudget = (catId?: string, currentAmount?: number) => {
    const defaultCat = catId || expenseCategories[0]?.id || "";
    setBudgetCatId(defaultCat);
    setBudgetAmountStr(currentAmount ? String(currentAmount) : "");
    setShowBudgetModal(true);
  };

  const handleSaveBudget = () => {
    if (!budgetCatId) return;
    const parsed = parseFloat(budgetAmountStr.replace(",", "."));
    if (isNaN(parsed) || parsed <= 0) return;

    setBudgetMutation.mutate(
      {
        categoryId: budgetCatId,
        currency: displayCurrencies[0] || "ARS",
        amount: parsed,
      },
      {
        onSuccess: () => setShowBudgetModal(false),
      },
    );
  };

  return (
    <SafeAreaView edges={["top"]} className="flex-1 bg-surface-900">
      <ScrollView
        className="flex-1"
        contentContainerClassName="px-4 pb-8"
        showsVerticalScrollIndicator={false}
      >
        {/* ── Header: Multi-Moneda ───────────────────────────── */}
        <View className="pt-6 pb-6">
          {auth.currentUser && (
            <View className="flex-row items-center justify-between mb-4 bg-surface-800 border border-surface-600/60 px-3.5 py-2 rounded-2xl">
              <View className="flex-row items-center gap-2 flex-1 mr-2">
                <MaterialCommunityIcons
                  name="account-circle-outline"
                  size={20}
                  color={colors.primary[600]}
                />
                <Typography
                  variant="caption"
                  numberOfLines={1}
                  className="font-medium text-text-primary flex-1"
                >
                  {auth.currentUser.displayName || auth.currentUser.email}
                </Typography>
              </View>
              <View className="flex-row items-center gap-1.5">
                <ThemeToggle variant="icon" />
                <Pressable
                  onPress={() => setShowInfoModal(true)}
                  accessibilityLabel="Información de la app"
                  className="w-7 h-7 rounded-xl bg-surface-700 items-center justify-center active:bg-surface-600"
                >
                  <MaterialCommunityIcons
                    name="information-outline"
                    size={15}
                    color={colors.text.secondary}
                  />
                </Pressable>
                <Pressable
                  onPress={() => signOut(auth)}
                  className="flex-row items-center gap-1 px-2.5 py-1 rounded-xl bg-surface-700 active:bg-surface-600"
                >
                  <MaterialCommunityIcons
                    name="logout"
                    size={14}
                    color={colors.text.secondary}
                  />
                  <Typography
                    variant="caption"
                    className="font-semibold text-text-secondary"
                  >
                    Salir
                  </Typography>
                </Pressable>
              </View>
            </View>
          )}

          <View className="flex-row items-center justify-between mb-3">
            <Typography
              variant="caption"
              className="font-semibold uppercase tracking-wider text-text-secondary"
            >
              Balance total (Patrimonio)
            </Typography>
            <Pressable
              onPress={() => router.push("/transaction/new")}
              accessibilityLabel="Agregar gasto o ingreso"
              className="w-11 h-11 rounded-full bg-primary-600 items-center justify-center active:opacity-80"
            >
              <MaterialCommunityIcons
                name="plus"
                size={24}
                color={colors.white}
              />
            </Pressable>
          </View>

          {displayCurrencies.length === 1 ? (
            <View>
              <Typography
                numberOfLines={1}
                adjustsFontSizeToFit
                className={`text-4xl font-bold ${
                  (balancesByCurrency[displayCurrencies[0]] ?? 0) >= 0
                    ? "text-text-primary"
                    : "text-danger-500"
                }`}
              >
                {formatCurrency(
                  balancesByCurrency[displayCurrencies[0]] ?? 0,
                  displayCurrencies[0],
                )}
              </Typography>
              <Typography variant="caption" muted className="mt-1">
                {goalsByCurrency[displayCurrencies[0]] > 0 &&
                debtByCurrency[displayCurrencies[0]] > 0
                  ? `+${formatCurrency(goalsByCurrency[displayCurrencies[0]], displayCurrencies[0])} en metas • -${formatCurrency(debtByCurrency[displayCurrencies[0]], displayCurrencies[0])} en saldos negativos/deuda`
                  : goalsByCurrency[displayCurrencies[0]] > 0
                    ? `Incluye ${formatCurrency(goalsByCurrency[displayCurrencies[0]], displayCurrencies[0])} en metas de ahorro`
                    : debtByCurrency[displayCurrencies[0]] > 0
                      ? `Resta -${formatCurrency(debtByCurrency[displayCurrencies[0]], displayCurrencies[0])} de saldos negativos/deuda`
                      : `Moneda: ${displayCurrencies[0]}`}
              </Typography>
            </View>
          ) : (
            <View className="flex-row flex-wrap gap-2.5">
              {displayCurrencies.map((curr) => {
                const bal = balancesByCurrency[curr] ?? 0;
                const saved = goalsByCurrency[curr] ?? 0;
                const debt = debtByCurrency[curr] ?? 0;
                return (
                  <View
                    key={curr}
                    className="flex-1 min-w-[140px] bg-surface-800 border border-surface-600/70 p-3.5 rounded-2xl shadow-sm"
                  >
                    <View className="flex-row items-center justify-between mb-1.5">
                      <Typography
                        variant="caption"
                        muted
                        className="font-semibold"
                      >
                        {curr === "ARS"
                          ? "Pesos"
                          : curr === "USD"
                            ? "Dólares"
                            : "Euros"}
                      </Typography>
                      <View className="px-1.5 py-0.5 rounded bg-surface-700">
                        <Typography className="text-[10px] font-bold text-text-secondary">
                          {curr}
                        </Typography>
                      </View>
                    </View>
                    <Typography
                      numberOfLines={1}
                      adjustsFontSizeToFit
                      className={`text-xl font-bold ${
                        bal >= 0 ? "text-text-primary" : "text-danger-500"
                      }`}
                    >
                      {formatCurrency(bal, curr)}
                    </Typography>
                    {(saved > 0 || debt > 0) && (
                      <Typography
                        variant="caption"
                        muted
                        className="text-[10px] mt-0.5"
                      >
                        {saved > 0
                          ? `+${formatCurrency(saved, curr)} metas`
                          : ""}
                        {saved > 0 && debt > 0 ? " • " : ""}
                        {debt > 0 ? `-${formatCurrency(debt, curr)} deuda` : ""}
                      </Typography>
                    )}
                  </View>
                );
              })}
            </View>
          )}
        </View>

        {/* ── Clasificación de Fondos: Disponible, Reservado, Comprometido ── */}
        <View className="mb-6">
          <View className="flex-row items-center justify-between mb-2">
            <Typography
              variant="label"
              className="text-xs uppercase tracking-wider text-text-secondary"
            >
              Distribución de fondos ({fundsClassification.currency})
            </Typography>
          </View>
          <Card className="p-3 gap-2.5">
            {/* Disponible */}
            <View className="flex-row items-center justify-between bg-success-500/10 p-3 rounded-2xl border border-success-500/20">
              <View className="flex-row items-center gap-3 flex-1 mr-3">
                <View className="w-10 h-10 rounded-xl bg-success-500/15 items-center justify-center shrink-0">
                  <MaterialCommunityIcons
                    name="check-circle-outline"
                    size={20}
                    color="#17b26a"
                  />
                </View>
                <View className="flex-1">
                  <Typography className="text-sm font-semibold text-success-500">
                    Disponible
                  </Typography>
                  <Typography
                    variant="caption"
                    muted
                    className="text-[11px] mt-0.5"
                  >
                    Libre de deudas
                  </Typography>
                </View>
              </View>
              <Typography
                numberOfLines={1}
                adjustsFontSizeToFit
                className="font-bold text-lg text-success-500 text-right shrink-0"
              >
                {formatCurrency(
                  fundsClassification.available,
                  fundsClassification.currency,
                )}
              </Typography>
            </View>

            {/* Reservado */}
            <View className="flex-row items-center justify-between bg-primary-600/10 p-3 rounded-2xl border border-primary-600/20">
              <View className="flex-row items-center gap-3 flex-1 mr-3">
                <View className="w-10 h-10 rounded-xl bg-primary-600/15 items-center justify-center shrink-0">
                  <MaterialCommunityIcons
                    name="piggy-bank-outline"
                    size={20}
                    color={colors.primary[600]}
                  />
                </View>
                <View className="flex-1">
                  <Typography className="text-sm font-semibold text-primary-600">
                    Reservado
                  </Typography>
                  <Typography
                    variant="caption"
                    muted
                    className="text-[11px] mt-0.5"
                  >
                    En metas activas
                  </Typography>
                </View>
              </View>
              <Typography
                numberOfLines={1}
                adjustsFontSizeToFit
                className="font-bold text-lg text-primary-600 text-right shrink-0"
              >
                {formatCurrency(
                  fundsClassification.reserved,
                  fundsClassification.currency,
                )}
              </Typography>
            </View>

            {/* Comprometido */}
            <View className="flex-row items-center justify-between bg-warning-500/10 p-3 rounded-2xl border border-warning-500/20">
              <View className="flex-row items-center gap-3 flex-1 mr-3">
                <View className="w-10 h-10 rounded-xl bg-warning-500/15 items-center justify-center shrink-0">
                  <MaterialCommunityIcons
                    name="clock-alert-outline"
                    size={20}
                    color="#f79009"
                  />
                </View>
                <View className="flex-1">
                  <Typography className="text-sm font-semibold text-warning-500">
                    Comprometido
                  </Typography>
                  <Typography
                    variant="caption"
                    muted
                    className="text-[11px] mt-0.5"
                  >
                    Fijos y tarjetas
                  </Typography>
                </View>
              </View>
              <Typography
                numberOfLines={1}
                adjustsFontSizeToFit
                className="font-bold text-lg text-warning-500 text-right shrink-0"
              >
                {formatCurrency(
                  fundsClassification.committed,
                  fundsClassification.currency,
                )}
              </Typography>
            </View>
          </Card>
        </View>

        {/* ── Presupuestos Mensuales por Categoría ───────────── */}
        <View className="mb-6 gap-3">
          <View className="flex-row items-center justify-between mb-1">
            <View className="flex-row items-center gap-2">
              <Typography variant="h2">Presupuestos del mes</Typography>
            </View>
            <Typography
              variant="caption"
              className="text-primary-600 font-semibold"
              onPress={() => handleOpenSetBudget()}
            >
              + Configurar
            </Typography>
          </View>

          {loadingBudgets ? (
            <ActivityIndicator color={colors.primary[500]} />
          ) : budgets.length === 0 ? (
            <Pressable onPress={() => handleOpenSetBudget()}>
              <Card className="flex-row items-center justify-between p-3.5">
                <View className="flex-row items-center gap-3 flex-1 mr-2">
                  <View className="w-9 h-9 rounded-2xl bg-primary-600/15 items-center justify-center">
                    <MaterialCommunityIcons
                      name="chart-pie"
                      size={18}
                      color={colors.primary[600]}
                    />
                  </View>
                  <View className="flex-1">
                    <Typography className="font-semibold text-sm text-text-primary">
                      Fija límites de gasto mensual
                    </Typography>
                    <Typography variant="caption" muted>
                      Recibe alertas al 80% y 100% de tu presupuesto
                    </Typography>
                  </View>
                </View>
                <MaterialCommunityIcons
                  name="chevron-right"
                  size={20}
                  color={colors.text.muted}
                />
              </Card>
            </Pressable>
          ) : (
            budgets.map((b) => {
              const spent = b.spentAmount ?? 0;
              const limitAmount = b.amount;
              const pct =
                b.percentage ??
                (limitAmount > 0 ? Math.round((spent / limitAmount) * 100) : 0);
              const isDanger = pct >= 100;
              const isWarning = pct >= 80 && pct < 100;

              return (
                <Pressable
                  key={b.id}
                  onPress={() => handleOpenSetBudget(b.categoryId, b.amount)}
                >
                  <Card className="gap-2.5 p-3.5">
                    <View className="flex-row items-center justify-between">
                      <View className="flex-row items-center gap-2.5 flex-1 pr-2">
                        <View
                          className="w-8 h-8 rounded-xl items-center justify-center"
                          style={{
                            backgroundColor: `${b.categoryColor || colors.primary[500]}20`,
                          }}
                        >
                          <MaterialCommunityIcons
                            name={
                              (b.categoryIcon as keyof typeof MaterialCommunityIcons.glyphMap) ||
                              "tag"
                            }
                            size={16}
                            color={b.categoryColor || colors.primary[500]}
                          />
                        </View>
                        <Typography
                          className="font-semibold text-sm text-text-primary flex-1"
                          numberOfLines={1}
                        >
                          {b.categoryName || "Categoría"}
                        </Typography>
                      </View>

                      <View
                        className={`px-2 py-0.5 rounded-full ${
                          isDanger
                            ? "bg-danger-500/15"
                            : isWarning
                              ? "bg-warning-500/15"
                              : "bg-success-500/15"
                        }`}
                      >
                        <Typography
                          className={`text-xs font-bold ${
                            isDanger
                              ? "text-danger-500"
                              : isWarning
                                ? "text-warning-500"
                                : "text-success-500"
                          }`}
                        >
                          {pct}%
                        </Typography>
                      </View>
                    </View>

                    {/* Barra de progreso */}
                    <View className="h-2 bg-surface-700 rounded-full overflow-hidden">
                      <View
                        className={`h-full rounded-full ${
                          isDanger
                            ? "bg-danger-500"
                            : isWarning
                              ? "bg-warning-500"
                              : "bg-success-500"
                        }`}
                        style={{ width: `${Math.min(100, pct)}%` }}
                      />
                    </View>

                    <View className="flex-row justify-between">
                      <Typography
                        variant="caption"
                        muted
                        className="text-[11px]"
                      >
                        Gastado: {formatCurrency(spent, b.currency)}
                      </Typography>
                      <Typography
                        variant="caption"
                        muted
                        className="text-[11px] font-semibold text-text-primary"
                      >
                        Límite: {formatCurrency(limitAmount, b.currency)}
                      </Typography>
                    </View>
                  </Card>
                </Pressable>
              );
            })
          )}
        </View>

        {/* ── Cuentas ────────────────────────────────────────── */}
        <View className="mb-6 gap-3">
          <View className="flex-row items-center justify-between mb-1">
            <Typography variant="h2">Cuentas</Typography>
            <Typography
              variant="caption"
              className="text-primary-600 font-semibold"
              onPress={() => router.push("/(tabs)/accounts")}
            >
              Ver todas
            </Typography>
          </View>

          {loadingAccounts ? (
            <ActivityIndicator color={colors.primary[500]} />
          ) : sortedAccounts.length === 0 ? (
            <Typography variant="caption" muted>
              Aún no tienes cuentas. ¡Agrega una!
            </Typography>
          ) : (
            sortedAccounts
              .slice(0, 5)
              .map((account) => (
                <AccountCard
                  key={account.id}
                  account={account}
                  onPress={() => router.push(`/accounts/${account.id}`)}
                />
              ))
          )}
        </View>

        {/* ── Metas ──────────────────────────────────────────── */}
        <View className="gap-3">
          <View className="flex-row items-center justify-between mb-1">
            <Typography variant="h2">Metas activas</Typography>
            <Typography
              variant="caption"
              className="text-primary-600 font-semibold"
              onPress={() => router.push("/(tabs)/goals")}
            >
              Ver todas
            </Typography>
          </View>

          {loadingGoals ? (
            <ActivityIndicator color={colors.primary[500]} />
          ) : sortedActiveGoals.length === 0 ? (
            <Typography variant="caption" muted>
              No hay metas activas.
            </Typography>
          ) : (
            sortedActiveGoals
              .slice(0, 3)
              .map((goal) => (
                <GoalCard
                  key={goal.id}
                  goal={goal}
                  onPress={() => router.push(`/goals/${goal.id}`)}
                />
              ))
          )}
        </View>

        {/* ── Gastos e Ingresos Automáticos ──────────────────── */}
        <View className="mt-6 gap-3">
          <View className="flex-row items-center justify-between mb-1">
            <View className="flex-row items-center gap-2">
              <Typography variant="h2">Automáticos</Typography>
            </View>
            <Typography
              variant="caption"
              className="text-primary-600 font-semibold"
              onPress={() => router.push("/recurring")}
            >
              Gestionar
            </Typography>
          </View>

          {loadingRecurring ? (
            <ActivityIndicator color={colors.primary[500]} />
          ) : recurringExpenses.filter((r) => r.isActive).length === 0 ? (
            <Pressable onPress={() => router.push("/recurring")}>
              <Card className="flex-row items-center justify-between p-3.5">
                <View className="flex-row items-center gap-3 flex-1 mr-2">
                  <View className="w-9 h-9 rounded-2xl bg-primary-600/15 items-center justify-center">
                    <MaterialCommunityIcons
                      name="calendar-sync"
                      size={18}
                      color={colors.primary[600]}
                    />
                  </View>
                  <View className="flex-1">
                    <Typography className="font-semibold text-sm text-text-primary">
                      Configura tus gastos e ingresos fijos
                    </Typography>
                    <Typography variant="caption" muted>
                      Guarda fecha, monto estimado, nombre y cuenta vinculada
                    </Typography>
                  </View>
                </View>
                <MaterialCommunityIcons
                  name="chevron-right"
                  size={20}
                  color={colors.text.muted}
                />
              </Card>
            </Pressable>
          ) : (
            <>
              {recurringExpenses
                .filter((r) => r.isActive)
                .map((item) => {
                  const linkedAcc = accounts.find(
                    (a) => a.id === item.accountId,
                  );
                  const accName =
                    linkedAcc?.name ?? item.accountName ?? "Cuenta";
                  const accColor =
                    linkedAcc?.color ??
                    item.accountColor ??
                    colors.primary[500];
                  const isIncome = (item.type ?? "expense") === "income";
                  return (
                    <Pressable
                      key={item.id}
                      onPress={() => router.push("/recurring")}
                    >
                      <Card
                        variant={isIncome ? "income" : "expense"}
                        className="flex-row items-center justify-between p-3.5"
                      >
                        <View className="flex-row items-center gap-3 flex-1 mr-3">
                          <View
                            className="w-10 h-10 rounded-2xl items-center justify-center shrink-0"
                            style={{ backgroundColor: `${item.color}20` }}
                          >
                            <MaterialCommunityIcons
                              name={
                                (item.icon as keyof typeof MaterialCommunityIcons.glyphMap) ||
                                (isIncome ? "cash-plus" : "calendar-sync")
                              }
                              size={20}
                              color={item.color || colors.primary[500]}
                            />
                          </View>
                          <View className="flex-1 gap-0.5">
                            <Typography
                              numberOfLines={1}
                              className="font-semibold text-sm text-text-primary"
                            >
                              {item.name}
                            </Typography>
                            <View className="flex-row items-center gap-1.5">
                              <View
                                className="w-2 h-2 rounded-full shrink-0"
                                style={{ backgroundColor: accColor }}
                              />
                              <Typography
                                variant="caption"
                                muted
                                numberOfLines={1}
                                className="flex-1"
                              >
                                {accName}
                              </Typography>
                            </View>
                          </View>
                        </View>

                        <View className="items-end shrink-0">
                          <Typography
                            numberOfLines={1}
                            adjustsFontSizeToFit
                            className={`font-bold text-sm ${
                              isIncome ? "text-success-500" : "text-danger-500"
                            }`}
                          >
                            {isIncome ? "+" : "-"}
                            {formatCurrency(item.amount, item.currency)}
                          </Typography>
                          <Typography
                            variant="caption"
                            muted
                            className="text-[11px] mt-0.5"
                          >
                            Día {item.dueDay} ({item.dueDate})
                          </Typography>
                        </View>
                      </Card>
                    </Pressable>
                  );
                })}
            </>
          )}
        </View>

        {/* ── Pie sutil: Información de la app ───────────────── */}
        <Pressable
          onPress={() => setShowInfoModal(true)}
          className="mt-8 pt-4 border-t border-surface-600/50 flex-row items-center justify-center gap-1.5 active:opacity-70"
        >
          <MaterialCommunityIcons
            name="information-outline"
            size={14}
            color={colors.text.muted}
          />
          <Typography variant="caption" muted className="text-[11px]">
            {appName} v{appVersion} • Información del sistema
          </Typography>
        </Pressable>
      </ScrollView>

      {/* ── Modal: Información de la app y estado de D1 ────── */}
      <Modal
        visible={showInfoModal}
        transparent
        animationType="fade"
        onRequestClose={() => setShowInfoModal(false)}
      >
        <Pressable
          onPress={() => setShowInfoModal(false)}
          className="flex-1 bg-black/50 items-center justify-center px-5"
        >
          <Pressable
            onPress={(e) => e.stopPropagation()}
            className="w-full max-w-sm bg-surface-800 rounded-3xl p-5 border border-surface-600/80 shadow-lg"
          >
            {/* Cabecera del modal */}
            <View className="flex-row items-center justify-between mb-4">
              <View className="flex-row items-center gap-3">
                <View
                  className="w-10 h-10 rounded-xl overflow-hidden shrink-0 relative"
                  style={{
                    width: 40,
                    height: 40,
                    minWidth: 40,
                    minHeight: 40,
                    maxWidth: 40,
                    maxHeight: 40,
                    borderRadius: 10,
                    overflow: "hidden",
                    position: "relative",
                  }}
                >
                  <Image
                    source={require("../../assets/icon.png")}
                    className="w-10 h-10 rounded-xl"
                    style={{
                      width: 40,
                      height: 40,
                      minWidth: 40,
                      minHeight: 40,
                      maxWidth: 40,
                      maxHeight: 40,
                      position: "relative",
                    }}
                    resizeMode="contain"
                  />
                </View>
                <View>
                  <Typography variant="h3">{appName}</Typography>
                  <Typography variant="caption" muted className="text-[11px]">
                    Versión {appVersion}
                    {otaShortId ? ` • OTA #${otaShortId}` : ""}
                  </Typography>
                </View>
              </View>
              <Pressable
                onPress={() => setShowInfoModal(false)}
                className="w-8 h-8 rounded-full bg-surface-700 items-center justify-center active:bg-surface-600"
              >
                <MaterialCommunityIcons
                  name="close"
                  size={16}
                  color={colors.text.secondary}
                />
              </Pressable>
            </View>

            {loadingStats && !systemStats ? (
              <View className="py-6 items-center justify-center gap-2">
                <ActivityIndicator color={colors.primary[600]} />
                <Typography variant="caption" muted>
                  Consultando estado del servidor...
                </Typography>
              </View>
            ) : (
              <View className="gap-3">
                {/* Apariencia: modo oscuro por usuario */}
                <ThemeToggle />

                {/* Tarjeta: Usuarios activos */}
                <View className="flex-row items-center justify-between bg-surface-900 px-3.5 py-3 rounded-2xl border border-surface-600/60">
                  <View className="flex-row items-center gap-2.5">
                    <MaterialCommunityIcons
                      name="account-group-outline"
                      size={18}
                      color={colors.primary[600]}
                    />
                    <Typography variant="body" className="text-sm font-medium">
                      Usuarios registrados
                    </Typography>
                  </View>
                  <Typography variant="h3" className="text-primary-600">
                    {systemStats?.activeUsers ?? 1}
                  </Typography>
                </View>

                {/* Tarjeta: Consumo de Base de Datos (Cloudflare D1) */}
                <View className="bg-surface-900 px-3.5 py-3 rounded-2xl border border-surface-600/60 gap-2">
                  <View className="flex-row items-center justify-between">
                    <View className="flex-row items-center gap-2">
                      <MaterialCommunityIcons
                        name="database-outline"
                        size={18}
                        color={colors.primary[600]}
                      />
                      <Typography
                        variant="body"
                        className="text-sm font-medium"
                      >
                        Base de datos (D1)
                      </Typography>
                    </View>
                    <Typography
                      variant="caption"
                      className="font-semibold text-text-primary"
                    >
                      {formatBytes(systemStats?.dbSizeBytes ?? 0)} /{" "}
                      {formatBytes(
                        systemStats?.dbQuotaBytes ?? 5 * 1024 * 1024 * 1024,
                      )}
                    </Typography>
                  </View>

                  {/* Barra de progreso de cuota de 5 GB */}
                  <View className="h-1.5 w-full bg-surface-600 rounded-full overflow-hidden">
                    <View
                      className="h-full bg-success-500 rounded-full"
                      style={{
                        width: `${Math.max(
                          1.5,
                          Math.min(
                            100,
                            ((systemStats?.dbSizeBytes ?? 0) /
                              (systemStats?.dbQuotaBytes ??
                                5 * 1024 * 1024 * 1024)) *
                              100,
                          ),
                        )}%`,
                      }}
                    />
                  </View>

                  <View className="flex-row items-center justify-between pt-0.5">
                    <Typography variant="caption" muted className="text-[11px]">
                      {systemStats?.totalAccounts ?? accounts.length} cuentas •{" "}
                      {systemStats?.totalTransactions ?? 0} movs •{" "}
                      {systemStats?.totalGoals ?? goals.length} metas
                    </Typography>
                    <Typography
                      variant="caption"
                      className="text-[11px] font-semibold text-success-500"
                    >
                      {(
                        ((systemStats?.dbSizeBytes ?? 0) /
                          (systemStats?.dbQuotaBytes ??
                            5 * 1024 * 1024 * 1024)) *
                        100
                      ).toFixed(4)}
                      %
                    </Typography>
                  </View>
                </View>

                {/* Botón de actualización OTA manual */}
                <Pressable
                  onPress={handleCheckUpdate}
                  disabled={checkingUpdate}
                  className="flex-row items-center justify-center gap-2 bg-surface-700 active:bg-surface-600 px-3.5 py-2.5 rounded-2xl border border-surface-600/60"
                >
                  {checkingUpdate ? (
                    <ActivityIndicator
                      size="small"
                      color={colors.primary[600]}
                    />
                  ) : (
                    <MaterialCommunityIcons
                      name="cloud-download-outline"
                      size={16}
                      color={colors.primary[600]}
                    />
                  )}
                  <Typography
                    variant="caption"
                    className="font-semibold text-text-primary"
                  >
                    {checkingUpdate ? "Verificando..." : "Buscar actualización"}
                  </Typography>
                </Pressable>

                {updateMessage && (
                  <Typography
                    variant="caption"
                    muted
                    className="text-center text-[11px]"
                  >
                    {updateMessage}
                  </Typography>
                )}
              </View>
            )}
          </Pressable>
        </Pressable>
      </Modal>

      {/* ── Modal: Configurar Presupuesto por Categoría ──────── */}
      <Modal
        visible={showBudgetModal}
        transparent
        animationType="fade"
        onRequestClose={() => setShowBudgetModal(false)}
      >
        <Pressable
          onPress={() => setShowBudgetModal(false)}
          className="flex-1 bg-black/50 items-center justify-center px-5"
        >
          <Pressable
            onPress={(e) => e.stopPropagation()}
            className="w-full max-w-sm bg-surface-800 rounded-3xl p-5 border border-surface-600/80 shadow-lg gap-4"
          >
            <View className="flex-row items-center justify-between">
              <View>
                <Typography variant="h3">Presupuesto mensual</Typography>
                <Typography variant="caption" muted className="text-xs">
                  Establece un límite de gasto para este mes
                </Typography>
              </View>
              <Pressable
                onPress={() => setShowBudgetModal(false)}
                className="w-8 h-8 rounded-full bg-surface-700 items-center justify-center active:bg-surface-600"
              >
                <MaterialCommunityIcons
                  name="close"
                  size={16}
                  color={colors.text.secondary}
                />
              </Pressable>
            </View>

            {/* Categorías */}
            <View className="gap-1.5">
              <Typography variant="label" className="text-xs">
                Selecciona categoría
              </Typography>
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerClassName="gap-2 py-1"
              >
                {expenseCategories.map((cat) => {
                  const isSel = budgetCatId === cat.id;
                  return (
                    <Pressable
                      key={cat.id}
                      onPress={() => {
                        setBudgetCatId(cat.id);
                        const existing = budgets.find(
                          (b) => b.categoryId === cat.id,
                        );
                        if (existing) {
                          setBudgetAmountStr(String(existing.amount));
                        }
                      }}
                      className={`flex-row items-center px-3 py-2 rounded-2xl gap-2 border ${
                        isSel
                          ? "bg-primary-600 border-primary-600"
                          : "bg-surface-700/60 border-transparent active:bg-surface-600"
                      }`}
                    >
                      <MaterialCommunityIcons
                        name={
                          (cat.icon as keyof typeof MaterialCommunityIcons.glyphMap) ||
                          "tag"
                        }
                        size={14}
                        color={isSel ? colors.white : cat.color}
                      />
                      <Typography
                        className={`text-xs ${
                          isSel
                            ? "font-semibold text-white"
                            : "text-text-primary"
                        }`}
                      >
                        {cat.name}
                      </Typography>
                    </Pressable>
                  );
                })}
              </ScrollView>
            </View>

            {/* Importe Límite */}
            <View className="gap-1.5">
              <Typography variant="label" className="text-xs">
                Monto límite mensual ({displayCurrencies[0] || "ARS"})
              </Typography>
              <TextInput
                value={budgetAmountStr}
                onChangeText={setBudgetAmountStr}
                placeholder="0,00"
                placeholderTextColor={colors.text.muted}
                keyboardType="decimal-pad"
                className="bg-surface-700/60 p-3 rounded-2xl text-text-primary text-xl font-bold"
                style={{ fontFamily: "Inter_700Bold" }}
              />
            </View>

            {/* Botones de acción */}
            <View className="gap-2 pt-2">
              <Button
                title={
                  budgets.some((b) => b.categoryId === budgetCatId)
                    ? "Actualizar presupuesto"
                    : "Guardar presupuesto"
                }
                onPress={handleSaveBudget}
                loading={setBudgetMutation.isPending}
                disabled={
                  !budgetCatId ||
                  !budgetAmountStr ||
                  isNaN(parseFloat(budgetAmountStr.replace(",", "."))) ||
                  parseFloat(budgetAmountStr.replace(",", ".")) <= 0
                }
              />

              {Boolean(budgets.find((b) => b.categoryId === budgetCatId)) && (
                <Button
                  title="Eliminar presupuesto"
                  variant="danger"
                  onPress={() => {
                    const existing = budgets.find(
                      (b) => b.categoryId === budgetCatId,
                    );
                    if (existing) {
                      deleteBudgetMutation.mutate(existing.id, {
                        onSuccess: () => setShowBudgetModal(false),
                      });
                    }
                  }}
                  loading={deleteBudgetMutation.isPending}
                />
              )}
            </View>
          </Pressable>
        </Pressable>
      </Modal>
    </SafeAreaView>
  );
}
