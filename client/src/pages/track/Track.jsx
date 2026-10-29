import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ChevronLeft, ChevronRight, Droplets, Footprints, Bell, Laugh, Smile, Meh, Frown, Angry, Utensils } from 'lucide-react';
import { useAuth } from '../../context/AuthContext.jsx';
import { useToast } from '../../context/ToastContext.jsx';
import { useApi } from '../../lib/useApi.js';
import { api } from '../../lib/api.js';
import { changeWater } from '../../lib/logs.js';
import { num, today, addDays, weekStart, longDate } from '../../lib/format.js';
import { Segmented, Ring, Bar, Skeleton } from '../../components/ui.jsx';
import { CircleButton } from '../../components/ds/index.jsx';
import { PrimaryButton } from '../../components/ds/form.jsx';
import ComplianceChart, { complianceScore } from '../../components/ComplianceChart.jsx';
import Nuti from '../../components/mascot/Nuti.jsx';
import PromoCarousel from '../../components/promo/PromoCarousel.jsx';
import { sumLog } from '../../components/meals.js';

const MOODS = [
  { id: 'great', label: 'Rất tốt', icon: Laugh },
  { id: 'good', label: 'Tốt', icon: Smile },
  { id: 'normal', label: 'Bình thường', icon: Meh },
  { id: 'tired', label: 'Mệt mỏi', icon: Frown },
  { id: 'bad', label: 'Không tốt', icon: Angry },
];

function useWeek(date, target) {
  const start = weekStart(date);
  const { data, loading, reload } = useApi(`/logs?from=${start}&to=${addDays(start, 6)}`);
  const days = (data?.logs ?? []).map((l) => {
    const kcal = Math.round(sumLog(l).kcal);
    return { date: l.date, kcal, score: complianceScore(kcal, target), water: l.waterMl ?? 0, ex: (l.exercises ?? []).reduce((s, e) => s + e.minutes, 0) };
  });
  const logged = days.filter((d) => d.score != null);
  const avg = logged.length ? Math.round(logged.reduce((s, d) => s + d.score, 0) / logged.length) : 0;
  return { ready: Boolean(data) && !loading, days, logged, avg, reload };
}

