/// <reference types="nativewind/types" />

// Permite importar archivos .css como side-effect (ej: import "../global.css")
declare module "*.css" {
  const content: Record<string, string>;
  export default content;
}

declare module "*tailwind.config" {
  export const colors: {
    primary: {
      50: string;
      100: string;
      200: string;
      300: string;
      400: string;
      500: string;
      600: string;
      700: string;
      800: string;
      900: string;
    };
    surface: {
      900: string;
      800: string;
      700: string;
      600: string;
      500: string;
    };
    text: {
      primary: string;
      secondary: string;
      muted: string;
    };
    success: {
      50: string;
      400: string;
      500: string;
      600: string;
    };
    danger: {
      50: string;
      400: string;
      500: string;
      600: string;
    };
    warning: {
      50: string;
      400: string;
      500: string;
      600: string;
    };
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
  export const accountColors: string[];
  const config: { colors: typeof colors; accountColors: string[]; [key: string]: any };
  export default config;
}
