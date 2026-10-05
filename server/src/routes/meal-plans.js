import { Router } from 'express';
import mongoose from 'mongoose';
import { MealPlan } from '../models/index.js';
import { loadFoods, loadDishes } from '../services/catalog.js';
import { ah, requireAuth, HttpError } from '../middleware/auth.js';
import { publicUser } from './auth.js';
import { makeCtx, planSummary, planDetail, resolveDay, ingredientsFor, planDayIndex, cleanDays } from '../services/meal-plans.js';

// Kế hoạch ăn mẫu (Khám phá), thực đơn tự tạo và kế hoạch đang áp dụng của người dùng
const router = Router();
router.use(requireAuth);

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const loadCtx = async () => {
  const [foods, dishes] = await Promise.all([loadFoods(), loadDishes()]);
  return makeCtx(foods, dishes);
};

// Kế hoạch người dùng được xem: kế hoạch mẫu đang bật hoặc thực đơn của chính họ
async function findPlan(id, user) {
  const by = mongoose.isValidObjectId(id) ? { _id: id } : { slug: String(id).toLowerCase() };
  const p = await MealPlan.findOne({ ...by, $or: [{ owner: null, active: true }, { owner: user._id }] }).lean();
  if (!p) throw new HttpError(404, 'Không tìm thấy kế hoạch');
  return p;
}
const ownPlan = async (id, user) => {
  if (!mongoose.isValidObjectId(id)) throw new HttpError(404, 'Không tìm thấy thực đơn');
  const p = await MealPlan.findOne({ _id: id, owner: user._id });
  if (!p) throw new HttpError(404, 'Không tìm thấy thực đơn');
  return p;
};

router.get(
  '/',
  ah(async (req, res) => {
    const [plans, mine] = await Promise.all([
      MealPlan.find({ owner: null, active: true }).sort({ kcalMin: 1, sort: 1, createdAt: 1 }).lean(),
      MealPlan.find({ owner: req.user._id }).sort({ updatedAt: -1 }).lean(),
    ]);
    const activeId = req.user.activePlan?.plan ? String(req.user.activePlan.plan) : null;
    const current = [...plans, ...mine].find((p) => String(p._id) === activeId);
    res.json({
      plans: plans.map((p) => planSummary(p, req.user._id)),
      mine: mine.map((p) => planSummary(p, req.user._id)),
      current: current ? { ...planSummary(current, req.user._id), startDate: req.user.activePlan.startDate } : null,
    });
  }),
);

// Thực đơn của ngày `date` theo kế hoạch đang áp dụng
router.get(
  '/today',
  ah(async (req, res) => {
    const { date } = req.query;
    if (!DATE_RE.test(date ?? '')) throw new HttpError(400, 'Ngày không hợp lệ');
    const ap = req.user.activePlan;
    const plan = ap?.plan && (await MealPlan.findOne({ _id: ap.plan, $or: [{ owner: null, active: true }, { owner: req.user._id }] }).lean());
    if (!plan) return res.json({ plan: null });
    const index = planDayIndex(ap.startDate, date, plan.days.length);
    res.json({
      plan: { ...planSummary(plan, req.user._id), startDate: ap.startDate },
      dayIndex: index,
      day: resolveDay(plan.days[index], await loadCtx()),
    });
  }),
);

router.delete(
  '/active',
  ah(async (req, res) => {
    req.user.activePlan = null;
    await req.user.save();
    res.json({ user: publicUser(req.user) });
  }),
);

router.get(
  '/:id',
  ah(async (req, res) => {
    const [plan, ctx] = await Promise.all([findPlan(req.params.id, req.user), loadCtx()]);
    const active = req.user.activePlan?.plan && String(req.user.activePlan.plan) === String(plan._id);
    res.json({ plan: { ...planDetail(plan, ctx, req.user._id), active: Boolean(active), startDate: active ? req.user.activePlan.startDate : null } });
  }),
);

// Danh sách nguyên liệu: ?day=0..n-1 (một ngày) hoặc bỏ trống (cả kế hoạch)
router.get(
  '/:id/ingredients',
  ah(async (req, res) => {
    const [plan, ctx] = await Promise.all([findPlan(req.params.id, req.user), loadCtx()]);
    const day = req.query.day;
    let days = plan.days;
    if (day !== undefined && day !== '') {
      const i = Number(day);
      if (!Number.isInteger(i) || i < 0 || i >= plan.days.length) throw new HttpError(400, 'Ngày không hợp lệ');
      days = [plan.days[i]];
    }
    res.json({ items: ingredientsFor(days, ctx), dayCount: plan.days.length });
  }),
);

// Bắt đầu áp dụng kế hoạch: ngày 1 = startDate (mặc định hôm nay theo giờ của người dùng)
router.post(
  '/:id/start',
  ah(async (req, res) => {
    const plan = await findPlan(req.params.id, req.user);
    const startDate = req.body?.startDate;
    if (!DATE_RE.test(startDate ?? '')) throw new HttpError(400, 'Ngày bắt đầu không hợp lệ');
    req.user.activePlan = { plan: plan._id, startDate };
    await req.user.save();
    res.json({ user: publicUser(req.user) });
  }),
);

// Tùy chỉnh & lưu: sao chép thành thực đơn tự tạo của người dùng
router.post(
  '/:id/copy',
  ah(async (req, res) => {
    const src = await findPlan(req.params.id, req.user);
    if ((await MealPlan.countDocuments({ owner: req.user._id })) >= 30) throw new HttpError(400, 'Bạn đã có tối đa 30 thực đơn tự tạo');
    const base = (src.copiedFrom ?? src.slug).slice(0, 60);
    const doc = await MealPlan.create({
      slug: `${base}-${new mongoose.Types.ObjectId().toString().slice(-8)}`,
      title: `${src.title} (bản của tôi)`.slice(0, 120),
      summary: src.summary,
      description: src.description,
      style: src.style,
      kcalMin: src.kcalMin,
      kcalMax: src.kcalMax,
      image: src.image,
      imageCredit: src.imageCredit,
      days: src.days,
      owner: req.user._id,
      copiedFrom: src.copiedFrom ?? src.slug,
    });
    res.status(201).json({ plan: planDetail(doc.toObject(), await loadCtx(), req.user._id) });
  }),
);

router.patch(
  '/:id',
  ah(async (req, res) => {
    const plan = await ownPlan(req.params.id, req.user);
    const ctx = await loadCtx();
    const { title, days } = req.body ?? {};
    if (title !== undefined) {
      if (!String(title).trim()) throw new HttpError(400, 'Vui lòng nhập tên thực đơn');
      plan.title = String(title).trim().slice(0, 120);
    }
    if (days !== undefined) plan.days = cleanDays(days, ctx);
    await plan.save();
    res.json({ plan: planDetail(plan.toObject(), ctx, req.user._id) });
  }),
);

router.delete(
  '/:id',
  ah(async (req, res) => {
    const plan = await ownPlan(req.params.id, req.user);
    await plan.deleteOne();
    if (req.user.activePlan?.plan && String(req.user.activePlan.plan) === String(plan._id)) {
      req.user.activePlan = null;
      await req.user.save();
    }
    res.json({ user: publicUser(req.user) });
  }),
);

export default router;
