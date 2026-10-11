import { Router } from 'express';
import bcrypt from 'bcryptjs';
import { OAuth2Client } from 'google-auth-library';
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
  hasPassword: Boolean(u.passwordHash),
  google: Boolean(u.googleId),
  createdAt: u.createdAt,
});

const EMAIL_RE = /^[^\s@]+@[^\s@.]+(?:\.[^\s@.]+)+$/;

// Câu trả lời khảo sát onboarding: chỉ giữ các khóa & giá trị hợp lệ
const SURVEY = {
  motivation: ['look', 'confidence', 'health', 'energy'],
  obstacle: ['habits', 'emotional', 'support', 'busy', 'knowledge', 'other'],
  milkHabit: ['daily', 'sometimes', 'never'],
  logging: ['every', 'sometimes', 'never'],
  milkTimes: ['breakfast', 'workout', 'afternoon', 'night'],
};
function cleanSurvey(s = {}) {
  const out = {};
  for (const [k, allowed] of Object.entries(SURVEY)) {
    const v = s?.[k];
    if (Array.isArray(v)) out[k] = [...new Set(v.filter((x) => allowed.includes(x)))];
    else if (allowed.includes(v)) out[k] = v;
  }
  return out;
}

// Tạo tài khoản mới (email/mật khẩu hoặc Google) + dữ liệu khởi tạo
async function createUser({ email, name, passwordHash, googleId, avatar, profile, survey }) {
  const user = await User.create({
    email,
    name: name.trim().slice(0, 60),
    passwordHash,
    googleId,
    avatar: avatar ?? '',
    profile,
    survey: cleanSurvey(survey),
    role: adminEmails().includes(email.toLowerCase()) ? 'admin' : 'user',
    consentAt: new Date(),
    address: { name: name.trim().slice(0, 60) },
  });

  await WeightEntry.create({ user: user._id, date: nowInTz().date, kg: user.profile.weightKg });

  // Nhắc nhở mặc định cho người dùng mới (giờ uống sữa theo thói quen đã chọn)
  const milkTime = { breakfast: '07:30', workout: '17:30', afternoon: '15:30', night: '20:30' }[user.survey?.milkTimes?.[0]] ?? '15:30';
  await Reminder.insertMany([
    { user: user._id, kind: 'water', title: 'Uống nước', time: '10:00', days: [1, 2, 3, 4, 5] },
    { user: user._id, kind: 'milk', title: 'Uống sữa hạt', time: milkTime, days: [1, 2, 3, 4, 5] },
    { user: user._id, kind: 'exercise', title: 'Vận động nhẹ', time: '17:30', days: [1, 2, 3, 4, 5], enabled: false },
  ]);
  return user;
}

router.post(
  '/register',
  ah(async (req, res) => {
    const { email, password, name, profile, consent, survey } = req.body ?? {};
    if (!EMAIL_RE.test(email ?? '')) throw new HttpError(400, 'Email không hợp lệ');
    if (!password || password.length < 6) throw new HttpError(400, 'Mật khẩu cần ít nhất 6 ký tự');
    if (!name?.trim()) throw new HttpError(400, 'Vui lòng nhập tên');
    if (!consent) throw new HttpError(400, 'Bạn cần đồng ý để NUTRIVA sử dụng thông tin');
    if (await User.exists({ email: email.toLowerCase() })) throw new HttpError(409, 'Email đã được đăng ký');

    const user = await createUser({ email, name, passwordHash: await bcrypt.hash(password, 10), profile, survey });
    res.status(201).json({ token: signToken(user), user: publicUser(user) });
  }),
);

// ---- Đăng nhập Google (Google Identity Services: client gửi ID token, server xác minh) ----
const googleClientId = () => process.env.GOOGLE_CLIENT_ID || null;
let googleClient = null;

router.get('/config', (req, res) => res.json({ googleClientId: googleClientId() }));

router.post(
  '/google',
  ah(async (req, res) => {
    const clientId = googleClientId();
    if (!clientId) throw new HttpError(503, 'Đăng nhập Google chưa được cấu hình');
    const { credential, profile, consent, survey, name } = req.body ?? {};
    if (!credential) throw new HttpError(400, 'Thiếu thông tin đăng nhập Google');

    let payload;
    try {
      googleClient ??= new OAuth2Client(clientId);
      payload = (await googleClient.verifyIdToken({ idToken: credential, audience: clientId })).getPayload();
    } catch {
      throw new HttpError(401, 'Phiên đăng nhập Google không hợp lệ hoặc đã hết hạn, vui lòng thử lại');
    }
    if (!payload?.email || !payload.email_verified) throw new HttpError(401, 'Email Google chưa được xác minh');
    const email = payload.email.toLowerCase();

    let user = await User.findOne({ $or: [{ googleId: payload.sub }, { email }] });
    if (user) {
      // Tài khoản email cũ cùng địa chỉ → liên kết Google
      if (!user.googleId) user.googleId = payload.sub;
      if (!user.avatar && payload.picture) user.avatar = payload.picture;
      await user.save();
      return res.json({ token: signToken(user), user: publicUser(user) });
    }

    // Chưa có tài khoản: cần hồ sơ từ onboarding để tạo kế hoạch
    if (!profile) {
      return res.status(404).json({ code: 'NEEDS_ONBOARDING', message: 'Bạn chưa có tài khoản — trả lời vài câu hỏi để NUTRIVA tạo kế hoạch cho bạn', email, name: payload.name ?? '' });
    }
    if (!consent) throw new HttpError(400, 'Bạn cần đồng ý để NUTRIVA sử dụng thông tin');
    user = await createUser({
      email,
      name: (name || payload.name || email.split('@')[0]).toString(),
      googleId: payload.sub,
      avatar: payload.picture,
      profile,
      survey,
    });
    res.status(201).json({ token: signToken(user), user: publicUser(user) });
  }),
);

router.post(
  '/login',
  ah(async (req, res) => {
    const { email, password } = req.body ?? {};
    const user = await User.findOne({ email: (email ?? '').toLowerCase() });
    if (user && !user.passwordHash) throw new HttpError(401, 'Tài khoản này đăng nhập bằng Google — bấm "Tiếp tục với Google"');
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
    // Tài khoản Google chưa có mật khẩu: được đặt mật khẩu mới mà không cần mật khẩu cũ
    if (req.user.passwordHash && !(await bcrypt.compare(current ?? '', req.user.passwordHash))) throw new HttpError(400, 'Mật khẩu hiện tại không đúng');
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
