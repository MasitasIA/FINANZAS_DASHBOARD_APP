import { colorScheme, vars } from "nativewind";
import { useEffect, useMemo, type ReactNode } from "react";
import { Platform, View } from "react-native";
import { themeVars } from "./palettes";
import { useUserSettings } from "@/hooks/useRecurringExpenses";
import { useThemeStore } from "@/store/theme.store";

/**
 * Estilos globales de tema. Envuelve toda la app y:
 *  1. Inyecta las variables CSS `--color-*` del tema activo (`vars()`), de las que dependen
 *     todas las clases de color (`bg-surface-900`, `text-text-primary`, `bg-primary-50`…).
 *  2. Sincroniza NativeWind (`dark:` variants) y el esquema nativo (Alert, teclado) con el tema.
 *  3. En web copia las variables a <html> para que también apliquen a los Modal (portal).
 */
export function ThemeProvider({ children }: { children: ReactNode }) {
  const mode = useThemeStore((s) => s.mode);
  const themeStyle = useMemo(() => vars(themeVars[mode]), [mode]);

  useEffect(() => {
    colorScheme.set(mode);

    if (Platform.OS === "web" && typeof document !== "undefined") {
      const root = document.documentElement;
      for (const [name, value] of Object.entries(themeVars[mode])) {
        root.style.setProperty(name, value);
      }
      root.style.colorScheme = mode;
    }
  }, [mode]);

  return (
    <View style={[{ flex: 1 }, themeStyle]} className="flex-1 bg-surface-900">
      {children}
    </View>
  );
}

/**
 * Aplica al tema local el valor guardado en `user_settings.theme` (D1) del usuario autenticado.
 * Debe montarse dentro de <QueryClientProvider>. Si el usuario nunca eligió, la BBDD devuelve "light".
 */
export function ThemeSync({ enabled }: { enabled: boolean }) {
  const { data } = useUserSettings(enabled);
  const setMode = useThemeStore((s) => s.setMode);
  const remoteTheme = data?.theme;

  useEffect(() => {
    if (remoteTheme) setMode(remoteTheme);
  }, [remoteTheme, setMode]);

  return null;
}

