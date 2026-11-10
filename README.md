# 💰 UNPO: Finanzas (Finanzas Dashboard)

Aplicación móvil multi-usuario de finanzas personales desarrollada con **React Native (Expo SDK 58)**, **NativeWind v4 (Tailwind CSS)**, autenticación con **Firebase Auth** y backend serverless en **Cloudflare Workers** con base de datos SQLite distribuida en **Cloudflare D1**.

---

## 📱 Vista Previa

![Finanzas Dashboard Demo](assets/DEMO.jpg)

---

## ✨ Características Principales

- **Dashboard Resumen**:
  - Visualiza tu **Patrimonio Neto Total** y **Dinero Disponible** (incorporando ahorros en metas y descontando automáticamente saldos negativos en cuentas o deudas de tarjetas de crédito).
  - Vista rápida de **Cuentas**, **Metas activas**, **Gastos e Ingresos Automáticos** y un panel de **Información del Sistema** (versión instalada, usuarios activos, almacenamiento usado en Cloudflare D1 sobre la cuota de 5 GB y búsqueda manual de actualizaciones OTA).
- **Gastos e Ingresos Automáticos (`/recurring`)**:
  - **2 pestañas unificadas**: *Gastos automáticos* (suscripciones, alquiler, servicios) e *Ingresos automáticos* (sueldo/trabajo, pensión, beca, aporte, alquiler cobrado, etc.) con selección de categoría, fecha, frecuencia (*Mensual*, *Anual*, *Semanal*) y cuenta asociada.
  - **Balance fijo mensual estimado**: cálculo en tiempo real del flujo neto entre ingresos fijos y gastos fijos activos.
  - **Modo Fijo vs. Modo Variable (`is_variable`)**:
    - **⚡ Monto Fijo (Automático)**: se descuenta o acredita automáticamente al llegar el día indicado y avanza la fecha al próximo ciclo.
    - **🔔 Monto Variable (Consultar)**: espera al día indicado y a la **hora personal configurada por cada usuario** (`user_settings.reminder_time`) para preguntar si el precio/ingreso cambió este mes o se mantiene igual, permitiendo actualizar opcionalmente el monto base para futuros meses.
- **Sistema de Notificaciones Móviles (`expo-notifications`)**:
  - **Aviso anticipado (1 día antes)**: notifica en el celular cuando mañana vas a cobrar un ingreso (`💰 Mañana cobras...`) o vence un gasto (`📅 Mañana vence...`).
  - **Aviso el día de vencimiento**: a la hora elegida por el usuario, envía una notificación interactiva (`🔔 ¿Cambió el precio de...?` para variables o `⚡ Hoy se acredita/descuenta...` para fijos) que al tocarse abre directamente el cuadro de confirmación en la app.
  - **Confirmación de ejecución automática**: notifica inmediatamente cuando un movimiento fijo fue acreditado o descontado.
- **🌙 Modo Oscuro por Usuario**:
  - Cada usuario puede activar el **modo oscuro** desde el Dashboard (botón ☀️/🌙 del encabezado o interruptor en *Información del sistema*). El cambio es instantáneo.
  - La preferencia se guarda **por cuenta en Cloudflare D1** (`user_settings.theme`, valores `light` | `dark`, **por defecto `light`**) y se aplica automáticamente al iniciar sesión en cualquier dispositivo.
  - **Estilos globales con variables CSS**: todos los colores (`surface`, `text`, `primary`, `success`, `danger`, `warning`) se definen una sola vez en [`src/theme/palettes.js`](src/theme/palettes.js) y NativeWind los resuelve en runtime, por lo que las clases (`bg-surface-900`, `text-text-primary`…) cambian solas con el tema.
- **Cuentas y Metas Compartidas (`UNPO-XXXX`)**:
  - Permite compartir tanto **Cuentas** como **Metas de Ahorro** con otros usuarios mediante **códigos de invitación temporales (`UNPO-XXXX`)** válidos por 24 horas.
  - **Registro de autoría (`author_name`)**: cada gasto, ingreso, aporte o retiro dentro de una cuenta o meta compartida muestra qué miembro lo realizó (`• 👤 Nombre`).
  - **Desglose de aportes por miembro**: en las metas compartidas se calcula automáticamente cuánto dinero neto y qué porcentaje del total ahorrado aportó cada participante.
  - **Control de acceso**: el propietario puede quitar miembros en cualquier momento y los invitados pueden abandonar la cuenta o meta compartida.
- **Reportes Interactivos y Proyección Financiera (`/(tabs)/reports`)**:
  - **Mensual**: desglose de ingresos y gastos con gráficos interactivos de Torta / Dona (SVG nativo).
  - **Anual**: consolidado anual y evolución mes a mes.
  - **🔮 Proyección a Futuro**: curva interactiva a 12 meses, simulador con **3 escenarios** (*Ritmo actual*, *Ahorrador -15% gastos*, *Prudente +15% gastos*), hitos de patrimonio estimado a **+3 meses, +6 meses, +1 año y +2 años**, y fecha estimada (ETA) para alcanzar cada meta de ahorro activa.
