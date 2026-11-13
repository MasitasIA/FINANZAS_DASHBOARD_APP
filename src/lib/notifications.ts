import { Platform } from "react-native";
import {
  AndroidImportance,
  cancelScheduledNotificationAsync,
  getAllScheduledNotificationsAsync,
  getPermissionsAsync,
  requestPermissionsAsync,
  SchedulableTriggerInputTypes,
  scheduleNotificationAsync,
  setNotificationChannelAsync,
  setNotificationHandler,
} from "expo-notifications";
import type { Account, RecurringExpense } from "@/types";
import { formatCurrency } from "@/utils/formatters";

export const RECURRING_CHANNEL_ID = "finanzas-recurring";

let handlerConfigured = false;

/**
 * Configura cómo se muestran las notificaciones cuando la app está abierta
 * y crea el canal de alta prioridad en Android.
 */
export async function initializeNotifications(): Promise<boolean> {
  if (Platform.OS === "web") return false;

  try {
    if (!handlerConfigured) {
      setNotificationHandler({
        handleNotification: async () => ({
          shouldShowBanner: true,
          shouldShowList: true,
          shouldPlaySound: true,
          shouldSetBadge: false,
        }),
      });
      handlerConfigured = true;
    }

    if (Platform.OS === "android") {
      await setNotificationChannelAsync(RECURRING_CHANNEL_ID, {
        name: "Finanzas y Recordatorios",
        description:
          "Avisos de cobros, vencimientos de gastos, cierres y vencimientos de tarjetas de crédito",
        importance: AndroidImportance.MAX,
        vibrationPattern: [0, 250, 200, 250],
        lightColor: "#c8102e",
        sound: "default",
      });
    }

    const { status: existingStatus } = await getPermissionsAsync();
    if (existingStatus === "granted") return true;

    const { status } = await requestPermissionsAsync();
    return status === "granted";
  } catch {
    return false;
  }
}

/**
 * Envía una notificación inmediata de alerta presupuestaria al alcanzar 80% o 100%
 */
export async function notifyBudgetAlert(
  categoryName: string,
  percentage: number,
  spent: number,
  limit: number,
  currency: string = "ARS",
): Promise<void> {
  if (Platform.OS === "web") return;

  const isExceeded = percentage >= 100;
  const title = isExceeded
    ? `⚠️ Presupuesto excedido: ${categoryName}`
    : `⚠️ Alerta de presupuesto (80%): ${categoryName}`;
  const body = isExceeded
    ? `Has gastado ${formatCurrency(spent, currency as any)} de tu límite de ${formatCurrency(limit, currency as any)} (${percentage}%).`
    : `Has alcanzado el ${percentage}% de tu presupuesto en ${categoryName} (${formatCurrency(spent, currency as any)} / ${formatCurrency(limit, currency as any)}).`;

  try {
    await scheduleNotificationAsync({
      content: {
        title,
        body,
        sound: "default",
        data: { type: "budget_alert", categoryName },
      },
      trigger: null, // Inmediata
    });
  } catch {
    // Permisos no otorgados o no disponible
  }
}

/**
 * Verifica el estado actual del permiso de notificaciones en el dispositivo.
 */
export async function checkNotificationPermissionStatus(): Promise<
  "granted" | "denied" | "undetermined" | "unavailable"
> {
  if (Platform.OS === "web") return "unavailable";
  try {
    const { status } = await getPermissionsAsync();
    if (status === "granted") return "granted";
    if (status === "denied") return "denied";
    return "undetermined";
  } catch {
    return "unavailable";
  }
}

/**
 * Parsea una fecha "YYYY-MM-DD" y una hora "HH:mm" en un objeto Date local.
 */
function buildLocalTriggerDate(
  dateStr: string,
  timeStr: string,
  daysOffset = 0,
): Date | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) return null;
  const [y, m, d] = dateStr.split("-").map((n) => parseInt(n, 10));
  const [hh, mm] = /^([01]\d|2[0-3]):([0-5]\d)$/.test(timeStr)
    ? timeStr.split(":").map((n) => parseInt(n, 10))
    : [9, 0];

  const dt = new Date(y, m - 1, d, hh, mm, 0, 0);
  if (daysOffset !== 0) {
    dt.setDate(dt.getDate() + daysOffset);
  }
  return dt;
}

