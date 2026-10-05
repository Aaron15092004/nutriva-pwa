import { INGREDIENTS, FLAVORS, MEALS, FOOD_GROUPS, DISH_CATEGORIES, NUTRIENT_GROUPS, PLAN_STYLES, ingredientName } from '@shared/nutrition.js';
import { vnd, dt, MicroSummary } from './kit.jsx';
import { ACTIVITY_CATEGORIES } from '../theme/activities.js';
import ActivityThumb from '../components/activity/ActivityThumb.jsx';

const ALLERGEN_OPTIONS = INGREDIENTS.map((i) => ({ id: i.id, label: i.name }));
const ACTIVE = { key: 'active', label: 'Trạng thái', options: [{ id: 'true', label: 'Đang bật' }, { id: 'false', label: 'Đã tắt' }] };
const activeBadge = (it) => <span className={`badge ${it.active ? 'good' : 'gray'}`}>{it.active ? 'Bật' : 'Tắt'}</span>;
const GROUP_LABEL = Object.fromEntries(FOOD_GROUPS.map((g) => [g.id, g.label]));
const DISH_CAT_LABEL = Object.fromEntries(DISH_CATEGORIES.map((c) => [c.id, c.label]));
const NUTRIENT_OPTIONS = Object.entries(NUTRIENT_GROUPS).map(([id, label]) => ({ id, label }));
const num1 = (v) => (v == null ? '—' : Number(v).toLocaleString('vi-VN', { maximumFractionDigits: 1 }));
const TAGS = [{ id: 'cook', label: 'Tự nấu' }, { id: 'quick', label: 'Nhanh gọn' }];

export const products = {
  path: '/admin/products',
  title: 'Sản phẩm',
  singular: 'sản phẩm',
  filters: [{ key: 'type', label: 'Loại', options: [{ id: 'milk', label: 'Sữa hạt' }, { id: 'diy', label: 'Set tự làm' }] }, ACTIVE],
  columns: [
    { key: 'image', label: '', render: (it) => (it.image ? <img src={it.image} alt="" /> : null) },
    { key: 'name', label: 'Tên', render: (it) => <><b>{it.name}</b><div className="xs muted">{it.slug}</div></> },
    { key: 'type', label: 'Loại', render: (it) => (it.type === 'diy' ? 'Set tự làm' : 'Sữa hạt') },
    { key: 'price', label: 'Giá', num: true, render: (it) => vnd(it.price) },
    { key: 'stock', label: 'Tồn kho', num: true, render: (it) => (it.stock == null ? '∞' : it.stock) },
    { key: 'active', label: 'Bán', render: activeBadge },
  ],
  defaults: { type: 'milk', flavor: 'beo-nhe', price: 35000, size: '330ml', ingredients: [], extraIngredients: [], nutrition: { kcal: 0, protein: 0, carb: 0, fat: 0 }, steps: [], stock: null, sort: 0, active: true },
  fields: [
    { key: 'name', label: 'Tên sản phẩm' },
    { key: 'slug', label: 'Slug (URL)', hint: 'chữ thường, số, gạch ngang — vd: sua-hat-dieu' },
    { key: 'type', label: 'Loại', type: 'select', options: [{ id: 'milk', label: 'Sữa hạt pha sẵn' }, { id: 'diy', label: 'Set tự làm' }] },
    { key: 'flavor', label: 'Hương vị', type: 'select', options: FLAVORS },
    { key: 'price', label: 'Giá (đ)', type: 'number', min: 0, step: 1000 },
    { key: 'stock', label: 'Tồn kho', type: 'number', min: 0, step: 1, hint: 'Để trống = không giới hạn' },
    { key: 'size', label: 'Quy cách', hint: 'vd: 330ml, 1 set' },
    { key: 'subtitle', label: 'Phụ đề' },
    { key: 'line', label: 'Dòng sản phẩm', hint: 'Sữa & set cùng dòng sẽ liên kết với nhau' },
    { key: 'sort', label: 'Thứ tự hiển thị', type: 'number', step: 1 },
    { key: 'image', label: 'Ảnh', type: 'image' },
    { key: 'ingredients', label: 'Thành phần hạt (dùng để lọc dị ứng)', type: 'chips', options: ALLERGEN_OPTIONS },
    { key: 'extraIngredients', label: 'Thành phần khác', type: 'list', full: true, hint: 'Cách nhau bởi dấu phẩy — vd: Cacao nguyên chất' },
    { key: 'nutrition', label: 'Dinh dưỡng mỗi chai / 330 ml', type: 'nutrition' },
    { key: 'description', label: 'Mô tả', type: 'textarea' },
    { key: 'storage', label: 'Bảo quản & hạn dùng', type: 'textarea' },
    { key: 'steps', label: 'Các bước tự làm (set DIY)', type: 'steps', hint: 'Để trống: dùng hướng dẫn mặc định trong Cài đặt' },
    { key: 'active', label: 'Đang bán', type: 'checkbox', checkLabel: 'Hiển thị trong cửa hàng' },
  ],
};

