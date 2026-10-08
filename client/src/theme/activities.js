import { Trophy, Target, Waves, Snowflake, Dumbbell, Flower2, Mountain, Swords, House, HeartPulse } from 'lucide-react';

// Nhóm hoạt động thể chất → icon + màu (class Tailwind đầy đủ để JIT nhận diện)
export const ACTIVITY_CATEGORIES = {
  cardio: { label: 'Tim mạch', icon: HeartPulse, tile: 'bg-warm-light text-warm-main' },
  team: { label: 'Thể thao đồng đội', icon: Trophy, tile: 'bg-brand-light text-brand-dark' },
  racket: { label: 'Thể thao dùng vợt', icon: Target, tile: 'bg-breakfast-card text-brand-deep' },
  water: { label: 'Dưới nước', icon: Waves, tile: 'bg-water-card text-water-icon' },
  winter: { label: 'Trên băng tuyết', icon: Snowflake, tile: 'bg-info text-dinner-hint' },
  fitness: { label: 'Thể hình', icon: Dumbbell, tile: 'bg-torch-card text-warm-dark' },
  mind: { label: 'Thân – tâm', icon: Flower2, tile: 'bg-success text-recipe' },
  outdoor: { label: 'Ngoài trời', icon: Mountain, tile: 'bg-brand-soft text-brand-deep' },
  combat: { label: 'Võ thuật', icon: Swords, tile: 'bg-error text-warm-dark' },
  daily: { label: 'Sinh hoạt', icon: House, tile: 'bg-warning text-snacks-hint' },
};

export const categoryOf = (c) => ACTIVITY_CATEGORIES[c] ?? ACTIVITY_CATEGORIES.fitness;

// Chữ cái nhóm theo tiếng Việt (Đ xếp chung D như mẫu)
export const groupLetter = (name) =>
  name
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[đĐ]/g, 'D')
    .charAt(0)
    .toUpperCase();

export const activityKcal = (met, weightKg, minutes) => Math.round(met * weightKg * ((Number(minutes) || 0) / 60));
