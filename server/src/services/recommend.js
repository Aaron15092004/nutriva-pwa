import { FLAVORS, SWEETNESS, PREFERENCES, ingredientName } from '../../../shared/nutrition.js';

const label = (list, id) => list.find((x) => x.id === id)?.label ?? id;

// Giải thích "Vì sao gợi ý này?" cho một sản phẩm, dựa trên hồ sơ người dùng.
export function explainProduct(product, profile) {
  const conflicts = product.ingredients.filter((i) => profile.allergies.includes(i));
  const reasons = [];

  if (product.flavor === profile.flavor) {
    reasons.push({
      icon: 'leaf',
      title: 'Theo sở thích của bạn',
      text: `Bạn đã chọn hương vị ${label(FLAVORS, profile.flavor).toLowerCase()} — sản phẩm này đúng gu đó, ${label(SWEETNESS, profile.sweetness).toLowerCase()}.`,
    });
  } else {
    reasons.push({
      icon: 'leaf',
      title: 'Đa dạng khẩu vị',
      text: `Vị ${label(FLAVORS, product.flavor).toLowerCase()} giúp bạn đổi vị trong tuần, vẫn có thể chọn ${label(SWEETNESS, profile.sweetness).toLowerCase()}.`,
    });
  }

  reasons.push({
    icon: 'calendar',
    title: 'Theo thói quen hằng ngày',
    text:
      profile.preference === 'diy'
        ? 'Bạn thích tự làm tại nhà — dòng này có sẵn set nguyên liệu chia phần và hướng dẫn từng bước.'
        : `Bạn ưu tiên ${label(PREFERENCES, profile.preference).toLowerCase()} — chai 330 ml dễ mang theo cho bữa ăn nhẹ.`,
  });

  if (profile.allergies.length) {
    reasons.push({
      icon: 'ban',
      title: 'Thực phẩm cần tránh',
      text: conflicts.length
        ? `Sản phẩm có chứa ${conflicts.map(ingredientName).join(', ')} — nằm trong danh sách bạn cần tránh.`
        : `Đã kiểm tra và loại trừ: ${profile.allergies.map(ingredientName).join(', ')}.`,
      danger: conflicts.length > 0,
    });
  }

  const goalText = {
    lose: `Khoảng ${product.nutrition.kcal} kcal/chai — vừa với bữa ăn nhẹ khi giảm cân, giúp no lâu nhờ chất béo tốt.`,
    gain: `Bổ sung ~${product.nutrition.kcal} kcal và chất béo tốt — cách dễ để tăng năng lượng khi muốn tăng cân.`,
    maintain: `~${product.nutrition.kcal} kcal/chai, cân bằng đạm – bột đường – béo cho bữa ăn nhẹ hằng ngày.`,
  };
  reasons.push({ icon: 'target', title: 'Phù hợp mục tiêu', text: goalText[profile.goal] });

  return { reasons, conflicts, safe: conflicts.length === 0 };
}
