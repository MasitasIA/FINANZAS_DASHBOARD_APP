# Finanzas Dashboard — Agent Guide

This is a **multi-user personal finance mobile app** (`UNPO: Finanzas`) built with Expo / React Native, Firebase Authentication, and a Cloudflare Worker + D1 SQLite backend with strict per-user Row-Level Security (RLS). Prioritize mobile-first patterns, performance, security, and cross-platform compatibility (iOS, Android & Web).

---

## ⚠️ Expo Versioning — Read This First

Expo ships breaking changes every SDK release. APIs you remember may be renamed, moved, or removed.

**Before writing any code that touches an Expo, EAS, or React Native API:**

1. Read the `expo` version in [`package.json`](./package.json) — currently **SDK 58**.
2. Fetch the matching docs: `https://docs.expo.dev/versions/v58.0.0/`
3. For anything else, fetch `https://docs.expo.dev/llms.txt` — an index with corrections to common LLM mistakes. Follow its links; never answer from memory.

---

## Commands

```bash
npx expo install <package>   # ALWAYS use instead of npm/bun add — resolves SDK-compatible versions
npx expo start --clear       # start dev server (--clear resets Metro cache)
npm test                     # run financial unit tests with Jest
npx expo lint                # lint
npx tsc --noEmit             # typecheck
npx expo-doctor              # diagnose dependency/config issues
npx expo install --fix       # fix incompatible package versions
npm run worker:deploy        # deploy Cloudflare Worker backend
npm run d1:init              # apply schema.sql to remote Cloudflare D1
```

> **Always run `npm test`, `npx tsc --noEmit` and `npx expo lint` before declaring a task done.**

---

## Tech Stack

| Layer | Library | Notes |
| --- | --- | --- |
| Runtime | Expo SDK 58 + React Native 0.88 (iOS, Android, Web) | |
| Routing | **Expo Router v4** (file-based) | Routes in `app/` (5 tabs) |
| Styling | **NativeWind v4** (Tailwind CSS) | Config in `tailwind.config.js` |
| Language | TypeScript (strict) | Path alias `@/` → `src/` |
| Auth | **Firebase Authentication v13** | Email/Password + Google; verified via RS256 JWT in Worker |
| Testing | **Jest 30 + jest-expo** | Precision monetary arithmetic test suite (`npm test`) |
| Notifications | **expo-notifications** | Local scheduled notifications + Android channels (`src/lib/notifications.ts`) |
| Native I/O & Net | **expo-network, expo-file-system, expo-sharing, expo-document-picker** | Offline status banner + JSON/CSV backup & restore |
| OTA Updates | **expo-updates** + EAS Workflows | Channel `production` linked to branch `production` (`runtimeVersion: "1.1.0"`) |
| Server state | **TanStack Query v5** | All API calls go through hooks |
| Client state | **Zustand v5** | UI-only state (no server data) |
| Backend | **Cloudflare D1** (SQLite) via Worker | REST API over fetch (`worker/src/index.ts`) |
| Fonts | `@expo-google-fonts/inter` | Inter 400/500/600/700 |
| Icons | `@expo/vector-icons` → `MaterialCommunityIcons` | |

---

## Project Structure