export const foods = {
  path: '/admin/foods',
  title: 'Thực phẩm',
  singular: 'thực phẩm',
  filters: [
    { key: 'group', label: 'Nhóm', options: FOOD_GROUPS },
    { key: 'nutrientGroup', label: 'Nhóm chất (VDD)', options: NUTRIENT_OPTIONS },
    { key: 'plant', label: 'Chay', options: [{ id: 'true', label: 'Chay' }, { id: 'false', label: 'Có nguồn gốc động vật' }] },
    ACTIVE,
  ],
  columns: [
    { key: 'name', label: 'Tên', render: (it) => <><b>{it.name}</b><div className="xs muted">{it.source}</div></> },
    { key: 'group', label: 'Nhóm', render: (it) => GROUP_LABEL[it.group] },
    { key: 'kcal', label: 'kcal', num: true },
    { key: 'protein', label: 'Đạm', num: true, render: (it) => num1(it.protein) },
    { key: 'carb', label: 'Bột đường', num: true, render: (it) => num1(it.carb) },
    { key: 'fat', label: 'Béo', num: true, render: (it) => num1(it.fat) },
    { key: 'fiber', label: 'Xơ', num: true, render: (it) => num1(it.fiber) },
    { key: 'micros', label: 'Vi chất (/100 g)', render: (it) => <MicroSummary micros={it.micros} /> },
    { key: 'serving', label: 'Khẩu phần', render: (it) => `${it.unit} ≈ ${it.serving} g` },
    { key: 'active', label: '', render: activeBadge },
  ],
  defaults: { group: 'veg', kcal: 0, protein: 0, carb: 0, fat: 0, fiber: null, micros: {}, serving: 100, unit: '1 phần', plant: true, allergens: [], source: 'NUTRIVA', active: true },
  fields: [
    { key: 'name', label: 'Tên thực phẩm' },
    { key: 'key', label: 'Mã (key)', hint: 'Duy nhất, vd: thit-ga-luon' },
    { key: 'group', label: 'Nhóm thực phẩm', type: 'select', options: FOOD_GROUPS },
    { key: 'nutrientGroup', label: 'Nhóm chất (Viện Dinh dưỡng)', type: 'select', options: [{ id: '', label: '—' }, ...NUTRIENT_OPTIONS] },
    { key: 'kcal', label: 'Năng lượng (kcal / 100 g)', type: 'number', min: 0 },
    { key: 'protein', label: 'Protein (g / 100 g)', type: 'number', min: 0 },
    { key: 'carb', label: 'Glucid (g / 100 g)', type: 'number', min: 0 },
    { key: 'fat', label: 'Lipid (g / 100 g)', type: 'number', min: 0 },
    { key: 'fiber', label: 'Chất xơ (g / 100 g)', type: 'number', min: 0 },
    { key: 'water', label: 'Nước (g / 100 g)', type: 'number', min: 0 },
    { key: 'ash', label: 'Tro tổng (g / 100 g)', type: 'number', min: 0 },
    { key: 'waste', label: 'Thải bỏ (%)', type: 'number', min: 0, step: 1 },
    { key: 'micros', label: 'Vitamin & khoáng chất (/100 g)', type: 'micros' },
    { key: 'serving', label: 'Khẩu phần chuẩn (g)', type: 'number', min: 1 },
    { key: 'unit', label: 'Tên khẩu phần', hint: 'vd: 1 chén, 1 quả' },
    { key: 'source', label: 'Nguồn số liệu', hint: 'vd: Viện Dinh dưỡng, USDA' },
    { key: 'plant', label: 'Chay', type: 'checkbox', checkLabel: 'Phù hợp ăn chay linh hoạt' },
    { key: 'allergens', label: 'Chứa thành phần cần tránh', type: 'chips', options: ALLERGEN_OPTIONS },
    { key: 'active', label: 'Hiển thị', type: 'checkbox', checkLabel: 'Cho phép tìm & ghi nhật ký' },
  ],
};