/**
 * Obtiene las fechas de disparo para un día del mes determinado (1-31) con un offset en días
 * (ej: -1 para 1 día antes), devolviendo las próximas ocurrencias futuras (hasta `maxCycles` ciclos/meses).
 */
function getUpcomingMonthlyTriggerDates(
  dayOfMonth: number,
  timeStr: string,
  daysOffset = 0,
  maxCycles = 2,
  referenceDate = new Date(),
): { triggerDate: Date; cycleKey: string }[] {
  if (!dayOfMonth || dayOfMonth < 1 || dayOfMonth > 31) return [];

  const [hh, mm] = /^([01]\d|2[0-3]):([0-5]\d)$/.test(timeStr)
    ? timeStr.split(":").map((n) => parseInt(n, 10))
    : [9, 0];

  const currentYear = referenceDate.getFullYear();
  const currentMonth = referenceDate.getMonth(); // 0-11
  const nowMs = referenceDate.getTime();
  const results: { triggerDate: Date; cycleKey: string }[] = [];

  for (let mOffset = 0; mOffset < 4 && results.length < maxCycles; mOffset++) {
    const candidateMonthIndex = currentMonth + mOffset;
    const candidateDate = new Date(currentYear, candidateMonthIndex, 1);
    const year = candidateDate.getFullYear();
    const month = candidateDate.getMonth(); // 0-11

    const lastDayOfMonth = new Date(year, month + 1, 0).getDate();
    const clampedDay = Math.min(dayOfMonth, lastDayOfMonth);

    const targetDate = new Date(year, month, clampedDay, hh, mm, 0, 0);
    if (daysOffset !== 0) {
      targetDate.setDate(targetDate.getDate() + daysOffset);
    }

    if (targetDate.getTime() > nowMs + 5_000) {
      const cycleKey = `${year}-${String(month + 1).padStart(2, "0")}`;
      results.push({ triggerDate: targetDate, cycleKey });
    }
  }

  return results;
}

/**
 * Sincroniza todas las notificaciones locales del usuario:
 * 1) Gastos e ingresos automáticos:
 *    - Aviso 1 día antes ("Mañana cobras..." / "Mañana vence...")
 *    - Aviso el mismo día a la hora personal del usuario (variable o fijo)
 * 2) Tarjetas de crédito:
 *    - Aviso 1 día antes del cierre del resumen ("Mañana cierra tu tarjeta...")
 *    - Aviso 1 día antes del vencimiento del pago ("Mañana vence tu tarjeta...")
 */
