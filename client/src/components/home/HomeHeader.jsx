import { Link } from 'react-router-dom';
import { Sparkles, Bell } from 'lucide-react';
import { Pill } from '../ds/index.jsx';
import Nuti from '../mascot/Nuti.jsx';

// Nền gradient xanh thương hiệu + các vòng tròn trang trí phía trên trang (theo Figma)
export function HeroBackdrop() {
  return (
    <div className="pointer-events-none absolute inset-x-0 top-0 h-96 overflow-hidden [mask-image:linear-gradient(to_bottom,#000_55%,transparent)]" aria-hidden="true">
      {/* Không dùng filter blur: gradient đã đủ mềm, blur trên vùng lớn làm giật khi cuộn trên điện thoại */}
      <div className="absolute inset-0 rounded-b-2xl bg-gradient-to-r from-brand-light via-brand-soft to-brand-pastel opacity-90" />
      {[0, 1, 2, 3, 4, 5].map((i) => (
        <span
          key={i}
          className="absolute h-[356px] w-[356px] rounded-full border border-white/60"
          style={{ top: -88 - i * 24, left: 88 - i * 48 }}
        />
      ))}
    </div>
  );
}

// "Hỏi NUTRIVA" + chuông nhắc nhở
export function HomeHeader({ remindersLeft = 0 }) {
  return (
    <header className="flex items-center justify-between gap-4">
      <Pill as={Link} to="/assistant" className="h-10 pl-1 pr-4 transition hover:shadow-card" aria-label="Hỏi Nuti, trợ lý dinh dưỡng NUTRIVA">
        <span className="grid h-8 w-8 place-items-center overflow-hidden rounded-full bg-brand-light">
          <Nuti size={30} animated={false} />
        </span>
        <span className="text-xs font-bold text-primary">Hỏi Nuti</span>
        <Sparkles size={16} className="text-brand-main" aria-hidden="true" />
      </Pill>
      <Pill
        as={Link}
        to="/track/reminders"
        className="h-10 px-3 transition hover:shadow-card"
        aria-label={remindersLeft ? `${remindersLeft} nhắc nhở còn lại hôm nay` : 'Nhắc nhở'}
      >
        <Bell size={20} className="text-primary" aria-hidden="true" />
        {remindersLeft > 0 && <span className="font-secondary text-xs font-semibold text-primary">{remindersLeft}</span>}
      </Pill>
    </header>
  );
}
