import mongoose from 'mongoose';
import { MICRO_IDS, PLAN_STYLES, profileAge } from '../../../shared/nutrition.js';

const { Schema, model } = mongoose;
const ref = (name) => ({ type: Schema.Types.ObjectId, ref: name, required: true, index: true });
const MEAL_IDS = ['breakfast', 'lunch', 'dinner', 'snack'];

const ProfileSchema = new Schema(
  {
    gender: { type: String, enum: ['male', 'female'], required: true },
    // Năm sinh là nguồn chính (tuổi tự tăng theo năm). `age` giữ lại cho dữ liệu cũ — xem shared/nutrition.js profileAge()
    birthYear: { type: Number, min: 1900, max: 2100 },
    age: { type: Number, min: 10, max: 100 },
    heightCm: { type: Number, min: 100, max: 230, required: true },
    weightKg: { type: Number, min: 25, max: 250, required: true },
    waistCm: { type: Number, min: 40, max: 200, required: true },
    waistEstimated: { type: Boolean, default: false }, // vòng eo do app ước tính (người dùng chưa đo)
    targetWeightKg: { type: Number, min: 25, max: 250, default: null }, // cân nặng mục tiêu (onboarding)
    goal: { type: String, enum: ['maintain', 'gain', 'lose'], default: 'maintain' },
    activity: { type: String, enum: ['sedentary', 'light', 'moderate', 'active'], default: 'light' },
    diet: { type: String, enum: ['flex-veg', 'normal', 'restricted'], default: 'normal' },
    flavor: { type: String, enum: ['beo-nhe', 'thanh-nhe', 'dam-vi'], default: 'beo-nhe' },
    sweetness: { type: String, enum: ['none', 'low'], default: 'none' },
    preference: { type: String, enum: ['ready', 'diy'], default: 'ready' },
    allergies: { type: [String], default: [] },
    healthNote: { type: String, maxlength: 200, default: '' },
  },
  { _id: false },
);

const AddressSchema = new Schema({ name: String, phone: String, line: String }, { _id: false });

const UserSchema = new Schema(
  {
    email: { type: String, required: true, unique: true, lowercase: true, trim: true },
    // Tài khoản Google có thể không có mật khẩu
    passwordHash: { type: String, required: function needsPassword() { return !this.googleId; } },
    googleId: { type: String, unique: true, sparse: true },
    tokenVersion: { type: Number, default: 0 }, // tăng khi đổi/đặt lại mật khẩu → mọi phiên cũ hết hiệu lực
    lastActiveAt: { type: Date, index: true }, // cập nhật tối đa 1 lần/giờ (middleware auth)
    favoriteFoods: { type: [String], default: [] }, // key thực phẩm hay dùng (ghi nhanh)
    // Gói sử dụng app: mở khóa kế hoạch đầy đủ & nhắc nhở. Cộng ngày khi nhập mã trên chai / mua hàng đã thanh toán.
    membership: {
      until: { type: Date, default: null, index: true },
      trialStart: { type: Date, default: null }, // người dùng tự bấm "Kích hoạt dùng thử" (mỗi tài khoản 1 lần); null = chưa dùng thử
      noticeDate: String, // ngày (YYYY-MM-DD) đã gửi nhắc sắp hết hạn — mỗi ngày tối đa 1 lần
    },
    name: { type: String, required: true, trim: true, maxlength: 60 },
    role: { type: String, enum: ['user', 'admin'], default: 'user', index: true },
    avatar: { type: String, default: '' },
    profile: { type: ProfileSchema, required: true },
    consentAt: { type: Date, required: true },
    address: AddressSchema,
    // Câu trả lời khảo sát lúc onboarding (động lực, trở ngại, thói quen sữa hạt…) — dùng để cá nhân hóa gợi ý
    survey: { type: Schema.Types.Mixed, default: {} },
    // Kế hoạch ăn đang áp dụng: ngày 1 của kế hoạch = startDate, lặp lại sau mỗi chu kỳ
    activePlan: {
      type: new Schema({ plan: { type: Schema.Types.ObjectId, ref: 'MealPlan' }, startDate: String }, { _id: false }),
      default: null,
    },
  },
  { timestamps: true },
);
// Tuổi ↔ năm sinh: người dùng nhập/sửa tuổi → suy ra năm sinh; `age` lưu kèm luôn được làm mới theo năm sinh.
UserSchema.pre('validate', function syncAge() {
  const p = this.profile;
  if (!p) return;
  if (p.age && (!p.birthYear || (this.isModified('profile.age') && profileAge(p) !== p.age))) p.birthYear = new Date().getFullYear() - p.age;
  if (p.birthYear) p.age = profileAge(p);
});

