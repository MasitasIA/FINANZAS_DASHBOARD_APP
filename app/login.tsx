import { useState } from "react";
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  TextInput,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { router } from "expo-router";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import {
  createUserWithEmailAndPassword,
  sendPasswordResetEmail,
  signInWithEmailAndPassword,
  signInWithPopup,
} from "firebase/auth";
import { auth, googleProvider } from "@/lib/firebase";
import { Button, Card, Typography } from "@/components/ui";
import { colors } from "../tailwind.config";

function translateFirebaseError(code?: string): string {
  switch (code) {
    case "auth/invalid-credential":
    case "auth/wrong-password":
    case "auth/user-not-found":
      return "Correo o contraseña incorrectos.";
    case "auth/email-already-in-use":
      return "Ya existe una cuenta registrada con este correo.";
    case "auth/weak-password":
      return "La contraseña debe tener al menos 6 caracteres.";
    case "auth/invalid-email":
      return "El formato del correo electrónico no es válido.";
    case "auth/popup-closed-by-user":
      return "Se cerró la ventana de acceso con Google.";
    case "auth/unauthorized-domain":
      return "Este dominio aún no está autorizado en Firebase Console (Authentication → Settings → Authorized domains).";
    default:
      return "No se pudo completar la autenticación. Intenta de nuevo.";
  }
}

