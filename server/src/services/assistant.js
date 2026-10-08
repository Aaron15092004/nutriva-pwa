import { computeHealth, GOALS, FLAVORS, ingredientName } from '../../../shared/nutrition.js';
import { rankMilks, safeProducts } from './plan.js';

// Trả lời dự phòng theo từ khóa — dùng khi chưa cấu hình ANTHROPIC_API_KEY hoặc API lỗi.
const norm = (s) =>
  s
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/đ/g, 'd');

const has = (text, ...words) => words.some((w) => text.includes(norm(w)));
const fmt = (n) => n.toLocaleString('vi-VN');

const card = (p) => ({ slug: p.slug, name: p.name, type: p.type, image: p.image, price: p.price, subtitle: p.subtitle });

export function replyByRules(message, user, products) {
  const t = norm(message);
  const profile = user.profile.toObject();
  const h = computeHealth(profile);
  const goal = GOALS.find((g) => g.id === profile.goal)?.label.toLowerCase();
  const milks = rankMilks(products, profile);
  const top = milks[0];

  if (has(t, 'ngot', 'duong')) {
    const p = milks.find((m) => m.flavor === 'thanh-nhe') ?? top;
    return {
      text: `Bạn có thể chọn "Không thêm đường" khi đặt hàng — vị ngọt chỉ đến tự nhiên từ hạt. ${p ? `Dòng ${p.name} có vị thanh nhẹ, rất hợp với người thích ít ngọt.` : ''} Hãy kiểm tra thông tin thành phần trước khi đặt nhé.`,
      product: p ? card(p) : undefined,
    };
  }

  if (has(t, 'vi sao', 'tai sao', 'sao chon', 'sua hat', 'sua nao', 'hop voi')) {
    return {
      text: top
        ? `Mình gợi ý ${top.name} vì: hương vị ${FLAVORS.find((f) => f.id === top.flavor)?.label.toLowerCase()}${top.flavor === profile.flavor ? ' đúng sở thích bạn đã chọn' : ''}, khoảng ${top.nutrition.kcal} kcal/chai phù hợp bữa ăn nhẹ (mục tiêu bữa nhẹ của bạn: ${h.meals.snack.min}–${h.meals.snack.max} kcal)${profile.allergies.length ? `, và không chứa ${profile.allergies.map(ingredientName).join(', ')}` : ''}.`
        : 'Hiện chưa có dòng sữa nào an toàn với danh sách thực phẩm cần tránh của bạn. Bạn có thể trao đổi với chuyên gia để được tư vấn thêm.',
      product: top ? card(top) : undefined,
      link: top ? { to: `/why/${top.slug}`, label: 'Xem lý do chi tiết' } : undefined,
    };
  }

  if (has(t, 'set', 'tu lam', 'doi set')) {
    const sets = safeProducts(products, profile).filter((p) => p.type === 'diy');
    const s = sets.find((p) => p.flavor === profile.flavor) ?? sets[0];
    return {
      text: s
        ? `Set tự làm ${s.name} gồm nguyên liệu đã chia phần cho khoảng 1 lít sữa, kèm hướng dẫn 4 bước (chuẩn bị – sơ chế – chế biến – bảo quản). Bạn có thể đổi sang set khác bất cứ lúc nào trong Cửa hàng.`
        : 'Chưa có set tự làm nào an toàn với danh sách thực phẩm cần tránh của bạn.',
      product: s ? card(s) : undefined,
    };
  }

  if (has(t, 'an chay', 'thuan chay', 'dam thuc vat')) {
    return {
      text: `Ăn chay vẫn đủ đạm nếu mỗi bữa có nguồn đạm thực vật: đậu phụ, đậu nành, đỗ đen, đậu trắng và các loại hạt. Mục tiêu đạm của bạn khoảng ${h.macros.protein} g/ngày — kết hợp ngũ cốc nguyên hạt với đậu đỗ để đủ axit amin. Bạn có thể thử kế hoạch "Thuần chay" trong mục Khám phá thực đơn.`,
      link: { to: '/plan?tab=explore', label: 'Xem kế hoạch thuần chay' },
    };
  }

  if (has(t, 'ke hoach', 'dieu chinh', 'thuc don', 'menu', 'an them', 'nen an', 'an gi')) {
    return {
      text: `Kế hoạch hiện tại theo mục tiêu ${goal}: ${fmt(h.targetKcal)} kcal/ngày (đạm ${h.macros.protein} g, bột đường ${h.macros.carb} g, béo ${h.macros.fat} g). Bạn có thể bấm "Đổi món" ở từng bữa trong trang Kế hoạch để thay món phù hợp hơn.`,
      link: { to: '/plan', label: 'Mở Kế hoạch' },
    };
  }

  if (has(t, 'bmi', 'calo', 'kcal', 'chi so', 'tdee', 'bmr', 'vong eo', 'whtr')) {
    return {
      text: `Chỉ số của bạn: BMI ${h.bmi} (${h.bmiCategory.label}), WHtR ${h.whtr} (${h.whtrCategory?.label}), BMR ${fmt(h.bmr)} kcal, TDEE ${fmt(h.tdee)} kcal (hệ số vận động ${h.activityFactor}). Mục tiêu ${goal}: ${fmt(h.targetKcal)} kcal/ngày.`,
    };
  }

  if (has(t, 'giam can')) {
    return {
      text: `Để giảm cân an toàn, NUTRIVA đặt mức thâm hụt khoảng 500 kcal/ngày so với TDEE (≈0,5 kg/tuần). Ưu tiên đạm nạc, rau xanh, hạn chế đồ uống có đường và vận động ít nhất 30 phút/ngày.`,
    };
  }

  if (has(t, 'tang can')) {
    return {
      text: `Để tăng cân lành mạnh, hãy ăn dư khoảng 300 kcal/ngày so với TDEE, thêm bữa ăn nhẹ giàu năng lượng như sữa hạt, các loại hạt, bơ, và tập tạ 2–3 buổi/tuần để tăng cơ thay vì mỡ.`,
      product: top ? card(top) : undefined,
    };
  }

  if (has(t, 'nuoc', 'uong nuoc')) {
    return { text: `Mục tiêu nước của bạn là ${fmt(h.waterMl)} ml/ngày (≈35 ml × cân nặng). Bạn có thể đặt nhắc nhở uống nước trong mục Nhắc nhở.`, link: { to: '/track/reminders', label: 'Đặt nhắc nhở' } };
  }

  if (/\b(chao|hello|hi)\b/.test(t)) {
    return { text: `Chào ${user.name}! Mình có thể giải thích chỉ số sức khỏe, gợi ý sữa hạt, set tự làm hoặc cách điều chỉnh kế hoạch cho bạn.` };
  }

  return {
    text: 'Mình chưa hiểu rõ câu hỏi. Bạn thử hỏi: "Sữa hạt nào hợp với mình?", "Hôm nay nên ăn gì?", "Chỉ số BMI của tôi", "Ăn chay có đủ đạm không?" hoặc "Uống bao nhiêu nước là đủ?" nhé.',
  };
}
