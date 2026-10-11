// Các màn minh họa (có hiệu ứng) xen giữa câu hỏi onboarding.
import { useEffect, useMemo } from 'react';
import { X, Check, Flame, Wheat, Zap, Droplet, GlassWater, Milk, Soup, Salad } from 'lucide-react';
import { cx, fmt } from '../ds/index.jsx';
import Nuti from '../mascot/Nuti.jsx';
import { useCountUp } from './Pickers.jsx';

// "Đã đặt mục tiêu" — Nuti ăn mừng giữa các vòng sóng
export function GoalSetScene({ text }) {
  return (
    <div className="flex flex-col items-center gap-6 pt-4 text-center">
      <div className="relative grid h-64 w-64 place-items-center">
        {[0, 1, 2].map((i) => (
          <span key={i} className="ob-ripple absolute inset-0 rounded-full border-2 border-brand-pastel" style={{ animationDelay: `${i * 0.6}s` }} aria-hidden="true" />
        ))}
        <span className="absolute inset-8 rounded-full bg-gradient-to-br from-brand-light to-brand-soft" aria-hidden="true" />
        {['left-6 top-10', 'right-8 top-6', 'right-4 bottom-16', 'left-8 bottom-10'].map((pos, i) => (
          <span key={pos} className={cx('ob-twinkle absolute text-2xl', pos)} style={{ animationDelay: `${i * 0.3}s` }} aria-hidden="true">
            ✦
          </span>
        ))}
        <Nuti mood="wave" size={150} className="relative" label="Nuti vẫy tay ăn mừng" />
      </div>
      <p className="max-w-xs text-base text-secondary">{text}</p>
    </div>
  );
}

// So sánh: tự xoay xở vs cùng NUTRIVA — theo mẫu: 2 thẻ cao ~nửa màn hình, thẻ NUTRIVA nhô cao & đè nhẹ lên thẻ trái
export function CompareScene() {
  const bad = ['Tự tính calo từng món', 'Bữa ăn thất thường, khó duy trì', 'Không biết uống sữa hạt nào hợp'];
  const good = ['Kế hoạch 7 ngày theo mục tiêu', 'Sữa hạt đúng khẩu vị, đủ chất', 'Nhắc nhở & theo dõi mỗi ngày'];
  return (
    <div className="flex min-h-[58dvh] items-center">
      <div className="flex w-full items-end">
        <div className="ob-item flex min-h-[380px] w-1/2 flex-col gap-4 rounded-[24px] bg-surface p-4 pr-6" style={{ animationDelay: '80ms' }}>
          <p className="text-xl font-extrabold leading-7 text-secondary">Tự xoay xở</p>
          {bad.map((t) => (
            <p key={t} className="flex items-start gap-2 text-[15px] leading-5 text-muted">
              <X size={18} strokeWidth={2.5} className="mt-0.5 shrink-0 text-warm-dark" aria-hidden="true" /> {t}
            </p>
          ))}
          <span className="mt-auto flex justify-center opacity-80">
            <Nuti mood="sorry" size={104} animated={false} />
          </span>
        </div>
        <div className="ob-rise relative z-10 -ml-4 flex min-h-[440px] w-[calc(50%+16px)] flex-col gap-4 rounded-[24px] bg-brand-dark p-4 text-white shadow-float" style={{ animationDelay: '320ms' }}>
          <p className="text-xl font-extrabold leading-7">Cùng NUTRIVA</p>
          {good.map((t, i) => (
            <p key={t} className="ob-item flex items-start gap-2 text-[15px] font-semibold leading-5 text-brand-soft" style={{ animationDelay: `${600 + i * 160}ms` }}>
              <Check size={18} strokeWidth={3} className="mt-0.5 shrink-0 text-brand-accent" aria-hidden="true" /> {t}
            </p>
          ))}
          <span className="mt-auto flex justify-center">
            <Nuti mood="happy" size={124} />
          </span>
        </div>
      </div>
    </div>
  );
}

