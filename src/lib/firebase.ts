import { Platform } from "react-native";
import { initializeApp, getApps, getApp } from "firebase/app";
import * as firebaseAuth from "firebase/auth";
import AsyncStorage from "@react-native-async-storage/async-storage";

const firebaseConfig = {
  apiKey: process.env.EXPO_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.EXPO_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.EXPO_PUBLIC_FIREBASE_APP_ID,
  measurementId: process.env.EXPO_PUBLIC_FIREBASE_MEASUREMENT_ID,
};

export const isFirebaseConfigured = Boolean(
  firebaseConfig.apiKey && firebaseConfig.projectId,
);

const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApp();

function createAuth() {
  if (Platform.OS === "web") {
    return firebaseAuth.getAuth(app);
  }
  try {
    const getReactNativePersistence = (firebaseAuth as any)
      .getReactNativePersistence;
    if (typeof getReactNativePersistence === "function") {
      return firebaseAuth.initializeAuth(app, {
        persistence: getReactNativePersistence(AsyncStorage),
      });
    }
  } catch {
    // Si ya fue inicializado (Fast Refresh), devolver la instancia existente
  }
  return firebaseAuth.getAuth(app);
}

export const auth = createAuth();
export const googleProvider = new firebaseAuth.GoogleAuthProvider();

