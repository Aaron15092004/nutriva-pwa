import { Setting, Product, Food, Dish } from '../models/index.js';

// Cấu hình chung — cache ngắn để không truy vấn DB ở mọi request
let cache = null;
let cacheAt = 0;

export async function getSettings() {
  if (cache && Date.now() - cacheAt < 30_000) return cache;
  cache = (await Setting.findOne({ key: 'main' }).lean()) ?? {};
  cacheAt = Date.now();
  return cache;
}

export const invalidateSettings = () => {
  cache = null;
};

// Danh mục ít thay đổi → cache trong bộ nhớ (gộp các request đồng thời), xóa cache khi admin sửa.
// Sản phẩm có tồn kho thay đổi theo đơn hàng nên chỉ cache rất ngắn.
// Lưu ý: kết quả dùng chung giữa các request — không sửa trực tiếp mảng/đối tượng trả về.
const memo = (ttl, load) => {
  let value = null;
  let at = 0;
  let pending = null;
  const get = () => {
    if (value && Date.now() - at < ttl) return Promise.resolve(value);
    pending ??= load()
      .then((v) => {
        value = v;
        at = Date.now();
        return v;
      })
      .finally(() => {
        pending = null;
      });
    return pending;
  };
  get.clear = () => {
    value = null;
  };
  return get;
};

// Chuẩn hóa: client và kế hoạch dùng `id` = key
const withId = (d) => ({ ...d, id: d.key });
export const loadProducts = memo(10_000, () => Product.find({ active: true }).sort({ sort: 1, createdAt: 1 }).lean());
export const loadFoods = memo(5 * 60_000, async () => (await Food.find({ active: true }).sort({ group: 1, name: 1 }).lean()).map(withId));
export const loadDishes = memo(5 * 60_000, async () => (await Dish.find({ active: true }).sort({ meal: 1, key: 1 }).lean()).map(withId));

export function invalidateCatalog() {
  loadProducts.clear();
  loadFoods.clear();
  loadDishes.clear();
}
