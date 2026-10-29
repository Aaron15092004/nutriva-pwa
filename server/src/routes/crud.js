import { Router } from 'express';
import { ah, HttpError } from '../middleware/auth.js';
import { audit } from '../services/audit.js';

const escapeRe = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

// Router CRUD chung cho admin.
// opts: search (trường tìm kiếm), filters (trường lọc bằng ?field=value), sort, writable (trường được phép ghi), onChange,
// transform (async body → body: tính toán trước khi lưu), scope (điều kiện cố định, vd chỉ bản ghi hệ thống),
// beforeUpdate(doc, changes) / beforeDelete(doc): chặn thao tác làm hỏng dữ liệu đang được dùng (ném HttpError).
// Mọi thao tác ghi đều được lưu vào nhật ký (AuditLog) kèm các trường thay đổi.
export function crudRouter(Model, { search = [], filters = [], sort = { createdAt: -1 }, writable, onChange, transform, scope = {}, beforeUpdate, beforeDelete, label = (d) => d.name ?? d.title ?? d.code ?? d.key ?? d.slug } = {}) {
  const router = Router();
  const entity = Model.modelName;
  const pick = (body) => {
    if (!writable) return body;
    return Object.fromEntries(Object.entries(body ?? {}).filter(([k]) => writable.includes(k)));
  };

  router.get(
    '/',
    ah(async (req, res) => {
      const page = Math.max(1, Number(req.query.page) || 1);
      const limit = Math.min(200, Math.max(1, Number(req.query.limit) || 50));
      const q = (req.query.q ?? '').toString().trim();
      const where = { ...scope };
      if (q && search.length) where.$or = search.map((f) => ({ [f]: { $regex: escapeRe(q), $options: 'i' } }));
      for (const f of filters) {
        const v = req.query[f];
        if (v === undefined || v === '') continue;
        // Chỉ nhận chuỗi (chặn ?active[$ne]=x thành toán tử truy vấn)
        const s = String(Array.isArray(v) ? v[0] : v);
        where[f] = s === 'true' ? true : s === 'false' ? false : s;
      }
      const [items, total] = await Promise.all([
        Model.find(where).sort(sort).skip((page - 1) * limit).limit(limit).lean(),
        Model.countDocuments(where),
      ]);
      res.json({ items, total, page, limit });
    }),
  );

  router.get(
    '/:id',
    ah(async (req, res) => {
      const item = await Model.findOne({ ...scope, _id: req.params.id }).lean();
      if (!item) throw new HttpError(404, 'Không tìm thấy');
      res.json({ item });
    }),
  );

  router.post(
    '/',
    ah(async (req, res) => {
      const item = await Model.create({ ...(transform ? await transform(pick(req.body)) : pick(req.body)), ...scope });
      await onChange?.();
      await audit(req, `${entity.toLowerCase()}.create`, { entity, entityId: item._id, summary: label(item), after: item.toObject() });
      res.status(201).json({ item });
    }),
  );

  router.patch(
    '/:id',
    ah(async (req, res) => {
      const item = await Model.findOne({ ...scope, _id: req.params.id });
      if (!item) throw new HttpError(404, 'Không tìm thấy');
      const before = item.toObject();
      const changes = transform ? await transform(pick(req.body)) : pick(req.body);
      await beforeUpdate?.(item, changes);
      item.set(changes);
      await item.save();
      await onChange?.();
      await audit(req, `${entity.toLowerCase()}.update`, { entity, entityId: item._id, summary: label(item), before, after: item.toObject() });
      res.json({ item });
    }),
  );

  router.delete(
    '/:id',
    ah(async (req, res) => {
      const item = await Model.findOne({ ...scope, _id: req.params.id });
      if (!item) throw new HttpError(404, 'Không tìm thấy');
      await beforeDelete?.(item);
      await Model.deleteOne({ _id: item._id });
      await onChange?.();
      await audit(req, `${entity.toLowerCase()}.delete`, { entity, entityId: item._id, summary: label(item), before: item.toObject() });
      res.status(204).end();
    }),
  );

  return router;
}