```text
finanzas_dashboard/
│
├── app/                          ← Expo Router file-based routes
│   ├── _layout.tsx               ← Root layout: ThemeProvider + ThemeSync, Auth guard, OfflineBanner, OTA banner, RecurringAutoProcessor, Stack
│   ├── login.tsx                 ← Firebase Login / Registration screen
│   ├── (tabs)/
│   │   ├── _layout.tsx           ← Tab bar (5 tabs: Inicio, Cuentas, Calendario, Metas, Reportes)
│   │   ├── index.tsx             ← Dashboard / Home + 3-way funds distribution + Budgets + Info & Backup Modal
│   │   ├── accounts.tsx          ← Accounts list + net worth summary + "Unirse con código"
│   │   ├── calendar.tsx          ← Timeline agenda + interactive monthly grid of expenses/incomes/cards
│   │   ├── goals.tsx             ← Savings goals list + "Unirse con código"
│   │   └── reports.tsx           ← Monthly (MoM comparison & anomaly alerts), Annual & Future Projection with installments
│   ├── accounts/[id].tsx         ← Account detail + movements/installments/statements tabs + Statement closing & payment modal
│   ├── accounts/new.tsx          ← New account modal (presentation: "modal")
│   ├── goals/[id].tsx            ← Goal detail + progress + per-member breakdown + Share goal modal
│   ├── goals/new.tsx             ← New goal modal (presentation: "modal")
│   ├── transaction/new.tsx       ← New transaction modal (presentation: "modal") + Installment plan selector with surcharge calculation
│   └── recurring/index.tsx       ← Automatic Expenses & Incomes management + User reminder hour
│
├── worker/
│   ├── wrangler.toml             ← Cloudflare Worker & D1 binding config
│   └── src/
│       ├── index.ts              ← Entrypoint: CORS, IP/User Rate Limit, Auth & Router Dispatch
│       ├── types.ts              ← Env, AuthenticatedUser & Worker DB interfaces
│       ├── lib/                  ← Cross-cutting modules
│       │   ├── response.ts       ← SECURITY_HEADERS, json(), error(), success()
│       │   ├── rate-limit.ts     ← checkRateLimit & window configs
│       │   ├── sanitize.ts       ← Anti-XSS, amounts, dates, times, theme & parseSafeJsonBody
│       │   ├── auth.ts           ← Firebase ID Token (Web Crypto RS256 + Google JWKS)
│       │   ├── rls.ts            ← Row-Level Security, ownership verifications & schema bootstrap
│       │   └── formatters.ts     ← Snake <-> Camel mappers & date math
│       └── routes/               ← Domain endpoints
│           ├── accounts.ts       ← /accounts
│           ├── categories.ts     ← /categories
│           ├── transactions.ts   ← /transactions
│           ├── goals.ts          ← /goals, /contribute, /withdraw
│           ├── share.ts          ← /share/invite, /share/join, /share/leave
│           ├── reports.ts        ← /reports/monthly, /reports/annual
│           ├── user-settings.ts  ← /user-settings
│           ├── recurring.ts      ← /recurring-expenses, /process-due, /pay, /skip
│           ├── installments.ts   ← /installments (list, create, cancel)
│           ├── statements.ts     ← /statements (list, close, pay)
│           ├── budgets.ts        ← /budgets (list, put, delete)
│           └── system-stats.ts   ← /stats
│
└── src/                          ← All non-route code lives here
    ├── types/index.ts            ← Domain types (Account, Transaction, SavingsGoal, RecurringExpense, Budget, CreditCardInstallment, etc.)
    ├── lib/
    │   ├── api.ts                ← Thin fetch wrapper (attaches Firebase ID Token Bearer header)
    │   ├── firebase.ts           ← Firebase Auth initialization & persistence
    │   ├── notifications.ts      ← Mobile notifications scheduler & Android channel setup + Budget threshold alerts
    │   └── mock/
    │       ├── db.ts             ← In-memory seed data
    │       └── handlers.ts       ← Mock implementations of every API endpoint (including installments, statements, budgets)
    ├── services/                 ← Data access layer (calls api.ts OR dynamic mock handlers)
    │   ├── accounts.service.ts
    │   ├── categories.service.ts
    │   ├── transactions.service.ts
    │   ├── goals.service.ts
    │   ├── reports.service.ts    ← Monthly, Annual and System Stats API
    │   ├── share.service.ts      ← /share/invite, /share/join, /share/leave
    │   ├── recurring.service.ts  ← Recurring expenses/incomes + user_settings + process-due
    │   ├── installments.service.ts ← Credit card installments (cuotas)
    │   ├── statements.service.ts   ← Credit card statements & payments
    │   ├── budgets.service.ts      ← Monthly category budgets
    │   └── backup.service.ts       ← JSON backup dump/restore & CSV transaction exports
    ├── hooks/                    ← TanStack Query hooks (queries + mutations)
    │   ├── useAccounts.ts
    │   ├── useCategories.ts
    │   ├── useTransactions.ts
    │   ├── useGoals.ts
    │   ├── useReports.ts         ← useMonthlyReport, useAnnualReport, useSystemStats
    │   ├── useShare.ts           ← useCreateShareInvite, useJoinSharedResource, useLeaveSharedResource
    │   ├── useRecurringExpenses.ts ← Hooks for recurring items, user settings & auto-processing
    │   ├── useInstallments.ts    ← useInstallments, useCreateInstallment, useCancelInstallment
    │   ├── useStatements.ts      ← useStatements, useCloseStatement, usePayStatement
    │   └── useBudgets.ts         ← useBudgets, useSetBudget, useDeleteBudget
    ├── theme/                    ← Light/Dark theming (global styles)
    │   ├── palettes.js           ← SINGLE source of truth for colors (light + dark + accountColors) → CSS vars
    │   ├── palettes.d.ts         ← Types for palettes.js
    │   ├── ThemeProvider.tsx     ← Injects `--color-*` vars (nativewind `vars()`), colorScheme, web <html> vars; also ThemeSync (D1 → store)
    │   └── useAppTheme.ts        ← useAppTheme() (mode/isDark/colors hex) & useSetTheme() (optimistic + PUT /user-settings)
    ├── store/                    ← Zustand stores (UI-only state)
    │   ├── reports.store.ts
    │   └── theme.store.ts        ← Active theme mode + AsyncStorage cache (avoids flash on startup)
    ├── components/
    │   ├── ui/                   ← Design system primitives
    │   │   ├── Typography.tsx    ← variant prop: h1/h2/h3/body/caption/label
    │   │   ├── Button.tsx        ← variant: primary/secondary/ghost/danger
    │   │   ├── Card.tsx          ← Surface with rounded corners (extends ViewProps)
    │   │   ├── ColorPicker.tsx   ← Interactive color swatch selector
    │   │   ├── IconPicker.tsx    ← Typed MaterialCommunityIcons selector
    │   │   ├── PieChart.tsx      ← Interactive SVG donut/pie chart
    │   │   ├── ThemeToggle.tsx   ← Dark-mode switch (variant: row | icon)
    │   │   ├── OfflineBanner.tsx ← Non-intrusive native connectivity status banner
    │   │   └── index.ts          ← Barrel export
    │   ├── accounts/AccountCard.tsx
    │   ├── goals/GoalCard.tsx
    │   ├── shared/ShareModals.tsx ← JoinWithCodeModal & ShareResourceModal (UNPO-XXXX invites)
    │   └── recurring/RecurringAutoProcessor.tsx ← Background/foreground processor + variable price prompt modal
    └── utils/
        ├── formatters.ts         ← formatCurrency, formatDate, formatRelativeDate, parseSafeDate
        ├── money.ts              ← Exact integer cents arithmetic (toCents, fromCents, splitInstallments, calculateInterest)
        └── __tests__/
            └── money.test.ts     ← Jest financial precision unit test suite (13 passing tests)
```

