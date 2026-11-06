# Finanzas Dashboard — Agent Guide

This is a **personal finance mobile app** built with Expo / React Native. It is for a single user (no multi-tenancy). Prioritize mobile-first patterns, performance, and cross-platform compatibility (iOS & Android).

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
```

> **Always run `npx tsc --noEmit` and `npx expo lint` before declaring a task done.**

---

## Tech Stack

| Layer | Library | Notes |
| --- | --- | --- |
| Runtime | Expo SDK 58 + React Native 0.88 (iOS, Android, Web) | |
| Routing | **Expo Router v4** (file-based) | Routes in `app/` |
| Styling | **NativeWind v4** (Tailwind CSS) | Config in `tailwind.config.js` |
| Language | TypeScript (strict) | Path alias `@/` → `src/` |
| Server state | **TanStack Query v5** | All API calls go through hooks |
| Client state | **Zustand v5** | UI-only state (no server data) |
| Backend | **Cloudflare D1** (SQLite) via Worker | REST API over fetch |
| Fonts | `@expo-google-fonts/inter` | Inter 400/500/600/700 |
| Icons | `@expo/vector-icons` → `MaterialCommunityIcons` | |

---

## Project Structure

```text
finanzas_dashboard/
│
├── app/                          ← Expo Router file-based routes
│   ├── _layout.tsx               ← Root layout: QueryClient, fonts, SplashScreen
│   ├── (tabs)/
│   │   ├── _layout.tsx           ← Tab bar (4 tabs, dark themed)
│   │   ├── index.tsx             ← Dashboard / Home
│   │   ├── accounts.tsx          ← Accounts list
│   │   ├── goals.tsx             ← Savings goals list
│   │   └── reports.tsx           ← Monthly reports
│   ├── accounts/[id].tsx         ← Account detail + recent transactions
│   ├── accounts/new.tsx          ← New account modal (presentation: "modal")
│   ├── goals/[id].tsx            ← Goal detail + progress
│   ├── goals/new.tsx             ← New goal modal (presentation: "modal")
│   └── transaction/new.tsx       ← New transaction modal (presentation: "modal")
│
└── src/                          ← All non-route code lives here
    ├── types/index.ts            ← Domain types (Account, Transaction, Goal, etc.)
    ├── lib/
    │   ├── api.ts                ← Thin fetch wrapper for the Cloudflare Worker
    │   └── mock/
    │       ├── db.ts             ← In-memory seed data (accounts, transactions, goals)
    │       └── handlers.ts       ← Mock implementations of every API endpoint
    ├── services/                 ← Data access layer (calls api.ts OR mock handlers)
    │   ├── accounts.service.ts
    │   ├── categories.service.ts
    │   ├── transactions.service.ts
    │   └── goals.service.ts      ← Also contains reportsService
    ├── hooks/                    ← TanStack Query hooks (queries + mutations)
    │   ├── useAccounts.ts
    │   ├── useCategories.ts
    │   ├── useTransactions.ts
    │   └── useGoals.ts           ← Also contains useMonthlyReport & useAnnualReport
    ├── store/                    ← Zustand stores (UI-only state)
    │   └── reports.store.ts
    ├── components/
    │   ├── ui/                   ← Design system primitives
    │   │   ├── Typography.tsx    ← variant prop: h1/h2/h3/body/caption/label
    │   │   ├── Button.tsx        ← variant: primary/secondary/ghost/danger
    │   │   ├── Card.tsx          ← Surface with rounded corners
    │   │   ├── PieChart.tsx      ← Interactive SVG donut/pie chart
    │   │   └── index.ts          ← Barrel export
    │   ├── accounts/AccountCard.tsx
    │   └── goals/GoalCard.tsx
    └── utils/
        └── formatters.ts         ← formatCurrency, formatDate, formatRelativeDate
```

---

## Navigation & Routing

- **All routes live in `app/`**. Every `.tsx` file is a screen. `_layout.tsx` files define navigators.
- **Non-route code** (components, hooks, stores, utils) lives in `src/` — never in `app/`.
- Import navigation primitives **only** from `expo-router`:

```ts
import { router, Link, useLocalSearchParams } from "expo-router";

// Navigate programmatically
router.push("/accounts/acc-123");
router.back();

// Read route params
const { id } = useLocalSearchParams<{ id: string }>();
```

### Adding a New Screen

1. Create the file in `app/` at the desired path.
2. If it needs a header, add a `<Stack.Screen>` entry in `app/_layout.tsx`.
3. For modals, set `presentation: "modal"` in the Stack.Screen options.

```ts
// app/goals/new.tsx  ← new screen
export default function NewGoalScreen() { ... }

// app/_layout.tsx  ← register it
<Stack.Screen
  name="goals/new"
  options={{ presentation: "modal", headerTitle: "Nueva meta" }}
/>
```

---

## Data Flow Pattern

```text
Screen/Component
    ↓
  Hook (src/hooks/)          ← TanStack Query: useQuery / useMutation
    ↓
  Service (src/services/)    ← Decides: mock OR real API
    ↓
  ┌──────────────────────────────────┐
  │ EXPO_PUBLIC_USE_MOCK === "true"  │
  │   → mock/handlers.ts (in-memory) │
  │ else                             │
  │   → lib/api.ts → fetch → Worker  │
  └──────────────────────────────────┘
