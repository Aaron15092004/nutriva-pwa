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

  teal: {
    light: '#E8F8F4',
    soft: '#C8EFE6',
    pastel: '#96DFD0',
    accent: '#5FCAB7',
    main: '#168E79',
    dark: '#087461',
    deep: '#075C4E',
    core: '#06382F',
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
  breakfast: { card: '#B7E5D8' },
  lunch: { card: '#F9C4A0' },
  dinner: { card: '#AACFE8', track: '#C5DEF0', hint: '#1A5C80' },
  snacks: { card: '#F5D97A', track: '#FFE7A0', hint: '#7A4800' },
  weekday: '#E3E2F0',
  nav: { inactive: '#5A5A5A', text: '#565B63' },
  recipe: '#2F8F5B',
};

export const fonts = {
  sans: ['"Nunito Sans"', 'system-ui', '-apple-system', '"Segoe UI"', 'Roboto', 'sans-serif'],
  secondary: ['Inter', 'system-ui', 'sans-serif'],
  display: ['Fraunces', 'Georgia', 'serif'], // tiêu đề, quảng cáo
  script: ['"Dancing Script"', 'cursive'], // slogan ngắn
};