- **Seguridad Multicapa**:
  - **Autenticación Firebase (JWT RS256)**: verificación criptográfica de tokens en el Worker contra las claves públicas de Google.
  - **Row-Level Security (RLS)**: aislamiento estricto por `user_id` tanto en consultas del Worker como en los `TRIGGER` de SQLite D1 y validación de propiedad cruzada (`verifyAccountOwnership` / `verifyGoalOwnership`).
  - **Anti-XSS y Sanitización**: limpieza estricta de textos, identificadores, colores, íconos, montos y límite de payload JSON (16 KB), junto con cabeceras HTTP de seguridad (`CSP`, `HSTS`, `X-Content-Type-Options`, `X-Frame-Options`).
  - **Rate Limiting en 2 niveles**: límite por IP pre-autenticación (anti-DDoS) y límite por `userId` autenticado diferenciando lecturas y escrituras.
- **Actualizaciones OTA Automáticas (`expo-updates` + EAS Workflows)**:
  - Descarga actualizaciones en segundo plano desde el canal `production` y muestra un banner superior (`"Nueva versión descargada y lista — Actualizar ahora"`) sin requerir reinstalar el APK para cambios de JS/UI.
- **Modo Offline / Mock integrado**: puedes ejecutar y probar toda la aplicación de inmediato sin necesidad de desplegar ningún backend (`EXPO_PUBLIC_USE_MOCK=true`).

---

## 🛠️ Stack Tecnológico

| Capa                        | Tecnología                                                                                                              |
| --------------------------- | ----------------------------------------------------------------------------------------------------------------------- |
| **Framework Móvil**         | [Expo SDK 58](https://expo.dev/) + [React Native 0.88](https://reactnative.dev/)                                        |
| **Enrutamiento**            | [Expo Router v4](https://docs.expo.dev/router/introduction/)                                                            |
| **Estilos**                 | [NativeWind v4](https://www.nativewind.dev/) (Tailwind CSS)                                                             |
| **Autenticación**           | [Firebase Authentication](https://firebase.google.com/docs/auth) (Email/Password + Google)                              |
| **Notificaciones**          | [Expo Notifications](https://docs.expo.dev/versions/v58.0.0/sdk/notifications/) (Canales Android + Triggers locales)    |
| **Actualizaciones OTA**     | [Expo Updates](https://docs.expo.dev/eas-update/introduction/) + EAS Workflows                                          |
| **Estado del Servidor**     | [TanStack Query v5](https://tanstack.com/query/latest)                                                                  |
| **Estado del Cliente**      | [Zustand v5](https://github.com/pmndrs/zustand)                                                                         |
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

Copia el archivo de ejemplo y completa las variables de Firebase y la URL de tu Worker:

```bash
cp .env.example .env
```

---

## 🧪 Opción A: Probar en Modo Mock (Sin Backend)

En tu archivo `.env`, asegúrate de tener:

```env
EXPO_PUBLIC_USE_MOCK=true
```

Inicia la aplicación:

```bash
# Versión Web
npm run web

# O para Android / iOS:
npx expo start --clear
```

---

## ☁️ Opción B: Conectar con Cloudflare D1 + Worker

### 1. Iniciar sesión en Cloudflare Wrangler

```bash
npx wrangler login
```

### 2. Crear o inicializar la base de datos D1

```bash
npm run d1:init
```

### 3. Desplegar el Worker

```bash
npm run worker:deploy
```

### 4. Configurar `.env` para usar el Backend Real

```env
EXPO_PUBLIC_USE_MOCK=false
EXPO_PUBLIC_API_URL=https://finanzas-worker.tu-subdominio.workers.dev
```

---

## 📦 Compilación APK y Actualizaciones OTA

- **Actualización OTA (solo cambios en JS, pantallas, estilos o lógica)**:
  - Al hacer `git push` a la rama `main`, el workflow `.eas/workflows/update.yml` publica automáticamente la actualización en el canal `production`.
  - También puedes publicarla manualmente:

    ```bash
    npx eas-cli update --channel production --message "Descripción del cambio"
    ```

- **Nueva compilación nativa APK (cuando se agregan librerías nativas nuevas en `package.json` o `app.json`)**:

  ```bash
  npx eas-cli build -p android --profile production
  ```

---

## 📜 Scripts Disponibles

```bash
npm run web            # Inicia la aplicación en el navegador web
npm run android        # Inicia la aplicación en Android
npm run lint           # Ejecuta el linter (expo lint)
npm run worker:dev     # Ejecuta el Cloudflare Worker en modo local
npm run worker:deploy  # Despliega el backend a Cloudflare Workers
npm run d1:init        # Ejecuta schema.sql en la base de datos remota D1
npm run d1:init:local  # Ejecuta schema.sql en la base de datos local D1
```

---

## 📄 Licencia

Este proyecto está bajo la Licencia MIT.
