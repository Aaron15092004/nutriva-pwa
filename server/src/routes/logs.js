import { Router } from 'express';
import { DailyLog, Activity, User } from '../models/index.js';
import { ah, requireAuth, HttpError } from '../middleware/auth.js';
import { suggestFoods } from '../data/foods.js';
import { loadFoods } from '../services/catalog.js';
import { addDays } from '../services/plan.js';
import { track } from '../services/events.js';

const router = Router();
router.use(requireAuth);

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const MEAL_IDS = ['breakfast', 'lunch', 'dinner', 'snack'];
const MOODS = ['great', 'good', 'normal', 'tired', 'bad'];
const MAX_PER_MEAL = 60;

function checkDate(date) {
  if (!DATE_RE.test(date ?? '')) throw new HttpError(400, 'Ngày không hợp lệ');
  return date;
}
function checkMeal(meal) {
  if (!MEAL_IDS.includes(meal)) throw new HttpError(400, 'Bữa ăn không hợp lệ');
  return meal;
}
const cidOf = (body) => (typeof body?.cid === 'string' && body.cid ? body.cid.slice(0, 64) : undefined);

const getLog = (user, date) =>
  DailyLog.findOneAndUpdate({ user: user._id, date }, { $setOnInsert: { user: user._id, date } }, { upsert: true, new: true });

// Một món → bản ghi nhật ký (dinh dưỡng thực phẩm luôn tính ở server)
async function toEntry(body, foods) {
  const grams = Number(body?.grams);
  if (!(grams > 0 && grams <= 3000)) throw new HttpError(400, 'Định lượng phải từ 1 đến 3000 g');
  const cid = cidOf(body);
  // name: tên hiển thị từ kế hoạch (vd "Ức gà áp chảo"), mặc định là tên thực phẩm
  const label = typeof body.name === 'string' ? body.name.trim().slice(0, 80) : '';
  if (body.foodId) {
    const food = (foods ?? (await loadFoods())).find((f) => f.id === body.foodId);
    if (!food) throw new HttpError(404, 'Không tìm thấy thực phẩm');
    const k = grams / 100;
    return {
      foodId: food.id,
      cid,
      name: label || food.name,
      grams,
      kcal: Math.round(food.kcal * k),
      protein: +(food.protein * k).toFixed(1),
      carb: +(food.carb * k).toFixed(1),
      fat: +(food.fat * k).toFixed(1),
    };
  }
  // Món từ kế hoạch (đã có sẵn dinh dưỡng theo khẩu phần)
  const kcal = Number(body.kcal);
  if (!label || !(kcal >= 0 && kcal <= 5000)) throw new HttpError(400, 'Thiếu thông tin món ăn');
  const macro = (v) => Math.min(1000, Math.max(0, +Number(v || 0).toFixed(1)));
  return { cid, name: label, grams, kcal: Math.round(kcal), protein: macro(body.protein), carb: macro(body.carb), fat: macro(body.fat) };
}

// Thêm các món vào 1 bữa — bỏ qua món có cid đã ghi (gửi lại không bị trùng)
async function pushEntries(user, date, meal, entries) {
  const log = await getLog(user, date);
  const seen = new Set(log.meals[meal].map((e) => e.cid).filter(Boolean));
  const fresh = entries.filter((e) => !e.cid || !seen.has(e.cid));
  if (log.meals[meal].length + fresh.length > MAX_PER_MEAL) throw new HttpError(400, `Mỗi bữa ghi tối đa ${MAX_PER_MEAL} món`);
  if (!fresh.length) return log;
  const path = `meals.${meal}`;
  // Điều kiện: chưa có cid nào trong số này (2 request gửi lại song song)
  const cids = fresh.map((e) => e.cid).filter(Boolean);
  const updated = await DailyLog.findOneAndUpdate(
    { _id: log._id, ...(cids.length ? { [`${path}.cid`]: { $nin: cids } } : {}) },
    { $push: { [path]: { $each: fresh } } },
    { new: true, runValidators: true },
  );
  return updated ?? DailyLog.findById(log._id);
}

router.get('/foods', ah(async (req, res) => res.json({ foods: await loadFoods() })));
router.get(
  '/foods/suggest',
  ah(async (req, res) => res.json({ foods: suggestFoods(req.user.profile.toObject(), await loadFoods()) })),
);

// Ghi nhanh: món đã ghi gần đây (30 ngày, hay dùng + mới nhất trước) và món yêu thích
router.get(
  '/foods/quick',
  ah(async (req, res) => {
    const from = addDays(new Date().toISOString().slice(0, 10), -30);
    const [rows, foods] = await Promise.all([
      DailyLog.aggregate([
        { $match: { user: req.user._id, date: { $gte: from } } },
        { $project: { date: 1, all: { $concatArrays: ['$meals.breakfast', '$meals.lunch', '$meals.dinner', '$meals.snack'] } } },
        { $unwind: '$all' },
        { $match: { 'all.foodId': { $type: 'string' } } },
        { $group: { _id: '$all.foodId', n: { $sum: 1 }, last: { $max: '$date' }, grams: { $last: '$all.grams' } } },
        { $sort: { last: -1, n: -1 } },
        { $limit: 12 },
      ]),
      loadFoods(),
    ]);
    const byId = new Map(foods.map((f) => [f.id, f]));
    res.json({
      recent: rows.map((r) => byId.get(r._id) && { ...byId.get(r._id), lastGrams: r.grams, times: r.n }).filter(Boolean),
      favorites: (req.user.favoriteFoods ?? []).map((id) => byId.get(id)).filter(Boolean),
    });
  }),
);

