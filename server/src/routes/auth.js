import crypto from 'node:crypto';
import { Router } from 'express';
import bcrypt from 'bcryptjs';
import { OAuth2Client } from 'google-auth-library';
import { User, Reminder, WeightEntry, PasswordReset } from '../models/index.js';
import { nowInTz } from '../services/scheduler.js';
import { imageUpload, saveImage, deleteImage } from '../services/files.js';
import { adminEmails } from '../seed.js';
import { ah, requireAuth, signToken, HttpError } from '../middleware/auth.js';
import { loginLimiter, signupLimiter } from '../middleware/limits.js';
import { audit } from '../services/audit.js';
import { track } from '../services/events.js';
import { deleteAccount } from '../services/accounts.js';
import { sendMail, appUrl } from '../services/mail.js';
import { computeHealth, profileAge } from '../../../shared/nutrition.js';

const router = Router();

export const publicUser = (u) => ({
  id: u._id,
  email: u.email,
  name: u.name,
  role: u.role,
  avatar: u.avatar ?? '',
  profile: u.profile && { ...(u.profile.toObject?.() ?? u.profile), age: profileAge(u.profile) },
  address: u.address ?? {},
  health: computeHealth(u.profile),
  activePlan: u.activePlan?.plan ? { plan: u.activePlan.plan, startDate: u.activePlan.startDate } : null,
  hasPassword: Boolean(u.passwordHash),
  membership: { until: u.membership?.until ?? null, trialStart: u.membership?.trialStart ?? null },
  google: Boolean(u.googleId),
  createdAt: u.createdAt,
});

const EMAIL_RE = /^[^\s@]+@[^\s@.]+(?:\.[^\s@.]+)+$/;
const PW_MIN = 6;
const PW_MAX = 128; // bcrypt chỉ dùng 72 byte đầu; chặn chuỗi quá dài làm chậm server
const escapeHtml = (s = '') => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
const checkPassword = (pw, label = 'Mật khẩu') => {
  if (typeof pw !== 'string' || pw.length < PW_MIN) throw new HttpError(400, `${label} cần ít nhất ${PW_MIN} ký tự`);
  if (pw.length > PW_MAX) throw new HttpError(400, `${label} tối đa ${PW_MAX} ký tự`);
};

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
  signupLimiter,
  ah(async (req, res) => {
    const { email, password, name, profile, consent, survey, anon } = req.body ?? {};
    if (typeof email !== 'string' || !EMAIL_RE.test(email)) throw new HttpError(400, 'Email không hợp lệ');
    checkPassword(password);
    if (typeof name !== 'string' || !name.trim()) throw new HttpError(400, 'Vui lòng nhập tên');
    if (!consent) throw new HttpError(400, 'Bạn cần đồng ý để NUTRIVA sử dụng thông tin');
    if (await User.exists({ email: email.toLowerCase() })) throw new HttpError(409, 'Email đã được đăng ký');

    const user = await createUser({ email, name, passwordHash: await bcrypt.hash(password, 10), profile, survey });
    await audit(req, 'auth.register', { actor: user, entity: 'User', entityId: user._id, summary: `${user.email} (email)` });
    track('user.signup', { user, anon: typeof anon === 'string' ? anon.slice(0, 40) : undefined, req, props: { method: 'email' } });
    res.status(201).json({ token: signToken(user), user: publicUser(user) });
  }),
);

// ---- Đăng nhập Google (Google Identity Services: client gửi ID token, server xác minh) ----
const googleClientId = () => process.env.GOOGLE_CLIENT_ID || null;
let googleClient = null;

router.get('/config', (req, res) => res.json({ googleClientId: googleClientId() }));

router.post(
  '/google',
  loginLimiter,
  ah(async (req, res) => {
    const clientId = googleClientId();
    if (!clientId) throw new HttpError(503, 'Đăng nhập Google chưa được cấu hình');
    const { credential, profile, consent, survey, name, anon } = req.body ?? {};
    if (typeof credential !== 'string' || !credential) throw new HttpError(400, 'Thiếu thông tin đăng nhập Google');

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
      await audit(req, 'auth.login', { actor: user, entity: 'User', entityId: user._id, summary: 'bằng Google' });
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
    await audit(req, 'auth.register', { actor: user, entity: 'User', entityId: user._id, summary: `${user.email} (google)` });
    track('user.signup', { user, anon: typeof anon === 'string' ? anon.slice(0, 40) : undefined, req, props: { method: 'google' } });
    res.status(201).json({ token: signToken(user), user: publicUser(user) });
  }),
);

