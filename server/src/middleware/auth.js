import jwt from 'jsonwebtoken';
import { User } from '../models/index.js';

export const signToken = (user) =>
  jwt.sign({ sub: user._id.toString() }, process.env.JWT_SECRET, { expiresIn: '30d' });

export async function requireAuth(req, res, next) {
  const header = req.headers.authorization ?? '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : null;
  if (!token) return res.status(401).json({ message: 'Vui lòng đăng nhập' });
  try {
    const { sub } = jwt.verify(token, process.env.JWT_SECRET);
    const user = await User.findById(sub);
    if (!user) return res.status(401).json({ message: 'Tài khoản không tồn tại' });
    req.user = user;
    next();
  } catch {
    res.status(401).json({ message: 'Phiên đăng nhập đã hết hạn' });
  }
}

export function requireAdmin(req, res, next) {
  if (req.user?.role !== 'admin') return res.status(403).json({ message: 'Bạn không có quyền truy cập' });
  next();
}

// Bọc handler async để lỗi được chuyển tới error middleware
export const ah = (fn) => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);

export class HttpError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}
