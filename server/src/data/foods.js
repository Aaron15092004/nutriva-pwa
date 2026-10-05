import { readFileSync } from 'node:fs';

// Giá trị dinh dưỡng trên 100 g (hoặc 100 ml) phần ăn được — số liệu tham khảo.
// group: dùng để chọn icon trên client. allergens: id trong INGREDIENTS.
// plant: true nếu phù hợp người ăn chay linh hoạt.
// 635+ thực phẩm từ Bảng thành phần thực phẩm Việt Nam (Viện Dinh dưỡng) + vài thực phẩm bổ sung (USDA).
// Tạo từ figma/datathucpham/*.xlsx — xem scripts/import-foods.js để nạp lại vào database.
export const FOODS = JSON.parse(readFileSync(new URL('./foods-vn.json', import.meta.url), 'utf8'));

// Gợi ý thực phẩm theo mục tiêu (foods: danh sách từ DB, đã chuẩn hóa id = key)
const MAIN = ['grain', 'tuber', 'veg', 'mushroom', 'fruit', 'legume', 'meat', 'poultry', 'seafood', 'egg', 'dairy'];
// Loại khỏi gợi ý: đồ khô/bột/muối/hộp, thịt hiếm, thực phẩm đặc biệt (vẫn tìm & ghi nhật ký được)
const NOT_SUGGEST = /(sữa mẹ|khô|muối|bột|hộp|sống|lộn|chó|ngựa|hươu|rừng|trứng cá|men |hạt đen|quả đại|quả cọ|cùi dừa|nhộng|châu chấu|ếch|ba ba|rươi|rạm|sứa|công nghiệp|loại béo|vớt béo)/i;
const GOAL_RULES = {
  lose: { why: 'Ít calo, giàu đạm/chất xơ — no lâu', pick: (f) => f.kcal <= 150 && (f.protein >= 10 || ['veg', 'mushroom', 'fruit'].includes(f.group)) },
  gain: { why: 'Giàu năng lượng & chất béo tốt', pick: (f) => f.kcal >= 150 && ['grain', 'tuber', 'legume', 'meat', 'poultry', 'seafood', 'egg', 'dairy', 'fruit'].includes(f.group) },
  maintain: { why: 'Cân bằng, đa dạng nhóm chất', pick: (f) => f.kcal < 300 },
};

export function suggestFoods(profile, foods, limit = 8, seed = Math.floor(Date.now() / 86400000)) {
  const allergies = profile?.allergies ?? [];
  const rule = GOAL_RULES[profile?.goal] ?? GOAL_RULES.maintain;
  const eligible = foods
    .filter((f) => MAIN.includes(f.group) && !NOT_SUGGEST.test(f.name) && rule.pick(f))
    .filter((f) => !(f.allergens ?? []).some((a) => allergies.includes(a)))
    .filter((f) => (profile?.diet === 'flex-veg' ? f.plant : true));

  // Xoay vòng giữa các nhóm (đạm, rau, trái cây, tinh bột…) và đổi danh sách mỗi ngày
  const byGroup = Object.values(Object.groupBy(eligible, (f) => f.group)).map((g) => {
    const off = seed % g.length;
    return [...g.slice(off), ...g.slice(0, off)];
  });
  const picked = [];
  for (let i = 0; picked.length < limit && byGroup.some((g) => g[i]); i++) {
    for (const g of byGroup) if (g[i] && picked.length < limit) picked.push(g[i]);
  }
  return picked.map((f) => ({ ...f, why: rule.why }));
}
