import React, { useState } from "react";
import {
  Image,
  Modal,
  Pressable,
  ScrollView,
  View,
} from "react-native";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { signOut } from "firebase/auth";
import { auth } from "@/lib/firebase";
import { useAppTheme } from "@/theme/useAppTheme";
import { Button, ConfirmModal, ThemeToggle, Typography } from "@/components/ui";

interface UserProfileModalProps {
  visible: boolean;
  onClose: () => void;
  totalAccounts?: number;
  totalTransactions?: number;
  totalGoals?: number;
  totalBudgets?: number;
  totalRecurring?: number;
}

function formatUserDate(dateStr?: string | null, includeTime = false): string {
  if (!dateStr) return "No disponible";
  try {
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return "No disponible";
    if (includeTime) {
      return d.toLocaleDateString("es-AR", {
        day: "numeric",
        month: "short",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      });
    }
    return d.toLocaleDateString("es-AR", {
      day: "numeric",
      month: "long",
      year: "numeric",
    });
  } catch {
    return "No disponible";
  }
}

export function UserProfileModal({
  visible,
  onClose,
  totalAccounts = 0,
  totalTransactions = 0,
  totalGoals = 0,
  totalBudgets = 0,
  totalRecurring = 0,
}: UserProfileModalProps) {
  const { colors } = useAppTheme();
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);

  const currentUser = auth.currentUser;
  if (!currentUser) return null;

  const creationTime = currentUser.metadata.creationTime;
  const lastSignInTime = currentUser.metadata.lastSignInTime;

  const isGoogle = currentUser.providerData.some(
    (p) => p.providerId === "google.com",
  );

  const displayName = currentUser.displayName || "Usuario";
  const email = currentUser.email || "Sin correo registrado";

  const handleLogout = () => {
    setShowLogoutConfirm(false);
    onClose();
    signOut(auth);
  };

  return (
    <>
      <Modal
        visible={visible}
        transparent
        animationType="fade"
        onRequestClose={onClose}
      >
        <Pressable
          onPress={onClose}
          className="flex-1 bg-black/60 items-center justify-center px-4 py-8"
        >
          <Pressable
            onPress={(e) => e.stopPropagation()}
            className="w-full max-w-sm bg-surface-800 rounded-3xl p-5 border border-surface-600/80 shadow-xl max-h-[90%]"
          >
            {/* Header del modal */}
            <View className="flex-row items-center justify-between pb-2 border-b border-surface-600/40">
              <View className="flex-row items-center gap-2">
                <MaterialCommunityIcons
                  name="badge-account-horizontal-outline"
                  size={20}
                  color={colors.primary[600]}
                />
                <Typography variant="h3">Perfil de Usuario</Typography>
              </View>
              <Pressable
                onPress={onClose}
                className="w-8 h-8 rounded-full bg-surface-700 items-center justify-center active:bg-surface-600"
                accessibilityLabel="Cerrar modal de perfil"
              >
                <MaterialCommunityIcons
                  name="close"
                  size={16}
                  color={colors.text.secondary}
                />
              </Pressable>
            </View>

            <ScrollView
              showsVerticalScrollIndicator={false}
              contentContainerClassName="pt-4 gap-4 pb-2"
            >
              {/* Tarjeta de Identificación */}
              <View className="items-center bg-surface-900 p-4 rounded-2xl border border-surface-600/60 gap-2">
                {currentUser.photoURL ? (
                  <Image
                    source={{ uri: currentUser.photoURL }}
                    className="w-16 h-16 rounded-full border-2 border-primary-600/40"
                  />
                ) : (
                  <View className="w-16 h-16 rounded-full bg-primary-600/15 items-center justify-center border-2 border-primary-600/30">
                    <MaterialCommunityIcons
                      name="account"
                      size={36}
                      color={colors.primary[600]}
                    />
                  </View>
                )}

                <Typography
                  variant="body"
                  className="font-bold text-base text-text-primary text-center"
                >
                  {displayName}
                </Typography>

                <Typography
                  variant="caption"
                  numberOfLines={1}
                  className="text-text-secondary text-center -mt-1"
                >
                  {email}
                </Typography>

                {/* Badge de método de autenticación */}
                <View className="flex-row items-center gap-1.5 px-3 py-1 rounded-full bg-surface-800 border border-surface-600/60 mt-1">
                  <MaterialCommunityIcons
                    name={isGoogle ? "google" : "email-check-outline"}
                    size={13}
                    color={isGoogle ? colors.primary[600] : colors.success[500]}
                  />
                  <Typography variant="caption" className="text-xs font-medium text-text-secondary">
                    {isGoogle ? "Cuenta Google" : "Correo y Contraseña"}
                  </Typography>
                </View>
              </View>

              {/* Estadísticas de la cuenta (Cuentas, Movimientos, Metas, Presupuestos) */}
              <View className="gap-2">
                <Typography
                  variant="caption"
                  className="font-semibold uppercase tracking-wider text-text-secondary px-1"
                >
                  Resumen de actividad
                </Typography>

                <View className="flex-row gap-2.5">
                  {/* Cuentas totales */}
                  <View className="flex-1 bg-surface-900 p-3 rounded-2xl border border-surface-600/60 items-center justify-center">
                    <View className="w-8 h-8 rounded-xl bg-primary-600/15 items-center justify-center mb-1">
                      <MaterialCommunityIcons
                        name="wallet-outline"
                        size={17}
                        color={colors.primary[600]}
                      />
                    </View>
                    <Typography variant="h3" className="text-text-primary font-bold">
                      {totalAccounts}
                    </Typography>
                    <Typography variant="caption" muted className="text-[11px] text-center">
                      Cuentas totales
                    </Typography>
                  </View>

                  {/* Movimientos totales */}
                  <View className="flex-1 bg-surface-900 p-3 rounded-2xl border border-surface-600/60 items-center justify-center">
                    <View className="w-8 h-8 rounded-xl bg-primary-600/15 items-center justify-center mb-1">
                      <MaterialCommunityIcons
                        name="swap-horizontal"
                        size={17}
                        color={colors.primary[600]}
                      />
                    </View>
                    <Typography variant="h3" className="text-text-primary font-bold">
                      {totalTransactions}
                    </Typography>
                    <Typography variant="caption" muted className="text-[11px] text-center">
                      Movimientos
                    </Typography>
                  </View>
                </View>

                <View className="flex-row gap-2.5">
                  {/* Metas de ahorro */}
                  <View className="flex-1 bg-surface-900 p-3 rounded-2xl border border-surface-600/60 items-center justify-center">
                    <View className="w-8 h-8 rounded-xl bg-primary-600/15 items-center justify-center mb-1">
                      <MaterialCommunityIcons
                        name="piggy-bank-outline"
                        size={17}
                        color={colors.primary[600]}
                      />
                    </View>
                    <Typography variant="h3" className="text-text-primary font-bold">
                      {totalGoals}
                    </Typography>
                    <Typography variant="caption" muted className="text-[11px] text-center">
                      Metas activas
                    </Typography>
                  </View>

                  {/* Presupuestos configurados */}
                  <View className="flex-1 bg-surface-900 p-3 rounded-2xl border border-surface-600/60 items-center justify-center">
                    <View className="w-8 h-8 rounded-xl bg-primary-600/15 items-center justify-center mb-1">
                      <MaterialCommunityIcons
                        name="chart-arc"
                        size={17}
                        color={colors.primary[600]}
                      />
                    </View>
                    <Typography variant="h3" className="text-text-primary font-bold">
                      {totalBudgets}
                    </Typography>
                    <Typography variant="caption" muted className="text-[11px] text-center">
                      Presupuestos
                    </Typography>
                  </View>
                </View>

                {totalRecurring > 0 && (
                  <View className="bg-surface-900 px-3.5 py-2.5 rounded-2xl border border-surface-600/60 flex-row items-center justify-between">
                    <View className="flex-row items-center gap-2">
                      <MaterialCommunityIcons
                        name="calendar-sync-outline"
                        size={16}
                        color={colors.primary[600]}
                      />
                      <Typography variant="caption" className="font-medium text-text-primary">
                        Gastos/Ingresos automáticos
                      </Typography>
                    </View>
                    <Typography variant="caption" className="font-bold text-primary-600">
                      {totalRecurring}
                    </Typography>
                  </View>
                )}
              </View>

              {/* Información y fechas de cuenta */}
              <View className="gap-2">
                <Typography
                  variant="caption"
                  className="font-semibold uppercase tracking-wider text-text-secondary px-1"
                >
                  Detalles del registro
                </Typography>

                <View className="bg-surface-900 p-3.5 rounded-2xl border border-surface-600/60 gap-3">
                  {/* Fecha de registro */}
                  <View className="flex-row items-center justify-between">
                    <View className="flex-row items-center gap-2 flex-1 mr-2">
                      <MaterialCommunityIcons
                        name="calendar-account-outline"
                        size={16}
                        color={colors.text.secondary}
                      />
                      <Typography variant="caption" className="text-text-secondary">
                        Fecha de registro
                      </Typography>
                    </View>
                    <Typography
                      variant="caption"
                      className="font-semibold text-text-primary text-right"
                    >
                      {formatUserDate(creationTime)}
                    </Typography>
                  </View>

                  <View className="h-px bg-surface-600/40" />

                  {/* Último acceso */}
                  <View className="flex-row items-center justify-between">
                    <View className="flex-row items-center gap-2 flex-1 mr-2">
                      <MaterialCommunityIcons
                        name="clock-time-four-outline"
                        size={16}
                        color={colors.text.secondary}
                      />
                      <Typography variant="caption" className="text-text-secondary">
                        Último acceso
                      </Typography>
                    </View>
                    <Typography
                      variant="caption"
                      className="font-semibold text-text-primary text-right"
                    >
                      {formatUserDate(lastSignInTime, true)}
                    </Typography>
                  </View>

                  <View className="h-px bg-surface-600/40" />

                  {/* ID de usuario */}
                  <View className="flex-row items-center justify-between">
                    <View className="flex-row items-center gap-2 flex-1 mr-2">
                      <MaterialCommunityIcons
                        name="identifier"
                        size={16}
                        color={colors.text.secondary}
                      />
                      <Typography variant="caption" className="text-text-secondary">
                        Identificador
                      </Typography>
                    </View>
                    <Typography
                      variant="caption"
                      numberOfLines={1}
                      className="font-mono text-xs text-text-muted"
                    >
                      {currentUser.uid.slice(0, 12)}...
                    </Typography>
                  </View>
                </View>
              </View>

              {/* Ajustes de apariencia */}
              <View className="gap-2">
                <Typography
                  variant="caption"
                  className="font-semibold uppercase tracking-wider text-text-secondary px-1"
                >
                  Preferencia visual
                </Typography>
                <ThemeToggle />
              </View>

              {/* Botón de Cerrar Sesión */}
              <View className="pt-2 gap-2">
                <Button
                  title="Cerrar sesión"
                  variant="danger"
                  onPress={() => setShowLogoutConfirm(true)}
                />
              </View>
            </ScrollView>
          </Pressable>
        </Pressable>
      </Modal>

      {/* Modal de confirmación para cerrar sesión */}
      <ConfirmModal
        visible={showLogoutConfirm}
        title="¿Cerrar sesión?"
        message="¿Estás seguro de que deseas salir de tu cuenta? Tendrás que iniciar sesión nuevamente para acceder a tus finanzas."
        confirmText="Cerrar sesión"
        cancelText="Volver"
        confirmVariant="danger"
        icon="logout"
        onConfirm={handleLogout}
        onCancel={() => setShowLogoutConfirm(false)}
      />
    </>
  );
}