export const dishes = {
  path: '/admin/dishes',
  title: 'Món ăn trong kế hoạch',
  singular: 'món ăn',
  filters: [
    { key: 'meal', label: 'Bữa', options: MEALS.map((m) => ({ id: m.id, label: m.label })) },
    { key: 'category', label: 'Kiểu món', options: DISH_CATEGORIES },
    ACTIVE,
  ],
  columns: [
    { key: 'image', label: '', render: (it) => (it.image ? <img src={it.image} alt="" /> : null) },
    { key: 'name', label: 'Món', render: (it) => <><b>{it.name}</b><div className="xs muted">{it.ingredients?.map((i) => `${i.name} ${i.grams}g`).join(', ')}</div></> },
    { key: 'meal', label: 'Bữa', render: (it) => MEALS.find((m) => m.id === it.meal)?.label },
    { key: 'category', label: 'Kiểu món', render: (it) => DISH_CAT_LABEL[it.category] },
    { key: 'kcal', label: 'kcal', num: true },
    { key: 'protein', label: 'Đạm', num: true, render: (it) => num1(it.protein) },
    { key: 'micros', label: 'Vi chất', render: (it) => (it.manual ? <span className="badge gray">Món đặc biệt</span> : <MicroSummary micros={it.micros} />) },
    { key: 'plant', label: 'Chay', render: (it) => (it.plant ? <span className="badge good">Chay</span> : null) },
    { key: 'active', label: '', render: activeBadge },
  ],
  defaults: { meal: 'breakfast', category: 'com', tag: 'cook', ingredients: [], manual: false, plant: true, allergens: [], active: true },
  fields: [
    { key: 'name', label: 'Tên món', full: true },
    { key: 'key', label: 'Mã (key)', hint: 'Duy nhất, vd: l15' },
    { key: 'meal', label: 'Bữa', type: 'select', options: MEALS.map((m) => ({ id: m.id, label: m.label })) },
    { key: 'category', label: 'Kiểu món', type: 'select', options: DISH_CATEGORIES },
    { key: 'tag', label: 'Cách làm', type: 'select', options: TAGS },
    { key: 'manual', label: 'Loại món', type: 'checkbox', checkLabel: 'Món đặc biệt — nhập dinh dưỡng tay, không liên kết thực phẩm' },
    { key: 'ingredients', label: 'Nguyên liệu (gram)', type: 'ingredients', hint: 'Dinh dưỡng, vi chất, cờ chay và dị ứng được tính tự động từ bảng thực phẩm khi lưu.', show: (f) => !f.manual },
    { key: 'micros', label: 'Vitamin & khoáng chất (cả món)', type: 'micros', readOnly: true, show: (f) => !f.manual && Boolean(f._id) },
    { key: 'kcal', label: 'Năng lượng (kcal / phần)', type: 'number', min: 0, show: (f) => f.manual },
    { key: 'protein', label: 'Protein (g)', type: 'number', min: 0, show: (f) => f.manual },
    { key: 'carb', label: 'Glucid (g)', type: 'number', min: 0, show: (f) => f.manual },
    { key: 'fat', label: 'Lipid (g)', type: 'number', min: 0, show: (f) => f.manual },
    { key: 'fiber', label: 'Chất xơ (g)', type: 'number', min: 0, show: (f) => f.manual },
    { key: 'plant', label: 'Chay', type: 'checkbox', checkLabel: 'Phù hợp ăn chay', show: (f) => f.manual },
    { key: 'allergens', label: 'Chứa thành phần cần tránh', type: 'chips', options: ALLERGEN_OPTIONS, show: (f) => f.manual },
    { key: 'image', label: 'Ảnh món', type: 'image' },
    { key: 'active', label: 'Sử dụng', type: 'checkbox', checkLabel: 'Đưa vào gợi ý kế hoạch' },
  ],
};

