import AsyncStorage from "@react-native-async-storage/async-storage";
import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";
import type { ThemeMode } from "@/types";

interface ThemeState {
  /** Tema activo. Por defecto "light"; se sincroniza con `user_settings.theme` al iniciar sesión. */
  mode: ThemeMode;
  /** true cuando se leyó la caché local (evita parpadeo de tema al abrir la app). */
  hydrated: boolean;
  setMode: (mode: ThemeMode) => void;
}

/**
 * Estado de UI del tema. La fuente de verdad es la BBDD (`user_settings.theme`);
 * AsyncStorage sólo guarda la última elección para pintar el tema correcto antes de que
 * respondan Firebase/D1.
 */
export const useThemeStore = create<ThemeState>()(
  persist(
    (set) => ({
      mode: "light",
      hydrated: false,
      setMode: (mode) => set({ mode }),
    }),
    {
      name: "unpo-theme",
      storage: createJSONStorage(() => AsyncStorage),
      partialize: (state) => ({ mode: state.mode }),
      onRehydrateStorage: () => () => {
        useThemeStore.setState({ hydrated: true });
      },
    },
  ),
);

