const {
  lightColors,
  themeVars,
  buildTailwindColors,
} = require("./src/theme/palettes");

// Paleta modo claro (por defecto). Se mantiene exportada por compatibilidad:
// para colores que cambian con el tema usa `useAppTheme().colors` (src/theme/useAppTheme.ts).
const colors = lightColors;

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
      // primary / success / danger / warning / surface / text-* → variables CSS
      // (los valores de cada tema viven en src/theme/palettes.js)
      colors: buildTailwindColors(),
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
  plugins: [
    // Valores por defecto (modo claro). El modo oscuro los sobreescribe en runtime
    // desde <ThemeProvider> (src/theme/ThemeProvider.tsx) con `vars()`.
    ({ addBase }) => {
      addBase({ ":root": themeVars.light });
    },
  ],
  colors,
  accountColors,
};

module.exports.colors = colors;
module.exports.accountColors = accountColors;
