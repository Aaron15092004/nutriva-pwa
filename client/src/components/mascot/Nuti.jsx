// "Nuti" — linh vật NUTRIVA (vẽ lại dạng vector từ thiết kế mascot): hạt tròn màu kem, mầm 2 lá, tay chân nâu.
// mood: 'happy' | 'wave' | 'laugh' | 'love' | 'wink' | 'dance' | 'eat' | 'wow' | 'cool' | 'touched' | 'thinking' | 'sorry'
// animated: nhún nhẹ, chớp mắt, lá đung đưa, vẫy tay, tim/lấp lánh bay (tự tắt khi người dùng bật giảm chuyển động).
import { useId } from 'react';
import { cx } from '../ds/index.jsx';

export const NUTI_MOODS = ['happy', 'wave', 'laugh', 'love', 'wink', 'dance', 'eat', 'wow', 'cool', 'touched', 'thinking', 'sorry'];

const OUTLINE = '#8A5A2B';
const LIMB = '#6B3A1E';
const LIMB_DARK = '#4A2610';
const INK = '#2E1B0E';
const MOUTH = '#E35D4E';
const MOUTH_LINE = '#7A2A1C';
const ACCENT = '#F0A23A';

// Bàn tay dạng găng (gốc 0,0 ở vai, hướng xuống)
function Arm({ x, y, r = 0, className, style }) {
  return (
    <g transform={`translate(${x} ${y}) rotate(${r})`}>
      <g className={className} style={style}>
        <path d="M-4.6 0C-6.8 7-6.8 14.5-3.6 18.5C-1 21.8 4.6 21.8 6.6 17.6C8.2 14 7 6.2 4.6 0Z" fill={LIMB} stroke={LIMB_DARK} strokeWidth="1.2" strokeLinejoin="round" />
        <path d="M5.8 11.2C9.4 10.4 10.8 13.6 8.2 16" fill={LIMB} stroke={LIMB_DARK} strokeWidth="1.2" strokeLinecap="round" />
      </g>
    </g>
  );
}
// Nắm tay tròn (giơ lên / ôm vật)
const Fist = ({ x, y, rr = 6.4 }) => <circle cx={x} cy={y} r={rr} fill={LIMB} stroke={LIMB_DARK} strokeWidth="1.2" />;

const Sparkle = ({ x, y, s = 1, className, delay = 0 }) => (
  <path
    d={`M${x} ${y - 6 * s}C${x + 1 * s} ${y - 1.5 * s} ${x + 1.5 * s} ${y - 1 * s} ${x + 6 * s} ${y}C${x + 1.5 * s} ${y + 1 * s} ${x + 1 * s} ${y + 1.5 * s} ${x} ${y + 6 * s}C${x - 1 * s} ${y + 1.5 * s} ${x - 1.5 * s} ${y + 1 * s} ${x - 6 * s} ${y}C${x - 1.5 * s} ${y - 1 * s} ${x - 1 * s} ${y - 1.5 * s} ${x} ${y - 6 * s}Z`}
    fill="#F5B82E"
    className={className}
    style={{ transformBox: 'fill-box', transformOrigin: 'center', animationDelay: `${delay}s` }}
  />
);
const Heart = ({ x, y, s = 1, fill = '#E5484D', stroke = '#A61E26', className, delay = 0 }) => (
  <path
    d={`M${x} ${y + 7 * s}C${x - 9 * s} ${y + 1 * s} ${x - 9 * s} ${y - 7 * s} ${x - 3.6 * s} ${y - 7 * s}C${x - 1.4 * s} ${y - 7 * s} ${x} ${y - 5.4 * s} ${x} ${y - 4 * s}C${x} ${y - 5.4 * s} ${x + 1.4 * s} ${y - 7 * s} ${x + 3.6 * s} ${y - 7 * s}C${x + 9 * s} ${y - 7 * s} ${x + 9 * s} ${y + 1 * s} ${x} ${y + 7 * s}Z`}
    fill={fill}
    stroke={stroke}
    strokeWidth={1.2}
    strokeLinejoin="round"
    className={className}
    style={{ transformBox: 'fill-box', transformOrigin: 'center', animationDelay: `${delay}s` }}
  />
);

