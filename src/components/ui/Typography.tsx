import { Text, type TextProps } from "react-native";

interface TypographyProps extends TextProps {
  variant?: "h1" | "h2" | "h3" | "body" | "caption" | "label";
  muted?: boolean;
}

const variantClasses: Record<NonNullable<TypographyProps["variant"]>, string> = {
  h1:      "text-2xl font-bold text-text-primary",
  h2:      "text-xl font-semibold text-text-primary",
  h3:      "text-lg font-medium text-text-primary",
  body:    "text-base font-sans text-text-primary",
  caption: "text-sm font-sans text-text-secondary",
  label:   "text-xs font-medium tracking-wide text-text-secondary uppercase",
};

export function Typography({
  variant = "body",
  muted = false,
  className = "",
  ...props
}: TypographyProps) {
  return (
    <Text
      className={`${variantClasses[variant]} ${muted ? "text-text-muted" : ""} ${className}`}
      {...props}
    />
  );
}
