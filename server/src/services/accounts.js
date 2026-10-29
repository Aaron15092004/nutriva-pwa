import {
  User, DailyLog, PlanChoice, Order, Subscription, Reminder, SupportRequest, PushSubscription, WeightEntry, MealPlan, ChatMessage, PasswordReset, Event,
} from '../models/index.js';
import { deleteImage } from './files.js';

// Xóa tài khoản (người dùng tự xóa hoặc admin xóa):
// - Xóa dữ liệu cá nhân: nhật ký, cân nặng, nhắc nhở, thực đơn tự tạo, chat, hỗ trợ, gói định kỳ, thông báo đẩy.
// - GIỮ đơn hàng cho kế toán nhưng ẩn danh (xóa tên, SĐT, địa chỉ).
// - Sự kiện thống kê được tách khỏi người dùng (giữ số liệu tổng, không còn liên kết cá nhân).
export async function deleteAccount(userId) {
  const user = await User.findById(userId).lean();
  if (!user) return false;
  await Promise.all([
    ...[DailyLog, PlanChoice, Subscription, Reminder, SupportRequest, PushSubscription, WeightEntry, ChatMessage, PasswordReset].map((m) => m.deleteMany({ user: userId })),
    MealPlan.deleteMany({ owner: userId }),
    Order.updateMany({ user: userId }, { $set: { anonymized: true, address: { name: 'Tài khoản đã xóa', phone: '', line: '' } }, $unset: { adminNote: 1 } }),
    Event.updateMany({ user: userId }, { $set: { user: null } }),
  ]);
  await deleteImage(user.avatar);
  await User.deleteOne({ _id: userId });
  return true;
}
