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
npx expo lint                # lint
npx tsc --noEmit             # typecheck
npx expo-doctor              # diagnose dependency/config issues
npx expo install --fix       # fix incompatible package versions
npm run worker:deploy        # deploy Cloudflare Worker backend
npm run d1:init              # apply schema.sql to remote Cloudflare D1
```

> **Always run `npx tsc --noEmit` and `npx eslint` / `npx expo lint` before declaring a task done.**

---

## Tech Stack

| Layer | Library | Notes |
| --- | --- | --- |
| Runtime | Expo SDK 58 + React Native 0.88 (iOS, Android, Web) | |
| Routing | **Expo Router v4** (file-based) | Routes in `app/` |
| Styling | **NativeWind v4** (Tailwind CSS) | Config in `tailwind.config.js` |
| Language | TypeScript (strict) | Path alias `@/` → `src/` |
| Auth | **Firebase Authentication v13** | Email/Password + Google; verified via RS256 JWT in Worker |
| Notifications | **expo-notifications** | Local scheduled notifications + Android channels (`src/lib/notifications.ts`) |
| OTA Updates | **expo-updates** + EAS Workflows | Channel `production` linked to branch `production` (`runtimeVersion: "1.0.0"`) |
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
│   ├── _layout.tsx               ← Root layout: Auth guard, OTA banner, RecurringAutoProcessor, Stack
│   ├── login.tsx                 ← Firebase Login / Registration screen
│   ├── (tabs)/
│   │   ├── _layout.tsx           ← Tab bar (4 tabs)
│   │   ├── index.tsx             ← Dashboard / Home + System Info & OTA Check Modal
│   │   ├── accounts.tsx          ← Accounts list + net worth summary + "Unirse con código"
│   │   ├── goals.tsx             ← Savings goals list + "Unirse con código"
│   │   └── reports.tsx           ← Monthly, Annual & Future Projection (Proyección) reports
│   ├── accounts/[id].tsx         ← Account detail + recent transactions + Share account modal
│   ├── accounts/new.tsx          ← New account modal (presentation: "modal")
│   ├── goals/[id].tsx            ← Goal detail + progress + per-member breakdown + Share goal modal
│   ├── goals/new.tsx             ← New goal modal (presentation: "modal")
│   ├── transaction/new.tsx       ← New transaction modal (presentation: "modal")
│   └── recurring/index.tsx       ← Automatic Expenses & Incomes management + User reminder hour
│
├── worker/
│   ├── wrangler.toml             ← Cloudflare Worker & D1 binding config
│   └── src/index.ts              ← Serverless REST API: RS256 Auth, RLS, Rate Limiting, Anti-XSS
│
└── src/                          ← All non-route code lives here
    ├── types/index.ts            ← Domain types (Account, Transaction, SavingsGoal, RecurringExpense, UserSettings, SystemStats, etc.)
    ├── lib/
    │   ├── api.ts                ← Thin fetch wrapper (attaches Firebase ID Token Bearer header)
    │   ├── firebase.ts           ← Firebase Auth initialization & persistence
    │   ├── notifications.ts      ← Mobile notifications scheduler & Android channel setup
    │   └── mock/
    │       ├── db.ts             ← In-memory seed data
    │       └── handlers.ts       ← Mock implementations of every API endpoint
    ├── services/                 ← Data access layer (calls api.ts OR mock handlers)
    │   ├── accounts.service.ts   ← Also contains shareService (/share/invite, /share/join, /share/leave)
    │   ├── categories.service.ts
    │   ├── transactions.service.ts
    │   ├── goals.service.ts      ← Also contains reportsService & statsService
    │   └── recurring.service.ts  ← Recurring expenses/incomes + user_settings + process-due
    ├── hooks/                    ← TanStack Query hooks (queries + mutations)
    │   ├── useAccounts.ts        ← Also contains useCreateShareInvite, useJoinSharedResource, useLeaveSharedResource
    │   ├── useCategories.ts
    │   ├── useTransactions.ts
    │   ├── useGoals.ts           ← Also contains useMonthlyReport, useAnnualReport & useSystemStats
    │   └── useRecurringExpenses.ts ← Hooks for recurring items, user settings & auto-processing
    ├── store/                    ← Zustand stores (UI-only state)
    │   └── reports.store.ts
    ├── components/
    │   ├── ui/                   ← Design system primitives
    │   │   ├── Typography.tsx    ← variant prop: h1/h2/h3/body/caption/label
    │   │   ├── Button.tsx        ← variant: primary/secondary/ghost/danger
    │   │   ├── Card.tsx          ← Surface with rounded corners (extends ViewProps)
    │   │   ├── PieChart.tsx      ← Interactive SVG donut/pie chart
    │   │   └── index.ts          ← Barrel export
    │   ├── accounts/AccountCard.tsx
    │   ├── goals/GoalCard.tsx
    │   ├── shared/ShareModals.tsx ← JoinWithCodeModal & ShareResourceModal (UNPO-XXXX invites)
    │   └── recurring/RecurringAutoProcessor.tsx ← Background/foreground processor + variable price prompt modal
    └── utils/
        └── formatters.ts         ← formatCurrency, formatDate, formatRelativeDate
```

---

## Core Business Logic Rules

### 1. Net Worth (`Patrimonio`) & Available Balance (`Disponible`)

