import { ActivityIndicator, Pressable, ScrollView, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { router } from "expo-router";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { signOut } from "firebase/auth";
import { Typography } from "@/components/ui";
import { AccountCard } from "@/components/accounts/AccountCard";
import { GoalCard } from "@/components/goals/GoalCard";
import { useAccounts } from "@/hooks/useAccounts";
import { useGoals } from "@/hooks/useGoals";
import { auth } from "@/lib/firebase";
import { formatCurrency } from "@/utils/formatters";
import { colors } from "../../tailwind.config";

export default function DashboardScreen() {
  const { data: accountsData, isLoading: loadingAccounts } = useAccounts();
  const { data: goalsData, isLoading: loadingGoals } = useGoals();

  const accounts = accountsData?.data ?? [];
  const goals = goalsData?.data ?? [];

  // Ahorro acumulado en metas por moneda
  const goalsByCurrency = goals.reduce<Record<string, number>>((acc, g) => {
    const curr = g.currency || "ARS";
    acc[curr] = (acc[curr] ?? 0) + (g.currentAmount || 0);
    return acc;
  }, {});

  // Balances desglosados por moneda (incluye cuentas + metas ahorradas)
  const balancesByCurrency = accounts.reduce<Record<string, number>>(
    (acc, a) => {
      acc[a.currency] = (acc[a.currency] ?? 0) + a.balance;
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
                className="text-4xl font-bold text-text-primary"
              >
                {formatCurrency(
                  balancesByCurrency[displayCurrencies[0]] ?? 0,
                  displayCurrencies[0] as any,
                )}
              </Typography>
              <Typography variant="caption" muted className="mt-1">
                {goalsByCurrency[displayCurrencies[0]] > 0
                  ? `Incluye ${formatCurrency(goalsByCurrency[displayCurrencies[0]], displayCurrencies[0] as any)} en metas de ahorro`
                  : `Moneda: ${displayCurrencies[0]}`}
              </Typography>
            </View>
          ) : (
            <View className="flex-row flex-wrap gap-2.5">
              {displayCurrencies.map((curr) => {
                const bal = balancesByCurrency[curr] ?? 0;
                const saved = goalsByCurrency[curr] ?? 0;
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
                    {saved > 0 && (
                      <Typography
                        variant="caption"
                        muted
                        className="text-[10px] mt-0.5"
                      >
                        +{formatCurrency(saved, curr as any)} en metas
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
      </ScrollView>
    </SafeAreaView>
  );
}
