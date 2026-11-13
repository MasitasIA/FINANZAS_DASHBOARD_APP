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

    // Columnas de precisión en centavos enteros (INTEGER)
    const alterStatements = [
      "ALTER TABLE accounts ADD COLUMN balance_cents INTEGER NOT NULL DEFAULT 0",
      "ALTER TABLE accounts ADD COLUMN credit_limit_cents INTEGER",
      "ALTER TABLE transactions ADD COLUMN amount_cents INTEGER NOT NULL DEFAULT 0",
      "ALTER TABLE transactions ADD COLUMN installment_id TEXT",
      "ALTER TABLE transactions ADD COLUMN installment_number INTEGER",
      "ALTER TABLE transactions ADD COLUMN installments_total INTEGER",
      "ALTER TABLE savings_goals ADD COLUMN target_amount_cents INTEGER NOT NULL DEFAULT 0",
      "ALTER TABLE savings_goals ADD COLUMN current_amount_cents INTEGER NOT NULL DEFAULT 0",
      "ALTER TABLE recurring_expenses ADD COLUMN amount_cents INTEGER NOT NULL DEFAULT 0",
    ];

    for (const sql of alterStatements) {
      try {
        await db.prepare(sql).run();
      } catch {
        // Columna ya existe
      }
    }

    // Tablas de Tarjetas de Crédito: Compras en cuotas y Resúmenes
    await db.batch([
      db.prepare(
        `CREATE TABLE IF NOT EXISTS credit_card_installments (
          id                       TEXT    PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
          user_id                  TEXT    NOT NULL DEFAULT 'legacy',
          account_id               TEXT    NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
          transaction_id           TEXT    REFERENCES transactions(id) ON DELETE SET NULL,
          description              TEXT    NOT NULL,
          total_amount_cents       INTEGER NOT NULL CHECK (total_amount_cents > 0),
          cash_price_cents         INTEGER NOT NULL CHECK (cash_price_cents > 0),
          installments_count       INTEGER NOT NULL CHECK (installments_count > 1),
          installment_amount_cents INTEGER NOT NULL CHECK (installment_amount_cents > 0),
          first_due_date           TEXT    NOT NULL,
          status                   TEXT    NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'completed', 'cancelled')),
          created_at               TEXT    NOT NULL DEFAULT (datetime('now'))
        )`,
      ),
      db.prepare(
        `CREATE INDEX IF NOT EXISTS idx_installments_account ON credit_card_installments(account_id, status)`,
      ),
      db.prepare(
        `CREATE INDEX IF NOT EXISTS idx_installments_user ON credit_card_installments(user_id, status)`,
      ),
      db.prepare(
        `CREATE TABLE IF NOT EXISTS credit_card_statements (
          id                     TEXT    PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
          user_id                TEXT    NOT NULL DEFAULT 'legacy',
          account_id             TEXT    NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
          period_start           TEXT    NOT NULL,
          closing_date           TEXT    NOT NULL,
          due_date               TEXT    NOT NULL,
          previous_balance_cents INTEGER NOT NULL DEFAULT 0,
          charges_cents          INTEGER NOT NULL DEFAULT 0,
          installments_cents     INTEGER NOT NULL DEFAULT 0,
          interest_cents         INTEGER NOT NULL DEFAULT 0,
          total_due_cents        INTEGER NOT NULL,
          minimum_due_cents      INTEGER NOT NULL DEFAULT 0,
          paid_amount_cents      INTEGER NOT NULL DEFAULT 0,
          status                 TEXT    NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'closed', 'paid_partial', 'paid_full', 'overdue')),
          created_at             TEXT    NOT NULL DEFAULT (datetime('now')),
          updated_at             TEXT    NOT NULL DEFAULT (datetime('now'))
        )`,
      ),
      db.prepare(
        `CREATE INDEX IF NOT EXISTS idx_statements_account ON credit_card_statements(account_id, closing_date DESC)`,
      ),
      db.prepare(
        `CREATE INDEX IF NOT EXISTS idx_statements_user ON credit_card_statements(user_id, status)`,
      ),
      db.prepare(
        `CREATE TABLE IF NOT EXISTS budgets (
          id           TEXT    PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
          user_id      TEXT    NOT NULL DEFAULT 'legacy',
          category_id  TEXT    NOT NULL REFERENCES categories(id) ON DELETE CASCADE,
          currency     TEXT    NOT NULL DEFAULT 'ARS' CHECK (currency IN ('ARS','USD','EUR')),
          amount_cents INTEGER NOT NULL CHECK (amount_cents > 0),
          created_at   TEXT    NOT NULL DEFAULT (datetime('now')),
          updated_at   TEXT    NOT NULL DEFAULT (datetime('now')),
          UNIQUE(user_id, category_id, currency)
        )`,
      ),
      db.prepare(
        `CREATE INDEX IF NOT EXISTS idx_budgets_user ON budgets(user_id, currency)`,
      ),
    ]);

    // Inicializar centavos para registros existentes que aún tengan 0 o NULL
    try {
      await db.batch([
        db.prepare(
          "UPDATE accounts SET balance_cents = CAST(ROUND(balance * 100) AS INTEGER) WHERE balance_cents = 0 AND balance != 0",
        ),
        db.prepare(
          "UPDATE accounts SET credit_limit_cents = CAST(ROUND(credit_limit * 100) AS INTEGER) WHERE credit_limit_cents IS NULL AND credit_limit IS NOT NULL",
        ),
        db.prepare(
          "UPDATE transactions SET amount_cents = CAST(ROUND(amount * 100) AS INTEGER) WHERE amount_cents = 0 AND amount != 0",
        ),
        db.prepare(
          "UPDATE savings_goals SET target_amount_cents = CAST(ROUND(target_amount * 100) AS INTEGER) WHERE target_amount_cents = 0 AND target_amount != 0",
        ),
        db.prepare(
          "UPDATE savings_goals SET current_amount_cents = CAST(ROUND(current_amount * 100) AS INTEGER) WHERE current_amount_cents = 0 AND current_amount != 0",
        ),
        db.prepare(
          "UPDATE recurring_expenses SET amount_cents = CAST(ROUND(amount * 100) AS INTEGER) WHERE amount_cents = 0 AND amount != 0",
        ),
      ]);
    } catch {
      // Ignorar si las tablas aún no tienen datos
    }

    await db.batch([
      db.prepare("DROP TRIGGER IF EXISTS update_balance_after_insert"),
      db.prepare(
        `CREATE TRIGGER IF NOT EXISTS update_balance_after_insert
         AFTER INSERT ON transactions
         BEGIN
           UPDATE accounts
           SET balance_cents = COALESCE(balance_cents, CAST(ROUND(balance * 100) AS INTEGER)) + CASE
                 WHEN NEW.type = 'income'   THEN COALESCE(NEW.amount_cents, CAST(ROUND(NEW.amount * 100) AS INTEGER))
                 WHEN NEW.type = 'expense'  THEN -COALESCE(NEW.amount_cents, CAST(ROUND(NEW.amount * 100) AS INTEGER))
                 WHEN NEW.type = 'transfer' THEN -COALESCE(NEW.amount_cents, CAST(ROUND(NEW.amount * 100) AS INTEGER))
                 ELSE 0
               END,
               balance = (COALESCE(balance_cents, CAST(ROUND(balance * 100) AS INTEGER)) + CASE
                 WHEN NEW.type = 'income'   THEN COALESCE(NEW.amount_cents, CAST(ROUND(NEW.amount * 100) AS INTEGER))
                 WHEN NEW.type = 'expense'  THEN -COALESCE(NEW.amount_cents, CAST(ROUND(NEW.amount * 100) AS INTEGER))
                 WHEN NEW.type = 'transfer' THEN -COALESCE(NEW.amount_cents, CAST(ROUND(NEW.amount * 100) AS INTEGER))
                 ELSE 0
               END) / 100.0,
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
           SET balance_cents = COALESCE(balance_cents, CAST(ROUND(balance * 100) AS INTEGER)) + COALESCE(NEW.amount_cents, CAST(ROUND(NEW.amount * 100) AS INTEGER)),
               balance = (COALESCE(balance_cents, CAST(ROUND(balance * 100) AS INTEGER)) + COALESCE(NEW.amount_cents, CAST(ROUND(NEW.amount * 100) AS INTEGER))) / 100.0,
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
           SET current_amount_cents = MAX(0, COALESCE(current_amount_cents, CAST(ROUND(current_amount * 100) AS INTEGER)) + CASE
                 WHEN NEW.type IN ('expense', 'transfer') THEN COALESCE(NEW.amount_cents, CAST(ROUND(NEW.amount * 100) AS INTEGER))
                 WHEN NEW.type = 'income' AND NEW.category_id != 'cat-savings' THEN COALESCE(NEW.amount_cents, CAST(ROUND(NEW.amount * 100) AS INTEGER))
                 WHEN NEW.type = 'income' AND NEW.category_id = 'cat-savings' THEN -COALESCE(NEW.amount_cents, CAST(ROUND(NEW.amount * 100) AS INTEGER))
                 ELSE 0
               END),
               current_amount = MAX(0, COALESCE(current_amount_cents, CAST(ROUND(current_amount * 100) AS INTEGER)) + CASE
                 WHEN NEW.type IN ('expense', 'transfer') THEN COALESCE(NEW.amount_cents, CAST(ROUND(NEW.amount * 100) AS INTEGER))
                 WHEN NEW.type = 'income' AND NEW.category_id != 'cat-savings' THEN COALESCE(NEW.amount_cents, CAST(ROUND(NEW.amount * 100) AS INTEGER))
                 WHEN NEW.type = 'income' AND NEW.category_id = 'cat-savings' THEN -COALESCE(NEW.amount_cents, CAST(ROUND(NEW.amount * 100) AS INTEGER))
                 ELSE 0
               END) / 100.0,
               status = CASE
                 WHEN (COALESCE(current_amount_cents, CAST(ROUND(current_amount * 100) AS INTEGER)) + CASE
                   WHEN NEW.type IN ('expense', 'transfer') THEN COALESCE(NEW.amount_cents, CAST(ROUND(NEW.amount * 100) AS INTEGER))
                   WHEN NEW.type = 'income' AND NEW.category_id != 'cat-savings' THEN COALESCE(NEW.amount_cents, CAST(ROUND(NEW.amount * 100) AS INTEGER))
                   WHEN NEW.type = 'income' AND NEW.category_id = 'cat-savings' THEN -COALESCE(NEW.amount_cents, CAST(ROUND(NEW.amount * 100) AS INTEGER))
                   ELSE 0
                 END) >= COALESCE(target_amount_cents, CAST(ROUND(target_amount * 100) AS INTEGER)) THEN 'completed'
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
           SET balance_cents = COALESCE(balance_cents, CAST(ROUND(balance * 100) AS INTEGER)) - CASE
                 WHEN OLD.type = 'income'   THEN COALESCE(OLD.amount_cents, CAST(ROUND(OLD.amount * 100) AS INTEGER))
                 WHEN OLD.type = 'expense'  THEN -COALESCE(OLD.amount_cents, CAST(ROUND(OLD.amount * 100) AS INTEGER))
                 WHEN OLD.type = 'transfer' THEN -COALESCE(OLD.amount_cents, CAST(ROUND(OLD.amount * 100) AS INTEGER))
                 ELSE 0
               END,
               balance = (COALESCE(balance_cents, CAST(ROUND(balance * 100) AS INTEGER)) - CASE
                 WHEN OLD.type = 'income'   THEN COALESCE(OLD.amount_cents, CAST(ROUND(OLD.amount * 100) AS INTEGER))
                 WHEN OLD.type = 'expense'  THEN -COALESCE(OLD.amount_cents, CAST(ROUND(OLD.amount * 100) AS INTEGER))
                 WHEN OLD.type = 'transfer' THEN -COALESCE(OLD.amount_cents, CAST(ROUND(OLD.amount * 100) AS INTEGER))
                 ELSE 0
               END) / 100.0,
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
           SET balance_cents = COALESCE(balance_cents, CAST(ROUND(balance * 100) AS INTEGER)) - COALESCE(OLD.amount_cents, CAST(ROUND(OLD.amount * 100) AS INTEGER)),
               balance = (COALESCE(balance_cents, CAST(ROUND(balance * 100) AS INTEGER)) - COALESCE(OLD.amount_cents, CAST(ROUND(OLD.amount * 100) AS INTEGER))) / 100.0,
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
           SET current_amount_cents = MAX(0, COALESCE(current_amount_cents, CAST(ROUND(current_amount * 100) AS INTEGER)) - CASE
                 WHEN OLD.type IN ('expense', 'transfer') THEN COALESCE(OLD.amount_cents, CAST(ROUND(OLD.amount * 100) AS INTEGER))
                 WHEN OLD.type = 'income' AND OLD.category_id != 'cat-savings' THEN COALESCE(OLD.amount_cents, CAST(ROUND(OLD.amount * 100) AS INTEGER))
                 WHEN OLD.type = 'income' AND OLD.category_id = 'cat-savings' THEN -COALESCE(OLD.amount_cents, CAST(ROUND(OLD.amount * 100) AS INTEGER))
                 ELSE 0
               END),
               current_amount = MAX(0, COALESCE(current_amount_cents, CAST(ROUND(current_amount * 100) AS INTEGER)) - CASE
                 WHEN OLD.type IN ('expense', 'transfer') THEN COALESCE(OLD.amount_cents, CAST(ROUND(OLD.amount * 100) AS INTEGER))
                 WHEN OLD.type = 'income' AND OLD.category_id != 'cat-savings' THEN COALESCE(OLD.amount_cents, CAST(ROUND(OLD.amount * 100) AS INTEGER))
                 WHEN OLD.type = 'income' AND OLD.category_id = 'cat-savings' THEN -COALESCE(OLD.amount_cents, CAST(ROUND(OLD.amount * 100) AS INTEGER))
                 ELSE 0
               END) / 100.0,
               status = CASE
                 WHEN (COALESCE(current_amount_cents, CAST(ROUND(current_amount * 100) AS INTEGER)) - CASE
                   WHEN OLD.type IN ('expense', 'transfer') THEN COALESCE(OLD.amount_cents, CAST(ROUND(OLD.amount * 100) AS INTEGER))
                   WHEN OLD.type = 'income' AND OLD.category_id != 'cat-savings' THEN COALESCE(OLD.amount_cents, CAST(ROUND(OLD.amount * 100) AS INTEGER))
                   WHEN OLD.type = 'income' AND OLD.category_id = 'cat-savings' THEN -COALESCE(OLD.amount_cents, CAST(ROUND(OLD.amount * 100) AS INTEGER))
                   ELSE 0
                 END) >= COALESCE(target_amount_cents, CAST(ROUND(target_amount * 100) AS INTEGER)) THEN 'completed'
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
           -- Revertir valores antiguos (OLD)
           UPDATE accounts
           SET balance_cents = COALESCE(balance_cents, CAST(ROUND(balance * 100) AS INTEGER)) - CASE
                 WHEN OLD.type = 'income'   THEN COALESCE(OLD.amount_cents, CAST(ROUND(OLD.amount * 100) AS INTEGER))
                 WHEN OLD.type = 'expense'  THEN -COALESCE(OLD.amount_cents, CAST(ROUND(OLD.amount * 100) AS INTEGER))
                 WHEN OLD.type = 'transfer' THEN -COALESCE(OLD.amount_cents, CAST(ROUND(OLD.amount * 100) AS INTEGER))
                 ELSE 0
               END,
               balance = (COALESCE(balance_cents, CAST(ROUND(balance * 100) AS INTEGER)) - CASE
                 WHEN OLD.type = 'income'   THEN COALESCE(OLD.amount_cents, CAST(ROUND(OLD.amount * 100) AS INTEGER))
                 WHEN OLD.type = 'expense'  THEN -COALESCE(OLD.amount_cents, CAST(ROUND(OLD.amount * 100) AS INTEGER))
                 WHEN OLD.type = 'transfer' THEN -COALESCE(OLD.amount_cents, CAST(ROUND(OLD.amount * 100) AS INTEGER))
                 ELSE 0
               END) / 100.0,
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
           SET balance_cents = COALESCE(balance_cents, CAST(ROUND(balance * 100) AS INTEGER)) - COALESCE(OLD.amount_cents, CAST(ROUND(OLD.amount * 100) AS INTEGER)),
               balance = (COALESCE(balance_cents, CAST(ROUND(balance * 100) AS INTEGER)) - COALESCE(OLD.amount_cents, CAST(ROUND(OLD.amount * 100) AS INTEGER))) / 100.0,
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
           SET current_amount_cents = MAX(0, COALESCE(current_amount_cents, CAST(ROUND(current_amount * 100) AS INTEGER)) - CASE
                 WHEN OLD.type IN ('expense', 'transfer') THEN COALESCE(OLD.amount_cents, CAST(ROUND(OLD.amount * 100) AS INTEGER))
                 WHEN OLD.type = 'income' AND OLD.category_id != 'cat-savings' THEN COALESCE(OLD.amount_cents, CAST(ROUND(OLD.amount * 100) AS INTEGER))
                 WHEN OLD.type = 'income' AND OLD.category_id = 'cat-savings' THEN -COALESCE(OLD.amount_cents, CAST(ROUND(OLD.amount * 100) AS INTEGER))
                 ELSE 0
               END),
               current_amount = MAX(0, COALESCE(current_amount_cents, CAST(ROUND(current_amount * 100) AS INTEGER)) - CASE
                 WHEN OLD.type IN ('expense', 'transfer') THEN COALESCE(OLD.amount_cents, CAST(ROUND(OLD.amount * 100) AS INTEGER))
                 WHEN OLD.type = 'income' AND OLD.category_id != 'cat-savings' THEN COALESCE(OLD.amount_cents, CAST(ROUND(OLD.amount * 100) AS INTEGER))
                 WHEN OLD.type = 'income' AND OLD.category_id = 'cat-savings' THEN -COALESCE(OLD.amount_cents, CAST(ROUND(OLD.amount * 100) AS INTEGER))
                 ELSE 0
               END) / 100.0,
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

           -- Aplicar nuevos valores (NEW)
           UPDATE accounts
           SET balance_cents = COALESCE(balance_cents, CAST(ROUND(balance * 100) AS INTEGER)) + CASE
                 WHEN NEW.type = 'income'   THEN COALESCE(NEW.amount_cents, CAST(ROUND(NEW.amount * 100) AS INTEGER))
                 WHEN NEW.type = 'expense'  THEN -COALESCE(NEW.amount_cents, CAST(ROUND(NEW.amount * 100) AS INTEGER))
                 WHEN NEW.type = 'transfer' THEN -COALESCE(NEW.amount_cents, CAST(ROUND(NEW.amount * 100) AS INTEGER))
                 ELSE 0
               END,
               balance = (COALESCE(balance_cents, CAST(ROUND(balance * 100) AS INTEGER)) + CASE
                 WHEN NEW.type = 'income'   THEN COALESCE(NEW.amount_cents, CAST(ROUND(NEW.amount * 100) AS INTEGER))
                 WHEN NEW.type = 'expense'  THEN -COALESCE(NEW.amount_cents, CAST(ROUND(NEW.amount * 100) AS INTEGER))
                 WHEN NEW.type = 'transfer' THEN -COALESCE(NEW.amount_cents, CAST(ROUND(NEW.amount * 100) AS INTEGER))
                 ELSE 0
               END) / 100.0,
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
           SET balance_cents = COALESCE(balance_cents, CAST(ROUND(balance * 100) AS INTEGER)) + COALESCE(NEW.amount_cents, CAST(ROUND(NEW.amount * 100) AS INTEGER)),
               balance = (COALESCE(balance_cents, CAST(ROUND(balance * 100) AS INTEGER)) + COALESCE(NEW.amount_cents, CAST(ROUND(NEW.amount * 100) AS INTEGER))) / 100.0,
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
           SET current_amount_cents = MAX(0, COALESCE(current_amount_cents, CAST(ROUND(current_amount * 100) AS INTEGER)) + CASE
                 WHEN NEW.type IN ('expense', 'transfer') THEN COALESCE(NEW.amount_cents, CAST(ROUND(NEW.amount * 100) AS INTEGER))
                 WHEN NEW.type = 'income' AND NEW.category_id != 'cat-savings' THEN COALESCE(NEW.amount_cents, CAST(ROUND(NEW.amount * 100) AS INTEGER))
                 WHEN NEW.type = 'income' AND NEW.category_id = 'cat-savings' THEN -COALESCE(NEW.amount_cents, CAST(ROUND(NEW.amount * 100) AS INTEGER))
                 ELSE 0
               END),
               current_amount = MAX(0, COALESCE(current_amount_cents, CAST(ROUND(current_amount * 100) AS INTEGER)) + CASE
                 WHEN NEW.type IN ('expense', 'transfer') THEN COALESCE(NEW.amount_cents, CAST(ROUND(NEW.amount * 100) AS INTEGER))
                 WHEN NEW.type = 'income' AND NEW.category_id != 'cat-savings' THEN COALESCE(NEW.amount_cents, CAST(ROUND(NEW.amount * 100) AS INTEGER))
                 WHEN NEW.type = 'income' AND NEW.category_id = 'cat-savings' THEN -COALESCE(NEW.amount_cents, CAST(ROUND(NEW.amount * 100) AS INTEGER))
                 ELSE 0
               END) / 100.0,
               status = CASE
                 WHEN (COALESCE(current_amount_cents, CAST(ROUND(current_amount * 100) AS INTEGER)) + CASE
                   WHEN NEW.type IN ('expense', 'transfer') THEN COALESCE(NEW.amount_cents, CAST(ROUND(NEW.amount * 100) AS INTEGER))
                   WHEN NEW.type = 'income' AND NEW.category_id != 'cat-savings' THEN COALESCE(NEW.amount_cents, CAST(ROUND(NEW.amount * 100) AS INTEGER))
                   WHEN NEW.type = 'income' AND NEW.category_id = 'cat-savings' THEN -COALESCE(NEW.amount_cents, CAST(ROUND(NEW.amount * 100) AS INTEGER))
                   ELSE 0
                 END) >= COALESCE(target_amount_cents, CAST(ROUND(target_amount * 100) AS INTEGER)) THEN 'completed'
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

