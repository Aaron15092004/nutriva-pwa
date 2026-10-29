import { useState } from 'react';
import { useParams } from 'react-router-dom';
import { ListOrdered, Bookmark, BookmarkCheck, Blend, Droplets, Flame, Refrigerator, CheckCircle2, AlertCircle } from 'lucide-react';
import { ingredientName } from '@shared/nutrition.js';
import { useApi } from '../../lib/useApi.js';
import { money } from '../../lib/format.js';
import { useToast } from '../../context/ToastContext.jsx';
import { TopBar, Skeleton, ErrorNote, Segmented } from '../../components/ui.jsx';
import { PrimaryButton, BottomBar } from '../../components/ds/form.jsx';
import { cx } from '../../components/ds/index.jsx';
import ProductImage from '../../components/ProductImage.jsx';

// Icon minh họa 4 bước mặc định; admin thêm bước thứ 5+ thì dùng icon chung (trước đây bị lỗi trắng trang)
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
      /* bộ nhớ bị chặn */
    }
    setSaved(!saved);
    toast(saved ? 'Đã bỏ lưu hướng dẫn' : 'Đã lưu hướng dẫn trên thiết bị này');
  };

  const ingredients = p ? [...p.ingredients.map(ingredientName), ...(p.extraIngredients ?? [])].map((n) => `${n} (đã chia phần)`).concat('1 lít nước lọc (tự chuẩn bị)', 'Đường phèn hoặc mật ong (tùy chọn, nếu muốn ngọt)') : [];

  return (
    <>
      <TopBar title="Hướng dẫn tự làm" fallback="/shop" />
      <main className="flex flex-col gap-6 px-4 pb-[calc(112px+var(--safe-b))] pt-2">
        {loading && <Skeleton h={480} />}
        <ErrorNote error={error} />
        {p && (
          <>
            <div className="flex items-center gap-4 rounded-xl bg-white p-4 shadow-card">
              <ProductImage product={p} className="w-20 shrink-0 rounded-lg" />
              <div>
                <b className="block text-primary">{p.name}</b>
                <span className="text-sm text-muted">Gói hạt tự nấu • 100 g</span>
                <b className="block font-secondary tabular-nums text-brand-dark">{money(p.price)}</b>
              </div>
            </div>

            <Segmented
              label="Nội dung hướng dẫn"
              value={tab}
              onChange={setTab}
              options={[
                { id: 'ing', label: 'Nguyên liệu' },
                { id: 'steps', label: `Các bước${data.steps?.length ? ` (${done.length}/${data.steps.length})` : ''}` },
              ]}
            />

            {tab === 'ing' ? (
              <ul className="flex flex-col gap-2 rounded-xl bg-white p-4 shadow-card">
                {ingredients.map((n) => (
                  <li key={n} className="flex items-start gap-2 text-base text-primary">
                    <CheckCircle2 size={18} className="mt-0.5 shrink-0 text-brand-main" aria-hidden="true" /> {n}
                  </li>
                ))}
              </ul>
            ) : (
              <ol className="flex flex-col gap-2">
                {data.steps.map((s, i) => {
                  const I = STEP_ICONS[i] ?? ListOrdered;
                  const checked = done.includes(i);
                  return (
                    <li key={`${i}-${s.title}`} className={cx('flex items-start gap-4 rounded-xl bg-white p-4 shadow-card transition', checked && 'opacity-70')}>
                      <span className="relative grid size-14 shrink-0 place-items-center rounded-lg bg-brand-light text-brand-dark" aria-hidden="true">
                        <I size={26} />
                        <span className="absolute -left-2 -top-2 grid size-6 place-items-center rounded-full bg-brand-dark font-secondary text-xs font-bold text-white">{i + 1}</span>
                      </span>
                      <div className="min-w-0 flex-1">
                        <b className={cx('text-primary', checked && 'line-through')}>{s.title}</b>
                        <p className="text-sm text-muted">{s.text}</p>
                      </div>
                      <button
                        type="button"
                        className="grid size-11 shrink-0 place-items-center rounded-full hover:bg-brand-light"
                        aria-label={checked ? `Bỏ đánh dấu bước ${i + 1}` : `Đánh dấu xong bước ${i + 1}`}
                        aria-pressed={checked}
                        onClick={() => setDone((d) => (checked ? d.filter((x) => x !== i) : [...d, i]))}
                      >
                        <CheckCircle2 size={24} className={checked ? 'text-brand-dark' : 'text-divider'} aria-hidden="true" />
                      </button>
                    </li>
                  );
                })}
              </ol>
            )}
            <p className="flex items-start gap-2 rounded-lg bg-warning px-4 py-3 text-sm text-snacks-hint">
              <AlertCircle size={18} className="mt-0.5 shrink-0" aria-hidden="true" />
              <span>Định lượng, thời gian chế biến và hạn dùng mang tính tham khảo. Bảo quản lạnh và dùng sớm để giữ chất lượng.</span>
            </p>
          </>
        )}
        <BottomBar>
          <PrimaryButton onClick={toggleSave} disabled={!p} variant={saved ? 'outline' : 'primary'} className="w-full">
            {saved ? <BookmarkCheck size={18} aria-hidden="true" /> : <Bookmark size={18} aria-hidden="true" />} {saved ? 'Đã lưu hướng dẫn' : 'Lưu hướng dẫn'}
          </PrimaryButton>
        </BottomBar>
      </main>
    </>
  );
}