- **Negative balances subtract**: Non-credit accounts with a negative balance (`balance < 0`) add to `totalNegativeAccountsDebt` and **subtract** from both `Disponible` and `Patrimonio`.
- **Credit card debt subtracts**: Credit accounts (`type === "credit"`) with `balance < 0` represent debt (`totalCreditDebt`) and subtract from `Patrimonio`.
- **Active savings goals add**: `totalSavedInGoals` (sum of `currentAmount` across active goals) is included in both `Disponible` (`totalCash + totalSavedInGoals - totalNegativeAccountsDebt`) and `Patrimonio` (`totalCash + totalSavedInGoals - totalCreditDebt - totalNegativeAccountsDebt`).

### 2. Automatic Expenses & Incomes (`recurring_expenses` & `user_settings`)

- Each item has:
  - `type`: `"expense" | "income"`
  - `categoryId`: Category of income (`cat-salary`, `cat-pension`, `cat-grant`, `cat-contribution`, etc.) or expense (`cat-services`, `cat-housing`, etc.)
  - `isVariable`:
    - `false` (**Monto Fijo**): Automatically applied on `due_date <= today` via `POST /recurring-expenses/process-due`, creating the transaction and advancing `due_date` to the next cycle (`computeNextDueDate`).
    - `true` (**Monto Variable**): On `due_date`, once the user's personal `reminder_time` (`user_settings.reminder_time`, e.g. `"09:00"` or `"21:00"`) is reached, prompts the user to confirm if the price stayed the same or changed, with an option to update the base amount for future cycles (`updateBaseAmount`).

### 3. Mobile Notifications (`src/lib/notifications.ts`)

- Schedules local notifications via `expo-notifications` whenever recurring items or `reminderTime` change:
  - **1 day before `dueDate`** at `reminderTime`: upcoming income/expense reminder.
  - **On `dueDate`** at `reminderTime`: variable price prompt notification (opens the confirmation modal on tap) or fixed auto-apply notification.
  - **Immediate notification** when fixed items are auto-applied.

### 4. Shared Accounts & Goals (`shared_members` & `share_invites`)

- Owners can generate a 24-hour invite code (`UNPO-XXXX`) via `POST /share/invite` for any `account` or `goal`.
- Other authenticated users can join via `POST /share/join`, which records both the `owner` and `editor` in `shared_members`.
- Every transaction/contribution/withdrawal stores `author_name` (extracted from the verified Firebase JWT) and updates shared balances via D1 triggers (`user_id = NEW.user_id OR EXISTS (SELECT 1 FROM shared_members ...)`).

### 5. Security Architecture (`worker/src/index.ts` & `schema.sql`)

- **Authentication**: Every Worker request requires a valid Firebase ID Token (`Bearer <jwt>`) verified against Google's RS256 public keys.
- **Row-Level Security (RLS)**:
  - Every SQL query filters by `user_id = ?` (or membership in `shared_members` for shared accounts/goals).
  - Cross-entity operations (`transactions`, `goals/:id/contribute`, `goals/:id/withdraw`, `recurring-expenses`) verify account/goal ownership or shared membership via `verifyAccountOwnership` and `verifyGoalOwnership`.
  - All SQLite triggers in `schema.sql` enforce `user_id = NEW.user_id` / `OLD.user_id` or `EXISTS (SELECT 1 FROM shared_members ...)`.
- **Input Sanitization & Rate Limiting**:
  - Use `sanitizeText`, `sanitizeIdentifier`, `sanitizeColor`, `sanitizeIcon`, `sanitizeAmount`, `sanitizeTime`, and `parseSafeJsonBody` (16 KB limit).
  - Two-tier rate limiting: 90 req/min per IP pre-auth; 120 reads/min and 30 writes/min per `userId`.

---

## Database Schema (Cloudflare D1)

Full schema is in [`schema.sql`](./schema.sql). Summary:

| Table | Key columns |
| --- | --- |
| `accounts` | `id, user_id, name, type, currency, balance, color, icon, credit_limit, closing_day, due_day` |
| `categories` | `id, name, icon, color, type (income\|expense\|transfer), is_default` |
| `transactions` | `id, user_id, author_name, account_id, category_id, type, amount, currency, description, note, date, to_account_id, goal_id` |
| `savings_goals` | `id, user_id, name, target_amount, current_amount, currency, deadline, icon, color, status` |
| `recurring_expenses` | `id, user_id, type (expense\|income), account_id, category_id, name, amount, currency, due_date, due_day, frequency, is_variable, icon, color, is_active, last_paid_date` |
| `user_settings` | `user_id (PK), reminder_time, updated_at` |
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

### Typography & Card Gotchas

- Always use `<Typography>` — never raw `<Text>` in screens.
- `<Card>` extends `ViewProps` (it does **not** have an `onPress` prop). Wrap clickable cards in `<Pressable onPress={...}><Card>...</Card></Pressable>`.

---

## Building & Deploying (EAS & OTA)

- **`version` vs `runtimeVersion` in `app.json`**:
  - `expo.version` (e.g. `"1.0.5"`): User-facing version displayed in the Dashboard info modal. Bump this for OTA updates.
  - `expo.runtimeVersion` (e.g. `"1.0.0"`): Native binary compatibility version. **Only** change this when building a new APK after adding/modifying native modules; OTA updates only deliver to APKs with a matching `runtimeVersion`.

```bash
# Publish OTA update to existing APKs (also runs automatically on git push to main via .eas/workflows/update.yml)
npx eas-cli update --channel production --message "feat: ..."

# Build a new production APK (required when adding native modules like expo-notifications)
npx eas-cli build -p android --profile production
```
