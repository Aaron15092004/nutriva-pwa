import { Router } from 'express';
import { ah, HttpError } from '../middleware/auth.js';

const escapeRe = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

// Router CRUD chung cho admin.
// opts: search (trường tìm kiếm), filters (trường lọc bằng ?field=value), sort, writable (trường được phép ghi), onChange,
// transform (async body → body: tính toán trước khi lưu), scope (điều kiện cố định, vd chỉ bản ghi hệ thống)
export function crudRouter(Model, { search = [], filters = [], sort = { createdAt: -1 }, writable, onChange, transform, scope = {} } = {}) {
  const router = Router();
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
        where[f] = v === 'true' ? true : v === 'false' ? false : v;
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
      const item = await Model.create(transform ? await transform(pick(req.body)) : pick(req.body));
      await onChange?.();
      res.status(201).json({ item });
    }),
  );

  router.patch(
    '/:id',
    ah(async (req, res) => {
      const item = await Model.findOne({ ...scope, _id: req.params.id });
      if (!item) throw new HttpError(404, 'Không tìm thấy');
      item.set(transform ? await transform(pick(req.body)) : pick(req.body));
      await item.save();
      await onChange?.();
      res.json({ item });
    }),
  );

  router.delete(
    '/:id',
    ah(async (req, res) => {
      const r = await Model.deleteOne({ ...scope, _id: req.params.id });
      if (!r.deletedCount) throw new HttpError(404, 'Không tìm thấy');
      await onChange?.();
      res.status(204).end();
    }),
  );

  return router;
}
