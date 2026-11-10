import { View, type ViewProps } from "react-native";

interface CardProps extends ViewProps {
  /** Aplica borde sutil si true */
  bordered?: boolean;
  /** Padding interno predefinido */
  padding?: "none" | "sm" | "md" | "lg";
  /** Variante semántica de color para el contenedor */
  variant?: "default" | "income" | "expense";
}

const paddingStyles: Record<NonNullable<CardProps["padding"]>, string> = {
  none: "",
  sm: "p-3",
  md: "p-4",
  lg: "p-5",
};

export function Card({
  bordered = false,
  padding = "md",
  variant = "default",
  className = "",
  children,
  ...props
}: CardProps) {
  const variantStyles =
    variant === "income"
      ? "bg-success-500/10 border-success-500/35"
      : variant === "expense"
        ? "bg-danger-500/10 border-danger-500/35"
        : "bg-surface-800 border-surface-600/70";

  return (
    <View
      className={`
        rounded-3xl
        border
        ${variantStyles}
        ${paddingStyles[padding]}
        ${className}
      `}
      {...props}
    >
      {children}
    </View>
  );
}