export default function LoginScreen() {
  const [mode, setMode] = useState<"login" | "register">("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [infoMsg, setInfoMsg] = useState<string | null>(null);

  const handleEmailAuth = async () => {
    const cleanEmail = email.trim();
    if (!cleanEmail || !password) {
      setErrorMsg("Completa tu correo y contraseña.");
      return;
    }

    setErrorMsg(null);
    setInfoMsg(null);
    setLoading(true);

    try {
      if (mode === "login") {
        await signInWithEmailAndPassword(auth, cleanEmail, password);
      } else {
        await createUserWithEmailAndPassword(auth, cleanEmail, password);
      }
      router.replace("/(tabs)");
    } catch (err: any) {
      setErrorMsg(translateFirebaseError(err?.code));
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleSignIn = async () => {
    setErrorMsg(null);
    setInfoMsg(null);

    if (Platform.OS !== "web") {
      setErrorMsg(
        "En la app móvil usa tu correo y contraseña (o vincula una contraseña desde la versión web).",
      );
      return;
    }

    setGoogleLoading(true);
    try {
      await signInWithPopup(auth, googleProvider);
      router.replace("/(tabs)");
    } catch (err: any) {
      setErrorMsg(translateFirebaseError(err?.code));
    } finally {
      setGoogleLoading(false);
    }
  };

  const handleResetPassword = async () => {
    const cleanEmail = email.trim();
    if (!cleanEmail) {
      setErrorMsg("Escribe tu correo arriba para enviarte el enlace de recuperación.");
      return;
    }

    setErrorMsg(null);
    setInfoMsg(null);
    try {
      await sendPasswordResetEmail(auth, cleanEmail);
      setInfoMsg("Te enviamos un correo para restablecer tu contraseña.");
    } catch (err: any) {
      setErrorMsg(translateFirebaseError(err?.code));
    }
  };

  return (
    <SafeAreaView className="flex-1 bg-surface-900">
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        className="flex-1"
      >
        <ScrollView
          contentContainerClassName="flex-grow justify-center px-5 py-8 gap-6 max-w-md w-full self-center"
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {/* ── Encabezado / Branding ──────────────────────────── */}
          <View className="items-center gap-2">
            <View className="w-16 h-16 rounded-3xl bg-primary-600 items-center justify-center shadow-sm">
              <MaterialCommunityIcons
                name="wallet-outline"
                size={34}
                color={colors.white}
              />
            </View>
            <Typography variant="h1" className="mt-2 text-center">
              UNPO: Finanzas
            </Typography>
            <Typography variant="body" muted className="text-center">
              {mode === "login"
                ? "Inicia sesión para acceder a tus cuentas y metas"
                : "Crea tu cuenta personal gratuita"}
            </Typography>
          </View>

          {/* ── Selector Iniciar Sesión / Crear Cuenta ─────────── */}
          <View className="flex-row bg-surface-700 p-1 rounded-2xl">
            <Pressable
              onPress={() => {
                setMode("login");
                setErrorMsg(null);
                setInfoMsg(null);
              }}
              className={`flex-1 py-2.5 rounded-xl items-center ${
                mode === "login" ? "bg-surface-800 shadow-sm" : ""
              }`}
            >
              <Typography
                className={`font-semibold text-sm ${
                  mode === "login" ? "text-text-primary" : "text-text-secondary"
                }`}
              >
                Iniciar sesión
              </Typography>
            </Pressable>

            <Pressable
              onPress={() => {
                setMode("register");
                setErrorMsg(null);
                setInfoMsg(null);
              }}
              className={`flex-1 py-2.5 rounded-xl items-center ${
                mode === "register" ? "bg-surface-800 shadow-sm" : ""
              }`}
            >
              <Typography
                className={`font-semibold text-sm ${
                  mode === "register"
                    ? "text-text-primary"
                    : "text-text-secondary"
                }`}
              >
                Crear cuenta
              </Typography>
            </Pressable>
          </View>

          {/* ── Formulario Email / Contraseña ──────────────────── */}
          <Card className="gap-4 p-5">
            <View className="gap-1.5">
              <Typography variant="label">Correo electrónico</Typography>
              <TextInput
                value={email}
                onChangeText={setEmail}
                placeholder="tu@correo.com"
                placeholderTextColor={colors.text.muted}
                keyboardType="email-address"
                autoCapitalize="none"
                autoComplete="email"
                className="bg-surface-700/70 px-3.5 py-3 rounded-xl text-base text-text-primary"
                style={{ fontFamily: "Inter_400Regular" }}
              />
            </View>

            <View className="gap-1.5">
              <View className="flex-row items-center justify-between">
                <Typography variant="label">Contraseña</Typography>
                {mode === "login" && (
                  <Pressable onPress={handleResetPassword}>
                    <Typography
                      variant="caption"
                      className="text-primary-600 font-semibold"
                    >
                      ¿Olvidaste tu contraseña?
                    </Typography>
                  </Pressable>
                )}
              </View>
              <TextInput
                value={password}
                onChangeText={setPassword}
                placeholder="••••••••"
                placeholderTextColor={colors.text.muted}
                secureTextEntry
                autoCapitalize="none"
                className="bg-surface-700/70 px-3.5 py-3 rounded-xl text-base text-text-primary"
                style={{ fontFamily: "Inter_400Regular" }}
              />
            </View>

            {errorMsg ? (
              <View className="flex-row items-center gap-2 bg-danger-50 p-3 rounded-xl">
                <MaterialCommunityIcons
                  name="alert-circle-outline"
                  size={18}
                  color={colors.danger[500]}
                />
                <Typography className="text-xs text-danger-600 flex-1">
                  {errorMsg}
                </Typography>
              </View>
            ) : null}

            {infoMsg ? (
              <View className="flex-row items-center gap-2 bg-success-50 p-3 rounded-xl">
                <MaterialCommunityIcons
                  name="check-circle-outline"
                  size={18}
                  color={colors.success[600]}
                />
                <Typography className="text-xs text-success-600 flex-1">
                  {infoMsg}
                </Typography>
              </View>
            ) : null}

            <Button
              title={mode === "login" ? "Ingresar" : "Registrarme"}
              onPress={handleEmailAuth}
              loading={loading}
              className="mt-1"
            />
          </Card>

          {/* ── Acceso rápido con Google (Web) ────────────────── */}
          {Platform.OS === "web" && (
            <View className="gap-3">
              <View className="flex-row items-center gap-3">
                <View className="flex-1 h-[1px] bg-surface-600" />
                <Typography variant="caption" muted>
                  o continúa con
                </Typography>
                <View className="flex-1 h-[1px] bg-surface-600" />
              </View>

              <Pressable
                onPress={handleGoogleSignIn}
                disabled={googleLoading}
                className="flex-row items-center justify-center gap-2.5 bg-surface-800 border border-surface-600 py-3.5 px-4 rounded-2xl active:bg-surface-700"
              >
                <MaterialCommunityIcons
                  name="google"
                  size={20}
                  color={colors.primary[600]}
                />
                <Typography className="font-semibold text-text-primary">
                  {googleLoading ? "Conectando..." : "Continuar con Google"}
                </Typography>
              </Pressable>
            </View>
          )}
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

