import { ActivityIndicator, FlatList, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { router } from "expo-router";
import { Button, Typography } from "@/components/ui";
import { GoalCard } from "@/components/goals/GoalCard";
import { useGoals } from "@/hooks/useGoals";
import { colors } from "../../tailwind.config";

export default function GoalsScreen() {
  const { data, isLoading, error, refetch } = useGoals();
  const goals = data?.data ?? [];

  const active = goals.filter((g) => g.status === "active");
  const completed = goals.filter((g) => g.status === "completed");

  return (
    <SafeAreaView edges={["top"]} className="flex-1 bg-surface-900">
      {/* ── Header ─────────────────────────────────────────── */}
      <View className="flex-row items-center justify-between px-4 pt-6 pb-4">
        <Typography variant="h1">Metas</Typography>
        <Button
          title="Nueva meta"
          size="sm"
          onPress={() => router.push("/goals/new")}
        />
      </View>

      {isLoading ? (
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator size="large" color={colors.primary[500]} />
        </View>
      ) : error ? (
        <View className="flex-1 items-center justify-center px-8 gap-4">
          <Typography variant="h3" className="text-center">
            Error al cargar metas
          </Typography>
          <Button
            title="Reintentar"
            onPress={() => refetch()}
            variant="secondary"
          />
        </View>
      ) : (
        <FlatList
          data={[
            ...(active.length > 0
              ? [{ id: "__active", _section: true, label: "Activas" }]
              : []),
            ...active,
            ...(completed.length > 0
              ? [{ id: "__completed", _section: true, label: "Completadas" }]
              : []),
            ...completed,
          ]}
          keyExtractor={(item: any) => item.id}
          contentContainerClassName="px-4 pb-8 gap-3"
          showsVerticalScrollIndicator={false}
          renderItem={({ item }: { item: any }) => {
            if (item._section) {
              return (
                <Typography variant="label" className="mt-4 mb-1">
                  {item.label}
                </Typography>
              );
            }
            return (
              <GoalCard
                goal={item}
                onPress={() => router.push(`/goals/${item.id}`)}
              />
            );
          }}
          ListEmptyComponent={
            <View className="items-center py-16 gap-3">
              <Typography variant="h3" muted>
                Sin metas aún
              </Typography>
              <Typography variant="caption" muted className="text-center">
                Crea una meta de ahorro para hacer seguimiento de tu progreso.
              </Typography>
              <Button
                title="Crear primera meta"
                size="sm"
                onPress={() => router.push("/goals/new")}
                className="mt-2"
              />
            </View>
          }
        />
      )}
    </SafeAreaView>
  );
}
