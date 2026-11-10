/**
 * Fuente única de verdad de los colores de la app (modo claro y oscuro).
 *
 * - Lo consume `tailwind.config.js` (Node/CJS) para generar las clases `bg-surface-900`, `text-text-primary`, etc.
 *   Cada color de tema se resuelve en runtime vía variable CSS: `rgb(var(--color-surface-900) / <alpha-value>)`.
 * - Lo consume `src/theme/useAppTheme.ts` para exponer `colors` (hex) a iconos, headers, gráficos, etc.
 *
 * ⚠️ Es JS (CommonJS) a propósito: Tailwind lo carga desde Node.
 */

/** Paleta modo CLARO (por defecto). */
const lightColors = {
  primary: {
    50: "#fff2f0",
    100: "#ffe3df",
    200: "#ffcac2",
    300: "#ffa597",
    400: "#f86a58", // Bermellón cálido / Pantone Warm Red
    500: "#e23d28", // Bermellón puro / Pantone 1795 C
    600: "#c8102e", // Rojo Pantone 186 C (Principal)
    700: "#a6192e", // Rojo Pantone 187 C
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

/**
 * Paleta modo OSCURO. Sólo se redefine lo que cambia respecto al claro:
 * superficies, texto y los tintes (50/100/200/300) y tonos de texto (600/700/800/900)
 * de las escalas semánticas para mantener contraste sobre fondo oscuro.
 */
const darkColors = {
  ...lightColors,
  primary: {
    50: "#2a1411",
    100: "#3a1915",
    200: "#52211b",
    300: "#7a2f26",
    400: "#f86a58",
    500: "#ec4a35",
    600: "#dc2f3f", // Botones primarios + links (contraste AA con texto blanco grande)
    700: "#ff8d80",
    800: "#ffb0a6",
    900: "#ffd0ca",
  },
  success: {
    50: "#0f2a1d",
    400: "#47cd89",
    500: "#17b26a",
    600: "#3fcf8e",
  },
  danger: {
    50: "#2d1412",
    400: "#f97066",
    500: "#f04438",
    600: "#e5483c",
  },
  warning: {
    50: "#2e2008",
    400: "#fdb022",
    500: "#f79009",
    600: "#fdb022",
  },
  surface: {
    900: "#14110f", // Fondo principal: negro cálido
    800: "#1f1b19", // Tarjetas
    700: "#2b2623", // Inputs, chips y contenedores
    600: "#3a3430", // Divisores, bordes sutiles y barras de progreso
    500: "#4d4540", // Bordes destacados
  },
  text: {
    primary: "#f5f1ee",
    secondary: "#b7aea8",
    muted: "#8a817b",
  },
};

const palettes = { light: lightColors, dark: darkColors };

/** Grupos de color que cambian con el tema (los que se resuelven por variable CSS). */
const THEMED_GROUPS = ["primary", "success", "danger", "warning", "surface"];

/** "#faf7f5" → "250 247 245" (formato requerido por `rgb(var(--x) / <alpha-value>)`). */
function hexToTriplet(hex) {
  const h = hex.replace("#", "");
  const n = parseInt(h, 16);
  return `${(n >> 16) & 255} ${(n >> 8) & 255} ${n & 255}`;
}

/**
 * Nombre de la variable CSS de cada color de tema.
 *  - primary/success/danger/warning/surface → `--color-<grupo>-<tono>`  (ej: --color-surface-900)
 *  - text                                   → `--color-text-<nombre>`   (ej: --color-text-primary)
 */
function buildThemeVars(palette) {
  const out = {};
  for (const group of THEMED_GROUPS) {
    for (const [shade, hex] of Object.entries(palette[group])) {
      out[`--color-${group}-${shade}`] = hexToTriplet(hex);
    }
  }
  for (const [name, hex] of Object.entries(palette.text)) {
    out[`--color-text-${name}`] = hexToTriplet(hex);
  }
  return out;
}

const themeVars = {
  light: buildThemeVars(lightColors),
  dark: buildThemeVars(darkColors),
};

/** Colores de Tailwind: cada token apunta a su variable CSS (cambia al alternar el tema). */
function buildTailwindColors() {
  const ref = (name) => `rgb(var(--color-${name}) / <alpha-value>)`;
  const result = {};
  for (const group of THEMED_GROUPS) {
    result[group] = {};
    for (const shade of Object.keys(lightColors[group])) {
      result[group][shade] = ref(`${group}-${shade}`);
    }
  }
  for (const name of Object.keys(lightColors.text)) {
    result[`text-${name}`] = ref(`text-${name}`);
  }
  result.accent = lightColors.accent;
  return result;
}

module.exports = {
  lightColors,
  darkColors,
  palettes,
  themeVars,
  buildTailwindColors,
};

