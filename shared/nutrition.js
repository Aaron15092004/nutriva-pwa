// Dùng chung cho server và client: hằng số hồ sơ + công thức tính chỉ số sức khỏe.

export const GOALS = [
  { id: 'maintain', label: 'Duy trì sức khỏe' },
  { id: 'gain', label: 'Tăng cân' },
  { id: 'lose', label: 'Giảm cân' },
];

// Hệ số vận động R dùng cho TDEE = BMR × R
export const ACTIVITY_LEVELS = [
  { id: 'sedentary', label: 'Ít vận động', desc: 'Ngồi nhiều, ít tập', factor: 1.2 },
  { id: 'light', label: 'Vận động nhẹ', desc: '1–3 buổi/tuần', factor: 1.375 },
  { id: 'moderate', label: 'Vận động vừa phải', desc: '3–5 buổi/tuần', factor: 1.55 },
  { id: 'active', label: 'Vận động nhiều', desc: '6–7 buổi/tuần', factor: 1.725 },
];

export const DIETS = [
  { id: 'flex-veg', label: 'Ăn chay hoặc linh hoạt' },
  { id: 'normal', label: 'Ăn bình thường' },
  { id: 'restricted', label: 'Kiêng một số thực phẩm' },
];

export const FLAVORS = [
  { id: 'beo-nhe', label: 'Béo nhẹ' },
  { id: 'thanh-nhe', label: 'Thanh nhẹ' },
  { id: 'dam-vi', label: 'Đậm vị' },
];

export const SWEETNESS = [
  { id: 'none', label: 'Không thêm đường' },
  { id: 'low', label: 'Ít ngọt' },
];

export const PREFERENCES = [
  { id: 'ready', label: 'Sữa pha sẵn', desc: 'Tiện lợi' },
  { id: 'diy', label: 'Tự làm tại nhà', desc: 'Với set hạt' },
];

// 12 nguyên liệu trong các dòng sữa NUTRIVA — dùng cho mục "Thực phẩm cần tránh"
export const INGREDIENTS = [
  { id: 'yen-mach', name: 'Yến mạch' },
  { id: 'oc-cho', name: 'Óc chó' },
  { id: 'hanh-nhan', name: 'Hạnh nhân' },
  { id: 'hat-dieu', name: 'Hạt điều' },
  { id: 'hat-bi', name: 'Hạt bí' },
  { id: 'dau-den', name: 'Đậu đen' },
  { id: 'me-den', name: 'Mè đen' },
  { id: 'gao-lut', name: 'Gạo lứt' },
  { id: 'hat-sen', name: 'Hạt sen' },
  { id: 'macca', name: 'Macca' },
  { id: 'hat-thong', name: 'Hạt thông' },
  { id: 'gao-lut-huyet-rong', name: 'Gạo lứt huyết rồng' },
];

export const ingredientName = (id) => INGREDIENTS.find((i) => i.id === id)?.name ?? id;

// Tỷ lệ năng lượng mỗi bữa trên tổng calo mục tiêu (min–max)
export const MEALS = [
  { id: 'breakfast', label: 'Bữa sáng', share: [0.2, 0.25] },
  { id: 'lunch', label: 'Bữa trưa', share: [0.3, 0.35] },
  { id: 'dinner', label: 'Bữa tối', share: [0.25, 0.3] },
  { id: 'snack', label: 'Bữa ăn nhẹ', share: [0.1, 0.15] },
];

// % năng lượng từ Carb / Đạm / Béo theo mục tiêu
const MACRO_SPLIT = {
  maintain: { carb: 0.5, protein: 0.2, fat: 0.3 },
  lose: { carb: 0.4, protein: 0.3, fat: 0.3 },
  gain: { carb: 0.5, protein: 0.25, fat: 0.25 },
};

const round = (n, d = 0) => Math.round(n * 10 ** d) / 10 ** d;

export function calcBMI(weightKg, heightCm) {
  const h = heightCm / 100;
  return round(weightKg / (h * h), 1);
}

// Ngưỡng BMI cho người châu Á (WHO 2000)
export function bmiCategory(bmi) {
  if (bmi < 18.5) return { label: 'Thiếu cân', tone: 'warn' };
  if (bmi < 23) return { label: 'Bình thường', tone: 'good' };
  if (bmi < 25) return { label: 'Thừa cân', tone: 'warn' };
  return { label: 'Béo phì', tone: 'bad' };
}

// WHtR = Số đo vòng eo / Chiều cao
export function calcWHtR(waistCm, heightCm) {
  if (!waistCm || !heightCm) return null;
  return round(waistCm / heightCm, 2);
}

