import { useState } from "react";
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Modal,
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
import { useAccounts } from "@/hooks/useAccounts";
import {
  useCreateRecurringExpense,
  useDeleteRecurringExpense,
  usePayRecurringExpense,
  useRecurringExpenses,
  useUpdateRecurringExpense,
  useUpdateUserSettings,
  useUserSettings,
} from "@/hooks/useRecurringExpenses";
import type {
  Currency,
  RecurringExpense,
  RecurringFrequency,
  RecurringItemType,
} from "@/types";
import { formatCurrency } from "@/utils/formatters";
import { accountColors, colors } from "../../tailwind.config";

const RECURRING_ICONS: (keyof typeof MaterialCommunityIcons.glyphMap)[] = [
  "calendar-sync",
  "briefcase",
  "cash-multiple",
  "home",
  "wifi",
  "television-play",
  "lightning-bolt",
  "cellphone",
  "dumbbell",
  "shield-check",
  "car",
  "school",
  "credit-card-clock-outline",
  "music",
];

const FREQUENCIES: { id: RecurringFrequency; label: string }[] = [
  { id: "monthly", label: "Mensual" },
  { id: "yearly", label: "Anual" },
  { id: "weekly", label: "Semanal" },
];

const REMINDER_TIME_PRESETS = ["09:00", "13:00", "18:00", "21:00"];

