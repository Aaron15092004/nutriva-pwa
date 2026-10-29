import { useEffect, useState } from 'react';
import { Droplets, Milk, Footprints, Utensils, Bell, Clock, Plus, Trash2, Leaf, BellRing, BellOff, Send } from 'lucide-react';
import { pushSupported, currentSubscription, enablePush, disablePush } from '../../lib/push.js';
import { useApi } from '../../lib/useApi.js';
import { api } from '../../lib/api.js';
import { useToast } from '../../context/ToastContext.jsx';
import { TopBar, Switch, Skeleton, ErrorNote, Sheet } from '../../components/ui.jsx';
import { TextField, PrimaryButton } from '../../components/ds/form.jsx';
import { cx } from '../../components/ds/index.jsx';
import { LockedCard } from '../../components/membership/Paywall.jsx';
import { openPaywall } from '../../lib/membership.js';

const KIND_ICON = { water: Droplets, milk: Milk, exercise: Footprints, meal: Utensils, other: Bell };
const KINDS = [['water', 'Uống nước'], ['milk', 'Sữa hạt'], ['exercise', 'Vận động'], ['meal', 'Bữa ăn'], ['other', 'Khác']];
const DAY_LABELS = [
  { d: 1, l: 'T2' }, { d: 2, l: 'T3' }, { d: 3, l: 'T4' }, { d: 4, l: 'T5' }, { d: 5, l: 'T6' }, { d: 6, l: 'T7' }, { d: 0, l: 'CN' },
];
const chip = (on) => cx('inline-flex min-h-10 items-center justify-center gap-1 rounded-full border-2 px-4 text-sm transition', on ? 'border-brand-dark bg-brand-light font-bold text-brand-deep' : 'border-border bg-white font-medium text-secondary');
const card = 'rounded-xl bg-white p-4 shadow-card';

function DayPicker({ days, onToggle, label }) {
  return (
    <div className="grid grid-cols-7 gap-1" role="group" aria-label={label}>
      {DAY_LABELS.map(({ d, l }) => (
        <button key={d} type="button" className={cx(chip(days.includes(d)), '!px-0')} aria-pressed={days.includes(d)} onClick={() => onToggle(d)}>
          {l}
        </button>
      ))}
    </div>
  );
}

function ReminderCard({ r, locked, onChange, onDelete }) {
  const toast = useToast();
  const Icon = KIND_ICON[r.kind] ?? Bell;
  // Cập nhật tạm ngay trên màn hình; lỗi thì trả lại như cũ
  const patch = async (p) => {
    onChange({ ...r, ...p });
    try {
      await api.patch(`/reminders/${r._id}`, p);
    } catch (e) {
      onChange(r);
      toast(e.message, 'error');
    }
  };
  return (
    <article className={cx(card, 'flex flex-col gap-4', (!r.enabled || locked) && 'opacity-60')}>
      <div className="flex items-center gap-4">
        <span className="grid size-11 shrink-0 place-items-center rounded-full bg-brand-light text-brand-dark" aria-hidden="true">
          <Icon size={22} />
        </span>
        <b className="min-w-0 flex-1 truncate text-primary">{r.title}</b>
        <Switch checked={r.enabled} onChange={(enabled) => patch({ enabled })} label={`Bật nhắc ${r.title}`} />
      </div>
      <div className="flex items-center gap-2">
        <label className="flex h-12 flex-1 items-center gap-2 rounded-lg border border-border bg-white px-4 focus-within:border-brand-main focus-within:ring-2 focus-within:ring-brand-soft">
          <Clock size={18} className="text-subtle" aria-hidden="true" />
          <input type="time" aria-label={`Giờ nhắc ${r.title}`} value={r.time} onChange={(e) => e.target.value && patch({ time: e.target.value })} className="h-full min-w-0 flex-1 bg-transparent text-base font-semibold text-primary outline-none" />
        </label>
        <button type="button" className="grid size-11 place-items-center rounded-full hover:bg-error" aria-label={`Xóa nhắc ${r.title}`} onClick={() => onDelete(r)}>
          <Trash2 size={18} className="text-warm-dark" aria-hidden="true" />
        </button>
      </div>
      <div className="flex flex-col gap-2">
        <span className="text-xs text-muted">Lặp lại</span>
        <DayPicker days={r.days} label={`Ngày lặp của ${r.title}`} onToggle={(d) => patch({ days: r.days.includes(d) ? r.days.filter((x) => x !== d) : [...r.days, d] })} />
      </div>
    </article>
  );
}

