import { EggFried, Soup, UtensilsCrossed, Cookie } from 'lucide-react';
import { colors } from './tokens.js';

// Theme màu cho từng bữa — dùng chung cho thẻ bữa ăn, sheet, thumbnail kế hoạch.
// Class Tailwind viết đầy đủ để JIT nhận diện được.
export const MEAL_THEME = {
  breakfast: {
    icon: EggFried,
    card: 'bg-breakfast-card',
    track: 'bg-brand-soft',
    fill: 'bg-brand-main',
    hint: 'text-brand-deep',
    iconColor: 'text-brand-deep',
    bg: colors.breakfast.card,
    fg: colors.brand.deep,
  },
  lunch: {
    icon: Soup,
    card: 'bg-lunch-card',
    track: 'bg-warm-light',
    fill: 'bg-warm-dark',
    hint: 'text-warm-dark',
    iconColor: 'text-warm-dark',
    bg: colors.lunch.card,
    fg: colors.warm.dark,
  },
  dinner: {
    icon: UtensilsCrossed,
    card: 'bg-dinner-card',
    track: 'bg-dinner-track',
    fill: 'bg-water-icon',
    hint: 'text-dinner-hint',
    iconColor: 'text-dinner-hint',
    bg: colors.dinner.card,
    fg: colors.dinner.hint,
  },
  snack: {
    icon: Cookie,
    card: 'bg-snacks-card',
    track: 'bg-snacks-track',
    fill: 'bg-cookie',
    hint: 'text-snacks-hint',
    iconColor: 'text-cookie',
    bg: colors.snacks.card,
    fg: colors.snacks.hint,
  },
};