const LoggedFoodSchema = new Schema({
  foodId: String,
  cid: String, // mã do client sinh: gửi lại (mất mạng, bấm 2 lần) không bị ghi trùng
  name: { type: String, required: true },
  grams: { type: Number, required: true, min: 1 },
  kcal: Number,
  protein: Number,
  carb: Number,
  fat: Number,
});

const DailyLogSchema = new Schema(
  {
    user: ref('User'),
    date: { type: String, required: true }, // YYYY-MM-DD theo giờ người dùng
    meals: {
      breakfast: { type: [LoggedFoodSchema], default: [] },
      lunch: { type: [LoggedFoodSchema], default: [] },
      dinner: { type: [LoggedFoodSchema], default: [] },
      snack: { type: [LoggedFoodSchema], default: [] },
    },
    waterMl: { type: Number, default: 0, min: 0 },
    exercises: [{ type: { type: String }, label: String, variant: String, met: Number, minutes: Number, kcal: Number, custom: Boolean, cid: String }],
    ops: { type: [String], default: undefined, select: false }, // mã thao tác nước gần đây (chống cộng trùng khi gửi lại)
    mood: { type: String, enum: ['great', 'good', 'normal', 'tired', 'bad', null], default: null },
  },
  { timestamps: true },
);
DailyLogSchema.index({ user: 1, date: 1 }, { unique: true });

// Lịch sử cân nặng (1 bản ghi / ngày)
const WeightEntrySchema = new Schema(
  {
    user: ref('User'),
    date: { type: String, required: true }, // YYYY-MM-DD
    kg: { type: Number, required: true, min: 25, max: 250 },
  },
  { timestamps: true },
);
WeightEntrySchema.index({ user: 1, date: 1 }, { unique: true });

const PlanChoiceSchema = new Schema({
  user: ref('User'),
  date: { type: String, required: true },
  meal: { type: String, enum: MEAL_IDS, required: true },
  dishId: { type: String, required: true },
  note: { type: String, maxlength: 200 },
});
PlanChoiceSchema.index({ user: 1, date: 1, meal: 1 }, { unique: true });

// ---- Danh mục (admin quản lý) ----
const ProductSchema = new Schema(
  {
    slug: { type: String, required: true, unique: true, trim: true, lowercase: true, match: /^[a-z0-9-]+$/ },
    type: { type: String, enum: ['milk', 'diy', 'treat'], required: true }, // treat: sản phẩm chế biến từ sữa hạt
    name: { type: String, required: true, trim: true },
    subtitle: String,
    size: String,
    price: { type: Number, required: true, min: 0 },
    line: String,
    ingredients: { type: [String], default: [] },
    extraIngredients: { type: [String], default: [] },
    flavor: { type: String, enum: ['beo-nhe', 'thanh-nhe', 'dam-vi'], default: 'beo-nhe' },
    image: String,
    imageCredit: String, // ghi nguồn ảnh (ảnh tạm có giấy phép mở)
    badge: { type: String, maxlength: 24 }, // nhãn nổi bật: "Mới", "Bán chạy"…
    description: String,
    nutrition: { kcal: { type: Number, default: 0 }, protein: { type: Number, default: 0 }, carb: { type: Number, default: 0 }, fat: { type: Number, default: 0 } },
    storage: String,
    steps: [{ _id: false, title: String, text: String }],
    stock: { type: Number, default: null, min: 0 }, // null = không giới hạn
    lowStock: { type: Number, default: 10, min: 0 }, // dưới mức này → cảnh báo "sắp hết" trong Kho hàng
    membershipDays: { type: Number, default: null, min: 0 }, // ngày sử dụng app cộng cho mỗi đơn vị (trống = theo loại trong Cài đặt)
    sort: { type: Number, default: 0 },
    active: { type: Boolean, default: true },
  },
  { timestamps: true },
);

