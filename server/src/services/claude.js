import Anthropic from '@anthropic-ai/sdk';
import { GOALS, FLAVORS, SWEETNESS, ACTIVITY_LEVELS, DIETS, ingredientName } from '../../../shared/nutrition.js';
import { safeProducts } from './plan.js';

// Trợ lý NUTRIVA dùng Claude API. Cần ANTHROPIC_API_KEY (hoặc credential khác SDK tự nhận).
const MODEL = process.env.ANTHROPIC_MODEL || 'claude-opus-5-5';
let client = null;

export const claudeEnabled = () => Boolean(process.env.ANTHROPIC_API_KEY || process.env.ANTHROPIC_AUTH_TOKEN);

const getClient = () => (client ??= new Anthropic());

// Phần ổn định của system prompt (cache được giữa các lượt)
const INSTRUCTIONS = `Bạn là "Nuti" — linh vật hạt óc chó và trợ lý dinh dưỡng trong ứng dụng NUTRIVA (sữa hạt tươi, set tự làm sữa hạt tại nhà, kế hoạch dinh dưỡng cá nhân). Xưng "mình", gọi người dùng là "bạn"; giọng ấm áp, vui vẻ nhưng chính xác.

Cách trả lời:
- Luôn trả lời bằng tiếng Việt, thân thiện, ngắn gọn (thường 2–5 câu, tối đa ~150 từ), không dùng markdown tiêu đề hay bảng; có thể xuống dòng hoặc gạch đầu dòng "- " khi liệt kê.
- Dựa trên hồ sơ, chỉ số và kế hoạch hôm nay của người dùng được cung cấp bên dưới. Dùng số liệu cụ thể của họ khi hữu ích.
- Chỉ gợi ý sản phẩm có trong danh mục được cung cấp (danh mục đã loại các sản phẩm chứa thực phẩm người dùng cần tránh). Không bịa sản phẩm, giá hay khuyến mãi.
- Khi gợi ý một sản phẩm cụ thể, thêm đúng một thẻ [[product:<slug>]] ở cuối câu trả lời (tối đa 1 thẻ).
- Khi nên dẫn người dùng tới một màn hình, thêm tối đa một thẻ [[link:<đường dẫn>]] với đường dẫn thuộc: /plan (thực đơn & kế hoạch ăn mẫu), /track (theo dõi), /track/reminders (nhắc nhở), /shop (cửa hàng), /me/edit (sửa hồ sơ), /me/support (gặp chuyên gia).
- Bạn không phải bác sĩ: không chẩn đoán, không kê đơn hay chế độ điều trị. Với bệnh lý (tiểu đường, thận, tim mạch, thai kỳ…), dị ứng nặng hoặc triệu chứng bất thường, khuyên họ hỏi bác sĩ/chuyên gia và gợi ý [[link:/me/support]].
- Không hỗ trợ chế độ ăn cực đoan (dưới mức BMR, nhịn ăn kéo dài) — giải thích nhẹ nhàng vì sao và đưa phương án an toàn.
- Nếu câu hỏi ngoài phạm vi dinh dưỡng/sức khỏe/ứng dụng, lịch sự đưa câu chuyện về chủ đề NUTRIVA.`;

const label = (list, id) => list.find((x) => x.id === id)?.label ?? id;

function userContext(user, health, products, today) {
  const p = user.profile;
  const safe = safeProducts(products, p);
  const catalog = safe
    .map((x) => `- ${x.slug} | ${x.type === 'diy' ? 'Set tự làm' : 'Sữa hạt'} ${x.name} | ${x.price}đ | ${label(FLAVORS, x.flavor)} | ${x.nutrition.kcal} kcal, đạm ${x.nutrition.protein} g`)
    .join('\n');
  const plan = today.plan.meals.map((m) => `- ${m.label}: ${m.item.name} (~${m.item.kcal} kcal)`).join('\n');
  return `Người dùng: ${user.name}, ${p.gender === 'male' ? 'nam' : 'nữ'}, ${p.age} tuổi, ${p.heightCm} cm, ${p.weightKg} kg, vòng eo ${p.waistCm} cm.
Mục tiêu: ${label(GOALS, p.goal)}. Vận động: ${label(ACTIVITY_LEVELS, p.activity)}. Chế độ ăn: ${label(DIETS, p.diet)}.
Khẩu vị: ${label(FLAVORS, p.flavor)}, ${label(SWEETNESS, p.sweetness)}; thích ${p.preference === 'diy' ? 'tự làm tại nhà' : 'sữa pha sẵn'}.
Cần tránh: ${p.allergies.length ? p.allergies.map(ingredientName).join(', ') : 'không có'}. Lưu ý sức khỏe: ${p.healthNote || 'không có'}.

Chỉ số: BMI ${health.bmi} (${health.bmiCategory.label}), WHtR ${health.whtr} (${health.whtrCategory?.label}), BMR ${health.bmr} kcal, TDEE ${health.tdee} kcal (hệ số ${health.activityFactor}).
Mục tiêu ngày: ${health.targetKcal} kcal — bột đường ${health.macros.carb} g, đạm ${health.macros.protein} g, béo ${health.macros.fat} g; nước ${health.waterMl} ml; vận động ${health.exerciseMin} phút.

Hôm nay (${today.date}): đã ăn ${Math.round(today.eaten.kcal)} kcal (đạm ${Math.round(today.eaten.protein)} g, bột đường ${Math.round(today.eaten.carb)} g, béo ${Math.round(today.eaten.fat)} g), uống ${today.waterMl} ml nước, vận động ${today.exerciseMin} phút.
Kế hoạch hôm nay:
${plan}

Danh mục sản phẩm an toàn cho người dùng (slug | tên | giá | vị | dinh dưỡng mỗi chai/330 ml):
${catalog || '(không có sản phẩm phù hợp)'}`;
}

const TAG_RE = /\[\[(product|link):([^\]\s]+)\]\]/g;

function parseReply(text, products) {
  let product;
  let link;
  for (const [, kind, value] of text.matchAll(TAG_RE)) {
    if (kind === 'product' && !product) product = products.find((p) => p.slug === value);
    if (kind === 'link' && !link && /^\/[a-z/]*$/.test(value)) link = { to: value, label: 'Mở trang liên quan' };
  }
  return { text: text.replace(TAG_RE, '').trim(), product, link };
}

export async function askClaude({ history, user, health, products, today }) {
  const response = await getClient().beta.messages.create({
    model: MODEL,
    max_tokens: 16000,
    betas: ['server-side-fallback-2026-07-01'],
    fallbacks: 'default',
    output_config: { effort: 'low' },
    system: [
      { type: 'text', text: INSTRUCTIONS, cache_control: { type: 'ephemeral' } },
      { type: 'text', text: userContext(user, health, products, today) },
    ],
    messages: history,
  });

  if (response.stop_reason === 'refusal') {
    return { text: 'Xin lỗi, mình không thể hỗ trợ yêu cầu này. Bạn có thể trao đổi với chuyên gia của NUTRIVA để được tư vấn thêm.', link: { to: '/me/support', label: 'Gặp chuyên gia' } };
  }
  const text = response.content
    .filter((b) => b.type === 'text')
    .map((b) => b.text)
    .join('\n')
    .trim();
  return parseReply(text || 'Xin lỗi, mình chưa có câu trả lời phù hợp.', products);
}
