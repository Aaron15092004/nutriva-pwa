import { useEffect, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ArrowLeft, Settings, Crown, Package, CalendarDays, MessageSquareHeart, Flag, Plus } from 'lucide-react';
import { GOALS } from '@shared/nutrition.js';
import { useAuth } from '../../context/AuthContext.jsx';
import { useToast } from '../../context/ToastContext.jsx';
import { useApi } from '../../lib/useApi.js';
import { api } from '../../lib/api.js';
import { today, addDays, weekdayShort, dayNum } from '../../lib/format.js';
import { Sheet, Button, ErrorNote, Skeleton } from '../../components/ui.jsx';
import { CircleButton, fmt, cx } from '../../components/ds/index.jsx';
import { BarChart, LineChart, BmiScale, ChipTabs } from '../../components/ds/charts.jsx';
import { HeroBackdrop } from '../../components/home/HomeHeader.jsx';
import { sumLog } from '../../components/meals.js';
import AvatarPicker from '../../components/me/AvatarPicker.jsx';

const TONE = { good: 'text-recipe', warn: 'text-cookie', bad: 'text-warm-dark' };
const SECTIONS = [
  { id: 'bmi', label: 'BMI' },
  { id: 'weight', label: 'Cân nặng' },
  { id: 'intake', label: 'Calo nạp' },
  { id: 'water', label: 'Nước' },
  { id: 'activity', label: 'Vận động' },
];

// Ô lối tắt 2×2 (Đơn hàng / Tổng kết / Góp ý / Mục tiêu)
function ShortcutTile({ to, icon: Icon, title, sub }) {
  return (
    <Link to={to} className="flex min-h-16 items-center gap-2 rounded-lg bg-white p-4 shadow-card transition hover:shadow-float active:scale-[0.98]">
      <Icon size={28} strokeWidth={2} className="shrink-0 text-primary" aria-hidden="true" />
      <span className="min-w-0">
        <span className="block truncate text-base font-bold text-primary">{title}</span>
        <span className="block truncate text-xs text-muted">{sub}</span>
      </span>
    </Link>
  );
}

// Thẻ chỉ số (khung trắng chung cho các mục BMI, cân nặng, calo…)
function MetricCard({ id, title, action, children }) {
  return (
    <section id={id} data-section={id} aria-labelledby={`${id}-title`} className="scroll-mt-4 rounded-xl bg-white p-4 shadow-card">
      <div className="mb-2 flex min-h-10 items-center justify-between gap-2">
        <h2 id={`${id}-title`} className="text-base font-bold text-primary">{title}</h2>
        {action}
      </div>
      {children}
    </section>
  );
}

function Big({ value, unit, note, noteClass = 'text-muted' }) {
  return (
    <p className="mb-4 flex flex-wrap items-baseline gap-2">
      <b className="font-secondary text-2xl text-primary">{value}</b>
      {unit && <span className="text-sm text-muted">{unit}</span>}
      {note && <span className={cx('text-sm font-semibold', noteClass)}>{note}</span>}
    </p>
  );
}