const FOOD_GROUP_IDS = ['grain', 'tuber', 'veg', 'mushroom', 'fruit', 'legume', 'meat', 'poultry', 'offal', 'processed', 'seafood', 'egg', 'dairy', 'fat', 'sweet', 'drink', 'spice', 'pickle'];
const DISH_CATEGORY_IDS = ['com', 'mon-nuoc', 'chao-xoi', 'banh-mi', 'mon-chinh', 'xao', 'hap-luoc', 'canh', 'salad', 'trai-cay', 'do-uong', 'an-vat'];

// Vi chất (khoáng chất mg, vitamin mg/µg — xem MICRONUTRIENTS trong shared/nutrition.js); null = chưa có số liệu
const MicrosSchema = new Schema(Object.fromEntries(MICRO_IDS.map((k) => [k, { type: Number, min: 0, default: null }])), { _id: false });

// Thực phẩm — giá trị trên 100 g phần ăn được (Bảng thành phần thực phẩm Việt Nam, Viện Dinh dưỡng)
const FoodSchema = new Schema(
  {
    key: { type: String, required: true, unique: true, trim: true },
    name: { type: String, required: true, trim: true },
    group: { type: String, enum: FOOD_GROUP_IDS, default: 'veg', index: true },
    nutrientGroup: { type: Number, min: 1, max: 5, default: null }, // nhóm 1–5 theo Viện Dinh dưỡng
    kcal: { type: Number, required: true, min: 0 },
    protein: { type: Number, default: 0, min: 0 },
    carb: { type: Number, default: 0, min: 0 },
    fat: { type: Number, default: 0, min: 0 },
    fiber: { type: Number, default: null, min: 0 },
    water: { type: Number, default: null, min: 0 },
    ash: { type: Number, default: null, min: 0 }, // tro tổng (g)
    waste: { type: Number, default: 0, min: 0, max: 100 }, // % thải bỏ
    micros: { type: MicrosSchema, default: () => ({}) },
    serving: { type: Number, default: 100, min: 1 },
    unit: { type: String, default: '1 phần' },
    plant: { type: Boolean, default: true },
    allergens: { type: [String], default: [] },
    source: { type: String, default: 'Viện Dinh dưỡng' },
    active: { type: Boolean, default: true },
  },
  { timestamps: true },
);
FoodSchema.index({ name: 'text' });

// Món ăn trong kế hoạch — dinh dưỡng tính từ công thức (ingredients) trên bảng thực phẩm
const DishSchema = new Schema(
  {
    key: { type: String, required: true, unique: true, trim: true },
    meal: { type: String, enum: MEAL_IDS, required: true },
    category: { type: String, enum: DISH_CATEGORY_IDS, default: 'com', index: true },
    name: { type: String, required: true, trim: true },
    ingredients: [{ _id: false, food: String, name: String, grams: { type: Number, min: 1 } }],
    kcal: { type: Number, required: true, min: 1 },
    protein: { type: Number, default: 0 },
    carb: { type: Number, default: 0 },
    fat: { type: Number, default: 0 },
    fiber: { type: Number, default: 0 },
    micros: { type: MicrosSchema, default: () => ({}) }, // tổng vi chất của cả món (theo nguyên liệu)
    manual: { type: Boolean, default: false }, // món đặc biệt: nhập dinh dưỡng tay, không liên kết thực phẩm
    tag: { type: String, enum: ['cook', 'quick'], default: 'cook' },
    plant: { type: Boolean, default: false },
    allergens: { type: [String], default: [] },
    image: String,
    active: { type: Boolean, default: true },
  },
  { timestamps: true },
);

