import { Pressable, View } from "react-native";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { Card, Typography } from "@/components/ui";
import type { Account } from "@/types";
import { formatCurrency } from "@/utils/formatters";

interface AccountCardProps {
  account: Account;
  onPress?: () => void;
}

const TYPE_LABELS: Record<string, string> = {
  checking: "Cuenta corriente",
  savings: "Caja de ahorro",
  cash: "Efectivo",
  investment: "Inversión",
  credit: "Tarjeta de crédito",
};

export function AccountCard({ account, onPress }: AccountCardProps) {
  const isCredit = account.type === "credit";
  const debt = Math.abs(account.balance);
  const limit = account.creditLimit ?? 0;
  const available = Math.max(0, limit - debt);
  const usagePercent = limit > 0 ? Math.min(100, Math.round((debt / limit) * 100)) : 0;

  return (
    <Pressable onPress={onPress} className="active:scale-[0.98]">
      <Card className="gap-3">
        <View className="flex-row items-center gap-4">
          {/* Avatar */}
          <View
            className="w-12 h-12 rounded-2xl items-center justify-center"
            style={{ backgroundColor: account.color + "22" }}
          >
            <MaterialCommunityIcons
              name={account.icon as any}
              size={24}
              color={account.color}
            />
          </View>

          {/* Info */}
          <View className="flex-1 min-w-0">
            <Typography variant="h3" numberOfLines={1}>
              {account.name}
            </Typography>
            <Typography variant="caption" className="mt-0.5" muted numberOfLines={1}>
              {TYPE_LABELS[account.type] ?? account.type}
            </Typography>
          </View>

          {/* Balance / Consumo */}
          <View className="items-end shrink-0 max-w-[55%]">
            <Typography
              variant="h3"
              numberOfLines={1}
              adjustsFontSizeToFit
              className={
                isCredit
                  ? debt > 0
                    ? "text-warning-500"
                    : "text-text-primary"
                  : account.balance >= 0
                  ? "text-success-500"
                  : "text-danger-500"
              }
            >
              {isCredit
                ? formatCurrency(debt, account.currency)
                : formatCurrency(account.balance, account.currency)}
            </Typography>
            <Typography variant="caption" muted>
              {isCredit ? "Consumo actual" : account.currency}
            </Typography>
          </View>
        </View>

        {/* Detalles específicos de Tarjeta de Crédito */}
        {isCredit && (
          <View className="pt-2 border-t border-surface-700/60 gap-2">
            {limit > 0 && (
              <>
                <View className="flex-row flex-wrap justify-between items-center gap-x-2 gap-y-1">
                  <Typography variant="caption" muted>
                    Disponible:{" "}
                    <Typography variant="caption" className="font-semibold text-text-primary">
                      {formatCurrency(available, account.currency)}
                    </Typography>
                  </Typography>
                  <Typography variant="caption" muted>
                    Límite: {formatCurrency(limit, account.currency)}
                  </Typography>
                </View>

                {/* Progress bar de uso */}
                <View className="h-2 bg-surface-700 rounded-full overflow-hidden">
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
              </>
            )}

            {(account.closingDay || account.dueDay) && (
              <View className="flex-row items-center justify-between mt-0.5">
                {account.closingDay ? (
                  <Typography variant="caption" muted>
                    Cierre: día {account.closingDay}
                  </Typography>
                ) : (
                  <View />
                )}
                {account.dueDay && (
                  <Typography variant="caption" className="text-warning-400 font-medium">
                    Vence: día {account.dueDay}
                  </Typography>
                )}
              </View>
            )}
          </View>
        )}
      </Card>
    </Pressable>
  );
}