export default function Track() {
  const { user } = useAuth();
  const toast = useToast();
  const h = user.health;
  const [view, setView] = useState('day');
  const [date, setDate] = useState(today);
  const { data, setData } = useApi(`/logs/${date}`);
  const navigate = useNavigate();
  const [mood, setMood] = useState(null);
  const [sending, setSending] = useState(false);
  const log = data?.log;
  const week = useWeek(date, h.targetKcal);

  const water = log?.waterMl ?? 0;
  const exMin = (log?.exercises ?? []).reduce((s, e) => s + e.minutes, 0);
  const currentMood = mood ?? log?.mood;

  const addWater = async () => {
    try {
      const r = await changeWater(date, log, 200);
      setData({ log: r.log });
      toast(r.queued ? 'Đã lưu 200 ml trên máy — sẽ đồng bộ khi có mạng' : 'Đã thêm 200 ml nước');
      if (!r.queued) week.reload();
    } catch (e) {
      toast(e.message, 'error');
    }
  };

  const sendMood = async () => {
    setSending(true);
    try {
      setData(await api.put(`/logs/${date}/mood`, { mood: currentMood }));
      toast('Cảm ơn bạn đã chia sẻ!');
    } catch (e) {
      toast(e.message, 'error');
    } finally {
      setSending(false);
    }
  };

  const stepDate = (n) => {
    setMood(null);
    setDate(addDays(date, n));
  };
  const card = 'rounded-xl bg-white p-4 shadow-card';
  const badge = 'rounded-full bg-brand-light px-2 py-1 font-secondary text-xs font-semibold text-brand-deep';
  const rangeLabel = view === 'day' ? longDate(date) : `Tuần ${longDate(weekStart(date)).split(', ')[1]} – ${longDate(addDays(weekStart(date), 6)).split(', ')[1]}`;

  return (
    <main className="flex flex-col gap-6 px-4 pb-[calc(var(--nav-h)+var(--safe-b)+24px)] pt-[max(16px,env(safe-area-inset-top))]">
      <header className="flex items-center justify-between gap-4">
        <h1 className="font-display text-2xl font-bold text-brand-core [font-variation-settings:'SOFT'_100]">Theo dõi của tôi</h1>
        <Link to="/track/reminders" className="grid size-11 place-items-center rounded-full text-primary hover:bg-brand-light" aria-label="Nhắc nhở">
          <Bell size={22} aria-hidden="true" />
        </Link>
      </header>

      <Segmented label="Chế độ xem" value={view} onChange={setView} options={[{ id: 'day', label: 'Ngày' }, { id: 'week', label: 'Tuần' }]} />

      <div className="flex items-center justify-between gap-2">
        <CircleButton icon={ChevronLeft} label={view === 'day' ? 'Ngày trước' : 'Tuần trước'} onClick={() => stepDate(view === 'day' ? -1 : -7)} className="bg-white text-primary shadow-pill" />
        <button type="button" onClick={() => setDate(today())} className="min-h-10 px-2 text-sm font-bold text-primary" aria-live="polite">
          {rangeLabel}
        </button>
        <CircleButton icon={ChevronRight} label={view === 'day' ? 'Ngày sau' : 'Tuần sau'} onClick={() => stepDate(view === 'day' ? 1 : 7)} className="bg-white text-primary shadow-pill" />
      </div>

      {view === 'day' ? (
        <>
          <section className={`${card} flex items-center justify-between gap-4`}>
            <div className="flex flex-col gap-2">
              <span className="flex items-center gap-2 font-bold text-primary">
                <Droplets size={20} className="text-water-icon" aria-hidden="true" /> Lượng nước
              </span>
              <span className="font-secondary tabular-nums">
                <b className="text-2xl text-primary">{num(water)}</b> <span className="text-muted">/ {num(h.waterMl)} ml</span>
              </span>
              <button type="button" onClick={addWater} className="h-10 self-start rounded-full bg-water-icon px-4 text-sm font-bold text-white transition active:scale-95">
                + 200 ml
              </button>
            </div>
            <Ring value={water} max={h.waterMl} size={96} stroke={10} color="var(--water)" track="#d6eaf8">
              <b className="font-secondary tabular-nums text-primary">{Math.round((water / h.waterMl) * 100)}%</b>
            </Ring>
          </section>

          <section className={`${card} flex items-center justify-between gap-4`}>
            <div className="flex flex-col gap-2">
              <span className="flex items-center gap-2 font-bold text-primary">
                <Footprints size={20} className="text-brand-main" aria-hidden="true" /> Vận động
              </span>
              <span className="font-secondary tabular-nums">
                <b className="text-2xl text-primary">{exMin}</b> <span className="text-muted">/ {h.exerciseMin} phút</span>
              </span>
              <button type="button" onClick={() => navigate(`/activities?date=${date}`)} className="h-10 self-start rounded-full bg-brand-dark px-4 text-sm font-bold text-white transition active:scale-95">
                Ghi nhận
              </button>
            </div>
            <Ring value={exMin} max={h.exerciseMin} size={96} stroke={10}>
              <b className="font-secondary tabular-nums text-primary">{Math.min(999, Math.round((exMin / h.exerciseMin) * 100))}%</b>
            </Ring>
          </section>

          <section className={`${card} flex flex-col gap-2`}>
            <div className="flex items-center justify-between gap-2">
              <h2 className="text-base font-bold text-primary">Mức độ tuân thủ kế hoạch</h2>
              {week.ready && <span className={badge}>TB {week.avg}%</span>}
            </div>
            <p className="text-xs text-muted">So sánh calo đã ăn với mục tiêu {num(h.targetKcal)} kcal mỗi ngày.</p>
            {week.ready ? <ComplianceChart days={week.days} selected={date} /> : <Skeleton h={170} />}
          </section>

          <section className={`${card} flex flex-col gap-4`}>
            <div>
              <h2 className="text-base font-bold text-primary">Cảm nhận hôm nay</h2>
              <p className="text-sm text-muted">Hôm nay bạn cảm thấy thế nào?</p>
            </div>
            <div className="grid grid-cols-5 gap-2" role="radiogroup" aria-label="Cảm nhận">
              {MOODS.map((m) => {
                const on = currentMood === m.id;
                return (
                  <button
                    key={m.id}
                    type="button"
                    role="radio"
                    aria-checked={on}
                    onClick={() => setMood(m.id)}
                    className={`flex min-h-[76px] flex-col items-center justify-center gap-1 rounded-lg border-2 px-1 text-xs leading-tight transition ${on ? 'border-brand-dark bg-brand-light font-bold text-brand-deep' : 'border-border bg-white text-secondary'}`}
                  >
                    <m.icon size={24} className={on ? 'text-brand-dark' : 'text-brand-main'} aria-hidden="true" /> {m.label}
                  </button>
                );
              })}
            </div>
            <PrimaryButton loading={sending} disabled={!currentMood} onClick={sendMood} className="w-full">
              Gửi phản hồi
            </PrimaryButton>
          </section>
        </>
      ) : week.ready ? (
        <>
          <section className={`${card} flex flex-col gap-2`}>
            <div className="flex items-center justify-between gap-2">
              <h2 className="text-base font-bold text-primary">Mức độ tuân thủ kế hoạch</h2>
              <span className={badge}>TB {week.avg}%</span>
            </div>
            <ComplianceChart days={week.days} selected={date} />
          </section>
          <section className="grid grid-cols-3 gap-2">
            {[
              { icon: Utensils, label: 'Ngày đã ghi', value: `${week.logged.length}/7` },
              { icon: Droplets, label: 'Nước TB', value: `${num(week.days.reduce((s, d) => s + d.water, 0) / 7)} ml` },
              { icon: Footprints, label: 'Vận động', value: `${week.days.reduce((s, d) => s + d.ex, 0)} phút` },
            ].map((x) => (
              <div key={x.label} className="flex flex-col items-center gap-1 rounded-xl bg-white p-4 text-center shadow-card">
                <span className="grid size-9 place-items-center rounded-full bg-brand-light text-brand-dark" aria-hidden="true">
                  <x.icon size={18} />
                </span>
                <b className="font-secondary text-base tabular-nums text-primary">{x.value}</b>
                <span className="text-xs text-muted">{x.label}</span>
              </div>
            ))}
          </section>
          <section className={`${card} flex flex-col gap-4`}>
            <h2 className="text-base font-bold text-primary">Chi tiết theo ngày</h2>
            {week.days.map((d) => (
              <div key={d.date} className="flex flex-col gap-1">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-secondary">{longDate(d.date)}</span>
                  <span className="font-secondary tabular-nums text-muted">{num(d.kcal)} kcal</span>
                </div>
                <Bar value={d.kcal} max={h.targetKcal} />
              </div>
            ))}
          </section>
        </>
      ) : (
        <Skeleton h={300} />
      )}

      <PromoCarousel placement="track" />

      <section className="flex flex-col gap-4">
        <Link to="/track/reminders" className={`${card} flex items-center gap-4 transition active:scale-[0.99]`}>
          <span className="grid size-11 shrink-0 place-items-center rounded-full bg-brand-light text-brand-dark" aria-hidden="true">
            <Bell size={22} />
          </span>
          <span className="min-w-0 flex-1">
            <b className="block text-primary">Nhắc nhở</b>
            <span className="text-sm text-muted">Uống nước, uống sữa hạt, vận động mỗi ngày</span>
          </span>
          <ChevronRight size={20} className="shrink-0 text-divider" aria-hidden="true" />
        </Link>
        <Link to="/assistant" className={`${card} flex items-center gap-4 transition active:scale-[0.99]`}>
          <Nuti size={44} animated={false} />
          <span className="min-w-0 flex-1">
            <b className="block text-primary">Hỏi Nuti</b>
            <span className="text-sm text-muted">Trợ lý dinh dưỡng: sản phẩm, thực đơn và kế hoạch của bạn</span>
          </span>
          <ChevronRight size={20} className="shrink-0 text-divider" aria-hidden="true" />
        </Link>
      </section>
    </main>
  );
}
