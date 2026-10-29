import { useId, useMemo } from 'react';
import { crown, flavorOf, bottleSrc, NUTS, FLYING_DROPS, SPLASH_VIEW } from './art.js';
import { cx } from '../ds/index.jsx';

// Một lớp sữa bắn (sau hoặc trước chai). Gradient theo màu sữa của vị đang hiển thị.
export function Splash({ line, part, seed = 3, poolTo, className = '', style }) {
  const id = useId().replace(/:/g, '');
  const f = flavorOf(line);
  const c = useMemo(() => crown(seed), [seed]);
  const back = part === 'back';
  return (
    <svg viewBox={`0 0 ${SPLASH_VIEW.w} ${SPLASH_VIEW.h}`} className={className} style={style} aria-hidden="true" overflow="visible">
      <defs>
        {/* Lớp sau tối hơn (thành trong, khuất sáng); lớp trước sáng ở mép trên, đậm dần xuống vũng sữa */}
        <linearGradient id={`${id}g`} x1="0" y1={back ? 30 : 100} x2="0" y2={back ? 160 : 210} gradientUnits="userSpaceOnUse">
          <stop offset="0" stopColor={back ? f.milk : '#FFFFFF'} />
          <stop offset={back ? 0.5 : 0.22} stopColor={back ? f.shade : f.milk} />
          <stop offset="1" stopColor={back ? f.shade : (poolTo ?? f.shade)} />
        </linearGradient>
        {/* Vũng sữa mờ dần ra hai bên → không lộ mép cắt */}
        <linearGradient id={`${id}m`} x1="-22" y1="0" x2="342" y2="0" gradientUnits="userSpaceOnUse">
          <stop offset="0" stopColor="#000" />
          <stop offset="0.16" stopColor="#fff" />
          <stop offset="0.86" stopColor="#fff" />
          <stop offset="1" stopColor="#000" />
        </linearGradient>
        <mask id={`${id}k`} maskUnits="userSpaceOnUse" x="-40" y="-40" width="400" height="260">
          <rect x="-40" y="-40" width="400" height="260" fill={`url(#${id}m)`} />
        </mask>
        <radialGradient id={`${id}d`} cx="0.35" cy="0.3" r="0.75">
          <stop offset="0" stopColor="#FFFFFF" />
          <stop offset="0.45" stopColor={f.milk} />
          <stop offset="1" stopColor={f.shade} />
        </radialGradient>
      </defs>
      <g fill={`url(#${id}g)`} mask={back ? undefined : `url(#${id}k)`} style={{ filter: `drop-shadow(0 ${back ? 2 : -3}px ${back ? 3 : 4}px rgba(60,40,10,${back ? 0.12 : 0.16}))` }}>
        <path d={back ? c.back : c.front} />
        {(back ? c.backSpikes : c.frontSpikes).map((d) => (
          <path key={d} d={d} />
        ))}
      </g>
      {(back ? c.backDrops : c.frontDrops).map((d) => (
        <circle key={`${d.x}-${d.y}`} cx={d.x} cy={d.y} r={d.r} fill={`url(#${id}d)`} />
      ))}
      <g stroke="#FFFFFF" strokeLinecap="round" fill="none">
        {back
          ? c.gloss.map((d) => <path key={d} d={d} strokeWidth="2.4" opacity="0.55" />)
          : c.highlights.map((d) => <path key={d} d={d} strokeWidth="2.6" opacity="0.75" />)}
      </g>
    </svg>
  );
}

// Giọt sữa tròn có điểm sáng — cảm giác 3D
export function Drop({ line, size = 10, className = '', style }) {
  const id = useId().replace(/:/g, '');
  const f = flavorOf(line);
  return (
    <svg viewBox="0 0 20 24" width={size} height={size * 1.2} className={className} style={style} aria-hidden="true">
      <defs>
        <radialGradient id={id} cx="0.35" cy="0.4" r="0.7">
          <stop offset="0" stopColor="#FFFFFF" />
          <stop offset="0.5" stopColor={f.milk} />
          <stop offset="1" stopColor={f.shade} />
        </radialGradient>
      </defs>
      <path d="M10 1c4 6 8 10 8 14a8 8 0 0 1-16 0c0-4 4-8 8-14z" fill={`url(#${id})`} />
      <ellipse cx="7" cy="14" rx="2" ry="3" fill="#FFFFFF" opacity="0.7" />
    </svg>
  );
}

export function Nut({ kind, size = 32, className = '', style }) {
  return <svg viewBox="0 0 48 48" width={size} height={size} className={className} style={style} aria-hidden="true" dangerouslySetInnerHTML={{ __html: NUTS[kind] ?? NUTS.almond }} />;
}

