export type CanonicalNutrition = {
  energyKcal: number;
  proteinMg: number;
  carbsMg: number;
  fatMg: number;
  fiberMg: number;
  sugarMg: number;
  sodiumMg: number;
  ironUg: number;
};

export const EMPTY_NUTRITION: CanonicalNutrition = {
  energyKcal: 0,
  proteinMg: 0,
  carbsMg: 0,
  fatMg: 0,
  fiberMg: 0,
  sugarMg: 0,
  sodiumMg: 0,
  ironUg: 0,
};

const KEY_ALIASES: Array<{
  field: keyof CanonicalNutrition;
  matches: string[];
}> = [
  { field: 'energyKcal', matches: ['calorie', 'kcal', 'energy'] },
  { field: 'proteinMg', matches: ['protein'] },
  { field: 'carbsMg', matches: ['carbohydrate', 'carb'] },
  { field: 'fatMg', matches: ['fat'] },
  { field: 'fiberMg', matches: ['fiber', 'fibre'] },
  { field: 'sugarMg', matches: ['sugar'] },
  { field: 'sodiumMg', matches: ['sodium'] },
  { field: 'ironUg', matches: ['iron'] },
];

function parseLeadingNumber(raw: string): number | null {
  const match = /([\d]+(?:\.\d+)?)/.exec(raw);
  if (!match) return null;
  const value = Number.parseFloat(match[1]);
  return Number.isFinite(value) ? value : null;
}

function unitOf(raw: string): string {
  return raw.toLowerCase().replace(/[\d.,\s]/g, '');
}

function toCanonicalAmount(
  field: keyof CanonicalNutrition,
  value: number,
  unit: string,
): number {
  const u = unit.toLowerCase();
  switch (field) {
    case 'energyKcal':
      return Math.round(value);
    case 'ironUg':
      if (u.includes('ug') || u.includes('µg') || u.includes('mcg')) {
        return Math.round(value);
      }
      return Math.round(value * 1000);
    case 'sodiumMg':
      if (u === 'g') return Math.round(value * 1000);
      return Math.round(value);
    default:
      if (u === 'mg') return Math.round(value);
      return Math.round(value * 1000);
  }
}

function matchField(key: string): keyof CanonicalNutrition | null {
  const lower = key.toLowerCase();
  for (const alias of KEY_ALIASES) {
    if (alias.matches.some((token) => lower.includes(token))) {
      return alias.field;
    }
  }
  return null;
}

export function parseNutritionFacts(
  value: unknown,
): CanonicalNutrition {
  const result: CanonicalNutrition = { ...EMPTY_NUTRITION };
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return result;
  }
  for (const [key, raw] of Object.entries(value as Record<string, unknown>)) {
    const field = matchField(key);
    if (!field) continue;
    const text = String(raw ?? '').trim();
    const amount = parseLeadingNumber(text);
    if (amount == null) continue;
    result[field] = toCanonicalAmount(field, amount, unitOf(text));
  }
  return result;
}

export function addNutrition(
  a: CanonicalNutrition,
  b: CanonicalNutrition,
): CanonicalNutrition {
  return {
    energyKcal: a.energyKcal + b.energyKcal,
    proteinMg: a.proteinMg + b.proteinMg,
    carbsMg: a.carbsMg + b.carbsMg,
    fatMg: a.fatMg + b.fatMg,
    fiberMg: a.fiberMg + b.fiberMg,
    sugarMg: a.sugarMg + b.sugarMg,
    sodiumMg: a.sodiumMg + b.sodiumMg,
    ironUg: a.ironUg + b.ironUg,
  };
}

export function scaleNutrition(
  profile: CanonicalNutrition,
  factor: number,
): CanonicalNutrition {
  const safe = Number.isFinite(factor) && factor > 0 ? factor : 0;
  return {
    energyKcal: Math.round(profile.energyKcal * safe),
    proteinMg: Math.round(profile.proteinMg * safe),
    carbsMg: Math.round(profile.carbsMg * safe),
    fatMg: Math.round(profile.fatMg * safe),
    fiberMg: Math.round(profile.fiberMg * safe),
    sugarMg: Math.round(profile.sugarMg * safe),
    sodiumMg: Math.round(profile.sodiumMg * safe),
    ironUg: Math.round(profile.ironUg * safe),
  };
}

/**
 * Scale per-100g (or per-100ml) facts by a canonical amount.
 * Mass/volume: 100_000 mg or ml = 100g/100ml.
 * Count: each piece is treated as one serving of the listed facts.
 */
export function scaleNutritionByCanonical(
  profile: CanonicalNutrition,
  quantityCanonical: number,
  dimension: 'MASS' | 'VOLUME' | 'COUNT' | string,
): CanonicalNutrition {
  if (quantityCanonical <= 0) return { ...EMPTY_NUTRITION };
  if (dimension === 'COUNT') {
    return scaleNutrition(profile, quantityCanonical);
  }
  return scaleNutrition(profile, quantityCanonical / 100_000);
}

export function nutritionPercent(
  consumed: number,
  target: number,
): number {
  if (target <= 0) return 0;
  return Math.round((consumed / target) * 100);
}
