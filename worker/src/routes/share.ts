import { error, success } from "../lib/response";
import { sanitizeIdentifier, parseSafeJsonBody } from "../lib/sanitize";
import { generateShareInviteCode } from "../lib/formatters";
import type { Env, AuthenticatedUser } from "../types";

export async function handleShare(
  request: Request,
  env: Env,
  url: URL,
  user: AuthenticatedUser,
): Promise<Response> {
  const path = url.pathname;
  const method = request.method;
  const { userId, displayName: userDisplayName } = user;

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

  return error("Ruta no encontrada", 404);
}