export function whtrCategory(whtr) {
  if (whtr == null) return null;
  if (whtr < 0.4) return { label: 'Thấp', tone: 'warn' };
  if (whtr < 0.5) return { label: 'Khỏe mạnh', tone: 'good' };
  if (whtr < 0.6) return { label: 'Nguy cơ tăng', tone: 'warn' };
  return { label: 'Nguy cơ cao', tone: 'bad' };
}

// Mifflin – St Jeor
export function calcBMR({ gender, weightKg, heightCm, age }) {
  const base = 10 * weightKg + 6.25 * heightCm - 5 * age;
  return Math.round(gender === 'male' ? base + 5 : base - 161);
}

export function activityFactor(activity) {
  return ACTIVITY_LEVELS.find((a) => a.id === activity)?.factor ?? 1.2;
}

export function calcTDEE(bmr, activity) {
  return Math.round(bmr * activityFactor(activity));
}

// Giảm cân: thâm hụt ~500 kcal (≈0,5 kg/tuần); Tăng cân: dư ~300 kcal.
// Không để mục tiêu thấp hơn BMR để tránh thiếu hụt năng lượng nền.
export function calcTargetCalories(tdee, bmr, goal) {
  if (goal === 'lose') return Math.max(tdee - 500, bmr);
  if (goal === 'gain') return tdee + 300;
  return tdee;
}

export function calcMacros(kcal, goal) {
  const s = MACRO_SPLIT[goal] ?? MACRO_SPLIT.maintain;
  return {
    carb: Math.round((kcal * s.carb) / 4),
    protein: Math.round((kcal * s.protein) / 4),
    fat: Math.round((kcal * s.fat) / 9),
  };
}

// ~35 ml nước / kg cân nặng, làm tròn 100 ml
export function calcWaterTarget(weightKg) {
  return Math.round((weightKg * 35) / 100) * 100;
}

export function mealTargets(kcal) {
  return Object.fromEntries(
    MEALS.map((m) => [m.id, { min: Math.round(kcal * m.share[0]), max: Math.round(kcal * m.share[1]) }]),
  );
}

export function computeHealth(p) {
  if (!p?.weightKg || !p?.heightCm || !p?.age) return null;
  const bmi = calcBMI(p.weightKg, p.heightCm);
  const whtr = calcWHtR(p.waistCm, p.heightCm);
  const bmr = calcBMR(p);
  const tdee = calcTDEE(bmr, p.activity);
  const targetKcal = calcTargetCalories(tdee, bmr, p.goal);
  return {
    bmi,
    bmiCategory: bmiCategory(bmi),
    whtr,
    whtrCategory: whtrCategory(whtr),
    bmr,
    tdee,
    activityFactor: activityFactor(p.activity),
    targetKcal,
    macros: calcMacros(targetKcal, p.goal),
    waterMl: calcWaterTarget(p.weightKg),
    exerciseMin: 30,
    meals: mealTargets(targetKcal),
  };
}

// Năng lượng tiêu hao khi tập: kcal = MET × cân nặng (kg) × thời gian (giờ)
export const EXERCISES = [
  { id: 'walk', label: 'Đi bộ', met: 3.5 },
  { id: 'run', label: 'Chạy bộ', met: 8 },
  { id: 'cycle', label: 'Đạp xe', met: 6 },
  { id: 'swim', label: 'Bơi lội', met: 7 },
  { id: 'yoga', label: 'Yoga', met: 2.5 },
  { id: 'strength', label: 'Tập tạ', met: 5 },
  { id: 'rope', label: 'Nhảy dây', met: 11 },
  { id: 'hiit', label: 'HIIT', met: 8 },
];

export function exerciseKcal(exerciseId, minutes, weightKg) {
  const met = EXERCISES.find((e) => e.id === exerciseId)?.met ?? 3;
  return Math.round(met * weightKg * (minutes / 60));
}

// Nhóm thực phẩm (theo loại thực phẩm — dùng để tìm kiếm, lọc, gợi ý)
export const FOOD_GROUPS = [
  { id: 'grain', label: 'Ngũ cốc & tinh bột' },
  { id: 'tuber', label: 'Khoai & củ' },
  { id: 'veg', label: 'Rau củ quả' },
  { id: 'mushroom', label: 'Nấm & rong biển' },
  { id: 'fruit', label: 'Trái cây' },
  { id: 'legume', label: 'Đậu, hạt & đậu phụ' },
  { id: 'meat', label: 'Thịt' },
  { id: 'poultry', label: 'Gia cầm' },
  { id: 'offal', label: 'Nội tạng' },
  { id: 'processed', label: 'Thịt chế biến & đồ hộp' },
  { id: 'seafood', label: 'Cá & hải sản' },
  { id: 'egg', label: 'Trứng' },
  { id: 'dairy', label: 'Sữa & sữa thực vật' },
  { id: 'fat', label: 'Dầu & mỡ' },
  { id: 'sweet', label: 'Bánh kẹo & ăn vặt' },
  { id: 'drink', label: 'Đồ uống' },
  { id: 'spice', label: 'Gia vị & nước chấm' },
  { id: 'pickle', label: 'Dưa muối & đồ lên men' },
];