export async function syncRecurringNotifications(
  items: RecurringExpense[],
  accounts: Account[],
  reminderTime = "09:00",
): Promise<number> {
  if (Platform.OS === "web") return 0;

  try {
    const hasPermission = await initializeNotifications();
    if (!hasPermission) return 0;

    // Cancelar notificaciones previas de automáticos y tarjetas para evitar duplicados
    const scheduled = await getAllScheduledNotificationsAsync();
    for (const req of scheduled) {
      if (
        req.identifier.startsWith("rec-") ||
        req.identifier.startsWith("card-")
      ) {
        await cancelScheduledNotificationAsync(req.identifier);
      }
    }

    const now = Date.now();
    let scheduledCount = 0;

    // ── 1. Notificaciones de automáticos (Gastos e Ingresos) ─────────────────
    for (const item of items) {
      if (!item.isActive || !item.dueDate) continue;

      const isIncome = item.type === "income";
      const acc = accounts.find((a) => a.id === item.accountId);
      const accountName = acc?.name ?? item.accountName ?? "tu cuenta";
      const formattedAmount = formatCurrency(item.amount, item.currency);

      // 1.1 Aviso anticipado: 1 día antes del vencimiento/cobro a la hora del usuario
      const dayBeforeDate = buildLocalTriggerDate(
        item.dueDate,
        reminderTime,
        -1,
      );
      if (dayBeforeDate && dayBeforeDate.getTime() > now + 5_000) {
        await scheduleNotificationAsync({
          identifier: `rec-upcoming-${item.id}`,
          content: {
            title: isIncome
              ? `💰 Mañana cobras: ${item.name}`
              : `📅 Mañana vence: ${item.name}`,
            body: isIncome
              ? `Mañana (${item.dueDate}) tienes programado recibir ${formattedAmount} en ${accountName}.`
              : `Mañana (${item.dueDate}) tienes programado el gasto de ${formattedAmount} con ${accountName}.`,
            sound: "default",
            data: {
              recurringId: item.id,
              action: "open_recurring",
            },
          },
          trigger: {
            type: SchedulableTriggerInputTypes.DATE,
            date: dayBeforeDate,
            channelId: RECURRING_CHANNEL_ID,
          },
        });
        scheduledCount += 1;
      }

      // 1.2 Aviso el día del vencimiento/cobro a la hora exacta configurada por el usuario
      const dueDayDate = buildLocalTriggerDate(item.dueDate, reminderTime, 0);
      if (dueDayDate && dueDayDate.getTime() > now + 5_000) {
        if (item.isVariable) {
          // Monto Variable → Pregunta si cambió el precio y abre el modal al tocar
          await scheduleNotificationAsync({
            identifier: `rec-due-var-${item.id}`,
            content: {
              title: `🔔 ¿Cambió el precio de ${item.name}?`,
              body: isIncome
                ? `Hoy cobras ${item.name} (estimado: ${formattedAmount} en ${accountName}). Toca para confirmar el monto real y acreditarlo.`
                : `Hoy vence ${item.name} (estimado: ${formattedAmount} con ${accountName}). Toca para indicar si cambió el precio y registrarlo.`,
              sound: "default",
              data: {
                recurringId: item.id,
                action: "prompt_variable",
              },
            },
            trigger: {
              type: SchedulableTriggerInputTypes.DATE,
              date: dueDayDate,
              channelId: RECURRING_CHANNEL_ID,
            },
          });
        } else {
          // Monto Fijo → Avisa que hoy se aplica automáticamente
          await scheduleNotificationAsync({
            identifier: `rec-due-fix-${item.id}`,
            content: {
              title: isIncome
                ? `⚡ Hoy se acredita: ${item.name}`
                : `⚡ Hoy se descuenta: ${item.name}`,
              body: isIncome
                ? `Hoy se acredita automáticamente ${formattedAmount} en ${accountName}.`
                : `Hoy se descuenta automáticamente ${formattedAmount} de ${accountName}.`,
              sound: "default",
              data: {
                recurringId: item.id,
                action: "open_recurring",
              },
            },
            trigger: {
              type: SchedulableTriggerInputTypes.DATE,
              date: dueDayDate,
              channelId: RECURRING_CHANNEL_ID,
            },
          });
        }
        scheduledCount += 1;
      }
    }

    // ── 2. Notificaciones de Tarjetas de Crédito (Cierre y Vencimiento) ──────
    const creditAccounts = accounts.filter(
      (a) => a.type === "credit" && (a.closingDay || a.dueDay),
    );

    for (const acc of creditAccounts) {
      const hasDebt = acc.balance < 0;
      const debtAmount = formatCurrency(Math.abs(acc.balance), acc.currency);

      // 2.1 Aviso 1 día antes del Cierre del resumen
      if (acc.closingDay) {
        const triggers = getUpcomingMonthlyTriggerDates(
          acc.closingDay,
          reminderTime,
          -1, // 1 día antes del cierre
          2,  // Programar los próximos 2 ciclos
        );

        for (const { triggerDate, cycleKey } of triggers) {
          await scheduleNotificationAsync({
            identifier: `card-closing-${acc.id}-${cycleKey}`,
            content: {
              title: `💳 Mañana cierra tu tarjeta: ${acc.name}`,
              body: hasDebt
                ? `Mañana (día ${acc.closingDay}) cierra el resumen de tu tarjeta. Consumo acumulado: ${debtAmount}. Revisa tus movimientos antes del corte.`
                : `Mañana (día ${acc.closingDay}) cierra el resumen de tu tarjeta ${acc.name}. Revisa tus movimientos antes del corte.`,
              sound: "default",
              data: {
                accountId: acc.id,
                action: "open_account",
              },
            },
            trigger: {
              type: SchedulableTriggerInputTypes.DATE,
              date: triggerDate,
              channelId: RECURRING_CHANNEL_ID,
            },
          });
          scheduledCount += 1;
        }
      }

      // 2.2 Aviso 1 día antes del Vencimiento del pago
      if (acc.dueDay) {
        const triggers = getUpcomingMonthlyTriggerDates(
          acc.dueDay,
          reminderTime,
          -1, // 1 día antes del vencimiento
          2,  // Programar los próximos 2 ciclos
        );

        for (const { triggerDate, cycleKey } of triggers) {
          await scheduleNotificationAsync({
            identifier: `card-due-${acc.id}-${cycleKey}`,
            content: {
              title: `📅 Mañana vence tu tarjeta: ${acc.name}`,
              body: hasDebt
                ? `Mañana (día ${acc.dueDay}) vence el resumen de tu tarjeta. Saldo a abonar: ${debtAmount}. Recuerda pagar a tiempo para evitar intereses.`
                : `Mañana (día ${acc.dueDay}) vence el pago de tu tarjeta ${acc.name}. Recuerda abonar a tiempo para evitar recargos.`,
              sound: "default",
              data: {
                accountId: acc.id,
                action: "open_account",
              },
            },
            trigger: {
              type: SchedulableTriggerInputTypes.DATE,
              date: triggerDate,
              channelId: RECURRING_CHANNEL_ID,
            },
          });
          scheduledCount += 1;
        }
      }
    }

    return scheduledCount;
  } catch {
    return 0;
  }
}

