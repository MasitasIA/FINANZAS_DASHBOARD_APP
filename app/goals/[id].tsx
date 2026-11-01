import { useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Modal,
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
import {
  useGoal,
  useUpdateGoal,
  useDeleteGoal,
  useContributeToGoal,
  useWithdrawFromGoal,
} from "@/hooks/useGoals";
import { useAccounts } from "@/hooks/useAccounts";
import { useTransactions } from "@/hooks/useTransactions";
import {
  formatCurrency,
  formatDate,
  formatRelativeDate,
} from "@/utils/formatters";
import type { GoalStatus, SavingsGoal } from "@/types";
import { colors, accountColors } from "../../tailwind.config";

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

function getSavingPlan(goal: SavingsGoal) {
  if (!goal.deadline || goal.currentAmount >= goal.targetAmount) return null;
  const now = new Date();
  const deadline = new Date(goal.deadline);
  const diffMs = deadline.getTime() - now.getTime();
  const diffDays = Math.ceil(diffMs / (1000 * 60 * 60 * 24));

  if (diffDays <= 0) {
    return { overdue: true, days: 0, perMonth: 0, perWeek: 0 };
  }

  const remaining = Math.max(0, goal.targetAmount - goal.currentAmount);
  const months = Math.max(1, Math.round(diffDays / 30.4));
  const weeks = Math.max(1, Math.round(diffDays / 7));

  return {
    overdue: false,
    days: diffDays,
    months,
    weeks,
    perMonth: remaining / months,
    perWeek: remaining / weeks,
  };
}

export default function GoalDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { data, isLoading } = useGoal(id);
  const goal = data?.data;

  const { data: accountsData } = useAccounts();
  const accounts = (accountsData?.data ?? []).filter(
    (a) => a.type !== "credit",
  );

  const { data: txData, isLoading: loadingTx } = useTransactions({
    goalId: id,
    pageSize: 20,
  });
  const goalTransactions = txData?.data ?? [];

  const { mutate: contribute, isPending: isContributing } =
    useContributeToGoal();
  const { mutate: withdraw, isPending: isWithdrawing } = useWithdrawFromGoal();
  const { mutate: updateGoal, isPending: isUpdating } = useUpdateGoal();
  const { mutate: deleteGoal, isPending: isDeleting } = useDeleteGoal();

  // Modales
  const [activeModal, setActiveModal] = useState<
    "contribute" | "withdraw" | "edit" | null
  >(null);

  // Formulario Aporte / Retiro
  const [modalAmount, setModalAmount] = useState("");
  const [modalAccountId, setModalAccountId] = useState<string>("");
  const [modalNote, setModalNote] = useState("");

  // Formulario Edición
  const [editName, setEditName] = useState("");
  const [editTarget, setEditTarget] = useState("");
  const [editDeadline, setEditDeadline] = useState("");
  const [editStatus, setEditStatus] = useState<GoalStatus>("active");
  const [editColor, setEditColor] = useState("");
  const [editIcon, setEditIcon] =
    useState<keyof typeof MaterialCommunityIcons.glyphMap>("piggy-bank");

  if (isLoading) {
    return (
      <View className="flex-1 bg-surface-900 items-center justify-center">
        <ActivityIndicator size="large" color={colors.primary[500]} />
      </View>
    );
  }

  if (!goal) {
    return (
      <View className="flex-1 bg-surface-900 items-center justify-center px-4">
        <Typography variant="h3" muted>
          Meta no encontrada.
        </Typography>
        <Button
          title="Volver"
          onPress={() => router.back()}
          variant="secondary"
          className="mt-4"
        />
      </View>
    );
  }

  const progress = Math.min(
    (goal.currentAmount / goal.targetAmount) * 100,
    100,
  );
  const remaining = Math.max(0, goal.targetAmount - goal.currentAmount);
  const isCompleted = goal.status === "completed" || progress >= 100;
  const plan = getSavingPlan(goal);

  // Abrir modal de Aporte
  const handleOpenContribute = () => {
    setModalAmount("");
    setModalAccountId(accounts[0]?.id ?? "");
    setModalNote("");
    setActiveModal("contribute");
  };

  // Abrir modal de Retiro
  const handleOpenWithdraw = () => {
    setModalAmount("");
    setModalAccountId(accounts[0]?.id ?? "");
    setModalNote("");
    setActiveModal("withdraw");
  };

  // Abrir modal de Edición
  const handleOpenEdit = () => {
    setEditName(goal.name);
    setEditTarget(String(goal.targetAmount));
    setEditDeadline(goal.deadline ? goal.deadline.split("T")[0] : "");
    setEditStatus(goal.status);
    setEditColor(goal.color);
    setEditIcon(goal.icon as any);
    setActiveModal("edit");
  };

  // Ejecutar Aporte
  const handleConfirmContribute = () => {
    const amt = parseFloat(modalAmount.replace(",", "."));
    if (isNaN(amt) || amt <= 0 || !modalAccountId) return;

    contribute(
      {
        id: goal.id,
        payload: {
          accountId: modalAccountId,
          amount: amt,
          note: modalNote.trim() || undefined,
        },
      },
      {
        onSuccess: () => setActiveModal(null),
      },
    );
  };

  // Ejecutar Retiro
  const handleConfirmWithdraw = () => {
    const amt = parseFloat(modalAmount.replace(",", "."));
    if (isNaN(amt) || amt <= 0 || !modalAccountId) return;

    withdraw(
      {
        id: goal.id,
        payload: {
          accountId: modalAccountId,
          amount: amt,
          note: modalNote.trim() || undefined,
        },
      },
      {
        onSuccess: () => setActiveModal(null),
      },
    );
  };

  // Ejecutar Guardado de Edición
  const handleConfirmEdit = () => {
    const parsedTarget = parseFloat(editTarget.replace(",", "."));
    if (!editName.trim() || isNaN(parsedTarget) || parsedTarget <= 0) return;

    let deadlineIso = goal.deadline;
    if (editDeadline.trim()) {
      const d = new Date(editDeadline.trim());
      if (!isNaN(d.getTime())) {
        deadlineIso = d.toISOString();
      }
    } else {
      deadlineIso = undefined;
    }

    updateGoal(
      {
        id: goal.id,
        data: {
          name: editName.trim(),
          targetAmount: parsedTarget,
          deadline: deadlineIso,
          status: editStatus,
          color: editColor,
          icon: editIcon,
        },
      },
      {
        onSuccess: () => setActiveModal(null),
      },
    );
  };

  // Confirmar Eliminación
  const handleDelete = () => {
    const executeDelete = () => {
      deleteGoal(goal.id, {
        onSuccess: () => router.back(),
      });
    };

    if (Platform.OS === "web") {
      if (
        confirm(`¿Estás seguro de que deseas eliminar la meta "${goal.name}"?`)
      ) {
        executeDelete();
      }
    } else {
      Alert.alert(
        "Eliminar meta",
        `¿Estás seguro de que deseas eliminar la meta "${goal.name}"?`,
        [
          { text: "Cancelar", style: "cancel" },
          { text: "Eliminar", style: "destructive", onPress: executeDelete },
        ],
      );
    }
  };

  return (
    <SafeAreaView edges={["bottom"]} className="flex-1 bg-surface-900">
      <ScrollView
        contentContainerClassName="px-4 py-6 gap-5"
        showsVerticalScrollIndicator={false}
      >
        {/* ── Header Card ────────────────────────────────────── */}
        <Card className="items-center gap-3 relative">
          <View className="flex-row items-center justify-between w-full">
            {/* Estado Badge */}
            <View
              className={`px-3 py-1 rounded-full flex-row items-center gap-1.5 ${
                isCompleted
                  ? "bg-success-50"
                  : goal.status === "paused"
                    ? "bg-warning-50"
                    : "bg-primary-50"
              }`}
            >
              <MaterialCommunityIcons
                name={
                  isCompleted
                    ? "check-circle"
                    : goal.status === "paused"
                      ? "pause-circle"
                      : "clock-outline"
                }
                size={14}
                color={
                  isCompleted
                    ? colors.success[500]
                    : goal.status === "paused"
                      ? colors.warning[500]
                      : colors.primary[500]
                }
              />
              <Typography
                className={`text-xs font-semibold ${
                  isCompleted
                    ? "text-success-500"
                    : goal.status === "paused"
                      ? "text-warning-500"
                      : "text-primary-600"
                }`}
              >
                {isCompleted
                  ? "Completada"
                  : goal.status === "paused"
                    ? "Pausada"
                    : "Activa"}
              </Typography>
            </View>

            {/* Botón Editar */}
            <Pressable
              onPress={handleOpenEdit}
              className="flex-row items-center gap-1 px-3 py-1.5 rounded-xl bg-surface-700/80 active:bg-surface-600"
            >
              <MaterialCommunityIcons
                name="pencil"
                size={15}
                color={colors.text.secondary}
              />
              <Typography
                variant="caption"
                className="font-semibold text-text-primary"
              >
                Editar
              </Typography>
            </Pressable>
          </View>

          {/* Avatar Icon */}
          <View
            className="w-16 h-16 rounded-3xl items-center justify-center my-1"
            style={{ backgroundColor: goal.color + "22" }}
          >
            <MaterialCommunityIcons
              name={goal.icon as any}
              size={34}
              color={goal.color}
            />
          </View>

          <Typography variant="h1" className="text-center">
            {goal.name}
          </Typography>

          {goal.deadline && (
            <View className="flex-row items-center gap-1.5">
              <MaterialCommunityIcons
                name="calendar-clock"
                size={16}
                color={colors.text.muted}
              />
              <Typography variant="caption" muted>
                Fecha límite: {formatDate(goal.deadline)}
              </Typography>
            </View>
          )}
        </Card>

        {/* ── Progreso ───────────────────────────────────────── */}
        <Card className="gap-4">
          <View className="flex-row justify-between items-center">
            <Typography variant="label">Progreso acumulado</Typography>
            <Typography
              className="text-lg font-bold"
              style={{ color: goal.color }}
            >
              {Math.round(progress)}%
            </Typography>
          </View>

          <View className="h-3.5 bg-surface-600 rounded-full overflow-hidden">
            <View
              className="h-full rounded-full"
              style={{ width: `${progress}%`, backgroundColor: goal.color }}
            />
          </View>

          <View className="flex-row justify-between pt-1">
            <View>
              <Typography variant="label">Ahorrado</Typography>
              <Typography className="text-lg font-bold text-success-500 mt-0.5">
                {formatCurrency(goal.currentAmount, goal.currency)}
              </Typography>
            </View>
            <View className="items-center">
              <Typography variant="label">Restante</Typography>
              <Typography className="text-lg font-bold text-warning-500 mt-0.5">
                {formatCurrency(remaining, goal.currency)}
              </Typography>
            </View>
            <View className="items-end">
              <Typography variant="label">Objetivo</Typography>
              <Typography className="text-lg font-bold text-text-primary mt-0.5">
                {formatCurrency(goal.targetAmount, goal.currency)}
              </Typography>
            </View>
          </View>

          {/* Banner de felicitación si está completada */}
          {isCompleted && (
            <View className="bg-success-50 p-3 rounded-2xl flex-row items-center gap-2.5 mt-1 border border-success-400/30">
              <MaterialCommunityIcons
                name="party-popper"
                size={24}
                color={colors.success[500]}
              />
              <View className="flex-1">
                <Typography className="font-semibold text-success-600 text-sm">
                  ¡Objetivo alcanzado!
                </Typography>
                <Typography variant="caption" className="text-success-600/80">
                  Completaste con éxito tu meta de ahorro.
                </Typography>
              </View>
            </View>
          )}
        </Card>

        {/* ── Calculadora de ahorro sugerido ─────────────────── */}
        {plan && !isCompleted && (
          <Card className="gap-2 bg-surface-800">
            <View className="flex-row items-center gap-2">
              <MaterialCommunityIcons
                name="calculator"
                size={20}
                color={colors.primary[500]}
              />
              <Typography variant="h3">Plan de ahorro sugerido</Typography>
            </View>

            {plan.overdue ? (
              <Typography variant="caption" className="text-danger-500">
                La fecha límite original ha pasado. Puedes editarla para
                recalcular el plan.
              </Typography>
            ) : (
              <>
                <Typography variant="caption" muted>
                  Para llegar a tu meta en {plan.days} días ({plan.months}{" "}
                  {plan.months === 1 ? "mes" : "meses"}):
                </Typography>

                <View className="flex-row gap-3 pt-1">
                  <View className="flex-1 bg-surface-700/60 p-3 rounded-2xl">
                    <Typography variant="caption" muted>
                      Por mes
                    </Typography>
                    <Typography className="text-base font-bold text-primary-600 mt-0.5">
                      {formatCurrency(plan.perMonth, goal.currency)}
                    </Typography>
                  </View>

                  <View className="flex-1 bg-surface-700/60 p-3 rounded-2xl">
                    <Typography variant="caption" muted>
                      Por semana
                    </Typography>
                    <Typography className="text-base font-bold text-primary-600 mt-0.5">
                      {formatCurrency(plan.perWeek, goal.currency)}
                    </Typography>
                  </View>
                </View>
              </>
            )}
          </Card>
        )}

        {/* ── Acciones principales ───────────────────────────── */}
        <View className="flex-row gap-3">
          <Button
            title="+ Aportar fondos"
            onPress={handleOpenContribute}
            className="flex-1"
          />
          <Button
            title="- Retirar fondos"
            variant="secondary"
            onPress={handleOpenWithdraw}
            disabled={goal.currentAmount <= 0}
            className="flex-1"
          />
        </View>

        {/* ── Historial de transacciones de la meta ─────────── */}
        <View className="gap-3 mt-2">
          <Typography variant="h2">Historial de movimientos</Typography>

          {loadingTx ? (
            <ActivityIndicator color={colors.primary[500]} />
          ) : goalTransactions.length === 0 ? (
            <Card className="items-center py-6 gap-2">
              <MaterialCommunityIcons
                name="piggy-bank-outline"
                size={32}
                color={colors.text.muted}
              />
              <Typography variant="caption" muted className="text-center">
                Aún no has registrado aportes o retiros en esta meta.
              </Typography>
            </Card>
          ) : (
            goalTransactions.map((tx) => {
              const isDeposit =
                tx.type === "expense" ||
                tx.description.toLowerCase().includes("aporte");
              return (
                <Card key={tx.id} className="flex-row items-center gap-3">
                  <View
                    className="w-10 h-10 rounded-2xl items-center justify-center"
                    style={{
                      backgroundColor: isDeposit
                        ? colors.success[500] + "20"
                        : colors.danger[500] + "20",
                    }}
                  >
                    <MaterialCommunityIcons
                      name={isDeposit ? "arrow-down-bold" : "arrow-up-bold"}
                      size={20}
                      color={
                        isDeposit ? colors.success[500] : colors.danger[500]
                      }
                    />
                  </View>

                  <View className="flex-1">
                    <Typography className="font-semibold text-text-primary">
                      {isDeposit ? "Aporte" : "Retiro"}
                    </Typography>
                    <Typography variant="caption" muted>
                      {formatRelativeDate(tx.date)}
                      {tx.note ? ` • ${tx.note}` : ""}
                    </Typography>
                  </View>

                  <Typography
                    className={`font-bold text-base ${
                      isDeposit ? "text-success-500" : "text-danger-500"
                    }`}
                  >
                    {isDeposit ? "+" : "-"}
                    {formatCurrency(tx.amount, tx.currency)}
                  </Typography>
                </Card>
              );
            })
          )}
        </View>

        {/* ── Botón Eliminar Meta ────────────────────────────── */}
        <View className="pt-4 pb-2">
          <Button
            title="Eliminar meta"
            variant="danger"
            loading={isDeleting}
            onPress={handleDelete}
          />
        </View>
      </ScrollView>

      {/* ─── MODAL APORTAR FONDOS ────────────────────────────── */}
      <Modal
        visible={activeModal === "contribute"}
        transparent
        animationType="slide"
        onRequestClose={() => setActiveModal(null)}
      >
        <View className="flex-1 justify-end bg-black/50">
          <View className="bg-surface-800 rounded-t-3xl p-6 gap-4">
            <View className="flex-row items-center justify-between">
              <Typography variant="h2">Aportar a la meta</Typography>
              <Pressable onPress={() => setActiveModal(null)}>
                <MaterialCommunityIcons
                  name="close"
                  size={24}
                  color={colors.text.secondary}
                />
              </Pressable>
            </View>

            {/* Monto */}
            <View>
              <Typography variant="label" className="mb-2">
                Monto a aportar ({goal.currency}) *
              </Typography>
              <TextInput
                value={modalAmount}
                onChangeText={setModalAmount}
                placeholder="0,00"
                placeholderTextColor={colors.text.muted}
                keyboardType="decimal-pad"
                autoFocus
                className="text-3xl font-bold text-text-primary border-b border-surface-600 pb-2"
                style={{ fontFamily: "Inter_700Bold" }}
              />
            </View>

            {/* Cuenta de origen */}
            <View className="gap-2">
              <Typography variant="label">
                Cuenta de origen (de donde sale el dinero)
              </Typography>
              {accounts.map((acc) => {
                const isSelected = modalAccountId === acc.id;
                return (
                  <Pressable
                    key={acc.id}
                    onPress={() => setModalAccountId(acc.id)}
                    className={`flex-row items-center justify-between p-3 rounded-2xl border ${
                      isSelected
                        ? "bg-primary-50 border-primary-600"
                        : "bg-surface-700/60 border-transparent"
                    }`}
                  >
                    <Typography
                      className={
                        isSelected ? "font-semibold text-primary-700" : ""
                      }
                    >
                      {acc.name}
                    </Typography>
                    <Typography variant="caption" muted>
                      {formatCurrency(acc.balance, acc.currency)}
                    </Typography>
                  </Pressable>
                );
              })}
            </View>

            {/* Nota opcional */}
            <View>
              <Typography variant="label" className="mb-1">
                Nota o motivo (opcional)
              </Typography>
              <TextInput
                value={modalNote}
                onChangeText={setModalNote}
                placeholder="Ej: Ahorro de la semana, Sueldo extra..."
                placeholderTextColor={colors.text.muted}
                className="bg-surface-700/60 p-3 rounded-2xl text-base text-text-primary"
                style={{ fontFamily: "Inter_400Regular" }}
              />
            </View>

            <Button
              title="Confirmar aporte"
              loading={isContributing}
              disabled={!modalAmount || !modalAccountId}
              onPress={handleConfirmContribute}
              className="mt-2"
            />
          </View>
        </View>
      </Modal>

      {/* ─── MODAL RETIRAR FONDOS ────────────────────────────── */}
      <Modal
        visible={activeModal === "withdraw"}
        transparent
        animationType="slide"
        onRequestClose={() => setActiveModal(null)}
      >
        <View className="flex-1 justify-end bg-black/50">
          <View className="bg-surface-800 rounded-t-3xl p-6 gap-4">
            <View className="flex-row items-center justify-between">
              <Typography variant="h2">Retirar de la meta</Typography>
              <Pressable onPress={() => setActiveModal(null)}>
                <MaterialCommunityIcons
                  name="close"
                  size={24}
                  color={colors.text.secondary}
                />
              </Pressable>
            </View>

            <Typography variant="caption" muted>
              Disponible ahorrado:{" "}
              {formatCurrency(goal.currentAmount, goal.currency)}
            </Typography>

            {/* Monto */}
            <View>
              <Typography variant="label" className="mb-2">
                Monto a retirar ({goal.currency}) *
              </Typography>
              <TextInput
                value={modalAmount}
                onChangeText={setModalAmount}
                placeholder="0,00"
                placeholderTextColor={colors.text.muted}
                keyboardType="decimal-pad"
                autoFocus
                className="text-3xl font-bold text-text-primary border-b border-surface-600 pb-2"
                style={{ fontFamily: "Inter_700Bold" }}
              />
            </View>

            {/* Cuenta destino */}
            <View className="gap-2">
              <Typography variant="label">
                Cuenta destino (a donde enviar el dinero)
              </Typography>
              {accounts.map((acc) => {
                const isSelected = modalAccountId === acc.id;
                return (
                  <Pressable
                    key={acc.id}
                    onPress={() => setModalAccountId(acc.id)}
                    className={`flex-row items-center justify-between p-3 rounded-2xl border ${
                      isSelected
                        ? "bg-primary-50 border-primary-600"
                        : "bg-surface-700/60 border-transparent"
                    }`}
                  >
                    <Typography
                      className={
                        isSelected ? "font-semibold text-primary-700" : ""
                      }
                    >
                      {acc.name}
                    </Typography>
                    <Typography variant="caption" muted>
                      {formatCurrency(acc.balance, acc.currency)}
                    </Typography>
                  </Pressable>
                );
              })}
            </View>

            {/* Nota opcional */}
            <View>
              <Typography variant="label" className="mb-1">
                Nota o motivo (opcional)
              </Typography>
              <TextInput
                value={modalNote}
                onChangeText={setModalNote}
                placeholder="Ej: Imprevisto, Compra parcial..."
                placeholderTextColor={colors.text.muted}
                className="bg-surface-700/60 p-3 rounded-2xl text-base text-text-primary"
                style={{ fontFamily: "Inter_400Regular" }}
              />
            </View>

            <Button
              title="Confirmar retiro"
              loading={isWithdrawing}
              disabled={
                !modalAmount ||
                !modalAccountId ||
                parseFloat(modalAmount.replace(",", ".")) > goal.currentAmount
              }
              onPress={handleConfirmWithdraw}
              className="mt-2"
            />
          </View>
        </View>
      </Modal>

      {/* ─── MODAL EDITAR META ───────────────────────────────── */}
      <Modal
        visible={activeModal === "edit"}
        transparent
        animationType="slide"
        onRequestClose={() => setActiveModal(null)}
      >
        <View className="flex-1 justify-end bg-black/50">
          <ScrollView className="bg-surface-800 rounded-t-3xl max-h-[85%]">
            <View className="p-6 gap-4">
              <View className="flex-row items-center justify-between">
                <Typography variant="h2">Editar meta</Typography>
                <Pressable onPress={() => setActiveModal(null)}>
                  <MaterialCommunityIcons
                    name="close"
                    size={24}
                    color={colors.text.secondary}
                  />
                </Pressable>
              </View>

              {/* Nombre */}
              <View>
                <Typography variant="label" className="mb-1">
                  Nombre
                </Typography>
                <TextInput
                  value={editName}
                  onChangeText={setEditName}
                  placeholder="Nombre de la meta"
                  placeholderTextColor={colors.text.muted}
                  className="bg-surface-700/60 p-3 rounded-2xl text-base text-text-primary"
                  style={{ fontFamily: "Inter_400Regular" }}
                />
              </View>

              {/* Monto objetivo */}
              <View>
                <Typography variant="label" className="mb-1">
                  Monto objetivo ({goal.currency})
                </Typography>
                <TextInput
                  value={editTarget}
                  onChangeText={setEditTarget}
                  placeholder="0,00"
                  placeholderTextColor={colors.text.muted}
                  keyboardType="decimal-pad"
                  className="bg-surface-700/60 p-3 rounded-2xl text-base text-text-primary"
                  style={{ fontFamily: "Inter_600SemiBold" }}
                />
              </View>

              {/* Fecha límite */}
              <View>
                <Typography variant="label" className="mb-1">
                  Fecha límite (AAAA-MM-DD)
                </Typography>
                <TextInput
                  value={editDeadline}
                  onChangeText={setEditDeadline}
                  placeholder="Ej: 2025-12-31"
                  placeholderTextColor={colors.text.muted}
                  className="bg-surface-700/60 p-3 rounded-2xl text-base text-text-primary"
                  style={{ fontFamily: "Inter_400Regular" }}
                />
              </View>

              {/* Estado */}
              <View className="gap-1.5">
                <Typography variant="label">Estado</Typography>
                <View className="flex-row gap-2">
                  {(["active", "completed", "paused"] as GoalStatus[]).map(
                    (st) => (
                      <Pressable
                        key={st}
                        onPress={() => setEditStatus(st)}
                        className={`flex-1 py-2 rounded-xl items-center ${
                          editStatus === st
                            ? "bg-primary-600"
                            : "bg-surface-700"
                        }`}
                      >
                        <Typography
                          className={`text-xs font-semibold capitalize ${
                            editStatus === st
                              ? "text-white"
                              : "text-text-secondary"
                          }`}
                        >
                          {st === "active"
                            ? "Activa"
                            : st === "completed"
                              ? "Completada"
                              : "Pausada"}
                        </Typography>
                      </Pressable>
                    ),
                  )}
                </View>
              </View>

              {/* Color */}
              <View>
                <Typography variant="label" className="mb-2">
                  Color
                </Typography>
                <View className="flex-row gap-2.5 items-center">
                  {accountColors.map((c) => (
                    <Pressable
                      key={c}
                      onPress={() => setEditColor(c)}
                      className="w-8 h-8 rounded-full items-center justify-center"
                      style={{
                        backgroundColor: c,
                        borderWidth: editColor === c ? 3 : 0,
                        borderColor: colors.text.primary,
                      }}
                    >
                      {editColor === c && (
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

              {/* Ícono */}
              <View>
                <Typography variant="label" className="mb-2">
                  Ícono
                </Typography>
                <View className="flex-row flex-wrap gap-2.5">
                  {GOAL_ICONS.map((i) => (
                    <Pressable
                      key={i}
                      onPress={() => setEditIcon(i)}
                      className={`w-10 h-10 rounded-2xl items-center justify-center ${
                        editIcon === i ? "bg-primary-600" : "bg-surface-700"
                      }`}
                    >
                      <MaterialCommunityIcons
                        name={i}
                        size={20}
                        color={
                          editIcon === i ? colors.white : colors.text.secondary
                        }
                      />
                    </Pressable>
                  ))}
                </View>
              </View>

              <Button
                title="Guardar cambios"
                loading={isUpdating}
                disabled={!editName.trim() || !editTarget}
                onPress={handleConfirmEdit}
                className="mt-2"
              />
            </View>
          </ScrollView>
        </View>
      </Modal>
    </SafeAreaView>
  );
}
