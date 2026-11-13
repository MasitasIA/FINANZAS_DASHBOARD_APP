import "../global.css";
import { useAppTheme } from "@/theme/useAppTheme";
import { ThemeProvider, ThemeSync } from "@/theme/ThemeProvider";
import { useThemeStore } from "@/store/theme.store";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  Inter_400Regular,
  Inter_500Medium,
  Inter_600SemiBold,
  Inter_700Bold,
  useFonts,
} from "@expo-google-fonts/inter";
import { NavigationBar } from "expo-navigation-bar";
import { Stack, router, useSegments } from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import { StatusBar } from "expo-status-bar";
import * as Updates from "expo-updates";
import { onAuthStateChanged, type User } from "firebase/auth";
import { useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  AppState,
  type AppStateStatus,
  Platform,
  Pressable,
  View,
} from "react-native";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { RecurringAutoProcessor } from "@/components/recurring/RecurringAutoProcessor";
import { OfflineBanner, Typography } from "@/components/ui";
import { auth, isFirebaseConfigured } from "@/lib/firebase";

SplashScreen.preventAutoHideAsync();

const USE_MOCK = process.env.EXPO_PUBLIC_USE_MOCK === "true";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 2,
      refetchOnWindowFocus: false,
    },
  },
});

export default function RootLayout() {
  const [loaded] = useFonts({
    Inter_400Regular,
    Inter_500Medium,
    Inter_600SemiBold,
    Inter_700Bold,
  });

  const [user, setUser] = useState<User | null>(null);
  const [authReady, setAuthReady] = useState(USE_MOCK || !isFirebaseConfigured);
  const [updateReady, setUpdateReady] = useState(false);
  const lastUidRef = useRef<string | null>(null);
  const segments = useSegments();
  const { colors, isDark } = useAppTheme();
  const themeHydrated = useThemeStore((s) => s.hydrated);

  useEffect(() => {
    if (loaded && themeHydrated) SplashScreen.hideAsync();
  }, [loaded, themeHydrated]);

  // Verificación silenciosa de actualizaciones OTA al iniciar y al volver a primer plano
  useEffect(() => {
    if (!Updates.isEnabled) return;

    async function checkAndDownloadUpdate() {
      try {
        const res = await Updates.checkForUpdateAsync();
        if (res.isAvailable) {
          await Updates.fetchUpdateAsync();
          setUpdateReady(true);
        }
      } catch {
        // Ignorar errores de red silenciosamente
      }
    }

    checkAndDownloadUpdate();

    const sub = AppState.addEventListener("change", (state: AppStateStatus) => {
      if (state === "active") {
        checkAndDownloadUpdate();
      }
    });

    return () => sub.remove();
  }, []);

  useEffect(() => {
    if (USE_MOCK || !isFirebaseConfigured) return;

    const unsubscribe = onAuthStateChanged(auth, (firebaseUser) => {
      const nextUid = firebaseUser?.uid ?? null;
      if (lastUidRef.current !== nextUid) {
        queryClient.clear();
        lastUidRef.current = nextUid;
      }
      setUser(firebaseUser);
      setAuthReady(true);
    });

    return unsubscribe;
  }, []);

  useEffect(() => {
    if (!loaded || !authReady || USE_MOCK || !isFirebaseConfigured) return;

    const inLoginScreen = segments[0] === "login";
    if (!user && !inLoginScreen) {
      router.replace("/login");
    } else if (user && inLoginScreen) {
      router.replace("/(tabs)");
    }
  }, [user, authReady, loaded, segments]);

  useEffect(() => {
    if (Platform.OS !== "android") return;

    NavigationBar.setHidden(true);
    NavigationBar.setStyle(isDark ? "light" : "dark");

    const appStateSub = AppState.addEventListener(
      "change",
      (state: AppStateStatus) => {
        if (state === "active") {
          NavigationBar.setHidden(true);
        }
      },
    );

    return () => {
      appStateSub.remove();
    };
  }, [isDark]);

  if (!loaded || !authReady || !themeHydrated) {
    return (
      <ThemeProvider>
        <View className="flex-1 bg-surface-900 items-center justify-center">
          <ActivityIndicator size="large" color={colors.primary[500]} />
        </View>
      </ThemeProvider>
    );
  }

  return (
    <ThemeProvider>
      <QueryClientProvider client={queryClient}>
        <ThemeSync
          enabled={USE_MOCK || !isFirebaseConfigured || Boolean(user)}
        />
        <StatusBar style={isDark ? "light" : "dark"} />
        <NavigationBar hidden style={isDark ? "light" : "dark"} />
        <OfflineBanner />
        <RecurringAutoProcessor
          enabled={USE_MOCK || !isFirebaseConfigured || Boolean(user)}
        />
        {updateReady && (
          <View className="bg-primary-600 px-4 pt-10 pb-2.5 flex-row items-center justify-between">
            <View className="flex-row items-center gap-2 flex-1 mr-2">
              <MaterialCommunityIcons
                name="cloud-check-outline"
                size={18}
                color={colors.white}
              />
              <Typography
                variant="caption"
                className="text-white font-semibold flex-1"
              >
                Nueva versión descargada y lista
              </Typography>
            </View>
            <Pressable
              onPress={() => Updates.reloadAsync()}
              className="bg-white px-3 py-1 rounded-full active:opacity-80"
            >
              <Typography
                variant="caption"
                className="text-primary-600 font-bold"
              >
                Actualizar ahora
              </Typography>
            </Pressable>
          </View>
        )}
        <Stack
          screenOptions={{
            headerShown: false,
            contentStyle: { backgroundColor: colors.surface[900] },
          }}
        >
          <Stack.Screen name="login" options={{ headerShown: false }} />
          <Stack.Screen name="(tabs)" />
          <Stack.Screen
            name="accounts/[id]"
            options={{
              headerShown: true,
              headerStyle: { backgroundColor: colors.surface[800] },
              headerTintColor: colors.text.primary,
              headerTitle: "Cuenta",
              headerBackButtonDisplayMode: "minimal",
            }}
          />
          <Stack.Screen
            name="goals/[id]"
            options={{
              headerShown: true,
              headerStyle: { backgroundColor: colors.surface[800] },
              headerTintColor: colors.text.primary,
              headerTitle: "Meta de ahorro",
              headerBackButtonDisplayMode: "minimal",
            }}
          />
          <Stack.Screen
            name="accounts/new"
            options={{
              presentation: "modal",
              headerShown: true,
              headerStyle: { backgroundColor: colors.surface[800] },
              headerTintColor: colors.text.primary,
              headerTitle: "Nueva cuenta",
            }}
          />
          <Stack.Screen
            name="goals/new"
            options={{
              presentation: "modal",
              headerShown: true,
              headerStyle: { backgroundColor: colors.surface[800] },
              headerTintColor: colors.text.primary,
              headerTitle: "Nueva meta",
            }}
          />
          <Stack.Screen
            name="transaction/new"
            options={{
              presentation: "modal",
              headerShown: true,
              headerStyle: { backgroundColor: colors.surface[800] },
              headerTintColor: colors.text.primary,
              headerTitle: "Nueva transacción",
            }}
          />
          <Stack.Screen
            name="recurring/index"
            options={{
              headerShown: true,
              headerStyle: { backgroundColor: colors.surface[800] },
              headerTintColor: colors.text.primary,
              headerTitle: "Gastos e ingresos automáticos",
              headerBackButtonDisplayMode: "minimal",
            }}
          />
        </Stack>
      </QueryClientProvider>
    </ThemeProvider>
  );
}
