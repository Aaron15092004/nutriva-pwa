import { useState } from 'react';
import { useParams } from 'react-router-dom';
import { ChevronLeft, ChevronRight, Check } from 'lucide-react';
import { FOOD_GROUPS } from '@shared/nutrition.js';
import { useApi } from '../../lib/useApi.js';
import { TopBar, Skeleton, ErrorNote } from '../../components/ui.jsx';
import { CircleButton, fmt, cx } from '../../components/ds/index.jsx';
import { FOOD_ICON } from '../../components/meals.js';

const GROUP_LABEL = Object.fromEntries(FOOD_GROUPS.map((g) => [g.id, g.label]));
const amount = (g) => (g >= 1000 ? `${fmt(g / 1000, 2)} kg` : `${fmt(g)} g`);

// Nguyên liệu đã có (đánh dấu) — lưu trên máy theo từng kế hoạch
const KEY = (id) => `nutriva_pantry_${id}`;
const readHave = (id) => {
  try {
    return new Set(JSON.parse(localStorage.getItem(KEY(id))) ?? []);
  } catch {
    return new Set();
  }
};

export default function PlanIngredients() {
  const { id } = useParams();
  const [mode, setMode] = useState('day');
  const [day, setDay] = useState(0);
  const [have, setHave] = useState(() => readHave(id));
  const { data, error, loading } = useApi(`/meal-plans/${id}/ingredients${mode === 'day' ? `?day=${day}` : ''}`);
  const dayCount = data?.dayCount ?? 7;
  const items = data?.items ?? [];
  const done = items.filter((x) => have.has(x.food)).length;

  const toggle = (food) => {
    setHave((prev) => {
      const next = new Set(prev);
      if (next.has(food)) next.delete(food);
      else next.add(food);
      try {
        localStorage.setItem(KEY(id), JSON.stringify([...next]));
      } catch {
        /* bộ nhớ bị chặn */
      }
      return next;
    });
  };

  return (
    <>
      <TopBar title="Danh sách nguyên liệu" />
      <main className="flex flex-col gap-4 px-4 pb-12 pt-4">
        <div role="tablist" aria-label="Phạm vi" className="grid grid-cols-2 gap-1 rounded-full bg-surface p-1">
          {[
            { id: 'day', label: 'Ngày' },
            { id: 'week', label: 'Cả kế hoạch' },
          ].map((t) => (
            <button
              key={t.id}
              type="button"
              role="tab"
              aria-selected={mode === t.id}
              onClick={() => setMode(t.id)}
              className={cx('h-10 rounded-full text-sm font-bold transition', mode === t.id ? 'bg-white text-primary shadow-pill' : 'text-muted hover:text-primary')}
            >
              {t.label}
            </button>
          ))}
        </div>

        {mode === 'day' && (
          <div className="flex items-center justify-between">
            <CircleButton icon={ChevronLeft} label="Ngày trước" onClick={() => setDay((d) => d - 1)} disabled={day === 0} className="bg-white text-primary shadow-pill disabled:opacity-40" />
            <span className="text-base font-bold text-primary" aria-live="polite">Ngày {day + 1}</span>
            <CircleButton icon={ChevronRight} label="Ngày sau" onClick={() => setDay((d) => d + 1)} disabled={day >= dayCount - 1} className="bg-white text-primary shadow-pill disabled:opacity-40" />
          </div>
        )}

        <p className="text-sm text-muted">
          Đánh dấu những nguyên liệu bạn đã có để lên danh sách đi chợ dễ hơn. Món ăn đã được tách thành nguyên liệu theo khẩu phần; gạo, miến tính theo khối lượng khô.
        </p>

        {loading && <Skeleton h={420} />}
        <ErrorNote error={error} />
        {data && (
          <>
            <p className="font-secondary text-xs font-semibold text-secondary">
              Đã có {done}/{items.length} nguyên liệu
            </p>
            <ul className="flex flex-col divide-y divide-border rounded-xl bg-white shadow-card">
              {items.map((x) => {
                const Icon = FOOD_ICON[x.group];
                const ok = have.has(x.food);
                return (
                  <li key={x.food}>
                    <button type="button" onClick={() => toggle(x.food)} aria-pressed={ok} className="flex min-h-16 w-full items-center gap-4 px-4 py-2 text-left">
                      <span className="grid h-12 w-12 shrink-0 place-items-center rounded-md bg-teal-light text-teal-dark" aria-hidden="true">
                        <Icon size={22} />
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className={cx('block truncate text-base font-bold', ok ? 'text-muted line-through' : 'text-primary')}>{x.name}</span>
                        <span className="font-secondary text-xs text-muted">{amount(x.grams)} • {GROUP_LABEL[x.group]}</span>
                      </span>
                      <span className={cx('grid h-8 w-8 shrink-0 place-items-center rounded-full border-2', ok ? 'border-teal-main bg-teal-main text-white' : 'border-divider text-transparent')} aria-hidden="true">
                        <Check size={16} strokeWidth={3} />
                      </span>
                    </button>
                  </li>
                );
              })}
            </ul>
          </>
        )}
      </main>
    </>
  );
}