function Notice({ children }) {
  return (
    <p className="flex items-start gap-2 rounded-lg bg-warning px-4 py-3 text-sm text-snacks-hint">
      <BellOff size={18} className="mt-0.5 shrink-0" aria-hidden="true" /> {children}
    </p>
  );
}

function PushCard() {
  const toast = useToast();
  const [state, setState] = useState('loading'); // loading | unsupported | off | on | denied
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!pushSupported()) return setState('unsupported');
    if (Notification.permission === 'denied') return setState('denied');
    currentSubscription().then((s) => setState(s ? 'on' : 'off'));
  }, []);

  const run = async (fn, ok) => {
    setBusy(true);
    try {
      await fn();
      if (ok) toast(ok);
    } catch (e) {
      toast(e.message, 'error');
    } finally {
      setBusy(false);
    }
  };

  if (state === 'loading') return null;
  if (state === 'unsupported') return <Notice>Trình duyệt chưa hỗ trợ thông báo đẩy. Trên iPhone (iOS 16.4+), hãy cài NUTRIVA vào màn hình chính rồi mở lại.</Notice>;
  if (state === 'denied') return <Notice>Thông báo đang bị chặn. Hãy cho phép thông báo cho trang này trong cài đặt trình duyệt.</Notice>;

  const on = state === 'on';
  return (
    <div className={cx(card, 'flex items-center gap-4')}>
      <span className={cx('grid size-11 shrink-0 place-items-center rounded-full', on ? 'bg-brand-light text-brand-dark' : 'bg-warning text-snacks-hint')} aria-hidden="true">
        {on ? <BellRing size={22} /> : <BellOff size={22} />}
      </span>
      <div className="min-w-0 flex-1">
        <b className="block text-primary">{on ? 'Thông báo đang bật' : 'Thông báo đang tắt'}</b>
        <span className="text-xs text-muted">{on ? 'Thiết bị này sẽ nhận nhắc nhở và cập nhật đơn hàng.' : 'Bật để nhận nhắc nhở đúng giờ trên thiết bị này.'}</span>
      </div>
      {on ? (
        <div className="flex items-center gap-1">
          <button type="button" className="grid size-10 place-items-center rounded-full text-primary hover:bg-brand-light" aria-label="Gửi thông báo thử" disabled={busy} onClick={() => run(() => api.post('/push/test'), 'Đã gửi thông báo thử')}>
            <Send size={18} aria-hidden="true" />
          </button>
          <button type="button" className="h-9 rounded-full bg-brand-light px-4 text-sm font-bold text-brand-deep disabled:opacity-50" disabled={busy} onClick={() => run(async () => { await disablePush(); setState('off'); }, 'Đã tắt thông báo')}>
            Tắt
          </button>
        </div>
      ) : (
        <button type="button" className="h-9 rounded-full bg-brand-dark px-4 text-sm font-bold text-white disabled:opacity-50" disabled={busy} onClick={() => run(async () => { await enablePush(); setState('on'); }, 'Đã bật thông báo')}>
          Bật
        </button>
      )}
    </div>
  );
}

