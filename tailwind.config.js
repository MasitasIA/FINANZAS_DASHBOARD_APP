const colors = {
  primary: {
    50: "#fff2f0",
    100: "#ffe3df",
    200: "#ffcac2",
    300: "#ffa597",
    400: "#f86a58", // Bermellón cálido / Pantone Warm Red
    500: "#e23d28", // Bermellón puro / Pantone 1795 C
    600: "#c8102e", // Rojo Pantone 186 C (Principal)
    700: "#a6192e", // Rojo Pantone 187 C (Active / pressed)
    800: "#7d1525", // Rojo Pantone 188 C
    900: "#580f1a", // Granate profundo
  },
  success: {
    50: "#ecfdf3",
    400: "#47cd89",
    500: "#17b26a",
    600: "#079455",
  },
  danger: {
    50: "#fef3f2",
    400: "#f97066",
    500: "#f04438",
    600: "#d92d20",
  },
  warning: {
    50: "#fffaeb",
    400: "#fdb022",
    500: "#f79009",
    600: "#dc6803",
  },
  surface: {
    900: "#faf7f5", // Fondo principal: marfil cálido suave y acogedor
    800: "#ffffff", // Tarjetas (Cards): blanco puro
    700: "#f2ece6", // Inputs, chips y contenedores: arena suave
    600: "#e6ded6", // Divisores, bordes sutiles y barras de progreso
    500: "#d3c8be", // Bordes destacados
  },
  text: {
    primary: "#1c1917", // Negro cálido / Stone 900
    secondary: "#68615e", // Gris cálido / Stone 600
    muted: "#9c928d", // Stone 400
  },
  accent: {
    cyan: "#06aed4",
    purple: "#9e77ed",
    pink: "#ec4899",
    indigo: "#8098f9",
    violet: "#c084fc",
    slate: "#9ea4c1",
  },
  white: "#ffffff",
  black: "#000000",
};

const accountColors = [
  colors.primary[500],
  colors.success[500],
  colors.accent.cyan,
  colors.warning[500],
  colors.accent.purple,
  colors.accent.pink,
  colors.primary[600],
];

/** @type {import('tailwindcss').Config} */
module.exports = {
  darkMode: "class",
  content: ["./app/**/*.{js,jsx,ts,tsx}", "./src/**/*.{js,jsx,ts,tsx}"],
  presets: [require("nativewind/preset")],
  theme: {
    extend: {
      colors: {
        primary: colors.primary,
        success: colors.success,
        danger: colors.danger,
        warning: colors.warning,
        surface: colors.surface,
        accent: colors.accent,
        "text-primary": colors.text.primary,
        "text-secondary": colors.text.secondary,
        "text-muted": colors.text.muted,
      },
      fontFamily: {
        sans: ["Inter_400Regular"],
        medium: ["Inter_500Medium"],
        semibold: ["Inter_600SemiBold"],
        bold: ["Inter_700Bold"],
      },
      borderRadius: {
        "2xl": "16px",
        "3xl": "24px",
      },
    },
  },
  plugins: [],
  colors,
  accountColors,
};

module.exports.colors = colors;
module.exports.accountColors = accountColors;