/**
 * Envía una notificación inmediata cuando el sistema aplica automáticamente un movimiento fijo.
 */
export async function sendAutoAppliedNotification(
  appliedItems: RecurringExpense[],
): Promise<void> {
  if (Platform.OS === "web" || appliedItems.length === 0) return;

  try {
    const hasPermission = await initializeNotifications();
    if (!hasPermission) return;

    for (const item of appliedItems) {
      const isIncome = item.type === "income";
      const formattedAmount = formatCurrency(item.amount, item.currency);
      await scheduleNotificationAsync({
        content: {
          title: isIncome
            ? `✅ Ingreso acreditado: ${item.name}`
            : `✅ Gasto descontado: ${item.name}`,
          body: isIncome
            ? `Se acreditaron automáticamente +${formattedAmount} en ${item.accountName ?? "tu cuenta"}.`
            : `Se descontaron automáticamente -${formattedAmount} de ${item.accountName ?? "tu cuenta"}.`,
          sound: "default",
          data: {
            recurringId: item.id,
            action: "open_recurring",
          },
        },
        trigger: null,
      });
    }
  } catch {
    // Ignorar si el binario nativo aún no tiene expo-notifications
  }
}

/**
 * Envía una notificación de prueba en 2 segundos para verificar que el celular recibe avisos.
 */
export async function sendTestNotification(
  reminderTime: string,
): Promise<boolean> {
  if (Platform.OS === "web") return false;
  try {
    const hasPermission = await initializeNotifications();
    if (!hasPermission) return false;

    await scheduleNotificationAsync({
      content: {
        title: "🔔 Notificaciones activas en UNPO: Finanzas",
        body: `Te avisaremos 1 día antes de cobros, gastos y del cierre o vencimiento de tus tarjetas, y a las ${reminderTime} hs si cambió el precio de tus automáticos.`,
        sound: "default",
        data: { action: "open_recurring" },
      },
      trigger: {
        type: SchedulableTriggerInputTypes.TIME_INTERVAL,
        seconds: 2,
        channelId: RECURRING_CHANNEL_ID,
      },
    });
    return true;
  } catch {
    return false;
  }
}