function Eyes({ mood, animated }) {
  const open = (x, y, rx = 4.6, ry = 5.8, big = false) => (
    <g>
      <ellipse cx={x} cy={y} rx={rx} ry={ry} fill={INK} />
      <circle cx={x + rx * 0.35} cy={y - ry * 0.38} r={big ? 2.2 : 1.8} fill="#fff" />
      <circle cx={x - rx * 0.3} cy={y + ry * 0.4} r={big ? 1.2 : 0.9} fill="#fff" />
    </g>
  );
  const arcUp = (x, y) => <path d={`M${x - 5} ${y + 1.5}Q${x} ${y - 5} ${x + 5} ${y + 1.5}`} fill="none" stroke={INK} strokeWidth="2.8" strokeLinecap="round" />;
  const arcDown = (x, y) => <path d={`M${x - 5} ${y - 1}Q${x} ${y + 4} ${x + 5} ${y - 1}`} fill="none" stroke={INK} strokeWidth="2.6" strokeLinecap="round" />;
  const blink = animated && ['happy', 'wave', 'love', 'cool', 'wow', 'touched', 'thinking'].includes(mood);
  let eyes;
  switch (mood) {
    case 'laugh':
    case 'dance':
      eyes = (
        <g fill="none" stroke={INK} strokeWidth="2.8" strokeLinecap="round" strokeLinejoin="round">
          <path d="M43 69.5L51 74L43 78.5" />
          <path d="M77 69.5L69 74L77 78.5" />
        </g>
      );
      break;
    case 'eat':
      eyes = (
        <>
          {arcUp(48, 74)}
          {arcUp(72, 74)}
        </>
      );
      break;
    case 'wink':
      eyes = (
        <>
          {open(48, 74)}
          <path d="M67 75.5Q72 69 77 75.5" fill="none" stroke={INK} strokeWidth="2.8" strokeLinecap="round" />
        </>
      );
      break;
    case 'sorry':
      eyes = (
        <>
          {arcDown(48, 74)}
          {arcDown(72, 74)}
        </>
      );
      break;
    case 'wow':
      eyes = (
        <>
          {open(48, 74, 5, 6.6)}
          {open(72, 74, 5, 6.6)}
          <g fill="none" stroke={OUTLINE} strokeWidth="1.8" strokeLinecap="round">
            <path d="M43 63Q48 60 53 63" />
            <path d="M67 63Q72 60 77 63" />
          </g>
        </>
      );
      break;
    case 'touched':
      eyes = (
        <>
          {open(48, 74, 5.4, 6.4, true)}
          {open(72, 74, 5.4, 6.4, true)}
        </>
      );
      break;
    case 'thinking':
      eyes = (
        <>
          <ellipse cx="48" cy="75" rx="4.4" ry="4.4" fill={INK} />
          <circle cx="49.4" cy="73.4" r="1.4" fill="#fff" />
          <path d="M42 67L54 69.5" fill="none" stroke={OUTLINE} strokeWidth="2" strokeLinecap="round" />
          {open(72, 74)}
          <path d="M67 64Q72 61.5 77 64.5" fill="none" stroke={OUTLINE} strokeWidth="1.8" strokeLinecap="round" />
        </>
      );
      break;
    case 'cool':
      eyes = (
        <g>
          <path d="M33 68H87" stroke="#1D1D1F" strokeWidth="2.4" strokeLinecap="round" />
          <path d="M35 68H56C56 77 52 82 45.5 82C38.5 82 35 77 35 68Z" fill="#1D1D1F" />
          <path d="M64 68H85C85 77 81.5 82 74.5 82C68 82 64 77 64 68Z" fill="#1D1D1F" />
          <path d="M39 71L44 71M38.5 75L42.5 71.5" stroke="#fff" strokeWidth="1.6" strokeLinecap="round" opacity="0.85" />
          <path d="M68 71L73 71M67.5 75L71.5 71.5" stroke="#fff" strokeWidth="1.6" strokeLinecap="round" opacity="0.85" />
        </g>
      );
      break;
    default:
      eyes = (
        <>
          {open(48, 74)}
          {open(72, 74)}
        </>
      );
  }
  return (
    <g className={cx(blink && 'nuti-blink')} style={{ transformOrigin: '60px 74px' }}>
      {eyes}
    </g>
  );
}

