// "Nuti" — linh vật NUTRIVA: hạt óc chó có mầm lá (màu lá lấy từ logo).
// mood: 'happy' | 'wave' | 'thinking' | 'sorry'. animated: nhún nhẹ, chớp mắt, lá đung đưa (tắt khi người dùng bật giảm chuyển động).
import { cx } from '../ds/index.jsx';

const SHELL = '#C38D55';
const SHELL_DARK = '#9C6532';
const FACE = '#E6BE8A';
const INK = '#3A2615';

export default function Nuti({ mood = 'happy', size = 96, animated = true, className = '', label }) {
  const look = mood === 'thinking' ? { x: 2, y: -3 } : mood === 'sorry' ? { x: 0, y: 2 } : { x: 0, y: 0 };
  return (
    <svg
      viewBox="0 0 120 124"
      width={size}
      height={size}
      className={cx('shrink-0 overflow-visible', animated && 'nuti-bob', className)}
      role={label ? 'img' : undefined}
      aria-label={label}
      aria-hidden={label ? undefined : true}
    >
      {/* Bóng đổ */}
      <ellipse cx="60" cy="118" rx="30" ry="4" fill="#14211B" opacity="0.08" />

      {/* Chân */}
      <ellipse cx="47" cy="110" rx="9" ry="5" fill={SHELL_DARK} />
      <ellipse cx="73" cy="110" rx="9" ry="5" fill={SHELL_DARK} />

      {/* Tay trái */}
      <ellipse cx="20" cy="76" rx="7" ry="10" fill={SHELL_DARK} transform="rotate(-18 20 76)" />
      {/* Tay phải: vẫy khi chào */}
      <g className={cx(mood === 'wave' && animated && 'nuti-wave')} style={{ transformOrigin: '96px 72px' }}>
        {mood === 'wave' ? (
          <ellipse cx="105" cy="58" rx="7" ry="11" fill={SHELL_DARK} transform="rotate(28 105 58)" />
        ) : (
          <ellipse cx="100" cy="76" rx="7" ry="10" fill={SHELL_DARK} transform="rotate(18 100 76)" />
        )}
      </g>

      {/* Vỏ óc chó */}
      <path
        d="M60 20C64 22 70 23 76 25C92 31 101 47 101 66C101 91 83 108 60 108C37 108 19 91 19 66C19 47 28 31 44 25C50 23 56 22 60 20Z"
        fill={SHELL}
      />
      {/* Ánh sáng */}
      <ellipse cx="42" cy="42" rx="10" ry="6" fill="#fff" opacity="0.22" transform="rotate(-30 42 42)" />
      {/* Rãnh vỏ */}
      <g fill="none" stroke={SHELL_DARK} strokeWidth="2.4" strokeLinecap="round" opacity="0.75">
        <path d="M60 23C56 30 64 36 60 44" />
        <path d="M30 48C35 45 39 51 45 47" />
        <path d="M24 66C29 63 33 69 38 65" />
        <path d="M30 88C34 85 38 90 42 87" />
        <path d="M90 48C85 45 81 51 75 47" />
        <path d="M96 66C91 63 87 69 82 65" />
        <path d="M90 88C86 85 82 90 78 87" />
      </g>

      {/* Mặt (phần nhân hạt) */}
      <ellipse cx="60" cy="76" rx="27" ry="21" fill={FACE} />
      {/* Má hồng */}
      <ellipse cx="41" cy="83" rx="5" ry="3" fill="#F29C8A" opacity="0.7" />
      <ellipse cx="79" cy="83" rx="5" ry="3" fill="#F29C8A" opacity="0.7" />

      {/* Mắt */}
      <g className={cx(animated && mood !== 'sorry' && 'nuti-blink')} style={{ transformOrigin: '60px 72px' }}>
        {mood === 'sorry' ? (
          <g fill="none" stroke={INK} strokeWidth="2.6" strokeLinecap="round">
            <path d="M46 73Q50 76 54 73" />
            <path d="M66 73Q70 76 74 73" />
          </g>
        ) : (
          <g transform={`translate(${look.x} ${look.y})`}>
            <ellipse cx="50" cy="72" rx="4.4" ry="5.4" fill={INK} />
            <ellipse cx="70" cy="72" rx="4.4" ry="5.4" fill={INK} />
            <circle cx="51.6" cy="70" r="1.6" fill="#fff" />
            <circle cx="71.6" cy="70" r="1.6" fill="#fff" />
          </g>
        )}
      </g>

      {/* Miệng */}
      {mood === 'thinking' ? (
        <circle cx="63" cy="86" r="2.6" fill={INK} />
      ) : mood === 'sorry' ? (
        <path d="M54 88Q60 83 66 88" fill="none" stroke={INK} strokeWidth="2.6" strokeLinecap="round" />
      ) : (
        <path d="M52 83Q60 92 68 83Q60 87 52 83Z" fill="#7A3B26" stroke="#7A3B26" strokeWidth="1.6" strokeLinejoin="round" />
      )}

      {/* Mầm lá trên đầu (màu logo) */}
      <g className={cx(animated && 'nuti-sprout')} style={{ transformOrigin: '60px 21px' }}>
        <path d="M60 21C60 15 61 11 63 7" fill="none" stroke="#567324" strokeWidth="2.6" strokeLinecap="round" />
        <path d="M60.5 14C51 6 42 8 39.5 13C47 18 55 18 60.5 14Z" fill="#7CA034" />
        <path d="M62.5 9.5C70 1 80 2 83 6C77 12 69 13.5 62.5 9.5Z" fill="#A7C65E" />
      </g>

      {/* Bong bóng suy nghĩ */}
      {mood === 'thinking' && (
        <g fill="#fff" stroke="#DEE6E1" strokeWidth="1.5">
          <circle cx="100" cy="38" r="3" />
          <circle cx="108" cy="27" r="5" />
        </g>
      )}
    </svg>
  );
}
