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
        name: "Gastos e Ingresos Automáticos",
        description:
          "Avisos de próximos cobros, vencimientos de gastos y consultas de cambio de precio",
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
 * Sincroniza todas las notificaciones locales de gastos e ingresos automáticos:
 * 1) Aviso 1 día antes ("Mañana cobras..." / "Mañana vence...")
 * 2) Aviso el mismo día a la hora personal del usuario:
 *    - Si es Variable: pregunta si cambió el precio y si desea registrarlo
 *    - Si es Fijo: avisa que hoy se acredita/descuenta automáticamente
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

    // Cancelar notificaciones previas de movimientos automáticos para evitar duplicados
    const scheduled = await getAllScheduledNotificationsAsync();
    for (const req of scheduled) {
      if (req.identifier.startsWith("rec-")) {
        await cancelScheduledNotificationAsync(req.identifier);
      }
    }

    const now = Date.now();
    let scheduledCount = 0;

    for (const item of items) {
      if (!item.isActive || !item.dueDate) continue;

      const isIncome = item.type === "income";
      const acc = accounts.find((a) => a.id === item.accountId);
      const accountName = acc?.name ?? item.accountName ?? "tu cuenta";
      const formattedAmount = formatCurrency(item.amount, item.currency);

      // 1. Aviso anticipado: 1 día antes del vencimiento/cobro a la hora del usuario
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

      // 2. Aviso el día del vencimiento/cobro a la hora exacta configurada por el usuario
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
        body: `Te avisaremos 1 día antes de cada cobro o gasto, y a las ${reminderTime} hs te preguntaremos si cambió el precio de tus automáticos variables.`,
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

