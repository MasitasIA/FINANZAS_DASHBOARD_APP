import type { D1DatabaseType } from "../types";

export function toCamelCaseAccount(row: any) {
  if (!row) return null;
  const balanceCents =
    row.balance_cents != null
      ? row.balance_cents
      : Math.round((row.balance ?? 0) * 100);
  const creditLimitCents =
    row.credit_limit_cents != null
      ? row.credit_limit_cents
      : row.credit_limit != null
        ? Math.round(row.credit_limit * 100)
        : undefined;

  return {
    id: row.id,
    name: row.name,
    type: row.type,
    currency: row.currency,
    balance: balanceCents / 100,
    balanceCents,
    color: row.color,
    icon: row.icon,
    creditLimit:
      creditLimitCents != null ? creditLimitCents / 100 : row.credit_limit,
    creditLimitCents,
    closingDay: row.closing_day,
    dueDay: row.due_day,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export function toCamelCaseTransaction(row: any) {
  if (!row) return null;
  const amountCents =
    row.amount_cents != null
      ? row.amount_cents
      : Math.round((row.amount ?? 0) * 100);

  return {
    id: row.id,
    userId: row.user_id ?? undefined,
    authorName: row.author_name ?? undefined,
    accountId: row.account_id,
    categoryId: row.category_id,
    type: row.type,
    amount: amountCents / 100,
    amountCents,
    currency: row.currency,
    description: row.description,
    note: row.note,
    date: row.date,
    toAccountId: row.to_account_id,
    goalId: row.goal_id,
    installmentId: row.installment_id ?? undefined,
    installmentNumber: row.installment_number ?? undefined,
    installmentsTotal: row.installments_total ?? undefined,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export function toCamelCaseInstallment(row: any) {
  if (!row) return null;
  const totalAmountCents =
    row.total_amount_cents != null
      ? row.total_amount_cents
      : Math.round((row.total_amount ?? 0) * 100);
  const cashPriceCents =
    row.cash_price_cents != null
      ? row.cash_price_cents
      : Math.round((row.cash_price ?? row.total_amount ?? 0) * 100);
  const installmentAmountCents =
    row.installment_amount_cents != null
      ? row.installment_amount_cents
      : Math.round((row.installment_amount ?? 0) * 100);

  return {
    id: row.id,
    userId: row.user_id ?? undefined,
    accountId: row.account_id,
    transactionId: row.transaction_id ?? undefined,
    description: row.description,
    totalAmount: totalAmountCents / 100,
    totalAmountCents,
    cashPrice: cashPriceCents / 100,
    cashPriceCents,
    installmentsCount: row.installments_count,
    installmentAmount: installmentAmountCents / 100,
    installmentAmountCents,
    paidInstallmentsCount: row.paid_installments_count ?? 0,
    remainingAmountCents: row.remaining_amount_cents ?? totalAmountCents,
    firstDueDate: row.first_due_date,
    status: row.status,
    createdAt: row.created_at,
  };
}

export function toCamelCaseStatement(row: any) {
  if (!row) return null;
  const prevCents = row.previous_balance_cents ?? 0;
  const chargesCents = row.charges_cents ?? 0;
  const instCents = row.installments_cents ?? 0;
  const interestCents = row.interest_cents ?? 0;
  const totalDueCents = row.total_due_cents ?? 0;
  const minDueCents = row.minimum_due_cents ?? 0;
  const paidCents = row.paid_amount_cents ?? 0;

  return {
    id: row.id,
    userId: row.user_id ?? undefined,
    accountId: row.account_id,
    periodStart: row.period_start,
    closingDate: row.closing_date,
    dueDate: row.due_date,
    previousBalance: prevCents / 100,
    previousBalanceCents: prevCents,
    charges: chargesCents / 100,
    chargesCents,
    installments: instCents / 100,
    installmentsCents: instCents,
    interest: interestCents / 100,
    interestCents,
    totalDue: totalDueCents / 100,
    totalDueCents,
    minimumDue: minDueCents / 100,
    minimumDueCents: minDueCents,
    paidAmount: paidCents / 100,
    paidAmountCents: paidCents,
    status: row.status,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export function toCamelCaseBudget(row: any) {
  if (!row) return null;
  const amountCents =
    row.amount_cents != null
      ? row.amount_cents
      : Math.round((row.amount ?? 0) * 100);
  const spentCents = row.spent_amount_cents ?? 0;
  const pct =
    amountCents > 0
      ? Math.round((spentCents / amountCents) * 100)
      : 0;

  return {
    id: row.id,
    userId: row.user_id ?? undefined,
    categoryId: row.category_id,
    categoryName: row.category_name ?? undefined,
    categoryIcon: row.category_icon ?? undefined,
    categoryColor: row.category_color ?? undefined,
    currency: row.currency,
    amount: amountCents / 100,
    amountCents,
    spentAmount: spentCents / 100,
    spentAmountCents: spentCents,
    percentage: pct,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export function toCamelCaseGoal(row: any) {
  if (!row) return null;
  const targetAmountCents =
    row.target_amount_cents != null
      ? row.target_amount_cents
      : Math.round((row.target_amount ?? 0) * 100);
  const currentAmountCents =
    row.current_amount_cents != null
      ? row.current_amount_cents
      : Math.round((row.current_amount ?? 0) * 100);

  return {
    id: row.id,
    name: row.name,
    targetAmount: targetAmountCents / 100,
    targetAmountCents,
    currentAmount: currentAmountCents / 100,
    currentAmountCents,
    currency: row.currency,
    deadline: row.deadline,
    icon: row.icon,
    color: row.color,
    status: row.status,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export function toCamelCaseCategory(row: any) {
  if (!row) return null;
  return {
    id: row.id,
    name: row.name,
    icon: row.icon,
    color: row.color,
    type: row.type,
    isDefault: Boolean(row.is_default),
  };
}

export function toCamelCaseRecurringExpense(row: any) {
  if (!row) return null;
  const amountCents =
    row.amount_cents != null
      ? row.amount_cents
      : Math.round((row.amount ?? 0) * 100);

  return {
    id: row.id,
    type: row.type === "income" ? "income" : "expense",
    name: row.name,
    amount: amountCents / 100,
    amountCents,
    currency: row.currency,
    accountId: row.account_id,
    accountName: row.account_name ?? undefined,
    accountColor: row.account_color ?? undefined,
    categoryId: row.category_id,
    dueDate: row.due_date,
    dueDay: row.due_day,
    frequency: row.frequency,
    isVariable: Boolean(row.is_variable),
    icon: row.icon,
    color: row.color,
    isActive: Boolean(row.is_active),
    lastPaidDate: row.last_paid_date ?? null,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export async function enrichResourcesWithShared(
  db: D1DatabaseType,
  resourceType: "account" | "goal",
  rows: any[],
  currentUserId: string,
  mapper: (r: any) => any,
): Promise<any[]> {
  if (!rows || rows.length === 0) return [];
  const ids = rows.map((r) => r.id).filter(Boolean);
  if (ids.length === 0) return [];

  const placeholders = ids.map(() => "?").join(", ");
  const membersRes = await db
    .prepare(
      `SELECT resource_id, user_id, display_name, role, created_at
       FROM shared_members
       WHERE resource_type = ? AND resource_id IN (${placeholders})
       ORDER BY role DESC, created_at ASC`,
    )
    .bind(resourceType, ...ids)
    .all();

  const membersByResource = new Map<string, any[]>();
  for (const m of (membersRes.results || []) as any[]) {
    const list = membersByResource.get(m.resource_id) || [];
    list.push({
      userId: m.user_id,
      displayName: m.display_name || "Usuario",
      role: m.role === "owner" ? "owner" : "editor",
      joinedAt: m.created_at,
    });
    membersByResource.set(m.resource_id, list);
  }

  return rows.map((row) => {
    const base = mapper(row);
    const members = membersByResource.get(row.id) || [];
    const isOwner = row.user_id === currentUserId;
    const isShared = members.length > 1 || !isOwner;
    return {
      ...base,
      isOwner,
      isShared,
      members,
    };
  });
}

export function generateShareInviteCode(): string {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  const bytes = new Uint8Array(4);
  crypto.getRandomValues(bytes);
  let suffix = "";
  for (let i = 0; i < 4; i++) {
    suffix += alphabet[bytes[i] % alphabet.length];
  }
  return `UNPO-${suffix}`;
}

export function computeNextDueDate(
  currentDueDate: string,
  dueDay: number,
  frequency: string,
  referenceToday: string,
): string {
  const safeStart = /^\d{4}-\d{2}-\d{2}$/.test(currentDueDate)
    ? currentDueDate
    : referenceToday;
  const [yStr, mStr, dStr] = safeStart.split("-");
  let year = parseInt(yStr, 10) || new Date().getUTCFullYear();
  let month = parseInt(mStr, 10) || new Date().getUTCMonth() + 1;
  let day = parseInt(dStr, 10) || 1;
  const targetDay = Math.min(31, Math.max(1, dueDay || day));

  const advanceOnce = () => {
    if (frequency === "weekly") {
      const dt = new Date(Date.UTC(year, month - 1, day, 12, 0, 0));
      dt.setUTCDate(dt.getUTCDate() + 7);
      year = dt.getUTCFullYear();
      month = dt.getUTCMonth() + 1;
      day = dt.getUTCDate();
    } else if (frequency === "yearly") {
      year += 1;
      const maxDays = new Date(Date.UTC(year, month, 0)).getUTCDate();
      day = Math.min(targetDay, maxDays);
    } else {
      month += 1;
      if (month > 12) {
        month = 1;
        year += 1;
      }
      const maxDays = new Date(Date.UTC(year, month, 0)).getUTCDate();
      day = Math.min(targetDay, maxDays);
    }
  };

  advanceOnce();
  let safety = 0;
  let formatted = `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
  while (formatted <= referenceToday && safety < 36) {
    advanceOnce();
    formatted = `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
    safety += 1;
  }
  return formatted;
}

