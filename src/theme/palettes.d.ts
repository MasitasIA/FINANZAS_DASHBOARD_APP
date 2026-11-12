export type ThemeColors = {
  primary: Record<50 | 100 | 200 | 300 | 400 | 500 | 600 | 700 | 800 | 900, string>;
  success: Record<50 | 400 | 500 | 600, string>;
  danger: Record<50 | 400 | 500 | 600, string>;
  warning: Record<50 | 400 | 500 | 600, string>;
  surface: Record<500 | 600 | 700 | 800 | 900, string>;
  text: { primary: string; secondary: string; muted: string };
  accent: {
    cyan: string;
    purple: string;
    pink: string;
    indigo: string;
    violet: string;
    slate: string;
  };
  white: string;
  black: string;
};

export const lightColors: ThemeColors;
export const darkColors: ThemeColors;
export const palettes: { light: ThemeColors; dark: ThemeColors };
/** Variables CSS (`--color-*` → "r g b") para cada tema. */
export const themeVars: {
  light: Record<string, string>;
  dark: Record<string, string>;
};
export function buildTailwindColors(): Record<string, unknown>;
export const accountColors: string[];