router.put(
  '/foods/:id/favorite',
  ah(async (req, res) => {
    const id = String(req.params.id);
    if (!(await loadFoods()).some((f) => f.id === id)) throw new HttpError(404, 'Không tìm thấy thực phẩm');
    const on = req.body?.on !== false;
    if (on && (req.user.favoriteFoods?.length ?? 0) >= 50 && !req.user.favoriteFoods.includes(id)) throw new HttpError(400, 'Tối đa 50 món yêu thích');
    const user = await User.findByIdAndUpdate(req.user._id, on ? { $addToSet: { favoriteFoods: id } } : { $pull: { favoriteFoods: id } }, { new: true });
    res.json({ favorites: user.favoriteFoods });
  }),
);

router.get(
  '/logs/:date',
  ah(async (req, res) => res.json({ log: await getLog(req.user, checkDate(req.params.date)) })),
);

// Tóm tắt nhiều ngày (dùng cho biểu đồ tuần ở trang Theo dõi)
router.get(
  '/logs',
  ah(async (req, res) => {
    const from = checkDate(req.query.from);
    const to = checkDate(req.query.to);
    if (Date.parse(to) - Date.parse(from) > 92 * 86400000) throw new HttpError(400, 'Khoảng ngày tối đa 3 tháng');
    const logs = await DailyLog.find({ user: req.user._id, date: { $gte: from, $lte: to } });
    const days = [];
    for (let d = from; d <= to; d = addDays(d, 1)) days.push(logs.find((l) => l.date === d) ?? { date: d, empty: true });
    res.json({ logs: days });
  }),
);

// Thêm món đã ăn: client gửi foodId + grams, server tự tính dinh dưỡng
router.post(
  '/logs/:date/meals/:meal',
  ah(async (req, res) => {
    const date = checkDate(req.params.date);
    const meal = checkMeal(req.params.meal);
    const log = await pushEntries(req.user, date, meal, [await toEntry(req.body)]);
    track('log.food', { user: req.user, props: { meal, source: req.body.foodId ? 'food' : 'plan' } });
    res.status(201).json({ log });
  }),
);

// Ghi cả bữa (vd toàn bộ món của bữa trưa trong kế hoạch) trong 1 lần
router.post(
  '/logs/:date/meals/:meal/batch',
  ah(async (req, res) => {
    const date = checkDate(req.params.date);
    const meal = checkMeal(req.params.meal);
    const items = Array.isArray(req.body?.items) ? req.body.items : [];
    if (!items.length || items.length > 20) throw new HttpError(400, 'Chọn 1–20 món');
    const foods = await loadFoods();
    const entries = await Promise.all(items.map((it) => toEntry(it, foods)));
    const log = await pushEntries(req.user, date, meal, entries);
    track('log.food', { user: req.user, props: { meal, source: 'batch', n: entries.length } });
    res.status(201).json({ log });
  }),
);

// Chép bữa/ngày khác sang (mặc định: hôm qua → hôm nay). meal bỏ trống = chép cả ngày
router.post(
  '/logs/:date/copy',
  ah(async (req, res) => {
    const date = checkDate(req.params.date);
    const from = req.body?.from ? checkDate(req.body.from) : addDays(date, -1);
    const meals = req.body?.meal ? [checkMeal(req.body.meal)] : MEAL_IDS;
    const src = await DailyLog.findOne({ user: req.user._id, date: from }).lean();
    const cid = cidOf(req.body);
    let copied = 0;
    let log = null;
    for (const m of meals) {
      const entries = (src?.meals?.[m] ?? []).map(({ _id, cid: _c, ...e }, i) => ({ ...e, cid: cid ? `${cid}:${m}:${i}` : undefined }));
      if (!entries.length) continue;
      log = await pushEntries(req.user, date, m, entries);
      copied += entries.length;
    }
    if (!copied) throw new HttpError(400, req.body?.meal ? 'Bữa này hôm trước chưa ghi món nào' : 'Ngày này chưa ghi món nào');
    track('log.food', { user: req.user, props: { source: 'copy', n: copied } });
    res.status(201).json({ log: log ?? (await getLog(req.user, date)), copied });
  }),
);

router.delete(
  '/logs/:date/meals/:meal/:entryId',
  ah(async (req, res) => {
    const date = checkDate(req.params.date);
    const meal = checkMeal(req.params.meal);
    const log = await DailyLog.findOneAndUpdate({ user: req.user._id, date }, { $pull: { [`meals.${meal}`]: { _id: req.params.entryId } } }, { new: true });
    res.json({ log: log ?? (await getLog(req.user, date)) });
  }),
);