function Mouth({ mood }) {
  if (mood === 'wow') return <ellipse cx="60" cy="90" rx="4" ry="5" fill={MOUTH} stroke={MOUTH_LINE} strokeWidth="1.6" />;
  if (mood === 'sorry') return <path d="M54 92Q60 86.5 66 92" fill="none" stroke={MOUTH_LINE} strokeWidth="2.4" strokeLinecap="round" />;
  if (mood === 'thinking') return <path d="M55 91Q58 89 60 91T65 90.5" fill="none" stroke={MOUTH_LINE} strokeWidth="2.2" strokeLinecap="round" />;
  const wide = ['laugh', 'dance', 'cool'].includes(mood);
  const w = wide ? 9 : 7.5;
  return (
    <g>
      <path d={`M${60 - w} 85.5Q60 86.5 ${60 + w} 85.5Q${59 + w} 96.5 60 97Q${61 - w} 96.5 ${60 - w} 85.5Z`} fill={MOUTH} stroke={MOUTH_LINE} strokeWidth="1.6" strokeLinejoin="round" />
      <path d="M55.5 92.5Q60 89.5 64.5 92.5Q62.5 96 60 96Q57.5 96 55.5 92.5Z" fill="#F59A8B" />
    </g>
  );
}

// Tay, vật cầm và hiệu ứng theo cảm xúc
function Pose({ mood, animated }) {
  const tw = animated ? 'nuti-twinkle' : undefined;
  const fl = animated ? 'nuti-float' : undefined;
  switch (mood) {
    case 'wave':
      return (
        <>
          <Arm x={30} y={86} r={22} />
          <Arm x={90} y={80} r={-155} className={cx(animated && 'nuti-wave')} style={{ transformOrigin: '0 0' }} />
          <g fill="none" stroke={ACCENT} strokeWidth="2" strokeLinecap="round">
            <path d="M110 52Q114 58 112 64" />
            <path d="M12 76Q8 82 10 88" />
          </g>
        </>
      );
    case 'laugh':
      return (
        <>
          <Fist x={31} y={92} />
          <Fist x={89} y={92} />
          <g stroke={ACCENT} strokeWidth="2.2" strokeLinecap="round">
            <path d="M24 52L19 47M30 47L28 41" />
            <path d="M96 52L101 47M90 47L92 41" />
          </g>
        </>
      );
    case 'love':
      return (
        <>
          <Heart x={60} y={101} s={1.55} />
          <path d="M53.5 94.5Q55 92.5 57.5 93" fill="none" stroke="#fff" strokeWidth="1.6" strokeLinecap="round" opacity="0.7" />
          <Fist x={45} y={101} rr={5.8} />
          <Fist x={75} y={101} rr={5.8} />
          <Heart x={20} y={52} s={0.7} className={fl} />
          <Heart x={102} y={56} s={0.6} className={fl} delay={0.8} />
          <Heart x={14} y={66} s={0.45} className={fl} delay={1.4} />
        </>
      );
    case 'wink':
      return (
        <>
          <Arm x={30} y={86} r={22} />
          <g transform="translate(94 92)">
            <rect x="-6" y="-6" width="12" height="12" rx="5" fill={LIMB} stroke={LIMB_DARK} strokeWidth="1.2" />
            <rect x="-2.2" y="-14" width="5.2" height="10" rx="2.6" fill={LIMB} stroke={LIMB_DARK} strokeWidth="1.2" />
          </g>
          <Sparkle x={100} y={46} s={1.1} className={tw} />
          <Sparkle x={108} y={60} s={0.6} className={tw} delay={0.6} />
        </>
      );
    case 'dance':
      return (
        <>
          <Fist x={22} y={70} />
          <Fist x={98} y={80} />
          <g fill="none" stroke={ACCENT} strokeWidth="2" strokeLinecap="round">
            <path d="M18 50Q14 46 18 42" />
            <path d="M104 50Q108 46 104 42" />
            <path d="M14 96Q12 104 16 110" />
            <path d="M106 96Q108 104 104 110" />
          </g>
        </>
      );
    case 'eat':
      return (
        <>
          {/* Hạt điều hình hạt đậu cong */}
          <path d="M44 100C43 92 50 88 56 91C59 92.5 61 95 64 95C67.5 95 70 91.5 74 91.5C80 91.5 82 97 79 102C75.5 108 67 111 59 110C51 109 44.5 106 44 100Z" fill="#F2C46D" stroke="#B07A2A" strokeWidth="1.4" strokeLinejoin="round" />
          <path d="M50 99Q56 104 66 103" fill="none" stroke="#fff" strokeWidth="1.4" strokeLinecap="round" opacity="0.55" />
          <Fist x={42} y={100} rr={5.6} />
          <Fist x={78} y={98} rr={5.6} />
          <Heart x={20} y={60} s={0.65} className={fl} />
        </>
      );
    case 'wow':
      return (
        <>
          <Fist x={40} y={98} rr={6} />
          <Fist x={80} y={98} rr={6} />
          <g fill={ACCENT}>
            <path d="M22 50L30 54L26 46Z" />
            <path d="M28 40L34 47L35 38Z" />
            <path d="M96 42L90 49L100 47Z" />
          </g>
        </>
      );
    case 'cool':
      return (
        <>
          <g transform="translate(22 92)">
            <rect x="-6" y="-6" width="12" height="12" rx="5" fill={LIMB} stroke={LIMB_DARK} strokeWidth="1.2" />
            <rect x="-16" y="-3.4" width="12" height="5.2" rx="2.6" fill={LIMB} stroke={LIMB_DARK} strokeWidth="1.2" />
          </g>
          <Arm x={90} y={86} r={-22} />
          <Sparkle x={102} y={50} s={1} className={tw} />
        </>
      );
    case 'touched':
      return (
        <>
          <Fist x={53} y={101} rr={5.6} />
          <Fist x={67} y={101} rr={5.6} />
          <g className={cx(animated && 'nuti-drip')}>
            <path d="M42 80C40 84 40 87 42.5 87.5C45 88 45.5 85 42 80Z" fill="#5DB7E8" />
            <path d="M78 80C76 84 76 87 78.5 87.5C81 88 81.5 85 78 80Z" fill="#5DB7E8" />
          </g>
          <Sparkle x={100} y={48} s={0.9} className={tw} />
          <Heart x={104} y={68} s={0.55} className={fl} delay={0.5} />
        </>
      );
    case 'thinking':
      return (
        <>
          <Arm x={30} y={86} r={22} />
          <path d="M91 94C88 104 80 110 71 109" fill="none" stroke={LIMB_DARK} strokeWidth="8.4" strokeLinecap="round" />
          <path d="M91 94C88 104 80 110 71 109" fill="none" stroke={LIMB} strokeWidth="6" strokeLinecap="round" />
          <Fist x={66} y={106} rr={5.6} />
          <text x="96" y="46" fontSize="22" fontWeight="800" fill="#3D7A26" fontFamily="'Nunito Sans Variable', 'Nunito Sans', sans-serif" className={tw} style={{ transformBox: 'fill-box', transformOrigin: 'center' }}>
            ?
          </text>
        </>
      );
    case 'sorry':
      return (
        <>
          <Arm x={31} y={88} r={10} />
          <Arm x={89} y={88} r={-10} />
        </>
      );
    default:
      return (
        <>
          <Arm x={30} y={86} r={22} />
          <Arm x={90} y={86} r={-22} />
        </>
      );
  }
}