---

## Core Business Logic Rules

### 1. Net Worth (`Patrimonio`), Disponible, Reservado & Comprometido

- **Funds Classification (3 vías)**:
  - **`Disponible`**: Efectivo positivo en cuentas no crediticias menos los compromisos inmediatos del mes (`cash - committed`). Si es negativo, se ajusta a `0`.
  - **`Reservado`**: Suma de ahorros acumulados en metas de ahorro activas (`currentAmount`).
  - **`Comprometido`**: Gastos automáticos pendientes del mes en curso más deudas acumuladas de tarjetas de crédito.
- **Patrimonio Neto**:
  - `totalCash + totalSavedInGoals - totalCreditDebt - totalNegativeAccountsDebt`.

### 2. Exact Monetary Precision in Integer Cents (`money.ts`)

- Todas las operaciones monetarias en D1, Worker y cliente se operan en **centavos enteros (`INTEGER`)**, eliminando errores de redondeo de IEEE 754:
  - `toCents(amount: number): number`
  - `fromCents(cents: number): number`
  - `splitInstallments(totalCents, count)`: Distribuye los centavos sobrantes en las primeras cuotas bancarias.
  - `calculateInterest(totalFinanced, cashPrice)`: Calcula recargo financiero e interés implícito.
- Cada cambio financiero está respaldado por la suite de pruebas unitarias Jest (`src/utils/__tests__/money.test.ts`, 13 tests).

