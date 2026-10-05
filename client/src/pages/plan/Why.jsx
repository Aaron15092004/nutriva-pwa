import { Link, useParams } from 'react-router-dom';
import { Leaf, CalendarCheck, Ban, Target, AlertTriangle, Info, ChevronRight, Sparkles } from 'lucide-react';
import { FLAVORS } from '@shared/nutrition.js';
import { useApi } from '../../lib/useApi.js';
import { num } from '../../lib/format.js';
import { TopBar, Skeleton, ErrorNote } from '../../components/ui.jsx';

const ICONS = { leaf: Leaf, calendar: CalendarCheck, ban: Ban, target: Target };

export default function Why() {
  const { slug } = useParams();
  const { data, error, loading } = useApi(`/products/${slug}/why`);
  const p = data?.product;

  return (
    <>
      <TopBar title="Vì sao gợi ý này?" />
      <main className="page has-cta stack-lg">
        {loading && <Skeleton h={480} />}
        <ErrorNote error={error} />
        {p && (
          <>
            <section className="card" style={{ padding: 0, overflow: 'hidden', background: 'var(--green-50)' }}>
              <div style={{ position: 'relative' }}>
                <img src={p.image} alt={`Sữa hạt NUTRIVA ${p.name}`} style={{ width: '100%', aspectRatio: '16/10', objectFit: 'cover' }} />
                <span className="badge" style={{ position: 'absolute', top: 12, right: 12, background: '#fff' }}>
                  <Sparkles size={14} /> Sản phẩm gợi ý cho bạn
                </span>
              </div>
              <div className="stack" style={{ padding: 16, gap: 6 }}>
                <h2 className="title-lg">Sữa hạt NUTRIVA<br />{p.name}</h2>
                <div className="row" style={{ gap: 6, flexWrap: 'wrap' }}>
                  <span className="badge gray">{p.size}</span>
                  <span className="badge">{FLAVORS.find((f) => f.id === p.flavor)?.label}</span>
                  <span className="badge gray tabular">{num(p.nutrition.kcal)} kcal</span>
                </div>
                <p className="small muted">{p.description}</p>
              </div>
            </section>

            <section className="stack">
              <h2 className="title-md">Vì sao chúng tôi gợi ý sản phẩm này?</h2>
              {data.reasons.map((r) => {
                const I = ICONS[r.icon] ?? Info;
                return (
                  <div key={r.title} className="card row" style={{ alignItems: 'flex-start' }}>
                    <span className={`icon-tile ${r.danger ? 'danger' : ''}`}><I size={22} /></span>
                    <div>
                      <b>{r.title}</b>
                      <p className="small muted">{r.text}</p>
                    </div>
                  </div>
                );
              })}
            </section>

            <div className="notice warn">
              <AlertTriangle size={18} />
              <span><b>Cần xác nhận thành phần và nguy cơ nhiễm chéo.</b> Vui lòng kiểm tra kỹ danh sách thành phần trên bao bì nếu bạn có dị ứng hoặc nhạy cảm với bất kỳ loại hạt nào.</span>
            </div>
            <div className="notice info">
              <Info size={18} />
              <span><b>Không thay thế bữa chính.</b> Sản phẩm này là bữa ăn nhẹ, không thay thế cho bữa ăn chính đa dạng và cân bằng.</span>
            </div>
          </>
        )}
        <div className="sticky-cta">
          <Link to={`/shop/p/${slug}`} className="btn btn-primary" style={{ flex: 1 }}>
            Xem sản phẩm <ChevronRight size={18} />
          </Link>
          <Link to="/shop" className="btn btn-outline" style={{ flex: 1 }}>Đổi lựa chọn</Link>
        </div>
      </main>
    </>
  );
}
