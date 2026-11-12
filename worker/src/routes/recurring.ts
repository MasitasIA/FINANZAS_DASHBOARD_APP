import { json, error, success } from "../lib/response";
import {
  sanitizeText,
  sanitizeIdentifier,
  sanitizeColor,
  sanitizeIcon,
  sanitizeCurrency,
  sanitizeAmount,
  sanitizeDate,
  sanitizeTime,
  parseSafeJsonBody,
} from "../lib/sanitize";
import { verifyAccountOwnership } from "../lib/rls";
import {
  toCamelCaseRecurringExpense,
  computeNextDueDate,
} from "../lib/formatters";
import type { Env, AuthenticatedUser } from "../types";

export async function handleRecurring(
  request: Request,
  env: Env,
  url: URL,
  user: AuthenticatedUser,
): Promise<Response> {
  const path = url.pathname;
  const method = request.method;
  const { userId } = user;

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

  return error("Ruta no encontrada", 404);
}

