import { useEffect, useState } from 'react';
import { Trash2, ChevronLeft, Plus } from 'lucide-react';
import { MEALS } from '@shared/nutrition.js';
import { api } from '../lib/api.js';
import { num } from '../lib/format.js';
import { useToast } from '../context/ToastContext.jsx';
import { Sheet, Button, ErrorNote } from './ui.jsx';
import { FOOD_ICON, MEAL_STYLE, sumMeal } from './meals.js';
import FoodSearchList, { useFoods } from './FoodSearchList.jsx';

function MacroRow({ kcal, protein, carb, fat, big }) {
  const cells = [
    { label: 'Calo', value: `${num(kcal)}`, unit: 'kcal', color: 'var(--green-800)' },
    { label: 'Đạm', value: num(protein, 1), unit: 'g', color: 'var(--protein)' },
    { label: 'Bột đường', value: num(carb, 1), unit: 'g', color: 'var(--carb)' },
    { label: 'Béo', value: num(fat, 1), unit: 'g', color: 'var(--fat)' },
  ];
  return (
    <div className="grid-4">
      {cells.map((c) => (
        <div key={c.label} className="card flat center" style={{ padding: big ? '12px 4px' : '8px 4px' }}>
          <div className="xs muted">{c.label}</div>
          <div className="tabular" style={{ fontWeight: 800, fontSize: big ? 20 : 15, color: c.color }}>{c.value}</div>
          <div className="xs muted">{c.unit}</div>
        </div>
      ))}
    </div>
  );
}

// Sheet của một bữa ăn: xem món đã ghi + thêm món theo định lượng (gram)
export default function MealSheet({ open, onClose, meal, date, log, targets, onLog, presetFood }) {
  const toast = useToast();
  const { foods, error: loadError } = useFoods(open);
  const [picked, setPicked] = useState(null);
  const [grams, setGrams] = useState('');
  const [mealId, setMealId] = useState(meal);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!open) return;
    setMealId(meal);
    setError('');
    setPicked(presetFood ?? null);
    setGrams(presetFood ? String(presetFood.serving) : '');
  }, [open, meal, presetFood]);

  const g = Number(grams) || 0;
  const calc = picked && {
    kcal: (picked.kcal * g) / 100,
    protein: (picked.protein * g) / 100,
    carb: (picked.carb * g) / 100,
    fat: (picked.fat * g) / 100,
  };

  const PickedIcon = picked ? FOOD_ICON[picked.group] : null;
  const items = log?.meals?.[mealId] ?? [];
  const total = sumMeal(items);
  const label = MEALS.find((m) => m.id === mealId)?.label;
  const style = MEAL_STYLE[mealId] ?? MEAL_STYLE.snack;
  const target = targets?.[mealId];

  const add = async () => {
    if (!(g > 0 && g <= 3000)) {
      setError('Nhập định lượng từ 1 đến 3000 g');
      return;
    }
    setSaving(true);
    setError('');
    try {
      const d = await api.post(`/logs/${date}/meals/${mealId}`, { foodId: picked.id, grams: g });
      onLog(d.log);
      toast(`Đã thêm ${picked.name} vào ${label.toLowerCase()}`);
      setPicked(null);
      setGrams('');
    } catch (e) {
      setError(e.message);
    } finally {
      setSaving(false);
    }
  };

  const remove = async (entry) => {
    try {
      const d = await api.del(`/logs/${date}/meals/${mealId}/${entry._id}`);
      onLog(d.log);
    } catch (e) {
      toast(e.message, 'error');
    }
  };

  return (
    <Sheet open={open} onClose={onClose} title={label ?? ''}>
      <div className="stack">
        {presetFood && (
          <div className="segmented" role="tablist" aria-label="Chọn bữa">
            {MEALS.map((m) => (
              <button key={m.id} role="tab" aria-selected={mealId === m.id} onClick={() => setMealId(m.id)} style={{ fontSize: 12.5 }}>
                {m.label.replace('Bữa ', '')}
              </button>
            ))}
          </div>
        )}

        <div className="card row" style={{ background: style.bg, boxShadow: 'none' }}>
          <span className="icon-tile" style={{ background: '#fff', color: style.fg }}>
            <style.icon size={22} />
          </span>
          <div className="grow">
            <div className="strong tabular">{num(total.kcal)} kcal</div>
            {target && <div className="small" style={{ color: style.fg }}>Mục tiêu: {num(target.min)}–{num(target.max)} kcal</div>}
          </div>
        </div>

        {!picked && items.length > 0 && (
          <ul className="card flat" style={{ listStyle: 'none', margin: 0, padding: '4px 12px' }}>
            {items.map((it) => (
              <li key={it._id} className="list-row">
                <div className="grow">
                  <div className="strong" style={{ fontSize: 15 }}>{it.name}</div>
                  <div className="xs muted tabular">
                    {it.foodId ? `${num(it.grams)} g` : `${num(it.grams / 100, 1)} phần`} • {num(it.kcal)} kcal • Đ {num(it.protein, 1)} • B {num(it.carb, 1)} • Béo {num(it.fat, 1)}
                  </div>
                </div>
                <button className="icon-btn" aria-label={`Xóa ${it.name}`} onClick={() => remove(it)}>
                  <Trash2 size={18} color="var(--danger)" />
                </button>
              </li>
            ))}
          </ul>
        )}

        {picked ? (
          <div className="stack">
            <button className="link" onClick={() => setPicked(null)} style={{ alignSelf: 'flex-start' }}>
              <ChevronLeft size={18} /> Chọn món khác
            </button>
            <div className="row">
              <span className="icon-tile lg"><PickedIcon size={26} /></span>
              <div className="grow">
                <div className="title-md">{picked.name}</div>
                <div className="small muted">{num(picked.kcal)} kcal / 100 g • {picked.unit} ≈ {picked.serving} g</div>
              </div>
            </div>
            <div className="field">
              <label htmlFor="grams">Định lượng đã ăn</label>
              <div className="input-wrap">
                <input id="grams" type="number" inputMode="decimal" min="1" max="3000" value={grams} onChange={(e) => setGrams(e.target.value)} autoFocus />
                <span className="unit">gram</span>
              </div>
              <div className="chips">
                {[...new Set([picked.serving, 50, 100, 150, 200])].map((x) => (
                  <button key={x} type="button" className="chip" aria-pressed={g === x} onClick={() => setGrams(String(x))}>
                    {x} g{x === picked.serving ? ` (${picked.unit})` : ''}
                  </button>
                ))}
              </div>
            </div>
            <MacroRow {...calc} big />
            <ErrorNote error={error} />
            <Button className="btn-primary btn-block" loading={saving} onClick={add} disabled={!g}>
              <Plus size={20} /> Thêm vào {label?.toLowerCase()}
            </Button>
          </div>
        ) : (
          <>
            <ErrorNote error={loadError} />
            <FoodSearchList foods={foods} onPick={(f) => { setPicked(f); setGrams(String(f.serving)); }} />
          </>
        )}
      </div>
    </Sheet>
  );
}

export { MacroRow };
