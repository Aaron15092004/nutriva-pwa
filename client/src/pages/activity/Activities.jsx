import { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { Search, Plus, ChevronRight, Flame, X } from 'lucide-react';
import { useAuth } from '../../context/AuthContext.jsx';
import { useToast } from '../../context/ToastContext.jsx';
import { useApi } from '../../lib/useApi.js';
import { api } from '../../lib/api.js';
import { today, longDate } from '../../lib/format.js';
import { exerciseKcal } from '@shared/nutrition.js';
import { TopBar, Sheet, Button, ErrorNote, Skeleton } from '../../components/ui.jsx';
import { IconCircle, ProgressBar, fmt, cx } from '../../components/ds/index.jsx';
import { groupLetter } from '../../theme/activities.js';

const ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('');
const strip = (s) => s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/đ/g, 'd');

// Thẻ tổng kết hôm nay + danh sách đã ghi
function TodaySummary({ date, log, targetKcal, targetMin, onRemove }) {
  const list = log?.exercises ?? [];
  const burned = list.reduce((s, e) => s + e.kcal, 0);
  const minutes = list.reduce((s, e) => s + e.minutes, 0);
  return (
    <section aria-labelledby="today-burn" className="flex flex-col gap-2">
      <h2 id="today-burn" className="text-xs font-bold uppercase tracking-wider text-muted">
        {date === today() ? 'Hôm nay' : longDate(date)}
      </h2>
      <div className="flex flex-col gap-4 rounded-xl bg-torch-card p-4">
        <div className="flex items-center gap-4">
          <IconCircle icon={Flame} className="bg-warm-main text-white" />
          <div className="min-w-0 flex-1">
            <p className="text-sm text-secondary">Đã đốt cháy</p>
            <p className="flex items-baseline gap-1">
              <b className="font-secondary text-2xl text-primary">{fmt(burned)}</b>
              <span className="font-secondary text-sm text-secondary">/ {fmt(targetKcal)} kcal</span>
            </p>
          </div>
          <span className="font-secondary text-sm font-semibold text-secondary">
            {minutes}/{targetMin} phút
          </span>
        </div>
        <ProgressBar value={burned} max={targetKcal} track="bg-white/70" fill="bg-warm-main" label="Calo đã đốt" />
        {list.length > 0 && (
          <ul className="flex flex-col divide-y divide-white/70 rounded-lg bg-white/60">
            {list.map((e) => (
              <li key={e._id} className="flex items-center gap-2 py-2 pl-4 pr-1">
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-bold text-primary">{e.label}</p>
                  <p className="truncate font-secondary text-xs text-secondary">
                    {e.variant ? `${e.variant} • ` : ''}{e.minutes} phút
                  </p>
                </div>
                <span className="font-secondary text-sm font-semibold text-warm-dark">{fmt(e.kcal)} kcal</span>
                <button type="button" onClick={() => onRemove(e)} aria-label={`Xóa ${e.label}`} className="grid h-10 w-10 place-items-center rounded-full text-secondary hover:bg-white">
                  <X size={16} aria-hidden="true" />
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  );
}

// Hoạt động tự nhập (nút + trên thanh tiêu đề)
function CustomActivitySheet({ open, onClose, date, onLog }) {
  const toast = useToast();
  const [form, setForm] = useState({ name: '', minutes: '30', kcal: '' });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const save = async () => {
    setBusy(true);
    setError('');
    try {
      const d = await api.post(`/logs/${date}/exercises`, { custom: true, name: form.name, minutes: Number(form.minutes), kcal: Number(form.kcal) });
      onLog(d.log);
      toast(`Đã ghi “${form.name}”`);
      setForm({ name: '', minutes: '30', kcal: '' });
      onClose();
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  };
  return (
    <Sheet open={open} onClose={onClose} title="Hoạt động khác">
      <div className="flex flex-col gap-4">
        <p className="text-sm text-muted">Không tìm thấy hoạt động? Nhập thủ công thời gian và calo tiêu thụ (ví dụ từ đồng hồ thông minh).</p>
        <div className="field">
          <label htmlFor="ca-name">Tên hoạt động</label>
          <div className="input-wrap"><input id="ca-name" maxLength={60} value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></div>
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div className="field">
            <label htmlFor="ca-min">Thời gian</label>
            <div className="input-wrap"><input id="ca-min" type="number" inputMode="numeric" min="1" max="600" value={form.minutes} onChange={(e) => setForm({ ...form, minutes: e.target.value })} /><span className="unit">phút</span></div>
          </div>
          <div className="field">
            <label htmlFor="ca-kcal">Calo tiêu thụ</label>
            <div className="input-wrap"><input id="ca-kcal" type="number" inputMode="numeric" min="0" value={form.kcal} onChange={(e) => setForm({ ...form, kcal: e.target.value })} /><span className="unit">kcal</span></div>
          </div>
        </div>
        <ErrorNote error={error} />
        <Button className="btn-primary btn-block" loading={busy} disabled={!form.name.trim() || !form.minutes || form.kcal === ''} onClick={save}>Lưu hoạt động</Button>
      </div>
    </Sheet>
  );
}

export default function Activities() {
  const { user } = useAuth();
  const toast = useToast();
  const [params] = useSearchParams();
  const date = params.get('date') ?? today();
  const [q, setQ] = useState('');
  const [customOpen, setCustomOpen] = useState(false);
  const [activeLetter, setActiveLetter] = useState(null);
  const list = useApi('/activities');
  const day = useApi(`/logs/${date}`);
  const sectionRefs = useRef({});
  const h = user.health;
  const targetKcal = exerciseKcal('walk', h.exerciseMin, user.profile.weightKg);

  const groups = useMemo(() => {
    const k = strip(q.trim());
    const items = (list.data?.activities ?? []).filter((a) => !k || strip(`${a.name} ${a.nameEn}`).includes(k));
    const map = new Map();
    for (const a of items) {
      const L = groupLetter(a.name);
      if (!map.has(L)) map.set(L, []);
      map.get(L).push(a);
    }
    return [...map.entries()];
  }, [list.data, q]);

  const letters = new Set(groups.map(([L]) => L));

  // Chữ cái của nhóm đang ở đầu màn hình → tô sáng trên thanh A–Z
  useEffect(() => {
    const obs = new IntersectionObserver(
      (entries) => {
        const top = entries.filter((e) => e.isIntersecting).sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top)[0];
        if (top) setActiveLetter(top.target.dataset.letter);
      },
      { rootMargin: '-64px 0px -60% 0px' },
    );
    Object.values(sectionRefs.current).forEach((el) => el && obs.observe(el));
    return () => obs.disconnect();
  }, [groups]);

  const jump = (L) => {
    const el = sectionRefs.current[L];
    if (!el) return;
    window.scrollTo({ top: el.getBoundingClientRect().top + window.scrollY - 72, behavior: 'smooth' });
    setActiveLetter(L);
  };

  const remove = async (e) => {
    try {
      day.setData(await api.del(`/logs/${date}/exercises/${e._id}`));
      toast('Đã xóa hoạt động');
    } catch (err) {
      toast(err.message, 'error');
    }
  };

  return (
    <>
      <TopBar
        title="Thêm hoạt động"
        actions={
          <button className="icon-btn" aria-label="Thêm hoạt động khác" onClick={() => setCustomOpen(true)}>
            <Plus size={22} />
          </button>
        }
      />
      <main className="flex flex-col gap-6 px-4 pb-12 pr-10 pt-2">
        <div className="flex h-12 items-center gap-2 rounded-full border border-border bg-white px-4 focus-within:border-brand-main focus-within:ring-2 focus-within:ring-brand-accent/40">
          <Search size={20} className="text-subtle" aria-hidden="true" />
          <input
            type="search"
            aria-label="Tìm kiếm hoạt động"
            placeholder="Tìm kiếm hoạt động"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            className="h-full min-w-0 flex-1 bg-transparent text-base outline-none placeholder:text-subtle"
          />
        </div>

        {day.data ? (
          <TodaySummary date={date} log={day.data.log} targetKcal={targetKcal} targetMin={h.exerciseMin} onRemove={remove} />
        ) : (
          <Skeleton h={160} />
        )}

        <ErrorNote error={list.error} />
        {list.loading && <Skeleton h={400} />}

        {groups.map(([L, items]) => (
          <section key={L} ref={(el) => (sectionRefs.current[L] = el)} data-letter={L} aria-labelledby={`letter-${L}`} className="flex flex-col">
            <h2 id={`letter-${L}`} className="pb-2 text-sm font-bold text-subtle">{L}</h2>
            <ul className="flex flex-col divide-y divide-border">
              {items.map((a) => (
                <li key={a.slug}>
                  <Link to={`/activities/${a.slug}?date=${date}`} className="flex min-h-14 items-center gap-4 py-2 transition-colors hover:bg-white/60">
                    <span className="min-w-0 flex-1 text-base text-primary">
                      {a.name}
                      {a.nameEn && <span className="text-muted"> ({a.nameEn})</span>}
                    </span>
                    <ChevronRight size={20} className="shrink-0 text-subtle" aria-hidden="true" />
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        ))}
        {!list.loading && !groups.length && (
          <div className="flex flex-col items-center gap-2 py-8 text-center text-muted">
            <p>Không tìm thấy “{q}”.</p>
            <button type="button" className="link" onClick={() => setCustomOpen(true)}>Nhập hoạt động khác</button>
          </div>
        )}
      </main>

      {/* Thanh chữ cái A–Z */}
      <nav aria-label="Nhảy tới chữ cái" className="fixed right-0 top-1/2 z-20 flex -translate-y-1/2 flex-col py-2 pr-1" style={{ right: 'max(0px, calc((100vw - 480px) / 2))' }}>
        {ALPHABET.map((L) => (
          <button
            key={L}
            type="button"
            disabled={!letters.has(L)}
            onClick={() => jump(L)}
            aria-label={`Chữ ${L}`}
            className={cx(
              'grid h-5 w-8 place-items-center font-secondary text-xs font-semibold',
              activeLetter === L ? 'text-brand-dark' : letters.has(L) ? 'text-secondary' : 'text-divider',
            )}
          >
            {L}
          </button>
        ))}
      </nav>

      <CustomActivitySheet open={customOpen} onClose={() => setCustomOpen(false)} date={date} onLog={(log) => day.setData({ log })} />
    </>
  );
}
