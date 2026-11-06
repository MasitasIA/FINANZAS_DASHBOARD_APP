import { ActivityIndicator, Pressable, ScrollView, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { router } from "expo-router";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { Button, Card, Typography } from "@/components/ui";
import { AccountCard } from "@/components/accounts/AccountCard";
import { useAccounts } from "@/hooks/useAccounts";
import { useGoals } from "@/hooks/useGoals";
import { formatCurrency } from "@/utils/formatters";
import { colors } from "../../tailwind.config";

export default function AccountsScreen() {
  const { data, isLoading, error, refetch } = useAccounts();
  const { data: goalsData } = useGoals();
  const accounts = data?.data ?? [];
  const goals = goalsData?.data ?? [];

  const bankAccounts = accounts.filter((a) => a.type !== "credit");
  const creditCards = accounts.filter((a) => a.type === "credit");

  const allCurrencies = Array.from(
    new Set([
      ...accounts.map((a) => a.currency),
      ...goals.map((g) => g.currency),
    ]),
  );
  const displayCurrencies =
    allCurrencies.length > 0 ? allCurrencies : ["ARS" as const];

  const summaryByCurrency = displayCurrencies.map((curr) => {
    const currAccounts = accounts.filter((a) => a.currency === curr);
    const currGoals = goals.filter((g) => g.currency === curr);

    const bankBalance = currAccounts
      .filter((a) => a.type !== "credit")
      .reduce((sum, a) => sum + (a.balance > 0 ? a.balance : 0), 0);

    const savedInGoals = currGoals.reduce(
      (sum, g) => sum + (g.currentAmount || 0),
      0,
    );

    // Dinero disponible total: cuentas + lo ahorrado en metas
    const available = bankBalance + savedInGoals;

    // Deuda en tarjetas
    const debt = currAccounts
      .filter((a) => a.type === "credit")
      .reduce((sum, a) => sum + Math.abs(a.balance), 0);

    // Patrimonio neto: cuentas + metas ahorradas - deuda tarjetas
    const accountsNet = currAccounts.reduce((sum, a) => sum + a.balance, 0);
    const net = accountsNet + savedInGoals;

    return {
      currency: curr,
      available,
      bankBalance,
      savedInGoals,
      debt,
      net,
    };
  });

  return (
    <SafeAreaView edges={["top"]} className="flex-1 bg-surface-900">
      {/* ── Header ─────────────────────────────────────────── */}
      <View className="flex-row items-center justify-between px-4 pt-6 pb-4">
        <Typography variant="h1">Cuentas</Typography>
        <View className="flex-row items-center gap-2">
          <Button
            title="Nueva"
            size="sm"
            variant="secondary"
            onPress={() => router.push("/accounts/new")}
          />
          <Pressable
            onPress={() => router.push("/transaction/new")}
            accessibilityLabel="Agregar gasto o ingreso"
            className="w-9 h-9 rounded-full bg-primary-600 items-center justify-center active:opacity-80"
          >
            <MaterialCommunityIcons
              name="plus"
              size={22}
              color={colors.white}
            />
          </Pressable>
        </View>
      </View>

      {/* ── Contenido ──────────────────────────────────────── */}
      {isLoading ? (
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator size="large" color={colors.primary[500]} />
        </View>
      ) : error ? (
        <View className="flex-1 items-center justify-center px-8 gap-4">
          <Typography variant="h3" className="text-center">
            Error al cargar cuentas
          </Typography>
          <Button
            title="Reintentar"
            onPress={() => refetch()}
            variant="secondary"
          />
        </View>
      ) : accounts.length === 0 ? (
        <View className="flex-1 items-center justify-center px-8 gap-3">
          <Typography variant="h3" muted>
            Sin cuentas aún
          </Typography>
          <Typography variant="caption" muted className="text-center">
            Agrega tu primera cuenta o tarjeta para comenzar a registrar tus
            finanzas.
          </Typography>
          <Button
            title="Crear cuenta"
            onPress={() => router.push("/accounts/new")}
            className="mt-2"
          />
        </View>
      ) : (
        <ScrollView
          contentContainerClassName="px-4 pb-12 gap-5"
          showsVerticalScrollIndicator={false}
        >
          {/* ── Resumen por moneda ──────────────────────────────── */}
          {summaryByCurrency.map((item) => (
            <Card key={item.currency} className="p-4 gap-3">
              <View className="flex-row items-center justify-between border-b border-surface-700/60 pb-2">
                <Typography
                  variant="caption"
                  className="font-semibold uppercase tracking-wider text-text-secondary"
                >
                  Resumen {item.currency}
                </Typography>
                <View className="px-2 py-0.5 rounded-full bg-surface-700">
                  <Typography className="text-xs font-bold text-text-primary">
                    {item.currency}
                  </Typography>
                </View>
              </View>

              <View className="flex-row flex-wrap gap-3">
                <View className="flex-1 min-w-[130px] bg-surface-700/50 p-3 rounded-xl">
                  <Typography variant="caption" muted>
                    Disponible
                  </Typography>
                  <Typography
                    numberOfLines={1}
                    adjustsFontSizeToFit
                    className="text-lg font-bold text-success-500 mt-0.5"
                  >
                    {formatCurrency(item.available, item.currency)}
                  </Typography>
                  {item.savedInGoals > 0 && (
                    <Typography variant="caption" muted className="text-[10px] mt-0.5">
                      Cuentas: {formatCurrency(item.bankBalance, item.currency)} • Metas: {formatCurrency(item.savedInGoals, item.currency)}
                    </Typography>
                  )}
                </View>

                <View className="flex-1 min-w-[130px] bg-surface-700/50 p-3 rounded-xl">
                  <Typography variant="caption" muted>
                    Deuda tarjetas
                  </Typography>
                  <Typography
                    numberOfLines={1}
                    adjustsFontSizeToFit
                    className="text-lg font-bold text-warning-500 mt-0.5"
                  >
                    {formatCurrency(item.debt, item.currency)}
                  </Typography>
                </View>
              </View>

              {item.savedInGoals > 0 && (
                <View className="flex-row items-center justify-between bg-surface-700/40 px-3 py-1.5 rounded-xl border border-surface-600/40">
                  <View className="flex-row items-center gap-1.5">
                    <MaterialCommunityIcons
                      name="piggy-bank-outline"
                      size={15}
                      color={colors.primary[500]}
                    />
                    <Typography variant="caption" muted>
                      Ahorrado en metas:
                    </Typography>
                  </View>
                  <Typography className="text-xs font-semibold text-text-primary">
                    +{formatCurrency(item.savedInGoals, item.currency)}
                  </Typography>
                </View>
              )}

              <View className="flex-row items-center justify-between pt-1">
                <View>
                  <Typography variant="caption" muted>
                    Patrimonio neto ({item.currency}):
                  </Typography>
                  {item.savedInGoals > 0 && (
                    <Typography variant="caption" muted className="text-[10px]">
                      (Disponible - Deuda tarjetas)
                    </Typography>
                  )}
                </View>
                <Typography
                  className={`text-lg font-bold ${
                    item.net >= 0 ? "text-text-primary" : "text-danger-500"
                  }`}
                >
                  {formatCurrency(item.net, item.currency)}
                </Typography>
              </View>
            </Card>
          ))}

          {/* ── Tarjetas de Crédito ────────────────────────────── */}
          {creditCards.length > 0 && (
            <View className="gap-3">
              <View className="flex-row items-center justify-between">
                <Typography variant="h2">Tarjetas de Crédito</Typography>
                <Typography variant="caption" muted>
                  {creditCards.length}{" "}
                  {creditCards.length === 1 ? "tarjeta" : "tarjetas"}
                </Typography>
              </View>

              {creditCards.map((card) => (
                <AccountCard
                  key={card.id}
                  account={card}
                  onPress={() => router.push(`/accounts/${card.id}`)}
                />
              ))}
            </View>
          )}

          {/* ── Cuentas y Efectivo ─────────────────────────────── */}
          {bankAccounts.length > 0 && (
            <View className="gap-3">
              <View className="flex-row items-center justify-between">
                <Typography variant="h2">Cuentas y Efectivo</Typography>
                <Typography variant="caption" muted>
                  {bankAccounts.length}{" "}
                  {bankAccounts.length === 1 ? "cuenta" : "cuentas"}
                </Typography>
              </View>

              {bankAccounts.map((account) => (
                <AccountCard
                  key={account.id}
                  account={account}
                  onPress={() => router.push(`/accounts/${account.id}`)}
                />
              ))}
            </View>
          )}
        </ScrollView>
      )}
    </SafeAreaView>
  );
}