// Ghi bữa ăn chỉ với vài chạm — các món lần lượt "được thêm", vòng calo đầy dần
export function EasyLogScene() {
  const rows = [
    { icon: Soup, name: 'Phở bò tái', kcal: 402, tone: 'bg-lunch-card text-warm-dark' },
    { icon: Salad, name: 'Salad ức gà', kcal: 334, tone: 'bg-breakfast-card text-brand-deep' },
    { icon: Milk, name: 'Sữa hạt NUTRIVA', kcal: 170, tone: 'bg-snacks-card text-cookie' },
  ];
  const total = useCountUp(906, 2200);
  const r = 34;
  const c = 2 * Math.PI * r;
  return (
    <div className="flex min-h-[56dvh] items-center">
    <div className="mx-auto flex w-full flex-col gap-2 rounded-[24px] bg-white p-5 shadow-float">
      <div className="flex items-center gap-4 border-b border-border pb-4">
        <svg width="104" height="104" viewBox="0 0 84 84" className="-rotate-90" aria-hidden="true">
          <circle cx="42" cy="42" r={r} fill="none" stroke="#EFF3F0" strokeWidth="10" />
          <circle cx="42" cy="42" r={r} fill="none" stroke="#7CA034" strokeWidth="10" strokeLinecap="round" strokeDasharray={c} strokeDashoffset={c * (1 - (total / 1600) * 0.95)} />
        </svg>
        <div>
          <p className="font-secondary text-4xl font-bold text-primary">{fmt(total)}</p>
          <p className="text-sm text-muted">/ 1.600 kcal hôm nay</p>
        </div>
      </div>
      {rows.map((x, i) => (
        <div key={x.name} className="ob-item flex min-h-16 items-center gap-4 rounded-lg p-2" style={{ animationDelay: `${300 + i * 550}ms` }}>
          <span className={cx('grid h-12 w-12 place-items-center rounded-md', x.tone)} aria-hidden="true">
            <x.icon size={24} />
          </span>
          <span className="flex-1 text-base font-bold text-primary">{x.name}</span>
          <span className="font-secondary text-sm text-muted">{x.kcal} kcal</span>
          <span className="ob-pop grid h-7 w-7 place-items-center rounded-full bg-brand-main text-white" style={{ animationDelay: `${520 + i * 550}ms` }} aria-hidden="true">
            <Check size={16} strokeWidth={3} />
          </span>
        </div>
      ))}
    </div>
    </div>
  );
}

// Khuyến nghị mỗi ngày (số chạy)
function Stat({ icon: Icon, tone, label, value, unit, delay }) {
  const v = useCountUp(value, 1100);
  return (
    <div className="ob-item flex flex-col gap-2 rounded-xl bg-white p-4 shadow-card" style={{ animationDelay: `${delay}ms` }}>
      <span className="flex items-center gap-1 text-sm font-semibold text-secondary">
        <Icon size={16} className={tone} aria-hidden="true" /> {label}
      </span>
      <span className="flex items-baseline gap-1">
        <b className="font-secondary text-3xl font-bold tabular-nums text-primary">{fmt(v)}</b>
        <span className="text-sm text-muted">{unit}</span>
      </span>
    </div>
  );
}
export function RecommendScene({ health }) {
  return (
    <div className="flex flex-col gap-4 rounded-2xl bg-brand-light p-4">
      <p className="text-base font-bold text-brand-deep">Khuyến nghị mỗi ngày</p>
      <div className="grid grid-cols-2 gap-2">
        <Stat icon={Flame} tone="text-warm-main" label="Năng lượng" value={health.targetKcal} unit="kcal" delay={80} />
        <Stat icon={Wheat} tone="text-water-icon" label="Bột đường" value={health.macros.carb} unit="g" delay={180} />
        <Stat icon={Zap} tone="text-brand-main" label="Đạm" value={health.macros.protein} unit="g" delay={280} />
        <Stat icon={Droplet} tone="text-warm-main" label="Béo" value={health.macros.fat} unit="g" delay={380} />
      </div>
      <div className="ob-item flex items-center gap-2 rounded-xl bg-white p-4 shadow-card" style={{ animationDelay: '480ms' }}>
        <GlassWater size={20} className="text-water-icon" aria-hidden="true" />
        <span className="flex-1 text-sm font-semibold text-secondary">Nước</span>
        <b className="font-secondary text-lg text-primary">{fmt(health.waterMl)} ml</b>
      </div>
    </div>
  );
}

