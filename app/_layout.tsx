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
import { Stack, router, useSegments } from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import { StatusBar } from "expo-status-bar";
import { onAuthStateChanged, type User } from "firebase/auth";
import { useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  AppState,
  type AppStateStatus,
  Platform,
  View,
} from "react-native";
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
  const [authReady, setAuthReady] = useState(
    USE_MOCK || !isFirebaseConfigured,
  );
  const lastUidRef = useRef<string | null>(null);
  const segments = useSegments();

  useEffect(() => {
    if (loaded) SplashScreen.hideAsync();
  }, [loaded]);

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

  if (!loaded || !authReady) {
    return (
      <View className="flex-1 bg-surface-900 items-center justify-center">
        <ActivityIndicator size="large" color={colors.primary[500]} />
      </View>
    );
  }

  return (
    <QueryClientProvider client={queryClient}>
      <StatusBar style="dark" />
      <NavigationBar hidden style="light" />
      <Stack screenOptions={{ headerShown: false }}>
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
      </Stack>
    </QueryClientProvider>
  );
}
