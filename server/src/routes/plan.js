import { Router } from 'express';
import { PlanChoice } from '../models/index.js';
import { loadProducts, loadDishes } from '../services/catalog.js';
import { ah, requireAuth, HttpError } from '../middleware/auth.js';
import { buildDay, alternatives, addDays, findItem } from '../services/plan.js';

const router = Router();
router.use(requireAuth);

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const MEAL_IDS = ['breakfast', 'lunch', 'dinner', 'snack'];

const loadCtx = async () => {
  const [products, dishes] = await Promise.all([loadProducts(), loadDishes()]);
  return { products, dishes };
};
const plainProfile = (u) => u.profile.toObject();

router.get(
  '/day',
  ah(async (req, res) => {
    const { date } = req.query;
    if (!DATE_RE.test(date ?? '')) throw new HttpError(400, 'Ngày không hợp lệ');
    const [ctx, choices] = await Promise.all([loadCtx(), PlanChoice.find({ user: req.user._id, date }).lean()]);
    res.json({ day: buildDay(plainProfile(req.user), date, ctx, choices) });
  }),
);

// Gợi ý menu 7 ngày theo mục tiêu (duy trì / tăng / giảm cân) người dùng đã chọn
router.get(
  '/week',
  ah(async (req, res) => {
    const { start } = req.query;
    if (!DATE_RE.test(start ?? '')) throw new HttpError(400, 'Ngày không hợp lệ');
    const end = addDays(start, 6);
    const [ctx, choices] = await Promise.all([
      loadCtx(),
      PlanChoice.find({ user: req.user._id, date: { $gte: start, $lte: end } }).lean(),
    ]);
    const profile = plainProfile(req.user);
    const days = Array.from({ length: 7 }, (_, i) => buildDay(profile, addDays(start, i), ctx, choices));
    res.json({ days });
  }),
);

router.get(
  '/alternatives',
  ah(async (req, res) => {
    const { date, meal } = req.query;
    if (!DATE_RE.test(date ?? '') || !MEAL_IDS.includes(meal)) throw new HttpError(400, 'Tham số không hợp lệ');
    const [ctx, choices] = await Promise.all([loadCtx(), PlanChoice.find({ user: req.user._id, date }).lean()]);
    const profile = plainProfile(req.user);
    const day = buildDay(profile, date, ctx, choices);
    const current = day.meals.find((m) => m.meal === meal);
    res.json({ current, options: alternatives(profile, meal, ctx, current.item.id) });
  }),
);

router.put(
  '/choice',
  ah(async (req, res) => {
    const { date, meal, itemId, note } = req.body ?? {};
    if (!DATE_RE.test(date ?? '') || !MEAL_IDS.includes(meal)) throw new HttpError(400, 'Tham số không hợp lệ');
    const ctx = await loadCtx();
    if (!findItem(itemId ?? '', ctx)) throw new HttpError(404, 'Không tìm thấy món');
    await PlanChoice.findOneAndUpdate(
      { user: req.user._id, date, meal },
      { dishId: itemId, note: (note ?? '').slice(0, 200) },
      { upsert: true },
    );
    res.json({ ok: true });
  }),
);

router.delete(
  '/choice',
  ah(async (req, res) => {
    const { date, meal } = req.query;
    await PlanChoice.deleteOne({ user: req.user._id, date, meal });
    res.json({ ok: true });
  }),
);

export default router;
