import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ChevronLeft, ChevronRight, Droplets, Footprints, Bell, Laugh, Smile, Meh, Frown, Angry, Utensils } from 'lucide-react';
import { useAuth } from '../../context/AuthContext.jsx';
import { useToast } from '../../context/ToastContext.jsx';
import { useApi } from '../../lib/useApi.js';
import { api } from '../../lib/api.js';
import { num, today, addDays, weekStart, longDate } from '../../lib/format.js';
import { Segmented, Ring, Bar, Skeleton, Button } from '../../components/ui.jsx';
import ComplianceChart, { complianceScore } from '../../components/ComplianceChart.jsx';
import Nuti from '../../components/mascot/Nuti.jsx';
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
    const d = await api.post(`/logs/${date}/water`, { ml: 200 });
    setData(d);
    week.reload();
  };

  const sendMood = async () => {
    setSending(true);
    try {
      setData(await api.put(`/logs/${date}/mood`, { mood: currentMood }));
      toast('Cảm ơn bạn đã chia sẻ!');
    } finally {
      setSending(false);
    }
  };

  return (
    <main className="page stack-lg">
      <header className="row-between">
        <h1 className="title-lg">Theo dõi của tôi</h1>
        <Link to="/track/reminders" className="icon-btn" aria-label="Nhắc nhở"><Bell size={22} /></Link>
      </header>

      <Segmented label="Chế độ xem" value={view} onChange={setView} options={[{ id: 'day', label: 'Ngày' }, { id: 'week', label: 'Tuần' }]} />

      <div className="row-between">
        <button className="icon-btn" aria-label={view === 'day' ? 'Ngày trước' : 'Tuần trước'} onClick={() => { setMood(null); setDate(addDays(date, view === 'day' ? -1 : -7)); }}><ChevronLeft size={22} /></button>
        <b className="small">{view === 'day' ? longDate(date) : `Tuần ${longDate(weekStart(date)).split(', ')[1]} – ${longDate(addDays(weekStart(date), 6)).split(', ')[1]}`}</b>
        <button className="icon-btn" aria-label={view === 'day' ? 'Ngày sau' : 'Tuần sau'} onClick={() => { setMood(null); setDate(addDays(date, view === 'day' ? 1 : 7)); }}><ChevronRight size={22} /></button>
      </div>

      {view === 'day' ? (
        <>
          <section className="card row-between">
            <div className="stack" style={{ gap: 6 }}>
              <span className="row strong" style={{ gap: 6 }}><Droplets size={20} color="var(--water)" /> Lượng nước</span>
              <span className="tabular"><b style={{ fontSize: 26 }}>{num(water)}</b> <span className="muted">/ {num(h.waterMl)} ml</span></span>
              <button className="btn btn-primary btn-sm" onClick={addWater} style={{ alignSelf: 'flex-start' }}>+ 200 ml</button>
            </div>
            <Ring value={water} max={h.waterMl} size={96} stroke={10} color="var(--water)" track="#d6eaf8">
              <b className="tabular">{Math.round((water / h.waterMl) * 100)}%</b>
            </Ring>
          </section>

          <section className="card row-between">
            <div className="stack" style={{ gap: 6 }}>
              <span className="row strong" style={{ gap: 6 }}><Footprints size={20} color="var(--primary-600)" /> Vận động</span>
              <span className="tabular"><b style={{ fontSize: 26 }}>{exMin}</b> <span className="muted">/ {h.exerciseMin} phút</span></span>
              <button className="btn btn-primary btn-sm" onClick={() => navigate(`/activities?date=${date}`)} style={{ alignSelf: 'flex-start' }}>Ghi nhận</button>
            </div>
            <Ring value={exMin} max={h.exerciseMin} size={96} stroke={10}>
              <b className="tabular">{Math.min(999, Math.round((exMin / h.exerciseMin) * 100))}%</b>
            </Ring>
          </section>

          <section className="card stack">
            <div className="row-between">
              <h2 className="title-sm">Mức độ tuân thủ kế hoạch</h2>
              {week.ready && <span className="badge">TB {week.avg}%</span>}
            </div>
            <p className="xs muted" style={{ marginTop: -6 }}>So sánh calo đã ăn với mục tiêu {num(h.targetKcal)} kcal mỗi ngày.</p>
            {week.ready ? <ComplianceChart days={week.days} selected={date} /> : <Skeleton h={170} />}
          </section>

          <section className="card stack">
            <div>
              <h2 className="title-sm">Cảm nhận hôm nay</h2>
              <p className="small muted">Hôm nay bạn cảm thấy thế nào?</p>
            </div>
            <div className="grid-4" style={{ gridTemplateColumns: 'repeat(5, 1fr)', gap: 6 }} role="radiogroup" aria-label="Cảm nhận">
              {MOODS.map((m) => (
                <button key={m.id} role="radio" aria-checked={currentMood === m.id} className="choice" style={{ minHeight: 72, fontSize: 11.5, padding: 4 }} onClick={() => setMood(m.id)}>
                  <m.icon size={24} /> {m.label}
                </button>
              ))}
            </div>
            <Button className="btn-primary btn-block" loading={sending} disabled={!currentMood} onClick={sendMood}>Gửi phản hồi</Button>
          </section>
        </>
      ) : (
        week.ready ? (
          <>
            <section className="card stack">
              <div className="row-between">
                <h2 className="title-sm">Mức độ tuân thủ kế hoạch</h2>
                <span className="badge">TB {week.avg}%</span>
              </div>
              <ComplianceChart days={week.days} selected={date} />
            </section>
            <section className="grid-3">
              {[
                { icon: Utensils, label: 'Ngày đã ghi', value: `${week.logged.length}/7` },
                { icon: Droplets, label: 'Nước TB', value: `${num(week.days.reduce((s, d) => s + d.water, 0) / 7)} ml` },
                { icon: Footprints, label: 'Vận động', value: `${week.days.reduce((s, d) => s + d.ex, 0)} phút` },
              ].map((s) => (
                <div key={s.label} className="card center stack" style={{ gap: 4, alignItems: 'center', padding: 12 }}>
                  <span className="icon-tile" style={{ width: 36, height: 36 }}><s.icon size={18} /></span>
                  <b className="tabular" style={{ fontSize: 15 }}>{s.value}</b>
                  <span className="xs muted">{s.label}</span>
                </div>
              ))}
            </section>
            <section className="card stack">
              <h2 className="title-sm">Chi tiết theo ngày</h2>
              {week.days.map((d) => (
                <div key={d.date} className="stack" style={{ gap: 4 }}>
                  <div className="row-between small"><span>{longDate(d.date)}</span><span className="tabular muted">{num(d.kcal)} kcal</span></div>
                  <Bar value={d.kcal} max={h.targetKcal} />
                </div>
              ))}
            </section>
          </>
        ) : <Skeleton h={300} />
      )}

      <section className="stack">
        <Link to="/track/reminders" className="card card-link">
          <span className="icon-tile"><Bell size={22} /></span>
          <span className="grow"><b style={{ display: 'block' }}>Nhắc nhở</b><span className="small muted">Uống nước, uống sữa hạt, vận động mỗi ngày</span></span>
          <ChevronRight size={20} className="chev" />
        </Link>
        <Link to="/assistant" className="card card-link">
          <Nuti size={44} animated={false} />
          <span className="grow"><b style={{ display: 'block' }}>Hỏi Nuti</b><span className="small muted">Trợ lý dinh dưỡng: sản phẩm, thực đơn và kế hoạch của bạn</span></span>
          <ChevronRight size={20} className="chev" />
        </Link>
      </section>

    </main>
  );
}
