import { createContext, useContext, useEffect, useMemo, useState } from 'react';

const KEY = 'nutriva_cart';
const CartContext = createContext(null);

const load = () => {
  try {
    return JSON.parse(localStorage.getItem(KEY)) ?? [];
  } catch {
    return [];
  }
};

// Giỏ hàng lưu ở thiết bị; giá luôn được server tính lại khi đặt hàng.
export function CartProvider({ children }) {
  const [items, setItems] = useState(load);

  useEffect(() => {
    try {
      localStorage.setItem(KEY, JSON.stringify(items));
    } catch {
      /* bộ nhớ đầy hoặc bị chặn — giỏ chỉ giữ trong phiên */
    }
  }, [items]);

  const value = useMemo(() => {
    const keyOf = (i) => `${i.slug}|${i.sweetness}`;
    return {
      items,
      count: items.reduce((s, i) => s + i.qty, 0),
      subtotal: items.reduce((s, i) => s + i.price * i.qty, 0),
      add(product, qty = 1, sweetness = 'none') {
        setItems((prev) => {
          const k = `${product.slug}|${sweetness}`;
          const found = prev.find((i) => keyOf(i) === k);
          if (found) return prev.map((i) => (keyOf(i) === k ? { ...i, qty: Math.min(50, i.qty + qty) } : i));
          const { slug, name, type, image, price, size } = product;
          return [...prev, { slug, name, type, image, price, size, sweetness, qty }];
        });
      },
      setQty(item, qty) {
        setItems((prev) =>
          qty <= 0 ? prev.filter((i) => keyOf(i) !== keyOf(item)) : prev.map((i) => (keyOf(i) === keyOf(item) ? { ...i, qty } : i)),
        );
      },
      remove(item) {
        setItems((prev) => prev.filter((i) => keyOf(i) !== keyOf(item)));
      },
      clear: () => setItems([]),
      replace: (list) => setItems(list),
    };
  }, [items]);

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>;
}

export const useCart = () => useContext(CartContext);
