/**
 * Cloudflare Worker — REST API Multi-Usuario para Finanzas Dashboard
 * Autenticación vía Firebase ID Token (RS256) + Cloudflare D1
 * Con protección XSS, Rate Limiting y Row-Level Security (RLS)
 */

type D1DatabaseType = any;

export interface Env {
  DB: D1DatabaseType;
  FIREBASE_PROJECT_ID?: string;
}

// ─── Cabeceras de Seguridad HTTP y CORS ──────────────────────────────────────
const SECURITY_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PATCH, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
  "X-Content-Type-Options": "nosniff",
  "X-Frame-Options": "DENY",
  "Content-Security-Policy": "default-src 'none'; frame-ancestors 'none'",
  "Referrer-Policy": "no-referrer",
  "Strict-Transport-Security": "max-age=31536000; includeSubDomains",
};

function json(
  data: unknown,
  status = 200,
  extraHeaders: Record<string, string> = {},
) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      ...SECURITY_HEADERS,
      ...extraHeaders,
    },
  });
}

function error(
  message: string,
  status = 400,
  extraHeaders: Record<string, string> = {},
) {
  return json({ success: false, error: message }, status, extraHeaders);
}

function success<T>(data: T, status = 200) {
  return json({ success: true, data }, status);
}

// ─── Rate Limiting (Ventana Fija en Memoria por Isolate) ─────────────────────
interface RateBucket {
  count: number;
  resetAt: number;
}

const rateLimitStore = new Map<string, RateBucket>();
const RATE_WINDOW_MS = 60_000; // 1 minuto
const IP_LIMIT_PER_MIN = 90; // Máx 90 peticiones/min por IP (pre-autenticación)
const USER_READ_LIMIT_PER_MIN = 120; // Máx 120 lecturas/min por usuario
const USER_WRITE_LIMIT_PER_MIN = 30; // Máx 30 escrituras/min por usuario

function checkRateLimit(
  key: string,
  maxRequests: number,
): { allowed: boolean; remaining: number; retryAfterSec: number } {
  const now = Date.now();

  // Limpieza preventiva para evitar crecimiento de memoria
  if (rateLimitStore.size > 2000) {
    for (const [k, v] of rateLimitStore.entries()) {
      if (v.resetAt <= now) rateLimitStore.delete(k);
    }
  }

  const current = rateLimitStore.get(key);
  if (!current || current.resetAt <= now) {
    rateLimitStore.set(key, { count: 1, resetAt: now + RATE_WINDOW_MS });
    return {
      allowed: true,
      remaining: maxRequests - 1,
      retryAfterSec: 0,
    };
  }

  current.count += 1;
  if (current.count > maxRequests) {
    const retryAfterSec = Math.max(
      1,
      Math.ceil((current.resetAt - now) / 1000),
    );
    return { allowed: false, remaining: 0, retryAfterSec };
  }

  return {
    allowed: true,
    remaining: maxRequests - current.count,
    retryAfterSec: 0,
  };
}

// ─── Sanitización Anti-XSS y Validación de Entradas ──────────────────────────
/**
 * Elimina etiquetas HTML/SVG/Script, protocolos peligrosos (javascript:, data:, vbscript:)
 * y caracteres de control ASCII, limitando la longitud máxima.
 */
function sanitizeText(input: unknown, maxLength = 120): string {
  if (typeof input !== "string") return "";
  return input
    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, "")
    .replace(/<\/?[a-z][^>]*>/gi, "")
    .replace(/(?:javascript|data|vbscript)\s*:/gi, "")
    .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, "")
    .trim()
    .slice(0, maxLength);
}

function sanitizeIdentifier(input: unknown, maxLength = 64): string {
  if (typeof input !== "string") return "";
  return input.replace(/[^a-zA-Z0-9_-]/g, "").slice(0, maxLength);
}

function sanitizeColor(input: unknown, fallback = "#e23d28"): string {
  if (typeof input !== "string") return fallback;
  const trimmed = input.trim();
  return /^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/.test(trimmed)
    ? trimmed.toLowerCase()
    : fallback;
}

function sanitizeIcon(input: unknown, fallback = "wallet"): string {
  if (typeof input !== "string") return fallback;
  const trimmed = input.trim().toLowerCase();
  return /^[a-z0-9-]{1,40}$/.test(trimmed) ? trimmed : fallback;
}

function sanitizeCurrency(input: unknown): "ARS" | "USD" | "EUR" {
  if (input === "USD" || input === "EUR" || input === "ARS") return input;
  return "ARS";
}

function sanitizeDate(input: unknown): string {
  if (typeof input === "string" && /^\d{4}-\d{2}-\d{2}$/.test(input.trim())) {
    return input.trim();
  }
  return new Date().toISOString().slice(0, 10);
}

function sanitizeAmount(
  input: unknown,
  allowZero = false,
  allowNegative = false,
): number | null {
  const num = typeof input === "number" ? input : Number(input);
  if (!Number.isFinite(num)) return null;
  if (Math.abs(num) > 1_000_000_000_000) return null; // Límite anti-desbordamiento (1 billón)
  if (!allowNegative && num < 0) return null;
  if (!allowZero && num === 0) return null;
  return Math.round(num * 100) / 100;
}

async function parseSafeJsonBody(
  request: Request,
  maxBytes = 16_384,
): Promise<{ ok: true; data: any } | { ok: false; response: Response }> {
  const contentLength = Number(request.headers.get("Content-Length") || "0");
  if (contentLength > maxBytes) {
    return {
      ok: false,
      response: error("El cuerpo de la petición excede el tamaño máximo permitido (16 KB)", 413),
    };
  }
  try {
    const raw = await request.text();
    if (raw.length > maxBytes) {
      return {
        ok: false,
        response: error("El cuerpo de la petición excede el tamaño máximo permitido (16 KB)", 413),
      };
    }
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
      return {
        ok: false,
        response: error("Formato JSON inválido: se esperaba un objeto", 400),
      };
    }
    return { ok: true, data: parsed };
  } catch {
    return {
      ok: false,
      response: error("JSON malformado en el cuerpo de la petición", 400),
    };
  }
}

// ─── Row-Level Security (RLS) — Verificación de Propiedad Cruzada ────────────
async function verifyAccountOwnership(
  db: D1DatabaseType,
  accountId: string,
  userId: string,
): Promise<boolean> {
  if (!accountId) return false;
  const row = await db
    .prepare(
      `SELECT a.id FROM accounts a
       WHERE a.id = ?
         AND (
           a.user_id = ?
           OR EXISTS (
             SELECT 1 FROM shared_members sm
             WHERE sm.resource_type = 'account' AND sm.resource_id = a.id AND sm.user_id = ?
           )
         )
       LIMIT 1`,
    )
    .bind(accountId, userId, userId)
    .first();
  return Boolean(row);
}

async function verifyGoalOwnership(
  db: D1DatabaseType,
  goalId: string,
  userId: string,
): Promise<boolean> {
  if (!goalId) return false;
  const row = await db
    .prepare(
      `SELECT g.id FROM savings_goals g
       WHERE g.id = ?
         AND (
           g.user_id = ?
           OR EXISTS (
             SELECT 1 FROM shared_members sm
             WHERE sm.resource_type = 'goal' AND sm.resource_id = g.id AND sm.user_id = ?
           )
         )
       LIMIT 1`,
    )
    .bind(goalId, userId, userId)
    .first();
  return Boolean(row);
}

// ─── Verificación de Firebase ID Token (Web Crypto RS256 + Google JWKS) ──────
const GOOGLE_JWKS_URL =
  "https://www.googleapis.com/service_accounts/v1/jwk/securetoken@system.gserviceaccount.com";

let cachedJwks: { keys: any[]; expiresAt: number } | null = null;

function base64UrlToUint8Array(base64Url: string): Uint8Array<ArrayBuffer> {
  const padding = "=".repeat((4 - (base64Url.length % 4)) % 4);
  const base64 = (base64Url + padding).replace(/-/g, "+").replace(/_/g, "/");
  const rawData = atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}

function decodeJwtPart(part: string): any {
  const bytes = base64UrlToUint8Array(part);
  return JSON.parse(new TextDecoder().decode(bytes));
}

async function getGoogleJwks(): Promise<any[]> {
  const now = Date.now();
  if (cachedJwks && cachedJwks.expiresAt > now) {
    return cachedJwks.keys;
  }
  const res = await fetch(GOOGLE_JWKS_URL);
  if (!res.ok) {
    throw new Error("No se pudieron obtener las claves públicas de Google");
  }
  const data: any = await res.json();
  cachedJwks = {
    keys: data.keys || [],
    expiresAt: now + 1000 * 60 * 60, // 1 hora en caché
  };
  return cachedJwks.keys;
}

