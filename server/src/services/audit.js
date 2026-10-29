import { AuditLog } from '../models/index.js';

// Ghi nhật ký thao tác. Không bao giờ làm hỏng request chính (lỗi ghi log chỉ in ra console).
// opts: { entity, entityId, summary, before, after, changes, ok, actor }
const SECRET_FIELDS = new Set(['passwordHash', 'password', 'tokenVersion', 'vapid', 'privateKey', 'credential']);

export const clientIp = (req) => (req?.ip || req?.headers?.['x-forwarded-for'] || '').toString().split(',')[0].trim();

// So sánh nông 2 bản ghi → { field: [trước, sau] } (bỏ trường bí mật & trường hệ thống)
export function diff(before = {}, after = {}) {
  const out = {};
  const keys = new Set([...Object.keys(before ?? {}), ...Object.keys(after ?? {})]);
  for (const k of keys) {
    if (SECRET_FIELDS.has(k) || ['_id', '__v', 'createdAt', 'updatedAt'].includes(k)) continue;
    const a = JSON.stringify(before?.[k] ?? null);
    const b = JSON.stringify(after?.[k] ?? null);
    if (a !== b) out[k] = [short(before?.[k]), short(after?.[k])];
  }
  return Object.keys(out).length ? out : undefined;
}
const short = (v) => {
  const s = JSON.stringify(v ?? null);
  return s.length > 300 ? `${s.slice(0, 297)}…` : v ?? null;
};

export async function audit(req, action, opts = {}) {
  try {
    const actor = opts.actor ?? req?.user ?? null;
    await AuditLog.create({
      action,
      actor: actor?._id ?? null,
      actorEmail: actor?.email,
      actorRole: actor?.role,
      entity: opts.entity,
      entityId: opts.entityId ? String(opts.entityId) : undefined,
      summary: opts.summary?.slice(0, 300),
      changes: opts.changes ?? (opts.before || opts.after ? diff(opts.before, opts.after) : undefined),
      ok: opts.ok ?? true,
      ip: clientIp(req),
      ua: (req?.headers?.['user-agent'] ?? '').slice(0, 200),
    });
  } catch (e) {
    console.error('[audit]', action, e.message);
  }
}
