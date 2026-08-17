import { BEANS_LEGUMES, RICE_GRAINS } from './rice-beans';
import { OILS, PASTES, SPICES, SWALLOWS, THICKENERS } from './swallows-oils-spices';
import { FISH, MEAT, PRODUCE, TUBERS } from './produce-proteins';
import { BAKING, BREAKFAST, CANNED, DAIRY, DRINKS, FROZEN, MORE_STAPLES } from './pantry-rest';
import { EXTRAS } from './extras';
import { MORE_FOODS } from './more-foods';
import { EXPANDED } from './expanded';
import type { SeedProductDef } from '../types';

function uniqueBySlug(products: SeedProductDef[]): SeedProductDef[] {
  const seen = new Set<string>();
  return products.filter((product) => {
    if (product.packs.length === 0) return false;
    if (seen.has(product.slug)) return false;
    seen.add(product.slug);
    return true;
  });
}

export const ALL_PRODUCTS: SeedProductDef[] = uniqueBySlug([
  ...RICE_GRAINS,
  ...BEANS_LEGUMES,
  ...SWALLOWS,
  ...OILS,
  ...THICKENERS,
  ...SPICES,
  ...PASTES,
  ...PRODUCE,
  ...TUBERS,
  ...MEAT,
  ...FISH,
  ...DAIRY,
  ...CANNED,
  ...FROZEN,
  ...BREAKFAST,
  ...DRINKS,
  ...BAKING,
  ...MORE_STAPLES,
  ...EXTRAS,
  ...MORE_FOODS,
  ...EXPANDED,
]);
