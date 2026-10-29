import jwt from 'jsonwebtoken';
import { User } from '../models/index.js';

// Token chứa phiên bản (v): đổi/đặt lại mật khẩu → tăng tokenVersion → mọi phiên cũ hết hiệu lực.
export const signToken = (user) =>
  jwt.sign({ sub: user._id.toString(), v: user.tokenVersion ?? 0 }, process.env.JWT_SECRET, { expiresIn: '30d' });

const ACTIVE_EVERY_MS = 60 * 60 * 1000; // ghi "lần hoạt động gần nhất" tối đa 1 lần/giờ

export async function requireAuth(req, res, next) {
  const header = req.headers.authorization ?? '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : null;
  if (!token) return res.status(401).json({ message: 'Vui lòng đăng nhập' });

  // 1) Lỗi token → 401 (client sẽ đăng xuất)
  let payload;
  try {
    payload = jwt.verify(token, process.env.JWT_SECRET);
  } catch {
    return res.status(401).json({ message: 'Phiên đăng nhập đã hết hạn' });
  }

  // 2) Lỗi DB → 503 (KHÔNG đăng xuất người dùng chỉ vì mất kết nối tạm thời)
  let user;
  try {
    user = await User.findById(payload.sub);
  } catch (e) {
    console.error('[auth] db', e.message);
    return res.status(503).json({ message: 'Máy chủ đang bận, vui lòng thử lại sau giây lát' });
  }
  if (!user) return res.status(401).json({ message: 'Tài khoản không tồn tại' });
  if ((payload.v ?? 0) !== (user.tokenVersion ?? 0)) return res.status(401).json({ message: 'Phiên đăng nhập đã hết hạn, vui lòng đăng nhập lại' });

  req.user = user;
  if (!user.lastActiveAt || Date.now() - user.lastActiveAt.getTime() > ACTIVE_EVERY_MS) {
    User.updateOne({ _id: user._id }, { lastActiveAt: new Date() }).catch(() => {});
  }
  next();
}

export function requireAdmin(req, res, next) {
  if (req.user?.role !== 'admin') return res.status(403).json({ message: 'Bạn không có quyền truy cập' });
  next();
}

// Tính năng cần gói sử dụng còn hạn (kế hoạch đầy đủ, nhắc nhở…). Client nhận code MEMBERSHIP_REQUIRED → hiện màn hình kích hoạt.
export class MembershipRequired extends Error {
  constructor(message = 'Tính năng này cần kích hoạt gói NUTRIVA — nhập mã trên chai sữa hoặc mua sữa để mở khóa') {
    super(message);
    this.status = 403;
    this.code = 'MEMBERSHIP_REQUIRED';
  }
}

// Bọc handler async để lỗi được chuyển tới error middleware
export const ah = (fn) => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);

export class HttpError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}
