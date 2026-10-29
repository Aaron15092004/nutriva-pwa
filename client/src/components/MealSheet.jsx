import { useEffect, useState } from 'react';
import { Trash2, ChevronLeft, Plus, Star, CopyPlus, CloudOff } from 'lucide-react';
import { MEALS } from '@shared/nutrition.js';
import { api } from '../lib/api.js';
import { useApi } from '../lib/useApi.js';
import { sendOrQueue, newCid } from '../lib/outbox.js';
import { num, addDays } from '../lib/format.js';
import { useToast } from '../context/ToastContext.jsx';
import { Sheet, ErrorNote } from './ui.jsx';
import { PrimaryButton } from './ds/form.jsx';
import { ChipTabs } from './ds/charts.jsx';
import { cx } from './ds/index.jsx';
import { FOOD_ICON, MEAL_STYLE, sumMeal } from './meals.js';
import FoodSearchList, { FoodRow, useFoods } from './FoodSearchList.jsx';

function MacroRow({ kcal, protein, carb, fat, big }) {
  const cells = [
    { label: 'Calo', value: num(kcal), unit: 'kcal', color: 'text-brand-deep' },
    { label: 'Đạm', value: num(protein, 1), unit: 'g', color: 'text-brand-main' },
    { label: 'Bột đường', value: num(carb, 1), unit: 'g', color: 'text-water-icon' },
    { label: 'Béo', value: num(fat, 1), unit: 'g', color: 'text-warm-main' },
  ];
  return (
    <div className="grid grid-cols-4 gap-2">
      {cells.map((c) => (
        <div key={c.label} className={cx('flex flex-col items-center rounded-lg bg-surface', big ? 'py-3' : 'py-2')}>
          <span className="text-xs text-muted">{c.label}</span>
          <span className={cx('font-secondary font-extrabold tabular-nums', big ? 'text-xl' : 'text-base', c.color)}>{c.value}</span>
          <span className="text-xs text-muted">{c.unit}</span>
        </div>
      ))}
    </div>
  );
}

const macrosOf = (food, g) => ({
  kcal: Math.round((food.kcal * g) / 100),
  protein: +((food.protein * g) / 100).toFixed(1),
  carb: +((food.carb * g) / 100).toFixed(1),
  fat: +((food.fat * g) / 100).toFixed(1),
});

