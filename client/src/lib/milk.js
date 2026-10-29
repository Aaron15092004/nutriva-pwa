import { sendOrQueue, newCid } from './outbox.js';

// Sữa hạt trong nhật ký: ghi theo thực phẩm "sua-hat-nutriva" (dinh dưỡng / 100 ml lấy từ bảng thực phẩm ở server).
export const MILK_FOOD_ID = 'sua-hat-nutriva';
export const BOTTLE_ML = 330;
const PER_100 = { kcal: 50, protein: 1.6, carb: 6, fat: 2.4 }; // chỉ dùng hiển thị tạm khi đang ngoại tuyến

export const isMilkEntry = (e) => e.foodId === MILK_FOOD_ID || /^sữa hạt/i.test(e.name ?? '');

// Số chai sữa hạt đã ghi trong ngày (quy đổi theo ml)
export function milkBottles(log) {
  const ml = Object.values(log?.meals ?? {})
    .flat()
    .filter(isMilkEntry)
    .reduce((s, e) => s + (e.grams ?? 0), 0);
  return Math.round((ml / BOTTLE_ML) * 10) / 10;
}

// Ghi 1 chai vào bữa phụ; mất mạng → hiện tạm trên máy, gửi khi có mạng
export async function logBottle(date, log, milk, meal = 'snack') {
  const cid = newCid();
  const name = `Sữa hạt NUTRIVA${milk ? ` ${milk.name}` : ''}`.slice(0, 80);
  const d = await sendOrQueue(`/logs/${date}/meals/${meal}`, { foodId: MILK_FOOD_ID, grams: BOTTLE_ML, name, cid });
  if (!d.queued) return { log: d.log, queued: false };
  const k = BOTTLE_ML / 100;
  const entry = { _id: cid, cid, foodId: MILK_FOOD_ID, name, grams: BOTTLE_ML, kcal: Math.round(PER_100.kcal * k), protein: +(PER_100.protein * k).toFixed(1), carb: +(PER_100.carb * k).toFixed(1), fat: +(PER_100.fat * k).toFixed(1), pending: true };
  return { log: { ...log, meals: { ...log?.meals, [meal]: [...(log?.meals?.[meal] ?? []), entry] } }, queued: true };
}
