import { useEffect, useState } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { ChevronRight, Check } from 'lucide-react';
import { useAuth } from '../../context/AuthContext.jsx';
import { useToast } from '../../context/ToastContext.jsx';
import { useApi } from '../../lib/useApi.js';
import { api } from '../../lib/api.js';
import { today } from '../../lib/format.js';
import { TopBar, Sheet, Skeleton, ErrorNote } from '../../components/ui.jsx';
import { fmt, cx } from '../../components/ds/index.jsx';
import ActivityThumb from '../../components/activity/ActivityThumb.jsx';
import { activityKcal, categoryOf } from '../../theme/activities.js';

function Row({ label, children, onClick }) {
  const Tag = onClick ? 'button' : 'div';
  return (
    <Tag type={onClick ? 'button' : undefined} onClick={onClick} className="flex min-h-16 w-full items-center gap-4 border-b border-border py-2 text-left">
      <span className="flex-1 text-base text-muted">{label}</span>
      {children}
    </Tag>
  );
}

export default function ActivityDetail() {
  const { slug } = useParams();
  const [params] = useSearchParams();
  const date = params.get('date') ?? today();
  const navigate = useNavigate();
  const toast = useToast();
  const { user } = useAuth();
  const { data, error, loading } = useApi(`/activities/${slug}`);
  const a = data?.activity;
  const [variant, setVariant] = useState(0);
  const [minutes, setMinutes] = useState('30');
  const [picker, setPicker] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (a) setMinutes(String(a.defaultMinutes ?? 30));
  }, [a]);

  const v = a?.variants[variant];
  const m = Number(minutes) || 0;
  const kcal = v ? activityKcal(v.met, user.profile.weightKg, m) : 0;
  const valid = m >= 1 && m <= 600;

  const save = async () => {
    if (!valid) return;
    setSaving(true);
    try {
      await api.post(`/logs/${date}/exercises`, { activity: slug, variant, minutes: m });
      toast(`Đã ghi ${a.name} • ${fmt(kcal)} kcal`);
      // Quay lại danh sách; nếu mở trực tiếp (không có lịch sử) thì chuyển về danh sách
      if (window.history.state?.idx > 0) navigate(-1);
      else navigate(`/activities?date=${date}`, { replace: true });
    } catch (e) {
      toast(e.message, 'error');
      setSaving(false);
    }
  };

  return (
    <>
      <TopBar
        title={a?.name ?? 'Hoạt động'}
        actions={
          <button type="button" onClick={save} disabled={!a || !valid || saving} className="min-h-11 px-2 text-base font-bold text-teal-dark disabled:text-divider">
            Lưu
          </button>
        }
      />
      <main className="flex flex-col gap-6 px-4 pb-12 pt-4">
        {loading && <Skeleton h={360} />}
        <ErrorNote error={error} />
        {a && (
          <>
            <div className="mx-auto w-full max-w-xs">
              {a.image ? (
                <img src={a.image} alt={a.name} className="aspect-[3/2] w-full rounded-xl object-cover shadow-card" />
              ) : (
                <div className={cx('grid aspect-[3/2] w-full place-items-center rounded-xl shadow-card', categoryOf(a.category).tile)}>
                  <ActivityThumb activity={a} size={96} iconSize={56} className="bg-transparent" />
                </div>
              )}
              {a.image && a.imageCredit?.author ? (
                <p className="pt-2 text-center text-xs text-muted">
                  Ảnh:{' '}
                  <a href={a.imageCredit.source} target="_blank" rel="noopener noreferrer" className="underline decoration-dotted underline-offset-2 hover:text-teal-dark">
                    {a.imageCredit.author}
                  </a>
                  {a.imageCredit.license && (
                    <>
                      {' • '}
                      {a.imageCredit.licenseUrl ? (
                        <a href={a.imageCredit.licenseUrl} target="_blank" rel="noopener noreferrer" className="underline decoration-dotted underline-offset-2 hover:text-teal-dark">{a.imageCredit.license}</a>
                      ) : (
                        a.imageCredit.license
                      )}
                    </>
                  )}
                </p>
              ) : (
                <p className="pt-2 text-center text-xs text-muted">{categoryOf(a.category).label}{a.nameEn ? ` • ${a.nameEn}` : ''}</p>
              )}
            </div>

            <div className="flex flex-col">
              <Row label="Mức độ" onClick={a.variants.length > 1 ? () => setPicker(true) : undefined}>
                <span className="max-w-[60%] text-right text-base font-bold text-primary">{v.name}</span>
                {a.variants.length > 1 && <ChevronRight size={20} className="shrink-0 text-subtle" aria-hidden="true" />}
              </Row>
              <Row label="Thời gian">
                <input
                  type="number"
                  inputMode="numeric"
                  min="1"
                  max="600"
                  aria-label="Thời gian (phút)"
                  value={minutes}
                  onChange={(e) => setMinutes(e.target.value)}
                  className={cx('h-10 w-20 rounded-md border bg-white px-2 text-right font-secondary text-base font-bold text-primary outline-none focus:border-teal-main', valid ? 'border-border' : 'border-warm-dark')}
                />
                <span className="w-12 text-base font-bold text-primary">phút</span>
              </Row>
              <Row label="Calo tiêu thụ">
                <span className="font-secondary text-base font-bold text-primary">{fmt(kcal)}</span>
                <span className="w-12 text-base font-bold text-primary">kcal</span>
              </Row>
            </div>
          </>
        )}
      </main>

      {a && (
        <Sheet open={picker} onClose={() => setPicker(false)} title="Mức độ">
          <ul className="-mx-4 flex flex-col divide-y divide-border">
            {a.variants.map((x, i) => (
              <li key={x.name}>
                <button
                  type="button"
                  onClick={() => {
                    setVariant(i);
                    setPicker(false);
                  }}
                  className={cx('flex min-h-14 w-full items-center gap-4 px-4 text-left', i === variant ? 'bg-teal-light' : 'hover:bg-white')}
                >
                  <span className="flex-1 text-base text-primary">{x.name}</span>
                  <span className="font-secondary text-xs text-muted">{fmt(activityKcal(x.met, user.profile.weightKg, m))} kcal</span>
                  {i === variant ? <Check size={20} className="text-teal-dark" aria-hidden="true" /> : <ChevronRight size={20} className="text-subtle" aria-hidden="true" />}
                </button>
              </li>
            ))}
          </ul>
        </Sheet>
      )}
    </>
  );
}
