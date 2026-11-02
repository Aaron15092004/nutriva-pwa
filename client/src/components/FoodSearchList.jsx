import { useEffect, useMemo, useState } from 'react';
import { Search, Plus } from 'lucide-react';
import { FOOD_GROUPS } from '@shared/nutrition.js';
import { ChipTabs } from './ds/charts.jsx';
import { api } from '../lib/api.js';
import { num } from '../lib/format.js';
import { FoodThumb } from './food/FoodArt.jsx';

const LIMIT = 60;
const GROUP_LABEL = Object.fromEntries(FOOD_GROUPS.map((g) => [g.id, g.label]));
// So khớp không dấu: "ga" tìm được "gà", "gạo"
const strip = (s) => s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/đ/g, 'd');

// Bảng thực phẩm (tải 1 lần, dùng chung giữa các màn hình)
let foodsCache = null;
export function useFoods(enabled = true) {
  const [foods, setFoods] = useState(foodsCache ?? []);
  const [error, setError] = useState('');
  useEffect(() => {
    if (!enabled || foodsCache) return;
    api
      .get('/foods')
      .then((d) => {
        foodsCache = d.foods;
        setFoods(d.foods);
      })
      .catch((e) => setError(e.message));
  }, [enabled]);
  return { foods, error };
}

// Một dòng thực phẩm trong danh sách chọn
export function FoodRow({ food, note, onPick, trailing }) {
  return (
    <li className="flex items-center gap-2 border-b border-surface last:border-0">
      <button type="button" className="flex min-h-14 min-w-0 flex-1 items-center gap-4 py-2 text-left" onClick={() => onPick(food)}>
        <FoodThumb item={food} size={44} />
        <span className="min-w-0 flex-1">
          <span className="block truncate text-base font-semibold text-primary">{food.name}</span>
          <span className="block truncate font-secondary text-xs text-muted">{note ?? `${num(food.kcal)} kcal / 100 g • ${GROUP_LABEL[food.group] ?? ''}`}</span>
        </span>
        {!trailing && <Plus size={20} className="shrink-0 text-brand-dark" aria-hidden="true" />}
      </button>
      {trailing}
    </li>
  );
}

// Ô tìm kiếm + lọc nhóm + danh sách thực phẩm; onPick(food)
export default function FoodSearchList({ foods, onPick, autoFocus = false }) {
  const [q, setQ] = useState('');
  const [group, setGroup] = useState('all');
  const groups = useMemo(() => [{ id: 'all', label: 'Tất cả' }, ...FOOD_GROUPS.filter((g) => foods.some((f) => f.group === g.id))], [foods]);
  const filtered = useMemo(() => {
    const k = strip(q.trim());
    return foods.filter((f) => (group === 'all' || f.group === group) && (!k || strip(f.name).includes(k)));
  }, [foods, q, group]);
  const shown = filtered.slice(0, LIMIT);

  return (
    <div className="flex flex-col gap-4">
      <label className="flex h-12 items-center gap-2 rounded-full border border-border bg-white px-4 focus-within:border-brand-main focus-within:ring-2 focus-within:ring-brand-soft">
        <Search size={20} className="shrink-0 text-subtle" aria-hidden="true" />
        <input
          type="search"
          enterKeyHint="search"
          autoFocus={autoFocus}
          placeholder="Tìm thực phẩm, món ăn…"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          aria-label="Tìm thực phẩm"
          className="h-full min-w-0 flex-1 bg-transparent text-base text-primary outline-none placeholder:text-subtle"
        />
      </label>
      <ChipTabs items={groups} value={group} onChange={setGroup} label="Nhóm thực phẩm" />
      <ul className="rounded-lg bg-white px-4">
        {!foods.length && <li className="py-8 text-center text-sm text-muted">Đang tải danh sách thực phẩm…</li>}
        {shown.map((f) => (
          <FoodRow key={f.id} food={f} onPick={onPick} />
        ))}
        {foods.length > 0 && !filtered.length && <li className="py-8 text-center text-sm text-muted">Không tìm thấy “{q}” — thử gõ ngắn hơn hoặc không dấu</li>}
        {filtered.length > LIMIT && <li className="py-4 text-center text-xs text-muted">Hiển thị {LIMIT}/{filtered.length} — gõ tên hoặc chọn nhóm để thu hẹp</li>}
      </ul>
    </div>
  );
}