export default function Reminders() {
  const toast = useToast();
  const { data, error, loading, setData } = useApi('/reminders');
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ title: '', time: '08:00', kind: 'other', days: [1, 2, 3, 4, 5] });
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState('');

  const list = data?.reminders ?? [];
  const update = (r) => setData((d) => ({ reminders: (d?.reminders ?? []).map((x) => (x._id === r._id ? r : x)) }));

  const remove = async (r) => {
    if (!window.confirm(`Xóa nhắc “${r.title}”?`)) return;
    try {
      await api.del(`/reminders/${r._id}`);
      setData((d) => ({ reminders: (d?.reminders ?? []).filter((x) => x._id !== r._id) }));
      toast('Đã xóa nhắc nhở');
    } catch (e) {
      toast(e.message, 'error');
    }
  };

  const create = async () => {
    setSaving(true);
    setFormError('');
    try {
      const { reminder } = await api.post('/reminders', form);
      setData({ reminders: [...list, reminder].sort((a, b) => a.time.localeCompare(b.time)) });
      setOpen(false);
      setForm({ title: '', time: '08:00', kind: 'other', days: [1, 2, 3, 4, 5] });
      toast('Đã thêm nhắc nhở');
    } catch (e) {
      setFormError(e.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      <TopBar title="Nhắc nhở" fallback="/track" />
      <main className="flex flex-col gap-4 px-4 pb-[calc(32px+var(--safe-b))] pt-2">
        <p className="text-base text-secondary">Thiết lập lịch nhắc để duy trì thói quen mỗi ngày.</p>
        {data?.locked && <LockedCard compact title="Nhắc nhở đang tạm khóa" text="Quét mã trên chai sữa để nhận nhắc đúng giờ." />}
        <PushCard />
        {loading && <Skeleton h={300} />}
        <ErrorNote error={error} />
        {list.map((r) => (
          <ReminderCard key={r._id} r={r} locked={data?.locked} onChange={update} onDelete={remove} />
        ))}
        <PrimaryButton variant="outline" onClick={() => (data?.locked ? openPaywall('Thêm nhắc nhở cần kích hoạt gói NUTRIVA') : setOpen(true))} className="w-full">
          <Plus size={20} aria-hidden="true" /> Thêm nhắc nhở
        </PrimaryButton>
        <p className="flex items-start gap-2 rounded-lg bg-brand-light px-4 py-3 text-sm text-brand-deep">
          <Leaf size={18} className="mt-0.5 shrink-0" aria-hidden="true" /> Bạn chủ động điều chỉnh mục tiêu và lịch nhắc phù hợp với lối sống của mình.
        </p>
        <p className="text-center text-xs text-muted">Nhắc nhở được gửi từ máy chủ NUTRIVA theo giờ Việt Nam, kể cả khi bạn không mở ứng dụng.</p>
      </main>

      <Sheet open={open} onClose={() => setOpen(false)} title="Thêm nhắc nhở">
        <div className="flex flex-col gap-6">
          <TextField id="rt" label="Tên nhắc nhở" icon={Bell} maxLength={60} placeholder="Ví dụ: Ăn nhẹ buổi chiều" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} />
          <div className="flex flex-wrap gap-2" role="group" aria-label="Loại">
            {KINDS.map(([k, l]) => {
              const I = KIND_ICON[k];
              return (
                <button key={k} type="button" className={chip(form.kind === k)} aria-pressed={form.kind === k} onClick={() => setForm({ ...form, kind: k })}>
                  <I size={16} aria-hidden="true" /> {l}
                </button>
              );
            })}
          </div>
          <TextField id="rtime" label="Giờ nhắc" icon={Clock} type="time" value={form.time} onChange={(e) => setForm({ ...form, time: e.target.value })} />
          <div className="flex flex-col gap-2">
            <span className="text-sm font-bold text-primary">Ngày lặp lại</span>
            <DayPicker days={form.days} label="Ngày lặp lại" onToggle={(d) => setForm({ ...form, days: form.days.includes(d) ? form.days.filter((x) => x !== d) : [...form.days, d] })} />
          </div>
          <ErrorNote error={formError} />
          <PrimaryButton loading={saving} disabled={!form.title.trim() || !form.days.length} onClick={create} className="w-full">
            Lưu nhắc nhở
          </PrimaryButton>
        </div>
      </Sheet>
    </>
  );
}