### 3. Credit Cards, Installments & Statements

- **Límite bancario disponible**: `creditLimit - currentDebt - futureInstallmentsDebt`.
- **Compras en cuotas (`credit_card_installments`)**: Registro de planes de cuotas, vinculación opcional a transacción, recargo contra precio de contado y vencimiento según `dueDay` de la tarjeta.
- **Resúmenes mensuales (`credit_card_statements`)**: Períodos de facturación, fecha de cierre (`closingDate`), fecha de vencimiento (`dueDate`), total financiado, pago mínimo y pagos parciales o totales que liquidan automáticamente desde la cuenta seleccionada.

### 4. Category Monthly Budgets (`budgets`)

- Presupuestos mensuales por categoría y moneda (`user_id, category_id, currency`).
- Umbrales de seguimiento: `<80%` (verde), `80-99%` (amarillo), `>=100%` (rojo).
- Notificaciones automáticas locales al alcanzar o superar el 80% y 100% del presupuesto.

### 5. Automatic Expenses & Incomes (`recurring_expenses` & `user_settings`)

- Each item has:
  - `type`: `"expense" | "income"`
  - `categoryId`: Category of income (`cat-salary`, `cat-pension`, `cat-grant`, `cat-contribution`, etc.) or expense (`cat-services`, `cat-housing`, etc.)
  - `isVariable`:
    - `false` (**Monto Fijo**): Automatically applied on `due_date <= today` via `POST /recurring-expenses/process-due`, creating the transaction and advancing `due_date` to the next cycle (`computeNextDueDate`).
    - `true` (**Monto Variable**): On `due_date`, once the user's personal `reminder_time` (`user_settings.reminder_time`, e.g. `"09:00"` or `"21:00"`) is reached, prompts the user to confirm if the price stayed the same or changed, with an option to update the base amount for future cycles (`updateBaseAmount`).

### 6. Mobile Notifications (`src/lib/notifications.ts`)

- Schedules local notifications via `expo-notifications` whenever accounts, recurring items or `reminderTime` change:
  - **1 day before credit card closing (`closingDay`)** at `reminderTime`: closing statement reminder with accumulated balance. Tapping opens the card screen.
  - **1 day before credit card due date (`dueDay`)** at `reminderTime`: payment due date reminder with balance to pay. Tapping opens the card screen.
  - **1 day before `dueDate`** at `reminderTime`: upcoming income/expense reminder.
  - **On `dueDate`** at `reminderTime`: variable price prompt notification (opens the confirmation modal on tap) or fixed auto-apply notification.
  - **Immediate notification** when fixed items are auto-applied.

### 7. Shared Accounts & Goals (`shared_members` & `share_invites`)

- Owners can generate a 24-hour invite code (`UNPO-XXXX`) via `POST /share/invite` for any `account` or `goal`.
- Other authenticated users can join via `POST /share/join`, which records both the `owner` and `editor` in `shared_members`.
- Every transaction/contribution/withdrawal stores `author_name` (extracted from the verified Firebase JWT) and updates shared balances via D1 triggers (`user_id = NEW.user_id OR EXISTS (SELECT 1 FROM shared_members ...)`).

### 8. Offline Resilience & Backups (`src/services/backup.service.ts`)

- **Offline Detection**: `<OfflineBanner />` component monitoring `expo-network` with Web `navigator.onLine` fallback.
- **Exportación JSON / CSV**: Volcado completo de datos a JSON y exportación de transacciones en CSV compatible con Excel (UTF-8 BOM).
- **Importación JSON**: Selector nativo de archivos con `expo-document-picker` y `File` de SDK 58, validación de integridad y recarga de caché.

