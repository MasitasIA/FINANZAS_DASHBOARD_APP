import { useQueryClient } from "@tanstack/react-query";
import { useCallback, useMemo } from "react";
import { palettes, type ThemeColors } from "./palettes";
import {
  recurringExpenseKeys,
  useUpdateUserSettings,
} from "@/hooks/useRecurringExpenses";
import { useThemeStore } from "@/store/theme.store";
import type { ThemeMode, UserSettings } from "@/types";

export interface AppTheme {
  mode: ThemeMode;
  isDark: boolean;
  /** Paleta (hex) del tema activo, con la misma forma que `colors` de tailwind.config. */
  colors: ThemeColors;
}

/**
 * Tema actual de la app (liviano: sólo lee el store).
 *
 * - Para clases NativeWind usá los tokens normales (`bg-surface-900`, `text-text-primary`…):
 *   cambian solos con el tema.
 * - Para valores en JS (color de iconos, headers, ActivityIndicator, SVG…) usá `colors`
 *   de este hook en lugar de importar `colors` de tailwind.config.
 */
export function useAppTheme(): AppTheme {
  const mode = useThemeStore((s) => s.mode);
  return useMemo(
    () => ({ mode, isDark: mode === "dark", colors: palettes[mode] }),
    [mode],
  );
}

/**
 * Cambia el tema al instante (optimista) y lo guarda por usuario en `user_settings.theme` (D1).
 * Si el guardado falla, vuelve al tema anterior.
 */
export function useSetTheme() {
  const setMode = useThemeStore((s) => s.setMode);
  const qc = useQueryClient();
  const { mutate, isPending } = useUpdateUserSettings();

  const patchCachedTheme = useCallback(
    (theme: ThemeMode) =>
      qc.setQueryData<UserSettings | undefined>(
        recurringExpenseKeys.settings(),
        (old) => (old ? { ...old, theme } : old),
      ),
    [qc],
  );

  const setTheme = useCallback(
    (next: ThemeMode) => {
      const previous = useThemeStore.getState().mode;
      if (next === previous) return;

      setMode(next);
      patchCachedTheme(next);

      mutate(
        { theme: next },
        {
          onError: () => {
            setMode(previous);
            patchCachedTheme(previous);
          },
        },
      );
    },
    [mutate, patchCachedTheme, setMode],
  );

  return { setTheme, isSaving: isPending };
}