// Kế hoạch ăn mẫu (owner = null) hoặc thực đơn tự tạo của người dùng (owner = user).
// Mỗi món: thực phẩm theo gram (food + grams) hoặc món ăn theo khẩu phần (dish + portion). Dinh dưỡng tính khi đọc.
const PlanItemSchema = new Schema(
  {
    meal: { type: String, enum: MEAL_IDS, required: true },
    food: String,
    grams: { type: Number, min: 1, max: 3000 },
    dish: String,
    portion: { type: Number, min: 0.25, max: 5 },
    label: { type: String, trim: true, maxlength: 80 }, // tên hiển thị (vd "Ức gà áp chảo"); mặc định = tên thực phẩm
    note: { type: String, trim: true, maxlength: 40 }, // ghi chú định lượng (vd "gạo khô", "2 quả")
  },
  { _id: false },
);
const MealPlanSchema = new Schema(
  {
    slug: { type: String, required: true, unique: true, trim: true, lowercase: true, match: /^[a-z0-9-]+$/ },
    title: { type: String, required: true, trim: true, maxlength: 120 },
    summary: { type: String, trim: true, maxlength: 300 },
    description: { type: String, trim: true, maxlength: 3000 },
    style: { type: String, enum: PLAN_STYLES.map((x) => x.id), default: 'balanced', index: true },
    kcalMin: { type: Number, required: true, min: 800, max: 5000 },
    kcalMax: { type: Number, required: true, min: 800, max: 5000 },
    image: String,
    imageCredit: { author: String, license: String, source: String, licenseUrl: String },
    days: { type: [{ _id: false, items: [PlanItemSchema] }], validate: [(d) => d.length >= 1 && d.length <= 14, 'Kế hoạch cần 1–14 ngày'] },
    owner: { type: Schema.Types.ObjectId, ref: 'User', default: null, index: true },
    copiedFrom: String, // slug kế hoạch gốc (thực đơn tự tạo)
    sort: { type: Number, default: 0 },
    active: { type: Boolean, default: true },
  },
  { timestamps: true },
);

// Hoạt động thể chất (đốt calo) — calo = MET × kg × giờ
const ActivitySchema = new Schema(
  {
    slug: { type: String, required: true, unique: true, trim: true, lowercase: true, match: /^[a-z0-9-]+$/ },
    name: { type: String, required: true, trim: true },
    nameEn: { type: String, trim: true, default: '' },
    category: { type: String, enum: ['team', 'racket', 'water', 'winter', 'fitness', 'mind', 'outdoor', 'combat', 'daily', 'cardio'], default: 'fitness' },
    image: String,
    imageCredit: { author: String, license: String, licenseUrl: String, source: String },
    variants: {
      type: [{ _id: false, name: { type: String, required: true }, met: { type: Number, required: true, min: 0.5, max: 25 } }],
      validate: [(v) => v.length > 0, 'Cần ít nhất 1 mức độ'],
    },
    defaultMinutes: { type: Number, default: 30, min: 1 },
    active: { type: Boolean, default: true },
  },
  { timestamps: true },
);

const CouponSchema = new Schema(
  {
    code: { type: String, required: true, unique: true, uppercase: true, trim: true, match: /^[A-Z0-9_-]{3,30}$/ },
    label: { type: String, required: true },
    kind: { type: String, enum: ['percent', 'amount'], required: true },
    value: { type: Number, required: true, min: 1 },
    maxDiscount: { type: Number, default: null },
    minSubtotal: { type: Number, default: 0 },
    maxUses: { type: Number, default: null },
    usedCount: { type: Number, default: 0 },
    firstOrderOnly: { type: Boolean, default: false },
    expiresAt: { type: Date, default: null },
    active: { type: Boolean, default: true },
  },
  { timestamps: true },
);

