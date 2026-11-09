import { useEffect, useRef, useState } from "react";
import {
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  TextInput,
  View,
} from "react-native";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { Button, Typography } from "@/components/ui";
import {
  usePayRecurringExpense,
  useProcessDueRecurring,
  useSkipRecurringExpense,
} from "@/hooks/useRecurringExpenses";
import type { RecurringExpense } from "@/types";
import { formatCurrency } from "@/utils/formatters";
import { colors } from "../../../tailwind.config";

function getLocalDateAndTime(): { localDate: string; localTime: string } {
  const now = new Date();
  const yyyy = now.getFullYear();
  const mm = String(now.getMonth() + 1).padStart(2, "0");
  const dd = String(now.getDate()).padStart(2, "0");
  const hh = String(now.getHours()).padStart(2, "0");
  const min = String(now.getMinutes()).padStart(2, "0");
  return {
    localDate: `${yyyy}-${mm}-${dd}`,
    localTime: `${hh}:${min}`,
  };
}

export function RecurringAutoProcessor({ enabled }: { enabled: boolean }) {
  const processDueMutation = useProcessDueRecurring();
  const payMutation = usePayRecurringExpense();
  const skipMutation = useSkipRecurringExpense();

  const [appliedFixedBanner, setAppliedFixedBanner] = useState<
    RecurringExpense[]
  >([]);
  const [variableQueue, setVariableQueue] = useState<RecurringExpense[]>([]);
  const [reminderTimeLabel, setReminderTimeLabel] = useState("09:00");

  // IDs pospuestos durante la sesión del día ("Más tarde")
  const snoozedKeysRef = useRef<Set<string>>(new Set());

  // Estado del formulario para el primer item de la cola variable
  const currentPromptItem = variableQueue[0] ?? null;
  const [priceChanged, setPriceChanged] = useState(false);
  const [realAmountInput, setRealAmountInput] = useState("");
  const [updateBaseAmount, setUpdateBaseAmount] = useState(true);

  function advanceQueue(completedId: string) {
    const { localDate } = getLocalDateAndTime();
    snoozedKeysRef.current.add(`${completedId}:${localDate}`);
    setVariableQueue((prev) => {
      const next = prev.slice(1);
      if (next[0]) {
        setPriceChanged(false);
        setRealAmountInput(String(next[0].amount));
        setUpdateBaseAmount(true);
      }
      return next;
    });
  }

  useEffect(() => {
    if (!enabled) return;

    const runCheck = () => {
      if (processDueMutation.isPending) return;
      const { localDate, localTime } = getLocalDateAndTime();

      processDueMutation.mutate(
        { localDate, localTime },
        {
          onSuccess: (res) => {
            const { appliedFixed, dueVariable, settings } = res.data;
            if (settings?.reminderTime) {
              setReminderTimeLabel(settings.reminderTime);
            }
            if (appliedFixed && appliedFixed.length > 0) {
              setAppliedFixedBanner((prev) => [...prev, ...appliedFixed]);
            }
            if (dueVariable && dueVariable.length > 0) {
              const filtered = dueVariable.filter((item) => {
                const key = `${item.id}:${localDate}`;
                return !snoozedKeysRef.current.has(key);
              });
              if (filtered.length > 0) {
                setVariableQueue((prev) => {
                  const existingIds = new Set(prev.map((p) => p.id));
                  const news = filtered.filter((f) => !existingIds.has(f.id));
                  if (news.length === 0) return prev;
                  if (prev.length === 0 && news[0]) {
                    setPriceChanged(false);
                    setRealAmountInput(String(news[0].amount));
                    setUpdateBaseAmount(true);
                  }
                  return [...prev, ...news];
                });
              }
            }
          },
        },
      );
    };

    // Ejecutar al iniciar sesión y luego cada 60 segundos para detectar la hora exacta del usuario
    const initialTimer = setTimeout(runCheck, 1200);
    const interval = setInterval(runCheck, 60_000);

    return () => {
      clearTimeout(initialTimer);
      clearInterval(interval);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled]);

  function handleConfirmRegister() {
    if (!currentPromptItem) return;
    const parsed = parseFloat(realAmountInput.replace(",", "."));
    const finalAmount =
      priceChanged && !isNaN(parsed) && parsed > 0
        ? parsed
        : currentPromptItem.amount;
    const hasDiff = Math.abs(finalAmount - currentPromptItem.amount) > 0.009;

    payMutation.mutate(
      {
        id: currentPromptItem.id,
        payload: {
          amount: finalAmount,
          updateBaseAmount: hasDiff ? updateBaseAmount : false,
        },
      },
      {
        onSuccess: () => advanceQueue(currentPromptItem.id),
      },
    );
  }

  function handleSkipThisCycle() {
    if (!currentPromptItem) return;
    skipMutation.mutate(currentPromptItem.id, {
      onSuccess: () => advanceQueue(currentPromptItem.id),
    });
  }

  function handleSnoozeToday() {
    if (!currentPromptItem) return;
    advanceQueue(currentPromptItem.id);
  }

  const parsedNum = parseFloat(realAmountInput.replace(",", "."));
  const amountDiffers =
    currentPromptItem !== null &&
    priceChanged &&
    !isNaN(parsedNum) &&
    parsedNum > 0 &&
    Math.abs(parsedNum - currentPromptItem.amount) > 0.009;

  return (
    <>
      {/* ── Aviso superior cuando se aplicaron movimientos fijos automáticamente ── */}
      {appliedFixedBanner.length > 0 && (
        <View className="bg-success-500/15 border-b border-success-500/30 px-4 py-2.5 flex-row items-center justify-between">
          <View className="flex-row items-center gap-2 flex-1 mr-2">
            <MaterialCommunityIcons
              name="flash"
              size={18}
              color={colors.success[500]}
            />
            <Typography className="text-xs font-semibold text-text-primary flex-1">
              Se aplicaron automáticamente {appliedFixedBanner.length}{" "}
              {appliedFixedBanner.length === 1
                ? "movimiento fijo"
                : "movimientos fijos"}
              :{" "}
              {appliedFixedBanner
                .map(
                  (i) =>
                    `${i.name} (${i.type === "income" ? "+" : "-"}${formatCurrency(i.amount, i.currency)})`,
                )
                .join(", ")}
            </Typography>
          </View>
          <Pressable
            onPress={() => setAppliedFixedBanner([])}
            className="px-2 py-1 rounded-lg bg-surface-800"
          >
            <Typography className="text-[11px] font-bold text-text-secondary">
              OK
            </Typography>
          </Pressable>
        </View>
      )}

      {/* ── Modal programado a la hora del usuario para montos variables ── */}
      <Modal
        visible={currentPromptItem !== null}
        transparent
        animationType="fade"
        onRequestClose={handleSnoozeToday}
      >
        <KeyboardAvoidingView
          behavior={Platform.OS === "ios" ? "padding" : undefined}
          className="flex-1 bg-black/55 items-center justify-center px-5"
        >
          {currentPromptItem && (
            <View className="w-full max-w-sm bg-surface-800 rounded-3xl p-5 border border-surface-600 gap-4">
              <View className="flex-row items-center justify-between">
                <View className="flex-row items-center gap-2.5 flex-1 mr-2">
                  <View className="w-10 h-10 rounded-2xl bg-warning-500/15 items-center justify-center">
                    <MaterialCommunityIcons
                      name="clock-alert-outline"
                      size={22}
                      color={colors.warning[500]}
                    />
                  </View>
                  <View className="flex-1">
                    <Typography variant="caption" className="text-warning-500 font-bold">
                      Aviso programado ({reminderTimeLabel} hs)
                    </Typography>
                    <Typography variant="h3" numberOfLines={1}>
                      {currentPromptItem.name}
                    </Typography>
                  </View>
                </View>

                <Pressable
                  onPress={handleSnoozeToday}
                  className="w-8 h-8 rounded-full bg-surface-700 items-center justify-center"
                >
                  <MaterialCommunityIcons
                    name="close"
                    size={16}
                    color={colors.text.secondary}
                  />
                </Pressable>
              </View>

              <View className="bg-surface-900 p-3.5 rounded-2xl border border-surface-600/60 gap-1">
                <Typography className="text-xs text-text-secondary">
                  Hoy ({currentPromptItem.dueDate}) vence este{" "}
                  {currentPromptItem.type === "income"
                    ? "ingreso automático variable"
                    : "gasto automático variable"}
                  .
                </Typography>
                <Typography className="text-sm font-bold text-text-primary mt-0.5">
                  ¿Cambió el monto este mes o se mantiene en{" "}
                  {formatCurrency(
                    currentPromptItem.amount,
                    currentPromptItem.currency,
                  )}
                  ?
                </Typography>
              </View>

              {/* Selector: Se mantiene igual vs Cambió el precio */}
              <View className="flex-row gap-2">
                <Pressable
                  onPress={() => {
                    setPriceChanged(false);
                    setRealAmountInput(String(currentPromptItem.amount));
                  }}
                  className={`flex-1 py-2.5 px-3 rounded-2xl border items-center ${
                    !priceChanged
                      ? "bg-success-500/15 border-success-500"
                      : "bg-surface-700 border-surface-600"
                  }`}
                >
                  <Typography
                    className={`text-xs font-bold ${
                      !priceChanged ? "text-success-500" : "text-text-primary"
                    }`}
                  >
                    Se mantiene igual
                  </Typography>
                </Pressable>

                <Pressable
                  onPress={() => setPriceChanged(true)}
                  className={`flex-1 py-2.5 px-3 rounded-2xl border items-center ${
                    priceChanged
                      ? "bg-warning-500/15 border-warning-500"
                      : "bg-surface-700 border-surface-600"
                  }`}
                >
                  <Typography
                    className={`text-xs font-bold ${
                      priceChanged ? "text-warning-500" : "text-text-primary"
                    }`}
                  >
                    Cambió el precio
                  </Typography>
                </Pressable>
              </View>

              {priceChanged && (
                <View className="gap-2">
                  <Typography variant="label">
                    Nuevo monto de este mes ({currentPromptItem.currency})
                  </Typography>
                  <TextInput
                    value={realAmountInput}
                    onChangeText={setRealAmountInput}
                    keyboardType="decimal-pad"
                    placeholder="0.00"
                    placeholderTextColor={colors.text.muted}
                    className="bg-surface-700 text-text-primary px-4 py-3 rounded-2xl font-bold text-xl"
                  />

                  {amountDiffers && (
                    <Pressable
                      onPress={() => setUpdateBaseAmount(!updateBaseAmount)}
                      className="flex-row items-center justify-between bg-primary-600/10 border border-primary-600/40 p-3 rounded-2xl"
                    >
                      <View className="flex-1 mr-2">
                        <Typography className="text-xs font-bold text-text-primary">
                          Actualizar monto base para próximos meses
                        </Typography>
                        <Typography
                          variant="caption"
                          muted
                          className="text-[11px]"
                        >
                          Guardar{" "}
                          {formatCurrency(
                            parsedNum,
                            currentPromptItem.currency,
                          )}{" "}
                          como nuevo valor estimado
                        </Typography>
                      </View>
                      <MaterialCommunityIcons
                        name={
                          updateBaseAmount
                            ? "checkbox-marked-circle"
                            : "checkbox-blank-circle-outline"
                        }
                        size={22}
                        color={
                          updateBaseAmount
                            ? colors.primary[600]
                            : colors.text.muted
                        }
                      />
                    </Pressable>
                  )}
                </View>
              )}

              <View className="gap-2 pt-1">
                <Button
                  title={
                    currentPromptItem.type === "income"
                      ? "Sí, acreditar ingreso ahora"
                      : "Sí, registrar gasto ahora"
                  }
                  onPress={handleConfirmRegister}
                  loading={payMutation.isPending}
                />

                <View className="flex-row gap-2">
                  <Pressable
                    onPress={handleSnoozeToday}
                    className="flex-1 py-2.5 rounded-2xl bg-surface-700 items-center"
                  >
                    <Typography className="text-xs font-semibold text-text-secondary">
                      Preguntar más tarde
                    </Typography>
                  </Pressable>

                  <Pressable
                    onPress={handleSkipThisCycle}
                    disabled={skipMutation.isPending}
                    className="flex-1 py-2.5 rounded-2xl bg-danger-500/10 items-center"
                  >
                    <Typography className="text-xs font-semibold text-danger-500">
                      Omitir este mes
                    </Typography>
                  </Pressable>
                </View>
              </View>
            </View>
          )}
        </KeyboardAvoidingView>
      </Modal>
    </>
  );
}