### 9. Security Architecture (`worker/src/index.ts` & `schema.sql`)

- **Authentication**: Every Worker request requires a valid Firebase ID Token (`Bearer <jwt>`) verified against Google's RS256 public keys.
- **Row-Level Security (RLS)**:
  - Every SQL query filters by `user_id = ?` (or membership in `shared_members` for shared accounts/goals).
  - Cross-entity operations (`transactions`, `goals/:id/contribute`, `goals/:id/withdraw`, `recurring-expenses`, `installments`, `budgets`) verify account/goal ownership or shared membership via `verifyAccountOwnership` and `verifyGoalOwnership`.
  - All SQLite triggers in `schema.sql` enforce `user_id = NEW.user_id` / `OLD.user_id` or `EXISTS (SELECT 1 FROM shared_members ...)`.
- **Input Sanitization & Rate Limiting**:
  - Use `sanitizeText`, `sanitizeIdentifier`, `sanitizeColor`, `sanitizeIcon`, `sanitizeAmount`, `sanitizeTime`, and `parseSafeJsonBody` (16 KB limit).
  - Two-tier rate limiting: 90 req/min per IP pre-auth; 120 reads/min and 30 writes/min per `userId`.

---

## Database Schema (Cloudflare D1)

Full schema is in [`schema.sql`](./schema.sql). Summary:

| Table | Key columns |
| --- | --- |
| `accounts` | `id, user_id, name, type, currency, balance, balance_cents, color, icon, credit_limit, credit_limit_cents, closing_day, due_day` |
| `categories` | `id, name, icon, color, type (income\|expense\|transfer), is_default` |
| `transactions` | `id, user_id, author_name, account_id, category_id, type, amount, amount_cents, installment_id, installment_number, installments_total, currency, description, note, date, to_account_id, goal_id` |
| `savings_goals` | `id, user_id, name, target_amount, target_amount_cents, current_amount, current_amount_cents, currency, deadline, icon, color, status` |
| `recurring_expenses` | `id, user_id, type (expense\|income), account_id, category_id, name, amount, amount_cents, currency, due_date, due_day, frequency, is_variable, icon, color, is_active, last_paid_date` |
| `credit_card_installments` | `id, user_id, account_id, transaction_id, description, total_amount_cents, cash_price_cents, installments_count, installment_amount_cents, first_due_date, status, created_at` |
| `credit_card_statements` | `id, user_id, account_id, period_start, closing_date, due_date, previous_balance_cents, charges_cents, installments_cents, interest_cents, total_due_cents, minimum_due_cents, paid_amount_cents, status, created_at` |
| `budgets` | `id, user_id, category_id, currency, amount_cents, created_at, updated_at` |
| `user_settings` | `user_id (PK), reminder_time, theme (light\|dark, default light), updated_at` |
| `shared_members` | `id, resource_type (account\|goal), resource_id, owner_id, user_id, display_name, role (owner\|editor)` |
| `share_invites` | `code (PK, UNPO-XXXX), resource_type (account\|goal), resource_id, owner_id, owner_name, expires_at` |

### Extending the Schema

1. Add the new table or column to `schema.sql`.
2. Add the corresponding TypeScript type to `src/types/index.ts`.
3. Follow the full End-to-End pattern (Mock DB → Mock Handlers → Service → Hook → Screen).
4. Apply the migration to remote D1:

   ```bash
   npx wrangler d1 execute finanzas-db --remote --file=./schema.sql --config worker/wrangler.toml
   ```

   *(Note: If adding a column to an existing remote table, also execute `ALTER TABLE ... ADD COLUMN ...` via `npx wrangler d1 execute finanzas-db --remote --command="..." --config worker/wrangler.toml`).*

---

## Styling with NativeWind

Use **Tailwind class names** via the `className` prop on any React Native component. The design system tokens are defined in [`tailwind.config.js`](./tailwind.config.js).