// Kết quả bền vững: ăn kiêng cấp tốc (dội cân) vs kế hoạch NUTRIVA (giảm đều)
export function ResultsScene() {
  return (
    <div className="flex min-h-[56dvh] items-center">
    <div className="flex w-full flex-col gap-4 rounded-[24px] bg-white p-5 shadow-float">
      <svg viewBox="0 0 320 230" className="w-full" role="img" aria-label="Biểu đồ: ăn kiêng cấp tốc làm cân nặng tăng trở lại, kế hoạch NUTRIVA giúp giảm đều và giữ được">
        <defs>
          <linearGradient id="ob-green" x1="0" x2="0" y1="0" y2="1">
            <stop offset="0" stopColor="#7CA034" stopOpacity="0.28" />
            <stop offset="1" stopColor="#7CA034" stopOpacity="0" />
          </linearGradient>
        </defs>
        {[40, 80, 120, 160, 200].map((y) => <line key={y} x1="16" x2="312" y1={y} y2={y} stroke="#EFF3F0" />)}
        <path d="M20 44C70 50 100 140 130 136C165 132 200 40 300 30" fill="none" stroke="#F47A3D" strokeWidth="4" strokeLinecap="round" pathLength="1" className="ob-draw" />
        <path d="M20 44C80 52 140 120 300 150L300 200L20 200Z" fill="url(#ob-green)" className="ob-fade" />
        <path d="M20 44C80 52 140 120 300 150" fill="none" stroke="#567324" strokeWidth="4" strokeLinecap="round" pathLength="1" className="ob-draw" style={{ animationDelay: '0.5s' }} />
        <circle cx="20" cy="44" r="6" fill="#fff" stroke="#14211B" strokeWidth="3" />
        <circle cx="300" cy="30" r="6" fill="#fff" stroke="#F47A3D" strokeWidth="3" className="ob-fade" style={{ animationDelay: '1.2s' }} />
        <circle cx="300" cy="150" r="6" fill="#fff" stroke="#567324" strokeWidth="3" className="ob-fade" style={{ animationDelay: '1.6s' }} />
        <text x="300" y="16" textAnchor="end" fontSize="13" fontWeight="800" fill="#B94719">Ăn kiêng cấp tốc</text>
        <text x="300" y="178" textAnchor="end" fontSize="13" fontWeight="800" fill="#567324">Kế hoạch NUTRIVA</text>
        <text x="20" y="222" fontSize="12" fill="#5E6D65">Tháng 1</text>
        <text x="312" y="222" textAnchor="end" fontSize="12" fill="#5E6D65">Tháng 6</text>
      </svg>
      <p className="text-center text-base text-secondary">Giảm cân từ từ khoảng 0,5 kg mỗi tuần giúp giữ kết quả lâu dài và hạn chế tăng cân trở lại.</p>
    </div>
    </div>
  );
}

// Màn chờ: % tăng dần, các bước được tích lần lượt rồi tự chuyển tiếp
const STEPS = ['Tính nhu cầu năng lượng (BMR, TDEE)', 'Chia calo cho 4 bữa trong ngày', 'Chọn sữa hạt hợp khẩu vị của bạn', 'Lọc thực phẩm bạn cần tránh'];
export function LoadingScene({ onDone }) {
  const pct = useCountUp(100, 3600);
  const done = Math.floor(pct / 25);
  useEffect(() => {
    if (pct >= 100) {
      const t = setTimeout(onDone, 500);
      return () => clearTimeout(t);
    }
    return undefined;
  }, [pct, onDone]);
  return (
    <div className="flex flex-col items-center gap-6 pt-6 text-center" role="status" aria-live="polite">
      <p className="font-secondary text-6xl font-bold tabular-nums text-brand-core">{Math.round(pct)}%</p>
      <h2 className="font-display text-2xl font-bold text-primary [font-variation-settings:'SOFT'_100]">Đang thiết lập mọi thứ cho bạn</h2>
      <div className="h-2 w-full max-w-xs overflow-hidden rounded-full bg-surface">
        <div className="h-full rounded-full bg-gradient-to-r from-brand-accent to-brand-dark" style={{ width: `${pct}%` }} />
      </div>
      <ul className="flex w-full max-w-xs flex-col gap-2 text-left">
        {STEPS.map((s, i) => (
          <li key={s} className={cx('flex items-center gap-2 text-sm transition-colors', i < done ? 'text-primary' : 'text-subtle')}>
            <span className={cx('grid h-6 w-6 shrink-0 place-items-center rounded-full transition', i < done ? 'ob-pop bg-brand-main text-white' : 'bg-surface text-transparent')} aria-hidden="true">
              <Check size={14} strokeWidth={3} />
            </span>
            {s}
          </li>
        ))}
      </ul>
      <Nuti mood="thinking" size={88} />
    </div>
  );
}

