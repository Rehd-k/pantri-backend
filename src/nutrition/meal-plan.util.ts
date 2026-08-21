import { REQUIRED_MEAL_SLOTS } from './dto/meal-plan.dto';
import type {
  CompletenessGapDto,
  MealPlanCompletenessDto,
} from './dto/meal-plan.dto';

export type CompletenessItem = {
  id: string;
  mealSlot: string;
  productId: string | null;
  recipeId: string | null;
  instructions?: string | null;
  instructionSteps?: string[];
  ingredientCount?: number;
  cookedAt?: Date | null;
};

export type CompletenessDay = {
  id: string;
  planDate: Date | string | null;
  items: CompletenessItem[];
};

export function utcDateOnly(value: string | Date): Date {
  const date = typeof value === 'string' ? new Date(value) : value;
  return new Date(
    Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()),
  );
}

export function addUtcDays(start: Date, days: number): Date {
  const next = utcDateOnly(start);
  next.setUTCDate(next.getUTCDate() + days);
  return next;
}

export function isoDate(value: Date | string | null | undefined): string | null {
  if (!value) return null;
  const date = utcDateOnly(value);
  return date.toISOString().slice(0, 10);
}

export function weekdayLabel(date: Date): string {
  return date.toLocaleDateString('en-US', {
    weekday: 'long',
    timeZone: 'UTC',
  });
}

export function normalizeInstructionSteps(
  steps?: string[] | null,
  instructions?: string | null,
): string[] {
  if (steps && steps.length > 0) {
    return steps.map((step) => step.trim()).filter(Boolean);
  }
  if (!instructions?.trim()) {
    return [];
  }
  return instructions
    .split(/\n+/)
    .map((line) => line.replace(/^\s*\d+[\.)]\s*/, '').trim())
    .filter(Boolean);
}

export function joinInstructionSteps(steps: string[]): string {
  return steps.map((step, index) => `${index + 1}. ${step}`).join('\n');
}

export function hasDirections(item: CompletenessItem): boolean {
  return (
    normalizeInstructionSteps(item.instructionSteps, item.instructions).length >
    0
  );
}

export function hasCatalogProduct(item: CompletenessItem): boolean {
  return Boolean(item.productId) || (item.ingredientCount ?? 0) > 0;
}

export function computeCompleteness(
  days: CompletenessDay[],
): MealPlanCompletenessDto {
  const missing: CompletenessGapDto[] = [];
  let filledSlots = 0;
  let recipesWithSteps = 0;
  let unmatched = 0;
  let cookedCount = 0;
  let plannedCount = 0;

  for (const day of days) {
    const bySlot = new Map(day.items.map((item) => [item.mealSlot.toLowerCase(), item]));
    for (const slot of REQUIRED_MEAL_SLOTS) {
      const item = bySlot.get(slot);
      if (!item) {
        missing.push({
          dayId: day.id,
          planDate: isoDate(day.planDate),
          mealSlot: slot,
          reason: 'missing_meal',
        });
        continue;
      }
      plannedCount += 1;
      if (item.cookedAt) cookedCount += 1;
      if (!hasCatalogProduct(item)) {
        unmatched += 1;
        missing.push({
          dayId: day.id,
          planDate: isoDate(day.planDate),
          mealSlot: slot,
          reason: 'missing_product',
        });
        continue;
      }
      filledSlots += 1;
      if (hasDirections(item)) {
        recipesWithSteps += 1;
      } else {
        missing.push({
          dayId: day.id,
          planDate: isoDate(day.planDate),
          mealSlot: slot,
          reason: 'missing_directions',
        });
      }
    }

    const snack = bySlot.get('snack');
    if (snack) {
      plannedCount += 1;
      if (snack.cookedAt) cookedCount += 1;
      if (!hasCatalogProduct(snack)) {
        unmatched += 1;
        missing.push({
          dayId: day.id,
          planDate: isoDate(day.planDate),
          mealSlot: 'snack',
          reason: 'missing_product',
        });
      } else {
        filledSlots += 1;
        if (hasDirections(snack)) {
          recipesWithSteps += 1;
        } else {
          missing.push({
            dayId: day.id,
            planDate: isoDate(day.planDate),
            mealSlot: 'snack',
            reason: 'missing_directions',
          });
        }
      }
    }
  }

  const requiredSlots = days.length * REQUIRED_MEAL_SLOTS.length;
  return {
    requiredSlots,
    filledSlots,
    recipesWithSteps,
    unmatched,
    cookedCount,
    plannedCount,
    readyToPublish: missing.length === 0 && requiredSlots > 0,
    missing,
  };
}