### Color Palette

Values below are the **light** theme; the **dark** equivalents live in [`src/theme/palettes.js`](./src/theme/palettes.js) (see *Theming* below).

| Token | Hex | Use |
| --- | --- | --- |
| `bg-surface-900` | `#faf7f5` | Main background (warm ivory/cream) |
| `bg-surface-800` | `#ffffff` | Cards (default `<Card>` bg, pure white) |
| `bg-surface-700` | `#f2ece6` | Inputs, chips, secondary surfaces |
| `bg-surface-600` | `#e6ded6` | Dividers, progress bg, subtle borders |
| `bg-primary-600` | `#c8102e` | Primary actions (Pantone Red / Bermellón) |
| `primary-500` | `#e23d28` | Active tab, indicators (Bermellón Pantone) |
| `text-success-500` | `#17b26a` | Income, positive balance |
| `text-danger-500` | `#f04438` | Expenses, errors |
| `text-warning-500` | `#f79009` | Warnings, variable prompts |
| `text-text-primary` | `#1c1917` | Main text (warm stone black) |
| `text-text-secondary` | `#68615e` | Secondary text (warm stone gray) |
| `text-text-muted` | `#9c928d` | Placeholder, disabled |

### Theming (Light / Dark mode, per user)

- The user's choice lives in **`user_settings.theme`** (`"light"` default | `"dark"`), read/written through `GET/PUT /user-settings` (`reminderTime` and `theme` are both optional on PUT; at least one is required). The Worker adds the column automatically (`ALTER TABLE ... ADD COLUMN theme` inside `ensureSharedSchema`).
- **Colors are never hard-coded per theme in screens.** `src/theme/palettes.js` defines `lightColors` / `darkColors`; `tailwind.config.js` maps `primary / success / danger / warning / surface / text-*` to CSS variables (`rgb(var(--color-surface-900) / <alpha-value>)`), so `bg-surface-900`, `text-text-primary`, `bg-primary-600/15`… switch automatically. **Do not** use `dark:` variants for these tokens. To add or tweak a color, edit `palettes.js` only (both themes).
- For **JS color values** (icon `color`, `ActivityIndicator`, `headerStyle`, SVG fills, `Switch`) use `const { colors, isDark } = useAppTheme();` — **never** `import { colors } from "tailwind.config"` in components (that is always the light palette). `accountColors` / brand accents are theme-independent and may still be imported.
- Dark tokens flip the tints (`*-50/100/200/300`) and text shades (`primary-700/800/900`, `success-600`, `danger-600`…) for contrast; avoid `active:bg-*-700` pressed states (use `active:opacity-80`).
- Switching: `useSetTheme().setTheme("dark" | "light")` (optimistic, rolls back on error) or the `<ThemeToggle />` component. `<ThemeSync>` applies the stored theme after login; `useThemeStore` caches the last mode in AsyncStorage.
- Text on colored backgrounds (`text-white` over `bg-primary-600`) is fine in both themes.

### Typography & Card Gotchas

- Always use `<Typography>` — never raw `<Text>` in screens.
- `<Card>` extends `ViewProps` (it does **not** have an `onPress` prop). Wrap clickable cards in `<Pressable onPress={...}><Card>...</Card></Pressable>`.

---

## Building & Deploying (EAS & OTA)

- **`version` vs `runtimeVersion` in `app.json`**:
  - `expo.version` (e.g. `"1.3.0"`): User-facing version displayed in the Dashboard info modal. Bump this for OTA updates.
  - `expo.runtimeVersion` (e.g. `"1.1.0"`): Native binary compatibility version. **Only** change this when building a new APK after adding/modifying native modules; OTA updates only deliver to APKs with a matching `runtimeVersion`.

```bash
# Publish OTA update to existing APKs (also runs automatically on git push to main via .eas/workflows/update.yml)
npx eas-cli update --channel production --message "feat: ..."

# Build a new production APK (required when adding native modules like expo-notifications)
npx eas-cli build -p android --profile production
```