function WeightSheet({ open, onClose, current, onSaved }) {
  const toast = useToast();
  const [kg, setKg] = useState(String(current));
  const [date, setDate] = useState(today());
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  useEffect(() => {
    if (open) {
      setKg(String(current));
      setDate(today());
      setError('');
    }
  }, [open, current]);
  const save = async () => {
    setBusy(true);
    setError('');
    try {
      const d = await api.post('/auth/me/weights', { kg: Number(kg), date });
      onSaved(d.user);
      toast('Đã ghi cân nặng — chỉ số đã được tính lại');
      onClose();
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  };
  return (
    <Sheet open={open} onClose={onClose} title="Ghi cân nặng">
      <div className="flex flex-col gap-4">
        <div className="grid grid-cols-2 gap-4">
          <div className="field">
            <label htmlFor="w-kg">Cân nặng</label>
            <div className="input-wrap"><input id="w-kg" type="number" inputMode="decimal" step="0.1" min="25" max="250" value={kg} onChange={(e) => setKg(e.target.value)} /><span className="unit">kg</span></div>
          </div>
          <div className="field">
            <label htmlFor="w-date">Ngày</label>
            <div className="input-wrap"><input id="w-date" type="date" max={today()} value={date} onChange={(e) => setDate(e.target.value)} /></div>
          </div>
        </div>
        <p className="text-xs text-muted">Nên cân vào buổi sáng, trước khi ăn, để số liệu ổn định.</p>
        <ErrorNote error={error} />
        <Button className="btn-primary btn-block" loading={busy} disabled={!kg} onClick={save}>Lưu cân nặng</Button>
      </div>
    </Sheet>
  );
}

export default function Profile() {
  const { user, setUser } = useAuth();
  const navigate = useNavigate();
  const p = user.profile;
  const h = user.health;
  const t = today();
  const start = addDays(t, -6);
  const week = useApi(`/logs?from=${start}&to=${t}`);
  const weights = useApi(`/auth/me/weights?days=90&v=${p.weightKg}`);
  const orders = useApi('/orders');
  const [active, setActive] = useState('bmi');
  const [weightOpen, setWeightOpen] = useState(false);
  const clickLock = useRef(false);

  // Chip theo mục đang hiển thị
  useEffect(() => {
    const obs = new IntersectionObserver(
      (entries) => {
        if (clickLock.current) return;
        const top = entries.filter((e) => e.isIntersecting).sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top)[0];
        if (top) setActive(top.target.dataset.section);
      },
      { rootMargin: '-30% 0px -55% 0px' },
    );
    document.querySelectorAll('[data-section]').forEach((el) => obs.observe(el));
    return () => obs.disconnect();
  }, [week.data, weights.data]);

  const jump = (id) => {
    setActive(id);
    clickLock.current = true;
    document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    setTimeout(() => (clickLock.current = false), 800);
  };

  const days = (week.data?.logs ?? []).map((l) => ({
    key: l.date,
    label: l.date === t ? 'Nay' : weekdayShort(l.date),
    kcal: Math.round(sumLog(l).kcal) || null,
    water: l.waterMl || null,
    minutes: (l.exercises ?? []).reduce((s, e) => s + e.minutes, 0) || null,
  }));
  const avg = (k) => {
    const v = days.filter((d) => d[k]);
    return v.length ? v.reduce((s, d) => s + d[k], 0) / v.length : 0;
  };
  const series = (k) => days.map((d) => ({ key: d.key, label: d.label, value: d[k] }));

  const entries = weights.data?.entries ?? [];
  const wData = entries.map((e) => ({ key: e.date, label: `${dayNum(e.date)}/${e.date.slice(5, 7)}`, value: e.kg }));
  const change = entries.length > 1 ? entries.at(-1).kg - entries[0].kg : 0;
  const goal = GOALS.find((g) => g.id === p.goal)?.label;
  const joined = new Date(user.createdAt).toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric' });

  return (
    <main className="relative min-h-dvh overflow-x-clip bg-gradient-to-b from-background via-surface to-background pb-[calc(var(--nav-h)+var(--safe-b)+24px)]">
      <HeroBackdrop />
      <div className="relative flex flex-col gap-6 px-4 pt-4">
        <header className="flex items-center justify-between">
          <CircleButton icon={ArrowLeft} label="Quay lại" onClick={() => navigate('/')} className="bg-white text-primary shadow-pill" size={48} iconSize={22} />
          <CircleButton icon={Settings} label="Cài đặt" onClick={() => navigate('/me/settings')} className="bg-white text-primary shadow-pill" size={48} iconSize={22} />
        </header>

        <section className="flex items-center gap-4">
          <AvatarPicker user={user} onChange={setUser} />
          <div className="min-w-0">
            <h1 className="truncate text-xl font-extrabold text-primary">{user.name}</h1>
            <p className="flex items-center gap-1 font-secondary text-sm text-secondary">
              <Crown size={16} aria-hidden="true" /> Thành viên từ {joined}
            </p>
          </div>
        </section>

        <nav aria-label="Lối tắt" className="grid grid-cols-2 gap-4">
          <ShortcutTile to="/orders" icon={Package} title="Đơn hàng" sub={orders.data ? `${orders.data.orders.length} đơn hàng` : '…'} />
          <ShortcutTile to="/track" icon={CalendarDays} title="Tổng kết" sub="Theo tuần" />
          <ShortcutTile to="/me/support" icon={MessageSquareHeart} title="Góp ý" sub="Gửi ý kiến của bạn" />
          <ShortcutTile to="/me/edit?step=basic" icon={Flag} title="Mục tiêu" sub={goal} />
        </nav>

        <ChipTabs items={SECTIONS} value={active} onChange={jump} label="Chỉ số của bạn" />

        <MetricCard id="bmi" title="BMI hiện tại">
          <Big value={String(h.bmi).replace('.', ',')} note={h.bmiCategory.label} noteClass={TONE[h.bmiCategory.tone]} />
          <BmiScale bmi={h.bmi} />
          <p className="mt-2 font-secondary text-xs text-muted">
            {p.heightCm} cm • {p.weightKg} kg • Eo / chiều cao {String(h.whtr).replace('.', ',')} ({h.whtrCategory?.label})
          </p>
        </MetricCard>

        <MetricCard
          id="weight"
          title="Cân nặng"
          action={
            <button type="button" onClick={() => setWeightOpen(true)} className="inline-flex min-h-10 items-center gap-1 text-sm font-bold text-teal-dark">
              <Plus size={18} aria-hidden="true" /> Ghi cân nặng
            </button>
          }
        >
          <Big
            value={fmt(p.weightKg, 1)}
            unit="kg"
            note={entries.length > 1 ? `${change > 0 ? '+' : ''}${fmt(change, 1)} kg / 90 ngày` : 'Ghi thêm để xem xu hướng'}
          />
          {weights.loading && !wData.length ? <Skeleton h={144} /> : wData.length > 0 && <LineChart data={wData} unit="kg" caption="Cân nặng 90 ngày gần nhất" />}
        </MetricCard>

        <MetricCard id="intake" title="Calo nạp 7 ngày">
          <Big value={fmt(avg('kcal'))} unit="kcal / ngày (TB)" />
          {week.data ? <BarChart data={series('kcal')} goal={h.targetKcal} unit="kcal" caption="Calo nạp 7 ngày" activeKey={t} fill="bg-teal-soft" fillActive="bg-teal-main" /> : <Skeleton h={168} />}
        </MetricCard>

        <MetricCard id="water" title="Nước uống 7 ngày">
          <Big value={fmt(avg('water'))} unit="ml / ngày (TB)" />
          {week.data ? <BarChart data={series('water')} goal={h.waterMl} unit="ml" caption="Nước uống 7 ngày" activeKey={t} /> : <Skeleton h={168} />}
        </MetricCard>

        <MetricCard
          id="activity"
          title="Vận động 7 ngày"
          action={<Link to="/activities" className="inline-flex min-h-10 items-center gap-1 text-sm font-bold text-teal-dark"><Plus size={18} aria-hidden="true" /> Ghi vận động</Link>}
        >
          <Big value={fmt(avg('minutes'))} unit="phút / ngày (TB)" />
          {week.data ? <BarChart data={series('minutes')} goal={h.exerciseMin} unit="phút" caption="Vận động 7 ngày" activeKey={t} fill="bg-torch-card" fillActive="bg-warm-main" /> : <Skeleton h={168} />}
        </MetricCard>
      </div>

      <WeightSheet open={weightOpen} onClose={() => setWeightOpen(false)} current={p.weightKg} onSaved={setUser} />
    </main>
  );
}