async function verifyFirebaseIdToken(
  token: string,
  projectId: string,
): Promise<{ userId: string; displayName: string } | null> {
  try {
    const parts = token.split(".");
    if (parts.length !== 3) return null;

    const [headerB64, payloadB64, signatureB64] = parts;
    const header = decodeJwtPart(headerB64);
    const payload = decodeJwtPart(payloadB64);

    if (header.alg !== "RS256" || !header.kid) return null;

    const nowSec = Math.floor(Date.now() / 1000);
    if (!payload.exp || payload.exp < nowSec) return null;
    if (payload.aud !== projectId) return null;
    if (payload.iss !== `https://securetoken.google.com/${projectId}`) {
      return null;
    }
    if (!payload.sub || typeof payload.sub !== "string") return null;

    const keys = await getGoogleJwks();
    const jwk = keys.find((k: any) => k.kid === header.kid);
    if (!jwk) return null;

    const cryptoKey = await crypto.subtle.importKey(
      "jwk",
      jwk,
      { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" },
      false,
      ["verify"],
    );

    const signedData = new TextEncoder().encode(`${headerB64}.${payloadB64}`);
    const signature = base64UrlToUint8Array(signatureB64);

    const isValid = await crypto.subtle.verify(
      "RSASSA-PKCS1-v1_5",
      cryptoKey,
      signature,
      signedData,
    );

    if (!isValid) return null;

    const rawName =
      payload.name ||
      (typeof payload.email === "string"
        ? payload.email.split("@")[0]
        : "Usuario");
    const displayName = sanitizeText(rawName, 50) || "Usuario";

    return { userId: payload.sub, displayName };
  } catch {
    return null;
  }
}

/**
 * Si existen registros previos con user_id = 'legacy' (creados antes de activar multi-usuario),
 * se vinculan automáticamente al primer usuario real de Firebase que inicie sesión.
 */
let legacyAlreadyClaimed = false;
let sharedSchemaInitialized = false;

async function ensureSharedSchema(db: D1DatabaseType): Promise<void> {
  if (sharedSchemaInitialized) return;
  try {
    await db.batch([
      db.prepare(
        `CREATE TABLE IF NOT EXISTS shared_members (
          id            TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
          resource_type TEXT NOT NULL CHECK (resource_type IN ('account', 'goal')),
          resource_id   TEXT NOT NULL,
          owner_id      TEXT NOT NULL,
          user_id       TEXT NOT NULL,
          display_name  TEXT NOT NULL DEFAULT 'Usuario',
          role          TEXT NOT NULL DEFAULT 'editor' CHECK (role IN ('owner', 'editor')),
          created_at    TEXT NOT NULL DEFAULT (datetime('now')),
          UNIQUE(resource_type, resource_id, user_id)
        )`,
      ),
      db.prepare(
        `CREATE INDEX IF NOT EXISTS idx_shared_members_user ON shared_members(user_id, resource_type)`,
      ),
      db.prepare(
        `CREATE INDEX IF NOT EXISTS idx_shared_members_resource ON shared_members(resource_type, resource_id)`,
      ),
      db.prepare(
        `CREATE TABLE IF NOT EXISTS share_invites (
          code          TEXT PRIMARY KEY,
          resource_type TEXT NOT NULL CHECK (resource_type IN ('account', 'goal')),
          resource_id   TEXT NOT NULL,
          owner_id      TEXT NOT NULL,
          owner_name    TEXT NOT NULL DEFAULT 'Propietario',
          expires_at    TEXT NOT NULL,
          created_at    TEXT NOT NULL DEFAULT (datetime('now'))
        )`,
      ),
      db.prepare(
        `CREATE INDEX IF NOT EXISTS idx_share_invites_resource ON share_invites(resource_type, resource_id)`,
      ),
      db.prepare(
        `INSERT OR IGNORE INTO accounts (id, user_id, name, type, currency, balance, color, icon)
         VALUES ('direct-goal', 'system', 'Ingreso directo a meta', 'savings', 'ARS', 0, '#17b26a', 'piggy-bank')`,
      ),
    ]);

    try {
      await db
        .prepare("ALTER TABLE transactions ADD COLUMN author_name TEXT")
        .run();
    } catch {
      // Columna ya existe
    }

    try {
      await db
        .prepare(
          "ALTER TABLE user_settings ADD COLUMN theme TEXT NOT NULL DEFAULT 'light'",
        )
        .run();
    } catch {
      // Columna ya existe
    }

    await db.batch([
      db.prepare("DROP TRIGGER IF EXISTS update_balance_after_insert"),
      db.prepare(
        `CREATE TRIGGER IF NOT EXISTS update_balance_after_insert
         AFTER INSERT ON transactions
         BEGIN
           UPDATE accounts
           SET balance = balance + CASE
             WHEN NEW.type = 'income' THEN NEW.amount
             WHEN NEW.type = 'expense' THEN -NEW.amount
             WHEN NEW.type = 'transfer' THEN -NEW.amount
             ELSE 0
           END,
           updated_at = datetime('now')
           WHERE id = NEW.account_id
             AND id != 'direct-goal'
             AND (
               user_id = NEW.user_id
               OR EXISTS (
                 SELECT 1 FROM shared_members sm
                 WHERE sm.resource_type = 'account' AND sm.resource_id = accounts.id AND sm.user_id = NEW.user_id
               )
             );

           UPDATE accounts
           SET balance = balance + NEW.amount,
               updated_at = datetime('now')
           WHERE id = NEW.to_account_id
             AND NEW.to_account_id IS NOT NULL
             AND NEW.type = 'transfer'
             AND (
               user_id = NEW.user_id
               OR EXISTS (
                 SELECT 1 FROM shared_members sm
                 WHERE sm.resource_type = 'account' AND sm.resource_id = accounts.id AND sm.user_id = NEW.user_id
               )
             );

           UPDATE savings_goals
           SET current_amount = MAX(0, current_amount + CASE
             WHEN NEW.type IN ('expense', 'transfer') THEN NEW.amount
             WHEN NEW.type = 'income' AND NEW.category_id != 'cat-savings' THEN NEW.amount
             WHEN NEW.type = 'income' AND NEW.category_id = 'cat-savings' THEN -NEW.amount
             ELSE 0
           END),
           status = CASE
             WHEN (current_amount + CASE
               WHEN NEW.type IN ('expense', 'transfer') THEN NEW.amount
               WHEN NEW.type = 'income' AND NEW.category_id != 'cat-savings' THEN NEW.amount
               WHEN NEW.type = 'income' AND NEW.category_id = 'cat-savings' THEN -NEW.amount
               ELSE 0
             END) >= target_amount THEN 'completed'
             ELSE 'active'
           END,
           updated_at = datetime('now')
           WHERE id = NEW.goal_id
             AND NEW.goal_id IS NOT NULL
             AND (
               user_id = NEW.user_id
               OR EXISTS (
                 SELECT 1 FROM shared_members sm
                 WHERE sm.resource_type = 'goal' AND sm.resource_id = savings_goals.id AND sm.user_id = NEW.user_id
               )
             );
         END`,
      ),
      db.prepare("DROP TRIGGER IF EXISTS update_balance_after_delete"),
      db.prepare(
        `CREATE TRIGGER IF NOT EXISTS update_balance_after_delete
         AFTER DELETE ON transactions
         BEGIN
           UPDATE accounts
           SET balance = balance - CASE
             WHEN OLD.type = 'income' THEN OLD.amount
             WHEN OLD.type = 'expense' THEN -OLD.amount
             WHEN OLD.type = 'transfer' THEN -OLD.amount
             ELSE 0
           END,
           updated_at = datetime('now')
           WHERE id = OLD.account_id
             AND id != 'direct-goal'
             AND (
               user_id = OLD.user_id
               OR EXISTS (
                 SELECT 1 FROM shared_members sm
                 WHERE sm.resource_type = 'account' AND sm.resource_id = accounts.id AND sm.user_id = OLD.user_id
               )
             );

           UPDATE accounts
           SET balance = balance - OLD.amount,
               updated_at = datetime('now')
           WHERE id = OLD.to_account_id
             AND OLD.to_account_id IS NOT NULL
             AND OLD.type = 'transfer'
             AND (
               user_id = OLD.user_id
               OR EXISTS (
                 SELECT 1 FROM shared_members sm
                 WHERE sm.resource_type = 'account' AND sm.resource_id = accounts.id AND sm.user_id = OLD.user_id
               )
             );

           UPDATE savings_goals
           SET current_amount = MAX(0, current_amount - CASE
             WHEN OLD.type IN ('expense', 'transfer') THEN OLD.amount
             WHEN OLD.type = 'income' AND OLD.category_id != 'cat-savings' THEN OLD.amount
             WHEN OLD.type = 'income' AND OLD.category_id = 'cat-savings' THEN -OLD.amount
             ELSE 0
           END),
           status = CASE
             WHEN (current_amount - CASE
               WHEN OLD.type IN ('expense', 'transfer') THEN OLD.amount
               WHEN OLD.type = 'income' AND OLD.category_id != 'cat-savings' THEN OLD.amount
               WHEN OLD.type = 'income' AND OLD.category_id = 'cat-savings' THEN -OLD.amount
               ELSE 0
             END) >= target_amount THEN 'completed'
             ELSE 'active'
           END,
           updated_at = datetime('now')
           WHERE id = OLD.goal_id
             AND OLD.goal_id IS NOT NULL
             AND (
               user_id = OLD.user_id
               OR EXISTS (
                 SELECT 1 FROM shared_members sm
                 WHERE sm.resource_type = 'goal' AND sm.resource_id = savings_goals.id AND sm.user_id = OLD.user_id
               )
             );
         END`,
      ),
      db.prepare("DROP TRIGGER IF EXISTS update_balance_after_update"),
      db.prepare(
        `CREATE TRIGGER IF NOT EXISTS update_balance_after_update
         AFTER UPDATE ON transactions
         BEGIN
           UPDATE accounts
           SET balance = balance - CASE
             WHEN OLD.type = 'income' THEN OLD.amount
             WHEN OLD.type = 'expense' THEN -OLD.amount
             WHEN OLD.type = 'transfer' THEN -OLD.amount
             ELSE 0
           END,
           updated_at = datetime('now')
           WHERE id = OLD.account_id
             AND id != 'direct-goal'
             AND (
               user_id = OLD.user_id
               OR EXISTS (
                 SELECT 1 FROM shared_members sm
                 WHERE sm.resource_type = 'account' AND sm.resource_id = accounts.id AND sm.user_id = OLD.user_id
               )
             );

           UPDATE accounts
           SET balance = balance - OLD.amount,
               updated_at = datetime('now')
           WHERE id = OLD.to_account_id
             AND OLD.to_account_id IS NOT NULL
             AND OLD.type = 'transfer'
             AND (
               user_id = OLD.user_id
               OR EXISTS (
                 SELECT 1 FROM shared_members sm
                 WHERE sm.resource_type = 'account' AND sm.resource_id = accounts.id AND sm.user_id = OLD.user_id
               )
             );

           UPDATE savings_goals
           SET current_amount = MAX(0, current_amount - CASE
             WHEN OLD.type IN ('expense', 'transfer') THEN OLD.amount
             WHEN OLD.type = 'income' AND OLD.category_id != 'cat-savings' THEN OLD.amount
             WHEN OLD.type = 'income' AND OLD.category_id = 'cat-savings' THEN -OLD.amount
             ELSE 0
           END),
           updated_at = datetime('now')
           WHERE id = OLD.goal_id
             AND OLD.goal_id IS NOT NULL
             AND (
               user_id = OLD.user_id
               OR EXISTS (
                 SELECT 1 FROM shared_members sm
                 WHERE sm.resource_type = 'goal' AND sm.resource_id = savings_goals.id AND sm.user_id = OLD.user_id
               )
             );

           UPDATE accounts
           SET balance = balance + CASE
             WHEN NEW.type = 'income' THEN NEW.amount
             WHEN NEW.type = 'expense' THEN -NEW.amount
             WHEN NEW.type = 'transfer' THEN -NEW.amount
             ELSE 0
           END,
           updated_at = datetime('now')
           WHERE id = NEW.account_id
             AND id != 'direct-goal'
             AND (
               user_id = NEW.user_id
               OR EXISTS (
                 SELECT 1 FROM shared_members sm
                 WHERE sm.resource_type = 'account' AND sm.resource_id = accounts.id AND sm.user_id = NEW.user_id
               )
             );

           UPDATE accounts
           SET balance = balance + NEW.amount,
               updated_at = datetime('now')
           WHERE id = NEW.to_account_id
             AND NEW.to_account_id IS NOT NULL
             AND NEW.type = 'transfer'
             AND (
               user_id = NEW.user_id
               OR EXISTS (
                 SELECT 1 FROM shared_members sm
                 WHERE sm.resource_type = 'account' AND sm.resource_id = accounts.id AND sm.user_id = NEW.user_id
               )
             );

           UPDATE savings_goals
           SET current_amount = MAX(0, current_amount + CASE
             WHEN NEW.type IN ('expense', 'transfer') THEN NEW.amount
             WHEN NEW.type = 'income' AND NEW.category_id != 'cat-savings' THEN NEW.amount
             WHEN NEW.type = 'income' AND NEW.category_id = 'cat-savings' THEN -NEW.amount
             ELSE 0
           END),
           status = CASE
             WHEN (current_amount + CASE
               WHEN NEW.type IN ('expense', 'transfer') THEN NEW.amount
               WHEN NEW.type = 'income' AND NEW.category_id != 'cat-savings' THEN NEW.amount
               WHEN NEW.type = 'income' AND NEW.category_id = 'cat-savings' THEN -NEW.amount
               ELSE 0
             END) >= target_amount THEN 'completed'
             ELSE 'active'
           END,
           updated_at = datetime('now')
           WHERE id = NEW.goal_id
             AND NEW.goal_id IS NOT NULL
             AND (
               user_id = NEW.user_id
               OR EXISTS (
                 SELECT 1 FROM shared_members sm
                 WHERE sm.resource_type = 'goal' AND sm.resource_id = savings_goals.id AND sm.user_id = NEW.user_id
               )
             );
         END`,
      ),
    ]);
    sharedSchemaInitialized = true;
  } catch {
    // Continuar si el entorno no permite DDL
  }
}

async function claimLegacyDataIfAny(
  db: D1DatabaseType,
  userId: string,
): Promise<void> {
  await ensureSharedSchema(db);
  if (legacyAlreadyClaimed || userId === "legacy") return;

  const legacyCheck = await db
    .prepare("SELECT id FROM accounts WHERE user_id = 'legacy' LIMIT 1")
    .first();

  if (legacyCheck) {
    await db.batch([
      db
        .prepare("UPDATE accounts SET user_id = ? WHERE user_id = 'legacy'")
        .bind(userId),
      db
        .prepare("UPDATE transactions SET user_id = ? WHERE user_id = 'legacy'")
        .bind(userId),
      db
        .prepare(
          "UPDATE savings_goals SET user_id = ? WHERE user_id = 'legacy'",
        )
        .bind(userId),
    ]);
  }

  legacyAlreadyClaimed = true;
}

// ─── Helpers de formateo Snake <-> Camel ──────────────────────────────────────
function toCamelCaseAccount(row: any) {
  if (!row) return null;
  return {
    id: row.id,
    name: row.name,
    type: row.type,
    currency: row.currency,
    balance: row.balance,
    color: row.color,
    icon: row.icon,
    creditLimit: row.credit_limit,
    closingDay: row.closing_day,
    dueDay: row.due_day,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function toCamelCaseTransaction(row: any) {
  if (!row) return null;
  return {
    id: row.id,
    userId: row.user_id ?? undefined,
    authorName: row.author_name ?? undefined,
    accountId: row.account_id,
    categoryId: row.category_id,
    type: row.type,
    amount: row.amount,
    currency: row.currency,
    description: row.description,
    note: row.note,
    date: row.date,
    toAccountId: row.to_account_id,
    goalId: row.goal_id,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function toCamelCaseGoal(row: any) {
  if (!row) return null;
  return {
    id: row.id,
    name: row.name,
    targetAmount: row.target_amount,
    currentAmount: row.current_amount,
    currency: row.currency,
    deadline: row.deadline,
    icon: row.icon,
    color: row.color,
    status: row.status,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

async function enrichResourcesWithShared(
  db: D1DatabaseType,
  resourceType: "account" | "goal",
  rows: any[],
  currentUserId: string,
  mapper: (r: any) => any,
): Promise<any[]> {
  if (!rows || rows.length === 0) return [];
  const ids = rows.map((r) => r.id).filter(Boolean);
  if (ids.length === 0) return [];

  const placeholders = ids.map(() => "?").join(", ");
  const membersRes = await db
    .prepare(
      `SELECT resource_id, user_id, display_name, role, created_at
       FROM shared_members
       WHERE resource_type = ? AND resource_id IN (${placeholders})
       ORDER BY role DESC, created_at ASC`,
    )
    .bind(resourceType, ...ids)
    .all();

  const membersByResource = new Map<string, any[]>();
  for (const m of (membersRes.results || []) as any[]) {
    const list = membersByResource.get(m.resource_id) || [];
    list.push({
      userId: m.user_id,
      displayName: m.display_name || "Usuario",
      role: m.role === "owner" ? "owner" : "editor",
      joinedAt: m.created_at,
    });
    membersByResource.set(m.resource_id, list);
  }

  return rows.map((row) => {
    const base = mapper(row);
    const members = membersByResource.get(row.id) || [];
    const isOwner = row.user_id === currentUserId;
    const isShared = members.length > 1 || !isOwner;
    return {
      ...base,
      isOwner,
      isShared,
      members,
    };
  });
}

function generateShareInviteCode(): string {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  const bytes = new Uint8Array(4);
  crypto.getRandomValues(bytes);
  let suffix = "";
  for (let i = 0; i < 4; i++) {
    suffix += alphabet[bytes[i] % alphabet.length];
  }
  return `UNPO-${suffix}`;
}

function toCamelCaseCategory(row: any) {
  if (!row) return null;
  return {
    id: row.id,
    name: row.name,
    icon: row.icon,
    color: row.color,
    type: row.type,
    isDefault: Boolean(row.is_default),
  };
}

function sanitizeTime(value: unknown, fallback = "09:00"): string {
  if (typeof value !== "string") return fallback;
  const trimmed = value.trim();
  if (/^([01]\d|2[0-3]):([0-5]\d)$/.test(trimmed)) return trimmed;
  return fallback;
}

/** Devuelve "light" | "dark" o null si el valor no es válido. */
function sanitizeTheme(value: unknown): "light" | "dark" | null {
  if (value === "light" || value === "dark") return value;
  return null;
}

function computeNextDueDate(
  currentDueDate: string,
  dueDay: number,
  frequency: string,
  referenceToday: string,
): string {
  const safeStart = /^\d{4}-\d{2}-\d{2}$/.test(currentDueDate)
    ? currentDueDate
    : referenceToday;
  const [yStr, mStr, dStr] = safeStart.split("-");
  let year = parseInt(yStr, 10) || new Date().getUTCFullYear();
  let month = parseInt(mStr, 10) || new Date().getUTCMonth() + 1;
  let day = parseInt(dStr, 10) || 1;
  const targetDay = Math.min(31, Math.max(1, dueDay || day));

  const advanceOnce = () => {
    if (frequency === "weekly") {
      const dt = new Date(Date.UTC(year, month - 1, day, 12, 0, 0));
      dt.setUTCDate(dt.getUTCDate() + 7);
      year = dt.getUTCFullYear();
      month = dt.getUTCMonth() + 1;
      day = dt.getUTCDate();
    } else if (frequency === "yearly") {
      year += 1;
      const maxDays = new Date(Date.UTC(year, month, 0)).getUTCDate();
      day = Math.min(targetDay, maxDays);
    } else {
      month += 1;
      if (month > 12) {
        month = 1;
        year += 1;
      }
      const maxDays = new Date(Date.UTC(year, month, 0)).getUTCDate();
      day = Math.min(targetDay, maxDays);
    }
  };

  advanceOnce();
  let safety = 0;
  let formatted = `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
  while (formatted <= referenceToday && safety < 36) {
    advanceOnce();
    formatted = `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
    safety += 1;
  }
  return formatted;
}

function toCamelCaseRecurringExpense(row: any) {
  if (!row) return null;
  return {
    id: row.id,
    type: row.type === "income" ? "income" : "expense",
    name: row.name,
    amount: row.amount,
    currency: row.currency,
    accountId: row.account_id,
    accountName: row.account_name ?? undefined,
    accountColor: row.account_color ?? undefined,
    categoryId: row.category_id,
    dueDate: row.due_date,
    dueDay: row.due_day,
    frequency: row.frequency,
    isVariable: Boolean(row.is_variable),
    icon: row.icon,
    color: row.color,
    isActive: Boolean(row.is_active),
    lastPaidDate: row.last_paid_date ?? null,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

// ─── Entrypoint del Worker ───────────────────────────────────────────────────
export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    if (request.method === "OPTIONS") {
      return new Response(null, { headers: SECURITY_HEADERS });
    }

    const url = new URL(request.url);
    const path = url.pathname;
    const method = request.method;

    // ─── 1. Rate Limiting por IP (Pre-Autenticación / Anti-DDoS) ─────────────
    const clientIp =
      request.headers.get("CF-Connecting-IP") ||
      request.headers.get("X-Forwarded-For")?.split(",")[0]?.trim() ||
      "unknown-ip";

    const ipRate = checkRateLimit(`ip:${clientIp}`, IP_LIMIT_PER_MIN);
    if (!ipRate.allowed) {
      return error(
        "Demasiadas peticiones desde tu dirección IP. Intenta nuevamente en unos segundos.",
        429,
        {
          "Retry-After": String(ipRate.retryAfterSec),
          "X-RateLimit-Remaining": "0",
        },
      );
    }

    // ─── 2. Autenticación: Exclusivamente Firebase ID Token (RS256) ──────────
    const authHeader = request.headers.get("Authorization") || "";
    const bearerToken = authHeader.startsWith("Bearer ")
      ? authHeader.slice(7).trim()
      : "";

    if (!bearerToken) {
      return error("No autorizado: falta token de sesión", 401);
    }

    const projectId = (env.FIREBASE_PROJECT_ID || "unpo-finanzas").trim();
    const authUser = await verifyFirebaseIdToken(bearerToken, projectId);

    if (!authUser) {
      return error("Sesión inválida o expirada", 401);
    }
    const { userId, displayName: userDisplayName } = authUser;

    // ─── 3. Rate Limiting por Usuario (Lectura vs Escritura) ─────────────────
    const isWriteMethod =
      method === "POST" ||
      method === "PATCH" ||
      method === "PUT" ||
      method === "DELETE";

    const userRate = checkRateLimit(
      `user:${userId}:${isWriteMethod ? "write" : "read"}`,
      isWriteMethod ? USER_WRITE_LIMIT_PER_MIN : USER_READ_LIMIT_PER_MIN,
    );
    if (!userRate.allowed) {
      return error(
        "Has superado el límite de operaciones por minuto. Por favor espera unos segundos.",
        429,
        {
          "Retry-After": String(userRate.retryAfterSec),
          "X-RateLimit-Remaining": "0",
        },
      );
    }

    // Si es un usuario autenticado con Firebase, migrar datos 'legacy' la primera vez
    await claimLegacyDataIfAny(env.DB, userId);

    try {
      // ─── ACCOUNTS ──────────────────────────────────────────────────────────
      if (path === "/accounts" && method === "GET") {
        const rows = await env.DB.prepare(
          `SELECT * FROM accounts a
           WHERE a.user_id = ?
              OR EXISTS (
                SELECT 1 FROM shared_members sm
                WHERE sm.resource_type = 'account' AND sm.resource_id = a.id AND sm.user_id = ?
              )
           ORDER BY a.created_at ASC`,
        )
          .bind(userId, userId)
          .all();
        const data = await enrichResourcesWithShared(
          env.DB,
          "account",
          (rows.results || []) as any[],
          userId,
          toCamelCaseAccount,
        );
        return json({
          data,
          total: data.length,
          page: 1,
          pageSize: data.length,
          hasNextPage: false,
        });
      }

      if (path === "/accounts" && method === "POST") {
        const parsed = await parseSafeJsonBody(request);
        if (!parsed.ok) return parsed.response;
        const body = parsed.data;

        const name = sanitizeText(body.name, 80);
        if (!name) return error("El nombre de la cuenta es obligatorio", 400);

        const validTypes = [
          "checking",
          "savings",
          "investment",
          "cash",
          "credit",
        ];
        const type = validTypes.includes(body.type) ? body.type : "checking";
        const currency = sanitizeCurrency(body.currency);
        const balance = sanitizeAmount(body.balance ?? 0, true, true) ?? 0;
        const color = sanitizeColor(body.color, "#e23d28");
        const icon = sanitizeIcon(body.icon, "wallet");
        const creditLimit =
          body.creditLimit != null
            ? sanitizeAmount(body.creditLimit, true, false)
            : null;
        const closingDay =
          body.closingDay != null
            ? Math.min(31, Math.max(1, Math.trunc(Number(body.closingDay))))
            : null;
        const dueDay =
          body.dueDay != null
            ? Math.min(31, Math.max(1, Math.trunc(Number(body.dueDay))))
            : null;

        // ID siempre generado por el servidor (evita colisiones o inyección de ID)
        const id = crypto.randomUUID().replace(/-/g, "").slice(0, 16);

        await env.DB.prepare(
          `INSERT INTO accounts (id, user_id, name, type, currency, balance, color, icon, credit_limit, closing_day, due_day)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        )
          .bind(
            id,
            userId,
            name,
            type,
            currency,
            balance,
            color,
            icon,
            creditLimit,
            closingDay,
            dueDay,
          )
          .run();

        const created = await env.DB.prepare(
          "SELECT * FROM accounts WHERE id = ? AND user_id = ?",
        )
          .bind(id, userId)
          .first();
        return success(
          {
            ...toCamelCaseAccount(created),
            isOwner: true,
            isShared: false,
            members: [],
          },
          201,
        );
      }

      if (path.startsWith("/accounts/") && method === "GET") {
        const id = sanitizeIdentifier(path.split("/")[2]);
        const row = await env.DB.prepare(
          `SELECT * FROM accounts a
           WHERE a.id = ?
             AND (
               a.user_id = ?
               OR EXISTS (
                 SELECT 1 FROM shared_members sm
                 WHERE sm.resource_type = 'account' AND sm.resource_id = a.id AND sm.user_id = ?
               )
             )`,
        )
          .bind(id, userId, userId)
          .first();
        if (!row) return error("Cuenta no encontrada", 404);
        const [enriched] = await enrichResourcesWithShared(
          env.DB,
          "account",
          [row],
          userId,
          toCamelCaseAccount,
        );
        return success(enriched);
      }

      if (path.startsWith("/accounts/") && method === "PATCH") {
        const id = sanitizeIdentifier(path.split("/")[2]);
        const hasAccess = await verifyAccountOwnership(env.DB, id, userId);
        if (!hasAccess) return error("Cuenta no encontrada", 404);

        const parsed = await parseSafeJsonBody(request);
        if (!parsed.ok) return parsed.response;
        const body = parsed.data;

        const fields: string[] = [];
        const values: any[] = [];

        if (body.name !== undefined) {
          const cleanName = sanitizeText(body.name, 80);
          if (!cleanName) return error("Nombre de cuenta inválido", 400);
          fields.push("name = ?");
          values.push(cleanName);
        }
        if (body.type !== undefined) {
          const validTypes = [
            "checking",
            "savings",
            "investment",
            "cash",
            "credit",
          ];
          if (validTypes.includes(body.type)) {
            fields.push("type = ?");
            values.push(body.type);
          }
        }
        if (body.currency !== undefined) {
          fields.push("currency = ?");
          values.push(sanitizeCurrency(body.currency));
        }
        if (body.color !== undefined) {
          fields.push("color = ?");
          values.push(sanitizeColor(body.color));
        }
        if (body.icon !== undefined) {
          fields.push("icon = ?");
          values.push(sanitizeIcon(body.icon));
        }
        if (body.creditLimit !== undefined) {
          fields.push("credit_limit = ?");
          values.push(
            body.creditLimit != null
              ? sanitizeAmount(body.creditLimit, true, false)
              : null,
          );
        }
        if (body.closingDay !== undefined) {
          fields.push("closing_day = ?");
          values.push(
            body.closingDay != null
              ? Math.min(31, Math.max(1, Math.trunc(Number(body.closingDay))))
              : null,
          );
        }
        if (body.dueDay !== undefined) {
          fields.push("due_day = ?");
          values.push(
            body.dueDay != null
              ? Math.min(31, Math.max(1, Math.trunc(Number(body.dueDay))))
              : null,
          );
        }

        if (fields.length > 0) {
          fields.push("updated_at = datetime('now')");
          values.push(id);
          await env.DB.prepare(
            `UPDATE accounts SET ${fields.join(", ")} WHERE id = ?`,
          )
            .bind(...values)
            .run();
        }

        const updated = await env.DB.prepare(
          "SELECT * FROM accounts WHERE id = ?",
        )
          .bind(id)
          .first();
        if (!updated) return error("Cuenta no encontrada", 404);
        const [enriched] = await enrichResourcesWithShared(
          env.DB,
          "account",
          [updated],
          userId,
          toCamelCaseAccount,
        );
        return success(enriched);
      }

      if (path.startsWith("/accounts/") && method === "DELETE") {
        const id = sanitizeIdentifier(path.split("/")[2]);
        await env.DB.batch([
          env.DB.prepare(
            "DELETE FROM shared_members WHERE resource_type = 'account' AND resource_id = ? AND owner_id = ?",
          ).bind(id, userId),
          env.DB.prepare(
            "DELETE FROM share_invites WHERE resource_type = 'account' AND resource_id = ? AND owner_id = ?",
          ).bind(id, userId),
          env.DB.prepare(
            "DELETE FROM accounts WHERE id = ? AND user_id = ?",
          ).bind(id, userId),
        ]);
        return success(null);
      }

      // ─── CATEGORIES (Compartidas para todos los usuarios) ──────────────────
      if (path === "/categories" && method === "GET") {
        const typeParam = url.searchParams.get("type");
        const validCatTypes = ["income", "expense", "transfer"];
        const type =
          typeParam && validCatTypes.includes(typeParam) ? typeParam : null;
        const query = type
          ? "SELECT * FROM categories WHERE type = ? ORDER BY is_default DESC, rowid ASC"
          : "SELECT * FROM categories ORDER BY is_default DESC, rowid ASC";
        const stmt = env.DB.prepare(query);
        const rows = type ? await stmt.bind(type).all() : await stmt.all();
        const data = (rows.results || []).map(toCamelCaseCategory);
        return json({
          data,
          total: data.length,
          page: 1,
          pageSize: data.length,
          hasNextPage: false,
        });
      }

      // ─── TRANSACTIONS ──────────────────────────────────────────────────────
      if (path === "/transactions" && method === "GET") {
        const accountId = sanitizeIdentifier(url.searchParams.get("accountId"));
        const categoryId = sanitizeIdentifier(
          url.searchParams.get("categoryId"),
        );
        const goalId = sanitizeIdentifier(url.searchParams.get("goalId"));
        const typeParam = url.searchParams.get("type");
        const type =
          typeParam && ["income", "expense", "transfer"].includes(typeParam)
            ? typeParam
            : "";
        const startDate = url.searchParams.get("startDate");
        const endDate = url.searchParams.get("endDate");
        const page = Math.max(
          1,
          parseInt(url.searchParams.get("page") || "1", 10) || 1,
        );
        // Límite máximo de 100 registros por página para evitar volcados masivos
        const pageSize = Math.min(
          100,
          Math.max(
            1,
            parseInt(url.searchParams.get("pageSize") || "30", 10) || 30,
          ),
        );
        const offset = (page - 1) * pageSize;

        const conditions: string[] = [];
        const bindings: any[] = [];

        if (accountId) {
          const hasAccess = await verifyAccountOwnership(
            env.DB,
            accountId,
            userId,
          );
          if (!hasAccess) {
            return json({
              data: [],
              total: 0,
              page,
              pageSize,
              hasNextPage: false,
            });
          }
          conditions.push("(account_id = ? OR to_account_id = ?)");
          bindings.push(accountId, accountId);
        } else if (goalId) {
          const hasAccess = await verifyGoalOwnership(env.DB, goalId, userId);
          if (!hasAccess) {
            return json({
              data: [],
              total: 0,
              page,
              pageSize,
              hasNextPage: false,
            });
          }
          conditions.push("goal_id = ?");
          bindings.push(goalId);
        } else {
          conditions.push(
            `(user_id = ?
              OR EXISTS (
                SELECT 1 FROM shared_members sm
                WHERE sm.resource_type = 'account' AND sm.resource_id = transactions.account_id AND sm.user_id = ?
              )
              OR EXISTS (
                SELECT 1 FROM shared_members sm
                WHERE sm.resource_type = 'goal' AND sm.resource_id = transactions.goal_id AND sm.user_id = ?
              ))`,
          );
          bindings.push(userId, userId, userId);
        }

        if (categoryId) {
          conditions.push("category_id = ?");
          bindings.push(categoryId);
        }
        if (goalId && accountId) {
          conditions.push("goal_id = ?");
          bindings.push(goalId);
        }
        if (type) {
          conditions.push("type = ?");
          bindings.push(type);
        }
        if (startDate && /^\d{4}-\d{2}-\d{2}$/.test(startDate)) {
          conditions.push("date >= ?");
          bindings.push(startDate);
        }
        if (endDate && /^\d{4}-\d{2}-\d{2}$/.test(endDate)) {
          conditions.push("date <= ?");
          bindings.push(endDate);
        }

        const whereClause = `WHERE ${conditions.join(" AND ")}`;

        const countQuery = `SELECT COUNT(*) as count FROM transactions ${whereClause}`;
        const totalResult = await env.DB.prepare(countQuery)
          .bind(...bindings)
          .first();
        const total = (totalResult?.count as number) || 0;

        const listQuery = `SELECT * FROM transactions ${whereClause} ORDER BY date DESC, created_at DESC LIMIT ? OFFSET ?`;
        const rows = await env.DB.prepare(listQuery)
          .bind(...bindings, pageSize, offset)
          .all();
        const data = (rows.results || []).map(toCamelCaseTransaction);

        return json({
          data,
          total,
          page,
          pageSize,
          hasNextPage: offset + data.length < total,
        });
      }

      if (path === "/transactions" && method === "POST") {
        const parsed = await parseSafeJsonBody(request);
        if (!parsed.ok) return parsed.response;
        const body = parsed.data;

        const rawAccountId = sanitizeIdentifier(body.accountId);
        const rawCategoryId = sanitizeIdentifier(body.categoryId);
        const toAccountId = body.toAccountId
          ? sanitizeIdentifier(body.toAccountId)
          : null;
        const goalId = body.goalId ? sanitizeIdentifier(body.goalId) : null;

        const validTxTypes = ["income", "expense", "transfer"];
        if (!validTxTypes.includes(body.type)) {
          return error("Tipo de transacción inválido", 400);
        }

        const amount = sanitizeAmount(body.amount, false, false);
        if (amount === null) {
          return error("El monto debe ser un número positivo válido", 400);
        }

        const isDirectGoalIncome =
          Boolean(goalId) &&
          body.type === "income" &&
          (!rawAccountId || rawAccountId === "direct-goal");

        const accountId = isDirectGoalIncome ? "direct-goal" : rawAccountId;
        const categoryId =
          isDirectGoalIncome && (!rawCategoryId || rawCategoryId === "cat-savings")
            ? "cat-contribution"
            : rawCategoryId;

        if (!isDirectGoalIncome) {
          // ── RLS: Verificar que la cuenta origen pertenezca o sea compartida con el usuario autenticado
          const ownsOriginAccount = await verifyAccountOwnership(
            env.DB,
            accountId,
            userId,
          );
          if (!ownsOriginAccount) {
            return error(
              "Acceso denegado: la cuenta origen no existe o no tienes acceso",
              403,
            );
          }
        }

        // ── RLS: Si hay cuenta destino, verificar que también pertenezca o sea compartida
        if (toAccountId) {
          const ownsDestAccount = await verifyAccountOwnership(
            env.DB,
            toAccountId,
            userId,
          );
          if (!ownsDestAccount) {
            return error(
              "Acceso denegado: la cuenta destino no existe o no tienes acceso",
              403,
            );
          }
        }

        // ── RLS: Si hay meta asociada, verificar que pertenezca o sea compartida
        if (goalId) {
          const ownsGoal = await verifyGoalOwnership(env.DB, goalId, userId);
          if (!ownsGoal) {
            return error(
              "Acceso denegado: la meta de ahorro no existe o no tienes acceso",
              403,
            );
          }
        }

        const id = crypto.randomUUID().replace(/-/g, "").slice(0, 16);
        const description = sanitizeText(body.description, 160);
        const note =
          body.note != null ? sanitizeText(body.note, 400) || null : null;
        const currency = sanitizeCurrency(body.currency);
        const date = sanitizeDate(body.date);

        await env.DB.prepare(
          `INSERT INTO transactions (id, user_id, author_name, account_id, category_id, type, amount, currency, description, note, date, to_account_id, goal_id)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        )
          .bind(
            id,
            userId,
            userDisplayName,
            accountId,
            categoryId,
            body.type,
            amount,
            currency,
            description,
            note,
            date,
            toAccountId,
            goalId,
          )
          .run();

        const created = await env.DB.prepare(
          "SELECT * FROM transactions WHERE id = ? AND user_id = ?",
        )
          .bind(id, userId)
          .first();
        return success(toCamelCaseTransaction(created), 201);
      }

      if (path.startsWith("/transactions/") && method === "GET") {
        const id = sanitizeIdentifier(path.split("/")[2]);
        const row = await env.DB.prepare(
          "SELECT * FROM transactions WHERE id = ? AND user_id = ?",
        )
          .bind(id, userId)
          .first();
        if (!row) return error("Transacción no encontrada", 404);
        return success(toCamelCaseTransaction(row));
      }

      if (path.startsWith("/transactions/") && method === "PATCH") {
        const id = sanitizeIdentifier(path.split("/")[2]);
        const parsed = await parseSafeJsonBody(request);
        if (!parsed.ok) return parsed.response;
        const body = parsed.data;

        const fields: string[] = [];
        const values: any[] = [];

        if (body.description !== undefined) {
          fields.push("description = ?");
          values.push(sanitizeText(body.description, 160));
        }
        if (body.note !== undefined) {
          fields.push("note = ?");
          values.push(
            body.note != null ? sanitizeText(body.note, 400) || null : null,
          );
        }
        if (body.amount !== undefined) {
          const amount = sanitizeAmount(body.amount, false, false);
          if (amount === null) return error("Monto inválido", 400);
          fields.push("amount = ?");
          values.push(amount);
        }
        if (body.date !== undefined) {
          fields.push("date = ?");
          values.push(sanitizeDate(body.date));
        }
        if (body.categoryId !== undefined) {
          fields.push("category_id = ?");
          values.push(sanitizeIdentifier(body.categoryId));
        }

        if (fields.length > 0) {
          fields.push("updated_at = datetime('now')");
          values.push(id, userId);
          await env.DB.prepare(
            `UPDATE transactions SET ${fields.join(", ")} WHERE id = ? AND user_id = ?`,
          )
            .bind(...values)
            .run();
        }

        const updated = await env.DB.prepare(
          "SELECT * FROM transactions WHERE id = ? AND user_id = ?",
        )
          .bind(id, userId)
          .first();
        if (!updated) return error("Transacción no encontrada", 404);
        return success(toCamelCaseTransaction(updated));
      }

      if (path.startsWith("/transactions/") && method === "DELETE") {
        const id = sanitizeIdentifier(path.split("/")[2]);
        await env.DB.prepare(
          "DELETE FROM transactions WHERE id = ? AND user_id = ?",
        )
          .bind(id, userId)
          .run();
        return success(null);
      }

      // ─── GOALS ─────────────────────────────────────────────────────────────
      if (path === "/goals" && method === "GET") {
        const rows = await env.DB.prepare(
          `SELECT * FROM savings_goals g
           WHERE g.user_id = ?
              OR EXISTS (
                SELECT 1 FROM shared_members sm
                WHERE sm.resource_type = 'goal' AND sm.resource_id = g.id AND sm.user_id = ?
              )
           ORDER BY g.created_at ASC`,
        )
          .bind(userId, userId)
          .all();
        const data = await enrichResourcesWithShared(
          env.DB,
          "goal",
          (rows.results || []) as any[],
          userId,
          toCamelCaseGoal,
        );
        return json({
          data,
          total: data.length,
          page: 1,
          pageSize: data.length,
          hasNextPage: false,
        });
      }

      if (path === "/goals" && method === "POST") {
        const parsed = await parseSafeJsonBody(request);
        if (!parsed.ok) return parsed.response;
        const body = parsed.data;

        const name = sanitizeText(body.name, 80);
        if (!name) return error("El nombre de la meta es obligatorio", 400);

        const targetAmount = sanitizeAmount(body.targetAmount, false, false);
        if (targetAmount === null) {
          return error("El monto objetivo debe ser mayor a 0", 400);
        }

        const currentAmount =
          sanitizeAmount(body.currentAmount ?? 0, true, false) ?? 0;
        const currency = sanitizeCurrency(body.currency);
        const deadline =
          body.deadline && /^\d{4}-\d{2}-\d{2}$/.test(String(body.deadline))
            ? String(body.deadline)
            : null;
        const icon = sanitizeIcon(body.icon, "piggy-bank");
        const color = sanitizeColor(body.color, "#e23d28");
        const validStatuses = ["active", "completed", "paused"];
        const status = validStatuses.includes(body.status)
          ? body.status
          : "active";

        const id = crypto.randomUUID().replace(/-/g, "").slice(0, 16);
        await env.DB.prepare(
          `INSERT INTO savings_goals (id, user_id, name, target_amount, current_amount, currency, deadline, icon, color, status)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        )
          .bind(
            id,
            userId,
            name,
            targetAmount,
            currentAmount,
            currency,
            deadline,
            icon,
            color,
            status,
          )
          .run();

        const created = await env.DB.prepare(
          "SELECT * FROM savings_goals WHERE id = ? AND user_id = ?",
        )
          .bind(id, userId)
          .first();
        return success(
          {
            ...toCamelCaseGoal(created),
            isOwner: true,
            isShared: false,
            members: [],
          },
          201,
        );
      }

      if (path.startsWith("/goals/") && method === "GET") {
        const id = sanitizeIdentifier(path.split("/")[2]);
        const row = await env.DB.prepare(
          `SELECT * FROM savings_goals g
           WHERE g.id = ?
             AND (
               g.user_id = ?
               OR EXISTS (
                 SELECT 1 FROM shared_members sm
                 WHERE sm.resource_type = 'goal' AND sm.resource_id = g.id AND sm.user_id = ?
               )
             )`,
        )
          .bind(id, userId, userId)
          .first();
        if (!row) return error("Meta no encontrada", 404);
        const [enriched] = await enrichResourcesWithShared(
          env.DB,
          "goal",
          [row],
          userId,
          toCamelCaseGoal,
        );
        return success(enriched);
      }

      if (path.startsWith("/goals/") && method === "PATCH") {
        const id = sanitizeIdentifier(path.split("/")[2]);
        const hasAccess = await verifyGoalOwnership(env.DB, id, userId);
        if (!hasAccess) return error("Meta no encontrada", 404);

        const parsed = await parseSafeJsonBody(request);
        if (!parsed.ok) return parsed.response;
        const body = parsed.data;

        const fields: string[] = [];
        const values: any[] = [];

        if (body.name !== undefined) {
          const cleanName = sanitizeText(body.name, 80);
          if (!cleanName) return error("Nombre de meta inválido", 400);
          fields.push("name = ?");
          values.push(cleanName);
        }
        if (body.targetAmount !== undefined) {
          const targetAmount = sanitizeAmount(body.targetAmount, false, false);
          if (targetAmount === null) return error("Monto objetivo inválido", 400);
          fields.push("target_amount = ?");
          values.push(targetAmount);
        }
        if (body.currentAmount !== undefined) {
          const currentAmount = sanitizeAmount(body.currentAmount, true, false);
          if (currentAmount === null) return error("Monto actual inválido", 400);
          fields.push("current_amount = ?");
          values.push(currentAmount);
        }
        if (body.currency !== undefined) {
          fields.push("currency = ?");
          values.push(sanitizeCurrency(body.currency));
        }
        if (body.deadline !== undefined) {
          fields.push("deadline = ?");
          values.push(
            body.deadline && /^\d{4}-\d{2}-\d{2}$/.test(String(body.deadline))
              ? String(body.deadline)
              : null,
          );
        }
        if (body.icon !== undefined) {
          fields.push("icon = ?");
          values.push(sanitizeIcon(body.icon, "piggy-bank"));
        }
        if (body.color !== undefined) {
          fields.push("color = ?");
          values.push(sanitizeColor(body.color));
        }
        if (body.status !== undefined) {
          const validStatuses = ["active", "completed", "paused"];
          if (validStatuses.includes(body.status)) {
            fields.push("status = ?");
            values.push(body.status);
          }
        }

        if (fields.length > 0) {
          fields.push("updated_at = datetime('now')");
          values.push(id);
          await env.DB.prepare(
            `UPDATE savings_goals SET ${fields.join(", ")} WHERE id = ?`,
          )
            .bind(...values)
            .run();
        }

        const updated = await env.DB.prepare(
          "SELECT * FROM savings_goals WHERE id = ?",
        )
          .bind(id)
          .first();
        if (!updated) return error("Meta no encontrada", 404);
        const [enriched] = await enrichResourcesWithShared(
          env.DB,
          "goal",
          [updated],
          userId,
          toCamelCaseGoal,
        );
        return success(enriched);
      }

      if (path.startsWith("/goals/") && method === "DELETE") {
        const id = sanitizeIdentifier(path.split("/")[2]);
        await env.DB.batch([
          env.DB.prepare(
            "DELETE FROM shared_members WHERE resource_type = 'goal' AND resource_id = ? AND owner_id = ?",
          ).bind(id, userId),
          env.DB.prepare(
            "DELETE FROM share_invites WHERE resource_type = 'goal' AND resource_id = ? AND owner_id = ?",
          ).bind(id, userId),
          env.DB.prepare(
            "DELETE FROM savings_goals WHERE id = ? AND user_id = ?",
          ).bind(id, userId),
        ]);
        return success(null);
      }

      // Aporte a meta (transferencia desde cuenta O ingreso directo a la meta)
      if (
        path.startsWith("/goals/") &&
        path.endsWith("/contribute") &&
        method === "POST"
      ) {
        const goalId = sanitizeIdentifier(path.split("/")[2]);
        const parsed = await parseSafeJsonBody(request);
        if (!parsed.ok) return parsed.response;
        const body = parsed.data;

        const rawAccountId = sanitizeIdentifier(body.accountId);
        const isDirectIncome =
          body.isDirectIncome === true ||
          !rawAccountId ||
          rawAccountId === "direct-goal";
        const amount = sanitizeAmount(body.amount, false, false);
        if (amount === null) return error("Monto de aporte inválido", 400);

        const hasGoalAccess = await verifyGoalOwnership(env.DB, goalId, userId);
        if (!hasGoalAccess) return error("Meta no encontrada", 404);

        const goal = await env.DB.prepare(
          "SELECT * FROM savings_goals WHERE id = ?",
        )
          .bind(goalId)
          .first();
        if (!goal) return error("Meta no encontrada", 404);

        let effectiveAccountId = "direct-goal";
        let effectiveType = "income";
        let effectiveCategoryId =
          sanitizeIdentifier(body.categoryId) || "cat-contribution";
        if (effectiveCategoryId === "cat-savings") {
          effectiveCategoryId = "cat-contribution";
        }
        let effectiveDesc = `Ingreso directo a meta: ${goal.name}`;

        if (!isDirectIncome) {
          // ── RLS: Verificar que la cuenta origen pertenezca o sea compartida con el usuario
          const ownsAccount = await verifyAccountOwnership(
            env.DB,
            rawAccountId,
            userId,
          );
          if (!ownsAccount) {
            return error(
              "Acceso denegado: la cuenta seleccionada no te pertenece",
              403,
            );
          }
          effectiveAccountId = rawAccountId;
          effectiveType = "expense";
          effectiveCategoryId = "cat-savings";
          effectiveDesc = `Aporte a meta: ${goal.name}`;
        }

        const txId = crypto.randomUUID().replace(/-/g, "").slice(0, 16);
        const date = sanitizeDate(body.date);
        const note =
          body.note != null ? sanitizeText(body.note, 400) || null : null;

        await env.DB.prepare(
          `INSERT INTO transactions (id, user_id, author_name, account_id, category_id, type, amount, currency, description, note, date, goal_id)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        )
          .bind(
            txId,
            userId,
            userDisplayName,
            effectiveAccountId,
            effectiveCategoryId,
            effectiveType,
            amount,
            goal.currency,
            sanitizeText(effectiveDesc, 160),
            note,
            date,
            goalId,
          )
          .run();

        const updatedGoal = await env.DB.prepare(
          "SELECT * FROM savings_goals WHERE id = ?",
        )
          .bind(goalId)
          .first();
        const [enrichedGoal] = await enrichResourcesWithShared(
          env.DB,
          "goal",
          updatedGoal ? [updatedGoal] : [],
          userId,
          toCamelCaseGoal,
        );
        const createdTx = await env.DB.prepare(
          "SELECT * FROM transactions WHERE id = ? AND user_id = ?",
        )
          .bind(txId, userId)
          .first();

        return success({
          goal: enrichedGoal,
          transaction: toCamelCaseTransaction(createdTx),
        });
      }

      // Retiro de meta
      if (
        path.startsWith("/goals/") &&
        path.endsWith("/withdraw") &&
        method === "POST"
      ) {
        const goalId = sanitizeIdentifier(path.split("/")[2]);
        const parsed = await parseSafeJsonBody(request);
        if (!parsed.ok) return parsed.response;
        const body = parsed.data;

        const accountId = sanitizeIdentifier(body.accountId);
        const amount = sanitizeAmount(body.amount, false, false);
        if (amount === null) return error("Monto de retiro inválido", 400);

        const hasGoalAccess = await verifyGoalOwnership(env.DB, goalId, userId);
        if (!hasGoalAccess) return error("Meta no encontrada", 404);

        const goal = await env.DB.prepare(
          "SELECT * FROM savings_goals WHERE id = ?",
        )
          .bind(goalId)
          .first();
        if (!goal) return error("Meta no encontrada", 404);

        // ── RLS: Verificar que la cuenta destino pertenezca o sea compartida con el usuario
        const ownsAccount = await verifyAccountOwnership(
          env.DB,
          accountId,
          userId,
        );
        if (!ownsAccount) {
          return error(
            "Acceso denegado: la cuenta seleccionada no te pertenece",
            403,
          );
        }

        const txId = crypto.randomUUID().replace(/-/g, "").slice(0, 16);
        const date = sanitizeDate(body.date);
        const note =
          body.note != null ? sanitizeText(body.note, 400) || null : null;

        await env.DB.prepare(
          `INSERT INTO transactions (id, user_id, author_name, account_id, category_id, type, amount, currency, description, note, date, goal_id)
           VALUES (?, ?, ?, ?, 'cat-savings', 'income', ?, ?, ?, ?, ?, ?)`,
        )
          .bind(
            txId,
            userId,
            userDisplayName,
            accountId,
            amount,
            goal.currency,
            sanitizeText(`Retiro de meta: ${goal.name}`, 160),
            note,
            date,
            goalId,
          )
          .run();

        const updatedGoal = await env.DB.prepare(
          "SELECT * FROM savings_goals WHERE id = ?",
        )
          .bind(goalId)
          .first();
        const [enrichedGoal] = await enrichResourcesWithShared(
          env.DB,
          "goal",
          updatedGoal ? [updatedGoal] : [],
          userId,
          toCamelCaseGoal,
        );
        const createdTx = await env.DB.prepare(
          "SELECT * FROM transactions WHERE id = ? AND user_id = ?",
        )
          .bind(txId, userId)
          .first();

        return success({
          goal: enrichedGoal,
          transaction: toCamelCaseTransaction(createdTx),
        });
      }

      // ─── CUENTAS Y METAS COMPARTIDAS (Códigos de Invitación UNPO-XXXX) ─────
      if (path === "/share/invite" && method === "POST") {
        const parsed = await parseSafeJsonBody(request);
        if (!parsed.ok) return parsed.response;
        const body = parsed.data;

        const resourceType =
          body.resourceType === "goal" ? "goal" : "account";
        const resourceId = sanitizeIdentifier(body.resourceId);
        if (!resourceId) return error("ID de recurso inválido", 400);

        const tableName =
          resourceType === "goal" ? "savings_goals" : "accounts";
        const resourceRow = await env.DB.prepare(
          `SELECT id, name, user_id FROM ${tableName} WHERE id = ? AND user_id = ?`,
        )
          .bind(resourceId, userId)
          .first();

        if (!resourceRow) {
          return error(
            "Solo el propietario puede generar códigos de invitación",
            403,
          );
        }

        // Limpiar invitaciones vencidas de este recurso y reutilizar si ya hay una activa
        const nowIso = new Date().toISOString();
        await env.DB.prepare(
          "DELETE FROM share_invites WHERE resource_type = ? AND resource_id = ? AND expires_at <= ?",
        )
          .bind(resourceType, resourceId, nowIso)
          .run();

        const existingInvite = await env.DB.prepare(
          "SELECT code, expires_at FROM share_invites WHERE resource_type = ? AND resource_id = ? AND owner_id = ? AND expires_at > ? LIMIT 1",
        )
          .bind(resourceType, resourceId, userId, nowIso)
          .first();

        if (existingInvite) {
          return success({
            code: String(existingInvite.code),
            resourceType,
            resourceId,
            expiresAt: String(existingInvite.expires_at),
          });
        }

        const code = generateShareInviteCode();
        const expiresAt = new Date(
          Date.now() + 24 * 60 * 60 * 1000,
        ).toISOString();

        await env.DB.prepare(
          `INSERT OR REPLACE INTO share_invites (code, resource_type, resource_id, owner_id, owner_name, expires_at)
           VALUES (?, ?, ?, ?, ?, ?)`,
        )
          .bind(
            code,
            resourceType,
            resourceId,
            userId,
            userDisplayName,
            expiresAt,
          )
          .run();

        return success(
          {
            code,
            resourceType,
            resourceId,
            expiresAt,
          },
          201,
        );
      }

      if (path === "/share/join" && method === "POST") {
        const parsed = await parseSafeJsonBody(request);
        if (!parsed.ok) return parsed.response;
        const rawCode = String(parsed.data?.code || "")
          .trim()
          .toUpperCase();
        const cleanCode = rawCode.replace(/[^A-Z0-9-]/g, "").slice(0, 12);
        if (!cleanCode) {
          return error("Ingresa un código de invitación válido", 400);
        }

        const normalizedCode = cleanCode.startsWith("UNPO-")
          ? cleanCode
          : cleanCode.length === 4
            ? `UNPO-${cleanCode}`
            : cleanCode;

        const invite = await env.DB.prepare(
          "SELECT * FROM share_invites WHERE code = ? LIMIT 1",
        )
          .bind(normalizedCode)
          .first();

        if (!invite) {
          return error("El código de invitación no existe o ya fue utilizado", 404);
        }

        const nowIso = new Date().toISOString();
        if (String(invite.expires_at) <= nowIso) {
          return error(
            "El código de invitación ha expirado. Pídele uno nuevo al propietario.",
            410,
          );
        }

        const resourceType =
          invite.resource_type === "goal" ? "goal" : "account";
        const resourceId = String(invite.resource_id);
        const ownerId = String(invite.owner_id);
        const ownerName = String(invite.owner_name || "Propietario");

        if (ownerId === userId) {
          return error("Ya eres el propietario de este recurso", 400);
        }

        const tableName =
          resourceType === "goal" ? "savings_goals" : "accounts";
        const resourceRow = await env.DB.prepare(
          `SELECT id, name FROM ${tableName} WHERE id = ?`,
        )
          .bind(resourceId)
          .first();

        if (!resourceRow) {
          return error("La cuenta o meta compartida ya no existe", 404);
        }

        const ownerMemberId = crypto.randomUUID().replace(/-/g, "").slice(0, 16);
        const editorMemberId = crypto.randomUUID().replace(/-/g, "").slice(0, 16);

        await env.DB.batch([
          env.DB.prepare(
            `INSERT INTO shared_members (id, resource_type, resource_id, owner_id, user_id, display_name, role)
             VALUES (?, ?, ?, ?, ?, ?, 'owner')
             ON CONFLICT(resource_type, resource_id, user_id) DO UPDATE SET
               display_name = excluded.display_name,
               role = 'owner'`,
          ).bind(
            ownerMemberId,
            resourceType,
            resourceId,
            ownerId,
            ownerId,
            ownerName,
          ),
          env.DB.prepare(
            `INSERT INTO shared_members (id, resource_type, resource_id, owner_id, user_id, display_name, role)
             VALUES (?, ?, ?, ?, ?, ?, 'editor')
             ON CONFLICT(resource_type, resource_id, user_id) DO UPDATE SET
               display_name = excluded.display_name`,
          ).bind(
            editorMemberId,
            resourceType,
            resourceId,
            ownerId,
            userId,
            userDisplayName,
          ),
        ]);

        return success({
          resourceType,
          resourceId,
          resourceName: String(resourceRow.name),
        });
      }

      if (path === "/share/leave" && method === "POST") {
        const parsed = await parseSafeJsonBody(request);
        if (!parsed.ok) return parsed.response;
        const body = parsed.data;

        const resourceType =
          body.resourceType === "goal" ? "goal" : "account";
        const resourceId = sanitizeIdentifier(body.resourceId);
        const targetUserId = body.targetUserId
          ? String(body.targetUserId).trim()
          : userId;

        if (!resourceId) return error("ID de recurso inválido", 400);

        if (targetUserId !== userId) {
          // El propietario está eliminando a un miembro
          const tableName =
            resourceType === "goal" ? "savings_goals" : "accounts";
          const isOwner = await env.DB.prepare(
            `SELECT id FROM ${tableName} WHERE id = ? AND user_id = ?`,
          )
            .bind(resourceId, userId)
            .first();
          if (!isOwner) {
            return error(
              "Solo el propietario puede quitar miembros",
              403,
            );
          }
        }

        await env.DB.prepare(
          "DELETE FROM shared_members WHERE resource_type = ? AND resource_id = ? AND user_id = ? AND role != 'owner'",
        )
          .bind(resourceType, resourceId, targetUserId)
          .run();

        // Si ya no quedan editores invitados, limpiar también la fila del owner para que vuelva a ser privada
        const remainingEditors = await env.DB.prepare(
          "SELECT COUNT(*) as count FROM shared_members WHERE resource_type = ? AND resource_id = ? AND role = 'editor'",
        )
          .bind(resourceType, resourceId)
          .first();

        if (!remainingEditors || Number(remainingEditors.count || 0) === 0) {
          await env.DB.prepare(
            "DELETE FROM shared_members WHERE resource_type = ? AND resource_id = ?",
          )
            .bind(resourceType, resourceId)
            .run();
        }

        return success(null);
      }

      // ─── REPORTS ───────────────────────────────────────────────────────────
      if (path === "/reports/monthly" && method === "GET") {
        const rawYear = parseInt(
          url.searchParams.get("year") || String(new Date().getFullYear()),
          10,
        );
        const rawMonth = parseInt(
          url.searchParams.get("month") || String(new Date().getMonth() + 1),
          10,
        );
        const year = Math.min(2100, Math.max(2000, rawYear || new Date().getFullYear()));
        const month = Math.min(12, Math.max(1, rawMonth || new Date().getMonth() + 1));
        const monthPattern = `${year}-${String(month).padStart(2, "0")}%`;

        // Incluye transacciones normales + ingresos directos a metas que NO sean transferencias ('cat-savings')
        const txRows = await env.DB.prepare(
          `SELECT t.*, c.name as cat_name, c.color as cat_color, c.icon as cat_icon
           FROM transactions t
           LEFT JOIN categories c ON t.category_id = c.id
           WHERE t.user_id = ?
             AND t.date LIKE ?
             AND (t.category_id != 'cat-savings' OR t.category_id IS NULL)
             AND (t.goal_id IS NULL OR (t.type = 'income' AND t.category_id != 'cat-savings'))`,
        )
          .bind(userId, monthPattern)
          .all();

        const txs = (txRows.results || []) as any[];
        let totalIncome = 0;
        let totalExpenses = 0;
        const expMap = new Map<string, any>();
        const incMap = new Map<string, any>();

        for (const tx of txs) {
          if (tx.category_id === "cat-savings") continue;
          if (tx.goal_id && tx.type !== "income") continue;

          if (tx.type === "income") {
            totalIncome += tx.amount;
            const catId = tx.category_id || "cat-income-other";
            const current = incMap.get(catId) || {
              categoryId: catId,
              categoryName: tx.cat_name || "Otros ingresos",
              categoryIcon: tx.cat_icon || "cash",
              categoryColor: tx.cat_color || "#17b26a",
              total: 0,
              transactionCount: 0,
            };
            current.total += tx.amount;
            current.transactionCount += 1;
            incMap.set(catId, current);
          } else if (tx.type === "expense") {
            totalExpenses += tx.amount;
            const catId = tx.category_id || "cat-expense-other";
            const current = expMap.get(catId) || {
              categoryId: catId,
              categoryName: tx.cat_name || "Otros gastos",
              categoryIcon: tx.cat_icon || "tag",
              categoryColor: tx.cat_color || "#68615e",
              total: 0,
              transactionCount: 0,
            };
            current.total += tx.amount;
            current.transactionCount += 1;
            expMap.set(catId, current);
          }
        }

        const byExpenseCategory = Array.from(expMap.values()).map((c) => ({
          ...c,
          percentage: totalExpenses > 0 ? (c.total / totalExpenses) * 100 : 0,
        }));
        byExpenseCategory.sort((a, b) => b.total - a.total);

        const byIncomeCategory = Array.from(incMap.values()).map((c) => ({
          ...c,
          percentage: totalIncome > 0 ? (c.total / totalIncome) * 100 : 0,
        }));
        byIncomeCategory.sort((a, b) => b.total - a.total);

        return success({
          month,
          year,
          totalIncome,
          totalExpenses,
          netBalance: totalIncome - totalExpenses,
          byCategory: byExpenseCategory,
          byExpenseCategory,
          byIncomeCategory,
        });
      }

      if (path === "/reports/annual" && method === "GET") {
        const rawYear = parseInt(
          url.searchParams.get("year") || String(new Date().getFullYear()),
          10,
        );
        const year = Math.min(2100, Math.max(2000, rawYear || new Date().getFullYear()));
        const yearPattern = `${year}%`;

        // Incluye transacciones normales + ingresos directos a metas que NO sean transferencias ('cat-savings')
        const txRows = await env.DB.prepare(
          `SELECT t.*, c.name as cat_name, c.color as cat_color, c.icon as cat_icon
           FROM transactions t
           LEFT JOIN categories c ON t.category_id = c.id
           WHERE t.user_id = ?
             AND t.date LIKE ?
             AND (t.category_id != 'cat-savings' OR t.category_id IS NULL)
             AND (t.goal_id IS NULL OR (t.type = 'income' AND t.category_id != 'cat-savings'))`,
        )
          .bind(userId, yearPattern)
          .all();

        const txs = (txRows.results || []) as any[];
        let totalIncome = 0;
        let totalExpenses = 0;
        const expMap = new Map<string, any>();
        const incMap = new Map<string, any>();

        for (const tx of txs) {
          if (tx.category_id === "cat-savings") continue;
          if (tx.goal_id && tx.type !== "income") continue;

          if (tx.type === "income") {
            totalIncome += tx.amount;
            const catId = tx.category_id || "cat-income-other";
            const current = incMap.get(catId) || {
              categoryId: catId,
              categoryName: tx.cat_name || "Otros ingresos",
              categoryIcon: tx.cat_icon || "cash",
              categoryColor: tx.cat_color || "#17b26a",
              total: 0,
              transactionCount: 0,
            };
            current.total += tx.amount;
            current.transactionCount += 1;
            incMap.set(catId, current);
          } else if (tx.type === "expense") {
            totalExpenses += tx.amount;
            const catId = tx.category_id || "cat-expense-other";
            const current = expMap.get(catId) || {
              categoryId: catId,
              categoryName: tx.cat_name || "Otros gastos",
              categoryIcon: tx.cat_icon || "tag",
              categoryColor: tx.cat_color || "#68615e",
              total: 0,
              transactionCount: 0,
            };
            current.total += tx.amount;
            current.transactionCount += 1;
            expMap.set(catId, current);
          }
        }

        const byExpenseCategory = Array.from(expMap.values()).map((c) => ({
          ...c,
          percentage: totalExpenses > 0 ? (c.total / totalExpenses) * 100 : 0,
        }));
        byExpenseCategory.sort((a, b) => b.total - a.total);

        const byIncomeCategory = Array.from(incMap.values()).map((c) => ({
          ...c,
          percentage: totalIncome > 0 ? (c.total / totalIncome) * 100 : 0,
        }));
        byIncomeCategory.sort((a, b) => b.total - a.total);

        const netBalance = totalIncome - totalExpenses;

        const MONTH_NAMES = [
          "Ene",
          "Feb",
          "Mar",
          "Abr",
          "May",
          "Jun",
          "Jul",
          "Ago",
          "Sep",
          "Oct",
          "Nov",
          "Dic",
        ];
        const monthlyBreakdown = MONTH_NAMES.map((name, idx) => {
          const m = idx + 1;
          const mPrefix = `${year}-${String(m).padStart(2, "0")}`;
          let inc = 0;
          let exp = 0;
          for (const tx of txs) {
            if (tx.category_id === "cat-savings") continue;
            if (tx.goal_id && tx.type !== "income") continue;
            if (tx.date && tx.date.startsWith(mPrefix)) {
              if (tx.type === "income") inc += tx.amount;
              else if (tx.type === "expense") exp += tx.amount;
            }
          }
          return {
            month: m,
            monthName: name,
            income: inc,
            expense: exp,
            net: inc - exp,
          };
        });

        return success({
          year,
          totalIncome,
          totalExpenses,
          netBalance,
          byExpenseCategory,
          byIncomeCategory,
          monthlyBreakdown,
        });
      }

      // ─── USER SETTINGS (Hora de aviso + Tema claro/oscuro por Usuario) ─────
      if (path === "/user-settings" && method === "GET") {
        const row = await env.DB.prepare(
          "SELECT * FROM user_settings WHERE user_id = ?",
        )
          .bind(userId)
          .first();

        return success({
          userId,
          reminderTime: row ? String(row.reminder_time || "09:00") : "09:00",
          theme: sanitizeTheme(row?.theme) ?? "light",
          updatedAt: row
            ? String(row.updated_at)
            : new Date().toISOString(),
        });
      }

      if (
        path === "/user-settings" &&
        (method === "PUT" || method === "PATCH" || method === "POST")
      ) {
        const parsed = await parseSafeJsonBody(request);
        if (!parsed.ok) return parsed.response;

        const hasReminder = parsed.data?.reminderTime !== undefined;
        const hasTheme = parsed.data?.theme !== undefined;
        if (!hasReminder && !hasTheme) {
          return error("Debes enviar reminderTime y/o theme", 400);
        }

        let reminderTime: string | null = null;
        if (hasReminder) {
          reminderTime = sanitizeTime(parsed.data?.reminderTime, "");
          if (!reminderTime) {
            return error(
              "Formato de hora inválido. Usa el formato 24h HH:mm (ej. 09:00 o 20:30)",
              400,
            );
          }
        }

        let theme: "light" | "dark" | null = null;
        if (hasTheme) {
          theme = sanitizeTheme(parsed.data?.theme);
          if (!theme) {
            return error('Tema inválido. Usa "light" o "dark"', 400);
          }
        }

        // Los campos no enviados (null) conservan su valor actual / por defecto
        await env.DB.prepare(
          `INSERT INTO user_settings (user_id, reminder_time, theme, updated_at)
           VALUES (?, COALESCE(?, '09:00'), COALESCE(?, 'light'), datetime('now'))
           ON CONFLICT(user_id) DO UPDATE SET
             reminder_time = COALESCE(?, user_settings.reminder_time),
             theme         = COALESCE(?, user_settings.theme),
             updated_at    = datetime('now')`,
        )
          .bind(userId, reminderTime, theme, reminderTime, theme)
          .run();

        const updated = await env.DB.prepare(
          "SELECT * FROM user_settings WHERE user_id = ?",
        )
          .bind(userId)
          .first();

        return success({
          userId,
          reminderTime: updated
            ? String(updated.reminder_time || "09:00")
            : (reminderTime ?? "09:00"),
          theme: sanitizeTheme(updated?.theme) ?? theme ?? "light",
          updatedAt: updated
            ? String(updated.updated_at)
            : new Date().toISOString(),
        });
      }

      // ─── RECURRING EXPENSES (Gastos e Ingresos Automáticos por Usuario) ────
      if (path === "/recurring-expenses/process-due" && method === "POST") {
        let localDate = new Date().toISOString().slice(0, 10);
        let localTime = "09:00";
        try {
          const parsed = await parseSafeJsonBody(request);
          if (parsed.ok && parsed.data) {
            if (parsed.data.localDate) {
              localDate = sanitizeDate(parsed.data.localDate);
            }
            if (parsed.data.localTime) {
              localTime = sanitizeTime(parsed.data.localTime, "09:00");
            }
          }
        } catch {
          // Cuerpo opcional
        }

        const settingsRow = await env.DB.prepare(
          "SELECT * FROM user_settings WHERE user_id = ?",
        )
          .bind(userId)
          .first();
        const reminderTime = settingsRow
          ? String(settingsRow.reminder_time || "09:00")
          : "09:00";

        const dueRows = await env.DB.prepare(
          `SELECT r.*, a.name AS account_name, a.color AS account_color
           FROM recurring_expenses r
           LEFT JOIN accounts a ON r.account_id = a.id AND a.user_id = r.user_id
           WHERE r.user_id = ? AND r.is_active = 1 AND r.due_date <= ?
           ORDER BY r.due_date ASC, r.due_day ASC`,
        )
          .bind(userId, localDate)
          .all();

        const items = (dueRows.results || []) as any[];
        const appliedFixed: any[] = [];
        const dueVariable: any[] = [];

        for (const row of items) {
          const isVariable = Boolean(row.is_variable);

          if (!isVariable) {
            // Monto fijo → descontar o acreditar automáticamente si la cuenta existe
            const ownsAccount = await verifyAccountOwnership(
              env.DB,
              row.account_id,
              userId,
            );
            if (!ownsAccount) continue;

            const itemType = row.type === "income" ? "income" : "expense";
            const defaultCategory =
              itemType === "income" ? "cat-salary" : "cat-services";
            const txId = crypto.randomUUID().replace(/-/g, "").slice(0, 16);
            const nextDueDate = computeNextDueDate(
              String(row.due_date || localDate),
              Number(row.due_day || 1),
              String(row.frequency || "monthly"),
              localDate,
            );

            await env.DB.batch([
              env.DB.prepare(
                `INSERT INTO transactions (id, user_id, account_id, category_id, type, amount, currency, description, note, date)
                 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
              ).bind(
                txId,
                userId,
                row.account_id,
                row.category_id || defaultCategory,
                itemType,
                row.amount,
                row.currency || "ARS",
                sanitizeText(
                  `${itemType === "income" ? "Ingreso automático fijo" : "Gasto automático fijo"}: ${row.name}`,
                  160,
                ),
                itemType === "income"
                  ? "Acreditación automática (monto fijo)"
                  : "Descuento automático (monto fijo)",
                localDate,
              ),
              env.DB.prepare(
                `UPDATE recurring_expenses
                 SET last_paid_date = ?, due_date = ?, updated_at = datetime('now')
                 WHERE id = ? AND user_id = ?`,
              ).bind(localDate, nextDueDate, row.id, userId),
            ]);

            appliedFixed.push(
              toCamelCaseRecurringExpense({
                ...row,
                last_paid_date: localDate,
                due_date: nextDueDate,
              }),
            );
          } else {
            // Monto variable → preguntar si ya venció en días previos o si hoy ya llegó la hora del usuario
            const isPastDay = String(row.due_date) < localDate;
            const isTodayAtOrAfterHour =
              String(row.due_date) === localDate && localTime >= reminderTime;

            if (isPastDay || isTodayAtOrAfterHour) {
              dueVariable.push(toCamelCaseRecurringExpense(row));
            }
          }
        }

        return success({
          appliedFixed,
          dueVariable,
          settings: {
            userId,
            reminderTime,
            updatedAt: settingsRow
              ? String(settingsRow.updated_at)
              : new Date().toISOString(),
          },
        });
      }

      if (path === "/recurring-expenses" && method === "GET") {
        const rows = await env.DB.prepare(
          `SELECT r.*, a.name AS account_name, a.color AS account_color
           FROM recurring_expenses r
           LEFT JOIN accounts a ON r.account_id = a.id AND a.user_id = r.user_id
           WHERE r.user_id = ?
           ORDER BY r.is_active DESC, r.due_day ASC, r.created_at ASC`,
        )
          .bind(userId)
          .all();
        const data = (rows.results || []).map(toCamelCaseRecurringExpense);
        return json({
          data,
          total: data.length,
          page: 1,
          pageSize: data.length,
          hasNextPage: false,
        });
      }

      if (path === "/recurring-expenses" && method === "POST") {
        const parsed = await parseSafeJsonBody(request);
        if (!parsed.ok) return parsed.response;
        const body = parsed.data;

        const name = sanitizeText(body.name, 80);
        if (!name) return error("El nombre del gasto es obligatorio", 400);

        const amount = sanitizeAmount(body.amount, false, false);
        if (amount === null) {
          return error("El costo debe ser un número mayor a 0", 400);
        }

        const accountId = sanitizeIdentifier(body.accountId);
        const ownsAccount = await verifyAccountOwnership(
          env.DB,
          accountId,
          userId,
        );
        if (!ownsAccount) {
          return error(
            "Acceso denegado: la cuenta seleccionada no existe o no te pertenece",
            403,
          );
        }

        const itemType = body.type === "income" ? "income" : "expense";
        const defaultCat =
          itemType === "income" ? "cat-salary" : "cat-services";
        const categoryId = sanitizeIdentifier(body.categoryId) || defaultCat;
        const currency = sanitizeCurrency(body.currency);
        const dueDate = sanitizeDate(body.dueDate);
        const parsedDay = Number(body.dueDay || dueDate.split("-")[2] || 1);
        const dueDay = Math.min(31, Math.max(1, Math.trunc(parsedDay || 1)));
        const validFreqs = ["monthly", "yearly", "weekly"];
        const frequency = validFreqs.includes(body.frequency)
          ? body.frequency
          : "monthly";
        const isVariable = body.isVariable === true ? 1 : 0;
        const icon = sanitizeIcon(
          body.icon,
          itemType === "income" ? "cash-plus" : "calendar-sync",
        );
        const color = sanitizeColor(
          body.color,
          itemType === "income" ? "#17b26a" : "#e23d28",
        );
        const isActive = body.isActive === false ? 0 : 1;

        const id = crypto.randomUUID().replace(/-/g, "").slice(0, 16);

        await env.DB.prepare(
          `INSERT INTO recurring_expenses (id, user_id, type, account_id, category_id, name, amount, currency, due_date, due_day, frequency, is_variable, icon, color, is_active)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        )
          .bind(
            id,
            userId,
            itemType,
            accountId,
            categoryId,
            name,
            amount,
            currency,
            dueDate,
            dueDay,
            frequency,
            isVariable,
            icon,
            color,
            isActive,
          )
          .run();

        const created = await env.DB.prepare(
          `SELECT r.*, a.name AS account_name, a.color AS account_color
           FROM recurring_expenses r
           LEFT JOIN accounts a ON r.account_id = a.id AND a.user_id = r.user_id
           WHERE r.id = ? AND r.user_id = ?`,
        )
          .bind(id, userId)
          .first();

        return success(toCamelCaseRecurringExpense(created), 201);
      }

      if (
        path.startsWith("/recurring-expenses/") &&
        path.endsWith("/skip") &&
        method === "POST"
      ) {
        const id = sanitizeIdentifier(path.split("/")[2]);
        const row = await env.DB.prepare(
          "SELECT * FROM recurring_expenses WHERE id = ? AND user_id = ?",
        )
          .bind(id, userId)
          .first();
        if (!row) return error("Registro automático no encontrado", 404);

        const today = new Date().toISOString().slice(0, 10);
        const nextDueDate = computeNextDueDate(
          String(row.due_date || today),
          Number(row.due_day || 1),
          String(row.frequency || "monthly"),
          today,
        );

        await env.DB.prepare(
          `UPDATE recurring_expenses
           SET due_date = ?, updated_at = datetime('now')
           WHERE id = ? AND user_id = ?`,
        )
          .bind(nextDueDate, id, userId)
          .run();

        const updated = await env.DB.prepare(
          `SELECT r.*, a.name AS account_name, a.color AS account_color
           FROM recurring_expenses r
           LEFT JOIN accounts a ON r.account_id = a.id AND a.user_id = r.user_id
           WHERE r.id = ? AND r.user_id = ?`,
        )
          .bind(id, userId)
          .first();

        return success(toCamelCaseRecurringExpense(updated));
      }

      if (
        path.startsWith("/recurring-expenses/") &&
        path.endsWith("/pay") &&
        method === "POST"
      ) {
        const id = sanitizeIdentifier(path.split("/")[2]);
        const row = await env.DB.prepare(
          "SELECT * FROM recurring_expenses WHERE id = ? AND user_id = ?",
        )
          .bind(id, userId)
          .first();
        if (!row) return error("Registro automático no encontrado", 404);

        const ownsAccount = await verifyAccountOwnership(
          env.DB,
          row.account_id,
          userId,
        );
        if (!ownsAccount) {
          return error(
            "La cuenta asociada ya no existe. Edita el registro para elegir otra cuenta.",
            400,
          );
        }

        // Leer monto real opcional y flag para actualizar valor fijo
        let customAmount: number | null = null;
        let updateBaseAmount = false;
        let customNote: string | null = null;
        try {
          const parsed = await parseSafeJsonBody(request);
          if (parsed.ok && parsed.data) {
            if (parsed.data.amount !== undefined) {
              customAmount = sanitizeAmount(parsed.data.amount, false, false);
            }
            if (parsed.data.updateBaseAmount === true) {
              updateBaseAmount = true;
            }
            if (parsed.data.note) {
              customNote = sanitizeText(parsed.data.note, 250) || null;
            }
          }
        } catch {
          // Cuerpo vacío permitido
        }

        const effectiveAmount = customAmount ?? row.amount;
        const itemType = row.type === "income" ? "income" : "expense";
        const defaultCategory =
          itemType === "income" ? "cat-salary" : "cat-services";

        const txId = crypto.randomUUID().replace(/-/g, "").slice(0, 16);
        const today = new Date().toISOString().slice(0, 10);

        const nextDueDate = computeNextDueDate(
          String(row.due_date || today),
          Number(row.due_day || 1),
          String(row.frequency || "monthly"),
          today,
        );
        const nextBaseAmount =
          updateBaseAmount && customAmount !== null ? customAmount : row.amount;

        await env.DB.batch([
          env.DB.prepare(
            `INSERT INTO transactions (id, user_id, account_id, category_id, type, amount, currency, description, note, date)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          ).bind(
            txId,
            userId,
            row.account_id,
            row.category_id || defaultCategory,
            itemType,
            effectiveAmount,
            row.currency || "ARS",
            sanitizeText(
              `${itemType === "income" ? "Ingreso automático" : "Gasto automático"}: ${row.name}`,
              160,
            ),
            customNote ??
              (itemType === "income"
                ? "Acreditación de ingreso automático"
                : "Pago de gasto automático"),
            today,
          ),
          env.DB.prepare(
            `UPDATE recurring_expenses
             SET amount = ?, last_paid_date = ?, due_date = ?, updated_at = datetime('now')
             WHERE id = ? AND user_id = ?`,
          ).bind(nextBaseAmount, today, nextDueDate, id, userId),
        ]);

        const updated = await env.DB.prepare(
          `SELECT r.*, a.name AS account_name, a.color AS account_color
           FROM recurring_expenses r
           LEFT JOIN accounts a ON r.account_id = a.id AND a.user_id = r.user_id
           WHERE r.id = ? AND r.user_id = ?`,
        )
          .bind(id, userId)
          .first();

        return success(toCamelCaseRecurringExpense(updated));
      }

      if (path.startsWith("/recurring-expenses/") && method === "PATCH") {
        const id = sanitizeIdentifier(path.split("/")[2]);
        const parsed = await parseSafeJsonBody(request);
        if (!parsed.ok) return parsed.response;
        const body = parsed.data;

        const fields: string[] = [];
        const values: any[] = [];

        if (body.type !== undefined) {
          if (body.type === "income" || body.type === "expense") {
            fields.push("type = ?");
            values.push(body.type);
          }
        }
        if (body.name !== undefined) {
          const cleanName = sanitizeText(body.name, 80);
          if (!cleanName) return error("Nombre inválido", 400);
          fields.push("name = ?");
          values.push(cleanName);
        }
        if (body.amount !== undefined) {
          const amount = sanitizeAmount(body.amount, false, false);
          if (amount === null) return error("Costo inválido", 400);
          fields.push("amount = ?");
          values.push(amount);
        }
        if (body.accountId !== undefined) {
          const accountId = sanitizeIdentifier(body.accountId);
          const ownsAccount = await verifyAccountOwnership(
            env.DB,
            accountId,
            userId,
          );
          if (!ownsAccount) {
            return error("La cuenta seleccionada no te pertenece", 403);
          }
          fields.push("account_id = ?");
          values.push(accountId);
        }
        if (body.categoryId !== undefined) {
          fields.push("category_id = ?");
          values.push(sanitizeIdentifier(body.categoryId) || "cat-services");
        }
        if (body.currency !== undefined) {
          fields.push("currency = ?");
          values.push(sanitizeCurrency(body.currency));
        }
        if (body.dueDate !== undefined) {
          const cleanDate = sanitizeDate(body.dueDate);
          fields.push("due_date = ?");
          values.push(cleanDate);
          if (body.dueDay === undefined) {
            const autoDay = Math.min(
              31,
              Math.max(1, parseInt(cleanDate.split("-")[2] || "1", 10) || 1),
            );
            fields.push("due_day = ?");
            values.push(autoDay);
          }
        }
        if (body.dueDay !== undefined) {
          const dueDay = Math.min(
            31,
            Math.max(1, Math.trunc(Number(body.dueDay) || 1)),
          );
          fields.push("due_day = ?");
          values.push(dueDay);
        }
        if (body.frequency !== undefined) {
          const validFreqs = ["monthly", "yearly", "weekly"];
          if (validFreqs.includes(body.frequency)) {
            fields.push("frequency = ?");
            values.push(body.frequency);
          }
        }
        if (body.isVariable !== undefined) {
          fields.push("is_variable = ?");
          values.push(body.isVariable ? 1 : 0);
        }
        if (body.icon !== undefined) {
          fields.push("icon = ?");
          values.push(sanitizeIcon(body.icon, "calendar-sync"));
        }
        if (body.color !== undefined) {
          fields.push("color = ?");
          values.push(sanitizeColor(body.color));
        }
        if (body.isActive !== undefined) {
          fields.push("is_active = ?");
          values.push(body.isActive ? 1 : 0);
        }

        if (fields.length > 0) {
          fields.push("updated_at = datetime('now')");
          values.push(id, userId);
          await env.DB.prepare(
            `UPDATE recurring_expenses SET ${fields.join(", ")} WHERE id = ? AND user_id = ?`,
          )
            .bind(...values)
            .run();
        }

        const updated = await env.DB.prepare(
          `SELECT r.*, a.name AS account_name, a.color AS account_color
           FROM recurring_expenses r
           LEFT JOIN accounts a ON r.account_id = a.id AND a.user_id = r.user_id
           WHERE r.id = ? AND r.user_id = ?`,
        )
          .bind(id, userId)
          .first();
        if (!updated) return error("Gasto automático no encontrado", 404);
        return success(toCamelCaseRecurringExpense(updated));
      }

      if (path.startsWith("/recurring-expenses/") && method === "DELETE") {
        const id = sanitizeIdentifier(path.split("/")[2]);
        await env.DB.prepare(
          "DELETE FROM recurring_expenses WHERE id = ? AND user_id = ?",
        )
          .bind(id, userId)
          .run();
        return success(null);
      }

      // ─── SYSTEM STATS (Uso de BD y Usuarios) ───────────────────────────────
      if (path === "/stats" && method === "GET") {
        const statsRows = await env.DB.prepare(
          `SELECT
            (SELECT COUNT(DISTINCT user_id) FROM (
              SELECT user_id FROM accounts
              UNION
              SELECT user_id FROM transactions
              UNION
              SELECT user_id FROM savings_goals
            )) AS active_users,
            (SELECT COUNT(*) FROM accounts) AS total_accounts,
            (SELECT COUNT(*) FROM transactions) AS total_transactions,
            (SELECT COUNT(*) FROM savings_goals) AS total_goals`,
        ).all();

        const row: any = statsRows.results?.[0] || {};
        const activeUsers = Math.max(1, Number(row.active_users || 1));
        const totalAccounts = Number(row.total_accounts || 0);
        const totalTransactions = Number(row.total_transactions || 0);
        const totalGoals = Number(row.total_goals || 0);
        const dbSizeBytes =
          Number(statsRows.meta?.size_after) ||
          (totalAccounts + totalTransactions + totalGoals) * 512 + 32768;

        return success({
          activeUsers,
          totalAccounts,
          totalTransactions,
          totalGoals,
          dbSizeBytes,
          dbQuotaBytes: 5 * 1024 * 1024 * 1024, // 5 GB límite gratuito Cloudflare D1
        });
      }

      return error("Ruta no encontrada", 404);
    } catch {
      return error("Error interno al procesar la solicitud", 500);
    }
  },
};
