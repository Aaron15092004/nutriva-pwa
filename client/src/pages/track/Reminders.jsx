import { useEffect, useState } from 'react';
import { Droplets, Milk, Footprints, Utensils, Bell, Clock, Plus, Trash2, Leaf, BellRing, BellOff, Send } from 'lucide-react';
import { pushSupported, currentSubscription, enablePush, disablePush } from '../../lib/push.js';
import { useApi } from '../../lib/useApi.js';
import { api } from '../../lib/api.js';
import { useToast } from '../../context/ToastContext.jsx';
import { TopBar, Switch, Skeleton, ErrorNote, Sheet, Button } from '../../components/ui.jsx';

const KIND_ICON = { water: Droplets, milk: Milk, exercise: Footprints, meal: Utensils, other: Bell };
const DAY_LABELS = [
  { d: 1, l: 'T2' }, { d: 2, l: 'T3' }, { d: 3, l: 'T4' }, { d: 4, l: 'T5' }, { d: 5, l: 'T6' }, { d: 6, l: 'T7' }, { d: 0, l: 'CN' },
];

function DayPicker({ days, onToggle, label }) {
  return (
    <div className="grid-4" style={{ gridTemplateColumns: 'repeat(7, 1fr)', gap: 4 }} role="group" aria-label={label}>
      {DAY_LABELS.map(({ d, l }) => (
        <button key={d} className="chip" aria-pressed={days.includes(d)} style={{ justifyContent: 'center', padding: 0, minHeight: 36, fontSize: 13 }} onClick={() => onToggle(d)}>
          {l}
        </button>
      ))}
    </div>
  );
}

function ReminderCard({ r, onChange, onDelete }) {
  const Icon = KIND_ICON[r.kind] ?? Bell;
  const patch = async (p) => {
    onChange({ ...r, ...p });
    await api.patch(`/reminders/${r._id}`, p);
  };
  return (
    <article className="card stack" style={{ gap: 10, opacity: r.enabled ? 1 : 0.75 }}>
      <div className="row">
        <span className="icon-tile"><Icon size={22} /></span>
        <b className="grow">{r.title}</b>
        <Switch checked={r.enabled} onChange={(enabled) => patch({ enabled })} label={`Bật nhắc ${r.title}`} />
      </div>
      <div className="row" style={{ gap: 8 }}>
        <div className="input-wrap grow" style={{ minHeight: 44 }}>
          <Clock size={18} />
          <input type="time" aria-label={`Giờ nhắc ${r.title}`} value={r.time} onChange={(e) => e.target.value && patch({ time: e.target.value })} style={{ height: 40 }} />
        </div>
        <button className="icon-btn" aria-label={`Xóa nhắc ${r.title}`} onClick={() => onDelete(r)}><Trash2 size={18} color="var(--danger)" /></button>
      </div>
      <div className="xs muted">Lặp lại</div>
      <DayPicker days={r.days} label={`Ngày lặp của ${r.title}`} onToggle={(d) => patch({ days: r.days.includes(d) ? r.days.filter((x) => x !== d) : [...r.days, d] })} />
    </article>
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
  if (state === 'unsupported')
    return <div className="notice warn"><BellOff size={18} /> Trình duyệt chưa hỗ trợ thông báo đẩy. Trên iPhone (iOS 16.4+), hãy cài NUTRIVA vào màn hình chính rồi mở lại.</div>;
  if (state === 'denied') return <div className="notice warn"><BellOff size={18} /> Thông báo đang bị chặn. Hãy cho phép thông báo cho trang này trong cài đặt trình duyệt.</div>;

  return (
    <div className="card row">
      <span className={`icon-tile ${state === 'on' ? '' : 'warn'}`}>{state === 'on' ? <BellRing size={22} /> : <BellOff size={22} />}</span>
      <div className="grow">
        <b>{state === 'on' ? 'Thông báo đang bật' : 'Thông báo đang tắt'}</b>
        <div className="xs muted">{state === 'on' ? 'Thiết bị này sẽ nhận nhắc nhở và cập nhật đơn hàng.' : 'Bật để nhận nhắc nhở đúng giờ trên thiết bị này.'}</div>
      </div>
      {state === 'on' ? (
        <div className="row" style={{ gap: 4 }}>
          <button className="icon-btn" aria-label="Gửi thông báo thử" disabled={busy} onClick={() => run(() => api.post('/push/test'), 'Đã gửi thông báo thử')}><Send size={18} /></button>
          <button className="btn btn-soft btn-xs" disabled={busy} onClick={() => run(async () => { await disablePush(); setState('off'); }, 'Đã tắt thông báo')}>Tắt</button>
        </div>
      ) : (
        <button className="btn btn-primary btn-xs" disabled={busy} onClick={() => run(async () => { await enablePush(); setState('on'); }, 'Đã bật thông báo')}>Bật</button>
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
  const update = (r) => setData({ reminders: list.map((x) => (x._id === r._id ? r : x)) });

  const remove = async (r) => {
    await api.del(`/reminders/${r._id}`);
    setData({ reminders: list.filter((x) => x._id !== r._id) });
    toast('Đã xóa nhắc nhở');
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
      <TopBar title="Nhắc nhở" />
      <main className="page no-nav stack">
        <p className="muted">Thiết lập lịch nhắc để duy trì thói quen mỗi ngày.</p>
        <PushCard />
        {loading && <Skeleton h={300} />}
        <ErrorNote error={error} />
        {list.map((r) => <ReminderCard key={r._id} r={r} onChange={update} onDelete={remove} />)}
        <button className="btn btn-outline btn-block" onClick={() => setOpen(true)}><Plus size={20} /> Thêm nhắc nhở</button>
        <div className="notice info"><Leaf size={18} /> Bạn chủ động điều chỉnh mục tiêu và lịch nhắc phù hợp với lối sống của mình.</div>
        <p className="xs muted center">Nhắc nhở được gửi từ máy chủ NUTRIVA theo giờ Việt Nam, kể cả khi bạn không mở ứng dụng.</p>
      </main>

      <Sheet open={open} onClose={() => setOpen(false)} title="Thêm nhắc nhở">
        <div className="stack-lg">
          <div className="field">
            <label htmlFor="rt">Tên nhắc nhở</label>
            <div className="input-wrap"><Bell size={20} /><input id="rt" maxLength={60} placeholder="Ví dụ: Ăn nhẹ buổi chiều" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} /></div>
          </div>
          <div className="chips" role="group" aria-label="Loại">
            {[['water', 'Uống nước'], ['milk', 'Sữa hạt'], ['exercise', 'Vận động'], ['meal', 'Bữa ăn'], ['other', 'Khác']].map(([k, l]) => {
              const I = KIND_ICON[k];
              return <button key={k} className="chip" aria-pressed={form.kind === k} onClick={() => setForm({ ...form, kind: k })}><I size={16} /> {l}</button>;
            })}
          </div>
          <div className="field">
            <label htmlFor="rtime">Giờ nhắc</label>
            <div className="input-wrap"><Clock size={20} /><input id="rtime" type="time" value={form.time} onChange={(e) => setForm({ ...form, time: e.target.value })} /></div>
          </div>
          <DayPicker days={form.days} label="Ngày lặp lại" onToggle={(d) => setForm({ ...form, days: form.days.includes(d) ? form.days.filter((x) => x !== d) : [...form.days, d] })} />
          <ErrorNote error={formError} />
          <Button className="btn-primary btn-block" loading={saving} disabled={!form.title.trim()} onClick={create}>Lưu nhắc nhở</Button>
        </div>
      </Sheet>
    </>
  );
}