// Cấu hình chung (1 document key='main') — phí ship, ngân hàng, gói định kỳ, cửa hàng
const SettingSchema = new Schema(
  {
    key: { type: String, required: true, unique: true },
    shippingFee: Number,
    freeShipFrom: Number,
    bank: { bankId: String, accountNo: String, accountName: String },
    store: { name: String, address: String, phone: String },
    subscriptionPlans: [{ _id: false, id: String, bottles: Number, price: Number, label: String }],
    diySteps: [{ _id: false, title: String, text: String }],
    vapid: { publicKey: String, privateKey: String },
    catalogVersion: { type: Number, default: 0 }, // tăng khi admin sửa sản phẩm/thực phẩm/món → các server làm mới cache
    // Kênh bán hàng chính thức (Shopee, TikTok Shop, Facebook…) — hiện trong popup, cửa hàng, trang sản phẩm
    channels: [{ _id: false, id: String, label: String, url: String, note: String }],
    // Gói sử dụng & mã kích hoạt
    membership: {
      enabled: { type: Boolean, default: true },
      freePlanDays: { type: Number, default: 3, min: 0, max: 7 }, // tài khoản chưa kích hoạt xem được N/7 ngày kế hoạch
      daysPerBottle: { type: Number, default: 2, min: 0 },
      daysPerSet: { type: Number, default: 4, min: 0 }, // gói hạt tự nấu ≈ 1 lít ≈ 3 chai
      daysPerTreat: { type: Number, default: 0, min: 0 },
      expiryNoticeDays: { type: Number, default: 2, min: 0, max: 14 },
    },
    // Quảng cáo toàn màn hình khi chuyển trang (dùng banner có vị trí "interstitial")
    interstitial: {
      enabled: { type: Boolean, default: true },
      everyNav: { type: Number, default: 6, min: 2, max: 50 }, // sau mỗi N lần chuyển trang
      minMinutes: { type: Number, default: 5, min: 1, max: 1440 }, // cách quảng cáo trước ít nhất M phút
      skipSeconds: { type: Number, default: 3, min: 0, max: 10 },
      maxPerDay: { type: Number, default: 4, min: 1, max: 50 },
      skipMembers: { type: Boolean, default: false }, // không hiện cho người đang có gói
    },
    // Popup quảng cáo khi mở app
    popup: {
      enabled: { type: Boolean, default: false },
      title: String,
      text: String,
      image: String,
      imageCredit: String,
      ctaLabel: String,
      ctaLink: String, // trang trong app (/shop/...) hoặc link ngoài (https://...)
      showChannels: { type: Boolean, default: true },
      everyHours: { type: Number, default: 24, min: 1, max: 720 }, // mỗi thiết bị thấy lại sau bao lâu
    },
  },
  { timestamps: true },
);

// Banner quảng cáo (admin quản lý): hiện ở trang chủ / cửa hàng / kế hoạch / theo dõi
const PromoSchema = new Schema(
  {
    title: { type: String, required: true, trim: true, maxlength: 80 },
    subtitle: { type: String, trim: true, maxlength: 160 },
    image: String,
    imageCredit: String,
    ctaLabel: { type: String, trim: true, maxlength: 30, default: 'Xem ngay' },
    link: { type: String, trim: true, maxlength: 300 }, // /shop/p/... (trong app) hoặc https://... (Shopee, Facebook…)
    placements: { type: [String], enum: ['home', 'shop', 'plan', 'track', 'interstitial'], default: ['home'] },
    theme: { type: String, enum: ['brand', 'warm', 'cream', 'dark', 'image'], default: 'brand' }, // image: banner tự thiết kế, không phủ chữ
    startAt: Date,
    endAt: Date,
    sort: { type: Number, default: 0 },
    active: { type: Boolean, default: true },
    views: { type: Number, default: 0 },
    clicks: { type: Number, default: 0 },
  },
  { timestamps: true },
);
PromoSchema.index({ active: 1, placements: 1, sort: 1 });

const OrderSchema = new Schema(
  {
    user: ref('User'),
    code: { type: String, unique: true },
    source: { type: String, enum: ['shop', 'subscription'], default: 'shop' },
    subscription: { type: Schema.Types.ObjectId, ref: 'Subscription' },
    items: [
      {
        product: { type: Schema.Types.ObjectId, ref: 'Product' },
        slug: String,
        name: String,
        type: { type: String },
        image: String,
        size: String,
        sweetness: String,
        price: Number,
        qty: Number,
      },
    ],
    subtotal: Number,
    discount: { type: Number, default: 0 },
    coupon: String,
    shippingFee: Number,
    total: Number,
    delivery: {
      method: { type: String, enum: ['home', 'pickup'] },
      date: String,
      slot: String,
    },
    address: AddressSchema,
    payment: { type: String, enum: ['cod', 'bank'] },
    paymentStatus: { type: String, enum: ['unpaid', 'paid', 'refunded'], default: 'unpaid' },
    status: { type: String, enum: ['confirmed', 'preparing', 'shipping', 'done', 'cancelled'], default: 'confirmed', index: true },
    history: [{ status: String, at: Date, by: String }],
    adminNote: String,
    clientRequestId: { type: String, maxlength: 64 }, // khóa chống gửi trùng (client sinh mỗi lần bấm Đặt hàng)
    anonymized: { type: Boolean, default: false }, // tài khoản đã xóa: giữ đơn cho kế toán, xóa thông tin cá nhân
    membershipDays: { type: Number, default: null }, // ngày sử dụng app đã cộng khi đơn được thanh toán (null = chưa cộng)
    membershipRevoked: { type: Boolean, default: false },
  },
  { timestamps: true },
);
OrderSchema.index({ user: 1, createdAt: -1 });
OrderSchema.index({ user: 1, clientRequestId: 1 }, { unique: true, partialFilterExpression: { clientRequestId: { $type: 'string' } } });
OrderSchema.index({ createdAt: -1 });