const STYLE_LABEL = Object.fromEntries(PLAN_STYLES.map((x) => [x.id, x.label]));
export const mealPlans = {
  path: '/admin/meal-plans',
  title: 'Kế hoạch ăn mẫu',
  singular: 'kế hoạch',
  filters: [{ key: 'style', label: 'Kiểu ăn', options: PLAN_STYLES }, ACTIVE],
  columns: [
    { key: 'image', label: '', render: (it) => (it.image ? <img src={it.image} alt="" /> : null) },
    { key: 'title', label: 'Kế hoạch', render: (it) => <><b>{it.title}</b><div className="xs muted">{it.slug}</div></> },
    { key: 'kcal', label: 'kcal/ngày', render: (it) => `${it.kcalMin}–${it.kcalMax}` },
    { key: 'style', label: 'Kiểu ăn', render: (it) => STYLE_LABEL[it.style] },
    { key: 'days', label: 'Số ngày', num: true, render: (it) => it.days?.length },
    { key: 'items', label: 'Món/ngày', num: true, render: (it) => Math.round((it.days ?? []).reduce((s, d) => s + d.items.length, 0) / (it.days?.length || 1)) },
    { key: 'active', label: '', render: activeBadge },
  ],
  defaults: { style: 'balanced', kcalMin: 1600, kcalMax: 1800, days: Array.from({ length: 7 }, () => ({ items: [] })), sort: 0, active: true },
  fields: [
    { key: 'title', label: 'Tên kế hoạch', full: true },
    { key: 'slug', label: 'Mã (slug)', hint: 'Chữ thường, số, gạch nối — vd eat-clean-1600' },
    { key: 'style', label: 'Kiểu ăn', type: 'select', options: PLAN_STYLES },
    { key: 'kcalMin', label: 'Calo tối thiểu / ngày', type: 'number', min: 800, step: 50 },
    { key: 'kcalMax', label: 'Calo tối đa / ngày', type: 'number', min: 800, step: 50 },
    { key: 'summary', label: 'Mô tả ngắn', type: 'textarea' },
    { key: 'description', label: 'Giới thiệu chi tiết', type: 'textarea' },
    { key: 'image', label: 'Ảnh bìa', type: 'image' },
    { key: 'imageCredit', label: 'Nguồn ảnh', type: 'credit' },
    {
      key: 'days',
      label: 'Thực đơn theo ngày (JSON)',
      type: 'json',
      hint: 'Mỗi ngày { items: [...] }. Món: { meal: breakfast|lunch|dinner|snack, food: <mã thực phẩm>, grams, label?, note? } hoặc { meal, dish: <mã món>, portion }. Dinh dưỡng tự tính khi hiển thị.',
    },
    { key: 'sort', label: 'Thứ tự', type: 'number', step: 1 },
    { key: 'active', label: 'Hiển thị', type: 'checkbox', checkLabel: 'Hiện trong Khám phá thực đơn' },
  ],
};