```

### Mock vs Real API

Controlled by `.env`:

```bash
EXPO_PUBLIC_USE_MOCK=true    # no backend needed, uses in-memory data
EXPO_PUBLIC_USE_MOCK=false   # connects to Cloudflare Worker
EXPO_PUBLIC_API_URL=https://your-worker.workers.dev
EXPO_PUBLIC_API_TOKEN=       # Bearer token (optional)
```

The mock data lives in [`src/lib/mock/db.ts`](./src/lib/mock/db.ts) — edit it to change seed data. The mock handlers in [`src/lib/mock/handlers.ts`](./src/lib/mock/handlers.ts) simulate network latency (~120ms) and mutate the in-memory state (e.g. creating a transaction updates the account balance).

---

## Adding a New Feature (End-to-End Pattern)

### 1. Add the domain type (`src/types/index.ts`)

```ts
export interface MyEntity {
  id: string;
  name: string;
  createdAt: string;
  updatedAt: string;
}
```

### 2. Add mock data (`src/lib/mock/db.ts`)

```ts
export const mockMyEntities: MyEntity[] = [
  { id: "e-1", name: "Example", createdAt: "...", updatedAt: "..." },
];
```

### 3. Add mock handlers (`src/lib/mock/handlers.ts`)

```ts
export const mockMyEntityHandlers = {
  async list(): Promise<PaginatedResponse<MyEntity>> {
    await delay();
    return paginate([...mockMyEntities]);
  },
  // ...
};
```

### 4. Add the service (`src/services/myentity.service.ts`)

```ts
const USE_MOCK = process.env.EXPO_PUBLIC_USE_MOCK === "true";

export const myEntityService = {
  list: () =>
    USE_MOCK
      ? mockMyEntityHandlers.list()
      : api.get<PaginatedResponse<MyEntity>>("/my-entities"),
};
```

### 5. Add the hook (`src/hooks/useMyEntity.ts`)

```ts
export const myEntityKeys = {
  all:   () => ["myEntities"] as const,
  lists: () => [...myEntityKeys.all(), "list"] as const,
};

export function useMyEntities() {
  return useQuery({
    queryKey: myEntityKeys.lists(),
    queryFn:  () => myEntityService.list(),
    staleTime: 1000 * 60 * 2,
  });
}
```

### 6. Create the screen (`app/my-entities/index.tsx`) and register in `app/_layout.tsx`

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
| `text-warning-500` | `#f79009` | Warnings, pending |
| `text-text-primary` | `#1c1917` | Main text (warm stone black) |
| `text-text-secondary` | `#68615e` | Secondary text (warm stone gray) |
| `text-text-muted` | `#9c928d` | Placeholder, disabled |

### Typography

Always use the `<Typography>` component — never raw `<Text>` in screens:

```tsx
<Typography variant="h1">Título</Typography>
<Typography variant="body" muted>Texto secundario</Typography>
<Typography variant="caption">Pequeño</Typography>
```

### Font family

| Class | Font | Weight |
| --- | --- | --- |
| `font-sans` | Inter Regular | 400 |
| `font-medium` | Inter Medium | 500 |
| `font-semibold` | Inter SemiBold | 600 |
| `font-bold` | Inter Bold | 700 |

### Layout conventions

```tsx
// Screen root: always SafeAreaView with bg-surface-900
<SafeAreaView className="flex-1 bg-surface-900">
  <ScrollView contentContainerClassName="px-4 pb-8">
    ...
  </ScrollView>
</SafeAreaView>

// Section spacing: gap-3 or gap-4 between cards
// Screen horizontal padding: px-4
// Header padding: pt-6 pb-4
```

---

## Database Schema (Cloudflare D1)

Full schema is in [`schema.sql`](./schema.sql). Summary:

| Table | Key columns |
| --- | --- |
| `accounts` | `id, name, type, currency, balance, color, icon` |
| `categories` | `id, name, icon, color, type (income\|expense\|transfer), is_default` |
| `transactions` | `id, account_id, category_id, type, amount, currency, description, date, to_account_id` |
| `savings_goals` | `id, name, target_amount, current_amount, currency, deadline, status` |

A **trigger** on `transactions` automatically updates `accounts.balance` after each insert.

### Extending the Schema

1. Add the new table to `schema.sql`.
2. Add the corresponding TypeScript type to `src/types/index.ts`.
3. Follow the full pattern described in "Adding a New Feature" above.
4. Apply the migration: `wrangler d1 execute finanzas-db --file=./schema.sql`

---

## Known Gotchas

- **Path aliases**: `@/` resolves to `src/`. Configured in both `tsconfig.json` (`paths`) and `babel.config.js` (`module-resolver` plugin).
- **CSS import**: `import "../global.css"` in `app/_layout.tsx` is a NativeWind requirement. The type declaration for `.css` files is in `nativewind-env.d.ts`.
- **`color as string`**: `tabBarIcon`'s `color` param from Expo Router/React Navigation is typed as `ColorValue` (which can be `null`). Always cast: `color={color as string}` when passing to icon components.
- **`expo-router/entry`**: The `main` field in `package.json` must be `"expo-router/entry"`, not a local file.
- **No `ios/` or `android/` dirs**: This project uses Continuous Native Generation. Never create them by hand — configure native behavior via `app.json` and config plugins.
- **`npx expo install`**: Always use this for new packages, never `npm install` directly. It resolves SDK-compatible versions.

---

## Building & Deploying

```bash
# Local dev (mock mode)
npx expo start --clear

# Development build (after adding native modules)
eas build --profile development

# Production build
eas build --profile production

# OTA update
eas update --branch production --message "fix: ..."
```

Docs: [EAS Documentation](https://docs.expo.dev/eas/index.md)