const SubscriptionSchema = new Schema(
  {
    user: ref('User'),
    planId: String,
    bottles: Number,
    price: Number,
    productSlug: String,
    productName: String,
    sweetness: { type: String, enum: ['none', 'low'], default: 'none' },
    days: [String],
    frequency: { type: String, enum: ['weekly', 'biweekly'], default: 'weekly' },
    address: AddressSchema,
    startDate: String,
    lastGeneratedDate: String,
    active: { type: Boolean, default: true },
  },
  { timestamps: true },
);

const ReminderSchema = new Schema(
  {
    user: ref('User'),
    kind: { type: String, enum: ['water', 'milk', 'exercise', 'meal', 'other'], default: 'other' },
    title: { type: String, required: true, maxlength: 60 },
    time: { type: String, required: true, match: /^\d{2}:\d{2}$/ },
    days: { type: [Number], default: [1, 2, 3, 4, 5] }, // 0 = CN … 6 = T7
    enabled: { type: Boolean, default: true },
    lastSentAt: String, // 'YYYY-MM-DD HH:mm' — chống gửi trùng
  },
  { timestamps: true },
);
ReminderSchema.index({ enabled: 1, time: 1 });

const PushSubscriptionSchema = new Schema(
  {
    user: ref('User'),
    endpoint: { type: String, required: true, unique: true },
    keys: { p256dh: String, auth: String },
    userAgent: String,
  },
  { timestamps: true },
);

const SupportRequestSchema = new Schema(
  {
    user: ref('User'),
    topic: String,
    message: { type: String, maxlength: 1000 },
    status: { type: String, enum: ['open', 'answered', 'closed'], default: 'open', index: true },
    reply: { type: String, maxlength: 2000 },
    repliedAt: Date,
  },
  { timestamps: true },
);

// ---- Quan sát hệ thống ----
// Nhật ký thao tác (ai làm gì, trên dữ liệu nào, khi nào, từ đâu). Tự xóa sau 1 năm.
const AuditLogSchema = new Schema(
  {
    at: { type: Date, default: Date.now },
    actor: { type: Schema.Types.ObjectId, ref: 'User', default: null },
    actorEmail: String,
    actorRole: String,
    action: { type: String, required: true }, // vd 'auth.login', 'admin.product.update', 'order.cancel'
    entity: String, // vd 'Product', 'Order', 'User'
    entityId: String,
    summary: { type: String, maxlength: 300 },
    changes: { type: Schema.Types.Mixed, default: undefined }, // { field: [trước, sau] }
    ok: { type: Boolean, default: true },
    ip: String,
    ua: String,
  },
  { versionKey: false },
);
AuditLogSchema.index({ at: -1 });
AuditLogSchema.index({ actor: 1, at: -1 });
AuditLogSchema.index({ action: 1, at: -1 });
AuditLogSchema.index({ entity: 1, entityId: 1, at: -1 });
AuditLogSchema.index({ at: 1 }, { expireAfterSeconds: 365 * 86400, name: 'ttl_1y' });

