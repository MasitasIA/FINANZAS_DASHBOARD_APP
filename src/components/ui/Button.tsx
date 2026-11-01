import {
  Pressable,
  type PressableProps,
  ActivityIndicator,
} from "react-native";
import { colors } from "../../../tailwind.config";
import { Typography } from "./Typography";

interface ButtonProps extends PressableProps {
  title: string;
  variant?: "primary" | "secondary" | "ghost" | "danger";
  size?: "sm" | "md" | "lg";
  loading?: boolean;
  icon?: React.ReactNode;
}

const variantStyles: Record<NonNullable<ButtonProps["variant"]>, string> = {
  primary: "bg-primary-600 active:bg-primary-700",
  secondary:
    "bg-surface-700 active:bg-surface-600 border border-surface-600/50",
  ghost: "bg-transparent active:bg-surface-700",
  danger: "bg-danger-600 active:bg-danger-700",
};

const sizeStyles: Record<NonNullable<ButtonProps["size"]>, string> = {
  sm: "px-3 py-2 rounded-xl gap-1.5",
  md: "px-4 py-3 rounded-2xl gap-2",
  lg: "px-6 py-4 rounded-2xl gap-2",
};

const labelSizes: Record<NonNullable<ButtonProps["size"]>, string> = {
  sm: "text-sm font-medium",
  md: "text-base font-semibold",
  lg: "text-lg font-semibold",
};

const labelColors: Record<NonNullable<ButtonProps["variant"]>, string> = {
  primary: "text-white",
  secondary: "text-text-primary",
  ghost: "text-text-primary",
  danger: "text-white",
};

export function Button({
  title,
  variant = "primary",
  size = "md",
  loading = false,
  icon,
  className = "",
  disabled,
  ...props
}: ButtonProps) {
  const isDisabled = disabled || loading;

  return (
    <Pressable
      className={`
        flex-row items-center justify-center
        ${variantStyles[variant]}
        ${sizeStyles[size]}
        ${isDisabled ? "opacity-50" : ""}
        ${className}
      `}
      disabled={isDisabled}
      {...props}
    >
      {loading ? (
        <ActivityIndicator
          size="small"
          color={
            variant === "primary" || variant === "danger"
              ? colors.white
              : colors.text.primary
          }
        />
      ) : (
        <>
          {icon}
          <Typography className={`${labelColors[variant]} ${labelSizes[size]}`}>
            {title}
          </Typography>
        </>
      )}
    </Pressable>
  );
}