// Nước: cộng/trừ nguyên tử ($inc) — bấm "+200 ml" liên tục không bị mất lượt; cid chống cộng trùng khi gửi lại
router.post(
  '/logs/:date/water',
  ah(async (req, res) => {
    const date = checkDate(req.params.date);
    const delta = Math.round(Number(req.body.ml));
    if (!Number.isFinite(delta) || delta === 0 || Math.abs(delta) > 2000) throw new HttpError(400, 'Lượng nước không hợp lệ');
    const cid = cidOf(req.body);
    await getLog(req.user, date);
    const filter = { user: req.user._id, date, ...(cid ? { ops: { $ne: cid } } : {}) };
    const update = [
      {
        $set: {
          waterMl: { $min: [20000, { $max: [0, { $add: [{ $ifNull: ['$waterMl', 0] }, delta] }] }] },
          ...(cid ? { ops: { $slice: [{ $concatArrays: [{ $ifNull: ['$ops', []] }, [cid]] }, -30] } } : {}),
          updatedAt: '$$NOW',
        },
      },
    ];
    const log = (await DailyLog.findOneAndUpdate(filter, update, { new: true })) ?? (await getLog(req.user, date));
    if (delta > 0) track('log.water', { user: req.user });
    res.json({ log });
  }),
);

// Danh mục hoạt động (đốt calo)
const collator = new Intl.Collator('vi');
router.get(
  '/activities',
  ah(async (req, res) => {
    const items = await Activity.find({ active: true }).select('slug name nameEn category image imageCredit variants defaultMinutes').lean();
    items.sort((a, b) => collator.compare(a.name, b.name));
    res.json({ activities: items });
  }),
);

router.get(
  '/activities/:slug',
  ah(async (req, res) => {
    const activity = await Activity.findOne({ slug: req.params.slug, active: true }).lean();
    if (!activity) throw new HttpError(404, 'Không tìm thấy hoạt động');
    res.json({ activity });
  }),
);

// Ghi nhận vận động: { activity: slug, variant: index, minutes } — calo tính ở server từ MET trong DB.
// Hoặc hoạt động tự nhập: { custom: true, name, minutes, kcal }
router.post(
  '/logs/:date/exercises',
  ah(async (req, res) => {
    const date = checkDate(req.params.date);
    const minutes = Number(req.body.minutes);
    if (!(minutes > 0 && minutes <= 600)) throw new HttpError(400, 'Thời gian phải từ 1 đến 600 phút');
    const cid = cidOf(req.body);
    let entry;
    if (req.body.custom) {
      const name = (req.body.name ?? '').toString().trim().slice(0, 60);
      const kcal = Math.round(Number(req.body.kcal));
      if (!name) throw new HttpError(400, 'Nhập tên hoạt động');
      if (!(kcal >= 0 && kcal <= 5000)) throw new HttpError(400, 'Calo tiêu thụ không hợp lệ');
      entry = { type: 'custom', label: name, minutes, kcal, custom: true, cid };
    } else {
      const act = await Activity.findOne({ slug: String(req.body.activity ?? ''), active: true }).lean();
      if (!act) throw new HttpError(400, 'Hoạt động không hợp lệ');
      const v = act.variants[Number(req.body.variant) || 0] ?? act.variants[0];
      entry = {
        type: act.slug,
        label: act.name,
        variant: act.variants.length > 1 ? v.name : undefined,
        met: v.met,
        minutes,
        kcal: Math.round(v.met * req.user.profile.weightKg * (minutes / 60)),
        cid,
      };
    }
    const log0 = await getLog(req.user, date);
    const log =
      (await DailyLog.findOneAndUpdate({ _id: log0._id, ...(cid ? { 'exercises.cid': { $ne: cid } } : {}) }, { $push: { exercises: entry } }, { new: true })) ??
      (await DailyLog.findById(log0._id));
    track('log.exercise', { user: req.user, props: { type: entry.type } });
    res.status(201).json({ log });
  }),
);

router.delete(
  '/logs/:date/exercises/:id',
  ah(async (req, res) => {
    const date = checkDate(req.params.date);
    const log = await DailyLog.findOneAndUpdate({ user: req.user._id, date }, { $pull: { exercises: { _id: req.params.id } } }, { new: true });
    res.json({ log: log ?? (await getLog(req.user, date)) });
  }),
);

router.put(
  '/logs/:date/mood',
  ah(async (req, res) => {
    const date = checkDate(req.params.date);
    const mood = req.body?.mood ?? null;
    if (mood !== null && !MOODS.includes(mood)) throw new HttpError(400, 'Tâm trạng không hợp lệ');
    await getLog(req.user, date);
    const log = await DailyLog.findOneAndUpdate({ user: req.user._id, date }, { mood }, { new: true });
    res.json({ log });
  }),
);

export default router;
