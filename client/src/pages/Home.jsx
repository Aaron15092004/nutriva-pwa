import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { GlassWater, Flame, Download, X, Plus } from 'lucide-react';
import { GOALS, MEALS, exerciseKcal } from '@shared/nutrition.js';
import { useAuth } from '../context/AuthContext.jsx';
import { usePwa } from '../context/PwaContext.jsx';
import { useToast } from '../context/ToastContext.jsx';
import { useApi } from '../lib/useApi.js';
import { api } from '../lib/api.js';
import { today, longDate, weekStart, addDays } from '../lib/format.js';
import { Skeleton } from '../components/ui.jsx';
import { SectionHeader, fmt } from '../components/ds/index.jsx';
import { HeroBackdrop, HomeHeader } from '../components/home/HomeHeader.jsx';
import WeekDateSelector from '../components/home/WeekDateSelector.jsx';
import SummaryCarousel from '../components/home/SummaryCarousel.jsx';
import MealCard from '../components/home/MealCard.jsx';
import TrackerCard from '../components/home/TrackerCard.jsx';
import RecommendationCard from '../components/home/RecommendationCard.jsx';
import MealSheet from '../components/MealSheet.jsx';
import { WaterSheet } from '../components/ActivitySheets.jsx';
import { FOOD_ICON, sumLog } from '../components/meals.js';

const FAV_KEY = 'nutriva_fav_dishes';
const readFavs = () => {
  try {
    return new Set(JSON.parse(localStorage.getItem(FAV_KEY)) ?? []);
  } catch {
    return new Set();
  }
};

function InstallCard() {
  const pwa = usePwa();
  const [hidden, setHidden] = useState(() => {
    try {
      return localStorage.getItem('nutriva_hide_install') === '1';
    } catch {
      return false;
    }
  });
  if (!pwa.showInstall || hidden) return null;
  const hide = () => {
    setHidden(true);
    try {
      localStorage.setItem('nutriva_hide_install', '1');
    } catch {
      /* bộ nhớ bị chặn */
    }
  };
  return (
    <aside className="flex items-center gap-4 rounded-lg bg-teal-core p-4 text-white shadow-card">
      <Download size={24} aria-hidden="true" className="shrink-0" />
      <div className="min-w-0 flex-1">
        <p className="text-sm font-bold">{pwa.installedOnDevice ? 'NUTRIVA đã có trên máy bạn' : 'Cài đặt NUTRIVA'}</p>
        <p className="text-xs text-teal-soft">{pwa.installedOnDevice ? 'Mở từ màn hình chính để dùng mượt hơn' : 'Mở nhanh từ màn hình chính, như ứng dụng'}</p>
      </div>
      <button type="button" onClick={pwa.install} className="h-10 shrink-0 rounded-full bg-white px-4 text-sm font-bold text-teal-core">{pwa.installedOnDevice ? 'Mở app' : 'Cài đặt'}</button>
      <button type="button" onClick={hide} aria-label="Ẩn gợi ý cài đặt" className="grid h-10 w-10 place-items-center rounded-full hover:bg-white/10">
        <X size={18} aria-hidden="true" />
      </button>
    </aside>
  );
}

// Nhắc nhở đang bật còn lại trong hôm nay
function remindersLeftToday(reminders) {
  const now = new Date();
  const hhmm = now.toTimeString().slice(0, 5);
  return (reminders ?? []).filter((r) => r.enabled && r.days.includes(now.getDay()) && r.time > hhmm).length;
}

