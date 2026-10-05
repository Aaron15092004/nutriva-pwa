import { useEffect, useMemo, useState } from 'react';
import { Search, Plus } from 'lucide-react';
import { FOOD_GROUPS } from '@shared/nutrition.js';
import { ChipTabs } from './ds/charts.jsx';
import { api } from '../lib/api.js';
import { num } from '../lib/format.js';
import { FOOD_ICON } from './meals.js';

const LIMIT = 60;
const GROUP_LABEL = Object.fromEntries(FOOD_GROUPS.map((g) => [g.id, g.label]));
// So khớp không dấu: "ga" tìm được "gà", "gạo"
const strip = (s) => s.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/đ/g, 'd');

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

// Ô tìm kiếm + lọc nhóm + danh sách thực phẩm; onPick(food)
export default function FoodSearchList({ foods, onPick }) {
  const [q, setQ] = useState('');
  const [group, setGroup] = useState('all');
  const groups = useMemo(() => [{ id: 'all', label: 'Tất cả' }, ...FOOD_GROUPS.filter((g) => foods.some((f) => f.group === g.id))], [foods]);
  const filtered = useMemo(() => {
    const k = strip(q.trim());
    return foods.filter((f) => (group === 'all' || f.group === group) && (!k || strip(f.name).includes(k)));
  }, [foods, q, group]);
  const shown = filtered.slice(0, LIMIT);

  return (
    <div className="stack">
      <div className="input-wrap">
        <Search size={20} />
        <input placeholder="Tìm thực phẩm, món ăn…" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Tìm thực phẩm" />
      </div>
      <ChipTabs items={groups} value={group} onChange={setGroup} label="Nhóm thực phẩm" />
      <ul style={{ listStyle: 'none', margin: 0, padding: 0 }} className="card flat">
        {shown.map((f) => {
          const I = FOOD_ICON[f.group];
          return (
            <li key={f.id}>
              <button className="list-row" style={{ padding: '8px 12px' }} onClick={() => onPick(f)}>
                <span className="icon-tile" style={{ width: 40, height: 40 }}><I size={20} /></span>
                <span className="grow">
                  <span style={{ display: 'block', fontWeight: 600 }}>{f.name}</span>
                  <span className="xs muted">{num(f.kcal)} kcal / 100 g • {GROUP_LABEL[f.group]}</span>
                </span>
                <Plus size={20} className="chev" />
              </button>
            </li>
          );
        })}
        {!filtered.length && <li className="empty">Không tìm thấy “{q}”</li>}
        {filtered.length > LIMIT && <li className="empty xs">Hiển thị {LIMIT}/{filtered.length} — gõ tên hoặc chọn nhóm để thu hẹp</li>}
      </ul>
    </div>
  );
}