// Pháo giấy (CSS) — tắt khi giảm chuyển động
export function Confetti({ count = 40 }) {
  const pieces = useMemo(
    () =>
      Array.from({ length: count }, (_, i) => ({
        left: Math.random() * 100,
        delay: Math.random() * 0.8,
        dur: 1.8 + Math.random() * 1.4,
        rot: Math.random() * 360,
        color: ['#7CA034', '#A7C65E', '#F47A3D', '#F5D97A', '#2679A8', '#F29C8A'][i % 6],
        w: 6 + Math.random() * 6,
      })),
    [count],
  );
  return (
    <div className="pointer-events-none fixed inset-0 z-30 overflow-hidden motion-reduce:hidden" aria-hidden="true">
      {pieces.map((p, i) => (
        <span
          key={i}
          className="ob-confetti absolute top-0 rounded-sm"
          style={{ left: `${p.left}%`, width: p.w, height: p.w * 0.45, background: p.color, animationDelay: `${p.delay}s`, animationDuration: `${p.dur}s`, transform: `rotate(${p.rot}deg)` }}
        />
      ))}
    </div>
  );
}

// Dự kiến cân nặng: hiện tại → mục tiêu (đường cong vẽ dần, nhãn mục tiêu bật lên)
export function ProjectionChart({ from, to, endLabel }) {
  const flat = Math.abs(from - to) < 0.1;
  const down = to < from;
  const y0 = flat ? 90 : down ? 40 : 140;
  const y1 = flat ? 90 : down ? 140 : 40;
  const path = `M24 ${y0}C110 ${y0} 170 ${y1} 296 ${y1}`;
  return (
    <svg viewBox="0 0 320 200" className="w-full" role="img" aria-label={`Dự kiến cân nặng từ ${fmt(from, 1)} kg đến ${fmt(to, 1)} kg vào ${endLabel}`}>
      <defs>
        <linearGradient id="ob-line" x1="0" x2="1">
          <stop offset="0" stopColor="#F47A3D" />
          <stop offset="1" stopColor="#7CA034" />
        </linearGradient>
        <linearGradient id="ob-area" x1="0" x2="0" y1="0" y2="1">
          <stop offset="0" stopColor="#A7C65E" stopOpacity="0.3" />
          <stop offset="1" stopColor="#A7C65E" stopOpacity="0" />
        </linearGradient>
      </defs>
      {[40, 90, 140].map((y) => <line key={y} x1="16" x2="312" y1={y} y2={y} stroke="#EFF3F0" strokeDasharray="4 4" />)}
      <path d={`${path}L296 176L24 176Z`} fill="url(#ob-area)" className="ob-fade" />
      <path d={path} fill="none" stroke="url(#ob-line)" strokeWidth="5" strokeLinecap="round" pathLength="1" className="ob-draw" />
      <circle cx="24" cy={y0} r="7" fill="#fff" stroke="#F47A3D" strokeWidth="4" />
      <text x="24" y={y0 - 14} fontSize="13" fontWeight="700" fill="#35443D">{fmt(from, 1)} kg</text>
      <g className="ob-pop" style={{ animationDelay: '1.1s', transformOrigin: `296px ${y1}px` }}>
        <circle cx="296" cy={y1} r="8" fill="#fff" stroke="#567324" strokeWidth="4" />
        <rect x="232" y={y1 - 44} width="76" height="28" rx="8" fill="#567324" />
        <text x="270" y={y1 - 25} textAnchor="middle" fontSize="14" fontWeight="800" fill="#fff">{fmt(to, 1)} kg</text>
      </g>
      <text x="24" y="196" fontSize="12" fill="#5E6D65">Hôm nay</text>
      <text x="300" y="196" textAnchor="end" fontSize="12" fill="#5E6D65">{endLabel}</text>
    </svg>
  );
}
