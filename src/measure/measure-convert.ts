export type MeasureCanonicalUnit = {
  milligrams: number | null;
  millilitres: number | null;
  piecesPerUnit: number | null;
};

export type RecipeOverrides = {
  recipeUnitOverrideMg?: number | null;
  recipeUnitOverrideMl?: number | null;
};

export type PackCanonical = {
  amountMg: number | null;
  amountMl: number | null;
  amountEach: number | null;
};

/** Canonical amount for one recipe unit, preferring product-specific overrides. */
export function canonicalPerRecipeUnit(
  unit: MeasureCanonicalUnit,
  overrides?: RecipeOverrides,
): number {
  if (overrides?.recipeUnitOverrideMg && overrides.recipeUnitOverrideMg > 0) {
    return overrides.recipeUnitOverrideMg;
  }
  if (overrides?.recipeUnitOverrideMl && overrides.recipeUnitOverrideMl > 0) {
    return overrides.recipeUnitOverrideMl;
  }
  return unit.milligrams ?? unit.millilitres ?? unit.piecesPerUnit ?? 0;
}

export function recipeToCanonical(
  quantity: number,
  unit: MeasureCanonicalUnit,
  overrides?: RecipeOverrides,
): number {
  const perUnit = canonicalPerRecipeUnit(unit, overrides);
  return Math.max(0, Math.round(quantity * perUnit));
}

export function packCanonicalAmount(pack: PackCanonical): number {
  return pack.amountMg ?? pack.amountMl ?? pack.amountEach ?? 0;
}

export function packsNeeded(
  neededCanonical: number,
  pack: PackCanonical,
): number {
  const size = packCanonicalAmount(pack);
  if (neededCanonical <= 0) return 0;
  if (size <= 0) return 0;
  return Math.ceil(neededCanonical / size);
}

export function leftoverCanonical(
  neededCanonical: number,
  pack: PackCanonical,
  packCount: number,
): number {
  return Math.max(0, packCount * packCanonicalAmount(pack) - neededCanonical);
}

export function packAmountsFromUnit(
  packAmount: number,
  unit: MeasureCanonicalUnit,
): { amountMg: number | null; amountMl: number | null; amountEach: number | null } {
  const amount = Math.max(0, packAmount);
  return {
    amountMg: unit.milligrams != null ? amount * unit.milligrams : null,
    amountMl: unit.millilitres != null ? amount * unit.millilitres : null,
    amountEach: unit.piecesPerUnit != null ? amount * unit.piecesPerUnit : null,
  };
}
