import { Pressable, View } from "react-native";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { Card, Typography } from "@/components/ui";
import type { SavingsGoal } from "@/types";
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
              name={goal.icon as any}
              size={20}
              color={goal.color}
            />
          </View>
          <View className="flex-1">
            <Typography variant="h3">{goal.name}</Typography>
            {goal.deadline && (
              <Typography variant="caption">
                {new Date(goal.deadline).toLocaleDateString("es-AR", {
                  month: "short",
                  year:  "numeric",
                })}
              </Typography>
            )}
          </View>
          <View className="items-end">
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
        <View className="flex-row justify-between">
          <Typography variant="caption">
            {formatCurrency(goal.currentAmount, goal.currency)} ahorrados
          </Typography>
          <Typography variant="caption">
            Meta: {formatCurrency(goal.targetAmount, goal.currency)}
          </Typography>
        </View>
      </Card>
    </Pressable>
  );
}
