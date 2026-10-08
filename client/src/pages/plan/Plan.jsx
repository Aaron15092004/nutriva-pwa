import { useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { ChevronLeft, ChevronRight, Plus, Check, RefreshCw, Compass, NotebookPen } from 'lucide-react';
import { PLAN_BANDS, bandFor } from '@shared/nutrition.js';
import { useAuth } from '../../context/AuthContext.jsx';
import { useToast } from '../../context/ToastContext.jsx';
import { useApi } from '../../lib/useApi.js';
import { api } from '../../lib/api.js';
import { today, addDays, longDate } from '../../lib/format.js';
import { Skeleton, ErrorNote } from '../../components/ui.jsx';
import { CircleButton, IconCircle, SectionHeader, cx } from '../../components/ds/index.jsx';
import { ChipTabs } from '../../components/ds/charts.jsx';
import { HeroBackdrop } from '../../components/home/HomeHeader.jsx';
import { sumLog } from '../../components/meals.js';
import { DaySummary, MealBlock, PlanItemRow, PlanCard, PlanMiniCard, kcalRange } from '../../components/plan/PlanParts.jsx';

const TABS = [
  { id: 'mine', label: 'Thực đơn của bạn' },
  { id: 'explore', label: 'Khám phá thực đơn' },
  { id: 'custom', label: 'Thực đơn tự tạo' },
];

const dayLabel = (d) => {
  const t = today();
  if (d === t) return 'Hôm nay';
  if (d === addDays(t, -1)) return 'Hôm qua';
  if (d === addDays(t, 1)) return 'Ngày mai';
  return longDate(d);
};

// Đã ghi món này vào nhật ký chưa (cùng tên; thực phẩm thì cùng định lượng)
const isLogged = (log, it) => (log?.meals?.[it.meal] ?? []).some((e) => e.name === it.name && (it.kind !== 'food' || e.grams === it.grams));

// Ghi một món của thực đơn vào nhật ký
export async function logPlanItem(date, it) {
  const body =
    it.kind === 'food'
      ? { foodId: it.food, grams: it.grams, name: it.name }
      : { name: it.name, grams: Math.round((it.portion ?? 1) * 100), kcal: it.kcal, protein: it.protein, carb: it.carb, fat: it.fat };
  return (await api.post(`/logs/${date}/meals/${it.meal}`, body)).log;
}

function DateNav({ date, onChange }) {
  return (
    <div className="flex items-center justify-between gap-2">
      <CircleButton icon={ChevronLeft} label="Ngày trước" onClick={() => onChange(addDays(date, -1))} className="bg-white text-primary shadow-pill" />
      <button type="button" onClick={() => onChange(today())} className="min-h-10 px-4 text-base font-bold text-primary" aria-live="polite">
        {dayLabel(date)}
      </button>
      <CircleButton icon={ChevronRight} label="Ngày sau" onClick={() => onChange(addDays(date, 1))} className="bg-white text-primary shadow-pill" />
    </div>
  );
}

function LogButton({ it, logged, busy, onLog }) {
  return logged ? (
    <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-brand-light text-brand-dark" role="img" aria-label="Đã ghi vào nhật ký">
      <Check size={20} strokeWidth={2.5} aria-hidden="true" />
    </span>
  ) : (
    <CircleButton icon={Plus} label={`Ghi ${it.name} vào nhật ký`} onClick={onLog} disabled={busy} className="bg-surface text-primary disabled:opacity-50" />
  );
}

// Tab 1: thực đơn hôm nay theo kế hoạch đang áp dụng (hoặc gợi ý tự động khi chưa chọn kế hoạch)
function MyMenu({ date, setDate, onExplore }) {
  const toast = useToast();
  const navigate = useNavigate();
  const menu = useApi(`/meal-plans/today?date=${date}`);
  const auto = useApi(menu.data && !menu.data.plan ? `/plan/day?date=${date}` : null);
  const logApi = useApi(`/logs/${date}`);
  const [busy, setBusy] = useState(null);
  const log = logApi.data?.log;

  const onLog = async (it, key) => {
    setBusy(key);
    try {
      logApi.setData({ log: await logPlanItem(date, it) });
      toast(`Đã ghi “${it.name}”`);
    } catch (e) {
      toast(e.message, 'error');
    } finally {
      setBusy(null);
    }
  };

  if (menu.loading && !menu.data) return <Skeleton h={480} />;
  if (menu.error) return <ErrorNote error={menu.error} />;
  const { plan, day, dayIndex } = menu.data;

  if (!plan) {
    const d = auto.data?.day;
    return (
      <div className="flex flex-col gap-6">
        <DateNav date={date} onChange={setDate} />
        <section className="flex flex-col items-start gap-4 rounded-xl bg-breakfast-card p-4">
          <div className="flex items-center gap-4">
            <IconCircle icon={Compass} className="bg-brand-main text-white" />
            <div>
              <h2 className="text-base font-bold text-primary">Bạn chưa áp dụng kế hoạch nào</h2>
              <p className="text-sm text-secondary">Chọn một thực đơn 7 ngày phù hợp mức calo của bạn, hoặc dùng gợi ý tự động bên dưới.</p>
            </div>
          </div>
          <button type="button" onClick={onExplore} className="h-12 rounded-full bg-brand-dark px-6 text-base font-bold text-white transition hover:bg-brand-deep active:scale-[0.98]">
            Khám phá thực đơn
          </button>
        </section>
        <SectionHeader title="Gợi ý tự động của NUTRIVA" />
        {auto.loading || !d ? (
          <Skeleton h={360} />
        ) : (
          <>
            <DaySummary kcal={d.totalKcal} {...macroTotal(d.meals.map((m) => m.item))} eaten={sumLog(log).kcal} />
            {d.meals.map((m) => {
              const it = { ...m.item, meal: m.meal, kind: 'dish', grams: null };
              const key = `${m.meal}-auto`;
              return (
                <MealBlock key={m.meal} meal={m.meal} label={m.label} kcal={it.kcal}>
                  <PlanItemRow item={it} action={<LogButton it={it} logged={isLogged(log, it)} busy={busy === key} onLog={() => onLog(it, key)} />}>
                    <button type="button" onClick={() => navigate(`/plan/adjust/${date}/${m.meal}`)} className="mt-2 inline-flex min-h-8 items-center gap-1 text-xs font-bold text-brand-dark hover:text-brand-deep">
                      <RefreshCw size={14} aria-hidden="true" /> Đổi món
                    </button>
                  </PlanItemRow>
                </MealBlock>
              );
            })}
          </>
        )}
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      <PlanMiniCard plan={plan} note={`Ngày ${dayIndex + 1}/${plan.dayCount} • ${kcalRange(plan)}`} />
      <DateNav date={date} onChange={setDate} />
      <DaySummary kcal={day.kcal} protein={day.protein} carb={day.carb} fat={day.fat} eaten={sumLog(log).kcal} />
      {day.meals
        .filter((m) => m.items.length)
        .map((m) => (
          <MealBlock key={m.meal} meal={m.meal} label={m.label} kcal={m.kcal}>
            {m.items.map((it, i) => {
              const key = `${m.meal}-${i}`;
              return <PlanItemRow key={key} item={it} action={<LogButton it={it} logged={isLogged(log, it)} busy={busy === key} onLog={() => onLog(it, key)} />} />;
            })}
          </MealBlock>
        ))}
    </div>
  );
}

const macroTotal = (items) =>
  items.reduce((t, x) => ({ protein: t.protein + x.protein, carb: t.carb + x.carb, fat: t.fat + x.fat }), { protein: 0, carb: 0, fat: 0 });

// Tab 2: kế hoạch hiện tại + đề xuất theo mức calo
function Explore() {
  const { user } = useAuth();
  const { data, error, loading } = useApi('/meal-plans');
  const mine = bandFor(user.health.targetKcal);
  const [band, setBand] = useState(mine.id);
  if (loading) return <Skeleton h={480} />;
  if (error) return <ErrorNote error={error} />;
  const b = PLAN_BANDS.find((x) => x.id === band);
  const list = data.plans.filter((p) => p.kcalMin >= b.min && p.kcalMin < b.max);
  return (
    <div className="flex flex-col gap-6">
      {data.current && (
        <section aria-labelledby="cur-plan" className="flex flex-col gap-4">
          <SectionHeader id="cur-plan" title="Kế hoạch hiện tại của bạn" />
          <PlanMiniCard plan={data.current} />
        </section>
      )}
      <section aria-labelledby="sug-plan" className="flex flex-col gap-4">
        <div>
          <SectionHeader id="sug-plan" title="Đề xuất kế hoạch cho bạn" />
          <p className="text-sm text-muted">Mức calo mục tiêu của bạn: {user.health.targetKcal.toLocaleString('vi-VN')} kcal/ngày</p>
        </div>
        <ChipTabs items={PLAN_BANDS.map((x) => ({ id: x.id, label: x.id === mine.id ? `${x.label} ★` : x.label }))} value={band} onChange={setBand} label="Mức calo mỗi ngày" />
        {list.length ? (
          list.map((p) => <PlanCard key={p.id} plan={p} badge={band === mine.id ? 'Hợp với mục tiêu' : null} />)
        ) : (
          <p className="rounded-xl bg-white p-6 text-center text-sm text-muted shadow-card">Chưa có kế hoạch cho mức calo này.</p>
        )}
      </section>
    </div>
  );
}

// Tab 3: thực đơn tự tạo (bản sao đã tùy chỉnh)
function Custom({ onExplore }) {
  const { data, error, loading } = useApi('/meal-plans');
  if (loading) return <Skeleton h={320} />;
  if (error) return <ErrorNote error={error} />;
  if (!data.mine.length)
    return (
      <section className="flex flex-col items-center gap-4 rounded-xl bg-white px-6 py-8 text-center shadow-card">
        <IconCircle icon={NotebookPen} className="bg-brand-light text-brand-dark" size={64} iconSize={28} />
        <div>
          <h2 className="text-base font-bold text-primary">Chưa có thực đơn tự tạo</h2>
          <p className="text-sm text-muted">Mở một kế hoạch bất kỳ và chọn <b>Tùy chỉnh &amp; lưu</b> để tạo bản của riêng bạn — đổi món, thêm bớt, chỉnh định lượng.</p>
        </div>
        <button type="button" onClick={onExplore} className="h-12 rounded-full bg-brand-dark px-6 text-base font-bold text-white hover:bg-brand-deep">
          Khám phá thực đơn
        </button>
      </section>
    );
  return (
    <div className="flex flex-col gap-4">
      {data.mine.map((p) => (
        <PlanCard key={p.id} plan={p} badge={data.current?.id === p.id ? 'Đang áp dụng' : null} />
      ))}
    </div>
  );
}

export default function Plan() {
  const [params, setParams] = useSearchParams();
  const tab = TABS.some((t) => t.id === params.get('tab')) ? params.get('tab') : 'mine';
  const date = params.get('date') ?? today();
  const set = (patch) => setParams({ tab, date, ...patch }, { replace: true });
  const title = TABS.find((t) => t.id === tab).label;

  return (
    <main className="relative min-h-dvh overflow-x-clip bg-gradient-to-b from-background via-surface to-background pb-[calc(var(--nav-h)+var(--safe-b)+24px)]">
      <HeroBackdrop />
      <div className="relative flex flex-col gap-6 px-4 pt-6">
        <header className="flex items-center justify-between gap-4">
          <h1 className="font-display text-2xl font-bold text-brand-core [font-variation-settings:'SOFT'_100]">{title}</h1>
          <Link to="/me/edit?step=basic" className="font-secondary text-xs font-semibold text-brand-dark hover:text-brand-deep">Mục tiêu</Link>
        </header>
        <ChipTabs items={TABS} value={tab} onChange={(t) => set({ tab: t })} label="Thực đơn" />
        <div className={cx('flex flex-col gap-6')}>
          {tab === 'mine' && <MyMenu date={date} setDate={(d) => set({ date: d })} onExplore={() => set({ tab: 'explore' })} />}
          {tab === 'explore' && <Explore />}
          {tab === 'custom' && <Custom onExplore={() => set({ tab: 'explore' })} />}
        </div>
      </div>
    </main>
  );
}