export default function RecurringExpensesScreen() {
  const { data: recurringData, isLoading } = useRecurringExpenses();
  const { data: accountsData } = useAccounts();
  const { data: userSettings } = useUserSettings();

  const createMutation = useCreateRecurringExpense();
  const updateMutation = useUpdateRecurringExpense();
  const deleteMutation = useDeleteRecurringExpense();
  const payMutation = usePayRecurringExpense();
  const updateSettingsMutation = useUpdateUserSettings();

  const items = recurringData?.data ?? [];
  const accounts = accountsData?.data ?? [];
  const reminderTime = userSettings?.reminderTime ?? "09:00";

  // Pestaña activa: Gastos automáticos vs Ingresos automáticos
  const [activeTab, setActiveTab] = useState<RecurringItemType>("expense");

  // Modal de configurar hora personal de aviso
  const [showTimeModal, setShowTimeModal] = useState(false);
  const [customTimeInput, setCustomTimeInput] = useState(reminderTime);
  const [timeError, setTimeError] = useState<string | null>(null);

  // Estado del modal de creación / edición
  const [modalVisible, setModalVisible] = useState(false);
  const [editingItem, setEditingItem] = useState<RecurringExpense | null>(null);

  const [itemType, setItemType] = useState<RecurringItemType>("expense");
  const [name, setName] = useState("");
  const [amount, setAmount] = useState("");
  const [dueDate, setDueDate] = useState(
    new Date().toISOString().slice(0, 10),
  );
  const [selectedAccountId, setSelectedAccountId] = useState<string>("");
  const [frequency, setFrequency] = useState<RecurringFrequency>("monthly");
  const [isVariable, setIsVariable] = useState<boolean>(false);
  const [icon, setIcon] =
    useState<keyof typeof MaterialCommunityIcons.glyphMap>("calendar-sync");
  const [color, setColor] = useState<string>(accountColors[0]);
  const [isActive, setIsActive] = useState<boolean>(true);
  const [formError, setFormError] = useState<string | null>(null);

  // Estado del modal de Confirmar Monto Real al Aplicar Manualmente
  const [applyingItem, setApplyingItem] = useState<RecurringExpense | null>(
    null,
  );
  const [realAmountInput, setRealAmountInput] = useState("");
  const [updateBaseAmount, setUpdateBaseAmount] = useState(true);
  const [applyNote, setApplyNote] = useState("");

  function openTimeSettingsModal() {
    setCustomTimeInput(reminderTime);
    setTimeError(null);
    setShowTimeModal(true);
  }

  function handleSaveReminderTime() {
    const trimmed = customTimeInput.trim();
    if (!/^([01]\d|2[0-3]):([0-5]\d)$/.test(trimmed)) {
      setTimeError("Ingresa una hora válida en formato 24h HH:mm (ej. 09:00 o 20:30)");
      return;
    }
    updateSettingsMutation.mutate(trimmed, {
      onSuccess: () => setShowTimeModal(false),
    });
  }

  function openCreateModal() {
    setEditingItem(null);
    setItemType(activeTab);
    setName("");
    setAmount("");
    setDueDate(new Date().toISOString().slice(0, 10));
    setSelectedAccountId(accounts[0]?.id ?? "");
    setFrequency("monthly");
    setIsVariable(false);
    setIcon(activeTab === "income" ? "briefcase" : "calendar-sync");
    setColor(
      activeTab === "income" ? colors.success[500] : accountColors[0],
    );
    setIsActive(true);
    setFormError(null);
    setModalVisible(true);
  }

  function openEditModal(item: RecurringExpense) {
    setEditingItem(item);
    setItemType(item.type || "expense");
    setName(item.name);
    setAmount(String(item.amount));
    setDueDate(item.dueDate || new Date().toISOString().slice(0, 10));
    setSelectedAccountId(item.accountId);
    setFrequency(item.frequency || "monthly");
    setIsVariable(Boolean(item.isVariable));
    setIcon(
      (item.icon as keyof typeof MaterialCommunityIcons.glyphMap) ||
        "calendar-sync",
    );
    setColor(item.color || accountColors[0]);
    setIsActive(item.isActive);
    setFormError(null);
    setModalVisible(true);
  }

  function openApplyModal(item: RecurringExpense) {
    setApplyingItem(item);
    setRealAmountInput(String(item.amount));
    setUpdateBaseAmount(true);
    setApplyNote("");
  }

  function handleConfirmApply() {
    if (!applyingItem) return;
    const parsedReal = parseFloat(realAmountInput.replace(",", "."));
    const finalAmount =
      !isNaN(parsedReal) && parsedReal > 0 ? parsedReal : applyingItem.amount;
    const amountChanged = Math.abs(finalAmount - applyingItem.amount) > 0.009;

    payMutation.mutate(
      {
        id: applyingItem.id,
        payload: {
          amount: finalAmount,
          updateBaseAmount: amountChanged ? updateBaseAmount : false,
          note: applyNote.trim() || undefined,
        },
      },
      {
        onSuccess: () => setApplyingItem(null),
      },
    );
  }

  function normalizeDateInput(
    raw: string,
  ): { date: string; day: number } | null {
    const trimmed = raw.trim();
    if (/^\d{1,2}$/.test(trimmed)) {
      const day = Math.min(31, Math.max(1, parseInt(trimmed, 10)));
      const now = new Date();
      const yyyy = now.getFullYear();
      const mm = String(now.getMonth() + 1).padStart(2, "0");
      const dd = String(day).padStart(2, "0");
      return { date: `${yyyy}-${mm}-${dd}`, day };
    }
    const parts = trimmed.split(/[-/]/);
    if (parts.length === 3) {
      if (parts[0].length === 4) {
        const yyyy = parts[0];
        const mm = parts[1].padStart(2, "0");
        const dd = parts[2].padStart(2, "0");
        const day = Math.min(31, Math.max(1, parseInt(dd, 10) || 1));
        return { date: `${yyyy}-${mm}-${dd}`, day };
      } else if (parts[2].length === 4) {
        const dd = parts[0].padStart(2, "0");
        const mm = parts[1].padStart(2, "0");
        const yyyy = parts[2];
        const day = Math.min(31, Math.max(1, parseInt(dd, 10) || 1));
        return { date: `${yyyy}-${mm}-${dd}`, day };
      }
    }
    return null;
  }

  function handleSave() {
    const cleanName = name.trim();
    const parsedAmount = parseFloat(amount.replace(",", "."));
    const parsedDate = normalizeDateInput(dueDate);
    const targetAccount =
      accounts.find((a) => a.id === selectedAccountId) ?? accounts[0];

    if (!cleanName) {
      setFormError(
        itemType === "income"
          ? "Ingresa el nombre del ingreso automático."
          : "Ingresa el nombre del gasto automático.",
      );
      return;
    }
    if (isNaN(parsedAmount) || parsedAmount <= 0) {
      setFormError("Ingresa un monto válido mayor a 0.");
      return;
    }
    if (!parsedDate) {
      setFormError(
        "Ingresa una fecha válida (YYYY-MM-DD, DD/MM/YYYY o día 1-31).",
      );
      return;
    }
    if (!targetAccount) {
      setFormError("Debes crear al menos una cuenta primero.");
      return;
    }

    const currency: Currency = targetAccount.currency || "ARS";

    if (editingItem) {
      updateMutation.mutate(
        {
          id: editingItem.id,
          payload: {
            type: itemType,
            name: cleanName,
            amount: parsedAmount,
            currency,
            accountId: targetAccount.id,
            dueDate: parsedDate.date,
            dueDay: parsedDate.day,
            frequency,
            isVariable,
            icon,
            color,
            isActive,
          },
        },
        {
          onSuccess: () => setModalVisible(false),
        },
      );
    } else {
      createMutation.mutate(
        {
          type: itemType,
          name: cleanName,
          amount: parsedAmount,
          currency,
          accountId: targetAccount.id,
          categoryId: itemType === "income" ? "cat-salary" : "cat-services",
          dueDate: parsedDate.date,
          dueDay: parsedDate.day,
          frequency,
          isVariable,
          icon,
          color,
          isActive,
        },
        {
          onSuccess: () => setModalVisible(false),
        },
      );
    }
  }

  const getMonthlyEquivalent = (item: RecurringExpense) =>
    item.frequency === "weekly"
      ? item.amount * 4
      : item.frequency === "yearly"
        ? item.amount / 12
        : item.amount;

  const activeExpenses = items.filter(
    (i) => i.isActive && (i.type || "expense") === "expense",
  );
  const activeIncomes = items.filter(
    (i) => i.isActive && i.type === "income",
  );

  const totalMonthlyExpensesARS = activeExpenses
    .filter((i) => (i.currency || "ARS") === "ARS")
    .reduce((sum, i) => sum + getMonthlyEquivalent(i), 0);

  const totalMonthlyIncomesARS = activeIncomes
    .filter((i) => (i.currency || "ARS") === "ARS")
    .reduce((sum, i) => sum + getMonthlyEquivalent(i), 0);

  const netFixedMonthlyARS = totalMonthlyIncomesARS - totalMonthlyExpensesARS;

  const filteredItems = items.filter(
    (i) => (i.type || "expense") === activeTab,
  );

  const parsedApplyNum = parseFloat(realAmountInput.replace(",", "."));
  const applyAmountDiffers =
    applyingItem !== null &&
    !isNaN(parsedApplyNum) &&
    parsedApplyNum > 0 &&
    Math.abs(parsedApplyNum - applyingItem.amount) > 0.009;

  return (
    <SafeAreaView edges={["bottom"]} className="flex-1 bg-surface-900">
      <ScrollView
        className="flex-1"
        contentContainerClassName="px-4 pt-4 pb-10"
        showsVerticalScrollIndicator={false}
      >
        {/* ── Tarjeta Resumen de Flujo Fijo Mensual ────────────────── */}
        <Card className="p-4 mb-3 gap-3">
          <View className="flex-row items-center justify-between">
            <View className="flex-1 mr-2">
              <Typography variant="label">
                Balance fijo mensual estimado
              </Typography>
              <Typography
                numberOfLines={1}
                adjustsFontSizeToFit
                className={`text-2xl font-bold mt-0.5 ${
                  netFixedMonthlyARS >= 0
                    ? "text-success-500"
                    : "text-danger-500"
                }`}
              >
                {netFixedMonthlyARS >= 0 ? "+" : ""}
                {formatCurrency(netFixedMonthlyARS)}{" "}
                <Typography variant="caption" muted>
                  / mes
                </Typography>
              </Typography>
            </View>

            <Pressable
              onPress={openCreateModal}
              className="bg-primary-600 px-3.5 py-2.5 rounded-2xl flex-row items-center gap-1.5 active:opacity-80"
            >
              <MaterialCommunityIcons
                name="plus"
                size={18}
                color={colors.white}
              />
              <Typography className="text-xs font-bold text-white">
                {activeTab === "income" ? "Nuevo ingreso" : "Nuevo gasto"}
              </Typography>
            </Pressable>
          </View>

          <View className="flex-row gap-2.5 pt-2 border-t border-surface-600/50">
            <View className="flex-1 bg-surface-900 p-2.5 rounded-2xl border border-surface-600/50">
              <Typography variant="caption" muted className="text-[11px]">
                Ingresos automáticos ({activeIncomes.length})
              </Typography>
              <Typography
                numberOfLines={1}
                adjustsFontSizeToFit
                className="text-sm font-bold text-success-500 mt-0.5"
              >
                +{formatCurrency(totalMonthlyIncomesARS)}
              </Typography>
            </View>

            <View className="flex-1 bg-surface-900 p-2.5 rounded-2xl border border-surface-600/50">
              <Typography variant="caption" muted className="text-[11px]">
                Gastos automáticos ({activeExpenses.length})
              </Typography>
              <Typography
                numberOfLines={1}
                adjustsFontSizeToFit
                className="text-sm font-bold text-danger-500 mt-0.5"
              >
                -{formatCurrency(totalMonthlyExpensesARS)}
              </Typography>
            </View>
          </View>
        </Card>

        {/* ── Barra de Hora de Consulta Personal por Usuario ───────── */}
        <Pressable onPress={openTimeSettingsModal} className="mb-4">
          <Card className="px-3.5 py-3 flex-row items-center justify-between bg-surface-800 border border-surface-600/70">
            <View className="flex-row items-center gap-2.5 flex-1 mr-2">
              <View className="w-9 h-9 rounded-2xl bg-warning-500/15 items-center justify-center">
                <MaterialCommunityIcons
                  name="clock-alert-outline"
                  size={18}
                  color={colors.warning[500]}
                />
              </View>
              <View className="flex-1">
                <Typography className="text-xs font-bold text-text-primary">
                  Hora personal de consulta (montos variables)
                </Typography>
                <Typography variant="caption" muted className="text-[11px]">
                  Los fijos se aplican solos; los variables preguntan a las{" "}
                  <Typography className="text-[11px] font-bold text-text-primary">
                    {reminderTime} hs
                  </Typography>
                </Typography>
              </View>
            </View>
            <View className="bg-surface-700 px-2.5 py-1.5 rounded-xl flex-row items-center gap-1">
              <Typography className="text-xs font-bold text-primary-600">
                {reminderTime}
              </Typography>
              <MaterialCommunityIcons
                name="pencil-outline"
                size={13}
                color={colors.primary[600]}
              />
            </View>
          </Card>
        </Pressable>

        {/* ── Pestañas: Gastos Automáticos vs Ingresos Automáticos ──── */}
        <View className="flex-row bg-surface-700/80 p-1 rounded-2xl mb-4 border border-surface-600/40">
          <Pressable
            onPress={() => setActiveTab("expense")}
            className={`flex-1 py-2 rounded-xl items-center justify-center flex-row gap-1.5 ${
              activeTab === "expense" ? "bg-surface-800 shadow-sm" : ""
            }`}
          >
            <MaterialCommunityIcons
              name="arrow-down-circle-outline"
              size={16}
              color={
                activeTab === "expense"
                  ? colors.danger[500]
                  : colors.text.muted
              }
            />
            <Typography
              className={`text-xs font-semibold ${
                activeTab === "expense"
                  ? "text-text-primary"
                  : "text-text-muted"
              }`}
            >
              Gastos automáticos (
              {items.filter((i) => (i.type || "expense") === "expense").length})
            </Typography>
          </Pressable>

          <Pressable
            onPress={() => setActiveTab("income")}
            className={`flex-1 py-2 rounded-xl items-center justify-center flex-row gap-1.5 ${
              activeTab === "income" ? "bg-surface-800 shadow-sm" : ""
            }`}
          >
            <MaterialCommunityIcons
              name="arrow-up-circle-outline"
              size={16}
              color={
                activeTab === "income"
                  ? colors.success[500]
                  : colors.text.muted
              }
            />
            <Typography
              className={`text-xs font-semibold ${
                activeTab === "income"
                  ? "text-text-primary"
                  : "text-text-muted"
              }`}
            >
              Ingresos automáticos (
              {items.filter((i) => i.type === "income").length})
            </Typography>
          </Pressable>
        </View>

        {/* ── Lista de Registros Automáticos ───────────────────────── */}
        {isLoading ? (
          <View className="py-16 items-center justify-center">
            <ActivityIndicator size="large" color={colors.primary[500]} />
          </View>
        ) : filteredItems.length === 0 ? (
          <Card className="items-center py-10 px-5 gap-3">
            <MaterialCommunityIcons
              name={
                activeTab === "income" ? "cash-multiple" : "calendar-sync"
              }
              size={44}
              color={colors.text.muted}
            />
            <Typography variant="h3" className="text-center">
              {activeTab === "income"
                ? "Sin ingresos automáticos registrados"
                : "Sin gastos automáticos registrados"}
            </Typography>
            <Typography variant="caption" muted className="text-center">
              {activeTab === "income"
                ? "Guarda tu sueldo, beca, alquiler cobrado o ingresos recurrentes y elige si se acreditan solos (fijos) o si prefieres confirmar el monto (variables)."
                : "Guarda tus suscripciones, alquiler, servicios o débitos automáticos y elige si se descuentan solos (fijos) o si prefieres confirmar si cambió el precio (variables)."}
            </Typography>
            <Button
              title={
                activeTab === "income"
                  ? "+ Agregar ingreso automático"
                  : "+ Agregar gasto automático"
              }
              onPress={openCreateModal}
              className="mt-2"
            />
          </Card>
        ) : (
          <View className="gap-3">
            {filteredItems.map((item) => {
              const isInc = item.type === "income";
              const linkedAccount = accounts.find(
                (a) => a.id === item.accountId,
              );
              const accountName =
                linkedAccount?.name ?? item.accountName ?? "Cuenta";
              const accountColor =
                linkedAccount?.color ??
                item.accountColor ??
                colors.primary[500];
              const freqLabel =
                item.frequency === "yearly"
                  ? "Anual"
                  : item.frequency === "weekly"
                    ? "Semanal"
                    : "Mensual";

              return (
                <Pressable
                  key={item.id}
                  onPress={() => openEditModal(item)}
                >
                  <Card
                    className={`p-4 gap-3 ${!item.isActive ? "opacity-60" : ""}`}
                  >
                    {/* Fila 1: Ícono + Nombre y Cuenta + Monto */}
                    <View className="flex-row items-start justify-between">
                      <View className="flex-row items-center gap-3 flex-1 mr-3">
                        <View
                          className="w-11 h-11 rounded-2xl items-center justify-center shrink-0"
                          style={{ backgroundColor: `${item.color}20` }}
                        >
                          <MaterialCommunityIcons
                            name={
                              (item.icon as keyof typeof MaterialCommunityIcons.glyphMap) ||
                              "calendar-sync"
                            }
                            size={22}
                            color={item.color || colors.primary[500]}
                          />
                        </View>

                        <View className="flex-1 gap-0.5">
                          <Typography
                            numberOfLines={1}
                            className="font-bold text-base text-text-primary"
                          >
                            {item.name}
                          </Typography>

                          <View className="flex-row items-center gap-1.5">
                            <View
                              className="w-2.5 h-2.5 rounded-full shrink-0"
                              style={{ backgroundColor: accountColor }}
                            />
                            <Typography
                              variant="caption"
                              numberOfLines={1}
                              className="font-medium text-text-secondary flex-1"
                            >
                              {isInc ? "Acredita en:" : "Paga con:"} {accountName}
                            </Typography>
                          </View>
                        </View>
                      </View>

                      <View className="items-end shrink-0">
                        <Typography
                          numberOfLines={1}
                          adjustsFontSizeToFit
                          className={`font-bold text-base ${
                            isInc ? "text-success-500" : "text-danger-500"
                          }`}
                        >
                          {isInc ? "+" : "-"}
                          {formatCurrency(item.amount, item.currency)}
                        </Typography>
                        <Typography
                          variant="caption"
                          muted
                          className="text-[10px]"
                        >
                          {item.isVariable ? "Monto estimado" : "Monto fijo"}
                        </Typography>
                      </View>
                    </View>

                    {/* Fila 2: Chips de Fecha, Frecuencia y Modo (Fijo vs Variable) */}
                    <View className="flex-row flex-wrap items-center gap-1.5">
                      <View className="px-2.5 py-1 rounded-xl bg-surface-700/80 flex-row items-center gap-1.5">
                        <MaterialCommunityIcons
                          name="calendar-clock"
                          size={13}
                          color={colors.text.secondary}
                        />
                        <Typography
                          variant="caption"
                          className="text-[11px] font-medium text-text-secondary"
                        >
                          Día {item.dueDay} (próx: {item.dueDate}) • {freqLabel}
                        </Typography>
                      </View>

                      <View
                        className={`px-2.5 py-1 rounded-xl flex-row items-center gap-1 ${
                          item.isVariable
                            ? "bg-warning-500/15"
                            : "bg-success-500/15"
                        }`}
                      >
                        <MaterialCommunityIcons
                          name={
                            item.isVariable
                              ? "clock-alert-outline"
                              : "flash-outline"
                          }
                          size={12}
                          color={
                            item.isVariable
                              ? colors.warning[500]
                              : colors.success[500]
                          }
                        />
                        <Typography
                          className={`text-[11px] font-bold ${
                            item.isVariable
                              ? "text-warning-500"
                              : "text-success-500"
                          }`}
                        >
                          {item.isVariable
                            ? `Variable (${reminderTime})`
                            : "Fijo (Auto)"}
                        </Typography>
                      </View>

                      {!item.isActive && (
                        <View className="px-2 py-1 rounded-xl bg-surface-700">
                          <Typography className="text-[11px] font-semibold text-text-muted">
                            Pausado
                          </Typography>
                        </View>
                      )}
                    </View>

                    {/* Fila 3: Barra de Acciones */}
                    <View className="flex-row items-center gap-2 pt-2.5 border-t border-surface-600/50">
                      <Pressable
                        onPress={() => openApplyModal(item)}
                        className="flex-1 flex-row items-center justify-center gap-1.5 py-2 px-3 rounded-xl bg-success-500/15 active:opacity-75"
                      >
                        <MaterialCommunityIcons
                          name="check-circle-outline"
                          size={15}
                          color={colors.success[500]}
                        />
                        <Typography className="text-xs font-bold text-success-500">
                          {isInc ? "Acreditar hoy" : "Descontar hoy"}
                        </Typography>
                      </Pressable>

                      <Pressable
                        onPress={() => openEditModal(item)}
                        className="px-3 py-2 rounded-xl bg-surface-700 flex-row items-center gap-1 active:bg-surface-600"
                      >
                        <MaterialCommunityIcons
                          name="pencil-outline"
                          size={14}
                          color={colors.text.secondary}
                        />
                        <Typography className="text-xs font-semibold text-text-secondary">
                          Editar
                        </Typography>
                      </Pressable>

                      <Pressable
                        onPress={() => deleteMutation.mutate(item.id)}
                        disabled={deleteMutation.isPending}
                        className="w-9 h-9 rounded-xl bg-danger-500/10 items-center justify-center active:opacity-75"
                      >
                        <MaterialCommunityIcons
                          name="trash-can-outline"
                          size={15}
                          color={colors.danger[500]}
                        />
                      </Pressable>
                    </View>
                  </Card>
                </Pressable>
              );
            })}
          </View>
        )}
      </ScrollView>

      {/* ── Modal: Configurar Hora Personal de Consulta por Usuario ── */}
      <Modal
        visible={showTimeModal}
        transparent
        animationType="fade"
        onRequestClose={() => setShowTimeModal(false)}
      >
        <KeyboardAvoidingView
          behavior={Platform.OS === "ios" ? "padding" : undefined}
          className="flex-1 bg-black/50 items-center justify-center px-5"
        >
          <View className="w-full max-w-sm bg-surface-800 rounded-3xl p-5 border border-surface-600 gap-4">
            <View className="flex-row items-center justify-between">
              <View className="flex-1 mr-2">
                <Typography variant="h3">Hora de consulta personal</Typography>
                <Typography variant="caption" muted>
                  Guardada en tu cuenta para montos variables
                </Typography>
              </View>
              <Pressable
                onPress={() => setShowTimeModal(false)}
                className="w-8 h-8 rounded-full bg-surface-700 items-center justify-center"
              >
                <MaterialCommunityIcons
                  name="close"
                  size={16}
                  color={colors.text.secondary}
                />
              </Pressable>
            </View>

            <Typography variant="caption" muted>
              Cuando un gasto o ingreso esté marcado como{" "}
              <Typography className="text-xs font-bold text-text-primary">
                Variable
              </Typography>
              , el día de su vencimiento a partir de esta hora te preguntaremos si
              el precio cambió y si deseas registrarlo.
            </Typography>

            <View className="gap-2">
              <Typography variant="label">Horarios rápidos</Typography>
              <View className="flex-row gap-2">
                {REMINDER_TIME_PRESETS.map((preset) => {
                  const selected = customTimeInput.trim() === preset;
                  return (
                    <Pressable
                      key={preset}
                      onPress={() => {
                        setCustomTimeInput(preset);
                        setTimeError(null);
                      }}
                      className={`flex-1 py-2 rounded-xl border items-center ${
                        selected
                          ? "bg-primary-600 border-primary-600"
                          : "bg-surface-700 border-surface-600"
                      }`}
                    >
                      <Typography
                        className={`text-xs font-bold ${
                          selected ? "text-white" : "text-text-primary"
                        }`}
                      >
                        {preset}
                      </Typography>
                    </Pressable>
                  );
                })}
              </View>
            </View>

            <View className="gap-1.5">
              <Typography variant="label">
                Hora exacta (formato 24h HH:mm)
              </Typography>
              <TextInput
                value={customTimeInput}
                onChangeText={(t) => {
                  setCustomTimeInput(t);
                  setTimeError(null);
                }}
                placeholder="09:00"
                placeholderTextColor={colors.text.muted}
                maxLength={5}
                className="bg-surface-700 text-text-primary px-4 py-3 rounded-2xl font-bold text-lg text-center"
              />
            </View>

            {timeError && (
              <Typography className="text-xs font-semibold text-danger-500 text-center">
                {timeError}
              </Typography>
            )}

            <Button
              title="Guardar mi hora de consulta"
              onPress={handleSaveReminderTime}
              loading={updateSettingsMutation.isPending}
            />
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* ── Modal: Confirmar Monto Real del Mes al Aplicar ──────────── */}
      <Modal
        visible={applyingItem !== null}
        transparent
        animationType="fade"
        onRequestClose={() => setApplyingItem(null)}
      >
        <KeyboardAvoidingView
          behavior={Platform.OS === "ios" ? "padding" : undefined}
          className="flex-1 bg-black/50 items-center justify-center px-5"
        >
          {applyingItem && (
            <View className="w-full max-w-sm bg-surface-800 rounded-3xl p-5 border border-surface-600 gap-4">
              <View className="flex-row items-center justify-between">
                <View className="flex-1 mr-2">
                  <Typography variant="h3">{applyingItem.name}</Typography>
                  <Typography variant="caption" muted>
                    {applyingItem.type === "income"
                      ? "Confirmar monto real recibido"
                      : "Confirmar costo real a descontar"}
                  </Typography>
                </View>
                <Pressable
                  onPress={() => setApplyingItem(null)}
                  className="w-8 h-8 rounded-full bg-surface-700 items-center justify-center"
                >
                  <MaterialCommunityIcons
                    name="close"
                    size={16}
                    color={colors.text.secondary}
                  />
                </Pressable>
              </View>

              <View className="gap-1.5">
                <View className="flex-row items-center justify-between">
                  <Typography variant="label">
                    Monto real de este mes ({applyingItem.currency})
                  </Typography>
                  <Typography variant="caption" muted className="text-[11px]">
                    Fijado:{" "}
                    {formatCurrency(
                      applyingItem.amount,
                      applyingItem.currency,
                    )}
                  </Typography>
                </View>
                <TextInput
                  value={realAmountInput}
                  onChangeText={setRealAmountInput}
                  keyboardType="decimal-pad"
                  placeholder="0.00"
                  placeholderTextColor={colors.text.muted}
                  className="bg-surface-700 text-text-primary px-4 py-3 rounded-2xl font-bold text-xl"
                />
                <Typography variant="caption" muted className="text-[11px]">
                  Si este mes el servicio o ingreso vino con un valor distinto,
                  ajústalo aquí antes de confirmar.
                </Typography>
              </View>

              {/* Opción para actualizar el valor fijo futuro cuando el monto real cambió */}
              {applyAmountDiffers && (
                <Pressable
                  onPress={() => setUpdateBaseAmount(!updateBaseAmount)}
                  className="flex-row items-center justify-between bg-primary-600/10 border border-primary-600/40 p-3 rounded-2xl"
                >
                  <View className="flex-1 mr-2">
                    <Typography className="text-xs font-bold text-text-primary">
                      Actualizar valor base futuro
                    </Typography>
                    <Typography
                      variant="caption"
                      muted
                      className="text-[11px]"
                    >
                      Guardar{" "}
                      {formatCurrency(parsedApplyNum, applyingItem.currency)}{" "}
                      como nuevo monto para los próximos meses
                    </Typography>
                  </View>
                  <MaterialCommunityIcons
                    name={
                      updateBaseAmount
                        ? "checkbox-marked-circle"
                        : "checkbox-blank-circle-outline"
                    }
                    size={24}
                    color={
                      updateBaseAmount
                        ? colors.primary[600]
                        : colors.text.muted
                    }
                  />
                </Pressable>
              )}

              <View className="gap-1.5">
                <Typography variant="label">Nota opcional</Typography>
                <TextInput
                  value={applyNote}
                  onChangeText={setApplyNote}
                  placeholder="Ej. Factura con ajuste / Bono extra..."
                  placeholderTextColor={colors.text.muted}
                  className="bg-surface-700 text-text-primary px-3.5 py-2.5 rounded-2xl text-sm"
                />
              </View>

              <Button
                title={
                  applyingItem.type === "income"
                    ? "Confirmar y acreditar en cuenta"
                    : "Confirmar y descontar de cuenta"
                }
                onPress={handleConfirmApply}
                loading={payMutation.isPending}
              />
            </View>
          )}
        </KeyboardAvoidingView>
      </Modal>

      {/* ── Modal Crear / Editar Gasto o Ingreso Automático ────────── */}
      <Modal
        visible={modalVisible}
        transparent
        animationType="slide"
        onRequestClose={() => setModalVisible(false)}
      >
        <KeyboardAvoidingView
          behavior={Platform.OS === "ios" ? "padding" : undefined}
          className="flex-1 bg-black/50 justify-end"
        >
          <View className="bg-surface-800 rounded-t-3xl p-5 max-h-[92%] border-t border-surface-600">
            <View className="flex-row items-center justify-between mb-4">
              <Typography variant="h2">
                {editingItem
                  ? itemType === "income"
                    ? "Editar ingreso automático"
                    : "Editar gasto automático"
                  : itemType === "income"
                    ? "Nuevo ingreso automático"
                    : "Nuevo gasto automático"}
              </Typography>
              <Pressable
                onPress={() => setModalVisible(false)}
                className="w-8 h-8 rounded-full bg-surface-700 items-center justify-center"
              >
                <MaterialCommunityIcons
                  name="close"
                  size={18}
                  color={colors.text.secondary}
                />
              </Pressable>
            </View>

            <ScrollView
              showsVerticalScrollIndicator={false}
              contentContainerClassName="gap-4 pb-6"
            >
              {/* Selector de Tipo: Gasto vs Ingreso */}
              <View className="flex-row gap-2">
                <Pressable
                  onPress={() => setItemType("expense")}
                  className={`flex-1 py-2.5 rounded-2xl border items-center flex-row justify-center gap-1.5 ${
                    itemType === "expense"
                      ? "bg-danger-500/15 border-danger-500"
                      : "bg-surface-700 border-surface-600"
                  }`}
                >
                  <MaterialCommunityIcons
                    name="arrow-down-circle-outline"
                    size={16}
                    color={
                      itemType === "expense"
                        ? colors.danger[500]
                        : colors.text.secondary
                    }
                  />
                  <Typography
                    className={`text-xs font-bold ${
                      itemType === "expense"
                        ? "text-danger-500"
                        : "text-text-secondary"
                    }`}
                  >
                    Gasto automático
                  </Typography>
                </Pressable>

                <Pressable
                  onPress={() => setItemType("income")}
                  className={`flex-1 py-2.5 rounded-2xl border items-center flex-row justify-center gap-1.5 ${
                    itemType === "income"
                      ? "bg-success-500/15 border-success-500"
                      : "bg-surface-700 border-surface-600"
                  }`}
                >
                  <MaterialCommunityIcons
                    name="arrow-up-circle-outline"
                    size={16}
                    color={
                      itemType === "income"
                        ? colors.success[500]
                        : colors.text.secondary
                    }
                  />
                  <Typography
                    className={`text-xs font-bold ${
                      itemType === "income"
                        ? "text-success-500"
                        : "text-text-secondary"
                    }`}
                  >
                    Ingreso automático
                  </Typography>
                </Pressable>
              </View>

              {/* Selector de Comportamiento: Fijo (Automático) vs Variable (Pregunta a la hora) */}
              <View className="gap-1.5">
                <Typography variant="label">
                  ¿El monto es fijo o varía cada mes?
                </Typography>
                <View className="flex-row gap-2">
                  <Pressable
                    onPress={() => setIsVariable(false)}
                    className={`flex-1 p-3 rounded-2xl border gap-1 ${
                      !isVariable
                        ? "bg-success-500/15 border-success-500"
                        : "bg-surface-700 border-surface-600"
                    }`}
                  >
                    <View className="flex-row items-center gap-1.5">
                      <MaterialCommunityIcons
                        name="flash-outline"
                        size={16}
                        color={
                          !isVariable
                            ? colors.success[500]
                            : colors.text.secondary
                        }
                      />
                      <Typography
                        className={`text-xs font-bold ${
                          !isVariable
                            ? "text-success-500"
                            : "text-text-primary"
                        }`}
                      >
                        Monto Fijo
                      </Typography>
                    </View>
                    <Typography variant="caption" muted className="text-[11px]">
                      {itemType === "income"
                        ? "Acredita automáticamente el día indicado"
                        : "Descuenta automáticamente el día indicado"}
                    </Typography>
                  </Pressable>

                  <Pressable
                    onPress={() => setIsVariable(true)}
                    className={`flex-1 p-3 rounded-2xl border gap-1 ${
                      isVariable
                        ? "bg-warning-500/15 border-warning-500"
                        : "bg-surface-700 border-surface-600"
                    }`}
                  >
                    <View className="flex-row items-center gap-1.5">
                      <MaterialCommunityIcons
                        name="clock-alert-outline"
                        size={16}
                        color={
                          isVariable
                            ? colors.warning[500]
                            : colors.text.secondary
                        }
                      />
                      <Typography
                        className={`text-xs font-bold ${
                          isVariable
                            ? "text-warning-500"
                            : "text-text-primary"
                        }`}
                      >
                        Monto Variable
                      </Typography>
                    </View>
                    <Typography variant="caption" muted className="text-[11px]">
                      Pregunta el día indicado a las {reminderTime} hs si cambió
                    </Typography>
                  </Pressable>
                </View>
              </View>

              {/* 1. Nombre */}
              <View className="gap-1.5">
                <Typography variant="label">
                  {itemType === "income"
                    ? "Nombre del ingreso"
                    : "Nombre del gasto"}
                </Typography>
                <TextInput
                  value={name}
                  onChangeText={setName}
                  placeholder={
                    itemType === "income"
                      ? "Ej. Sueldo mensual, Alquiler cobrado, Beca..."
                      : "Ej. Netflix, Alquiler, Internet, Luz..."
                  }
                  placeholderTextColor={colors.text.muted}
                  className="bg-surface-700 text-text-primary px-4 py-3 rounded-2xl font-sans text-base"
                />
              </View>

              {/* 2. Monto y Fecha */}
              <View className="flex-row gap-3">
                <View className="flex-1 gap-1.5">
                  <Typography variant="label">
                    {isVariable ? "Monto base estimado" : "Monto fijo"}
                  </Typography>
                  <TextInput
                    value={amount}
                    onChangeText={setAmount}
                    keyboardType="decimal-pad"
                    placeholder="0.00"
                    placeholderTextColor={colors.text.muted}
                    className="bg-surface-700 text-text-primary px-4 py-3 rounded-2xl font-bold text-base"
                  />
                </View>

                <View className="flex-1 gap-1.5">
                  <Typography variant="label">
                    {itemType === "income"
                      ? "Fecha de cobro"
                      : "Fecha de pago"}
                  </Typography>
                  <TextInput
                    value={dueDate}
                    onChangeText={setDueDate}
                    placeholder="YYYY-MM-DD o Día"
                    placeholderTextColor={colors.text.muted}
                    className="bg-surface-700 text-text-primary px-4 py-3 rounded-2xl font-sans text-base"
                  />
                </View>
              </View>

              {/* 3. Cuenta asociada */}
              <View className="gap-1.5">
                <Typography variant="label">
                  {itemType === "income"
                    ? "Cuenta donde se acredita"
                    : "Cuenta con la que pagas"}
                </Typography>
                {accounts.length === 0 ? (
                  <Pressable
                    onPress={() => {
                      setModalVisible(false);
                      router.push("/accounts/new");
                    }}
                    className="p-3 rounded-2xl bg-surface-700 items-center"
                  >
                    <Typography className="text-xs font-semibold text-primary-600">
                      + Crear una cuenta primero
                    </Typography>
                  </Pressable>
                ) : (
                  <View className="flex-row flex-wrap gap-2">
                    {accounts.map((acc) => {
                      const selected = acc.id === selectedAccountId;
                      return (
                        <Pressable
                          key={acc.id}
                          onPress={() => setSelectedAccountId(acc.id)}
                          className={`px-3 py-2 rounded-2xl border flex-row items-center gap-2 ${
                            selected
                              ? "bg-primary-600/15 border-primary-600"
                              : "bg-surface-700 border-surface-600/60"
                          }`}
                        >
                          <View
                            className="w-2.5 h-2.5 rounded-full"
                            style={{ backgroundColor: acc.color }}
                          />
                          <Typography
                            className={`text-xs font-semibold ${
                              selected
                                ? "text-primary-600"
                                : "text-text-primary"
                            }`}
                          >
                            {acc.name} ({acc.currency})
                          </Typography>
                        </Pressable>
                      );
                    })}
                  </View>
                )}
              </View>

              {/* 4. Frecuencia */}
              <View className="gap-1.5">
                <Typography variant="label">Frecuencia</Typography>
                <View className="flex-row gap-2">
                  {FREQUENCIES.map((f) => {
                    const active = frequency === f.id;
                    return (
                      <Pressable
                        key={f.id}
                        onPress={() => setFrequency(f.id)}
                        className={`flex-1 py-2.5 rounded-2xl border items-center ${
                          active
                            ? "bg-primary-600 border-primary-600"
                            : "bg-surface-700 border-surface-600/60"
                        }`}
                      >
                        <Typography
                          className={`text-xs font-bold ${
                            active ? "text-white" : "text-text-secondary"
                          }`}
                        >
                          {f.label}
                        </Typography>
                      </Pressable>
                    );
                  })}
                </View>
              </View>

              {/* 5. Ícono y Color */}
              <View className="gap-1.5">
                <Typography variant="label">Ícono</Typography>
                <View className="flex-row flex-wrap gap-2">
                  {RECURRING_ICONS.map((ic) => {
                    const active = icon === ic;
                    return (
                      <Pressable
                        key={ic}
                        onPress={() => setIcon(ic)}
                        className={`w-10 h-10 rounded-2xl items-center justify-center border ${
                          active
                            ? "border-primary-600 bg-primary-600/15"
                            : "border-surface-600 bg-surface-700"
                        }`}
                      >
                        <MaterialCommunityIcons
                          name={ic}
                          size={20}
                          color={
                            active
                              ? colors.primary[600]
                              : colors.text.secondary
                          }
                        />
                      </Pressable>
                    );
                  })}
                </View>
              </View>

              <View className="gap-1.5">
                <Typography variant="label">Color</Typography>
                <View className="flex-row flex-wrap gap-2.5">
                  {accountColors.map((c) => {
                    const active = color === c;
                    return (
                      <Pressable
                        key={c}
                        onPress={() => setColor(c)}
                        className="w-8 h-8 rounded-full items-center justify-center"
                        style={{ backgroundColor: c }}
                      >
                        {active && (
                          <MaterialCommunityIcons
                            name="check"
                            size={16}
                            color={colors.white}
                          />
                        )}
                      </Pressable>
                    );
                  })}
                </View>
              </View>

              {editingItem && (
                <Pressable
                  onPress={() => setIsActive(!isActive)}
                  className="flex-row items-center justify-between bg-surface-700 p-3.5 rounded-2xl"
                >
                  <Typography className="text-sm font-semibold text-text-primary">
                    Registro automático activo
                  </Typography>
                  <MaterialCommunityIcons
                    name={
                      isActive
                        ? "toggle-switch"
                        : "toggle-switch-off-outline"
                    }
                    size={32}
                    color={
                      isActive ? colors.success[500] : colors.text.muted
                    }
                  />
                </Pressable>
              )}

              {formError && (
                <Typography className="text-xs font-semibold text-danger-500 text-center">
                  {formError}
                </Typography>
              )}

              <Button
                title={
                  editingItem
                    ? "Guardar cambios"
                    : itemType === "income"
                      ? "Guardar ingreso automático"
                      : "Guardar gasto automático"
                }
                onPress={handleSave}
                loading={createMutation.isPending || updateMutation.isPending}
              />
            </ScrollView>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </SafeAreaView>
  );
}
