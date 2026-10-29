// Đồ họa thương hiệu dùng chung (JS thuần, không JSX): màu từng vị sữa, hình sữa bắn dạng vương miện, hạt nguyên liệu.
// Dùng cho banner trang chủ, sheet dùng thử, thẻ thành viên và script dựng ảnh bìa kế hoạch (chạy bằng Node).

// Màu lấy từ nhãn & màu sữa thật của từng chai
export const FLAVORS = {
  'mach-nhien': { name: 'Mạch Nhiên', milk: '#F7EEDA', shade: '#DCC596', bg: ['#FFF6DF', '#F7D98F'], ink: '#5C3F0E', chip: '#FFF9EA', nuts: ['oat', 'walnut', 'almond'] },
  'sen-thanh': { name: 'Sen Thanh', milk: '#F8F2E2', shade: '#DCCFA6', bg: ['#FDF8E4', '#E9E2A2'], ink: '#4F4E12', chip: '#FFFCEB', nuts: ['cashew', 'pumpkin', 'lotus'] },
  'sen-com': { name: 'Sen Cốm', milk: '#E6EDC9', shade: '#BCCB86', bg: ['#F2F8E1', '#C9E099'], ink: '#35511A', chip: '#F7FBEA', nuts: ['lotus', 'com', 'almond'] },
  'lut-thanh': { name: 'Lứt Thanh', milk: '#F3DACA', shade: '#D6A084', bg: ['#FFF0E7', '#F5BFA0'], ink: '#7A2F10', chip: '#FFF6F0', nuts: ['rice', 'almond', 'cashew'] },
  'nau-moc': { name: 'Nâu Mộc', milk: '#E2C2AC', shade: '#AF7B5C', bg: ['#F9ECE2', '#D9AE8E'], ink: '#55280F', chip: '#FCF4EE', nuts: ['cacao', 'cashew', 'oat'] },
  'huyen-moc': { name: 'Huyền Mộc', milk: '#C5BEBB', shade: '#8A7F7C', bg: ['#F1F0FB', '#C4C1EA'], ink: '#2C2966', chip: '#F7F6FD', nuts: ['bean', 'sesame', 'rice'] },
};
export const LINES = Object.keys(FLAVORS);
export const flavorOf = (line) => FLAVORS[line] ?? FLAVORS['mach-nhien'];
export const bottleSrc = (line) => `/img/products/hero-${FLAVORS[line] ? line : 'mach-nhien'}.webp`;

// PRNG có hạt giống → hình sữa bắn giống nhau giữa các lần render
function rng(seed) {
  let s = (seed * 9301 + 49297) % 233280 || 1;
  return () => {
    s = (s * 9301 + 49297) % 233280;
    return s / 233280;
  };
}
const f1 = (n) => (Math.round(n * 10) / 10).toString();

// Một nhánh sữa nhọn mọc lên từ mép (x0, y0): thân thon dần, đầu tròn, có giọt tách ra ở đỉnh
function spike(x0, y0, h, w, lean) {
  const tx = x0 + lean;
  const ty = y0 - h;
  const neck = Math.max(2.2, w * 0.13);
  return [
    `M${f1(x0 - w / 2)} ${f1(y0)}`,
    `C${f1(x0 - w * 0.12)} ${f1(y0)} ${f1(tx - neck * 1.3)} ${f1(y0 - h * 0.45)} ${f1(tx - neck)} ${f1(ty + neck * 1.6)}`,
    `A${f1(neck)} ${f1(neck * 1.15)} 0 0 1 ${f1(tx + neck)} ${f1(ty + neck * 1.6)}`,
    `C${f1(tx + neck * 1.3)} ${f1(y0 - h * 0.45)} ${f1(x0 + w * 0.12)} ${f1(y0)} ${f1(x0 + w / 2)} ${f1(y0)}`,
    'Z',
  ].join(' ');
}

