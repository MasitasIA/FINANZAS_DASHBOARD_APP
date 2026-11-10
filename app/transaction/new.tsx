import { useState } from "react";
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  TextInput,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { router, useLocalSearchParams } from "expo-router";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { Button, Card, Typography } from "@/components/ui";
import { useCreateTransaction } from "@/hooks/useTransactions";
import { useAccounts } from "@/hooks/useAccounts";
import { useGoals } from "@/hooks/useGoals";
import { useCategories } from "@/hooks/useCategories";
import type { TransactionType, Currency } from "@/types";
import { colors } from "../../tailwind.config";

export default function NewTransactionScreen() {
  const params = useLocalSearchParams<{
    type?: TransactionType;
    accountId?: string;
    toAccountId?: string;
  }>();
  const initialType: TransactionType = params.type ?? "expense";
  const [type, setType] = useState<TransactionType>(initialType);
  const [amount, setAmount] = useState("");
  const [selectedCategoryId, setSelectedCategoryId] = useState<string | null>(
    null,
  );
  const [detail, setDetail] = useState("");
  const [selectedAccountId, setSelectedAccountId] = useState<string | null>(
    params.accountId ?? null,
  );
  const [selectedGoalId, setSelectedGoalId] = useState<string | null>(null);
  const [selectedToAccountId, setSelectedToAccountId] = useState<string | null>(
    params.toAccountId ?? null,
  );

  const { data: accountsData } = useAccounts();
  const accounts = accountsData?.data ?? [];

  const { data: goalsData } = useGoals();
  const activeGoals = (goalsData?.data ?? []).filter(
    (g) => g.status === "active",
  );

  const { data: categoriesData, isLoading: loadingCategories } =
    useCategories();
  const allCategories = categoriesData?.data ?? [];

  const isTransfer = type === "transfer";
  const isDirectGoalIncome = type === "income" && Boolean(selectedGoalId);
  const selectedGoal = activeGoals.find((g) => g.id === selectedGoalId);

  // Origen sugerido
  const defaultOrigin =
    accounts.find(
      (a) =>
        a.id !== (selectedToAccountId ?? params.toAccountId) &&
        a.type !== "credit",
    ) ?? accounts[0];
  const activeAccountId = isDirectGoalIncome
    ? "direct-goal"
    : (selectedAccountId ?? defaultOrigin?.id ?? null);

  // Moneda de la cuenta o meta seleccionada
  const originAccount = accounts.find((a) => a.id === activeAccountId);
  const activeCurrency: Currency = isDirectGoalIncome
    ? (selectedGoal?.currency ?? "ARS")
    : (originAccount?.currency ?? "ARS");

  // Destino sugerido para transferencia
  const defaultDestination = accounts.find((a) => a.id !== activeAccountId);
  const activeToAccountId =
    selectedToAccountId ?? params.toAccountId ?? defaultDestination?.id ?? null;

  const { mutate, isPending } = useCreateTransaction();

  const toAccount = accounts.find((a) => a.id === activeToAccountId);
  const currentCategories = allCategories.filter(
    (c) => c.type === type && c.id !== "cat-savings",
  );
  const selectedCat =
    currentCategories.find((c) => c.id === selectedCategoryId) ??
    currentCategories[0];

  const handleTypeChange = (newType: TransactionType) => {
    setType(newType);
    if (newType !== "income") {
      setSelectedGoalId(null);
    }
    const firstCat = allCategories.find(
      (c) => c.type === newType && c.id !== "cat-savings",
    );
    setSelectedCategoryId(firstCat?.id ?? null);
  };

  const parsedAmount = parseFloat(amount.replace(",", "."));
  const isSubmitDisabled =
    !amount ||
    isNaN(parsedAmount) ||
    parsedAmount <= 0 ||
    (!activeAccountId && !isDirectGoalIncome) ||
    !selectedCat ||
    (isTransfer &&
      (!activeToAccountId || activeToAccountId === activeAccountId));

  const handleSubmit = () => {
    if (isSubmitDisabled || !selectedCat || !activeAccountId) return;

    const categoryName =
      selectedCat.name ?? (isTransfer ? "Transferencia" : "Transacción");
    const trimmedDetail = detail.trim();
    const finalDescription = isDirectGoalIncome && selectedGoal
      ? trimmedDetail
        ? `${categoryName} - ${trimmedDetail} (Meta: ${selectedGoal.name})`
        : `Ingreso directo a meta: ${selectedGoal.name}`
      : trimmedDetail
        ? `${categoryName} - ${trimmedDetail}`
        : categoryName;

    mutate(
      {
        type,
        amount: parsedAmount,
        description: finalDescription,
        note: trimmedDetail || undefined,
        accountId: isDirectGoalIncome ? "direct-goal" : activeAccountId,
        goalId: isDirectGoalIncome && selectedGoal ? selectedGoal.id : undefined,
        toAccountId: isTransfer ? (activeToAccountId ?? undefined) : undefined,
        categoryId: selectedCat.id,
        currency: activeCurrency,
        date: new Date().toISOString(),
      },
      {
        onSuccess: () => router.back(),
      },
    );
  };

  return (
    <SafeAreaView edges={["bottom"]} className="flex-1 bg-surface-900">
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        className="flex-1"
      >
        <ScrollView
          contentContainerClassName="px-4 py-6 gap-5"
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          {/* ── Tipo ─────────────────────────────────────────── */}
          <View className="flex-row gap-2">
            {(["expense", "income", "transfer"] as TransactionType[]).map(
              (t) => (
                <Pressable
                  key={t}
                  onPress={() => handleTypeChange(t)}
                  className={`flex-1 py-2.5 rounded-2xl items-center ${
                    type === t ? "bg-primary-600" : "bg-surface-700"
                  }`}
                >
                  <Typography
                    className={`font-medium capitalize ${
                      type === t ? "text-white" : "text-text-secondary"
                    }`}
                  >
                    {t === "expense"
                      ? "Gasto"
                      : t === "income"
                        ? "Ingreso"
                        : "Transfer."}
                  </Typography>
                </Pressable>
              ),
            )}
          </View>

          {/* ── Importe ─────────────────────────────────────── */}
          <Card>
            <View className="flex-row items-center justify-between mb-2">
              <Typography variant="label">
                Importe ({activeCurrency})
              </Typography>
              <View className="px-2 py-0.5 rounded bg-surface-700">
                <Typography className="text-xs font-bold text-text-secondary">
                  {activeCurrency}
                </Typography>
              </View>
            </View>
            <TextInput
              value={amount}
              onChangeText={setAmount}
              placeholder="0,00"
              placeholderTextColor={colors.text.muted}
              keyboardType="decimal-pad"
              className="text-3xl font-bold text-text-primary"
              style={{ fontFamily: "Inter_700Bold" }}
            />
          </Card>

          {/* ── Categoría descriptiva ───────────────────────── */}
          <Card className="gap-3">
            <View className="flex-row items-center justify-between">
              <Typography variant="label">Categoría</Typography>
              <Typography
                variant="caption"
                className="font-semibold text-primary-600"
              >
                {selectedCat?.name ?? ""}
              </Typography>
            </View>

            {loadingCategories ? (
              <View className="py-4 items-center">
                <ActivityIndicator color={colors.primary[500]} />
              </View>
            ) : (
              <View className="flex-row flex-wrap gap-2">
                {currentCategories.map((cat) => {
                  const isSelected = selectedCat?.id === cat.id;
                  return (
                    <Pressable
                      key={cat.id}
                      onPress={() => setSelectedCategoryId(cat.id)}
                      className={`flex-row items-center px-3 py-2 rounded-2xl gap-2 border ${
                        isSelected
                          ? "bg-primary-50 border-primary-600"
                          : "bg-surface-700/60 border-transparent active:bg-surface-600"
                      }`}
                    >
                      <View
                        className="w-6 h-6 rounded-lg items-center justify-center"
                        style={{
                          backgroundColor: isSelected
                            ? cat.color
                            : cat.color + "25",
                        }}
                      >
                        <MaterialCommunityIcons
                          name={
                            (cat.icon as keyof typeof MaterialCommunityIcons.glyphMap) ||
                            "tag"
                          }
                          size={14}
                          color={isSelected ? colors.white : cat.color}
                        />
                      </View>
                      <Typography
                        className={`text-sm ${
                          isSelected
                            ? "font-semibold text-primary-700"
                            : "text-text-primary"
                        }`}
                      >
                        {cat.name}
                      </Typography>
                    </Pressable>
                  );
                })}
              </View>
            )}
          </Card>

          {/* ── Detalle adicional (opcional) ─────────────────── */}
          <Card>
            <Typography variant="label" className="mb-2">
              Detalle adicional (opcional)
            </Typography>
            <TextInput
              value={detail}
              onChangeText={setDetail}
              placeholder={
                isTransfer
                  ? `Ej: Pago de tarjeta ${toAccount?.name ?? ""}`
                  : type === "expense"
                    ? "Ej: Supermercado, Almuerzo, Factura..."
                    : "Ej: Sueldo mensual, Bono, Depósito..."
              }
              placeholderTextColor={colors.text.muted}
              className="text-base text-text-primary"
              style={{ fontFamily: "Inter_400Regular" }}
            />
          </Card>

          {/* ── Selección de cuentas ──────────────────────────── */}
          {isTransfer ? (
            <View className="gap-4">
              {/* Origen */}
              <View className="gap-2">
                <Typography variant="label">
                  Cuenta origen (de donde sale el dinero)
                </Typography>
                <View className="gap-2">
                  {accounts.map((acc) => {
                    const isSelected = activeAccountId === acc.id;
                    return (
                      <Pressable
                        key={`from-${acc.id}`}
                        onPress={() => setSelectedAccountId(acc.id)}
                        className={`flex-row items-center justify-between px-4 py-3 rounded-2xl ${
                          isSelected
                            ? "bg-primary-600"
                            : "bg-surface-800 border border-surface-600/70"
                        }`}
                      >
                        <Typography
                          className={isSelected ? "text-white font-medium" : ""}
                        >
                          {acc.name}
                        </Typography>
                        <Typography
                          variant="caption"
                          className={isSelected ? "text-white/80" : ""}
                          muted={!isSelected}
                        >
                          {acc.type === "credit"
                            ? "Tarjeta de crédito"
                            : acc.currency}
                        </Typography>
                      </Pressable>
                    );
                  })}
                </View>
              </View>

              {/* Destino */}
              <View className="gap-2">
                <Typography variant="label">
                  Cuenta destino / Tarjeta a pagar
                </Typography>
                <View className="gap-2">
                  {accounts.map((acc) => {
                    const isSelected = activeToAccountId === acc.id;
                    const isSameAsOrigin = activeAccountId === acc.id;
                    return (
                      <Pressable
                        key={`to-${acc.id}`}
                        disabled={isSameAsOrigin}
                        onPress={() => setSelectedToAccountId(acc.id)}
                        className={`flex-row items-center justify-between px-4 py-3 rounded-2xl ${
                          isSelected
                            ? "bg-primary-600"
                            : isSameAsOrigin
                              ? "bg-surface-700/60 opacity-50"
                              : "bg-surface-800 border border-surface-600/70"
                        }`}
                      >
                        <Typography
                          className={isSelected ? "text-white font-medium" : ""}
                        >
                          {acc.name}
                        </Typography>
                        <Typography
                          variant="caption"
                          className={isSelected ? "text-white/80" : ""}
                          muted={!isSelected}
                        >
                          {isSameAsOrigin
                            ? "Misma cuenta"
                            : acc.type === "credit"
                              ? "Tarjeta (pago)"
                              : acc.currency}
                        </Typography>
                      </Pressable>
                    );
                  })}
                </View>
              </View>
            </View>
          ) : (
            <View className="gap-4">
              <View className="gap-2">
                <Typography variant="label">Cuenta</Typography>
                {accounts.map((acc) => {
                  const isSelected =
                    !isDirectGoalIncome && activeAccountId === acc.id;
                  return (
                    <Pressable
                      key={acc.id}
                      onPress={() => {
                        setSelectedGoalId(null);
                        setSelectedAccountId(acc.id);
                      }}
                      className={`flex-row items-center justify-between px-4 py-3 rounded-2xl ${
                        isSelected
                          ? "bg-primary-600"
                          : "bg-surface-800 border border-surface-600/70"
                      }`}
                    >
                      <Typography
                        className={isSelected ? "text-white font-medium" : ""}
                      >
                        {acc.name}
                      </Typography>
                      <Typography
                        variant="caption"
                        className={isSelected ? "text-white/80" : ""}
                        muted={!isSelected}
                      >
                        {acc.type === "credit"
                          ? "Tarjeta de crédito"
                          : acc.currency}
                      </Typography>
                    </Pressable>
                  );
                })}
                {accounts.length === 0 && (
                  <View className="items-start gap-2 pt-1">
                    <Typography variant="caption" muted>
                      Aún no tienes cuentas registradas.
                    </Typography>
                    <Button
                      title="Crear cuenta"
                      size="sm"
                      variant="secondary"
                      onPress={() => router.push("/accounts/new")}
                    />
                  </View>
                )}
              </View>

              {type === "income" && activeGoals.length > 0 && (
                <View className="gap-2">
                  <Typography variant="label">
                    O ingresar directo a una Meta de Ahorro (suma en reportes)
                  </Typography>
                  {activeGoals.map((goal) => {
                    const isSelected = selectedGoalId === goal.id;
                    return (
                      <Pressable
                        key={goal.id}
                        onPress={() => setSelectedGoalId(goal.id)}
                        className={`flex-row items-center justify-between px-4 py-3 rounded-2xl ${
                          isSelected
                            ? "bg-success-500"
                            : "bg-surface-800 border border-surface-600/70"
                        }`}
                      >
                        <View className="flex-row items-center gap-2">
                          <MaterialCommunityIcons
                            name={(goal.icon as any) || "piggy-bank"}
                            size={18}
                            color={isSelected ? colors.white : goal.color}
                          />
                          <Typography
                            className={
                              isSelected ? "text-white font-medium" : ""
                            }
                          >
                            {goal.name}
                          </Typography>
                        </View>
                        <Typography
                          variant="caption"
                          className={isSelected ? "text-white/80" : ""}
                          muted={!isSelected}
                        >
                          Meta ({goal.currency})
                        </Typography>
                      </Pressable>
                    );
                  })}
                </View>
              )}
            </View>
          )}

          {/* ── Guardar ──────────────────────────────────────── */}
          <Button
            title={
              isTransfer && toAccount?.type === "credit"
                ? "Registrar pago de tarjeta"
                : isTransfer
                  ? "Realizar transferencia"
                  : type === "expense"
                    ? "Guardar gasto"
                    : "Guardar ingreso"
            }
            onPress={handleSubmit}
            loading={isPending}
            disabled={isSubmitDisabled}
          />
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
