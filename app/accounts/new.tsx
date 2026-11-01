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
import { router } from "expo-router";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { Button, Card, Typography } from "@/components/ui";
import { useCreateAccount } from "@/hooks/useAccounts";
import type { AccountType, Currency } from "@/types";
import { colors, accountColors } from "../../tailwind.config";

const ACCOUNT_TYPES: {
  type: AccountType;
  label: string;
  icon: keyof typeof MaterialCommunityIcons.glyphMap;
}[] = [
  { type: "checking", label: "Corriente / Débito", icon: "bank" },
  { type: "savings", label: "Ahorro", icon: "piggy-bank" },
  { type: "credit", label: "Tarjeta de crédito", icon: "credit-card" },
  { type: "cash", label: "Efectivo", icon: "cash" },
  { type: "investment", label: "Inversión", icon: "chart-line" },
];

const CURRENCIES: Currency[] = ["ARS", "USD", "EUR"];

const COLORS = accountColors;

const ICONS: (keyof typeof MaterialCommunityIcons.glyphMap)[] = [
  "bank",
  "wallet",
  "cash",
  "credit-card",
  "chart-line",
  "piggy-bank",
  "currency-usd",
];

export default function NewAccountScreen() {
  const [name, setName] = useState("");
  const [type, setType] = useState<AccountType>("checking");
  const [currency, setCurrency] = useState<Currency>("ARS");
  const [balance, setBalance] = useState("");
  const [creditLimit, setCreditLimit] = useState("");
  const [closingDay, setClosingDay] = useState("");
  const [dueDay, setDueDay] = useState("");
  const [color, setColor] = useState(COLORS[0]);
  const [icon, setIcon] = useState(ICONS[0]);

  const { mutate, isPending } = useCreateAccount();

  const isCredit = type === "credit";

  const handleSubmit = () => {
    if (!name.trim()) return;

    const initialAmount = balance ? parseFloat(balance.replace(",", ".")) : 0;
    // Para tarjetas de crédito, el consumo inicial se guarda como balance negativo
    const finalBalance = isNaN(initialAmount)
      ? 0
      : isCredit
        ? -Math.abs(initialAmount)
        : initialAmount;

    const parsedLimit =
      isCredit && creditLimit
        ? parseFloat(creditLimit.replace(",", "."))
        : undefined;
    const parsedClosingDay =
      isCredit && closingDay ? parseInt(closingDay, 10) : undefined;
    const parsedDueDay = isCredit && dueDay ? parseInt(dueDay, 10) : undefined;

    mutate(
      {
        name: name.trim(),
        type,
        currency,
        balance: finalBalance,
        color,
        icon,
        creditLimit: isNaN(parsedLimit as number) ? undefined : parsedLimit,
        closingDay: isNaN(parsedClosingDay as number)
          ? undefined
          : parsedClosingDay,
        dueDay: isNaN(parsedDueDay as number) ? undefined : parsedDueDay,
      },
      {
        onSuccess: () => router.back(),
      },
    );
  };

  const isSaveDisabled = !name.trim() || (isCredit && !creditLimit);

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
          {/* ── Nombre ─────────────────────────────────────────── */}
          <Card>
            <Typography variant="label" className="mb-2">
              Nombre de la cuenta
            </Typography>
            <TextInput
              value={name}
              onChangeText={setName}
              placeholder="Ej: Banco Galicia, Mercado Pago, Efectivo"
              placeholderTextColor={colors.text.muted}
              className="text-base text-text-primary"
              style={{ fontFamily: "Inter_400Regular" }}
            />
          </Card>

          {/* ── Balance / Límite según tipo ──────────────────────── */}
          {isCredit ? (
            <>
              {/* Límite de crédito */}
              <Card>
                <Typography variant="label" className="mb-2">
                  Límite de crédito ({currency}) *
                </Typography>
                <TextInput
                  value={creditLimit}
                  onChangeText={setCreditLimit}
                  placeholder="Ej: 500.000"
                  placeholderTextColor={colors.text.muted}
                  keyboardType="decimal-pad"
                  className="text-3xl font-bold text-text-primary"
                  style={{ fontFamily: "Inter_700Bold" }}
                />
                <Typography variant="caption" muted className="mt-1">
                  Monto total de crédito asignado por el emisor.
                </Typography>
              </Card>

              {/* Consumo inicial */}
              <Card>
                <Typography variant="label" className="mb-2">
                  Consumo actual / Deuda inicial ({currency})
                </Typography>
                <TextInput
                  value={balance}
                  onChangeText={setBalance}
                  placeholder="0,00"
                  placeholderTextColor={colors.text.muted}
                  keyboardType="decimal-pad"
                  className="text-2xl font-bold text-warning-500"
                  style={{ fontFamily: "Inter_700Bold" }}
                />
                <Typography variant="caption" muted className="mt-1">
                  Monto que adeudas actualmente en la tarjeta (0 si está al
                  día).
                </Typography>
              </Card>

              {/* Fechas de corte y vencimiento */}
              <Card className="gap-3">
                <Typography variant="label">Fechas del resumen</Typography>
                <View className="flex-row gap-3">
                  <View className="flex-1 bg-surface-700/60 p-3 rounded-2xl">
                    <Typography variant="caption" muted className="mb-1">
                      Día de cierre
                    </Typography>
                    <TextInput
                      value={closingDay}
                      onChangeText={setClosingDay}
                      placeholder="Ej: 22"
                      placeholderTextColor={colors.text.muted}
                      keyboardType="number-pad"
                      maxLength={2}
                      className="text-lg font-semibold text-text-primary"
                      style={{ fontFamily: "Inter_600SemiBold" }}
                    />
                  </View>

                  <View className="flex-1 bg-surface-700/60 p-3 rounded-2xl">
                    <Typography variant="caption" muted className="mb-1">
                      Día de vencimiento
                    </Typography>
                    <TextInput
                      value={dueDay}
                      onChangeText={setDueDay}
                      placeholder="Ej: 5"
                      placeholderTextColor={colors.text.muted}
                      keyboardType="number-pad"
                      maxLength={2}
                      className="text-lg font-semibold text-text-primary"
                      style={{ fontFamily: "Inter_600SemiBold" }}
                    />
                  </View>
                </View>
              </Card>
            </>
          ) : (
            <Card>
              <Typography variant="label" className="mb-2">
                Balance inicial ({currency})
              </Typography>
              <TextInput
                value={balance}
                onChangeText={setBalance}
                placeholder="0,00"
                placeholderTextColor={colors.text.muted}
                keyboardType="decimal-pad"
                className="text-3xl font-bold text-text-primary"
                style={{ fontFamily: "Inter_700Bold" }}
              />
            </Card>
          )}

          {/* ── Moneda ────────────────────────────────────────── */}
          <View className="gap-2">
            <Typography variant="label">Moneda</Typography>
            <View className="flex-row gap-2">
              {CURRENCIES.map((curr) => (
                <Pressable
                  key={curr}
                  onPress={() => setCurrency(curr)}
                  className={`flex-1 py-2.5 rounded-2xl items-center ${
                    currency === curr
                      ? "bg-primary-600"
                      : "bg-surface-800 border border-surface-600/70"
                  }`}
                >
                  <Typography
                    className={`font-semibold ${
                      currency === curr ? "text-white" : "text-text-secondary"
                    }`}
                  >
                    {curr}
                  </Typography>
                </Pressable>
              ))}
            </View>
          </View>

          {/* ── Tipo de cuenta ────────────────────────────────── */}
          <View className="gap-2">
            <Typography variant="label">Tipo de cuenta</Typography>
            <View className="flex-row flex-wrap gap-2">
              {ACCOUNT_TYPES.map((t) => (
                <Pressable
                  key={t.type}
                  onPress={() => {
                    setType(t.type);
                    setIcon(t.icon);
                  }}
                  className={`flex-row items-center px-4 py-3 rounded-2xl gap-2.5 ${
                    type === t.type
                      ? "bg-primary-600"
                      : "bg-surface-800 border border-surface-600/70"
                  }`}
                >
                  <MaterialCommunityIcons
                    name={t.icon}
                    size={18}
                    color={
                      type === t.type ? colors.white : colors.text.secondary
                    }
                  />
                  <Typography
                    className={`font-medium ${
                      type === t.type ? "text-white" : "text-text-secondary"
                    }`}
                  >
                    {t.label}
                  </Typography>
                </Pressable>
              ))}
            </View>
          </View>

          {/* ── Color e ícono ─────────────────────────────────── */}
          <Card className="gap-4">
            <View>
              <Typography variant="label" className="mb-2.5">
                Color identificativo
              </Typography>
              <View className="flex-row gap-3 items-center">
                {COLORS.map((c) => (
                  <Pressable
                    key={c}
                    onPress={() => setColor(c)}
                    className="w-8 h-8 rounded-full items-center justify-center"
                    style={{
                      backgroundColor: c,
                      borderWidth: color === c ? 3 : 0,
                      borderColor: colors.text.primary,
                    }}
                  >
                    {color === c && (
                      <MaterialCommunityIcons
                        name="check"
                        size={16}
                        color={colors.white}
                      />
                    )}
                  </Pressable>
                ))}
              </View>
            </View>

            <View>
              <Typography variant="label" className="mb-2.5">
                Ícono
              </Typography>
              <View className="flex-row gap-3 items-center">
                {ICONS.map((i) => (
                  <Pressable
                    key={i}
                    onPress={() => setIcon(i)}
                    className={`w-10 h-10 rounded-2xl items-center justify-center ${
                      icon === i ? "bg-primary-600" : "bg-surface-700"
                    }`}
                  >
                    <MaterialCommunityIcons
                      name={i}
                      size={20}
                      color={icon === i ? colors.white : colors.text.secondary}
                    />
                  </Pressable>
                ))}
              </View>
            </View>
          </Card>

          {/* ── Botón Guardar ─────────────────────────────────── */}
          <Button
            title={isCredit ? "Crear tarjeta" : "Crear cuenta"}
            onPress={handleSubmit}
            loading={isPending}
            disabled={isSaveDisabled}
          />
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
