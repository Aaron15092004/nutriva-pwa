import { Router } from 'express';
import bcrypt from 'bcryptjs';
import { User, Reminder, DailyLog, PlanChoice, Order, Subscription, SupportRequest, PushSubscription, WeightEntry } from '../models/index.js';
import { nowInTz } from '../services/scheduler.js';
import { imageUpload, saveImage, deleteImage } from '../services/files.js';
import { adminEmails } from '../seed.js';
import { ah, requireAuth, signToken, HttpError } from '../middleware/auth.js';
import { computeHealth } from '../../../shared/nutrition.js';

const router = Router();

export const publicUser = (u) => ({
  id: u._id,
  email: u.email,
  name: u.name,
  role: u.role,
  avatar: u.avatar ?? '',
  profile: u.profile,
  address: u.address ?? {},
  health: computeHealth(u.profile),
  activePlan: u.activePlan?.plan ? { plan: u.activePlan.plan, startDate: u.activePlan.startDate } : null,
  createdAt: u.createdAt,
});

const EMAIL_RE = /^[^\s@]+@[^\s@.]+(?:\.[^\s@.]+)+$/;

router.post(
  '/register',
  ah(async (req, res) => {
    const { email, password, name, profile, consent } = req.body ?? {};
    if (!EMAIL_RE.test(email ?? '')) throw new HttpError(400, 'Email không hợp lệ');
    if (!password || password.length < 6) throw new HttpError(400, 'Mật khẩu cần ít nhất 6 ký tự');
    if (!name?.trim()) throw new HttpError(400, 'Vui lòng nhập tên');
    if (!consent) throw new HttpError(400, 'Bạn cần đồng ý để NUTRIVA sử dụng thông tin');
    if (await User.exists({ email: email.toLowerCase() })) throw new HttpError(409, 'Email đã được đăng ký');

    const user = await User.create({
      email,
      name: name.trim(),
      passwordHash: await bcrypt.hash(password, 10),
      profile,
      role: adminEmails().includes(email.toLowerCase()) ? 'admin' : 'user',
      consentAt: new Date(),
      address: { name: name.trim() },
    });

    await WeightEntry.create({ user: user._id, date: nowInTz().date, kg: user.profile.weightKg });

    // Nhắc nhở mặc định cho người dùng mới
    await Reminder.insertMany([
      { user: user._id, kind: 'water', title: 'Uống nước', time: '10:00', days: [1, 2, 3, 4, 5] },
      { user: user._id, kind: 'milk', title: 'Uống sữa hạt', time: '15:30', days: [1, 2, 3, 4, 5] },
      { user: user._id, kind: 'exercise', title: 'Vận động nhẹ', time: '17:30', days: [1, 2, 3, 4, 5], enabled: false },
    ]);

    res.status(201).json({ token: signToken(user), user: publicUser(user) });
  }),
);

router.post(
  '/login',
  ah(async (req, res) => {
    const { email, password } = req.body ?? {};
    const user = await User.findOne({ email: (email ?? '').toLowerCase() });
    if (!user || !(await bcrypt.compare(password ?? '', user.passwordHash))) {
      throw new HttpError(401, 'Email hoặc mật khẩu không đúng');
    }
    res.json({ token: signToken(user), user: publicUser(user) });
  }),
);

router.get('/me', requireAuth, (req, res) => res.json({ user: publicUser(req.user) }));

router.patch(
  '/me',
  requireAuth,
  ah(async (req, res) => {
    const { name, profile, address } = req.body ?? {};
    if (name?.trim()) req.user.name = name.trim();
    const prevKg = req.user.profile.weightKg;
    if (profile) req.user.profile = { ...req.user.profile.toObject(), ...profile };
    if (address) req.user.address = { ...req.user.address?.toObject(), ...address };
    await req.user.save();
    if (req.user.profile.weightKg !== prevKg) {
      await WeightEntry.findOneAndUpdate({ user: req.user._id, date: nowInTz().date }, { kg: req.user.profile.weightKg }, { upsert: true });
    }
    res.json({ user: publicUser(req.user) });
  }),
);

