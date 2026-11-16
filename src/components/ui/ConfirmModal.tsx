import React from "react";
import {
  Modal,
  Pressable,
  View,
} from "react-native";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { useAppTheme } from "@/theme/useAppTheme";
import { Typography } from "./Typography";
import { Button } from "./Button";

export interface ConfirmModalProps {
  visible: boolean;
  title: string;
  message: string;
  confirmText?: string;
  cancelText?: string;
  confirmVariant?: "primary" | "danger" | "warning";
  icon?: keyof typeof MaterialCommunityIcons.glyphMap;
  iconColor?: string;
  loading?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

export function ConfirmModal({
  visible,
  title,
  message,
  confirmText = "Confirmar",
  cancelText = "Cancelar",
  confirmVariant = "primary",
  icon,
  iconColor,
  loading = false,
  onConfirm,
  onCancel,
}: ConfirmModalProps) {
  const { colors } = useAppTheme();

  // Color e ícono por defecto según la variante
  const isDanger = confirmVariant === "danger";
  const isWarning = confirmVariant === "warning";

  const defaultIcon = isDanger
    ? "alert-circle-outline"
    : isWarning
      ? "alert-outline"
      : "check-circle-outline";

  const resolvedIcon = icon || defaultIcon;

  const defaultIconBg = isDanger
    ? "bg-danger-500/15"
    : isWarning
      ? "bg-warning-500/15"
      : "bg-primary-600/15";

  const defaultIconColor = isDanger
    ? colors.danger?.[500] || "#f04438"
    : isWarning
      ? colors.warning?.[500] || "#f79009"
      : colors.primary[600];

  const resolvedColor = iconColor || defaultIconColor;

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      statusBarTranslucent
      onRequestClose={onCancel}
    >
      <Pressable
        onPress={onCancel}
        className="flex-1 bg-black/60 items-center justify-center p-4"
      >
        <Pressable
          onPress={(e) => e.stopPropagation()}
          className="w-full max-w-sm bg-surface-800 rounded-3xl p-6 border border-surface-600/70 shadow-2xl gap-4"
        >
          {/* Ícono superior */}
          <View className="items-center">
            <View
              className={`w-14 h-14 rounded-2xl items-center justify-center ${defaultIconBg}`}
            >
              <MaterialCommunityIcons
                name={resolvedIcon}
                size={30}
                color={resolvedColor}
              />
            </View>
          </View>

          {/* Título y Mensaje */}
          <View className="gap-2 items-center">
            <Typography variant="h3" className="text-center">
              {title}
            </Typography>
            <Typography
              variant="body"
              className="text-center text-sm text-text-secondary leading-relaxed"
            >
              {message}
            </Typography>
          </View>

          {/* Botones de acción */}
          <View className="flex-row gap-3 pt-2">
            <Button
              title={cancelText}
              variant="secondary"
              className="flex-1"
              disabled={loading}
              onPress={onCancel}
            />
            <Button
              title={confirmText}
              variant={isDanger ? "danger" : "primary"}
              className="flex-1"
              loading={loading}
              onPress={onConfirm}
            />
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