export const coupons = {
  path: '/admin/coupons',
  title: 'Mã giảm giá',
  singular: 'mã giảm giá',
  filters: [ACTIVE],
  columns: [
    { key: 'code', label: 'Mã', render: (it) => <b>{it.code}</b> },
    { key: 'label', label: 'Mô tả' },
    { key: 'value', label: 'Giá trị', num: true, render: (it) => (it.kind === 'percent' ? `${it.value}%` : vnd(it.value)) },
    { key: 'usedCount', label: 'Đã dùng', num: true, render: (it) => `${it.usedCount}${it.maxUses != null ? ` / ${it.maxUses}` : ''}` },
    { key: 'expiresAt', label: 'Hết hạn', render: (it) => dt(it.expiresAt) },
    { key: 'active', label: '', render: activeBadge },
  ],
  defaults: { kind: 'percent', value: 10, minSubtotal: 0, maxDiscount: null, maxUses: null, firstOrderOnly: false, expiresAt: null, active: true },
  fields: [
    { key: 'code', label: 'Mã', hint: 'CHỮ IN HOA, số, - hoặc _' },
    { key: 'label', label: 'Mô tả hiển thị cho khách' },
    { key: 'kind', label: 'Kiểu giảm', type: 'select', options: [{ id: 'percent', label: 'Phần trăm (%)' }, { id: 'amount', label: 'Số tiền (đ)' }] },
    { key: 'value', label: 'Giá trị', type: 'number', min: 1 },
    { key: 'maxDiscount', label: 'Giảm tối đa (đ)', type: 'number', min: 0, hint: 'Cho mã %; trống = không giới hạn' },
    { key: 'minSubtotal', label: 'Đơn tối thiểu (đ)', type: 'number', min: 0 },
    { key: 'maxUses', label: 'Tổng lượt dùng tối đa', type: 'number', min: 1, hint: 'Trống = không giới hạn' },
    { key: 'expiresAt', label: 'Hết hạn lúc', type: 'datetime' },
    { key: 'firstOrderOnly', label: 'Điều kiện', type: 'checkbox', checkLabel: 'Chỉ cho đơn hàng đầu tiên' },
    { key: 'active', label: 'Trạng thái', type: 'checkbox', checkLabel: 'Đang áp dụng' },
  ],
};

const ACT_CATS = Object.entries(ACTIVITY_CATEGORIES).map(([id, c]) => ({ id, label: c.label }));

export const activities = {
  path: '/admin/activities',
  title: 'Hoạt động đốt calo',
  singular: 'hoạt động',
  filters: [{ key: 'category', label: 'Nhóm', options: ACT_CATS }, ACTIVE],
  columns: [
    { key: 'image', label: '', render: (it) => <ActivityThumb activity={it} size={44} iconSize={20} /> },
    { key: 'name', label: 'Hoạt động', render: (it) => <><b>{it.name}</b>{it.nameEn && <div className="xs muted">{it.nameEn}</div>}</> },
    { key: 'category', label: 'Nhóm', render: (it) => ACTIVITY_CATEGORIES[it.category]?.label },
    { key: 'variants', label: 'Mức độ (MET)', render: (it) => it.variants.map((v) => `${v.name} (${v.met})`).join(', ') },
    { key: 'active', label: '', render: activeBadge },
  ],
  defaults: { category: 'fitness', variants: [{ name: '', met: 3 }], defaultMinutes: 30, active: true },
  fields: [
    { key: 'name', label: 'Tên tiếng Việt' },
    { key: 'nameEn', label: 'Tên tiếng Anh', hint: 'Hiển thị trong ngoặc, vd: (Swimming)' },
    { key: 'slug', label: 'Slug (URL)', hint: 'chữ thường, số, gạch ngang — vd: boi-loi' },
    { key: 'category', label: 'Nhóm', type: 'select', options: ACT_CATS },
    { key: 'defaultMinutes', label: 'Thời gian mặc định (phút)', type: 'number', min: 1, step: 5 },
    { key: 'active', label: 'Hiển thị', type: 'checkbox', checkLabel: 'Cho phép người dùng chọn' },
    { key: 'image', label: 'Ảnh minh họa', type: 'image' },
    { key: 'imageCredit', label: 'Nguồn ảnh', type: 'credit', hint: 'Bắt buộc ghi nguồn với ảnh giấy phép CC BY / CC BY-SA' },
    { key: 'variants', label: 'Mức độ & hệ số MET', type: 'variants', hint: 'Calo = MET × cân nặng × giờ. Tra MET tại Compendium of Physical Activities.' },
  ],
};
