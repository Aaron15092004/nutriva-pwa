import { rateLimit, ipKeyGenerator } from 'express-rate-limit';

// Giới hạn tần suất request (bộ nhớ trong từng server — đủ cho 1–2 instance; nhiều instance thì chuyển sang store Redis/Mongo).
const isProd = process.env.NODE_ENV === 'production';
const scale = isProd ? 1 : 20; // môi trường phát triển/kiểm thử: nới rộng
const common = { standardHeaders: 'draft-8', legacyHeaders: false };
const msg = (message) => ({ message });
const byUserOrIp = (req) => (req.user ? `u:${req.user._id}` : ipKeyGenerator(req.ip ?? ''));

// Toàn bộ API: chặn spam/quét (đủ rộng cho mạng dùng chung như trường học, công ty)
export const apiLimiter = rateLimit({ ...common, windowMs: 5 * 60 * 1000, limit: 1500 * scale, message: msg('Bạn thao tác quá nhanh, vui lòng thử lại sau ít phút') });

// Đăng nhập: chỉ đếm lần SAI (đăng nhập đúng không bị tính)
export const loginLimiter = rateLimit({ ...common, windowMs: 15 * 60 * 1000, limit: 10 * scale, skipSuccessfulRequests: true, message: msg('Sai thông tin quá nhiều lần, vui lòng thử lại sau 15 phút') });

// Đăng ký / quên mật khẩu: chống tạo tài khoản & gửi mail hàng loạt
export const signupLimiter = rateLimit({ ...common, windowMs: 60 * 60 * 1000, limit: 8 * scale, message: msg('Quá nhiều yêu cầu từ thiết bị này, vui lòng thử lại sau') });

// Trợ lý AI: mỗi người tối đa 30 câu/giờ (kiểm soát chi phí Claude)
export const assistantLimiter = rateLimit({ ...common, windowMs: 60 * 60 * 1000, limit: 30 * scale, keyGenerator: byUserOrIp, message: msg('Bạn đã hỏi Nuti khá nhiều trong giờ qua — nghỉ một chút rồi hỏi tiếp nhé') });

// Sự kiện thống kê từ client
export const eventsLimiter = rateLimit({ ...common, windowMs: 60 * 1000, limit: 60 * scale, message: msg('Quá nhiều sự kiện') });
