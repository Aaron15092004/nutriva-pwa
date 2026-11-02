import { DIY_GUIDES } from './diy-guides.js';

// Dữ liệu khởi tạo (seed) — sau đó quản lý trong trang Admin.
// 6 dòng sữa hạt NUTRIVA (theo bao bì thật): mỗi dòng có bản pha sẵn (chai 330 ml) + gói hạt tự nấu 100 g.
// Ảnh: /img/products/sua-<key>.webp (chai), /img/products/set-<key>.webp (gói hạt).
export const LINES = [
  {
    key: 'mach-nhien',
    name: 'Mạch Nhiên',
    tagline: 'Yến mạch • Óc chó • Hạnh nhân',
    ingredients: ['yen-mach', 'oc-cho', 'hanh-nhan'],
    flavor: 'beo-nhe',
    blurb: 'Vị béo nhẹ tự nhiên của óc chó và hạnh nhân, yến mạch giúp no lâu — hợp bữa sáng hoặc bữa phụ buổi chiều.',
    nutrition: { kcal: 170, protein: 5.5, carb: 21, fat: 7.5 },
  },
  {
    key: 'sen-thanh',
    name: 'Sen Thanh',
    tagline: 'Hạt điều • Hạt bí • Hạt sen',
    ingredients: ['hat-dieu', 'hat-bi', 'hat-sen'],
    flavor: 'thanh-nhe',
    blurb: 'Hạt sen thanh mát, hạt điều béo nhẹ, hạt bí giàu đạm thực vật và magie — dễ uống mọi lúc trong ngày.',
    nutrition: { kcal: 165, protein: 6, carb: 18, fat: 8 },
  },
  {
    key: 'sen-com',
    name: 'Sen Cốm',
    tagline: 'Sen • Cốm • Hạnh nhân',
    ingredients: ['hat-sen', 'com', 'hanh-nhan'],
    flavor: 'thanh-nhe',
    blurb: 'Hương cốm non dịu nhẹ quyện cùng hạt sen và hạnh nhân — vị thanh, ngọt tự nhiên, rất hợp buổi tối.',
    nutrition: { kcal: 155, protein: 4.5, carb: 22, fat: 5.5 },
  },
  {
    key: 'lut-thanh',
    name: 'Lứt Thanh',
    tagline: 'Gạo lứt • Hạnh nhân • Hạt điều',
    ingredients: ['gao-lut', 'hanh-nhan', 'hat-dieu'],
    flavor: 'beo-nhe',
    blurb: 'Gạo lứt rang thơm nhiều chất xơ, kết hợp hạnh nhân và hạt điều béo bùi — năng lượng bền cho ngày dài.',
    nutrition: { kcal: 165, protein: 4.5, carb: 21, fat: 7 },
  },
  {
    key: 'nau-moc',
    name: 'Nâu Mộc',
    tagline: 'Cacao • Hạt điều • Yến mạch',
    ingredients: ['hat-dieu', 'yen-mach'],
    extra: ['Cacao nguyên chất'],
    flavor: 'dam-vi',
    blurb: 'Đậm vị cacao nguyên chất, hạt điều béo nhẹ và yến mạch no lâu — hợp sau buổi tập hoặc khi cần tỉnh táo.',
    nutrition: { kcal: 180, protein: 5.5, carb: 22, fat: 8 },
  },
  {
    key: 'huyen-moc',
    name: 'Huyền Mộc',
    tagline: 'Đậu đen • Mè đen • Gạo lứt',
    ingredients: ['dau-den', 'me-den', 'gao-lut'],
    flavor: 'dam-vi',
    blurb: 'Hương rang của mè đen, đậu đen và gạo lứt — vị truyền thống dễ uống, nhiều chất xơ và khoáng chất.',
    nutrition: { kcal: 160, protein: 6, carb: 24, fat: 4.5 },
  },
];

// Slug cũ (trước khi có tên thương hiệu) → dòng mới; dùng cho migration đổi tên trên DB đang chạy
export const LEGACY_LINES = {
  'yen-mach-oc-cho-hanh-nhan': 'mach-nhien',
  'hat-dieu-hat-bi-hat-sen': 'sen-thanh',
  'hat-sen-oc-cho-hanh-nhan': 'sen-com',
  'macca-hat-thong-gao-lut-huyet-rong': 'lut-thanh',
  'hat-dieu-hat-bi-cacao': 'nau-moc',
  'dau-den-me-den-gao-lut': 'huyen-moc',
};

export const PRODUCTS = LINES.flatMap((l) => [
  {
    slug: `sua-${l.key}`,
    type: 'milk',
    name: l.name,
    subtitle: l.tagline,
    size: '330ml',
    price: 35000,
    line: l.key,
    ingredients: l.ingredients,
    extraIngredients: l.extra ?? [],
    flavor: l.flavor,
    image: `/img/products/sua-${l.key}.webp`,
    description: l.blurb,
    nutrition: l.nutrition,
    storage: 'Bảo quản lạnh 2–6°C. Dùng trong 3 ngày kể từ ngày sản xuất. Lắc đều trước khi uống.',
  },
  {
    slug: `set-${l.key}`,
    type: 'diy',
    name: l.name,
    subtitle: `${l.tagline} • nấu được ≈ 1 lít`,
    size: '100g',
    price: 69000,
    line: l.key,
    ingredients: l.ingredients,
    extraIngredients: l.extra ?? [],
    flavor: l.flavor,
    image: `/img/products/set-${l.key}.webp`,
    description: `Gói hạt tự nấu đã định lượng sẵn — tự tay nấu sữa hạt tươi tại nhà với nguyên liệu tuyển chọn từ NUTRIVA. ${l.blurb}`,
    nutrition: l.nutrition,
    storage: 'Nguyên liệu khô: nơi thoáng mát, tránh ánh nắng, dùng trong 3 tháng. Sữa sau khi làm: bảo quản lạnh ≤4°C, dùng trong 3–4 ngày.',
    steps: DIY_GUIDES[l.key] ?? [],
  },
]);

// Gói sữa định kỳ
export const SUBSCRIPTION_PLANS = [
  { id: 'w5', bottles: 5, price: 165000, label: '5 chai / tuần' },
  { id: 'w10', bottles: 10, price: 320000, label: '10 chai / tuần' },
];

export const DIY_STEPS = [
  {
    title: 'Chuẩn bị dụng cụ',
    text: 'Máy xay sinh tố (≥ 600W), rây lọc hoặc túi lọc vải, nồi nhỏ, chai thủy tinh đã tráng nước sôi.',
  },
  {
    title: 'Sơ chế theo hướng dẫn',
    text: 'Ngâm hạt 6–8 tiếng (hạt sen, đậu đen, gạo lứt ngâm 4 tiếng), rửa sạch. Hạt sen bỏ tim để không bị đắng.',
  },
  {
    title: 'Chế biến',
    text: 'Xay toàn bộ nguyên liệu với 1 lít nước trong 2–3 phút, lọc qua túi vải. Đun lửa nhỏ 5–7 phút, khuấy đều, tắt bếp khi sữa sủi lăn tăn.',
  },
  {
    title: 'Bảo quản',
    text: 'Để nguội, rót vào chai sạch, bảo quản ngăn mát 2–6°C và dùng trong 2 ngày. Lắc đều trước khi uống.',
  },
];

export const COUPONS = {
  NUTRIVA10: { percent: 10, label: 'Giảm 10% đơn hàng' },
  CHAOBAN: { amount: 20000, label: 'Giảm 20.000đ cho đơn đầu tiên' },
};

export const SHIPPING_FEE = 20000;
export const FREE_SHIP_FROM = 300000;