export default function Home() {
  const { user } = useAuth();
  const toast = useToast();
  const navigate = useNavigate();
  const [params, setParams] = useSearchParams();
  const [date, setDate] = useState(today);
  const { data, setData, loading } = useApi(`/logs/${date}`);
  const start = weekStart(date);
  const week = useApi(`/logs?from=${start}&to=${addDays(start, 6)}`);
  const plan = useApi(`/plan/day?date=${date}`);
  const suggest = useApi('/foods/suggest');
  const reminders = useApi('/reminders');
  const [sheet, setSheet] = useState(null); // { kind: 'meal'|'water', meal?, food? }
  const [favs, setFavs] = useState(readFavs);
  const [tracking, setTracking] = useState(null);

  const h = user.health;
  const log = data?.log;
  const eaten = sumLog(log);
  const burned = (log?.exercises ?? []).reduce((s, e) => s + e.kcal, 0);
  const exMin = (log?.exercises ?? []).reduce((s, e) => s + e.minutes, 0);
  const burnTarget = exerciseKcal('walk', h.exerciseMin, user.profile.weightKg);
  const goal = GOALS.find((g) => g.id === user.profile.goal)?.label;

  // Mở sheet từ nút + ở thanh điều hướng (?sheet=breakfast|water|exercise…)
  useEffect(() => {
    const s = params.get('sheet');
    if (!s) return;
    if (s === 'water') setSheet({ kind: s });
    else if (MEALS.some((m) => m.id === s)) setSheet({ kind: 'meal', meal: s });
    setParams({}, { replace: true });
  }, [params, setParams]);

  // % calo đã ăn mỗi ngày trong tuần (vòng tiến độ ở dải ngày)
  const weekProgress = useMemo(() => {
    const out = {};
    for (const l of week.data?.logs ?? []) out[l.date] = sumLog(l).kcal / h.targetKcal;
    if (log) out[date] = eaten.kcal / h.targetKcal;
    return out;
  }, [week.data, log, date, eaten.kcal, h.targetKcal]);

  const onLog = (l) => setData({ log: l });

  const addWater = async () => {
    try {
      onLog((await api.post(`/logs/${date}/water`, { ml: 200 })).log);
      toast('Đã thêm 200 ml nước');
    } catch (e) {
      toast(e.message, 'error');
    }
  };

  const toggleFav = (id) => {
    setFavs((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      try {
        localStorage.setItem(FAV_KEY, JSON.stringify([...next]));
      } catch {
        /* bộ nhớ bị chặn */
      }
      return next;
    });
  };

  const trackDish = async (m) => {
    const it = m.item;
    setTracking(it.id);
    try {
      const d = await api.post(`/logs/${date}/meals/${m.meal}`, {
        name: it.name,
        grams: Math.round(it.portion * 100),
        kcal: it.kcal,
        protein: it.protein,
        carb: it.carb,
        fat: it.fat,
      });
      onLog(d.log);
      toast(`Đã ghi “${it.name}”`);
    } catch (e) {
      toast(e.message, 'error');
    } finally {
      setTracking(null);
    }
  };

  const isTracked = (m) => (log?.meals?.[m.meal] ?? []).some((x) => x.name === m.item.name);

  return (
    <main className="relative min-h-dvh overflow-x-clip bg-gradient-to-b from-background via-surface to-background pb-[calc(var(--nav-h)+var(--safe-b)+24px)]">
      <HeroBackdrop />
      <div className="relative flex flex-col gap-6 px-4 pt-4">
        <HomeHeader remindersLeft={remindersLeftToday(reminders.data?.reminders)} />

        <div>
          <p className="font-secondary text-xs font-medium text-secondary">{longDate(date)}</p>
          <h1 className="font-display text-2xl font-bold text-teal-core [font-variation-settings:'SOFT'_100]">Chào {user.name}!</h1>
        </div>

        <WeekDateSelector value={date} onChange={setDate} progress={weekProgress} />

        <SummaryCarousel goalLabel={goal} health={h} profile={user.profile} eaten={eaten} burned={burned} />

        <section aria-labelledby="eaten-title" className="flex flex-col gap-4">
          <SectionHeader id="eaten-title" title="Đã ăn" action="Chọn kế hoạch" to="/plan" />
          {loading && !log ? (
            <Skeleton h={480} />
          ) : (
            MEALS.map((m) => (
              <MealCard key={m.id} meal={m.id} label={m.label} items={log?.meals?.[m.id]} target={h.meals[m.id]} onOpen={() => setSheet({ kind: 'meal', meal: m.id })} />
            ))
          )}
        </section>

        <section aria-label="Nước và vận động" className="flex flex-col gap-4">
          <TrackerCard
            icon={GlassWater}
            iconClass="bg-water-icon text-white"
            cardClass="bg-water-card"
            title="Ghi lại lượng nước"
            subtitle={`Bạn đã uống ${fmt(log?.waterMl ?? 0)} / ${fmt(h.waterMl)} ml`}
            onOpen={() => setSheet({ kind: 'water' })}
            onAdd={addWater}
            addLabel="Thêm 200 ml nước"
          />
          <TrackerCard
            icon={Flame}
            iconClass="bg-warm-main text-white"
            cardClass="bg-torch-card"
            title="Đốt cháy calo"
            subtitle={`Đã đốt ${fmt(burned)} / ${fmt(burnTarget)} kcal • ${exMin}/${h.exerciseMin} phút`}
            onOpen={() => navigate(`/activities?date=${date}`)}
            onAdd={() => navigate(`/activities?date=${date}`)}
            addLabel="Ghi nhận vận động"
          />
        </section>

        <section aria-labelledby="rec-title" className="flex flex-col gap-4">
          <SectionHeader id="rec-title" title="Món gợi ý hôm nay" action="Xem tất cả" to={`/plan?view=day&date=${date}`} />
          {plan.loading ? (
            <Skeleton h={320} />
          ) : (
            <div className="-mx-4 flex snap-x snap-mandatory scroll-px-4 gap-4 overflow-x-auto px-4 pb-2 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
              {(plan.data?.day.meals ?? []).map((m) => (
                <RecommendationCard
                  key={m.meal}
                  item={{ ...m.item, meal: m.meal }}
                  mealLabel={m.label}
                  favorite={favs.has(m.item.id)}
                  tracked={isTracked(m)}
                  busy={tracking === m.item.id}
                  onFavorite={() => toggleFav(m.item.id)}
                  onTrack={() => trackDish(m)}
                />
              ))}
            </div>
          )}
        </section>

        <section aria-labelledby="food-title" className="flex flex-col gap-4">
          <SectionHeader id="food-title" title="Thực phẩm phù hợp với bạn" />
          <div className="-mx-4 flex snap-x scroll-px-4 gap-2 overflow-x-auto px-4 pb-2 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            {(suggest.data?.foods ?? []).map((f) => {
              const I = FOOD_ICON[f.group];
              return (
                <button
                  key={f.id}
                  type="button"
                  onClick={() => setSheet({ kind: 'meal', meal: 'snack', food: f })}
                  className="flex w-40 shrink-0 snap-start flex-col items-start gap-2 rounded-lg bg-white p-4 text-left shadow-card transition active:scale-[0.98]"
                >
                  <span className="flex w-full items-center justify-between">
                    <span className="grid h-10 w-10 place-items-center rounded-md bg-teal-light text-teal-dark" aria-hidden="true"><I size={20} /></span>
                    <Plus size={20} className="text-teal-dark" aria-hidden="true" />
                  </span>
                  <span className="line-clamp-1 text-sm font-bold text-primary">{f.name}</span>
                  <span className="font-secondary text-xs text-muted">{fmt(f.kcal)} kcal • đạm {fmt(f.protein, 1)} g</span>
                </button>
              );
            })}
          </div>
        </section>

        <InstallCard />
      </div>

      <MealSheet open={sheet?.kind === 'meal'} onClose={() => setSheet(null)} meal={sheet?.meal} presetFood={sheet?.food} date={date} log={log} targets={h.meals} onLog={onLog} />
      <WaterSheet open={sheet?.kind === 'water'} onClose={() => setSheet(null)} date={date} log={log} targetMl={h.waterMl} onLog={onLog} />
    </main>
  );
}
