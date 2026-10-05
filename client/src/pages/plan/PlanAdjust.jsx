import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { Pencil, Settings, ChevronRight, RotateCcw, Zap, CookingPot, Candy, Ban } from 'lucide-react';
import { useApi } from '../../lib/useApi.js';
import { api } from '../../lib/api.js';
import { num, longDate } from '../../lib/format.js';
import { useToast } from '../../context/ToastContext.jsx';
import { TopBar, Skeleton, ErrorNote, Button } from '../../components/ui.jsx';
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
    <button className="card card-link" role="radio" aria-checked={selected} onClick={onSelect}
      style={{ border: `1.5px solid ${selected ? 'var(--primary)' : 'transparent'}`, background: selected ? 'var(--green-50)' : '#fff' }}>
      <PlanItemThumb item={item} meal={meal} size="sm" />
      <span className="grow stack" style={{ gap: 4 }}>
        <b style={{ fontSize: 15, lineHeight: 1.35 }}>{item.name}</b>
        <span className="row" style={{ gap: 6, flexWrap: 'wrap' }}>
          <span className="badge">{TAG_LABEL[item.tag]}</span>
          <span className="xs muted tabular">{num(item.kcal)} kcal</span>
        </span>
      </span>
      <span aria-hidden="true" style={{ width: 22, height: 22, borderRadius: 999, border: `2px solid ${selected ? 'var(--primary)' : '#c6d2cb'}`, display: 'grid', placeItems: 'center', flex: 'none' }}>
        {selected && <span style={{ width: 12, height: 12, borderRadius: 999, background: 'var(--primary)' }} />}
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

  useEffect(() => {
    if (data) {
      setSelected(data.current.item.id);
      setNote(data.current.note ?? '');
    }
  }, [data]);

  const save = async () => {
    setSaving(true);
    setSaveError('');
    try {
      const fullNote = [tags.join(', '), note.trim()].filter(Boolean).join(' — ');
      await api.put('/plan/choice', { date, meal, itemId: selected, note: fullNote });
      toast('Đã lưu thay đổi kế hoạch');
      navigate(`/plan?view=day&date=${date}`, { replace: true });
    } catch (e) {
      setSaveError(e.message);
    } finally {
      setSaving(false);
    }
  };

  const reset = async () => {
    await api.del(`/plan/choice?date=${date}&meal=${meal}`);
    toast('Đã khôi phục món gợi ý mặc định');
    navigate(`/plan?view=day&date=${date}`, { replace: true });
  };

  const s = MEAL_STYLE[meal] ?? MEAL_STYLE.snack;

  return (
    <>
      <TopBar title="Điều chỉnh kế hoạch" />
      <main className="page has-cta stack-lg">
        {loading && <Skeleton h={400} />}
        <ErrorNote error={error} />
        {data && (
          <>
            <div className="row">
              <span className="icon-tile lg" style={{ background: s.bg, color: s.fg }}><s.icon size={26} /></span>
              <div>
                <h2 className="title-md">{data.current.label}</h2>
                <p className="small muted">{longDate(date)} • Chọn món khác phù hợp hơn với bạn hôm nay.</p>
              </div>
            </div>

            <div className="stack" role="radiogroup" aria-label="Lựa chọn món">
              {[data.current.item, ...data.options].map((it) => (
                <Option key={it.id} item={it} meal={meal} selected={selected === it.id} onSelect={() => setSelected(it.id)} />
              ))}
            </div>

            <div className="field">
              <label htmlFor="note">Bạn có thể cho chúng tôi biết thêm không? <span className="muted" style={{ fontWeight: 400 }}>(tùy chọn)</span></label>
              <div style={{ position: 'relative' }}>
                <textarea id="note" className="textarea" maxLength={150} style={{ paddingLeft: 40 }}
                  placeholder="Ví dụ: không ăn chuối, muốn ít ngọt hơn, hoặc có nguyên liệu sẵn tại nhà…"
                  value={note} onChange={(e) => setNote(e.target.value)} />
                <Pencil size={18} style={{ position: 'absolute', left: 14, top: 14, color: 'var(--subtle)' }} />
              </div>
              <div className="chips">
                {QUICK_NOTES.map((q) => (
                  <button key={q.id} className="chip" aria-pressed={tags.includes(q.id)}
                    onClick={() => setTags((t) => (t.includes(q.id) ? t.filter((x) => x !== q.id) : [...t, q.id]))}>
                    <q.icon size={16} /> {q.id}
                  </button>
                ))}
              </div>
            </div>

            {data.current.custom && (
              <button className="btn btn-ghost" onClick={reset}><RotateCcw size={18} /> Khôi phục món gợi ý</button>
            )}

            <Link to="/me/edit" className="card card-link">
              <span className="icon-tile"><Settings size={22} /></span>
              <span className="grow">
                <b style={{ display: 'block' }}>Cập nhật hồ sơ</b>
                <span className="small muted">Thay đổi sở thích, thực phẩm cần tránh hoặc mục tiêu để nhận gợi ý phù hợp hơn.</span>
              </span>
              <ChevronRight size={20} className="chev" />
            </Link>
            <ErrorNote error={saveError} />
          </>
        )}
        <div className="sticky-cta">
          <Button className="btn-primary btn-block" loading={saving} disabled={!selected} onClick={save}>
            Lưu thay đổi <ChevronRight size={20} />
          </Button>
        </div>
      </main>
    </>
  );
}