export default function Nuti({ mood = 'happy', size = 96, animated = true, className = '', label }) {
  const uid = useId().replace(/:/g, '');
  const dance = mood === 'dance';
  return (
    <svg
      viewBox="0 0 120 138"
      width={size}
      height={size}
      className={cx('shrink-0 overflow-visible', className)}
      role={label ? 'img' : undefined}
      aria-label={label}
      aria-hidden={label ? undefined : true}
    >
      <defs>
        <radialGradient id={`body-${uid}`} cx="42%" cy="36%" r="70%">
          <stop offset="0" stopColor="#FFF8EA" />
          <stop offset="0.7" stopColor="#F8E6C6" />
          <stop offset="1" stopColor="#EFD3A4" />
        </radialGradient>
        <linearGradient id={`leaf-${uid}`} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#7CC24C" />
          <stop offset="1" stopColor="#3F8C2A" />
        </linearGradient>
      </defs>

      {/* Bóng đổ dưới chân */}
      <ellipse cx="60" cy="131" rx="30" ry="4.5" fill="#E3D2AE" opacity="0.6" />

      <g className={cx(animated && (dance ? 'nuti-jump' : 'nuti-bob'))}>
        {/* Chân */}
        {dance ? (
          <g fill={LIMB} stroke={LIMB_DARK} strokeWidth="1.2" strokeLinejoin="round">
            <path d="M44 104L36 116C34 119 36 123 40 122L49 120C52 119 52 116 50 114L52 106Z" />
            <path d="M74 104L84 112C87 114 86 118 83 119L74 121C71 121 70 118 71 116L68 106Z" />
          </g>
        ) : (
          <g fill={LIMB} stroke={LIMB_DARK} strokeWidth="1.2" strokeLinejoin="round">
            <path d="M43 104H54V119C54 123 50 125.5 45 125.5C40 125.5 37.5 123.5 38 121C38.5 119 41 118 43 118Z" />
            <path d="M77 104H66V119C66 123 70 125.5 75 125.5C80 125.5 82.5 123.5 82 121C81.5 119 79 118 77 118Z" />
          </g>
        )}

        {/* Thân hạt */}
        <circle cx="60" cy="78" r="34.5" fill={`url(#body-${uid})`} stroke={OUTLINE} strokeWidth="2.6" />
        <ellipse cx="46" cy="58" rx="11" ry="6" fill="#fff" opacity="0.35" transform="rotate(-28 46 58)" />

        {/* Má hồng + mũi */}
        <ellipse cx="38.5" cy="85" rx="6.2" ry="4" fill="#F6A28F" opacity="0.75" />
        <ellipse cx="81.5" cy="85" rx="6.2" ry="4" fill="#F6A28F" opacity="0.75" />
        {mood !== 'cool' && <ellipse cx="60" cy="80.5" rx="1.3" ry="1" fill="#B07A47" />}

        <Eyes mood={mood} animated={animated} />
        <Mouth mood={mood} />
        <Pose mood={mood} animated={animated} />

        {/* Mầm 2 lá */}
        <g className={cx(animated && 'nuti-sprout')} style={{ transformOrigin: '60px 44px' }}>
          <path d="M60 45C60 41 60.5 38 61.5 35" fill="none" stroke="#3D7A26" strokeWidth="3" strokeLinecap="round" />
          <path d="M60.5 37C52 22.5 38 16 25 19.5C29 32.5 44 40.5 60.5 37Z" fill={`url(#leaf-${uid})`} stroke="#2E6420" strokeWidth="1.8" strokeLinejoin="round" />
          <path d="M58.5 35.5C49 29.5 39 25 29.5 21.5" fill="none" stroke="#A6D97A" strokeWidth="1.3" strokeLinecap="round" opacity="0.8" />
          <path d="M62 35.5C66 19.5 80 11 95.5 12.5C93.5 28 79 37.5 62 35.5Z" fill={`url(#leaf-${uid})`} stroke="#2E6420" strokeWidth="1.8" strokeLinejoin="round" />
          <path d="M64 34C71.5 26.5 81 19.5 91.5 15" fill="none" stroke="#A6D97A" strokeWidth="1.3" strokeLinecap="round" opacity="0.8" />
        </g>
      </g>
    </svg>
  );
}
