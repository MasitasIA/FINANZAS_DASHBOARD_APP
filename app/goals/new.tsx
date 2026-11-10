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
import { useCreateGoal } from "@/hooks/useGoals";
import type { Currency } from "@/types";
import { accountColors } from "../../tailwind.config";
import { useAppTheme } from "@/theme/useAppTheme";

const CURRENCIES: Currency[] = ["ARS", "USD", "EUR"];

const GOAL_ICONS: (keyof typeof MaterialCommunityIcons.glyphMap)[] = [
  "piggy-bank",
  "airplane",
  "laptop",
  "car",
  "home",
  "school",
  "shield-check",
  "rocket",
  "gift",
  "heart",
];

const PRESET_DEADLINES = [
  { label: "3 meses", months: 3 },
  { label: "6 meses", months: 6 },
  { label: "1 año", months: 12 },
  { label: "Sin fecha", months: 0 },
];

export default function NewGoalScreen() {
  const { colors } = useAppTheme();
  const [name, setName] = useState("");
  const [targetAmount, setTargetAmount] = useState("");
  const [initialAmount, setInitialAmount] = useState("");
  const [currency, setCurrency] = useState<Currency>("ARS");
  const [deadlineMonths, setDeadlineMonths] = useState<number>(6);
  const [customDeadline, setCustomDeadline] = useState("");
  const [color, setColor] = useState<string>(accountColors[0]);
  const [icon, setIcon] = useState<
    keyof typeof MaterialCommunityIcons.glyphMap
  >(GOAL_ICONS[0]);

  const { mutate, isPending } = useCreateGoal();

  const calculateDeadlineDate = (): string | undefined => {
    if (customDeadline.trim()) {
      // Intenta interpretar fecha YYYY-MM-DD o DD/MM/YYYY
      const parts = customDeadline.trim().split(/[-/]/);
      if (parts.length === 3) {
        if (parts[0].length === 4) {
          // YYYY-MM-DD
          return new Date(
            parseInt(parts[0]),
            parseInt(parts[1]) - 1,
            parseInt(parts[2]),
          ).toISOString();
        } else {
          // DD/MM/YYYY
          return new Date(
            parseInt(parts[2]),
            parseInt(parts[1]) - 1,
            parseInt(parts[0]),
          ).toISOString();
        }
      }
    }
    if (deadlineMonths > 0) {
      const d = new Date();
      d.setMonth(d.getMonth() + deadlineMonths);
      return d.toISOString();
    }
    return undefined;
  };

  const parsedTarget = parseFloat(targetAmount.replace(",", "."));
  const parsedInitial = initialAmount
    ? parseFloat(initialAmount.replace(",", "."))
    : 0;

  const isSaveDisabled =
    !name.trim() || isNaN(parsedTarget) || parsedTarget <= 0;

  const handleSubmit = () => {
    if (isSaveDisabled) return;

    const deadlineIso = calculateDeadlineDate();
    const finalInitial = isNaN(parsedInitial) ? 0 : Math.max(0, parsedInitial);

    mutate(
      {
        name: name.trim(),
        targetAmount: parsedTarget,
        currentAmount: finalInitial,
        currency,
        deadline: deadlineIso,
        icon,
        color,
        status: finalInitial >= parsedTarget ? "completed" : "active",
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
          {/* ── Nombre ─────────────────────────────────────────── */}
          <Card>
            <Typography variant="label" className="mb-2">
              Nombre de la meta
            </Typography>
            <TextInput
              value={name}
              onChangeText={setName}
              placeholder="Ej: Vacaciones en Brasil, Auto nuevo, Fondo de emergencia"
              placeholderTextColor={colors.text.muted}
              className="text-base text-text-primary"
              style={{ fontFamily: "Inter_400Regular" }}
            />
          </Card>

          {/* ── Monto Objetivo ─────────────────────────────────── */}
          <Card>
            <Typography variant="label" className="mb-2">
              Monto objetivo ({currency}) *
            </Typography>
            <TextInput
              value={targetAmount}
              onChangeText={setTargetAmount}
              placeholder="0,00"
              placeholderTextColor={colors.text.muted}
              keyboardType="decimal-pad"
              className="text-3xl font-bold text-text-primary"
              style={{ fontFamily: "Inter_700Bold" }}
            />
          </Card>

          {/* ── Monto inicial ahorrado (opcional) ──────────────── */}
          <Card>
            <Typography variant="label" className="mb-2">
              ¿Ya tienes algo ahorrado? (opcional)
            </Typography>
            <TextInput
              value={initialAmount}
              onChangeText={setInitialAmount}
              placeholder="0,00"
              placeholderTextColor={colors.text.muted}
              keyboardType="decimal-pad"
              className="text-2xl font-bold text-success-500"
              style={{ fontFamily: "Inter_700Bold" }}
            />
            <Typography variant="caption" muted className="mt-1">
              Monto con el que inicia esta meta de ahorro.
            </Typography>
          </Card>

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

          {/* ── Fecha límite ──────────────────────────────────── */}
          <Card className="gap-3">
            <Typography variant="label">Fecha límite estimada</Typography>
            <View className="flex-row gap-2">
              {PRESET_DEADLINES.map((preset) => {
                const isSelected =
                  deadlineMonths === preset.months && !customDeadline;
                return (
                  <Pressable
                    key={preset.label}
                    onPress={() => {
                      setDeadlineMonths(preset.months);
                      setCustomDeadline("");
                    }}
                    className={`flex-1 py-2 rounded-xl items-center ${
                      isSelected
                        ? "bg-primary-600"
                        : "bg-surface-700/70 active:bg-surface-600"
                    }`}
                  >
                    <Typography
                      className={`text-xs font-semibold ${
                        isSelected ? "text-white" : "text-text-secondary"
                      }`}
                    >
                      {preset.label}
                    </Typography>
                  </Pressable>
                );
              })}
            </View>

            <View className="mt-1">
              <Typography variant="caption" muted className="mb-1">
                O escribe una fecha específica (DD/MM/AAAA):
              </Typography>
              <TextInput
                value={customDeadline}
                onChangeText={(val) => {
                  setCustomDeadline(val);
                  setDeadlineMonths(-1);
                }}
                placeholder="Ej: 31/12/2025"
                placeholderTextColor={colors.text.muted}
                className="text-base text-text-primary bg-surface-700/60 px-3 py-2 rounded-xl"
                style={{ fontFamily: "Inter_400Regular" }}
              />
            </View>
          </Card>

          {/* ── Color e ícono ─────────────────────────────────── */}
          <Card className="gap-4">
            <View>
              <Typography variant="label" className="mb-2.5">
                Color identificativo
              </Typography>
              <View className="flex-row flex-wrap gap-3 items-center">
                {accountColors.map((c) => (
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
                Ícono representativo
              </Typography>
              <View className="flex-row flex-wrap gap-3 items-center">
                {GOAL_ICONS.map((i) => (
                  <Pressable
                    key={i}
                    onPress={() => setIcon(i)}
                    className={`w-11 h-11 rounded-2xl items-center justify-center ${
                      icon === i ? "bg-primary-600" : "bg-surface-700"
                    }`}
                  >
                    <MaterialCommunityIcons
                      name={i}
                      size={22}
                      color={icon === i ? colors.white : colors.text.secondary}
                    />
                  </Pressable>
                ))}
              </View>
            </View>
          </Card>

          {/* ── Botón Guardar ─────────────────────────────────── */}
          <Button
            title="Crear meta de ahorro"
            onPress={handleSubmit}
            loading={isPending}
            disabled={isSaveDisabled}
          />
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
