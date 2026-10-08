import { Link } from 'react-router-dom';
import { ChevronRight, Download, Milk, Sprout, CalendarCheck } from 'lucide-react';
import { Logo } from '../../components/ui.jsx';
import { Pill } from '../../components/ds/index.jsx';
import { HeroBackdrop } from '../../components/home/HomeHeader.jsx';
import { usePwa } from '../../context/PwaContext.jsx';

const FEATURES = [
  { icon: Milk, label: 'Sữa hạt tươi' },
  { icon: Sprout, label: 'Set tự làm' },
  { icon: CalendarCheck, label: 'Kế hoạch riêng' },
];

export default function Welcome() {
  const pwa = usePwa();
  return (
    <main className="relative flex min-h-dvh flex-col overflow-x-clip bg-gradient-to-b from-background via-surface to-background px-4 pb-[calc(24px+var(--safe-b))] pt-[max(16px,env(safe-area-inset-top))]">
      <HeroBackdrop />
      <div className="relative flex flex-1 flex-col gap-6">
        <header className="flex items-center justify-between gap-4">
          <Logo size={40} />
          {pwa.showInstall && (
            <Pill as="button" type="button" onClick={pwa.install} className="h-10 px-4 text-sm font-bold text-brand-dark transition hover:shadow-card">
              <Download size={16} aria-hidden="true" /> {pwa.installedOnDevice ? 'Mở app' : 'Cài đặt'}
            </Pill>
          )}
        </header>

        <div className="overflow-hidden rounded-2xl shadow-float">
          <img
            src="/img/hero.webp"
            alt="Chai sữa hạt NUTRIVA bên cạnh hạt điều, hạnh nhân, óc chó"
            width="378"
            height="270"
            fetchpriority="high"
            className="aspect-[378/270] w-full object-cover"
          />
        </div>

        <section className="flex flex-col items-center gap-2 text-center">
          <h1 className="font-display text-4xl font-bold leading-10 text-brand-core [font-variation-settings:'SOFT'_100]">
            Dinh dưỡng
            <br />
            theo cách của bạn
          </h1>
          <p className="font-script text-2xl text-brand-dark">Ăn lành mỗi ngày, sống rạng rỡ hơn</p>
        </section>

        <ul className="grid grid-cols-3 gap-2" aria-label="NUTRIVA có gì">
          {FEATURES.map((f) => (
            <li key={f.label} className="flex flex-col items-center gap-2 rounded-lg bg-white/80 p-2 py-4 text-center shadow-pill">
              <span className="grid h-10 w-10 place-items-center rounded-full bg-brand-light text-brand-dark" aria-hidden="true">
                <f.icon size={20} />
              </span>
              <span className="text-xs font-bold text-primary">{f.label}</span>
            </li>
          ))}
        </ul>

        <div className="mt-auto flex flex-col gap-2">
          <Link to="/onboarding" className="inline-flex h-14 items-center justify-center gap-2 rounded-full bg-brand-dark text-base font-bold text-white transition hover:bg-brand-deep active:scale-[0.98]">
            Bắt đầu <ChevronRight size={20} aria-hidden="true" />
          </Link>
          <Link to="/login" className="inline-flex h-14 items-center justify-center rounded-full bg-white text-base font-bold text-brand-dark shadow-pill transition hover:bg-brand-light active:scale-[0.98]">
            Tôi đã có tài khoản
          </Link>
        </div>
      </div>
    </main>
  );
}
