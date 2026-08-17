export type PackKind = 'mass-kg' | 'mass-g' | 'volume-l' | 'volume-ml' | 'count';

export interface SeedPackDef {
  brand: string;
  unitSlug: string;
  packAmount: number;
  packageLabel: string;
  priceKobo: number;
  retailPriceKobo: number;
  sku?: string;
}

export interface SeedProductDef {
  slug: string;
  name: string;
  categorySlug: string;
  subcategorySlug: string;
  familySlug: string;
  origin: string;
  description: string;
  tags: string[];
  imageUrl: string;
  packs: SeedPackDef[];
  nutritionFacts?: Record<string, string>;
  recipeUnitOverrideMg?: number;
  recipeUnitOverrideMl?: number;
  isVerified?: boolean;
}

export interface SeedSubcategoryDef {
  slug: string;
  name: string;
}

export interface SeedCategoryDef {
  slug: string;
  name: string;
  imageUrl: string;
  accentColor: string;
  subs: SeedSubcategoryDef[];
}