// ---- Ảnh đại diện ----
router.post(
  '/me/avatar',
  requireAuth,
  imageUpload(2).single('file'),
  ah(async (req, res) => {
    if (!req.file) throw new HttpError(400, 'Chọn ảnh PNG/JPG/WebP tối đa 2 MB');
    const old = req.user.avatar;
    req.user.avatar = await saveImage(req.file, { kind: 'avatar', by: req.user._id });
    await req.user.save();
    await deleteImage(old);
    res.json({ user: publicUser(req.user) });
  }),
);

router.delete(
  '/me/avatar',
  requireAuth,
  ah(async (req, res) => {
    await deleteImage(req.user.avatar);
    req.user.avatar = '';
    await req.user.save();
    res.json({ user: publicUser(req.user) });
  }),
);

// ---- Lịch sử cân nặng ----
router.get(
  '/me/weights',
  requireAuth,
  ah(async (req, res) => {
    const days = Math.min(365, Math.max(7, Number(req.query.days) || 90));
    const from = new Date(Date.now() - days * 86400000).toISOString().slice(0, 10);
    let entries = await WeightEntry.find({ user: req.user._id, date: { $gte: from } }).sort({ date: 1 }).lean();
    if (!entries.length) {
      // Tài khoản cũ chưa có lịch sử: khởi tạo từ cân nặng hiện tại
      const e = await WeightEntry.create({ user: req.user._id, date: nowInTz().date, kg: req.user.profile.weightKg });
      entries = [e.toObject()];
    }
    res.json({ entries: entries.map(({ date, kg }) => ({ date, kg })) });
  }),
);

router.post(
  '/me/weights',
  requireAuth,
  ah(async (req, res) => {
    const kg = Math.round(Number(req.body.kg) * 10) / 10;
    const today = nowInTz().date;
    const date = /^\d{4}-\d{2}-\d{2}$/.test(req.body.date ?? '') ? req.body.date : today;
    if (!(kg >= 25 && kg <= 250)) throw new HttpError(400, 'Cân nặng phải từ 25 đến 250 kg');
    if (date > today) throw new HttpError(400, 'Không thể ghi cân nặng cho ngày tương lai');
    await WeightEntry.findOneAndUpdate({ user: req.user._id, date }, { kg }, { upsert: true });
    // Bản ghi mới nhất là cân nặng hiện tại → cập nhật hồ sơ (BMI, mục tiêu calo tự tính lại)
    const latest = await WeightEntry.findOne({ user: req.user._id }).sort({ date: -1 }).lean();
    if (latest && latest.kg !== req.user.profile.weightKg) {
      req.user.profile.weightKg = latest.kg;
      await req.user.save();
    }
    res.status(201).json({ user: publicUser(req.user) });
  }),
);

router.post(
  '/me/password',
  requireAuth,
  ah(async (req, res) => {
    const { current, next } = req.body ?? {};
    if (!(await bcrypt.compare(current ?? '', req.user.passwordHash))) throw new HttpError(400, 'Mật khẩu hiện tại không đúng');
    if (!next || next.length < 6) throw new HttpError(400, 'Mật khẩu mới cần ít nhất 6 ký tự');
    req.user.passwordHash = await bcrypt.hash(next, 10);
    await req.user.save();
    res.json({ ok: true });
  }),
);

router.delete(
  '/me',
  requireAuth,
  ah(async (req, res) => {
    const id = req.user._id;
    await deleteImage(req.user.avatar);
    await Promise.all(
      [DailyLog, PlanChoice, Order, Subscription, Reminder, SupportRequest, PushSubscription, WeightEntry].map((m) => m.deleteMany({ user: id })),
    );
    await req.user.deleteOne();
    res.status(204).end();
  }),
);

export default router;
