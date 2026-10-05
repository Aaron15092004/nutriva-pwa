import mongoose from 'mongoose';
import { MICRO_IDS } from '../../../shared/nutrition.js';

const { Schema, model } = mongoose;
const ref = (name) => ({ type: Schema.Types.ObjectId, ref: name, required: true, index: true });
const MEAL_IDS = ['breakfast', 'lunch', 'dinner', 'snack'];

const ProfileSchema = new Schema(
  {
    gender: { type: String, enum: ['male', 'female'], required: true },
    age: { type: Number, min: 10, max: 100, required: true },
    heightCm: { type: Number, min: 100, max: 230, required: true },
    weightKg: { type: Number, min: 25, max: 250, required: true },
    waistCm: { type: Number, min: 40, max: 200, required: true },
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
    passwordHash: { type: String, required: true },
    name: { type: String, required: true, trim: true, maxlength: 60 },
    role: { type: String, enum: ['user', 'admin'], default: 'user', index: true },
    avatar: { type: String, default: '' },
    profile: { type: ProfileSchema, required: true },
    consentAt: { type: Date, required: true },
    address: AddressSchema,
    // Kế hoạch ăn đang áp dụng: ngày 1 của kế hoạch = startDate, lặp lại sau mỗi chu kỳ
    activePlan: {
      type: new Schema({ plan: { type: Schema.Types.ObjectId, ref: 'MealPlan' }, startDate: String }, { _id: false }),
      default: null,
    },
  },
  { timestamps: true },
);

const LoggedFoodSchema = new Schema({
  foodId: String,
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
    exercises: [{ type: { type: String }, label: String, variant: String, met: Number, minutes: Number, kcal: Number, custom: Boolean }],
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
    type: { type: String, enum: ['milk', 'diy'], required: true },
    name: { type: String, required: true, trim: true },
    subtitle: String,
    size: String,
    price: { type: Number, required: true, min: 0 },
    line: String,
    ingredients: { type: [String], default: [] },
    extraIngredients: { type: [String], default: [] },
    flavor: { type: String, enum: ['beo-nhe', 'thanh-nhe', 'dam-vi'], default: 'beo-nhe' },
    image: String,
    description: String,
    nutrition: { kcal: { type: Number, default: 0 }, protein: { type: Number, default: 0 }, carb: { type: Number, default: 0 }, fat: { type: Number, default: 0 } },
    storage: String,
    steps: [{ _id: false, title: String, text: String }],
    stock: { type: Number, default: null, min: 0 }, // null = không giới hạn
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
    style: { type: String, enum: ['eat-clean', 'balanced', 'high-protein', 'plant', 'vietnamese'], default: 'balanced', index: true },
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
  },
  { timestamps: true },
);

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
  },
  { timestamps: true },
);

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
