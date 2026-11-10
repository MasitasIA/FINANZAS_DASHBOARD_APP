/**
 * Cloudflare D1 — esquema SQL inicial
 */

-- ── Cuentas ──────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS accounts (
  id           TEXT    PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  user_id      TEXT    NOT NULL DEFAULT 'legacy',
  name         TEXT    NOT NULL,
  type         TEXT    NOT NULL CHECK (type IN ('checking','savings','investment','cash','credit')),
  currency     TEXT    NOT NULL DEFAULT 'ARS' CHECK (currency IN ('ARS','USD','EUR')),
  balance      REAL    NOT NULL DEFAULT 0,
  color        TEXT    NOT NULL DEFAULT '#e23d28',
  icon         TEXT    NOT NULL DEFAULT 'wallet',
  credit_limit REAL,
  closing_day  INTEGER CHECK (closing_day BETWEEN 1 AND 31),
  due_day      INTEGER CHECK (due_day BETWEEN 1 AND 31),
  created_at   TEXT    NOT NULL DEFAULT (datetime('now')),
  updated_at   TEXT    NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_accounts_user ON accounts(user_id);

-- ── Categorías ───────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS categories (
  id          TEXT    PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  name        TEXT    NOT NULL,
  icon        TEXT    NOT NULL DEFAULT 'tag',
  color       TEXT    NOT NULL DEFAULT '#e23d28',
  type        TEXT    NOT NULL CHECK (type IN ('income','expense','transfer')),
  is_default  INTEGER NOT NULL DEFAULT 0
);

-- ── Categorías por defecto ───────────────────────────────────────────────────
INSERT OR IGNORE INTO categories (id, name, icon, color, type, is_default) VALUES
  ('cat-leisure',         'Ocio',              'gamepad-variant',  '#c084fc', 'expense',  1),
  ('cat-services',        'Servicios',         'lightning-bolt',   '#fdb022', 'expense',  1),
  ('cat-studies',         'Estudios',          'school',           '#06aed4', 'expense',  1),
  ('cat-food',            'Comida',            'food-fork-drink',  '#f97066', 'expense',  1),
  ('cat-transport',       'Transporte',        'car',              '#8098f9', 'expense',  1),
  ('cat-health',          'Salud',             'heart-pulse',      '#47cd89', 'expense',  1),
  ('cat-housing',         'Vivienda',          'home',             '#f86a58', 'expense',  1),
  ('cat-other-exp',       'Otros',             'dots-horizontal',  '#68615e', 'expense',  0),
  ('cat-salary',          'Trabajo',           'briefcase',        '#17b26a', 'income',   1),
  ('cat-grant',           'Beca',              'school',           '#06aed4', 'income',   1),
  ('cat-contribution',    'Aporte',            'hand-coin',        '#9e77ed', 'income',   1),
  ('cat-pension',         'Pensión',           'shield-account',   '#8098f9', 'income',   1),
  ('cat-freelance',       'Freelance',         'laptop',           '#e23d28', 'income',   1),
  ('cat-investment',      'Inversión',         'chart-line',       '#47cd89', 'income',   1),
  ('cat-yield',           'Rendimientos',      'trending-up',      '#34d399', 'income',   1),
  ('cat-other-inc',       'Otros',             'cash-plus',        '#68615e', 'income',   0),
  ('cat-transfer',        'Entre cuentas',     'swap-horizontal',  '#9ea4c1', 'transfer', 1),
  ('cat-card-payment',    'Pago de tarjeta',   'credit-card-check','#ec4899', 'transfer', 1),
  ('cat-family-transfer', 'Aporte familiar',   'account-group',    '#9e77ed', 'transfer', 1),
  ('cat-savings',         'Ahorro',            'piggy-bank',       '#17b26a', 'transfer', 1);

-- ── Transacciones ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS transactions (
  id            TEXT    PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  user_id       TEXT    NOT NULL DEFAULT 'legacy',
  author_name   TEXT,
  account_id    TEXT    NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  category_id   TEXT    NOT NULL REFERENCES categories(id),
  type          TEXT    NOT NULL CHECK (type IN ('income','expense','transfer')),
  amount        REAL    NOT NULL CHECK (amount > 0),
  currency      TEXT    NOT NULL DEFAULT 'ARS',
  description   TEXT    NOT NULL DEFAULT '',
  note          TEXT,
  date          TEXT    NOT NULL DEFAULT (date('now')),
  to_account_id TEXT    REFERENCES accounts(id),
  goal_id       TEXT    REFERENCES savings_goals(id) ON DELETE SET NULL,
  created_at    TEXT    NOT NULL DEFAULT (datetime('now')),
  updated_at    TEXT    NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_transactions_user    ON transactions(user_id, date DESC);
CREATE INDEX IF NOT EXISTS idx_transactions_account ON transactions(account_id);
CREATE INDEX IF NOT EXISTS idx_transactions_date    ON transactions(date DESC);
CREATE INDEX IF NOT EXISTS idx_transactions_type    ON transactions(type);
CREATE INDEX IF NOT EXISTS idx_transactions_goal    ON transactions(goal_id);

-- ── Metas de ahorro ───────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS savings_goals (
  id             TEXT    PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  user_id        TEXT    NOT NULL DEFAULT 'legacy',
  name           TEXT    NOT NULL,
  target_amount  REAL    NOT NULL CHECK (target_amount > 0),
  current_amount REAL    NOT NULL DEFAULT 0,
  currency       TEXT    NOT NULL DEFAULT 'ARS',
  deadline       TEXT,
  icon           TEXT    NOT NULL DEFAULT 'piggy-bank',
  color          TEXT    NOT NULL DEFAULT '#e23d28',
  status         TEXT    NOT NULL DEFAULT 'active' CHECK (status IN ('active','completed','paused')),
  created_at     TEXT    NOT NULL DEFAULT (datetime('now')),
  updated_at     TEXT    NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_goals_user ON savings_goals(user_id);

-- ── Gastos e Ingresos Automáticos / Recurrentes (Tabla especial por usuario) ──
CREATE TABLE IF NOT EXISTS recurring_expenses (
  id             TEXT    PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  user_id        TEXT    NOT NULL DEFAULT 'legacy',
  type           TEXT    NOT NULL DEFAULT 'expense' CHECK (type IN ('expense','income')),
  account_id     TEXT    NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  category_id    TEXT    NOT NULL DEFAULT 'cat-services' REFERENCES categories(id),
  name           TEXT    NOT NULL,
  amount         REAL    NOT NULL CHECK (amount > 0),
  currency       TEXT    NOT NULL DEFAULT 'ARS' CHECK (currency IN ('ARS','USD','EUR')),
  due_date       TEXT    NOT NULL DEFAULT (date('now')),
  due_day        INTEGER NOT NULL DEFAULT 1 CHECK (due_day BETWEEN 1 AND 31),
  frequency      TEXT    NOT NULL DEFAULT 'monthly' CHECK (frequency IN ('monthly','yearly','weekly')),
  is_variable    INTEGER NOT NULL DEFAULT 0,
  icon           TEXT    NOT NULL DEFAULT 'calendar-sync',
  color          TEXT    NOT NULL DEFAULT '#e23d28',
  is_active      INTEGER NOT NULL DEFAULT 1,
  last_paid_date TEXT,
  created_at     TEXT    NOT NULL DEFAULT (datetime('now')),
  updated_at     TEXT    NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_recurring_expenses_user ON recurring_expenses(user_id, due_day ASC);

-- ── Configuración especial por usuario (Hora de aviso para montos variables) ──
CREATE TABLE IF NOT EXISTS user_settings (
  user_id       TEXT PRIMARY KEY,
  reminder_time TEXT NOT NULL DEFAULT '09:00',
  updated_at    TEXT NOT NULL DEFAULT (datetime('now'))
);

-- ── Cuentas y Metas Compartidas (Miembros e Invitaciones) ─────────────────────
CREATE TABLE IF NOT EXISTS shared_members (
  id            TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  resource_type TEXT NOT NULL CHECK (resource_type IN ('account', 'goal')),
  resource_id   TEXT NOT NULL,
  owner_id      TEXT NOT NULL,
  user_id       TEXT NOT NULL,
  display_name  TEXT NOT NULL DEFAULT 'Usuario',
  role          TEXT NOT NULL DEFAULT 'editor' CHECK (role IN ('owner', 'editor')),
  created_at    TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE(resource_type, resource_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_shared_members_user     ON shared_members(user_id, resource_type);
CREATE INDEX IF NOT EXISTS idx_shared_members_resource ON shared_members(resource_type, resource_id);

CREATE TABLE IF NOT EXISTS share_invites (
  code          TEXT PRIMARY KEY,
  resource_type TEXT NOT NULL CHECK (resource_type IN ('account', 'goal')),
  resource_id   TEXT NOT NULL,
  owner_id      TEXT NOT NULL,
  owner_name    TEXT NOT NULL DEFAULT 'Propietario',
  expires_at    TEXT NOT NULL,
  created_at    TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_share_invites_resource ON share_invites(resource_type, resource_id);

-- ── Cuenta técnica del sistema para ingresos directos a metas ─────────────────
INSERT OR IGNORE INTO accounts (id, user_id, name, type, currency, balance, color, icon)
VALUES ('direct-goal', 'system', 'Ingreso directo a meta', 'savings', 'ARS', 0, '#17b26a', 'piggy-bank');

-- ── Triggers: actualizar balance en cuentas y metas (con soporte para recursos compartidos e ingresos directos a metas) ──

-- 1. Al insertar transacción
DROP TRIGGER IF EXISTS update_balance_after_insert;
CREATE TRIGGER IF NOT EXISTS update_balance_after_insert
AFTER INSERT ON transactions
BEGIN
  -- Actualiza balance en cuenta origen (si pertenece al usuario o es miembro compartido, ignorando ingresos directos a metas)
  UPDATE accounts
  SET    balance    = balance + CASE
                                  WHEN NEW.type = 'income'   THEN NEW.amount
                                  WHEN NEW.type = 'expense'  THEN -NEW.amount
                                  WHEN NEW.type = 'transfer' THEN -NEW.amount
                                  ELSE 0
                                END,
         updated_at = datetime('now')
  WHERE  id = NEW.account_id
    AND  id != 'direct-goal'
    AND  (
      user_id = NEW.user_id
      OR EXISTS (
        SELECT 1 FROM shared_members sm
        WHERE sm.resource_type = 'account' AND sm.resource_id = accounts.id AND sm.user_id = NEW.user_id
      )
    );

  -- Si es transferencia, acredita en la cuenta destino (si pertenece al usuario o es miembro compartido)
  UPDATE accounts
  SET    balance    = balance + NEW.amount,
         updated_at = datetime('now')
  WHERE  id = NEW.to_account_id
    AND  NEW.to_account_id IS NOT NULL
    AND  NEW.type = 'transfer'
    AND  (
      user_id = NEW.user_id
      OR EXISTS (
        SELECT 1 FROM shared_members sm
        WHERE sm.resource_type = 'account' AND sm.resource_id = accounts.id AND sm.user_id = NEW.user_id
      )
    );

  -- Si está vinculada a una meta de ahorro:
  -- • Aporte desde cuenta (type IN ('expense', 'transfer')) -> suma a la meta (+NEW.amount)
  -- • Ingreso directo a meta (type = 'income' AND category_id != 'cat-savings') -> suma a la meta (+NEW.amount)
  -- • Retiro desde meta hacia cuenta (type = 'income' AND category_id = 'cat-savings') -> resta de la meta (-NEW.amount)
  UPDATE savings_goals
  SET    current_amount = MAX(0, current_amount + CASE
                                                    WHEN NEW.type IN ('expense', 'transfer') THEN NEW.amount
                                                    WHEN NEW.type = 'income' AND NEW.category_id != 'cat-savings' THEN NEW.amount
                                                    WHEN NEW.type = 'income' AND NEW.category_id = 'cat-savings' THEN -NEW.amount
                                                    ELSE 0
                                                  END),
         status         = CASE
                            WHEN (current_amount + CASE
                                                    WHEN NEW.type IN ('expense', 'transfer') THEN NEW.amount
                                                    WHEN NEW.type = 'income' AND NEW.category_id != 'cat-savings' THEN NEW.amount
                                                    WHEN NEW.type = 'income' AND NEW.category_id = 'cat-savings' THEN -NEW.amount
                                                    ELSE 0
                                                  END) >= target_amount THEN 'completed'
                            ELSE 'active'
                          END,
         updated_at     = datetime('now')
  WHERE  id = NEW.goal_id
    AND  NEW.goal_id IS NOT NULL
    AND  (
      user_id = NEW.user_id
      OR EXISTS (
        SELECT 1 FROM shared_members sm
        WHERE sm.resource_type = 'goal' AND sm.resource_id = savings_goals.id AND sm.user_id = NEW.user_id
      )
    );
END;

-- 2. Al eliminar transacción (reversión de saldos con soporte para recursos compartidos e ingresos directos a metas)
DROP TRIGGER IF EXISTS update_balance_after_delete;
CREATE TRIGGER IF NOT EXISTS update_balance_after_delete
AFTER DELETE ON transactions
BEGIN
  -- Revierte el impacto en la cuenta origen
  UPDATE accounts
  SET    balance    = balance - CASE
                                  WHEN OLD.type = 'income'   THEN OLD.amount
                                  WHEN OLD.type = 'expense'  THEN -OLD.amount
                                  WHEN OLD.type = 'transfer' THEN -OLD.amount
                                  ELSE 0
                                END,
         updated_at = datetime('now')
  WHERE  id = OLD.account_id
    AND  id != 'direct-goal'
    AND  (
      user_id = OLD.user_id
      OR EXISTS (
        SELECT 1 FROM shared_members sm
        WHERE sm.resource_type = 'account' AND sm.resource_id = accounts.id AND sm.user_id = OLD.user_id
      )
    );

  -- Si era transferencia, descuenta de la cuenta destino
  UPDATE accounts
  SET    balance    = balance - OLD.amount,
         updated_at = datetime('now')
  WHERE  id = OLD.to_account_id
    AND  OLD.to_account_id IS NOT NULL
    AND  OLD.type = 'transfer'
    AND  (
      user_id = OLD.user_id
      OR EXISTS (
        SELECT 1 FROM shared_members sm
        WHERE sm.resource_type = 'account' AND sm.resource_id = accounts.id AND sm.user_id = OLD.user_id
      )
    );

  -- Si estaba vinculada a una meta, revierte el impacto en la meta
  UPDATE savings_goals
  SET    current_amount = MAX(0, current_amount - CASE
                                                    WHEN OLD.type IN ('expense', 'transfer') THEN OLD.amount
                                                    WHEN OLD.type = 'income' AND OLD.category_id != 'cat-savings' THEN OLD.amount
                                                    WHEN OLD.type = 'income' AND OLD.category_id = 'cat-savings' THEN -OLD.amount
                                                    ELSE 0
                                                  END),
         status         = CASE
                            WHEN (current_amount - CASE
                                                    WHEN OLD.type IN ('expense', 'transfer') THEN OLD.amount
                                                    WHEN OLD.type = 'income' AND OLD.category_id != 'cat-savings' THEN OLD.amount
                                                    WHEN OLD.type = 'income' AND OLD.category_id = 'cat-savings' THEN -OLD.amount
                                                    ELSE 0
                                                  END) >= target_amount THEN 'completed'
                            ELSE 'active'
                          END,
         updated_at     = datetime('now')
  WHERE  id = OLD.goal_id
    AND  OLD.goal_id IS NOT NULL
    AND  (
      user_id = OLD.user_id
      OR EXISTS (
        SELECT 1 FROM shared_members sm
        WHERE sm.resource_type = 'goal' AND sm.resource_id = savings_goals.id AND sm.user_id = OLD.user_id
      )
    );
END;

-- 3. Al actualizar transacción (con soporte para recursos compartidos e ingresos directos a metas)
DROP TRIGGER IF EXISTS update_balance_after_update;
CREATE TRIGGER IF NOT EXISTS update_balance_after_update
AFTER UPDATE ON transactions
BEGIN
  -- Revertir valores antiguos (OLD)
  UPDATE accounts
  SET    balance    = balance - CASE
                                  WHEN OLD.type = 'income'   THEN OLD.amount
                                  WHEN OLD.type = 'expense'  THEN -OLD.amount
                                  WHEN OLD.type = 'transfer' THEN -OLD.amount
                                  ELSE 0
                                END,
         updated_at = datetime('now')
  WHERE  id = OLD.account_id
    AND  id != 'direct-goal'
    AND  (
      user_id = OLD.user_id
      OR EXISTS (
        SELECT 1 FROM shared_members sm
        WHERE sm.resource_type = 'account' AND sm.resource_id = accounts.id AND sm.user_id = OLD.user_id
      )
    );

  UPDATE accounts
  SET    balance    = balance - OLD.amount,
         updated_at = datetime('now')
  WHERE  id = OLD.to_account_id
    AND  OLD.to_account_id IS NOT NULL
    AND  OLD.type = 'transfer'
    AND  (
      user_id = OLD.user_id
      OR EXISTS (
        SELECT 1 FROM shared_members sm
        WHERE sm.resource_type = 'account' AND sm.resource_id = accounts.id AND sm.user_id = OLD.user_id
      )
    );

  UPDATE savings_goals
  SET    current_amount = MAX(0, current_amount - CASE
                                                    WHEN OLD.type IN ('expense', 'transfer') THEN OLD.amount
                                                    WHEN OLD.type = 'income' AND OLD.category_id != 'cat-savings' THEN OLD.amount
                                                    WHEN OLD.type = 'income' AND OLD.category_id = 'cat-savings' THEN -OLD.amount
                                                    ELSE 0
                                                  END),
         updated_at     = datetime('now')
  WHERE  id = OLD.goal_id
    AND  OLD.goal_id IS NOT NULL
    AND  (
      user_id = OLD.user_id
      OR EXISTS (
        SELECT 1 FROM shared_members sm
        WHERE sm.resource_type = 'goal' AND sm.resource_id = savings_goals.id AND sm.user_id = OLD.user_id
      )
    );

  -- Aplicar nuevos valores (NEW)
  UPDATE accounts
  SET    balance    = balance + CASE
                                  WHEN NEW.type = 'income'   THEN NEW.amount
                                  WHEN NEW.type = 'expense'  THEN -NEW.amount
                                  WHEN NEW.type = 'transfer' THEN -NEW.amount
                                  ELSE 0
                                END,
         updated_at = datetime('now')
  WHERE  id = NEW.account_id
    AND  id != 'direct-goal'
    AND  (
      user_id = NEW.user_id
      OR EXISTS (
        SELECT 1 FROM shared_members sm
        WHERE sm.resource_type = 'account' AND sm.resource_id = accounts.id AND sm.user_id = NEW.user_id
      )
    );

  UPDATE accounts
  SET    balance    = balance + NEW.amount,
         updated_at = datetime('now')
  WHERE  id = NEW.to_account_id
    AND  NEW.to_account_id IS NOT NULL
    AND  NEW.type = 'transfer'
    AND  (
      user_id = NEW.user_id
      OR EXISTS (
        SELECT 1 FROM shared_members sm
        WHERE sm.resource_type = 'account' AND sm.resource_id = accounts.id AND sm.user_id = NEW.user_id
      )
    );

  UPDATE savings_goals
  SET    current_amount = MAX(0, current_amount + CASE
                                                    WHEN NEW.type IN ('expense', 'transfer') THEN NEW.amount
                                                    WHEN NEW.type = 'income' AND NEW.category_id != 'cat-savings' THEN NEW.amount
                                                    WHEN NEW.type = 'income' AND NEW.category_id = 'cat-savings' THEN -NEW.amount
                                                    ELSE 0
                                                  END),
         status         = CASE
                            WHEN (current_amount + CASE
                                                    WHEN NEW.type IN ('expense', 'transfer') THEN NEW.amount
                                                    WHEN NEW.type = 'income' AND NEW.category_id != 'cat-savings' THEN NEW.amount
                                                    WHEN NEW.type = 'income' AND NEW.category_id = 'cat-savings' THEN -NEW.amount
                                                    ELSE 0
                                                  END) >= target_amount THEN 'completed'
                            ELSE 'active'
                          END,
         updated_at     = datetime('now')
  WHERE  id = NEW.goal_id
    AND  NEW.goal_id IS NOT NULL
    AND  (
      user_id = NEW.user_id
      OR EXISTS (
        SELECT 1 FROM shared_members sm
        WHERE sm.resource_type = 'goal' AND sm.resource_id = savings_goals.id AND sm.user_id = NEW.user_id
      )
    );
END;

