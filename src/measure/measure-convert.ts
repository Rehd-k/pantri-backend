export function effectiveRecipeUnit<T>(product: {
  recipeUnit?: T | null;
  measureFamily?: { defaultRecipeUnit?: T | null } | null;
}): T | null {
  return product.recipeUnit ?? product.measureFamily?.defaultRecipeUnit ?? null;
}

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

export type DisplayUnit = {
  name: string;
  shortLabel: string;
  kind?: string | null;
  milligrams?: number | null;
  millilitres?: number | null;
  piecesPerUnit?: number | null;
};

export type PantraDisplay = {
  quantity: number;
  quantityLabel: string;
  unitName: string;
  shortLabel: string;
  /** e.g. "1 Pantra Cup" */
  label: string;
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

/**
 * Scale a base-recipe canonical quantity for a cook serving count.
 * baseServings=2, servings=1 → half the ingredients.
 */
export function scaleCanonical(
  baseCanonical: number,
  servings: number,
  baseServings: number,
): number {
  const base = Math.max(1, baseServings || 1);
  const target = Math.max(0, servings);
  if (target === 0) return 0;
  return Math.max(0, Math.round((baseCanonical * target) / base));
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

function trimNumber(value: number): string {
  return value.toFixed(2).replace(/\.?0+$/, '');
}

/** Metric fallback display (g / ml / pcs / kg / L). */
export function formatMetricCanonical(
  quantityCanonical: number,
  dimension: string,
): { quantity: string; unit: string } {
  if (dimension === 'VOLUME') {
    if (quantityCanonical >= 1000) {
      return {
        quantity: trimNumber(quantityCanonical / 1000),
        unit: 'L',
      };
    }
    return { quantity: String(quantityCanonical), unit: 'ml' };
  }
  if (dimension === 'COUNT') {
    return { quantity: String(quantityCanonical), unit: 'pcs' };
  }
  if (quantityCanonical >= 1_000_000) {
    return {
      quantity: trimNumber(quantityCanonical / 1_000_000),
      unit: 'kg',
    };
  }
  return {
    quantity: trimNumber(quantityCanonical / 1000),
    unit: 'g',
  };
}

/**
 * Convert a canonical amount into user-facing recipe-unit display.
 * Prefers the product's Pantra (or other) recipe unit when sized.
 */
export function formatPantraDisplay(
  quantityCanonical: number,
  unit: DisplayUnit | null | undefined,
  overrides?: RecipeOverrides,
  dimension = 'MASS',
): PantraDisplay {
  if (!unit) {
    const metric = formatMetricCanonical(quantityCanonical, dimension);
    return {
      quantity: Number(metric.quantity) || 0,
      quantityLabel: metric.quantity,
      unitName: metric.unit,
      shortLabel: metric.unit,
      label: `${metric.quantity} ${metric.unit}`,
    };
  }

  const perUnit = canonicalPerRecipeUnit(
    {
      milligrams: unit.milligrams ?? null,
      millilitres: unit.millilitres ?? null,
      piecesPerUnit: unit.piecesPerUnit ?? null,
    },
    overrides,
  );
  if (perUnit <= 0) {
    const metric = formatMetricCanonical(quantityCanonical, dimension);
    return {
      quantity: Number(metric.quantity) || 0,
      quantityLabel: metric.quantity,
      unitName: unit.name || metric.unit,
      shortLabel: unit.shortLabel || metric.unit,
      label: `${metric.quantity} ${unit.name || metric.unit}`,
    };
  }

  const raw = quantityCanonical / perUnit;
  const rounded =
    Math.abs(raw - Math.round(raw)) < 0.05
      ? Math.round(raw)
      : Math.round(raw * 100) / 100;
  const quantityLabel = trimNumber(rounded);
  return {
    quantity: rounded,
    quantityLabel,
    unitName: unit.name,
    shortLabel: unit.shortLabel,
    label: `${quantityLabel} ${unit.name}`,
  };
}

/**
 * Cap a plan's packaging horizon using shelf life / preferred cycle when set.
 * Returns days to package for (never invents a 90-day default).
 */
export function packagingHorizonDays(input: {
  planDays: number;
  shelfLifeDays?: number | null;
  preferredCycleDays?: number | null;
}): number {
  const planDays = Math.max(1, input.planDays);
  const caps = [input.shelfLifeDays, input.preferredCycleDays].filter(
    (v): v is number => typeof v === 'number' && v > 0,
  );
  if (caps.length === 0) return planDays;
  return Math.max(1, Math.min(planDays, ...caps));
}