// Sự kiện sản phẩm (phễu onboarding, dùng tính năng, giữ chân). anon: id ẩn danh trước khi có tài khoản. Tự xóa sau ~13 tháng.
const EventSchema = new Schema(
  {
    at: { type: Date, default: Date.now },
    user: { type: Schema.Types.ObjectId, ref: 'User', default: null },
    anon: String,
    type: { type: String, required: true },
    props: { type: Schema.Types.Mixed, default: undefined },
    platform: String, // ios | android | desktop
    standalone: Boolean, // đang mở trong app đã cài
  },
  { versionKey: false },
);
EventSchema.index({ type: 1, at: -1 });
EventSchema.index({ user: 1, at: -1 });
EventSchema.index({ at: 1 }, { expireAfterSeconds: 400 * 86400, name: 'ttl_400d' });

// Lưu lượng API: gom theo phút × nhóm route (không ghi từng request). Tự xóa sau 30 ngày.
const MetricSchema = new Schema(
  {
    minute: { type: Date, required: true },
    route: { type: String, required: true },
    count: Number,
    s4xx: Number,
    s5xx: Number,
    sumMs: Number,
    maxMs: Number,
    p95: Number,
  },
  { versionKey: false },
);
MetricSchema.index({ minute: -1, route: 1 });
MetricSchema.index({ minute: 1 }, { expireAfterSeconds: 30 * 86400, name: 'ttl_30d' });

// Lịch sử trò chuyện với Nuti (+ đánh giá 👍/👎 để đo chất lượng)
const ChatMessageSchema = new Schema(
  {
    user: ref('User'),
    role: { type: String, enum: ['user', 'assistant'], required: true },
    text: { type: String, maxlength: 4000 },
    product: String, // slug sản phẩm được gợi ý
    link: { to: String, label: String },
    sources: [{ _id: false, title: String, source: String }],
    ai: Boolean, // trả lời bằng Claude (true) hay luật dự phòng (false)
    error: Boolean,
    rating: { type: String, enum: ['up', 'down', null], default: null },
  },
  { timestamps: true },
);
ChatMessageSchema.index({ user: 1, createdAt: -1 });
ChatMessageSchema.index({ rating: 1, createdAt: -1 });

// Token đặt lại mật khẩu (chỉ lưu hash; tự xóa khi hết hạn)
const PasswordResetSchema = new Schema({
  user: ref('User'),
  tokenHash: { type: String, required: true, unique: true },
  expiresAt: { type: Date, required: true },
  usedAt: Date,
});
PasswordResetSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

// Migration đã chạy + khóa phân tán (chạy nhiều server không bị chạy trùng)
const MigrationSchema = new Schema({ name: { type: String, unique: true }, ranAt: Date, ms: Number }, { versionKey: false });
const LockSchema = new Schema({ key: { type: String, unique: true }, until: Date, owner: String }, { versionKey: false });
LockSchema.index({ until: 1 }, { expireAfterSeconds: 3600 });

// ---- Mã kích hoạt (in QR + mã nhập tay trên mỗi chai / gói hạt) ----
const ActivationBatchSchema = new Schema(
  {
    name: { type: String, required: true, trim: true, maxlength: 80 },
    productSlug: String, // sản phẩm in mã (tùy chọn)
    lot: { type: Schema.Types.ObjectId, ref: 'StockLot', default: null },
    days: { type: Number, required: true, min: 1, max: 365 }, // ngày sử dụng mỗi mã
    quantity: { type: Number, required: true, min: 1, max: 20000 },
    packSize: { type: Number, default: 1, min: 1, max: 1000 }, // 1 mã dán cho mấy đơn vị (1 chai, lốc 6, thùng 24…)
    unit: { type: String, default: 'chai', maxlength: 20 }, // đơn vị in trên tem: chai / gói / hũ…
    expiresAt: { type: Date, default: null }, // hạn kích hoạt mã
    active: { type: Boolean, default: true },
    note: { type: String, maxlength: 200 },
    createdBy: String,
  },
  { timestamps: true },
);
const ActivationCodeSchema = new Schema(
  {
    code: { type: String, required: true, unique: true }, // 10 ký tự (bỏ 0/O/1/I), in dạng XXXXX-XXXXX
    batch: { type: Schema.Types.ObjectId, ref: 'ActivationBatch', required: true, index: true },
    days: { type: Number, required: true },
    status: { type: String, enum: ['new', 'used', 'void'], default: 'new', index: true },
    usedBy: { type: Schema.Types.ObjectId, ref: 'User', default: null, index: true },
    usedAt: Date,
  },
  { versionKey: false },
);
ActivationCodeSchema.index({ batch: 1, status: 1 });

