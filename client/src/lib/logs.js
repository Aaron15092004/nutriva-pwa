import { api } from './api.js';
import { sendOrQueue, newCid } from './outbox.js';

// Thêm/bớt nước. Mất mạng → cập nhật tạm trên máy (gửi khi có mạng). Trả về { log, queued }.
export async function changeWater(date, log, ml) {
  const d = await sendOrQueue(`/logs/${date}/water`, { ml, cid: newCid() });
  if (!d.queued) return { log: d.log, queued: false };
  return { log: { ...log, waterMl: Math.max(0, (log?.waterMl ?? 0) + ml) }, queued: true };
}

// Ghi vận động (không có kết quả tạm khi mất mạng — chỉ báo đã xếp hàng)
export const addExercise = (date, body) => sendOrQueue(`/logs/${date}/exercises`, { ...body, cid: newCid() });

// Món của thực đơn → dữ liệu ghi nhật ký
const planItemBody = (it) =>
  it.kind === 'food'
    ? { foodId: it.food, grams: it.grams, name: it.name }
    : { name: it.name, grams: Math.round((it.portion ?? 1) * 100), kcal: it.kcal, protein: it.protein, carb: it.carb, fat: it.fat };

// Ghi một món của thực đơn vào nhật ký
export async function logPlanItem(date, it) {
  return (await api.post(`/logs/${date}/meals/${it.meal}`, planItemBody(it))).log;
}

// Ghi cả bữa trong 1 lần (bỏ qua món đã ghi)
export async function logPlanMeal(date, meal, items) {
  return (await api.post(`/logs/${date}/meals/${meal}/batch`, { items: items.map(planItemBody) })).log;
}