router.post(
  '/login',
  loginLimiter,
  ah(async (req, res) => {
    const { email, password } = req.body ?? {};
    if (typeof email !== 'string' || typeof password !== 'string') throw new HttpError(400, 'Nhập email và mật khẩu');
    const user = await User.findOne({ email: email.trim().toLowerCase() });
    if (user && !user.passwordHash) throw new HttpError(401, 'Tài khoản này đăng nhập bằng Google — bấm "Tiếp tục với Google"');
    if (!user || password.length > PW_MAX || !(await bcrypt.compare(password, user.passwordHash))) {
      await audit(req, 'auth.login_failed', { ok: false, actor: user ?? { _id: null, email: email.slice(0, 80) }, entity: 'User', entityId: user?._id, summary: user ? 'sai mật khẩu' : 'email không tồn tại' });
      throw new HttpError(401, 'Email hoặc mật khẩu không đúng');
    }
    await audit(req, 'auth.login', { actor: user, entity: 'User', entityId: user._id, summary: 'bằng email' });
    res.json({ token: signToken(user), user: publicUser(user) });
  }),
);

// ---- Quên mật khẩu: gửi link đặt lại qua email (hiệu lực 30 phút, dùng 1 lần) ----
const RESET_TTL_MS = 30 * 60 * 1000;
const hashToken = (t) => crypto.createHash('sha256').update(t).digest('hex');

router.post(
  '/forgot',
  signupLimiter,
  ah(async (req, res) => {
    const email = typeof req.body?.email === 'string' ? req.body.email.trim().toLowerCase() : '';
    if (!EMAIL_RE.test(email)) throw new HttpError(400, 'Email không hợp lệ');
    const user = await User.findOne({ email });
    // Luôn trả lời giống nhau (không để lộ email nào đã đăng ký)
    if (user) {
      const token = crypto.randomBytes(32).toString('base64url');
      await PasswordReset.deleteMany({ user: user._id });
      await PasswordReset.create({ user: user._id, tokenHash: hashToken(token), expiresAt: new Date(Date.now() + RESET_TTL_MS) });
      const link = `${appUrl()}/reset-password?token=${token}`;
      await sendMail({
        to: user.email,
        subject: 'Đặt lại mật khẩu NUTRIVA',
        text: `Chào ${user.name},\n\nBấm vào link sau để đặt mật khẩu mới (hiệu lực 30 phút):\n${link}\n\nNếu bạn không yêu cầu, hãy bỏ qua email này.`,
        html: `<p>Chào ${escapeHtml(user.name)},</p><p>Bấm nút dưới đây để đặt mật khẩu mới. Link có hiệu lực trong <b>30 phút</b>.</p><p><a href="${link}" style="display:inline-block;padding:12px 20px;background:#567324;color:#fff;border-radius:12px;text-decoration:none;font-weight:600">Đặt mật khẩu mới</a></p><p style="color:#666;font-size:13px">Nếu bạn không yêu cầu, hãy bỏ qua email này — mật khẩu của bạn vẫn giữ nguyên.</p>`,
      }).catch((e) => console.error('[mail]', e.message));
      await audit(req, 'auth.password_reset_request', { actor: user, entity: 'User', entityId: user._id });
    }
    res.json({ ok: true, message: 'Nếu email đã đăng ký, NUTRIVA đã gửi link đặt lại mật khẩu. Kiểm tra cả hộp thư Spam nhé.' });
  }),
);

