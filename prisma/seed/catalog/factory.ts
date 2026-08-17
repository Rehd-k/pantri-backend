import { nairaToKobo, kgPacks, gramPacks, litrePacks, piecePacks } from '../pack-pricing';
import { PRODUCT_IMAGES } from '../categories';
import type { SeedProductDef } from '../types';

const NUT_STAPLE = {
  Calories: '350 kcal',
  Carbohydrates: '75g',
  Protein: '8g',
  Fat: '1g',
  Fiber: '3g',
  Sugar: '1g',
  Sodium: '5mg',
  Iron: '1.2mg',
};

const NUT_RICE = {
  Calories: '360 kcal',
  Carbohydrates: '79g',
  Protein: '7g',
  Fat: '1g',
  Fiber: '1.3g',
  Sugar: '0g',
  Sodium: '5mg',
  Iron: '0.8mg',
};

const NUT_BEANS = {
  Calories: '340 kcal',
  Carbohydrates: '60g',
  Protein: '21g',
  Fat: '1g',
  Fiber: '16g',
  Sugar: '2g',
  Sodium: '12mg',
  Iron: '5.1mg',
};

const NUT_MAIZE = {
  Calories: '365 kcal',
  Carbohydrates: '74g',
  Protein: '9g',
  Fat: '5g',
  Fiber: '7g',
  Sugar: '1g',
  Sodium: '15mg',
  Iron: '2.7mg',
};

const NUT_OIL = {
  Calories: '884 kcal',
  Fat: '100g',
  Protein: '0g',
  Carbohydrates: '0g',
  Fiber: '0g',
  Sugar: '0g',
  Sodium: '0mg',
  Iron: '0mg',
};

const NUT_PROTEIN = {
  Calories: '250 kcal',
  Protein: '26g',
  Fat: '15g',
  Carbohydrates: '0g',
  Fiber: '0g',
  Sugar: '0g',
  Sodium: '70mg',
  Iron: '2.1mg',
};

const NUT_SPICE = {
  Calories: '20 kcal',
  Protein: '1g',
  Carbohydrates: '4g',
  Fat: '0g',
  Fiber: '2g',
  Sugar: '0g',
  Sodium: '8mg',
  Iron: '1.4mg',
};

const NUT_PASTE = {
  Calories: '82 kcal',
  Protein: '4g',
  Carbohydrates: '18g',
  Fat: '0.5g',
  Fiber: '2g',
  Sugar: '12g',
  Sodium: '430mg',
  Iron: '1.1mg',
};

const NUT_PRODUCE = {
  Calories: '40 kcal',
  Protein: '1g',
  Carbohydrates: '9g',
  Fat: '0g',
  Fiber: '3g',
  Sugar: '5g',
  Sodium: '6mg',
  Iron: '0.4mg',
};

function stapleFactsFor(slug: string): Record<string, string> {
  const s = slug.toLowerCase();
  if (s.includes('bean') || s.includes('lentil') || s.includes('pea')) {
    return NUT_BEANS;
  }
  if (s.includes('rice')) return NUT_RICE;
  if (s.includes('maize') || s.includes('corn')) return NUT_MAIZE;
  return NUT_STAPLE;
}

export function dry(
  slug: string,
  name: string,
  categorySlug: string,
  subcategorySlug: string,
  origin: string,
  nairaPerKg: number,
  brand: string,
  tags: string[],
  description: string,
  imageUrl = PRODUCT_IMAGES.rice,
  sizesKg = [1, 5, 10, 25],
): SeedProductDef {
  return {
    slug,
    name,
    categorySlug,
    subcategorySlug,
    familySlug: 'dry-staple',
    origin,
    description,
    tags,
    imageUrl,
    packs: kgPacks(brand, nairaToKobo(nairaPerKg), sizesKg),
    nutritionFacts: stapleFactsFor(slug),
    isVerified: true,
  };
}

export function spice(
  slug: string,
  name: string,
  subcategorySlug: string,
  origin: string,
  nairaPerKg: number,
  brand: string,
  tags: string[],
  description: string,
  sizesG = [50, 100, 250, 500],
): SeedProductDef {
  return {
    slug,
    name,
    categorySlug: 'spices-seasonings',
    subcategorySlug,
    familySlug: 'spice',
    origin,
    description,
    tags,
    imageUrl: PRODUCT_IMAGES.spice,
    packs: gramPacks(brand, nairaToKobo(nairaPerKg), sizesG),
    nutritionFacts: NUT_SPICE,
    isVerified: true,
  };
}

export function liquid(
  slug: string,
  name: string,
  categorySlug: string,
  subcategorySlug: string,
  origin: string,
  nairaPerL: number,
  brand: string,
  tags: string[],
  description: string,
  sizesL = [1, 2, 5],
  imageUrl = PRODUCT_IMAGES.oil,
): SeedProductDef {
  return {
    slug,
    name,
    categorySlug,
    subcategorySlug,
    familySlug: 'liquid',
    origin,
    description,
    tags,
    imageUrl,
    packs: litrePacks(brand, nairaToKobo(nairaPerL), sizesL),
    nutritionFacts: NUT_OIL,
    isVerified: true,
  };
}

export function paste(
  slug: string,
  name: string,
  subcategorySlug: string,
  origin: string,
  nairaPerKg: number,
  brand: string,
  tags: string[],
  description: string,
  sizesG = [70, 165, 400, 800],
): SeedProductDef {
  return {
    slug,
    name,
    categorySlug: 'condiments-pastes',
    subcategorySlug,
    familySlug: 'paste',
    origin,
    description,
    tags,
    imageUrl: PRODUCT_IMAGES.canned,
    packs: gramPacks(brand, nairaToKobo(nairaPerKg), sizesG),
    nutritionFacts: NUT_PASTE,
    isVerified: true,
  };
}

export function protein(
  slug: string,
  name: string,
  categorySlug: string,
  subcategorySlug: string,
  origin: string,
  nairaPerKg: number,
  brand: string,
  tags: string[],
  description: string,
  sizesKg = [1, 2, 5],
  imageUrl = PRODUCT_IMAGES.meat,
): SeedProductDef {
  return {
    slug,
    name,
    categorySlug,
    subcategorySlug,
    familySlug: 'protein-mass',
    origin,
    description,
    tags,
    imageUrl,
    packs: kgPacks(brand, nairaToKobo(nairaPerKg), sizesKg),
    nutritionFacts: NUT_PROTEIN,
    isVerified: true,
  };
}

export function counted(
  slug: string,
  name: string,
  categorySlug: string,
  subcategorySlug: string,
  origin: string,
  nairaEach: number,
  brand: string,
  tags: string[],
  description: string,
  sizes: Array<{ each: number; label: string }>,
  imageUrl = PRODUCT_IMAGES.veg,
): SeedProductDef {
  return {
    slug,
    name,
    categorySlug,
    subcategorySlug,
    familySlug: 'produce-count',
    origin,
    description,
    tags,
    imageUrl,
    packs: piecePacks(brand, nairaToKobo(nairaEach), sizes),
    nutritionFacts: NUT_PRODUCE,
    isVerified: true,
  };
}