// Nhóm chất dinh dưỡng chính theo Viện Dinh dưỡng (cột gốc trong bảng dữ liệu)
export const NUTRIENT_GROUPS = {
  1: 'Nhóm 1 – Giàu glucid',
  2: 'Nhóm 2 – Giàu protein',
  3: 'Nhóm 3 – Giàu lipid',
  4: 'Nhóm 4 – Ít năng lượng, giàu chất xơ',
  5: 'Nhóm 5 – Gia vị',
};

// Nhóm món ăn (theo kiểu món / cách chế biến)
export const DISH_CATEGORIES = [
  { id: 'com', label: 'Cơm phần' },
  { id: 'mon-nuoc', label: 'Bún, phở & món nước' },
  { id: 'chao-xoi', label: 'Cháo, xôi & ngũ cốc' },
  { id: 'banh-mi', label: 'Bánh mì & bánh' },
  { id: 'mon-chinh', label: 'Món mặn (kho, nướng, áp chảo)' },
  { id: 'xao', label: 'Món xào' },
  { id: 'hap-luoc', label: 'Món hấp & luộc' },
  { id: 'canh', label: 'Canh & súp' },
  { id: 'salad', label: 'Salad & gỏi' },
  { id: 'trai-cay', label: 'Trái cây & tráng miệng' },
  { id: 'do-uong', label: 'Sinh tố & đồ uống' },
  { id: 'an-vat', label: 'Ăn vặt lành mạnh' },
];

// Kế hoạch ăn mẫu: kiểu chế độ ăn + các mức calo/ngày để lọc
export const PLAN_STYLES = [
  { id: 'eat-clean', label: 'Eat clean' },
  { id: 'balanced', label: 'Cân bằng' },
  { id: 'high-protein', label: 'Ít tinh bột – Tăng đạm' },
  { id: 'plant', label: 'Thuần chay' },
  { id: 'vietnamese', label: 'Cơm nhà Việt' },
];
export const PLAN_BANDS = [1200, 1400, 1600, 1800, 2000, 2200, 2400].map((min) => ({
  id: String(min),
  min,
  max: min + 200,
  label: `${min.toLocaleString('vi-VN')}–${(min + 200).toLocaleString('vi-VN')} kcal`,
}));
// Mức calo phù hợp nhất với mục tiêu năng lượng của người dùng
export const bandFor = (kcal) =>
  PLAN_BANDS.find((b) => kcal >= b.min && kcal < b.max) ?? (kcal < PLAN_BANDS[0].min ? PLAN_BANDS[0] : PLAN_BANDS.at(-1));

// Vi chất trong Bảng thành phần thực phẩm Việt Nam (giá trị / 100 g phần ăn được)
export const MICRONUTRIENTS = [
  { id: 'calcium', label: 'Canxi', short: 'Ca', unit: 'mg', kind: 'mineral' },
  { id: 'phosphorus', label: 'Phospho', short: 'P', unit: 'mg', kind: 'mineral' },
  { id: 'iron', label: 'Sắt', short: 'Fe', unit: 'mg', kind: 'mineral' },
  { id: 'zinc', label: 'Kẽm', short: 'Zn', unit: 'mg', kind: 'mineral' },
  { id: 'sodium', label: 'Natri', short: 'Na', unit: 'mg', kind: 'mineral' },
  { id: 'potassium', label: 'Kali', short: 'K', unit: 'mg', kind: 'mineral' },
  { id: 'magnesium', label: 'Magie', short: 'Mg', unit: 'mg', kind: 'mineral' },
  { id: 'retinol', label: 'Retinol', short: 'Retinol', unit: 'µg', kind: 'vitamin' },
  { id: 'betaCarotene', label: 'Beta-caroten', short: 'β-caroten', unit: 'µg', kind: 'vitamin' },
  { id: 'vitaminA', label: 'Vitamin A', short: 'A', unit: 'µg', kind: 'vitamin' },
  { id: 'vitaminC', label: 'Vitamin C', short: 'C', unit: 'mg', kind: 'vitamin' },
  { id: 'vitaminB1', label: 'Vitamin B1', short: 'B1', unit: 'mg', kind: 'vitamin' },
  { id: 'vitaminB2', label: 'Vitamin B2', short: 'B2', unit: 'mg', kind: 'vitamin' },
  { id: 'niacin', label: 'Niacin (B3)', short: 'B3', unit: 'mg', kind: 'vitamin' },
];
export const MICRO_IDS = MICRONUTRIENTS.map((m) => m.id);