router.post(
  '/reset',
  signupLimiter,
  ah(async (req, res) => {
    const { token, password } = req.body ?? {};
    if (typeof token !== 'string' || token.length < 20) throw new HttpError(400, 'Link không hợp lệ');
    checkPassword(password, 'Mật khẩu mới');
    const reset = await PasswordReset.findOneAndUpdate(
      { tokenHash: hashToken(token), usedAt: null, expiresAt: { $gt: new Date() } },
      { usedAt: new Date() },
    );
    if (!reset) throw new HttpError(400, 'Link đã hết hạn hoặc đã được dùng — vui lòng yêu cầu link mới');
    // Mật khẩu mới → thu hồi mọi phiên cũ (kể cả của kẻ đã lấy được mật khẩu cũ)
    const user = await User.findByIdAndUpdate(reset.user, { passwordHash: await bcrypt.hash(password, 10), $inc: { tokenVersion: 1 } }, { new: true });
    if (!user) throw new HttpError(400, 'Tài khoản không còn tồn tại');
    await PasswordReset.deleteMany({ user: user._id });
    await audit(req, 'auth.password_reset', { actor: user, entity: 'User', entityId: user._id });
    res.json({ token: signToken(user), user: publicUser(user) });
  }),
);

router.get('/me', requireAuth, (req, res) => res.json({ user: publicUser(req.user) }));

router.patch(
  '/me',
  requireAuth,
  ah(async (req, res) => {
    const { name, profile, address } = req.body ?? {};
    if (typeof name === 'string' && name.trim()) req.user.name = name.trim().slice(0, 60);
    const prevKg = req.user.profile.weightKg;
    if (profile && typeof profile === 'object') {
      const cur = req.user.profile.toObject();
      const { birthYear, ...rest } = profile;
      // Người dùng tự nhập vòng eo → không còn là số ước tính
      const measured = rest.waistCm !== undefined && Number(rest.waistCm) !== cur.waistCm ? { waistEstimated: false } : {};
      req.user.profile = { ...cur, age: profileAge(cur), ...rest, ...measured, ...(Number(birthYear) ? { birthYear: Number(birthYear), age: undefined } : {}) };
    }
    if (address && typeof address === 'object') {
      const a = req.user.address?.toObject?.() ?? {};
      req.user.address = { name: String(address.name ?? a.name ?? '').slice(0, 60), phone: String(address.phone ?? a.phone ?? '').slice(0, 20), line: String(address.line ?? a.line ?? '').slice(0, 200) };
    }
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
    if (req.user.passwordHash && !(await bcrypt.compare(String(current ?? '').slice(0, PW_MAX), req.user.passwordHash))) {
      await audit(req, 'auth.password_change', { ok: false, entity: 'User', entityId: req.user._id, summary: 'sai mật khẩu hiện tại' });
      throw new HttpError(400, 'Mật khẩu hiện tại không đúng');
    }
    checkPassword(next, 'Mật khẩu mới');
    req.user.passwordHash = await bcrypt.hash(next, 10);
    // Đổi mật khẩu → đăng xuất các thiết bị khác; thiết bị hiện tại nhận token mới
    req.user.tokenVersion = (req.user.tokenVersion ?? 0) + 1;
    await req.user.save();
    await audit(req, 'auth.password_change', { entity: 'User', entityId: req.user._id });
    res.json({ ok: true, token: signToken(req.user) });
  }),
);

// Đăng xuất khỏi mọi thiết bị (mất điện thoại, dùng máy lạ...) — thiết bị hiện tại nhận token mới
router.post(
  '/me/logout-all',
  requireAuth,
  ah(async (req, res) => {
    const user = await User.findByIdAndUpdate(req.user._id, { $inc: { tokenVersion: 1 } }, { new: true });
    await audit(req, 'auth.logout_all', { entity: 'User', entityId: user._id });
    res.json({ ok: true, token: signToken(user) });
  }),
);

// Xóa tài khoản: xóa dữ liệu cá nhân, giữ đơn hàng ẩn danh (xem services/accounts.js)
router.delete(
  '/me',
  requireAuth,
  ah(async (req, res) => {
    const { email, _id } = req.user;
    await deleteAccount(_id);
    await audit(req, 'auth.delete_account', { actor: { _id: null, email, role: 'user' }, entity: 'User', entityId: _id, summary: email });
    res.status(204).end();
  }),
);

export default router;