// Sổ cộng/trừ ngày sử dụng (minh bạch: vì sao người dùng có hạn đến ngày X)
const MembershipGrantSchema = new Schema(
  {
    user: ref('User'),
    days: { type: Number, required: true }, // âm = thu hồi
    source: { type: String, enum: ['code', 'order', 'admin', 'migration', 'revoke'], required: true },
    ref: String, // mã kích hoạt / mã đơn
    note: String,
    by: String,
    untilBefore: Date,
    untilAfter: Date,
  },
  { timestamps: true },
);
MembershipGrantSchema.index({ user: 1, createdAt: -1 });

// ---- Kho hàng: lô (hạn dùng) + phiếu xuất nhập ----
const StockLotSchema = new Schema(
  {
    product: ref('Product'),
    code: { type: String, required: true, trim: true, maxlength: 40 },
    qty: { type: Number, required: true, min: 1 },
    remaining: { type: Number, required: true, min: 0 },
    mfgDate: String, // YYYY-MM-DD
    expiryDate: { type: String, index: true },
    cost: { type: Number, default: 0, min: 0 }, // giá vốn / đơn vị
    note: { type: String, maxlength: 200 },
    createdBy: String,
  },
  { timestamps: true },
);
StockLotSchema.index({ product: 1, expiryDate: 1 });
const StockMoveSchema = new Schema(
  {
    product: ref('Product'),
    type: { type: String, enum: ['import', 'sale', 'return', 'adjust', 'waste'], required: true, index: true },
    qty: { type: Number, required: true }, // + nhập / − xuất
    stockAfter: Number,
    lot: { type: Schema.Types.ObjectId, ref: 'StockLot', default: null },
    lots: [{ _id: false, lot: { type: Schema.Types.ObjectId, ref: 'StockLot' }, qty: Number }], // phân bổ theo lô (bán / hoàn)
    order: { type: Schema.Types.ObjectId, ref: 'Order', default: null, index: true },
    note: { type: String, maxlength: 200 },
    by: String,
  },
  { timestamps: true },
);
StockMoveSchema.index({ product: 1, createdAt: -1 });
StockMoveSchema.index({ createdAt: -1 });

export const Promo = model('Promo', PromoSchema);
export const ActivationBatch = model('ActivationBatch', ActivationBatchSchema);
export const ActivationCode = model('ActivationCode', ActivationCodeSchema);
export const MembershipGrant = model('MembershipGrant', MembershipGrantSchema);
export const StockLot = model('StockLot', StockLotSchema);
export const StockMove = model('StockMove', StockMoveSchema);
export const AuditLog = model('AuditLog', AuditLogSchema);
export const Event = model('Event', EventSchema);
export const Metric = model('Metric', MetricSchema);
export const ChatMessage = model('ChatMessage', ChatMessageSchema);
export const PasswordReset = model('PasswordReset', PasswordResetSchema);
export const Migration = model('Migration', MigrationSchema);
export const Lock = model('Lock', LockSchema);
export const User = model('User', UserSchema);
export const DailyLog = model('DailyLog', DailyLogSchema);
export const PlanChoice = model('PlanChoice', PlanChoiceSchema);
export const WeightEntry = model('WeightEntry', WeightEntrySchema);
export const Product = model('Product', ProductSchema);
export const Food = model('Food', FoodSchema);
export const Dish = model('Dish', DishSchema);
export const Activity = model('Activity', ActivitySchema);
export const MealPlan = model('MealPlan', MealPlanSchema);
export const Coupon = model('Coupon', CouponSchema);
export const Setting = model('Setting', SettingSchema);
export const Order = model('Order', OrderSchema);
export const Subscription = model('Subscription', SubscriptionSchema);
export const Reminder = model('Reminder', ReminderSchema);
export const PushSubscription = model('PushSubscription', PushSubscriptionSchema);
export const SupportRequest = model('SupportRequest', SupportRequestSchema);
