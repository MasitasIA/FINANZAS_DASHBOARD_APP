import { Platform } from "react-native";
import { File, Paths } from "expo-file-system";
import * as Sharing from "expo-sharing";
import * as DocumentPicker from "expo-document-picker";
import type {
  Account,
  Budget,
  Category,
  CreditCardInstallment,
  RecurringExpense,
  SavingsGoal,
  Transaction,
} from "@/types";

export interface AppBackupData {
  version: string;
  exportedAt: string;
  accounts: Account[];
  transactions: Transaction[];
  budgets: Budget[];
  goals: SavingsGoal[];
  recurringExpenses: RecurringExpense[];
  installments: CreditCardInstallment[];
}

export const backupService = {
  /**
   * Exporta un volcado completo de datos en formato JSON
   */
  async exportJsonBackup(data: AppBackupData): Promise<void> {
    const jsonString = JSON.stringify(data, null, 2);
    const dateStr = new Date().toISOString().slice(0, 10);
    const fileName = `unpo_finanzas_backup_${dateStr}.json`;

    if (Platform.OS === "web") {
      const blob = new Blob([jsonString], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = fileName;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      return;
    }

    // Móvil (iOS / Android con Expo FileSystem SDK 58)
    const file = new File(Paths.cache, fileName);
    if (!file.exists) {
      file.create();
    }
    await file.write(jsonString);

    if (await Sharing.isAvailableAsync()) {
      await Sharing.shareAsync(file.uri, {
        mimeType: "application/json",
        dialogTitle: "Guardar copia de seguridad de Finanzas",
        UTI: "public.json",
      });
    }
  },

  /**
   * Exporta transacciones en formato CSV compatible con Excel y Google Sheets
   */
  async exportTransactionsCsv(
    transactions: Transaction[],
    accounts: Account[],
    categories: Category[],
  ): Promise<void> {
    const accMap = new Map(accounts.map((a) => [a.id, a.name]));
    const catMap = new Map(categories.map((c) => [c.id, c.name]));

    const escapeCsv = (str?: string | null) => {
      if (!str) return '""';
      const clean = str.replace(/"/g, '""');
      return `"${clean}"`;
    };

    const header = [
      "Fecha",
      "Cuenta",
      "Categoría",
      "Tipo",
      "Importe",
      "Moneda",
      "Descripción",
      "Nota",
    ].join(",");

    const rows = transactions.map((t) => {
      const accName = accMap.get(t.accountId) ?? t.accountId;
      const catName = catMap.get(t.categoryId) ?? t.categoryId;
      const typeLabel =
        t.type === "expense"
          ? "Gasto"
          : t.type === "income"
            ? "Ingreso"
            : "Transferencia";

      return [
        escapeCsv(t.date),
        escapeCsv(accName),
        escapeCsv(catName),
        escapeCsv(typeLabel),
        t.amount.toFixed(2),
        escapeCsv(t.currency),
        escapeCsv(t.description),
        escapeCsv(t.note),
      ].join(",");
    });

    const csvContent = "\uFEFF" + [header, ...rows].join("\r\n"); // \uFEFF BOM para compatibilidad con Excel
    const dateStr = new Date().toISOString().slice(0, 10);
    const fileName = `unpo_movimientos_${dateStr}.csv`;

    if (Platform.OS === "web") {
      const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = fileName;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      return;
    }

    // Móvil
    const file = new File(Paths.cache, fileName);
    if (!file.exists) {
      file.create();
    }
    await file.write(csvContent);

    if (await Sharing.isAvailableAsync()) {
      await Sharing.shareAsync(file.uri, {
        mimeType: "text/csv",
        dialogTitle: "Exportar transacciones en CSV",
        UTI: "public.comma-separated-values-text",
      });
    }
  },

  /**
   * Permite al usuario seleccionar un archivo JSON de respaldo y valida su estructura
   */
  async pickAndValidateBackupFile(): Promise<AppBackupData | null> {
    if (Platform.OS === "web") {
      return new Promise((resolve, reject) => {
        const input = document.createElement("input");
        input.type = "file";
        input.accept = ".json,application/json";
        input.onchange = async () => {
          const file = input.files?.[0];
          if (!file) {
            resolve(null);
            return;
          }
          try {
            const text = await file.text();
            const parsed = JSON.parse(text);
            if (!parsed || typeof parsed !== "object" || !Array.isArray(parsed.accounts)) {
              throw new Error("El archivo no tiene el formato de respaldo de UNPO: Finanzas.");
            }
            resolve(parsed as AppBackupData);
          } catch (err) {
            reject(err);
          }
        };
        input.click();
      });
    }

    // Móvil (DocumentPicker & File)
    const result = await DocumentPicker.getDocumentAsync({
      type: "application/json",
      copyToCacheDirectory: true,
    });

    if (result.canceled || !result.assets || result.assets.length === 0) {
      return null;
    }

    const file = new File(result.assets[0].uri);
    const content = await file.text();

    const parsed = JSON.parse(content);
    if (!parsed || typeof parsed !== "object" || !Array.isArray(parsed.accounts)) {
      throw new Error("El archivo no tiene la estructura de copia de seguridad válida.");
    }

    return parsed as AppBackupData;
  },
};
