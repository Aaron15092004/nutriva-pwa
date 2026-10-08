// NUTRIVA color system — nguồn màu duy nhất cho Tailwind (tailwind.config.js) và JS (vòng tiến độ, SVG).
export const colors = {
  // Neutrals
  background: '#F8FAF8',
  white: '#FFFFFF',
  surface: '#EFF3F0',
  border: '#DEE6E1',
  divider: '#C6D2CB',
  muted: '#5E6D65', // Muted text
  subtle: '#6B7A72', // Secondary text
  secondary: '#35443D',
  primary: '#14211B',
  dark: '#101114', // Dark text
  black: '#000000',

  // Màu thương hiệu — lấy từ logo NUTRIVA (xanh lá ô liu). Chữ trên nền trắng dùng dark trở lên (≥ 4.5:1);
  // main chỉ dùng cho icon, viền, thanh tiến độ (3:1).
  brand: {
    light: '#F2F7E7',
    soft: '#DCEBC2',
    pastel: '#C2DB8E',
    accent: '#A7C65E', // lá nhạt trong logo
    main: '#7CA034', // logo
    dark: '#567324', // logo — hành động chính
    deep: '#435A1C',
    core: '#2F4B23', // màu chữ NUTRIVA
  },
  warm: {
    light: '#FFF3EC',
    soft: '#FFDCCB',
    accent: '#FFAA7C',
    main: '#F47A3D',
    dark: '#B94719',
  },
  cookie: '#B66A0E',

  // Trạng thái (nền)
  success: '#E8F6EE',
  warning: '#FFF4DE',
  error: '#FDECEE',
  info: '#EAF4FA',

  // Theo ngữ cảnh
  water: { card: '#D6EAF8', icon: '#2679A8' },
  torch: { card: '#FFE5D0' },
  breakfast: { card: '#D5E7B5' },
  lunch: { card: '#F9C4A0' },
  dinner: { card: '#AACFE8', track: '#C5DEF0', hint: '#1A5C80' },
  snacks: { card: '#F5D97A', track: '#FFE7A0', hint: '#7A4800' },
  weekday: '#E3E2F0',
  nav: { inactive: '#5A5A5A', text: '#565B63' },
  recipe: '#4A7A26',
};

export const fonts = {
  sans: ['"Nunito Sans"', 'system-ui', '-apple-system', '"Segoe UI"', 'Roboto', 'sans-serif'],
  secondary: ['Inter', 'system-ui', 'sans-serif'],
  display: ['Fraunces', 'Georgia', 'serif'], // tiêu đề, quảng cáo
  script: ['"Dancing Script"', 'cursive'], // slogan ngắn
};
