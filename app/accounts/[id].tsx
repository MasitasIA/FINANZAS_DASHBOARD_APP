import { useState } from "react";
import {
  ActivityIndicator,
  Modal,
  Pressable,
  ScrollView,
  TextInput,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { router, useLocalSearchParams } from "expo-router";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import {
  Button,
  Card,
  ColorPicker,
  ConfirmModal,
  IconPicker,
  Typography,
} from "@/components/ui";
import { ShareResourceModal } from "@/components/shared/ShareModals";
import {
  useAccount,
  useAccounts,
  useUpdateAccount,
  useDeleteAccount,
} from "@/hooks/useAccounts";
import {
  useTransactions,
  useCreateTransaction,
  useUpdateTransaction,
  useDeleteTransaction,
} from "@/hooks/useTransactions";
import { useInstallments } from "@/hooks/useInstallments";
import {
  useStatements,
  useGenerateStatement,
  usePayStatement,
} from "@/hooks/useStatements";
import {
  formatCurrency,
  formatDate,
  formatRelativeDate,
} from "@/utils/formatters";
import type { Transaction, CreditCardStatement } from "@/types";
import { useAppTheme } from "@/theme/useAppTheme";

const ACCOUNT_ICONS: (keyof typeof MaterialCommunityIcons.glyphMap)[] = [
  "bank",
  "wallet",
  "cash",
  "credit-card",
  "chart-line",
  "piggy-bank",
  "currency-usd",
];

export default function AccountDetailScreen() {
  const { colors } = useAppTheme();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { data: accountData, isLoading: loadingAccount } = useAccount(id);
  const { data: txData, isLoading: loadingTx } = useTransactions({
    accountId: id,
    pageSize: 30,
  });

  const account = accountData?.data;
  const transactions = txData?.data ?? [];

  // Mutations
  const createTxMutation = useCreateTransaction();
  const updateAccountMutation = useUpdateAccount();
  const deleteAccountMutation = useDeleteAccount();
  const updateTxMutation = useUpdateTransaction();
  const deleteTxMutation = useDeleteTransaction();

  // Modals state
  const [showShareModal, setShowShareModal] = useState(false);
  const [showEditAccountModal, setShowEditAccountModal] = useState(false);
  const [editName, setEditName] = useState("");
  const [editColor, setEditColor] = useState("");
  const [editIcon, setEditIcon] =
    useState<keyof typeof MaterialCommunityIcons.glyphMap>("wallet");
  const [editCreditLimit, setEditCreditLimit] = useState("");
  const [editClosingDay, setEditClosingDay] = useState("");
  const [editDueDay, setEditDueDay] = useState("");

  // Ajustar Saldo state
  const [showAdjustModal, setShowAdjustModal] = useState(false);
  const [adjustTargetInput, setAdjustTargetInput] = useState("");
  const [adjustNote, setAdjustNote] = useState("");

  // Modal de confirmación unificado
  const [confirmModalConfig, setConfirmModalConfig] = useState<{
    visible: boolean;
    title: string;
    message: string;
    confirmText?: string;
    cancelText?: string;
    confirmVariant?: "primary" | "danger" | "warning";
    icon?: keyof typeof MaterialCommunityIcons.glyphMap;
    loading?: boolean;
    onConfirm: () => void;
  }>({
    visible: false,
    title: "",
    message: "",
    onConfirm: () => {},
  });

  // Credit card specific hooks & state
  const [creditTab, setCreditTab] = useState<
    "txs" | "installments" | "statements"
  >("txs");
  const { data: installmentsData, isLoading: loadingInstallments } =
    useInstallments(account?.type === "credit" ? id : undefined);
  const { data: statementsData, isLoading: loadingStatements } = useStatements(
    account?.type === "credit" ? id : undefined,
  );
  const { data: allAccountsData } = useAccounts();
  const generateStatementMutation = useGenerateStatement();
  const payStatementMutation = usePayStatement();

  // Statement payment modal state
  const [statementToPay, setStatementToPay] =
    useState<CreditCardStatement | null>(null);
  const [statementPayAmount, setStatementPayAmount] = useState("");
  const [statementPayFromId, setStatementPayFromId] = useState("");

  const handleOpenPayStatement = (stmt: CreditCardStatement) => {
    setStatementToPay(stmt);
    const remaining = Math.max(0, stmt.totalDue - stmt.paidAmount);
    setStatementPayAmount(remaining > 0 ? String(remaining) : "");
    const firstDebit = (allAccountsData?.data ?? []).find(
      (a) => a.type !== "credit" && a.currency === account?.currency,
    );
    setStatementPayFromId(firstDebit?.id ?? "");
  };

  const handleConfirmPayStatement = () => {
    if (!statementToPay || !statementPayFromId) return;
    const parsed = parseFloat(statementPayAmount.replace(",", "."));
    if (isNaN(parsed) || parsed <= 0) return;

    payStatementMutation.mutate(
      {
        statementId: statementToPay.id,
        data: {
          amount: parsed,
          fromAccountId: statementPayFromId,
          date: new Date().toISOString().slice(0, 10),
          note: `Pago de resumen tarjeta ${account?.name}`,
        },
      },
      {
        onSuccess: () => {
          setStatementToPay(null);
        },
      },
    );
  };

  const handleGenerateStatement = () => {
    generateStatementMutation.mutate({
      accountId: id,
    });
  };

  // Selected Transaction for viewing/editing
  const [selectedTx, setSelectedTx] = useState<Transaction | null>(null);
  const [isEditingTx, setIsEditingTx] = useState(false);
  const [txEditDesc, setTxEditDesc] = useState("");
  const [txEditNote, setTxEditNote] = useState("");
  const [txEditAmount, setTxEditAmount] = useState("");

  if (loadingAccount) {
    return (
      <View className="flex-1 bg-surface-900 items-center justify-center">
        <ActivityIndicator size="large" color={colors.primary[500]} />
      </View>
    );
  }

  if (!account) {
    return (
      <View className="flex-1 bg-surface-900 items-center justify-center px-6">
        <Typography variant="h3" muted className="text-center mb-4">
          Cuenta no encontrada.
        </Typography>
        <Button title="Volver a cuentas" onPress={() => router.back()} />
      </View>
    );
  }

  const isCredit = account.type === "credit";
  const debt = Math.abs(account.balance);
  const limit = account.creditLimit ?? 0;
  const installmentsList = installmentsData?.data ?? [];
  const statementsList = statementsData?.data ?? [];
  const futureInstallmentsDebt = installmentsList
    .filter((i) => i.status === "active")
    .reduce(
      (sum, i) =>
        sum +
        (i.remainingAmountCents
          ? i.remainingAmountCents / 100
          : i.totalAmount -
            i.installmentAmount * (i.paidInstallmentsCount ?? 1)),
      0,
    );
  const totalCommitment = debt + futureInstallmentsDebt;
  const available = Math.max(0, limit - totalCommitment);
  const usagePercent =
    limit > 0 ? Math.min(100, Math.round((totalCommitment / limit) * 100)) : 0;

  // Open Edit Account Modal with current values
  const handleOpenEditAccount = () => {
    setEditName(account.name);
    setEditColor(account.color);
    setEditIcon(
      (account.icon as keyof typeof MaterialCommunityIcons.glyphMap) ||
        "wallet",
    );
    setEditCreditLimit(account.creditLimit ? String(account.creditLimit) : "");
    setEditClosingDay(account.closingDay ? String(account.closingDay) : "");
    setEditDueDay(account.dueDay ? String(account.dueDay) : "");
    setShowEditAccountModal(true);
  };

  const handleSaveAccount = () => {
    if (!editName.trim()) return;

    const parsedLimit =
      isCredit && editCreditLimit
        ? parseFloat(editCreditLimit.replace(",", "."))
        : undefined;
    const parsedClosing =
      isCredit && editClosingDay ? parseInt(editClosingDay, 10) : undefined;
    const parsedDue =
      isCredit && editDueDay ? parseInt(editDueDay, 10) : undefined;

    updateAccountMutation.mutate(
      {
        id: account.id,
        data: {
          name: editName.trim(),
          color: editColor,
          icon: editIcon,
          creditLimit: isNaN(parsedLimit as number) ? undefined : parsedLimit,
          closingDay: isNaN(parsedClosing as number)
            ? undefined
            : parsedClosing,
          dueDay: isNaN(parsedDue as number) ? undefined : parsedDue,
        },
      },
      {
        onSuccess: () => setShowEditAccountModal(false),
      },
    );
  };

  const handleDeleteAccount = () => {
    setConfirmModalConfig({
      visible: true,
      title: "¿Eliminar cuenta?",
      message: `¿Estás seguro de que deseas eliminar la cuenta "${account.name}"? Se eliminarán también todas las transacciones asociadas.`,
      confirmText: "Eliminar cuenta",
      confirmVariant: "danger",
      icon: "trash-can-outline",
      onConfirm: () => {
        setConfirmModalConfig((prev) => ({ ...prev, loading: true }));
        deleteAccountMutation.mutate(account.id, {
          onSuccess: () => {
            setConfirmModalConfig((prev) => ({
              ...prev,
              visible: false,
              loading: false,
            }));
            setShowEditAccountModal(false);
            router.replace("/(tabs)/accounts");
          },
          onError: () => {
            setConfirmModalConfig((prev) => ({ ...prev, loading: false }));
          },
        });
      },
    });
  };

  // Ajustar Saldo Handlers
  const handleOpenAdjustBalance = () => {
    setAdjustTargetInput(account ? String(account.balance) : "");
    setAdjustNote("");
    setShowAdjustModal(true);
  };

  const handlePromptConfirmAdjust = () => {
    if (!account) return;
    const parsedTarget = parseFloat(adjustTargetInput.replace(",", "."));
    if (isNaN(parsedTarget)) return;

    const currentBalance = account.balance;
    const diff = parsedTarget - currentBalance;

    if (Math.abs(diff) < 0.001) {
      setShowAdjustModal(false);
      return;
    }

    const isIncome = diff > 0;
    const diffAbs = Math.abs(diff);

    setShowAdjustModal(false);
    setConfirmModalConfig({
      visible: true,
      title: "¿Confirmar ajuste de saldo?",
      message: `El saldo de "${account.name}" pasará de ${formatCurrency(currentBalance, account.currency)} a ${formatCurrency(parsedTarget, account.currency)}.\n\nSe registrará automáticamente una transacción de ajuste de tipo ${isIncome ? "ingreso" : "gasto"} por ${formatCurrency(diffAbs, account.currency)}.`,
      confirmText: "Confirmar ajuste",
      confirmVariant: "primary",
      icon: "scale-balance",
      onConfirm: () => {
        setConfirmModalConfig((prev) => ({ ...prev, loading: true }));
        createTxMutation.mutate(
          {
            accountId: account.id,
            amount: diffAbs,
            type: isIncome ? "income" : "expense",
            categoryId: isIncome ? "cat-other-inc" : "cat-other-exp",
            description: adjustNote.trim() || "Ajuste de saldo",
            note: `Saldo anterior: ${formatCurrency(currentBalance, account.currency)} -> Nuevo: ${formatCurrency(parsedTarget, account.currency)}${adjustNote.trim() ? ` • ${adjustNote.trim()}` : ""}`,
            date: new Date().toISOString().slice(0, 10),
            currency: account.currency,
          },
          {
            onSuccess: () => {
              setConfirmModalConfig((prev) => ({
                ...prev,
                visible: false,
                loading: false,
              }));
            },
            onError: () => {
              setConfirmModalConfig((prev) => ({ ...prev, loading: false }));
            },
          },
        );
      },
    });
  };

  // Open Transaction Details
  const handleOpenTx = (tx: Transaction) => {
    setSelectedTx(tx);
    setIsEditingTx(false);
    setTxEditDesc(tx.description);
    setTxEditNote(tx.note ?? "");
    setTxEditAmount(String(tx.amount));
  };

  const handleSaveTx = () => {
    if (!selectedTx) return;
    const parsed = parseFloat(txEditAmount.replace(",", "."));
    if (isNaN(parsed) || parsed <= 0) return;

    updateTxMutation.mutate(
      {
        id: selectedTx.id,
        data: {
          description: txEditDesc.trim() || selectedTx.description,
          note: txEditNote.trim() || undefined,
          amount: parsed,
        },
      },
      {
        onSuccess: () => setSelectedTx(null),
      },
    );
  };

  const handleDeleteTx = () => {
    if (!selectedTx) return;
    setConfirmModalConfig({
      visible: true,
      title: "¿Eliminar transacción?",
      message: `¿Estás seguro de que deseas eliminar "${selectedTx.description}"? El saldo de la cuenta se recalculará automáticamente.`,
      confirmText: "Eliminar movimiento",
      confirmVariant: "danger",
      icon: "trash-can-outline",
      onConfirm: () => {
        setConfirmModalConfig((prev) => ({ ...prev, loading: true }));
        deleteTxMutation.mutate(selectedTx.id, {
          onSuccess: () => {
            setConfirmModalConfig((prev) => ({
              ...prev,
              visible: false,
              loading: false,
            }));
            setSelectedTx(null);
          },
          onError: () => {
            setConfirmModalConfig((prev) => ({ ...prev, loading: false }));
          },
        });
      },
    });
  };

  return (
    <SafeAreaView edges={["bottom"]} className="flex-1 bg-surface-900">
      <ScrollView
        contentContainerClassName="px-4 py-6 gap-4"
        showsVerticalScrollIndicator={false}
      >
        {/* ── Encabezado de la cuenta (Fila 1: Info, Fila 2: Acciones) ── */}
        <View className="gap-3">
          {/* Fila 1: Ícono, Nombre y Tipo de cuenta */}
          <View className="flex-row items-center gap-3">
            <View
              className="w-12 h-12 rounded-2xl items-center justify-center shrink-0"
              style={{ backgroundColor: account.color }}
            >
              <MaterialCommunityIcons
                name={
                  (account.icon as keyof typeof MaterialCommunityIcons.glyphMap) ||
                  "wallet"
                }
                size={24}
                color={colors.white}
              />
            </View>
            <View className="flex-1 min-w-0">
              <Typography variant="h2" numberOfLines={1}>
                {account.name}
              </Typography>
              <Typography variant="caption" muted numberOfLines={1} className="mt-0.5">
                {account.type === "credit"
                  ? "Tarjeta de Crédito"
                  : account.type === "savings"
                    ? "Caja de Ahorro"
                    : account.type === "investment"
                      ? "Inversión"
                      : account.type === "cash"
                        ? "Efectivo"
                        : "Cuenta Corriente"}
              </Typography>
            </View>
          </View>

          {/* Fila 2: Botones de acción (Compartir, Editar) */}
          <View className="flex-row items-center gap-2">
            <Pressable
              onPress={() => setShowShareModal(true)}
              className="flex-1 flex-row items-center justify-center gap-2 py-2 px-3 rounded-xl bg-primary-500/15 border border-primary-500/20 active:opacity-80"
            >
              <MaterialCommunityIcons
                name="account-multiple"
                size={16}
                color={colors.primary[500]}
              />
              <Typography
                variant="caption"
                className="font-semibold text-primary-500"
              >
                {account.isShared
                  ? `Compartida${account.members && account.members.length > 1 ? ` (${account.members.length})` : ""}`
                  : "Compartir"}
              </Typography>
            </Pressable>

            <Pressable
              onPress={handleOpenEditAccount}
              className="flex-1 flex-row items-center justify-center gap-2 py-2 px-3 rounded-xl bg-surface-700/80 border border-surface-600/50 active:bg-surface-600"
            >
              <MaterialCommunityIcons
                name="pencil"
                size={16}
                color={colors.text.secondary}
              />
              <Typography
                variant="caption"
                className="font-semibold text-text-secondary"
              >
                Editar
              </Typography>
            </Pressable>
          </View>
        </View>

        {/* ── Balance card ─────────────────────────────────── */}
        {isCredit ? (
          <Card className="gap-4">
            <View className="items-center gap-1">
              <Typography variant="label">Deuda actual del período</Typography>
              <Typography className="text-3xl font-bold text-warning-500">
                {formatCurrency(debt, account.currency)}
              </Typography>
              {futureInstallmentsDebt > 0 && (
                <View className="flex-row items-center gap-1 bg-surface-700/80 px-2.5 py-1 rounded-full mt-0.5">
                  <MaterialCommunityIcons
                    name="credit-card-clock"
                    size={14}
                    color={colors.primary[500]}
                  />
                  <Typography
                    variant="caption"
                    className="text-xs font-medium text-text-secondary"
                  >
                    + {formatCurrency(futureInstallmentsDebt, account.currency)}{" "}
                    en cuotas futuras
                  </Typography>
                </View>
              )}
              <Typography variant="caption" muted className="mt-0.5">
                de {formatCurrency(limit, account.currency)} de límite (
                {usagePercent}% comprometido)
              </Typography>
            </View>

            {/* Barra de progreso */}
            {limit > 0 && (
              <View className="gap-1.5">
                <View className="h-2.5 bg-surface-700 rounded-full overflow-hidden">
                  <View
                    className={`h-full rounded-full ${
                      usagePercent > 85
                        ? "bg-danger-500"
                        : usagePercent > 50
                          ? "bg-warning-500"
                          : "bg-primary-500"
                    }`}
                    style={{ width: `${usagePercent}%` }}
                  />
                </View>
                <View className="flex-row justify-between">
                  <Typography
                    variant="caption"
                    muted
                    className="font-semibold text-text-primary"
                  >
                    Disponible real:{" "}
                    {formatCurrency(available, account.currency)}
                  </Typography>
                  <Typography variant="caption" muted>
                    Límite: {formatCurrency(limit, account.currency)}
                  </Typography>
                </View>
              </View>
            )}

            {/* Fechas de corte y vencimiento */}
            {Boolean(account.closingDay || account.dueDay) && (
              <View className="flex-row gap-3 pt-2 border-t border-surface-700/60">
                {account.closingDay ? (
                  <View className="flex-1 bg-surface-700/60 p-2.5 rounded-xl items-center">
                    <Typography variant="caption" muted>
                      Cierre
                    </Typography>
                    <Typography className="font-semibold text-text-primary mt-0.5">
                      Día {account.closingDay}
                    </Typography>
                  </View>
                ) : null}
                {account.dueDay ? (
                  <View className="flex-1 bg-surface-700/60 p-2.5 rounded-xl items-center">
                    <Typography variant="caption" muted>
                      Vencimiento
                    </Typography>
                    <Typography className="font-semibold text-warning-400 mt-0.5">
                      Día {account.dueDay}
                    </Typography>
                  </View>
                ) : null}
              </View>
            )}

            {Boolean(account.closingDay || account.dueDay) && (
              <View className="flex-row items-center justify-center gap-1.5 -mt-1 mb-1">
                <MaterialCommunityIcons
                  name="bell-ring-outline"
                  size={12}
                  color={colors.primary[500]}
                />
                <Typography variant="caption" muted className="text-[11px]">
                  Avisos automáticos activos: 1 día antes a tu celular
                </Typography>
              </View>
            )}

            {/* Acciones rápidas de tarjeta */}
            <View className="flex-row gap-2 pt-1">
              <Button
                title="Ajustar"
                size="sm"
                variant="secondary"
                icon={
                  <MaterialCommunityIcons
                    name="scale-balance"
                    size={15}
                    color={colors.text.primary}
                  />
                }
                onPress={handleOpenAdjustBalance}
              />
              <Button
                title="+ Gasto"
                size="sm"
                variant="secondary"
                className="flex-1"
                onPress={() =>
                  router.push({
                    pathname: "/transaction/new",
                    params: { accountId: id, type: "expense" },
                  })
                }
              />
              <Button
                title="Pagar tarjeta"
                size="sm"
                className="flex-1"
                onPress={() =>
                  router.push({
                    pathname: "/transaction/new",
                    params: { toAccountId: id, type: "transfer" },
                  })
                }
              />
            </View>
          </Card>
        ) : (
          <Card className="items-center gap-3">
            <Typography variant="label">Balance actual</Typography>
            <Typography
              className={`text-3xl font-bold ${
                account.balance >= 0 ? "text-success-500" : "text-danger-500"
              }`}
            >
              {formatCurrency(account.balance, account.currency)}
            </Typography>
            <View className="flex-row items-center gap-2 pt-1">
              <Button
                title="Ajustar saldo"
                size="sm"
                variant="secondary"
                icon={
                  <MaterialCommunityIcons
                    name="scale-balance"
                    size={16}
                    color={colors.text.primary}
                  />
                }
                onPress={handleOpenAdjustBalance}
              />
              <Button
                title="Movimiento"
                size="sm"
                variant="primary"
                icon={
                  <MaterialCommunityIcons
                    name="plus"
                    size={16}
                    color={colors.white}
                  />
                }
                onPress={() =>
                  router.push({
                    pathname: "/transaction/new",
                    params: { accountId: id },
                  })
                }
              />
            </View>
          </Card>
        )}

        {/* ── Selector de Pestañas para Tarjetas de Crédito ── */}
        {isCredit && (
          <View className="flex-row bg-surface-700/80 p-1 rounded-2xl gap-1 mt-1">
            <Pressable
              onPress={() => setCreditTab("txs")}
              className={`flex-1 py-2 rounded-xl items-center ${
                creditTab === "txs" ? "bg-surface-800 shadow-sm" : ""
              }`}
            >
              <Typography
                className={`text-xs font-semibold ${
                  creditTab === "txs"
                    ? "text-primary-600"
                    : "text-text-secondary"
                }`}
              >
                Movimientos
              </Typography>
            </Pressable>
            <Pressable
              onPress={() => setCreditTab("installments")}
              className={`flex-1 py-2 rounded-xl items-center ${
                creditTab === "installments" ? "bg-surface-800 shadow-sm" : ""
              }`}
            >
              <Typography
                className={`text-xs font-semibold ${
                  creditTab === "installments"
                    ? "text-primary-600"
                    : "text-text-secondary"
                }`}
              >
                Cuotas (
                {installmentsList.filter((i) => i.status === "active").length})
              </Typography>
            </Pressable>
            <Pressable
              onPress={() => setCreditTab("statements")}
              className={`flex-1 py-2 rounded-xl items-center ${
                creditTab === "statements" ? "bg-surface-800 shadow-sm" : ""
              }`}
            >
              <Typography
                className={`text-xs font-semibold ${
                  creditTab === "statements"
                    ? "text-primary-600"
                    : "text-text-secondary"
                }`}
              >
                Resúmenes ({statementsList.length})
              </Typography>
            </Pressable>
          </View>
        )}

        {/* ── Pestaña: Transacciones / Movimientos ───────────── */}
        {(!isCredit || creditTab === "txs") && (
          <>
            <View className="flex-row items-center justify-between pt-2">
              <Typography variant="h2">Transacciones</Typography>
              <Pressable
                onPress={() =>
                  router.push({
                    pathname: "/transaction/new",
                    params: { accountId: id },
                  })
                }
                accessibilityLabel="Agregar transacción"
                className="w-8 h-8 rounded-full bg-primary-600 items-center justify-center active:opacity-80"
              >
                <MaterialCommunityIcons
                  name="plus"
                  size={20}
                  color={colors.white}
                />
              </Pressable>
            </View>

            {loadingTx ? (
              <ActivityIndicator color={colors.primary[500]} />
            ) : transactions.length === 0 ? (
              <Typography variant="caption" muted className="text-center py-8">
                Sin transacciones aún. Toca + para agregar una.
              </Typography>
            ) : (
              transactions.map((tx) => {
                const isCardPayment =
                  isCredit &&
                  tx.type === "transfer" &&
                  tx.toAccountId === account.id;
                const isPositive = tx.type === "income" || isCardPayment;
                return (
                  <Pressable
                    key={tx.id}
                    onPress={() => handleOpenTx(tx)}
                    className="active:opacity-75"
                  >
                    <Card className="flex-row items-center gap-3">
                      <View className="flex-1 min-w-0">
                        <Typography numberOfLines={1}>
                          {tx.description}
                        </Typography>
                        <Typography variant="caption" numberOfLines={1}>
                          {formatRelativeDate(tx.date)}
                          {account.isShared && tx.authorName
                            ? ` • 👤 ${tx.authorName}`
                            : ""}
                        </Typography>
                      </View>
                      <Typography
                        numberOfLines={1}
                        className={`font-semibold shrink-0 ${
                          isPositive ? "text-success-500" : "text-danger-500"
                        }`}
                      >
                        {isPositive ? "+" : "-"}
                        {formatCurrency(tx.amount, tx.currency)}
                      </Typography>
                      <MaterialCommunityIcons
                        name="chevron-right"
                        size={18}
                        color={colors.text.muted}
                      />
                    </Card>
                  </Pressable>
                );
              })
            )}
          </>
        )}

        {/* ── Pestaña: Cuotas en curso (Tarjetas de crédito) ─── */}
        {isCredit && creditTab === "installments" && (
          <>
            <View className="flex-row items-center justify-between pt-2">
              <Typography variant="h2">Cuotas y compras financiadas</Typography>
              <Pressable
                onPress={() =>
                  router.push({
                    pathname: "/transaction/new",
                    params: { accountId: id, type: "expense" },
                  })
                }
                className="flex-row items-center gap-1.5 px-3 py-1.5 rounded-full bg-primary-600 active:opacity-80"
              >
                <MaterialCommunityIcons
                  name="plus"
                  size={16}
                  color={colors.white}
                />
                <Typography
                  variant="caption"
                  className="font-semibold text-white"
                >
                  Nueva cuota
                </Typography>
              </Pressable>
            </View>

            {loadingInstallments ? (
              <ActivityIndicator color={colors.primary[500]} />
            ) : installmentsList.length === 0 ? (
              <Typography variant="caption" muted className="text-center py-8">
                No hay compras en cuotas registradas para esta tarjeta.
              </Typography>
            ) : (
              installmentsList.map((inst) => {
                const paid = inst.paidInstallmentsCount ?? 1;
                const total = inst.installmentsCount;
                const progressPercent = Math.min(
                  100,
                  Math.round((paid / total) * 100),
                );
                const interest = inst.totalAmount - inst.cashPrice;

                return (
                  <Card key={inst.id} className="gap-3">
                    <View className="flex-row items-start justify-between">
                      <View className="flex-1 pr-2">
                        <Typography className="font-bold text-text-primary text-base">
                          {inst.description}
                        </Typography>
                        <Typography variant="caption" muted className="mt-0.5">
                          Inicio: {formatDate(inst.firstDueDate)} • Cuota {paid}{" "}
                          de {total}
                        </Typography>
                      </View>
                      <View className="items-end">
                        <Typography className="font-bold text-sm text-text-primary">
                          {formatCurrency(
                            inst.installmentAmount,
                            account.currency,
                          )}
                          /mes
                        </Typography>
                        <Typography variant="caption" muted>
                          Total:{" "}
                          {formatCurrency(inst.totalAmount, account.currency)}
                        </Typography>
                      </View>
                    </View>

                    {/* Barra de progreso de cuotas */}
                    <View className="gap-1">
                      <View className="h-2 bg-surface-700 rounded-full overflow-hidden">
                        <View
                          className="h-full bg-primary-600 rounded-full"
                          style={{ width: `${progressPercent}%` }}
                        />
                      </View>
                      <View className="flex-row justify-between">
                        <Typography
                          variant="caption"
                          muted
                          className="text-[11px]"
                        >
                          {paid} pagada{paid > 1 ? "s" : ""} ({progressPercent}
                          %)
                        </Typography>
                        <Typography
                          variant="caption"
                          muted
                          className="text-[11px]"
                        >
                          Resta:{" "}
                          {formatCurrency(
                            inst.remainingAmountCents
                              ? inst.remainingAmountCents / 100
                              : inst.totalAmount -
                                  inst.installmentAmount * paid,
                            account.currency,
                          )}
                        </Typography>
                      </View>
                    </View>

                    {/* Información financiera de intereses */}
                    {interest > 0 && (
                      <View className="flex-row items-center gap-1.5 bg-warning-500/10 px-2.5 py-1 rounded-lg">
                        <MaterialCommunityIcons
                          name="information-outline"
                          size={14}
                          color="#f79009"
                        />
                        <Typography className="text-xs text-warning-500 font-medium">
                          Precio contado:{" "}
                          {formatCurrency(inst.cashPrice, account.currency)} •
                          Recargo: +{formatCurrency(interest, account.currency)}
                        </Typography>
                      </View>
                    )}
                  </Card>
                );
              })
            )}
          </>
        )}

        {/* ── Pestaña: Resúmenes de Tarjeta ─────────────────── */}
        {isCredit && creditTab === "statements" && (
          <>
            <View className="flex-row items-center justify-between pt-2">
              <Typography variant="h2">Historial de resúmenes</Typography>
              <Pressable
                onPress={handleGenerateStatement}
                disabled={generateStatementMutation.isPending}
                className="flex-row items-center gap-1.5 px-3 py-1.5 rounded-full bg-primary-600 active:opacity-80"
              >
                {generateStatementMutation.isPending ? (
                  <ActivityIndicator size="small" color={colors.white} />
                ) : (
                  <MaterialCommunityIcons
                    name="file-document-plus-outline"
                    size={16}
                    color={colors.white}
                  />
                )}
                <Typography
                  variant="caption"
                  className="font-semibold text-white"
                >
                  Cerrar período
                </Typography>
              </Pressable>
            </View>

            {loadingStatements ? (
              <ActivityIndicator color={colors.primary[500]} />
            ) : statementsList.length === 0 ? (
              <Typography variant="caption" muted className="text-center py-8">
                No hay resúmenes generados aún. Toca &quot;Cerrar período&quot;
                para registrar el snapshot.
              </Typography>
            ) : (
              statementsList.map((stmt) => {
                const pending = Math.max(0, stmt.totalDue - stmt.paidAmount);
                const isPaid = stmt.status === "paid_full" || pending <= 0;

                return (
                  <Card key={stmt.id} className="gap-3">
                    <View className="flex-row items-start justify-between">
                      <View className="gap-0.5">
                        <View className="flex-row items-center gap-2">
                          <MaterialCommunityIcons
                            name="file-document-outline"
                            size={18}
                            color={colors.primary[500]}
                          />
                          <Typography className="font-bold text-text-primary text-base">
                            Resumen {formatDate(stmt.closingDate)}
                          </Typography>
                        </View>
                        <Typography variant="caption" muted>
                          Vencimiento: {formatDate(stmt.dueDate)}
                        </Typography>
                      </View>

                      <View
                        className={`px-2.5 py-1 rounded-full ${
                          isPaid
                            ? "bg-success-500/15"
                            : stmt.status === "paid_partial"
                              ? "bg-warning-500/15"
                              : "bg-danger-500/15"
                        }`}
                      >
                        <Typography
                          className={`text-xs font-semibold ${
                            isPaid
                              ? "text-success-500"
                              : stmt.status === "paid_partial"
                                ? "text-warning-500"
                                : "text-danger-500"
                          }`}
                        >
                          {isPaid
                            ? "Pagado total"
                            : stmt.status === "paid_partial"
                              ? "Pago parcial"
                              : "Pendiente"}
                        </Typography>
                      </View>
                    </View>

                    <View className="flex-row justify-between pt-2 border-t border-surface-600/40">
                      <View>
                        <Typography
                          variant="caption"
                          muted
                          className="text-[11px]"
                        >
                          Total a pagar
                        </Typography>
                        <Typography className="font-bold text-base text-text-primary">
                          {formatCurrency(stmt.totalDue, account.currency)}
                        </Typography>
                      </View>
                      <View className="items-center">
                        <Typography
                          variant="caption"
                          muted
                          className="text-[11px]"
                        >
                          Pago mínimo
                        </Typography>
                        <Typography className="font-medium text-sm text-text-secondary">
                          {formatCurrency(stmt.minimumDue, account.currency)}
                        </Typography>
                      </View>
                      <View className="items-end">
                        <Typography
                          variant="caption"
                          muted
                          className="text-[11px]"
                        >
                          Saldo impago
                        </Typography>
                        <Typography
                          className={`font-bold text-base ${
                            pending > 0 ? "text-danger-500" : "text-success-500"
                          }`}
                        >
                          {formatCurrency(pending, account.currency)}
                        </Typography>
                      </View>
                    </View>

                    {!isPaid && (
                      <Button
                        title="Pagar resumen"
                        size="sm"
                        onPress={() => handleOpenPayStatement(stmt)}
                      />
                    )}
                  </Card>
                );
              })
            )}
          </>
        )}
      </ScrollView>

      {/* ── MODAL: Compartir Cuenta ─────────────────────────────── */}
      <ShareResourceModal
        visible={showShareModal}
        onClose={() => setShowShareModal(false)}
        resourceType="account"
        resourceId={account.id}
        resourceName={account.name}
        isOwner={account.isOwner !== false}
        members={account.members ?? []}
        onLeftResource={() => router.replace("/(tabs)/accounts")}
      />

      {/* ── MODAL: Editar Cuenta ────────────────────────────────── */}
      <Modal
        visible={showEditAccountModal}
        transparent
        animationType="slide"
        onRequestClose={() => setShowEditAccountModal(false)}
      >
        <View className="flex-1 bg-black/60 justify-end">
          <View className="bg-surface-800 rounded-t-3xl p-6 gap-4 max-h-[85%]">
            <View className="flex-row items-center justify-between pb-2 border-b border-surface-700">
              <Typography variant="h3">Editar cuenta</Typography>
              <Pressable
                onPress={() => setShowEditAccountModal(false)}
                className="p-1 rounded-full bg-surface-700"
              >
                <MaterialCommunityIcons
                  name="close"
                  size={20}
                  color={colors.text.primary}
                />
              </Pressable>
            </View>

            <ScrollView showsVerticalScrollIndicator={false} className="gap-4">
              <View>
                <Typography variant="label" className="mb-1.5">
                  Nombre
                </Typography>
                <TextInput
                  value={editName}
                  onChangeText={setEditName}
                  className="bg-surface-700/60 p-3 rounded-xl text-text-primary text-base"
                  placeholderTextColor={colors.text.muted}
                />
              </View>

              {isCredit && (
                <>
                  <View>
                    <Typography variant="label" className="mb-1.5">
                      Límite de crédito ({account.currency})
                    </Typography>
                    <TextInput
                      value={editCreditLimit}
                      onChangeText={setEditCreditLimit}
                      keyboardType="decimal-pad"
                      className="bg-surface-700/60 p-3 rounded-xl text-text-primary text-base font-bold"
                      placeholderTextColor={colors.text.muted}
                    />
                  </View>

                  <View className="flex-row gap-3">
                    <View className="flex-1">
                      <Typography variant="label" className="mb-1.5">
                        Día de Cierre
                      </Typography>
                      <TextInput
                        value={editClosingDay}
                        onChangeText={setEditClosingDay}
                        keyboardType="number-pad"
                        maxLength={2}
                        className="bg-surface-700/60 p-3 rounded-xl text-text-primary text-base font-semibold"
                        placeholderTextColor={colors.text.muted}
                      />
                    </View>
                    <View className="flex-1">
                      <Typography variant="label" className="mb-1.5">
                        Día de Vencimiento
                      </Typography>
                      <TextInput
                        value={editDueDay}
                        onChangeText={setEditDueDay}
                        keyboardType="number-pad"
                        maxLength={2}
                        className="bg-surface-700/60 p-3 rounded-xl text-text-primary text-base font-semibold"
                        placeholderTextColor={colors.text.muted}
                      />
                    </View>
                  </View>

                  <View className="flex-row items-center gap-1.5 -mt-1">
                    <MaterialCommunityIcons
                      name="bell-outline"
                      size={13}
                      color={colors.primary[500]}
                    />
                    <Typography
                      variant="caption"
                      muted
                      className="text-[11px] flex-1"
                    >
                      Te avisaremos 1 día antes del cierre y del vencimiento.
                    </Typography>
                  </View>
                </>
              )}

              {/* Color */}
              <View>
                <Typography variant="label" className="mb-2">
                  Color
                </Typography>
                <ColorPicker
                  selectedColor={editColor}
                  onSelectColor={setEditColor}
                />
              </View>

              {/* Ícono */}
              <View>
                <Typography variant="label" className="mb-2">
                  Ícono
                </Typography>
                <IconPicker
                  icons={ACCOUNT_ICONS}
                  selectedIcon={editIcon}
                  onSelectIcon={setEditIcon}
                  activeColor={editColor}
                />
              </View>

              <View className="pt-4 gap-2.5">
                <Button
                  title="Guardar cambios"
                  onPress={handleSaveAccount}
                  loading={updateAccountMutation.isPending}
                />
                <Button
                  title="Eliminar cuenta"
                  variant="danger"
                  onPress={handleDeleteAccount}
                  loading={deleteAccountMutation.isPending}
                />
              </View>
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* ── MODAL: Detalle / Edición de Transacción ──────────────── */}
      <Modal
        visible={Boolean(selectedTx)}
        transparent
        animationType="slide"
        onRequestClose={() => setSelectedTx(null)}
      >
        <View className="flex-1 bg-black/60 justify-end">
          <View className="bg-surface-800 rounded-t-3xl p-6 gap-4">
            <View className="flex-row items-center justify-between pb-2 border-b border-surface-700">
              <Typography variant="h3">
                {isEditingTx ? "Editar transacción" : "Detalle de transacción"}
              </Typography>
              <Pressable
                onPress={() => setSelectedTx(null)}
                className="p-1 rounded-full bg-surface-700"
              >
                <MaterialCommunityIcons
                  name="close"
                  size={20}
                  color={colors.text.primary}
                />
              </Pressable>
            </View>

            {selectedTx && !isEditingTx ? (
              <View className="gap-4">
                <View className="items-center py-2">
                  <Typography variant="caption" muted>
                    {selectedTx.type === "income"
                      ? "Ingreso"
                      : selectedTx.type === "expense"
                        ? "Gasto"
                        : "Transferencia"}
                  </Typography>
                  <Typography
                    className={`text-3xl font-bold mt-1 ${
                      selectedTx.type === "income"
                        ? "text-success-500"
                        : "text-danger-500"
                    }`}
                  >
                    {formatCurrency(selectedTx.amount, selectedTx.currency)}
                  </Typography>
                </View>

                <Card className="gap-2.5 bg-surface-700/40">
                  <View className="flex-row justify-between">
                    <Typography variant="caption" muted>
                      Concepto:
                    </Typography>
                    <Typography className="font-semibold text-text-primary">
                      {selectedTx.description}
                    </Typography>
                  </View>
                  {selectedTx.note ? (
                    <View className="flex-row justify-between">
                      <Typography variant="caption" muted>
                        Detalle / Nota:
                      </Typography>
                      <Typography className="text-text-primary">
                        {selectedTx.note}
                      </Typography>
                    </View>
                  ) : null}
                  <View className="flex-row justify-between">
                    <Typography variant="caption" muted>
                      Fecha:
                    </Typography>
                    <Typography className="text-text-primary">
                      {formatDate(selectedTx.date)}
                    </Typography>
                  </View>
                  <View className="flex-row justify-between">
                    <Typography variant="caption" muted>
                      Moneda:
                    </Typography>
                    <Typography className="text-text-primary font-bold">
                      {selectedTx.currency}
                    </Typography>
                  </View>
                </Card>

                <View className="flex-row gap-3 pt-2">
                  <Button
                    title="Editar"
                    variant="secondary"
                    className="flex-1"
                    onPress={() => setIsEditingTx(true)}
                  />
                  <Button
                    title="Eliminar"
                    variant="danger"
                    className="flex-1"
                    onPress={handleDeleteTx}
                    loading={deleteTxMutation.isPending}
                  />
                </View>
              </View>
            ) : selectedTx && isEditingTx ? (
              <View className="gap-4">
                <View>
                  <Typography variant="label" className="mb-1.5">
                    Concepto
                  </Typography>
                  <TextInput
                    value={txEditDesc}
                    onChangeText={setTxEditDesc}
                    className="bg-surface-700/60 p-3 rounded-xl text-text-primary text-base"
                    placeholderTextColor={colors.text.muted}
                  />
                </View>

                <View>
                  <Typography variant="label" className="mb-1.5">
                    Importe ({selectedTx.currency})
                  </Typography>
                  <TextInput
                    value={txEditAmount}
                    onChangeText={setTxEditAmount}
                    keyboardType="decimal-pad"
                    className="bg-surface-700/60 p-3 rounded-xl text-text-primary text-xl font-bold"
                    placeholderTextColor={colors.text.muted}
                  />
                </View>

                <View>
                  <Typography variant="label" className="mb-1.5">
                    Nota adicional
                  </Typography>
                  <TextInput
                    value={txEditNote}
                    onChangeText={setTxEditNote}
                    className="bg-surface-700/60 p-3 rounded-xl text-text-primary text-base"
                    placeholderTextColor={colors.text.muted}
                  />
                </View>

                <View className="flex-row gap-3 pt-2">
                  <Button
                    title="Cancelar"
                    variant="ghost"
                    className="flex-1"
                    onPress={() => setIsEditingTx(false)}
                  />
                  <Button
                    title="Guardar"
                    className="flex-1"
                    onPress={handleSaveTx}
                    loading={updateTxMutation.isPending}
                  />
                </View>
              </View>
            ) : null}
          </View>
        </View>
      </Modal>
      {/* ── MODAL: Pagar Resumen de Tarjeta ────────────────────────── */}
      <Modal
        visible={Boolean(statementToPay)}
        transparent
        animationType="fade"
        onRequestClose={() => setStatementToPay(null)}
      >
        <View className="flex-1 bg-black/50 justify-center items-center px-4">
          <View className="bg-surface-800 rounded-3xl p-6 w-full max-w-sm gap-4 border border-surface-600/80">
            <Typography variant="h2">Pagar resumen</Typography>
            {statementToPay && (
              <>
                <Typography variant="caption" muted>
                  Vencimiento: {formatDate(statementToPay.dueDate)} • Total:{" "}
                  {formatCurrency(statementToPay.totalDue, account.currency)}
                </Typography>

                <View>
                  <Typography variant="label" className="mb-1.5">
                    Importe a abonar ({account.currency})
                  </Typography>
                  <TextInput
                    value={statementPayAmount}
                    onChangeText={setStatementPayAmount}
                    keyboardType="decimal-pad"
                    className="bg-surface-700/60 p-3 rounded-xl text-text-primary text-xl font-bold"
                    placeholderTextColor={colors.text.muted}
                  />
                  <Typography
                    variant="caption"
                    muted
                    className="mt-1 text-[11px]"
                  >
                    Mínimo sugerido:{" "}
                    {formatCurrency(
                      statementToPay.minimumDue,
                      account.currency,
                    )}
                  </Typography>
                </View>

                <View>
                  <Typography variant="label" className="mb-1.5">
                    Pagar desde cuenta
                  </Typography>
                  <ScrollView
                    horizontal
                    showsHorizontalScrollIndicator={false}
                    className="gap-2"
                  >
                    {(allAccountsData?.data ?? [])
                      .filter((a) => a.type !== "credit" && a.id !== id)
                      .map((fromAcc) => {
                        const isSelected = statementPayFromId === fromAcc.id;
                        return (
                          <Pressable
                            key={fromAcc.id}
                            onPress={() => setStatementPayFromId(fromAcc.id)}
                            className={`px-3 py-2 rounded-xl border mr-2 ${
                              isSelected
                                ? "bg-primary-600 border-primary-600"
                                : "bg-surface-700/60 border-transparent"
                            }`}
                          >
                            <Typography
                              className={`text-xs font-semibold ${
                                isSelected ? "text-white" : "text-text-primary"
                              }`}
                            >
                              {fromAcc.name}
                            </Typography>
                            <Typography
                              variant="caption"
                              className={`text-[10px] ${
                                isSelected ? "text-white/80" : "text-text-muted"
                              }`}
                            >
                              {formatCurrency(
                                fromAcc.balance,
                                fromAcc.currency,
                              )}
                            </Typography>
                          </Pressable>
                        );
                      })}
                  </ScrollView>
                </View>

                <View className="flex-row gap-3 pt-2">
                  <Button
                    title="Cancelar"
                    variant="ghost"
                    className="flex-1"
                    onPress={() => setStatementToPay(null)}
                  />
                  <Button
                    title="Confirmar pago"
                    className="flex-1"
                    onPress={handleConfirmPayStatement}
                    loading={payStatementMutation.isPending}
                    disabled={!statementPayFromId || !statementPayAmount}
                  />
                </View>
              </>
            )}
          </View>
        </View>
      </Modal>

      {/* ── Modal: Ajustar Saldo ────────────────────────────── */}
      <Modal
        visible={showAdjustModal}
        transparent
        animationType="fade"
        statusBarTranslucent
        onRequestClose={() => setShowAdjustModal(false)}
      >
        <Pressable
          onPress={() => setShowAdjustModal(false)}
          className="flex-1 bg-black/60 items-center justify-center p-4"
        >
          <Pressable
            onPress={(e) => e.stopPropagation()}
            className="w-full max-w-sm bg-surface-800 rounded-3xl p-6 border border-surface-600/70 shadow-2xl gap-4"
          >
            <View className="flex-row items-center gap-3">
              <View className="w-10 h-10 rounded-2xl bg-primary-600/15 items-center justify-center shrink-0">
                <MaterialCommunityIcons
                  name="scale-balance"
                  size={22}
                  color={colors.primary[600]}
                />
              </View>
              <View className="flex-1">
                <Typography variant="h3">Ajustar Saldo</Typography>
                <Typography variant="caption" muted numberOfLines={1}>
                  {account.name}
                </Typography>
              </View>
            </View>

            {/* Saldo actual registrado */}
            <View className="bg-surface-700/60 p-3 rounded-2xl gap-0.5">
              <Typography variant="caption" muted className="text-[11px]">
                Saldo registrado actualmente
              </Typography>
              <Typography className="text-base font-bold text-text-primary">
                {formatCurrency(account.balance, account.currency)}
              </Typography>
            </View>

            {/* Input nuevo saldo real */}
            <View className="gap-1.5">
              <Typography variant="label" className="text-xs">
                Nuevo saldo real
              </Typography>
              <TextInput
                value={adjustTargetInput}
                onChangeText={setAdjustTargetInput}
                placeholder="0"
                keyboardType="numeric"
                className="bg-surface-700 text-text-primary px-4 py-3 rounded-2xl text-lg font-bold border border-surface-600/50"
                placeholderTextColor={colors.text.muted}
                autoFocus
              />
            </View>

            {/* Diferencia en vivo */}
            {(() => {
              const parsed = parseFloat(adjustTargetInput.replace(",", "."));
              if (isNaN(parsed)) return null;
              const diff = parsed - account.balance;
              const isInc = diff > 0;
              const isZero = Math.abs(diff) < 0.001;

              return (
                <View
                  className={`p-2.5 rounded-xl border flex-row items-center gap-2 ${
                    isZero
                      ? "bg-surface-700/40 border-surface-600/40"
                      : isInc
                        ? "bg-success-500/10 border-success-500/25"
                        : "bg-danger-500/10 border-danger-500/25"
                  }`}
                >
                  <MaterialCommunityIcons
                    name={
                      isZero
                        ? "information-outline"
                        : isInc
                          ? "arrow-up-circle-outline"
                          : "arrow-down-circle-outline"
                    }
                    size={18}
                    color={
                      isZero
                        ? colors.text.secondary
                        : isInc
                          ? "#17b26a"
                          : "#f04438"
                    }
                  />
                  <View className="flex-1">
                    <Typography
                      className={`text-xs font-semibold ${
                        isZero
                          ? "text-text-secondary"
                          : isInc
                            ? "text-success-500"
                            : "text-danger-500"
                      }`}
                    >
                      {isZero
                        ? "Sin diferencia"
                        : `${isInc ? "+" : "-"}${formatCurrency(Math.abs(diff), account.currency)}`}
                    </Typography>
                    <Typography variant="caption" muted className="text-[10px]">
                      {isZero
                        ? "El saldo no cambiará"
                        : `Se registrará como ${isInc ? "ingreso" : "gasto"} por ajuste`}
                    </Typography>
                  </View>
                </View>
              );
            })()}

            {/* Motivo opcional */}
            <View className="gap-1.5">
              <Typography variant="label" className="text-xs">
                Motivo / Detalle (opcional)
              </Typography>
              <TextInput
                value={adjustNote}
                onChangeText={setAdjustNote}
                placeholder="Ej. Arqueo de caja, conciliación bancaria..."
                className="bg-surface-700 text-text-primary px-3.5 py-2.5 rounded-xl text-xs border border-surface-600/50"
                placeholderTextColor={colors.text.muted}
              />
            </View>

            {/* Botones */}
            <View className="flex-row gap-3 pt-2">
              <Button
                title="Cancelar"
                variant="secondary"
                className="flex-1"
                onPress={() => setShowAdjustModal(false)}
              />
              <Button
                title="Continuar"
                variant="primary"
                className="flex-1"
                disabled={(() => {
                  const parsed = parseFloat(
                    adjustTargetInput.replace(",", "."),
                  );
                  return (
                    isNaN(parsed) || Math.abs(parsed - account.balance) < 0.001
                  );
                })()}
                onPress={handlePromptConfirmAdjust}
              />
            </View>
          </Pressable>
        </Pressable>
      </Modal>

      {/* ── Modal de Confirmación Unificado ────────────────── */}
      <ConfirmModal
        visible={confirmModalConfig.visible}
        title={confirmModalConfig.title}
        message={confirmModalConfig.message}
        confirmText={confirmModalConfig.confirmText}
        cancelText={confirmModalConfig.cancelText}
        confirmVariant={confirmModalConfig.confirmVariant}
        icon={confirmModalConfig.icon}
        loading={confirmModalConfig.loading}
        onConfirm={confirmModalConfig.onConfirm}
        onCancel={() =>
          setConfirmModalConfig((prev) => ({ ...prev, visible: false }))
        }
      />
    </SafeAreaView>
  );
}
