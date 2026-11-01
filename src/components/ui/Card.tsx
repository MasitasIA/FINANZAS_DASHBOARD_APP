import { View, type ViewProps } from "react-native";

interface CardProps extends ViewProps {
  /** Aplica borde sutil si true */
  bordered?: boolean;
  /** Padding interno predefinido */
  padding?: "none" | "sm" | "md" | "lg";
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
  className = "",
  children,
  ...props
}: CardProps) {
  return (
    <View
      className={`
        bg-surface-800
        rounded-3xl
        border border-surface-600/70
        ${paddingStyles[padding]}
        ${className}
      `}
      {...props}
    >
      {children}
    </View>
  );
}