// Sữa bắn dạng vương miện trong khung 320 × 210. Lớp sau (thành trong, nằm sau chai) và lớp trước (che đáy chai, loang thành vũng sữa).
// Mép trước ở giữa cao khoảng y ≈ 128 → đặt đáy phần chai cần che dưới mức này.
export const SPLASH_VIEW = { w: 320, h: 210, frontTop: 128 / 210 };
export function crown(seed = 3) {
  const r = rng(seed);
  const cx = 160;
  const cy = 150;
  const rx = 128;
  const ry = 22;
  const arc = (x, sign) => cy + sign * ry * Math.sqrt(Math.max(0, 1 - ((x - cx) / rx) ** 2));
  const xs = [];
  for (let x = cx - rx; x <= cx + rx + 0.1; x += 8) xs.push(x);

  // Lớp sau: mép trên gợn sóng cao hơn vành sau 14–22px
  const backTop = xs.map((x, i) => [x, arc(x, -1) - 15 - 6 * Math.sin(i * 0.9 + seed) * Math.sin((Math.PI * (x - cx + rx)) / (2 * rx))]);
  const back = [`M${f1(cx - rx)} ${f1(cy)}`, ...backTop.map(([x, y]) => `L${f1(x)} ${f1(y)}`), `L${f1(cx + rx)} ${f1(cy)}`, ...xs.slice().reverse().map((x) => `L${f1(x)} ${f1(arc(x, 1) - 6)}`), 'Z'].join(' ');
  const backSpikes = [];
  const backDrops = [];
  [0.06, 0.17, 0.3, 0.44, 0.58, 0.71, 0.84, 0.95].forEach((t, i) => {
    const x = cx - rx + t * 2 * rx;
    const y = arc(x, -1) - 12;
    const tall = [34, 64, 82, 76, 74, 86, 62, 30][i] * (0.85 + r() * 0.3);
    const lean = ((x - cx) / rx) * (8 + r() * 8);
    backSpikes.push(spike(x, y + 4, tall, 20 + r() * 10, lean));
    if (i % 2 === 1 || r() > 0.6) backDrops.push({ x: x + lean * 1.4, y: y - tall - 7 - r() * 9, r: 3 + r() * 2.6 });
  });

  // Lớp trước: mép trên (vành trước nâng lên 24–30px) + nhánh thấp, phía dưới loang rộng ra thành vũng sữa
  const frontLift = (x) => 22 + 8 * Math.cos(((x - cx) / rx) * Math.PI * 0.5);
  const frontTop = xs.map((x, i) => [x, arc(x, 1) - frontLift(x) - 3 * Math.sin(i * 1.3 + seed * 2)]);
  const front = [
    `M${f1(cx - rx)} ${f1(cy - 4)}`,
    ...frontTop.map(([x, y]) => `L${f1(x)} ${f1(y)}`),
    `L${f1(cx + rx)} ${f1(cy - 4)}`,
    `C${f1(cx + rx + 14)} ${f1(cy + 18)} ${f1(cx + rx + 40)} 196 342 210`,
    'L-22 210',
    `C${f1(cx - rx - 40)} 196 ${f1(cx - rx - 14)} ${f1(cy + 18)} ${f1(cx - rx)} ${f1(cy - 4)}`,
    'Z',
  ].join(' ');
  const frontSpikes = [];
  const frontDrops = [];
  [0.03, 0.15, 0.3, 0.5, 0.7, 0.85, 0.97].forEach((t, i) => {
    const x = cx - rx + t * 2 * rx;
    const y = arc(x, 1) - frontLift(x) + 3;
    const tall = [24, 42, 26, 16, 28, 44, 22][i] * (0.85 + r() * 0.3);
    const lean = ((x - cx) / rx) * (10 + r() * 6);
    frontSpikes.push(spike(x, y, tall, 16 + r() * 9, lean));
    if (i === 1 || i === 5 || r() > 0.75) frontDrops.push({ x: x + lean * 1.5, y: y - tall - 6 - r() * 6, r: 2.4 + r() * 2 });
  });

  // Vệt sáng chạy dọc mép trước & trên vài nhánh → cảm giác sữa bóng, có khối
  const hl = (from, to) => frontTop.filter(([x]) => x >= cx - rx + from * 2 * rx && x <= cx - rx + to * 2 * rx).map(([x, y], i) => `${i ? 'L' : 'M'}${f1(x)} ${f1(y + 5)}`).join(' ');
  const highlights = [hl(0.08, 0.36), hl(0.58, 0.82)];
  const gloss = backSpikes.filter((_, i) => i === 2 || i === 5).map((_, i) => {
    const t = [0.3, 0.71][i];
    const x = cx - rx + t * 2 * rx;
    const y = arc(x, -1) - 12;
    return `M${f1(x - 4)} ${f1(y - 6)} Q${f1(x - 5)} ${f1(y - 26)} ${f1(x - 1)} ${f1(y - 42)}`;
  });
  return { back, backSpikes, backDrops, front, frontSpikes, frontDrops, highlights, gloss };
}

