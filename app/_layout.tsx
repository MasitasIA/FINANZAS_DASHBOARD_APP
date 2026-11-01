import "../global.css";
import { colors } from "../tailwind.config";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  Inter_400Regular,
  Inter_500Medium,
  Inter_600SemiBold,
  Inter_700Bold,
  useFonts,
} from "@expo-google-fonts/inter";
import { NavigationBar } from "expo-navigation-bar";
import { Stack } from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import { StatusBar } from "expo-status-bar";
import { useEffect } from "react";
import { AppState, type AppStateStatus, Platform } from "react-native";

SplashScreen.preventAutoHideAsync();

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

  useEffect(() => {
    if (loaded) SplashScreen.hideAsync();
  }, [loaded]);

  useEffect(() => {
    if (Platform.OS !== "android") return;

    NavigationBar.setHidden(true);
    NavigationBar.setStyle("dark");

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
  }, []);

  if (!loaded) return null;

  return (
    <QueryClientProvider client={queryClient}>
      <StatusBar style="dark" />
      <NavigationBar hidden style="light" />
      <Stack screenOptions={{ headerShown: false }}>
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
      </Stack>
    </QueryClientProvider>
  );
}
