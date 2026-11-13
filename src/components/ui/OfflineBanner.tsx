import { useEffect, useState } from "react";
import { Platform, View } from "react-native";
import * as Network from "expo-network";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { Typography } from "./Typography";

export function OfflineBanner() {
  const [isOffline, setIsOffline] = useState(false);

  useEffect(() => {
    let isMounted = true;

    async function checkState() {
      try {
        const state = await Network.getNetworkStateAsync();
        if (isMounted) {
          setIsOffline(state.isConnected === false || state.isInternetReachable === false);
        }
      } catch {
        // Fallback en web si expo-network no está disponible
        if (Platform.OS === "web" && typeof navigator !== "undefined" && isMounted) {
          setIsOffline(!navigator.onLine);
        }
      }
    }

    void checkState();

    // Eventos web
    if (Platform.OS === "web" && typeof window !== "undefined") {
      const handleOnline = () => setIsOffline(false);
      const handleOffline = () => setIsOffline(true);
      window.addEventListener("online", handleOnline);
      window.addEventListener("offline", handleOffline);
      return () => {
        isMounted = false;
        window.removeEventListener("online", handleOnline);
        window.removeEventListener("offline", handleOffline);
      };
    }

    // Polling ligero en móvil cada 15s para detectar pérdida de señal
    const interval = setInterval(() => {
      void checkState();
    }, 15000);

    return () => {
      isMounted = false;
      clearInterval(interval);
    };
  }, []);

  if (!isOffline) return null;

  return (
    <View className="bg-warning-500 px-4 py-2 flex-row items-center justify-center gap-2 z-50">
      <MaterialCommunityIcons name="cloud-off-outline" size={16} color="#ffffff" />
      <Typography className="text-white text-xs font-semibold">
        Sin conexión a internet. Mostrando datos locales en caché.
      </Typography>
    </View>
  );
}

