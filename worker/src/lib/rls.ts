import type { D1DatabaseType } from "../types";

export async function verifyAccountOwnership(
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

export async function verifyGoalOwnership(
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

let legacyAlreadyClaimed = false;
let sharedSchemaInitialized = false;

export async function ensureSharedSchema(db: D1DatabaseType): Promise<void> {
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

export async function claimLegacyDataIfAny(
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

