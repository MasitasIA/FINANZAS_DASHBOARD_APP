import { useState } from "react";
import {
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
import type { TransactionType, Currency } from "@/types";
import { colors } from "../../tailwind.config";

interface CategoryOption {
  id: string;
  name: string;
  icon: keyof typeof MaterialCommunityIcons.glyphMap;
  color: string;
}

const CATEGORIES: Record<TransactionType, CategoryOption[]> = {
  expense: [
    {
      id: "cat-leisure",
      name: "Ocio",
      icon: "gamepad-variant",
      color: colors.accent.violet,
    },
    {
      id: "cat-services",
      name: "Servicios",
      icon: "lightning-bolt",
      color: colors.warning[400],
    },
    {
      id: "cat-studies",
      name: "Estudios",
      icon: "school",
      color: colors.accent.cyan,
    },
    {
      id: "cat-food",
      name: "Comida",
      icon: "food-fork-drink",
      color: colors.danger[400],
    },
    {
      id: "cat-transport",
      name: "Transporte",
      icon: "car",
      color: colors.accent.indigo,
    },
    {
      id: "cat-health",
      name: "Salud",
      icon: "heart-pulse",
      color: colors.success[400],
    },
    {
      id: "cat-housing",
      name: "Vivienda",
      icon: "home",
      color: colors.primary[400],
    },
    {
      id: "cat-other-exp",
      name: "Otros",
      icon: "dots-horizontal",
      color: colors.text.secondary,
    },
  ],
  income: [
    {
      id: "cat-salary",
      name: "Trabajo",
      icon: "briefcase",
      color: colors.success[500],
    },
    {
      id: "cat-grant",
      name: "Beca",
      icon: "school",
      color: colors.accent.cyan,
    },
    {
      id: "cat-contribution",
      name: "Aporte",
      icon: "hand-coin",
      color: colors.accent.purple,
    },
    {
      id: "cat-pension",
      name: "Pensión",
      icon: "shield-account",
      color: colors.accent.indigo,
    },
    {
      id: "cat-freelance",
      name: "Freelance",
      icon: "laptop",
      color: colors.primary[500],
    },
    {
      id: "cat-investment",
      name: "Inversión",
      icon: "chart-line",
      color: colors.success[400],
    },
    {
      id: "cat-other-inc",
      name: "Otros",
      icon: "cash-plus",
      color: colors.text.secondary,
    },
  ],
  transfer: [
    {
      id: "cat-transfer",
      name: "Entre cuentas",
      icon: "swap-horizontal",
      color: colors.accent.slate,
    },
    {
      id: "cat-card-payment",
      name: "Pago de tarjeta",
      icon: "credit-card-check",
      color: colors.accent.pink,
    },
    {
      id: "cat-family-transfer",
      name: "Aporte familiar",
      icon: "account-group",
      color: colors.accent.purple,
    },
    {
      id: "cat-savings",
      name: "Ahorro",
      icon: "piggy-bank",
      color: colors.success[500],
    },
  ],
};

export default function NewTransactionScreen() {
  const params = useLocalSearchParams<{
    type?: TransactionType;
    accountId?: string;
    toAccountId?: string;
  }>();
  const initialType: TransactionType = params.type ?? "expense";
  const [type, setType] = useState<TransactionType>(initialType);
  const [amount, setAmount] = useState("");
  const [selectedCategoryId, setSelectedCategoryId] = useState<string>(
    CATEGORIES[initialType][0]?.id ?? "cat-leisure",
  );
  const [detail, setDetail] = useState("");
  const [selectedAccountId, setSelectedAccountId] = useState<string | null>(
    params.accountId ?? null,
  );
  const [selectedToAccountId, setSelectedToAccountId] = useState<string | null>(
    params.toAccountId ?? null,
  );

  const { data: accountsData } = useAccounts();
  const accounts = accountsData?.data ?? [];

  const isTransfer = type === "transfer";

  // Origen sugerido
  const defaultOrigin =
    accounts.find(
      (a) =>
        a.id !== (selectedToAccountId ?? params.toAccountId) &&
        a.type !== "credit",
    ) ?? accounts[0];
  const activeAccountId = selectedAccountId ?? defaultOrigin?.id ?? null;

  // Moneda de la cuenta seleccionada
  const originAccount = accounts.find((a) => a.id === activeAccountId);
  const activeCurrency: Currency = originAccount?.currency ?? "ARS";

  // Destino sugerido para transferencia
  const defaultDestination = accounts.find((a) => a.id !== activeAccountId);
  const activeToAccountId =
    selectedToAccountId ?? params.toAccountId ?? defaultDestination?.id ?? null;

  const { mutate, isPending } = useCreateTransaction();

  const toAccount = accounts.find((a) => a.id === activeToAccountId);
  const currentCategories = CATEGORIES[type];
  const selectedCat =
    currentCategories.find((c) => c.id === selectedCategoryId) ??
    currentCategories[0];

  const handleTypeChange = (newType: TransactionType) => {
    setType(newType);
    const firstCat = CATEGORIES[newType][0];
    if (firstCat) {
      setSelectedCategoryId(firstCat.id);
    }
  };

  const parsedAmount = parseFloat(amount.replace(",", "."));
  const isSubmitDisabled =
    !amount ||
    isNaN(parsedAmount) ||
    parsedAmount <= 0 ||
    !activeAccountId ||
    (isTransfer &&
      (!activeToAccountId || activeToAccountId === activeAccountId));

  const handleSubmit = () => {
    if (isSubmitDisabled) return;

    const categoryName =
      selectedCat?.name ?? (isTransfer ? "Transferencia" : "Transacción");
    const trimmedDetail = detail.trim();
    const finalDescription = trimmedDetail
      ? `${categoryName} - ${trimmedDetail}`
      : categoryName;

    mutate(
      {
        type,
        amount: parsedAmount,
        description: finalDescription,
        note: trimmedDetail || undefined,
        accountId: activeAccountId,
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

            <View className="flex-row flex-wrap gap-2">
              {currentCategories.map((cat) => {
                const isSelected = selectedCategoryId === cat.id;
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
                        name={cat.icon}
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
            <View className="gap-2">
              <Typography variant="label">Cuenta</Typography>
              {accounts.map((acc) => {
                const isSelected = activeAccountId === acc.id;
                return (
                  <Pressable
                    key={acc.id}
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
