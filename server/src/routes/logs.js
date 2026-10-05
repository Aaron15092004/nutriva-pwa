import { Router } from 'express';
import { DailyLog, Activity } from '../models/index.js';
import { ah, requireAuth, HttpError } from '../middleware/auth.js';
import { suggestFoods } from '../data/foods.js';
import { loadFoods } from '../services/catalog.js';
import { addDays } from '../services/plan.js';

const router = Router();
router.use(requireAuth);

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const MEAL_IDS = ['breakfast', 'lunch', 'dinner', 'snack'];

function checkDate(date) {
  if (!DATE_RE.test(date ?? '')) throw new HttpError(400, 'Ngày không hợp lệ');
  return date;
}

const getLog = (user, date) =>
  DailyLog.findOneAndUpdate({ user: user._id, date }, { $setOnInsert: { user: user._id, date } }, { upsert: true, new: true });

router.get('/foods', ah(async (req, res) => res.json({ foods: await loadFoods() })));
router.get(
  '/foods/suggest',
  ah(async (req, res) => res.json({ foods: suggestFoods(req.user.profile.toObject(), await loadFoods()) })),
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
    const { date, meal } = req.params;
    checkDate(date);
    if (!MEAL_IDS.includes(meal)) throw new HttpError(400, 'Bữa ăn không hợp lệ');
    const grams = Number(req.body.grams);
    if (!(grams > 0 && grams <= 3000)) throw new HttpError(400, 'Định lượng phải từ 1 đến 3000 g');

    let entry;
    if (req.body.foodId) {
      const food = (await loadFoods()).find((f) => f.id === req.body.foodId);
      if (!food) throw new HttpError(404, 'Không tìm thấy thực phẩm');
      const k = grams / 100;
      // name: tên hiển thị từ kế hoạch (vd "Ức gà áp chảo"), mặc định là tên thực phẩm
      const label = typeof req.body.name === 'string' ? req.body.name.trim().slice(0, 80) : '';
      entry = {
        foodId: food.id,
        name: label || food.name,
        grams,
        kcal: Math.round(food.kcal * k),
        protein: +(food.protein * k).toFixed(1),
        carb: +(food.carb * k).toFixed(1),
        fat: +(food.fat * k).toFixed(1),
      };
    } else {
      // Món từ kế hoạch (đã có sẵn dinh dưỡng theo khẩu phần)
      const { name, kcal, protein, carb, fat } = req.body;
      if (!name || !(kcal >= 0)) throw new HttpError(400, 'Thiếu thông tin món ăn');
      entry = { name, grams, kcal: Math.round(kcal), protein: +protein || 0, carb: +carb || 0, fat: +fat || 0 };
    }

    const log = await getLog(req.user, date);
    log.meals[meal].push(entry);
    await log.save();
    res.status(201).json({ log });
  }),
);

router.delete(
  '/logs/:date/meals/:meal/:entryId',
  ah(async (req, res) => {
    const { date, meal, entryId } = req.params;
    if (!MEAL_IDS.includes(meal)) throw new HttpError(400, 'Bữa ăn không hợp lệ');
    const log = await getLog(req.user, checkDate(date));
    log.meals[meal].pull({ _id: entryId });
    await log.save();
    res.json({ log });
  }),
);

router.post(
  '/logs/:date/water',
  ah(async (req, res) => {
    const delta = Number(req.body.ml);
    if (!Number.isFinite(delta) || Math.abs(delta) > 2000) throw new HttpError(400, 'Lượng nước không hợp lệ');
    const log = await getLog(req.user, checkDate(req.params.date));
    log.waterMl = Math.max(0, log.waterMl + delta);
    await log.save();
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
    const minutes = Number(req.body.minutes);
    if (!(minutes > 0 && minutes <= 600)) throw new HttpError(400, 'Thời gian phải từ 1 đến 600 phút');
    let entry;
    if (req.body.custom) {
      const name = (req.body.name ?? '').toString().trim().slice(0, 60);
      const kcal = Math.round(Number(req.body.kcal));
      if (!name) throw new HttpError(400, 'Nhập tên hoạt động');
      if (!(kcal >= 0 && kcal <= 5000)) throw new HttpError(400, 'Calo tiêu thụ không hợp lệ');
      entry = { type: 'custom', label: name, minutes, kcal, custom: true };
    } else {
      const act = await Activity.findOne({ slug: req.body.activity, active: true }).lean();
      if (!act) throw new HttpError(400, 'Hoạt động không hợp lệ');
      const v = act.variants[Number(req.body.variant) || 0] ?? act.variants[0];
      entry = {
        type: act.slug,
        label: act.name,
        variant: act.variants.length > 1 ? v.name : undefined,
        met: v.met,
        minutes,
        kcal: Math.round(v.met * req.user.profile.weightKg * (minutes / 60)),
      };
    }
    const log = await getLog(req.user, checkDate(req.params.date));
    log.exercises.push(entry);
    await log.save();
    res.status(201).json({ log });
  }),
);

router.delete(
  '/logs/:date/exercises/:id',
  ah(async (req, res) => {
    const log = await getLog(req.user, checkDate(req.params.date));
    log.exercises.pull({ _id: req.params.id });
    await log.save();
    res.json({ log });
  }),
);

router.put(
  '/logs/:date/mood',
  ah(async (req, res) => {
    const log = await getLog(req.user, checkDate(req.params.date));
    log.mood = req.body.mood;
    await log.save();
    res.json({ log });
  }),
);

export default router;
