import { useState } from "react";
import {
  ActivityIndicator,
  Modal,
  Pressable,
  ScrollView,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { router } from "expo-router";
import Constants from "expo-constants";
import * as Updates from "expo-updates";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { signOut } from "firebase/auth";
import { Card, Typography } from "@/components/ui";
import { AccountCard } from "@/components/accounts/AccountCard";
import { GoalCard } from "@/components/goals/GoalCard";
import { useAccounts } from "@/hooks/useAccounts";
import { useGoals, useSystemStats } from "@/hooks/useGoals";
import { useRecurringExpenses } from "@/hooks/useRecurringExpenses";
import { auth } from "@/lib/firebase";
import { formatCurrency } from "@/utils/formatters";
import appConfig from "../../app.json";
import { colors } from "../../tailwind.config";

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
  const [showInfoModal, setShowInfoModal] = useState(false);
  const [checkingUpdate, setCheckingUpdate] = useState(false);
  const [updateMessage, setUpdateMessage] = useState<string | null>(null);
  const { data: accountsData, isLoading: loadingAccounts } = useAccounts();
  const { data: goalsData, isLoading: loadingGoals } = useGoals();
  const { data: recurringData, isLoading: loadingRecurring } =
    useRecurringExpenses();
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

  const accounts = accountsData?.data ?? [];
  const goals = goalsData?.data ?? [];
  const recurringExpenses = recurringData?.data ?? [];

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

  const activeCurrencies = Array.from(
    new Set([
      ...Object.keys(balancesByCurrency),
      ...Object.keys(goalsByCurrency),
    ]),
  );
  const displayCurrencies =
    activeCurrencies.length > 0 ? activeCurrencies : ["ARS"];

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
                  displayCurrencies[0] as any,
                )}
              </Typography>
              <Typography variant="caption" muted className="mt-1">
                {goalsByCurrency[displayCurrencies[0]] > 0 &&
                debtByCurrency[displayCurrencies[0]] > 0
                  ? `+${formatCurrency(goalsByCurrency[displayCurrencies[0]], displayCurrencies[0] as any)} en metas • -${formatCurrency(debtByCurrency[displayCurrencies[0]], displayCurrencies[0] as any)} en saldos negativos/deuda`
                  : goalsByCurrency[displayCurrencies[0]] > 0
                    ? `Incluye ${formatCurrency(goalsByCurrency[displayCurrencies[0]], displayCurrencies[0] as any)} en metas de ahorro`
                    : debtByCurrency[displayCurrencies[0]] > 0
                      ? `Resta -${formatCurrency(debtByCurrency[displayCurrencies[0]], displayCurrencies[0] as any)} de saldos negativos/deuda`
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
                      {formatCurrency(bal, curr as any)}
                    </Typography>
                    {(saved > 0 || debt > 0) && (
                      <Typography
                        variant="caption"
                        muted
                        className="text-[10px] mt-0.5"
                      >
                        {saved > 0
                          ? `+${formatCurrency(saved, curr as any)} metas`
                          : ""}
                        {saved > 0 && debt > 0 ? " • " : ""}
                        {debt > 0
                          ? `-${formatCurrency(debt, curr as any)} deuda`
                          : ""}
                      </Typography>
                    )}
                  </View>
                );
              })}
            </View>
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
          ) : accounts.length === 0 ? (
            <Typography variant="caption" muted>
              Aún no tienes cuentas. ¡Agrega una!
            </Typography>
          ) : (
            accounts
              .slice(0, 3)
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
          ) : goals.filter((g) => g.status === "active").length === 0 ? (
            <Typography variant="caption" muted>
              No hay metas activas.
            </Typography>
          ) : (
            goals
              .filter((g) => g.status === "active")
              .slice(0, 2)
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
              onPress={() => router.push("/recurring" as any)}
            >
              Gestionar
            </Typography>
          </View>

          {loadingRecurring ? (
            <ActivityIndicator color={colors.primary[500]} />
          ) : recurringExpenses.filter((r) => r.isActive).length === 0 ? (
            <Pressable onPress={() => router.push("/recurring" as any)}>
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
                .slice(0, 4)
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
                      onPress={() => router.push("/recurring" as any)}
                    >
                      <Card className="flex-row items-center justify-between p-3.5">
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
              <View className="flex-row items-center gap-2.5">
                <View className="w-9 h-9 rounded-2xl bg-primary-600/15 items-center justify-center">
                  <MaterialCommunityIcons
                    name="shield-check-outline"
                    size={20}
                    color={colors.primary[600]}
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
    </SafeAreaView>
  );
}