// Sheet của một bữa ăn: xem món đã ghi + thêm món theo định lượng (gram).
// Ghi nhanh: món gần đây / yêu thích / chép bữa hôm qua. Mất mạng vẫn ghi được (gửi khi có mạng).
export default function MealSheet({ open, onClose, meal, date, log, targets, onLog, presetFood }) {
  const toast = useToast();
  const { foods, error: loadError } = useFoods(open);
  const quick = useApi(open ? '/foods/quick' : null);
  const [tab, setTab] = useState('recent');
  const [picked, setPicked] = useState(null);
  const [grams, setGrams] = useState('');
  const [mealId, setMealId] = useState(meal);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const recent = quick.data?.recent ?? [];
  const favorites = quick.data?.favorites ?? [];
  const favIds = new Set(favorites.map((f) => f.id));

  useEffect(() => {
    if (!open) return;
    setMealId(meal);
    setError('');
    setPicked(presetFood ?? null);
    setGrams(presetFood ? String(presetFood.serving) : '');
  }, [open, meal, presetFood]);

  // Mặc định mở "Gần đây" nếu có, không thì vào tìm kiếm
  useEffect(() => {
    if (open && quick.data) setTab(recent.length ? 'recent' : favorites.length ? 'fav' : 'search');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, Boolean(quick.data)]);

  const g = Number(grams) || 0;
  const calc = picked && macrosOf(picked, g);
  const PickedIcon = picked ? FOOD_ICON[picked.group] : null;
  const items = log?.meals?.[mealId] ?? [];
  const total = sumMeal(items);
  const label = MEALS.find((m) => m.id === mealId)?.label ?? '';
  const style = MEAL_STYLE[mealId] ?? MEAL_STYLE.snack;
  const target = targets?.[mealId];

  const pick = (f, gramsHint) => {
    setPicked(f);
    setGrams(String(gramsHint ?? f.serving));
    setError('');
  };

  const add = async () => {
    if (!(g > 0 && g <= 3000)) {
      setError('Nhập định lượng từ 1 đến 3000 g');
      return;
    }
    setSaving(true);
    setError('');
    try {
      const cid = newCid();
      const d = await sendOrQueue(`/logs/${date}/meals/${mealId}`, { foodId: picked.id, grams: g, cid });
      if (d.queued) {
        // Ngoại tuyến: hiện ngay trên máy, đồng bộ sau
        const entry = { _id: cid, cid, foodId: picked.id, name: picked.name, grams: g, ...macrosOf(picked, g), pending: true };
        onLog({ ...log, meals: { ...log?.meals, [mealId]: [...items, entry] } });
        toast('Đã lưu trên máy — sẽ đồng bộ khi có mạng');
      } else {
        onLog(d.log);
        toast(`Đã thêm ${picked.name} vào ${label.toLowerCase()}`);
      }
      setPicked(null);
      setGrams('');
    } catch (e) {
      setError(e.message);
    } finally {
      setSaving(false);
    }
  };

  const remove = async (entry) => {
    if (entry.pending) return toast('Món này đang chờ đồng bộ, xóa được sau khi có mạng', 'error');
    try {
      onLog((await api.del(`/logs/${date}/meals/${mealId}/${entry._id}`)).log);
    } catch (e) {
      toast(e.message, 'error');
    }
  };

  const copyYesterday = async () => {
    setSaving(true);
    try {
      const d = await api.post(`/logs/${date}/copy`, { from: addDays(date, -1), meal: mealId, cid: newCid() });
      onLog(d.log);
      toast(`Đã chép ${d.copied} món từ ${label.toLowerCase()} hôm qua`);
    } catch (e) {
      toast(e.message, 'error');
    } finally {
      setSaving(false);
    }
  };

  const toggleFav = async (f) => {
    const on = !favIds.has(f.id);
    quick.setData((d) => d && { ...d, favorites: on ? [...d.favorites, f] : d.favorites.filter((x) => x.id !== f.id) });
    try {
      await api.put(`/foods/${f.id}/favorite`, { on });
    } catch (e) {
      toast(e.message, 'error');
      quick.reload();
    }
  };

  const starBtn = (f) => (
    <button type="button" onClick={() => toggleFav(f)} aria-pressed={favIds.has(f.id)} aria-label={favIds.has(f.id) ? `Bỏ yêu thích ${f.name}` : `Yêu thích ${f.name}`} className="grid size-11 shrink-0 place-items-center rounded-full hover:bg-surface">
      <Star size={20} aria-hidden="true" className={favIds.has(f.id) ? 'fill-snacks-card text-cookie' : 'text-divider'} />
    </button>
  );

  return (
    <Sheet open={open} onClose={onClose} title={label}>
      <div className="flex flex-col gap-4">
        {presetFood && (
          <div role="tablist" aria-label="Chọn bữa" className="grid grid-cols-4 gap-1 rounded-full bg-surface p-1">
            {MEALS.map((m) => (
              <button key={m.id} type="button" role="tab" aria-selected={mealId === m.id} onClick={() => setMealId(m.id)} className={cx('h-10 rounded-full text-sm font-semibold transition', mealId === m.id ? 'bg-white text-primary shadow-pill' : 'text-muted')}>
                {m.label.replace('Bữa ', '')}
              </button>
            ))}
          </div>
        )}

        <div className="flex items-center gap-4 rounded-lg p-4" style={{ background: style.bg }}>
          <span className="grid size-12 shrink-0 place-items-center rounded-full bg-white" style={{ color: style.fg }} aria-hidden="true">
            <style.icon size={22} />
          </span>
          <div className="min-w-0 flex-1">
            <p className="font-secondary text-lg font-extrabold tabular-nums text-primary">{num(total.kcal)} kcal</p>
            {target && <p className="text-sm font-semibold" style={{ color: style.fg }}>Mục tiêu: {num(target.min)}–{num(target.max)} kcal</p>}
          </div>
        </div>

        {!picked && items.length > 0 && (
          <ul className="rounded-lg bg-surface px-4">
            {items.map((it) => (
              <li key={it._id} className="flex items-center gap-2 border-b border-white py-2 last:border-0">
                <div className="min-w-0 flex-1">
                  <p className="flex items-center gap-1 truncate text-base font-semibold text-primary">
                    {it.pending && <CloudOff size={14} className="shrink-0 text-subtle" aria-label="Chờ đồng bộ" />}
                    {it.name}
                  </p>
                  <p className="truncate font-secondary text-xs tabular-nums text-muted">
                    {it.foodId ? `${num(it.grams)} g` : `${num(it.grams / 100, 1)} phần`} • {num(it.kcal)} kcal • Đạm {num(it.protein, 1)} • Bột {num(it.carb, 1)} • Béo {num(it.fat, 1)}
                  </p>
                </div>
                <button type="button" className="grid size-11 shrink-0 place-items-center rounded-full hover:bg-white" aria-label={`Xóa ${it.name}`} onClick={() => remove(it)}>
                  <Trash2 size={18} className="text-warm-dark" aria-hidden="true" />
                </button>
              </li>
            ))}
          </ul>
        )}

        {picked ? (
          <div className="flex flex-col gap-4">
            <button type="button" className="inline-flex min-h-10 items-center gap-1 self-start text-sm font-bold text-brand-dark" onClick={() => setPicked(null)}>
              <ChevronLeft size={18} aria-hidden="true" /> Chọn món khác
            </button>
            <div className="flex items-center gap-4">
              <span className="grid size-14 shrink-0 place-items-center rounded-lg bg-brand-light text-brand-dark" aria-hidden="true">
                <PickedIcon size={26} />
              </span>
              <div className="min-w-0 flex-1">
                <p className="text-lg font-bold text-primary">{picked.name}</p>
                <p className="font-secondary text-sm text-muted">
                  {num(picked.kcal)} kcal / 100 g • {picked.unit} ≈ {picked.serving} g
                </p>
              </div>
              {starBtn(picked)}
            </div>
            <div className="flex flex-col gap-2">
              <label htmlFor="grams" className="text-sm font-bold text-primary">Định lượng đã ăn</label>
              <div className="flex h-14 items-center gap-2 rounded-lg border border-border bg-white px-4 focus-within:border-brand-main focus-within:ring-2 focus-within:ring-brand-soft">
                <input id="grams" type="number" inputMode="decimal" min="1" max="3000" value={grams} onChange={(e) => setGrams(e.target.value)} className="h-full min-w-0 flex-1 bg-transparent text-lg font-semibold tabular-nums text-primary outline-none" />
                <span className="font-secondary text-sm text-muted">gram</span>
              </div>
              <div className="flex flex-wrap gap-2">
                {[...new Set([picked.lastGrams, picked.serving, 50, 100, 150, 200].filter(Boolean))].map((x) => (
                  <button key={x} type="button" aria-pressed={g === x} onClick={() => setGrams(String(x))} className={cx('h-10 rounded-full px-4 text-sm font-semibold transition', g === x ? 'bg-brand-dark text-white' : 'bg-surface text-primary hover:bg-brand-light')}>
                    {x} g{x === picked.serving ? ` (${picked.unit})` : x === picked.lastGrams ? ' (lần trước)' : ''}
                  </button>
                ))}
              </div>
            </div>
            <MacroRow {...calc} big />
            <ErrorNote error={error} />
            <PrimaryButton loading={saving} onClick={add} disabled={!g} className="w-full">
              <Plus size={20} aria-hidden="true" /> Thêm vào {label.toLowerCase()}
            </PrimaryButton>
          </div>
        ) : (
          <>
            {items.length === 0 && (
              <button type="button" disabled={saving} onClick={copyYesterday} className="flex min-h-12 items-center justify-center gap-2 rounded-full border border-dashed border-brand-pastel bg-brand-light px-4 text-sm font-bold text-brand-deep disabled:opacity-50">
                <CopyPlus size={18} aria-hidden="true" /> Ăn giống hôm qua? Chép {label.toLowerCase()} hôm qua
              </button>
            )}
            <ChipTabs
              label="Cách chọn món"
              value={tab}
              onChange={setTab}
              items={[
                { id: 'recent', label: `Gần đây${recent.length ? ` (${recent.length})` : ''}` },
                { id: 'fav', label: `Yêu thích${favorites.length ? ` (${favorites.length})` : ''}` },
                { id: 'search', label: 'Tìm thực phẩm' },
              ]}
            />
            <ErrorNote error={loadError} />
            {tab === 'search' ? (
              <FoodSearchList foods={foods} onPick={(f) => pick(f)} />
            ) : (
              <ul className="rounded-lg bg-white px-4">
                {(tab === 'recent' ? recent : favorites).map((f) => (
                  <FoodRow key={f.id} food={f} note={f.lastGrams ? `Lần trước ${num(f.lastGrams)} g • ${num((f.kcal * f.lastGrams) / 100)} kcal` : undefined} onPick={(x) => pick(x, x.lastGrams)} trailing={starBtn(f)} />
                ))}
                {quick.loading && <li className="py-8 text-center text-sm text-muted">Đang tải…</li>}
                {!quick.loading && !(tab === 'recent' ? recent : favorites).length && (
                  <li className="flex flex-col items-center gap-2 py-8 text-center">
                    <p className="text-sm text-muted">{tab === 'recent' ? 'Món bạn ghi sẽ hiện ở đây để thêm lại chỉ với 1 chạm.' : 'Bấm ☆ cạnh món ăn để lưu vào Yêu thích.'}</p>
                    <button type="button" onClick={() => setTab('search')} className="h-10 rounded-full bg-brand-dark px-4 text-sm font-bold text-white">Tìm thực phẩm</button>
                  </li>
                )}
              </ul>
            )}
          </>
        )}
      </div>
    </Sheet>
  );
}

export { MacroRow };
