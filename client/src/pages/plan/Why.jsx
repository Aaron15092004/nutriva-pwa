import { Link, useParams } from 'react-router-dom';
import { Leaf, CalendarCheck, Ban, Target, AlertTriangle, Info, ChevronRight, Sparkles } from 'lucide-react';
import { FLAVORS } from '@shared/nutrition.js';
import { useApi } from '../../lib/useApi.js';
import { num } from '../../lib/format.js';
import { TopBar, Skeleton, ErrorNote } from '../../components/ui.jsx';
import { BottomBar } from '../../components/ds/form.jsx';
import { cx } from '../../components/ds/index.jsx';

const ICONS = { leaf: Leaf, calendar: CalendarCheck, ban: Ban, target: Target };
const pill = 'rounded-full px-2 py-1 text-xs font-semibold';

export default function Why() {
  const { slug } = useParams();
  const { data, error, loading } = useApi(`/products/${slug}/why`);
  const p = data?.product;

  return (
    <>
      <TopBar title="Vì sao gợi ý này?" fallback="/shop" />
      <main className="flex flex-col gap-6 px-4 pb-[calc(112px+var(--safe-b))] pt-2">
        {loading && <Skeleton h={480} />}
        <ErrorNote error={error} />
        {p && (
          <>
            <section className="overflow-hidden rounded-xl bg-brand-light shadow-card">
              <div className="relative">
                <img src={p.image} alt={`Sữa hạt NUTRIVA ${p.name}`} className="aspect-[16/10] w-full object-cover" />
                <span className={cx(pill, 'absolute right-4 top-4 inline-flex items-center gap-1 bg-white text-brand-deep')}>
                  <Sparkles size={14} aria-hidden="true" /> Sản phẩm gợi ý cho bạn
                </span>
              </div>
              <div className="flex flex-col gap-2 p-4">
                <h2 className="font-display text-2xl font-bold text-brand-core [font-variation-settings:'SOFT'_100]">
                  Sữa hạt NUTRIVA
                  <br />
                  {p.name}
                </h2>
                <div className="flex flex-wrap gap-2">
                  <span className={cx(pill, 'bg-white text-muted')}>{p.size}</span>
                  <span className={cx(pill, 'bg-brand-soft text-brand-deep')}>{FLAVORS.find((f) => f.id === p.flavor)?.label}</span>
                  <span className={cx(pill, 'bg-white font-secondary tabular-nums text-muted')}>{num(p.nutrition.kcal)} kcal</span>
                </div>
                <p className="text-sm text-secondary">{p.description}</p>
              </div>
            </section>

            <section className="flex flex-col gap-2">
              <h2 className="text-lg font-bold text-primary">Vì sao chúng tôi gợi ý sản phẩm này?</h2>
              {data.reasons.map((r) => {
                const I = ICONS[r.icon] ?? Info;
                return (
                  <div key={r.title} className="flex items-start gap-4 rounded-xl bg-white p-4 shadow-card">
                    <span className={cx('grid size-11 shrink-0 place-items-center rounded-full', r.danger ? 'bg-error text-warm-dark' : 'bg-brand-light text-brand-dark')} aria-hidden="true">
                      <I size={22} />
                    </span>
                    <div>
                      <b className="text-primary">{r.title}</b>
                      <p className="text-sm text-muted">{r.text}</p>
                    </div>
                  </div>
                );
              })}
            </section>

            <p className="flex items-start gap-2 rounded-lg bg-warning px-4 py-3 text-sm text-snacks-hint">
              <AlertTriangle size={18} className="mt-0.5 shrink-0" aria-hidden="true" />
              <span>
                <b>Cần xác nhận thành phần và nguy cơ nhiễm chéo.</b> Vui lòng kiểm tra kỹ danh sách thành phần trên bao bì nếu bạn có dị ứng hoặc nhạy cảm với bất kỳ loại hạt nào.
              </span>
            </p>
            <p className="flex items-start gap-2 rounded-lg border border-border bg-brand-light px-4 py-3 text-sm text-brand-deep">
              <Info size={18} className="mt-0.5 shrink-0" aria-hidden="true" />
              <span>
                <b>Không thay thế bữa chính.</b> Sản phẩm này là bữa ăn nhẹ, không thay thế cho bữa ăn chính đa dạng và cân bằng.
              </span>
            </p>
          </>
        )}
        <BottomBar>
          <Link to={`/shop/p/${slug}`} className="inline-flex h-14 flex-1 items-center justify-center gap-1 rounded-full bg-brand-dark font-bold text-white">
            Xem sản phẩm <ChevronRight size={18} aria-hidden="true" />
          </Link>
          <Link to="/shop" className="inline-flex h-14 flex-1 items-center justify-center rounded-full border-2 border-brand-dark bg-white font-bold text-brand-dark">
            Đổi lựa chọn
          </Link>
        </BottomBar>
      </main>
    </>
  );
}
