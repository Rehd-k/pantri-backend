import type { ActivityLevel } from '../../generated/prisma/client';
import type { CanonicalNutrition } from '../common/nutrition-facts';

export type TargetInput = {
  age: number;
  gender: string;
  heightCm: number;
  weightKg: number;
  activityLevel: ActivityLevel;
  goalSlugs: string[];
};

function activityMultiplier(level: ActivityLevel): number {
  switch (level) {
    case 'SEDENTARY':
      return 1.2;
    case 'VERY_ACTIVE':
      return 1.725;
    default:
      return 1.55;
  }
}

function bmrKcal(input: TargetInput): number {
  const base = 10 * input.weightKg + 6.25 * input.heightCm - 5 * input.age;
  const gender = input.gender.trim().toLowerCase();
  if (gender.startsWith('m')) return base + 5;
  if (gender.startsWith('f') || gender.startsWith('w')) return base - 161;
  return base - 78;
}

export function computeDailyTargets(input: TargetInput): CanonicalNutrition {
  const slugs = input.goalSlugs.map((s) => s.toLowerCase());
  const weightLoss = slugs.some((s) => s.includes('weight-loss') || s.includes('weight loss'));
  const muscle = slugs.some((s) => s.includes('muscle'));
  const gut = slugs.some((s) => s.includes('gut'));
  const energy = slugs.some((s) => s.includes('energy'));

  let calorieFactor = 1;
  let proteinPerKg = 1.2;
  if (weightLoss) {
    calorieFactor = 0.85;
    proteinPerKg = 1.6;
  }
  if (muscle) {
    calorieFactor = 1.1;
    proteinPerKg = 2.0;
  }
  if (energy && !weightLoss && !muscle) {
    calorieFactor = 1.05;
    proteinPerKg = 1.4;
  }

  const energyKcal = Math.max(
    1200,
    Math.round(bmrKcal(input) * activityMultiplier(input.activityLevel) * calorieFactor),
  );
  const proteinMg = Math.round(input.weightKg * proteinPerKg * 1000);
  const fatMg = Math.round(((energyKcal * 0.28) / 9) * 1000);
  const proteinKcal = (proteinMg / 1000) * 4;
  const fatKcal = (fatMg / 1000) * 9;
  const carbsKcal = Math.max(0, energyKcal - proteinKcal - fatKcal);
  const carbsMg = Math.round((carbsKcal / 4) * 1000);

  return {
    energyKcal,
    proteinMg,
    carbsMg,
    fatMg,
    fiberMg: gut ? 35_000 : 28_000,
    sugarMg: weightLoss ? 25_000 : 50_000,
    sodiumMg: 2300,
    ironUg: input.gender.trim().toLowerCase().startsWith('m') ? 8_000 : 18_000,
  };
}