// Chai sữa "bật" lên từ vũng sữa bắn: lớp sữa sau → chai → lớp sữa trước (che đáy chai) → giọt sữa & hạt bay.
// h = chiều cao khung (px). Khung cha nên cắt phần đáy (overflow-hidden) để vũng sữa liền với mép thẻ.
// k: đổi giá trị để phát lại hiệu ứng bắn khi chuyển vị.
export function BottleScene({ line, h = 260, k = 0, tilt = -4, seed = 3, drops = true, nuts = true, still = false, className = '', style }) {
  const f = flavorOf(line);
  const w = h * 0.92;
  const bw = h * 0.36;
  const splashH = w * (SPLASH_VIEW.h / SPLASH_VIEW.w);
  const splashTop = h * 0.78 - SPLASH_VIEW.frontTop * splashH;
  const unit = h / 260;
  const anim = (cls) => (still ? '' : cls);
  return (
    <div className={cx('pointer-events-none', /\b(absolute|fixed)\b/.test(className) ? '' : 'relative', className)} style={{ width: w, height: h, ...style }} aria-hidden="true">
      {nuts && (
        <Nut kind={f.nuts[1]} size={34 * unit} className={cx('absolute', anim('nut-drift'))} style={{ right: 10 * unit, top: h * 0.34, animationDelay: '-2s' }} />
      )}
      <Splash key={`b${k}`} line={line} part="back" seed={seed} className={cx('absolute left-0', anim('splash-burst'))} style={{ top: splashTop, width: w, height: splashH }} />
      <div key={`c${k}`} className={cx('absolute', anim('bottle-in'))} style={{ left: (w - bw) / 2, top: 0, width: bw, '--tilt': `${tilt}deg`, rotate: still ? `${tilt}deg` : undefined }}>
        <img src={bottleSrc(line)} alt="" draggable="false" className={cx('block w-full select-none drop-shadow-[0_10px_14px_rgba(40,30,10,0.28)]', anim('bottle-float'))} />
      </div>
      <Splash key={`f${k}`} line={line} part="front" seed={seed} className={cx('absolute left-0', anim('splash-burst'))} style={{ top: splashTop, width: w, height: splashH, animationDelay: still ? undefined : '60ms' }} />
      {drops &&
        FLYING_DROPS.map((d, i) => (
          <Drop
            key={`d${k}-${i}`}
            line={line}
            size={d.s * unit * 1.6}
            className={cx('absolute', anim('milk-drop'))}
            style={{ left: `${d.x}%`, top: `${d.y}%`, rotate: `${(d.x - 50) * 0.8}deg`, '--fx': `${(50 - d.x) * unit * 1.4}px`, '--fy': `${(80 - d.y) * unit * 1.2}px`, animationDelay: `${120 + d.d * 70}ms, ${900 + d.d * 400}ms` }}
          />
        ))}
      {nuts && (
        <>
          <Nut kind={f.nuts[0]} size={30 * unit} className={cx('absolute', anim('nut-drift'))} style={{ left: -6 * unit, top: h * 0.16 }} />
          <Nut kind={f.nuts[2]} size={46 * unit} className={cx('absolute blur-[1.5px]', anim('nut-drift'))} style={{ left: w * 0.04, bottom: h * 0.04, animationDelay: '-4s' }} />
        </>
      )}
    </div>
  );
}

// Ba chai xếp quạt trồi lên từ một vũng sữa bắn (sheet dùng thử / mở khóa). Cao tổng = 1,2 × h; mép sữa trước ở 0,8 × h.
export function BottleTrio({ lines = ['sen-com', 'mach-nhien', 'nau-moc'], h = 150, poolTo, className = '' }) {
  const [l, c, r] = lines;
  const w = h * 1.55;
  const bw = h * 0.33;
  const sw = bw * 0.84;
  const splashH = w * (SPLASH_VIEW.h / SPLASH_VIEW.w);
  const splashTop = h * 0.8 - SPLASH_VIEW.frontTop * splashH;
  const unit = h / 150;
  const side = (line, dir) => (
    <div className="bottle-in absolute" style={{ left: w / 2 - sw / 2 + dir * bw * 0.98, top: h * 0.16, width: sw, '--tilt': `${dir * 11}deg`, animationDelay: '90ms' }}>
      <img src={bottleSrc(line)} alt="" draggable="false" className="bottle-float block w-full drop-shadow-[0_8px_10px_rgba(40,30,10,0.25)]" style={{ animationDelay: `${dir * 0.8}s` }} />
    </div>
  );
  return (
    <div className={cx('pointer-events-none relative', className)} style={{ width: w, height: h * 1.2 }} aria-hidden="true">
      <Splash line={c} part="back" seed={5} poolTo={poolTo} className="splash-burst absolute left-0" style={{ top: splashTop, width: w, height: splashH }} />
      {side(l, -1)}
      {side(r, 1)}
      <div className="bottle-in absolute" style={{ left: (w - bw) / 2, top: 0, width: bw, '--tilt': '0deg' }}>
        <img src={bottleSrc(c)} alt="" draggable="false" className="bottle-float block w-full drop-shadow-[0_10px_14px_rgba(40,30,10,0.3)]" />
      </div>
      <Splash line={c} part="front" seed={5} poolTo={poolTo} className="splash-burst absolute left-0" style={{ top: splashTop, width: w, height: splashH, animationDelay: '60ms' }} />
      {FLYING_DROPS.slice(0, 6).map((d, i) => (
        <Drop key={i} line={c} size={d.s * unit * 1.3} className="milk-drop absolute" style={{ left: `${d.x}%`, top: `${d.y * 0.7}%`, rotate: `${(d.x - 50) * 0.8}deg`, '--fx': `${(50 - d.x) * unit}px`, '--fy': `${(80 - d.y) * unit}px`, animationDelay: `${150 + d.d * 70}ms, ${900 + d.d * 400}ms` }} />
      ))}
      <Nut kind={flavorOf(l).nuts[0]} size={26 * unit} className="nut-drift absolute" style={{ left: -8 * unit, top: h * 0.42 }} />
      <Nut kind={flavorOf(r).nuts[0]} size={28 * unit} className="nut-drift absolute" style={{ right: -10 * unit, top: h * 0.3, animationDelay: '-3s' }} />
    </div>
  );
}
