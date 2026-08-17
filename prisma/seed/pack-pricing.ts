/** Integer kobo helpers for pack pricing. Never use floats for money. */

export function nairaToKobo(naira: number): number {
  return Math.round(naira * 100);
}

/** Bulk discount in basis points off unit price for larger packs. */
function bulkDiscountBps(packAmount: number, unitSlug: string): number {
  if (unitSlug === 'kilogram') {
    if (packAmount >= 50) return 1800;
    if (packAmount >= 25) return 1400;
    if (packAmount >= 10) return 900;
    if (packAmount >= 5) return 500;
    return 0;
  }
  if (unitSlug === 'litre') {
    if (packAmount >= 25) return 1500;
    if (packAmount >= 5) return 1000;
    if (packAmount >= 2) return 500;
    return 0;
  }
  if (unitSlug === 'gram' && packAmount >= 500) return 400;
  return 0;
}

export function priceForPack(
  unitPriceKobo: number,
  packAmount: number,
  unitSlug: string,
): { priceKobo: number; retailPriceKobo: number } {
  const gross = unitPriceKobo * packAmount;
  const discountBps = bulkDiscountBps(packAmount, unitSlug);
  const priceKobo = Math.max(100, Math.round((gross * (10_000 - discountBps)) / 10_000));
  const retailPriceKobo = Math.max(priceKobo, Math.round((gross * 11_500) / 10_000));
  return { priceKobo, retailPriceKobo };
}

export function kgPacks(
  brand: string,
  unitPricePerKgKobo: number,
  sizesKg: number[],
): Array<{
  brand: string;
  unitSlug: string;
  packAmount: number;
  packageLabel: string;
  priceKobo: number;
  retailPriceKobo: number;
}> {
  return sizesKg.map((kg) => {
    const priced = priceForPack(unitPricePerKgKobo, kg, 'kilogram');
    return {
      brand,
      unitSlug: 'kilogram',
      packAmount: kg,
      packageLabel: `${kg}kg`,
      ...priced,
    };
  });
}

export function gramPacks(
  brand: string,
  unitPricePerKgKobo: number,
  sizesG: number[],
): Array<{
  brand: string;
  unitSlug: string;
  packAmount: number;
  packageLabel: string;
  priceKobo: number;
  retailPriceKobo: number;
}> {
  const perGram = Math.max(1, Math.round(unitPricePerKgKobo / 1000));
  return sizesG.map((g) => {
    const priced = priceForPack(perGram, g, 'gram');
    return {
      brand,
      unitSlug: 'gram',
      packAmount: g,
      packageLabel: g >= 1000 ? `${g / 1000}kg` : `${g}g`,
      ...priced,
    };
  });
}

export function litrePacks(
  brand: string,
  unitPricePerLitreKobo: number,
  sizesL: number[],
): Array<{
  brand: string;
  unitSlug: string;
  packAmount: number;
  packageLabel: string;
  priceKobo: number;
  retailPriceKobo: number;
}> {
  return sizesL.map((l) => {
    const priced = priceForPack(unitPricePerLitreKobo, l, 'litre');
    const wholeLitres = Number.isInteger(l) && l >= 1;
    if (!wholeLitres) {
      const ml = Math.round(l * 1000);
      return {
        brand,
        unitSlug: 'millilitre',
        packAmount: ml,
        packageLabel: ml >= 1000 ? `${l}L` : `${ml}ml`,
        ...priced,
      };
    }
    return {
      brand,
      unitSlug: 'litre',
      packAmount: l,
      packageLabel: `${l}L`,
      ...priced,
    };
  });
}

export function piecePacks(
  brand: string,
  unitPriceEachKobo: number,
  sizes: Array<{ each: number; label: string }>,
): Array<{
  brand: string;
  unitSlug: string;
  packAmount: number;
  packageLabel: string;
  priceKobo: number;
  retailPriceKobo: number;
}> {
  return sizes.map((s) => {
    const gross = unitPriceEachKobo * s.each;
    const priceKobo = s.each >= 12 ? Math.round((gross * 9_200) / 10_000) : gross;
    return {
      brand,
      unitSlug: 'piece',
      packAmount: s.each,
      packageLabel: s.label,
      priceKobo,
      retailPriceKobo: Math.round((gross * 11_500) / 10_000),
    };
  });
}
