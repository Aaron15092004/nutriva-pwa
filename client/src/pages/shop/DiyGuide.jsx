import { useState } from 'react';
import { useParams } from 'react-router-dom';
import { FileText, ListOrdered, Bookmark, BookmarkCheck, Blend, Droplets, Flame, Refrigerator, CheckCircle2, AlertCircle } from 'lucide-react';
import { ingredientName } from '@shared/nutrition.js';
import { useApi } from '../../lib/useApi.js';
import { money } from '../../lib/format.js';
import { useToast } from '../../context/ToastContext.jsx';
import { TopBar, Skeleton, ErrorNote } from '../../components/ui.jsx';
import ProductImage from '../../components/ProductImage.jsx';

const STEP_ICONS = [Blend, Droplets, Flame, Refrigerator];
const SAVED_KEY = 'nutriva_saved_guides';

const readSaved = () => {
  try {
    return JSON.parse(localStorage.getItem(SAVED_KEY)) ?? [];
  } catch {
    return [];
  }
};

export default function DiyGuide() {
  const { slug } = useParams();
  const toast = useToast();
  const { data, error, loading } = useApi(`/products/${slug}`);
  const [tab, setTab] = useState('steps');
  const [saved, setSaved] = useState(() => readSaved().includes(slug));
  const [done, setDone] = useState([]);
  const p = data?.product;

  const toggleSave = () => {
    const list = readSaved().filter((s) => s !== slug);
    if (!saved) list.push(slug);
    try {
      localStorage.setItem(SAVED_KEY, JSON.stringify(list));
    } catch {
      /* ignore */
    }
    setSaved(!saved);
    toast(saved ? 'Đã bỏ lưu hướng dẫn' : 'Đã lưu hướng dẫn trên thiết bị này');
  };

  return (
    <>
      <TopBar title="Hướng dẫn tự làm" />
      <main className="page has-cta stack-lg">
        {loading && <Skeleton h={480} />}
        <ErrorNote error={error} />
        {p && (
          <>
            <div className="card row">
              <ProductImage product={p} style={{ width: 84, borderRadius: 14, flex: 'none' }} />
              <div>
                <b>{p.name}</b>
                <div className="small muted">Set tự làm tại nhà</div>
                <b className="green tabular">{money(p.price)}</b>
              </div>
            </div>

            <div className="tabs-line" role="tablist">
              <button role="tab" aria-selected={tab === 'ing'} onClick={() => setTab('ing')}><FileText size={18} /> Nguyên liệu</button>
              <button role="tab" aria-selected={tab === 'steps'} onClick={() => setTab('steps')}><ListOrdered size={18} /> Các bước</button>
            </div>

            {tab === 'ing' ? (
              <div className="card stack">
                {[...p.ingredients.map(ingredientName), ...p.extraIngredients].map((n) => (
                  <span key={n} className="row" style={{ gap: 8 }}><CheckCircle2 size={18} color="var(--primary-600)" /> {n} (đã chia phần)</span>
                ))}
                <span className="row" style={{ gap: 8 }}><CheckCircle2 size={18} color="var(--primary-600)" /> 1 lít nước lọc (tự chuẩn bị)</span>
                <span className="row" style={{ gap: 8 }}><CheckCircle2 size={18} color="var(--primary-600)" /> Đường phèn hoặc mật ong (tùy chọn, nếu muốn ngọt)</span>
              </div>
            ) : (
              <ol className="stack" style={{ listStyle: 'none', margin: 0, padding: 0 }}>
                {data.steps.map((s, i) => {
                  const I = STEP_ICONS[i];
                  const checked = done.includes(i);
                  return (
                    <li key={s.title} className="card row" style={{ alignItems: 'flex-start', opacity: checked ? 0.7 : 1 }}>
                      <span className="icon-tile lg" style={{ position: 'relative' }}>
                        <I size={26} />
                        <span style={{ position: 'absolute', top: -6, left: -6, width: 24, height: 24, borderRadius: 99, background: 'var(--primary)', color: '#fff', fontSize: 13, fontWeight: 700, display: 'grid', placeItems: 'center' }}>{i + 1}</span>
                      </span>
                      <div className="grow">
                        <b>{s.title}</b>
                        <p className="small muted">{s.text}</p>
                      </div>
                      <button className="icon-btn" aria-label={checked ? `Bỏ đánh dấu bước ${i + 1}` : `Đánh dấu xong bước ${i + 1}`} aria-pressed={checked}
                        onClick={() => setDone((d) => (checked ? d.filter((x) => x !== i) : [...d, i]))}>
                        <CheckCircle2 size={22} color={checked ? 'var(--primary)' : '#c6d2cb'} />
                      </button>
                    </li>
                  );
                })}
              </ol>
            )}
            <div className="notice warn">
              <AlertCircle size={18} />
              <span>Định lượng, thời gian chế biến và hạn dùng mang tính tham khảo. Bảo quản lạnh và dùng sớm để giữ chất lượng.</span>
            </div>
          </>
        )}
        <div className="sticky-cta">
          <button className="btn btn-primary btn-block" onClick={toggleSave} disabled={!p}>
            {saved ? <BookmarkCheck size={18} /> : <Bookmark size={18} />} {saved ? 'Đã lưu hướng dẫn' : 'Lưu hướng dẫn'}
          </button>
        </div>
      </main>
    </>
  );
}
