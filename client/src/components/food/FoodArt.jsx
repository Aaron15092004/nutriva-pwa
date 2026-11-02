import { useState } from 'react';
import { Plus, Minus } from 'lucide-react';
import { useApi } from '../../lib/useApi.js';
import { num } from '../../lib/format.js';
import { Sheet } from '../ui.jsx';
import { PrimaryButton } from '../ds/form.jsx';
import { cx } from '../ds/index.jsx';
import { foodImage, dishImage } from '@shared/foodImages.js';

// Ảnh thực phẩm / món trong ô bo tròn nền nhạt (ảnh emoji 3D trong suốt → đặt trên nền, ảnh chụp → phủ kín)
export function FoodThumb({ item, size = 48, className = '' }) {
  const src = item?.image || (item?.kind === 'dish' || item?.category ? dishImage(item) : foodImage(item));
  const photo = src && !src.startsWith('/img/foods/');
  return (
    <span className={cx('grid shrink-0 place-items-center overflow-hidden rounded-md bg-surface', className)} style={{ width: size, height: size }} aria-hidden="true">
      <img src={src} alt="" loading="lazy" className={photo ? 'h-full w-full object-cover' : 'h-[78%] w-[78%] object-contain'} />
    </span>
  );
}

// Danh sách món nấu (dùng chung cache)
export function useDishes(enabled = true) {
  const { data, error } = useApi(enabled ? '/dishes' : null);
  return { dishes: data?.dishes ?? [], error };
}

const PORTIONS = [0.5, 1, 1.5, 2];

// Nội dung chi tiết món nấu: ảnh, dinh dưỡng theo khẩu phần, nguyên liệu (kèm ảnh, gram).
// onAdd(portion) có → hiện chọn khẩu phần + nút thêm vào bữa.
export function DishDetail({ dish, portion: initial = 1, onAdd, adding, addLabel = 'Thêm vào bữa' }) {
  const [portion, setPortion] = useState(initial);
  const p = portion;
  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center gap-4">
        <FoodThumb item={{ ...dish, kind: 'dish' }} size={72} />
        <div className="min-w-0 flex-1">
          <p className="text-lg font-bold leading-6 text-primary">{dish.name}</p>
          <p className="font-secondary text-sm text-muted">
            {num(dish.kcal * p)} kcal • {num(dish.grams * p)} g • {String(p).replace('.', ',')} phần
          </p>
        </div>
      </div>
      <div className="grid grid-cols-3 gap-2 text-center">
        {[['Đạm', dish.protein, 'text-brand-main'], ['Bột đường', dish.carb, 'text-water-icon'], ['Béo', dish.fat, 'text-warm-main']].map(([l, v, c]) => (
          <span key={l} className="flex flex-col rounded-lg bg-surface py-2">
            <span className="text-xs text-muted">{l}</span>
            <b className={cx('font-secondary text-base tabular-nums', c)}>{num(v * p, 1)} g</b>
          </span>
        ))}
      </div>
      <section aria-label="Nguyên liệu" className="flex flex-col gap-2">
        <h3 className="text-sm font-bold text-primary">Nguyên liệu ({dish.ingredients.length})</h3>
        {dish.ingredients.length ? (
          <ul className="grid grid-cols-1 gap-1">
            {dish.ingredients.map((i) => (
              <li key={`${i.food}-${i.grams}`} className="flex items-center gap-4 rounded-lg bg-white px-2 py-1">
                <FoodThumb item={{ name: i.name, image: i.image }} size={40} />
                <span className="min-w-0 flex-1 truncate text-sm font-semibold text-primary">{i.name}</span>
                <span className="font-secondary text-sm tabular-nums text-secondary">{num(i.grams * p)} g</span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-muted">Món chế biến sẵn — dinh dưỡng tham khảo cho 1 phần.</p>
        )}
      </section>
      {onAdd && (
        <>
          <div className="flex flex-col gap-2">
            <span className="text-sm font-bold text-primary">Khẩu phần</span>
            <div className="flex items-center gap-2">
              <button type="button" aria-label="Bớt nửa phần" disabled={p <= 0.5} onClick={() => setPortion(Math.max(0.5, p - 0.5))} className="grid size-11 place-items-center rounded-full bg-surface text-primary disabled:opacity-40"><Minus size={18} /></button>
              <div className="flex flex-1 gap-1">
                {PORTIONS.map((x) => (
                  <button key={x} type="button" aria-pressed={p === x} onClick={() => setPortion(x)} className={cx('h-11 flex-1 rounded-full text-sm font-semibold', p === x ? 'bg-brand-dark text-white' : 'bg-surface text-primary')}>
                    {String(x).replace('.', ',')}
                  </button>
                ))}
              </div>
              <button type="button" aria-label="Thêm nửa phần" disabled={p >= 4} onClick={() => setPortion(Math.min(4, p + 0.5))} className="grid size-11 place-items-center rounded-full bg-surface text-primary disabled:opacity-40"><Plus size={18} /></button>
            </div>
          </div>
          <PrimaryButton loading={adding} onClick={() => onAdd(p)} className="w-full">
            <Plus size={20} aria-hidden="true" /> {addLabel} • {num(dish.kcal * p)} kcal
          </PrimaryButton>
        </>
      )}
    </div>
  );
}

// Modal xem nguyên liệu của 1 món nấu (từ kế hoạch, gợi ý…) theo key món
export function DishSheet({ dishKey, portion = 1, onClose }) {
  const { dishes } = useDishes(Boolean(dishKey));
  const dish = dishes.find((d) => d.key === dishKey || d.id === dishKey);
  return (
    <Sheet open={Boolean(dishKey)} onClose={onClose} title="Thành phần món ăn">
      {dish ? <DishDetail dish={dish} portion={portion} /> : <p className="py-8 text-center text-sm text-muted">Đang tải…</p>}
    </Sheet>
  );
}
