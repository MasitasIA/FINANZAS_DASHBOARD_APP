import { Pressable, View } from "react-native";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { Card, Typography } from "@/components/ui";
import type { IconName, SavingsGoal } from "@/types";
import { formatCurrency } from "@/utils/formatters";

interface GoalCardProps {
  goal: SavingsGoal;
  onPress?: () => void;
}

export function GoalCard({ goal, onPress }: GoalCardProps) {
  const progress = Math.min(
    (goal.currentAmount / goal.targetAmount) * 100,
    100
  );

  return (
    <Pressable onPress={onPress} className="active:scale-95">
      <Card className="gap-3">
        {/* Header */}
        <View className="flex-row items-center gap-3">
          <View
            className="w-10 h-10 rounded-xl items-center justify-center"
            style={{ backgroundColor: goal.color + "22" }}
          >
            <MaterialCommunityIcons
              name={(goal.icon as IconName) || "piggy-bank"}
              size={20}
              color={goal.color}
            />
          </View>
          <View className="flex-1 min-w-0">
            <View className="flex-row items-center gap-2">
              <Typography variant="h3" className="shrink" numberOfLines={1}>
                {goal.name}
              </Typography>
              {goal.isShared && (
                <View className="flex-row items-center gap-1 px-2 py-0.5 rounded-full bg-primary-500/15 shrink-0">
                  <MaterialCommunityIcons
                    name="account-multiple"
                    size={12}
                    color="#e23d28"
                  />
                  <Typography
                    variant="caption"
                    className="text-[10px] font-bold text-primary-500"
                  >
                    Compartida
                    {goal.members && goal.members.length > 1
                      ? ` (${goal.members.length})`
                      : ""}
                  </Typography>
                </View>
              )}
            </View>
            {goal.deadline && (
              <Typography variant="caption">
                {new Date(goal.deadline).toLocaleDateString("es-AR", {
                  month: "short",
                  year:  "numeric",
                })}
              </Typography>
            )}
          </View>
          <View className="items-end shrink-0">
            <Typography variant="h3" style={{ color: goal.color }}>
              {Math.round(progress)}%
            </Typography>
          </View>
        </View>

        {/* Progress bar */}
        <View className="h-2 bg-surface-600 rounded-full overflow-hidden">
          <View
            className="h-full rounded-full"
            style={{ width: `${progress}%`, backgroundColor: goal.color }}
          />
        </View>

        {/* Amounts */}
        <View className="flex-row flex-wrap justify-between gap-x-2 gap-y-1">
          <Typography variant="caption" numberOfLines={1}>
            {formatCurrency(goal.currentAmount, goal.currency)} ahorrados
          </Typography>
          <Typography variant="caption" numberOfLines={1}>
            Meta: {formatCurrency(goal.targetAmount, goal.currency)}
          </Typography>
        </View>
      </Card>
    </Pressable>
  );
}
