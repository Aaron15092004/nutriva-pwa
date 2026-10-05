import { colors, fonts } from './src/theme/tokens.js';

// Lưới 8pt: dùng các bước chẵn của thang mặc định (2 = 8px, 4 = 16px, 6 = 24px…); 1 = 4px chỉ cho chi tiết nhỏ.
/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors,
      fontFamily: fonts,
      fontSize: {
        // [size, lineHeight] — line-height theo bội số 4/8
        '2xs': ['10px', '12px'],
        xs: ['12px', '16px'],
        sm: ['14px', '20px'],
        base: ['16px', '24px'],
        lg: ['18px', '24px'],
        xl: ['20px', '28px'],
        '2xl': ['24px', '32px'],
        '3xl': ['28px', '36px'],
        '4xl': ['32px', '40px'],
      },
      borderRadius: {
        sm: '8px',
        md: '12px',
        lg: '16px',
        xl: '24px',
        '2xl': '32px',
      },
      boxShadow: {
        card: '0 2px 8px rgba(20, 33, 27, 0.06)',
        pill: '0 2px 4px rgba(20, 33, 27, 0.07)',
        float: '0 8px 16px rgba(20, 33, 27, 0.16)',
        fab: '0 8px 16px rgba(0, 0, 0, 0.24)',
      },
      maxWidth: { app: '480px' },
      transitionTimingFunction: { out: 'cubic-bezier(0.22, 1, 0.36, 1)' },
    },
  },
  plugins: [],
};