// Giọt sữa bay quanh chai (toạ độ % của khung cảnh; s = cỡ px ở khung chai cao 260px)
export const FLYING_DROPS = [
  { x: 6, y: 50, s: 9, d: 0 },
  { x: 14, y: 24, s: 6, d: 1 },
  { x: 2, y: 70, s: 5, d: 2 },
  { x: 88, y: 40, s: 10, d: 1 },
  { x: 96, y: 62, s: 6, d: 0 },
  { x: 82, y: 16, s: 5, d: 2 },
  { x: 24, y: 6, s: 4, d: 1 },
];

// Hạt nguyên liệu vẽ tay (khung 48 × 48). Chuỗi SVG để dùng được cả trong React lẫn khi dựng ảnh bằng Node.
export const NUTS = {
  almond:
    '<path d="M24 3c10 7 15 20 11 32-2 7-8 10-11 10s-9-3-11-10C9 23 14 10 24 3z" fill="#B97A43"/><path d="M24 3c10 7 15 20 11 32-2 7-8 10-11 10 4-9 5-27 0-42z" fill="#9A5F30"/><path d="M19 14c-1 6-1 13 1 20M27 12c2 7 2 15 0 23" stroke="#7E4A24" stroke-width="1.2" stroke-linecap="round" fill="none" opacity=".55"/><path d="M17 12c2-3 4-5 6-7" stroke="#E7B987" stroke-width="2" stroke-linecap="round" opacity=".7"/>',
  walnut:
    '<path d="M24 6c6-3 13 0 15 6 4 2 6 8 4 13 2 6-1 12-7 14-3 4-9 5-12 3-4 2-10 1-12-3-6-2-9-8-7-14-2-5 0-11 4-13 2-6 9-9 15-6z" fill="#B47B45"/><path d="M24 6v37" stroke="#8A5527" stroke-width="2" stroke-linecap="round"/><path d="M14 14c4 2 4 6 1 8s-2 7 2 8M34 14c-4 2-4 6-1 8s2 7-2 8M12 26c3 0 5 2 4 5M36 26c-3 0-5 2-4 5" stroke="#8A5527" stroke-width="1.6" stroke-linecap="round" fill="none"/><path d="M15 10c2-2 4-3 6-3" stroke="#DDAA75" stroke-width="2" stroke-linecap="round"/>',
  oat:
    '<g transform="rotate(28 24 24)"><ellipse cx="24" cy="24" rx="7.5" ry="17" fill="#EBD5A3"/><path d="M24 8v32" stroke="#CDAC6C" stroke-width="1.4" stroke-linecap="round"/><ellipse cx="21" cy="17" rx="2" ry="6" fill="#F8EBCB" opacity=".8"/></g>',
  cashew:
    '<path d="M12 12c9-8 25-5 29 8 3 10-2 20-10 21-6 1-8-5-5-9 3-3 4-8 1-11-3-4-9-3-12 1-3 3-7 2-6-2 0-3 1-6 3-8z" fill="#EFD29E"/><path d="M31 41c-6 1-8-5-5-9 3-3 4-8 1-11 6 2 9 9 8 14-1 3-2 5-4 6z" fill="#D9B473"/><path d="M15 12c4-3 9-4 13-3" stroke="#FBEBCB" stroke-width="2.4" stroke-linecap="round"/>',
  pumpkin:
    '<g transform="rotate(-24 24 24)"><path d="M24 4c8 6 11 14 11 21S30 41 24 44c-6-3-11-12-11-19S16 10 24 4z" fill="#9DB563"/><path d="M24 8c5 5 7 11 7 17s-3 12-7 15c-4-3-7-9-7-15s2-12 7-17z" fill="#B9CC82"/><path d="M24 10v28" stroke="#88A04F" stroke-width="1.2" opacity=".6"/></g>',
  lotus:
    '<circle cx="24" cy="25" r="15" fill="#F3E9CF"/><circle cx="24" cy="25" r="15" fill="none" stroke="#D9C79A" stroke-width="1.4"/><path d="M24 12c-3 0-4 2-3 4h6c1-2 0-4-3-4z" fill="#B99A5B"/><ellipse cx="19" cy="20" rx="4" ry="6" fill="#FFF9E8" opacity=".75"/>',
  com:
    '<path d="M9 22c4-7 12-6 14-1 1 4-3 8-8 8-4 0-8-3-6-7z" fill="#A9C567"/><path d="M26 13c5-5 13-2 13 4 0 5-5 7-9 6-5-1-7-6-4-10z" fill="#BFD584"/><path d="M24 32c4-4 11-3 12 2 1 5-4 8-8 7-5 0-7-5-4-9z" fill="#94B455"/><path d="M12 22c2-2 5-3 7-2M29 15c2-2 5-2 7 0" stroke="#E2EDB8" stroke-width="1.6" stroke-linecap="round" fill="none"/>',
  rice:
    '<g transform="rotate(-35 24 24)"><ellipse cx="24" cy="24" rx="6.5" ry="14" fill="#A55A37"/><ellipse cx="22" cy="19" rx="2" ry="5.5" fill="#CE8A63" opacity=".8"/></g><g transform="rotate(30 34 32)"><ellipse cx="34" cy="32" rx="4.5" ry="10" fill="#8F4A2C"/></g>',
  cacao:
    '<g transform="rotate(-20 24 24)"><ellipse cx="24" cy="24" rx="12" ry="17" fill="#5C3421"/><path d="M24 8c-3 6-3 26 0 32" stroke="#7F4D33" stroke-width="2.2" stroke-linecap="round" fill="none"/><ellipse cx="18" cy="17" rx="3" ry="6" fill="#8A5A40" opacity=".7"/></g>',
  bean:
    '<g transform="rotate(18 24 24)"><ellipse cx="24" cy="24" rx="12" ry="15" fill="#26212A"/><ellipse cx="29" cy="24" rx="2.2" ry="5" fill="#E9E5EE"/><ellipse cx="18" cy="17" rx="3" ry="5" fill="#57505E" opacity=".8"/></g>',
  sesame:
    '<path d="M14 10c4 2 5 8 2 11-3-1-5-7-2-11z" fill="#2E2A2B"/><path d="M30 16c4 3 4 9 0 11-3-2-4-8 0-11z" fill="#3A3536"/><path d="M20 30c5 1 7 7 4 10-4-1-6-6-4-10z" fill="#2E2A2B"/>',
  leaf:
    '<path d="M6 40C8 20 22 8 42 6c0 20-12 34-36 34z" fill="#8DB24B"/><path d="M8 38C16 28 26 18 38 10" stroke="#5F8A2C" stroke-width="2" stroke-linecap="round" fill="none"/>',
};
