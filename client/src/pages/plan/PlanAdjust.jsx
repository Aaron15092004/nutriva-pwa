import { useEffect, useRef, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { Pencil, Settings, ChevronRight, RotateCcw, Zap, CookingPot, Candy, Ban } from 'lucide-react';
import { useApi } from '../../lib/useApi.js';
import { api } from '../../lib/api.js';
import { num, longDate } from '../../lib/format.js';
import { useToast } from '../../context/ToastContext.jsx';
import { TopBar, Skeleton, ErrorNote } from '../../components/ui.jsx';
import { PrimaryButton, BottomBar } from '../../components/ds/form.jsx';
import { cx } from '../../components/ds/index.jsx';
import PlanItemThumb, { TAG_LABEL } from '../../components/PlanItemThumb.jsx';
import { MEAL_STYLE } from '../../components/meals.js';

const QUICK_NOTES = [
  { id: 'Nhanh gọn', icon: Zap },
  { id: 'Tự nấu', icon: CookingPot },
  { id: 'Ít ngọt', icon: Candy },
  { id: 'Không thích món này', icon: Ban },
];

function Option({ item, meal, selected, onSelect }) {
  return (
    <button
      type="button"
      role="radio"
      aria-checked={selected}
      onClick={onSelect}
      className={cx('flex items-center gap-4 rounded-xl border-2 p-4 text-left shadow-card transition active:scale-[0.99]', selected ? 'border-brand-dark bg-brand-light' : 'border-transparent bg-white')}
    >
      <PlanItemThumb item={item} meal={meal} size="sm" />
      <span className="flex min-w-0 flex-1 flex-col gap-1">
        <b className="text-base leading-snug text-primary">{item.name}</b>
        <span className="flex flex-wrap items-center gap-2">
          <span className="rounded-full bg-white px-2 py-0.5 text-xs font-semibold text-brand-deep">{TAG_LABEL[item.tag]}</span>
          <span className="font-secondary text-xs tabular-nums text-muted">{num(item.kcal)} kcal</span>
        </span>
      </span>
      <span aria-hidden="true" className={cx('grid size-6 shrink-0 place-items-center rounded-full border-2', selected ? 'border-brand-dark' : 'border-divider')}>
        {selected && <span className="size-3 rounded-full bg-brand-dark" />}
      </span>
    </button>
  );
}

export default function PlanAdjust() {
  const { date, meal } = useParams();
  const navigate = useNavigate();
  const toast = useToast();
  const { data, error, loading } = useApi(`/plan/alternatives?date=${date}&meal=${meal}`);
  const [selected, setSelected] = useState(null);
  const [note, setNote] = useState('');
  const [tags, setTags] = useState([]);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState('');
  const initialized = useRef(false);

  // Chỉ lấy giá trị ban đầu 1 lần — dữ liệu tải lại ở nền không được xóa lựa chọn người dùng đang chọn dở
  useEffect(() => {
    if (data && !initialized.current) {
      initialized.current = true;
      setSelected(data.current.item.id);
      setNote(data.current.note ?? '');
    }
  }, [data]);

  const back = () => navigate(`/plan?view=day&date=${date}`, { replace: true });

  const save = async () => {
    setSaving(true);
    setSaveError('');
    try {
      const fullNote = [tags.join(', '), note.trim()].filter(Boolean).join(' — ');
      await api.put('/plan/choice', { date, meal, itemId: selected, note: fullNote });
      toast('Đã lưu thay đổi kế hoạch');
      back();
    } catch (e) {
      setSaveError(e.message);
    } finally {
      setSaving(false);
    }
  };

  const reset = async () => {
    try {
      await api.del(`/plan/choice?date=${date}&meal=${meal}`);
      toast('Đã khôi phục món gợi ý mặc định');
      back();
    } catch (e) {
      setSaveError(e.message);
    }
  };

  const s = MEAL_STYLE[meal] ?? MEAL_STYLE.snack;
  const chip = (on) => cx('inline-flex min-h-10 items-center gap-1 rounded-full border-2 px-4 text-sm transition', on ? 'border-brand-dark bg-brand-light font-bold text-brand-deep' : 'border-border bg-white font-medium text-secondary');

  return (
    <>
      <TopBar title="Điều chỉnh kế hoạch" fallback="/plan" />
      <main className="flex flex-col gap-6 px-4 pb-[calc(112px+var(--safe-b))] pt-2">
        {loading && <Skeleton h={400} />}
        <ErrorNote error={error} />
        {data && (
          <>
            <div className="flex items-center gap-4">
              <span className="grid size-14 shrink-0 place-items-center rounded-lg" style={{ background: s.bg, color: s.fg }} aria-hidden="true">
                <s.icon size={26} />
              </span>
              <div>
                <h2 className="text-lg font-bold text-primary">{data.current.label}</h2>
                <p className="text-sm text-muted">{longDate(date)} • Chọn món khác phù hợp hơn với bạn hôm nay.</p>
              </div>
            </div>

            <div className="flex flex-col gap-2" role="radiogroup" aria-label="Lựa chọn món">
              {[data.current.item, ...data.options].map((it) => (
                <Option key={it.id} item={it} meal={meal} selected={selected === it.id} onSelect={() => setSelected(it.id)} />
              ))}
            </div>

            <div className="flex flex-col gap-2">
              <label htmlFor="note" className="text-sm font-bold text-primary">
                Bạn có thể cho chúng tôi biết thêm không? <span className="font-normal text-muted">(tùy chọn)</span>
              </label>
              <div className="relative">
                <textarea
                  id="note"
                  maxLength={150}
                  placeholder="Ví dụ: không ăn chuối, muốn ít ngọt hơn, hoặc có nguyên liệu sẵn tại nhà…"
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  className="min-h-24 w-full resize-y rounded-lg border border-border bg-white py-3 pl-10 pr-4 text-base text-primary outline-none focus:border-brand-main focus:ring-2 focus:ring-brand-soft"
                />
                <Pencil size={18} className="absolute left-4 top-4 text-subtle" aria-hidden="true" />
              </div>
              <div className="flex flex-wrap gap-2">
                {QUICK_NOTES.map((q) => (
                  <button key={q.id} type="button" className={chip(tags.includes(q.id))} aria-pressed={tags.includes(q.id)} onClick={() => setTags((t) => (t.includes(q.id) ? t.filter((x) => x !== q.id) : [...t, q.id]))}>
                    <q.icon size={16} aria-hidden="true" /> {q.id}
                  </button>
                ))}
              </div>
            </div>

            {data.current.custom && (
              <button type="button" className="inline-flex min-h-11 items-center gap-2 self-start font-bold text-brand-dark" onClick={reset}>
                <RotateCcw size={18} aria-hidden="true" /> Khôi phục món gợi ý
              </button>
            )}

            <Link to="/me/edit" className="flex items-center gap-4 rounded-xl bg-white p-4 shadow-card transition active:scale-[0.99]">
              <span className="grid size-11 shrink-0 place-items-center rounded-full bg-brand-light text-brand-dark" aria-hidden="true">
                <Settings size={22} />
              </span>
              <span className="min-w-0 flex-1">
                <b className="block text-primary">Cập nhật hồ sơ</b>
                <span className="text-sm text-muted">Thay đổi sở thích, thực phẩm cần tránh hoặc mục tiêu để nhận gợi ý phù hợp hơn.</span>
              </span>
              <ChevronRight size={20} className="shrink-0 text-divider" aria-hidden="true" />
            </Link>
            <ErrorNote error={saveError} />
          </>
        )}
        <BottomBar>
          <PrimaryButton loading={saving} disabled={!selected} onClick={save} className="w-full">
            Lưu thay đổi <ChevronRight size={20} aria-hidden="true" />
          </PrimaryButton>
        </BottomBar>
      </main>
    </>
  );
}
