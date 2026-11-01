# 💰 Finanzas Dashboard

Aplicación móvil moderna de finanzas personales desarrollada con **React Native (Expo SDK 58)**, **NativeWind (Tailwind CSS)** y backend serverless en **Cloudflare Workers** con base de datos SQLite distribuida en **Cloudflare D1**.

---

## 📱 Vista Previa

![Finanzas Dashboard Demo](assets/DEMO.jpg)

---

## ✨ Características Principales

- **Dashboard Resumen**: Visualiza tu patrimonio neto total, dinero disponible (incorporando ahorros en metas), saldo bancario y compromisos de tarjetas de crédito.
- **Gestión de Cuentas y Tarjetas**: Soporte para cuentas bancarias, billeteras virtuales, efectivo y tarjetas de crédito (con límites, fecha de cierre y vencimiento).
- **Metas de Ahorro**: Define objetivos con monto meta y fecha límite. Cada ahorro suma automáticamente a tu disponible y patrimonio.
- **Transacciones Flexibles**: Registro de ingresos, gastos clasificados por rubro y transferencias directas entre cuentas.
- **Reportes Interactivos**:
  - Análisis mensual detallado.
  - **Consolidado Anual** con evolución mes a mes.
  - Gráficos interactivos de Torta / Dona (SVG nativo) con selección de rubros.
- **Modo Offline / Mock integrado**: Puedes ejecutar y probar toda la aplicación de inmediato sin necesidad de desplegar ningún backend.

---

## 🛠️ Stack Tecnológico

| Capa | Tecnología |
| --- | --- |
| **Framework Móvil** | [Expo SDK 58](https://expo.dev/) + [React Native 0.88](https://reactnative.dev/) |
| **Enrutamiento** | [Expo Router v4](https://docs.expo.dev/router/introduction/) |
| **Estilos** | [NativeWind v4](https://www.nativewind.dev/) (Tailwind CSS) |
| **Estado del Servidor** | [TanStack Query v5](https://tanstack.com/query/latest) |
| **Estado del Cliente** | [Zustand v5](https://github.com/pmndrs/zustand) |
| **Backend & Base de Datos** | [Cloudflare Workers](https://workers.cloudflare.com/) + [Cloudflare D1](https://developers.cloudflare.com/d1/) (SQLite) |

---

## 🚀 Inicio Rápido

### 1. Clonar e instalar dependencias

```bash
git clone https://github.com/MasitasIA/FINANZAS_DASHBOARD_APP.git
cd FINANZAS_DASHBOARD_APP
npm install
```

### 2. Configurar variables de entorno

Copia el archivo de ejemplo:

```bash
cp .env.example .env
```

---

## 🧪 Opción A: Probar en Modo Mock (Sin Backend)

No necesitas crear cuentas ni configurar servidores para probar la app. El modo Mock utiliza datos simulados en memoria:

En tu archivo `.env`, asegúrate de tener:

```env
EXPO_PUBLIC_USE_MOCK=true
```

Inicia la aplicación:

```bash
# Versión Web
npm run web

# O para Android / iOS con Expo Go:
npx expo start
```

---

## ☁️ Opción B: Habilitar tu propia Base de Datos (Cloudflare D1 + Worker)

Si quieres persistir tus datos reales en la nube de forma 100% gratuita con Cloudflare D1:

### 1. Iniciar sesión en Cloudflare Wrangler

```bash
npx wrangler login
```

### 2. Crear tu base de datos D1

```bash
npx wrangler d1 create finanzas-db
```

Copia el `database_id` que te devuelve la terminal y pégalo en [`worker/wrangler.toml`](worker/wrangler.toml):

```toml
[[d1_databases]]
binding = "DB"
database_name = "finanzas-db"
database_id = "TU_DATABASE_ID_AQUI"
```

### 3. Crear las tablas (Migración inicial)

Ejecuta el script SQL para crear la estructura completa de tablas y categorías por defecto:

```bash
npm run d1:init
```

### 4. Configurar el Token de Seguridad (Recomendado)

Genera un token alfanumérico seguro (sin signos `$` ni caracteres especiales) y establécelo como secreto en tu Worker:

```bash
cd worker
npx wrangler secret put API_TOKEN
# Escribe o pega tu token y presiona Enter
cd ..
```

### 5. Desplegar el Worker

```bash
npm run worker:deploy
```

Al finalizar el despliegue, la terminal te indicará la URL pública de tu Worker (por ejemplo: `https://finanzas-worker.tu-subdominio.workers.dev`).

### 6. Conectar la App Móvil con tu Base de Datos

Actualiza tu archivo `.env`:

```env
EXPO_PUBLIC_USE_MOCK=false
EXPO_PUBLIC_API_URL=https://tu-worker.tu-subdominio.workers.dev
EXPO_PUBLIC_API_TOKEN=tu_token_configurado_en_el_paso_4
```

Reinicia el servidor de Expo limpiando la caché:

```bash
npx expo start --clear
```

¡Listo! Tu app estará conectada directamente a tu base de datos SQLite en Cloudflare D1.

---

## 📜 Scripts Disponibles

```bash
npm run web            # Inicia la aplicación en el navegador web
npm run android        # Inicia la aplicación en Android
npm run lint           # Ejecuta el linter (expo lint)
npm run worker:deploy  # Despliega el backend a Cloudflare Workers
npm run d1:init        # Ejecuta schema.sql en la base de datos remota D1
```

---

## 📄 Licencia

Este proyecto está bajo la Licencia MIT.
