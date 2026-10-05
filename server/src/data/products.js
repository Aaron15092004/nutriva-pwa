// Dữ liệu khởi tạo (seed) — sau đó quản lý trong trang Admin.
// 6 dòng sữa hạt NUTRIVA (mỗi dòng có bản pha sẵn + set tự làm tại nhà).
const LINES = [
  {
    key: 'yen-mach-oc-cho-hanh-nhan',
    name: 'Yến mạch – Óc chó – Hạnh nhân',
    ingredients: ['yen-mach', 'oc-cho', 'hanh-nhan'],
    flavor: 'beo-nhe',
    image: '/img/milk-almond-oat.webp',
    blurb: 'Vị béo nhẹ từ óc chó và hạnh nhân, yến mạch giúp no lâu — hợp bữa sáng hoặc ăn nhẹ buổi chiều.',
    nutrition: { kcal: 170, protein: 5.5, carb: 21, fat: 7.5 },
  },
  {
    key: 'hat-dieu-hat-bi-cacao',
    name: 'Hạt điều – Hạt bí – Cacao',
    ingredients: ['hat-dieu', 'hat-bi'],
    extra: ['Cacao nguyên chất'],
    flavor: 'dam-vi',
    image: '/img/milk-main.webp',
    blurb: 'Đậm vị cacao, hạt bí giàu đạm thực vật và magie — thích hợp sau buổi tập.',
    nutrition: { kcal: 185, protein: 6.5, carb: 18, fat: 9.5 },
  },
  {
    key: 'dau-den-me-den-gao-lut',
    name: 'Đậu đen – Mè đen – Gạo lứt',
    ingredients: ['dau-den', 'me-den', 'gao-lut'],
    flavor: 'dam-vi',
    image: '/img/milk-walnut.webp',
    blurb: 'Hương rang thơm của mè đen và gạo lứt, nhiều chất xơ — vị truyền thống dễ uống.',
    nutrition: { kcal: 160, protein: 6, carb: 24, fat: 4.5 },
  },
  {
    key: 'hat-sen-oc-cho-hanh-nhan',
    name: 'Hạt sen – Óc chó – Hạnh nhân',
    ingredients: ['hat-sen', 'oc-cho', 'hanh-nhan'],
    flavor: 'thanh-nhe',
    image: '/img/milk-cashew-lotus.webp',
    blurb: 'Thanh mát từ hạt sen, cân bằng với chất béo tốt của óc chó và hạnh nhân — dễ uống buổi tối.',
    nutrition: { kcal: 150, protein: 5, carb: 17, fat: 7 },
  },
  {
    key: 'macca-hat-thong-gao-lut-huyet-rong',
    name: 'Macca – Hạt thông – Gạo lứt huyết rồng',
    ingredients: ['macca', 'hat-thong', 'gao-lut-huyet-rong'],
    flavor: 'beo-nhe',
    image: '/img/milk-main.webp',
    blurb: 'Béo bùi từ macca và hạt thông, gạo lứt huyết rồng cho sắc đỏ tự nhiên và vị ngọt dịu.',
    nutrition: { kcal: 195, protein: 4.5, carb: 20, fat: 11 },
  },
  {
    key: 'hat-dieu-hat-bi-hat-sen',
    name: 'Hạt điều – Hạt bí – Hạt sen',
    ingredients: ['hat-dieu', 'hat-bi', 'hat-sen'],
    flavor: 'thanh-nhe',
    image: '/img/milk-cashew-lotus.webp',
    blurb: 'Hạt điều béo nhẹ, hạt sen thanh mát — sự kết hợp hài hòa cho bữa ăn nhẹ trong ngày.',
    nutrition: { kcal: 165, protein: 6, carb: 18, fat: 8 },
  },
];

export const PRODUCTS = LINES.flatMap((l) => [
  {
    slug: `sua-${l.key}`,
    type: 'milk',
    name: l.name,
    subtitle: 'Sữa hạt tươi • 330ml',
    size: '330ml',
    price: 35000,
    line: l.key,
    ingredients: l.ingredients,
    extraIngredients: l.extra ?? [],
    flavor: l.flavor,
    image: l.image,
    description: l.blurb,
    nutrition: l.nutrition,
    storage: 'Bảo quản lạnh 2–6°C. Dùng trong 3 ngày kể từ ngày sản xuất. Lắc đều trước khi uống.',
  },
  {
    slug: `set-${l.key}`,
    type: 'diy',
    name: l.name,
    subtitle: 'Set tự làm tại nhà • 1 set ≈ 1 lít',
    size: '1 set',
    price: 69000,
    line: l.key,
    ingredients: l.ingredients,
    extraIngredients: l.extra ?? [],
    flavor: l.flavor,
    image: '/img/diy-bag.webp',
    description: `Tự tay làm sữa hạt tươi tại nhà với nguyên liệu được tuyển chọn từ NUTRIVA. ${l.blurb}`,
    nutrition: l.nutrition,
    storage: 'Nguyên liệu khô: nơi thoáng mát, tránh ánh nắng, dùng trong 3 tháng. Sữa sau khi làm: bảo quản lạnh, dùng trong 2 ngày.',
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
