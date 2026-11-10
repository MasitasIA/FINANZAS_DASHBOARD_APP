import { MaterialCommunityIcons } from "@expo/vector-icons";
import { Pressable, Switch, View } from "react-native";
import { useAppTheme, useSetTheme } from "@/theme/useAppTheme";
import { Typography } from "./Typography";

interface ThemeToggleProps {
  /** "row": fila con etiqueta + Switch (ajustes). "icon": botón compacto sol/luna. */
  variant?: "row" | "icon";
}

/** Activa/desactiva el modo oscuro del usuario (se guarda en user_settings.theme). */
export function ThemeToggle({ variant = "row" }: ThemeToggleProps) {
  const { isDark, colors } = useAppTheme();
  const { setTheme, isSaving } = useSetTheme();

  const toggle = () => setTheme(isDark ? "light" : "dark");

  if (variant === "icon") {
    return (
      <Pressable
        onPress={toggle}
        accessibilityRole="button"
        accessibilityLabel={isDark ? "Activar modo claro" : "Activar modo oscuro"}
        className="w-7 h-7 rounded-xl bg-surface-700 items-center justify-center active:bg-surface-600"
      >
        <MaterialCommunityIcons
          name={isDark ? "weather-sunny" : "weather-night"}
          size={15}
          color={colors.text.secondary}
        />
      </Pressable>
    );
  }

  return (
    <View className="flex-row items-center justify-between bg-surface-900 px-3.5 py-3 rounded-2xl border border-surface-600/60">
      <View className="flex-row items-center gap-2.5 flex-1 mr-3">
        <MaterialCommunityIcons
          name={isDark ? "weather-night" : "weather-sunny"}
          size={18}
          color={colors.primary[600]}
        />
        <View className="flex-1">
          <Typography variant="body" className="text-sm font-medium">
            Modo oscuro
          </Typography>
          <Typography variant="caption" muted className="text-[11px]">
            {isSaving ? "Guardando..." : "Se guarda en tu cuenta"}
          </Typography>
        </View>
      </View>
      <Switch
        value={isDark}
        onValueChange={(value) => setTheme(value ? "dark" : "light")}
        trackColor={{ false: colors.surface[600], true: colors.primary[600] }}
        thumbColor={colors.white}
        accessibilityLabel="Modo oscuro"
      />
    </View>
  );
}

