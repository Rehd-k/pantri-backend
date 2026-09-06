import { Injectable } from '@nestjs/common';
import {
  packagingHorizonDays,
  packsNeeded,
  scaleCanonical,
} from '../measure/measure-convert';

export type DemandIngredient = {
  productId: string;
  quantityCanonical: number;
};

export type DemandRecipe = {
  baseServings: number;
  ingredients: DemandIngredient[];
};

export type DemandMealItem = {
  matchType: string;
  status: string;
  servings: number;
  recipe: DemandRecipe | null;
  substitutedRecipe?: DemandRecipe | null;
  productId?: string | null;
  quantityCanonical?: number;
};

export type DemandDay = {
  planDate?: Date | string | null;
  items: DemandMealItem[];
};

export type AggregateDemandOptions = {
  from?: Date | string | null;
  to?: Date | string | null;
  /** Statuses that contribute to demand. Default: PLANNED only. */
  statuses?: string[];
  /** When packaging, proportion demand to shelf-life horizon. */
  planDays?: number;
  productHorizons?: Map<
    string,
    { shelfLifeDays?: number | null; preferredCycleDays?: number | null }
  >;
};

@Injectable()
export class MealPlanDemandService {
  /**
   * Aggregate product canonical demand across meal-plan days.
   * SKIPPED meals contribute nothing.
   * SUBSTITUTED meals use substitutedRecipe when present.
   * COOKED meals are excluded from *remaining* demand by default.
   */
  aggregateCanonical(
    days: DemandDay[],
    options: AggregateDemandOptions = {},
  ): Map<string, number> {
    const statuses = new Set(
      (options.statuses ?? ['PLANNED']).map((s) => String(s).toUpperCase()),
    );
    const from = options.from ? toDateOnly(options.from) : null;
    const to = options.to ? toDateOnly(options.to) : null;
    const quantityByProduct = new Map<string, number>();

    for (const day of days) {
      if (from || to) {
        const planDate = day.planDate ? toDateOnly(day.planDate) : null;
        if (planDate) {
          if (from && planDate.getTime() < from.getTime()) continue;
          if (to && planDate.getTime() > to.getTime()) continue;
        }
      }

      for (const item of day.items) {
        if (String(item.matchType).toUpperCase() === 'ALTERNATIVE') continue;
        const status = String(item.status ?? 'PLANNED').toUpperCase();
        if (!statuses.has(status)) continue;
        if (status === 'SKIPPED') continue;

        const recipe =
          status === 'SUBSTITUTED'
            ? item.substitutedRecipe ?? item.recipe
            : item.recipe;

        if (recipe && recipe.ingredients.length > 0) {
          const servings = Math.max(1, item.servings || 1);
          const baseServings = Math.max(1, recipe.baseServings || 1);
          for (const ingredient of recipe.ingredients) {
            let needed = scaleCanonical(
              ingredient.quantityCanonical,
              servings,
              baseServings,
            );
            needed = this.applyHorizon(
              needed,
              ingredient.productId,
              options,
            );
            if (needed <= 0) continue;
            quantityByProduct.set(
              ingredient.productId,
              (quantityByProduct.get(ingredient.productId) ?? 0) + needed,
            );
          }
        } else if (item.productId && (item.quantityCanonical ?? 0) > 0) {
          // Legacy single-product meals — still supported for drafts.
          let needed = item.quantityCanonical ?? 0;
          needed = this.applyHorizon(needed, item.productId, options);
          if (needed > 0) {
            quantityByProduct.set(
              item.productId,
              (quantityByProduct.get(item.productId) ?? 0) + needed,
            );
          }
        }
      }
    }

    return quantityByProduct;
  }

  /**
   * Scale pack counts from canonical demand using pack size.
   */
  packsForDemand(
    quantityByProduct: Map<string, number>,
    cheapestByProduct: Map<
      string,
      { id: string; amountMg: number | null; amountMl: number | null; amountEach: number | null }
    >,
  ): Array<{ productId: string; packId: string; quantity: number; neededCanonical: number }> {
    const lines: Array<{
      productId: string;
      packId: string;
      quantity: number;
      neededCanonical: number;
    }> = [];
    for (const [productId, neededCanonical] of quantityByProduct.entries()) {
      const pack = cheapestByProduct.get(productId);
      if (!pack) continue;
      const quantity = Math.max(1, packsNeeded(neededCanonical, pack));
      lines.push({
        productId,
        packId: pack.id,
        quantity,
        neededCanonical,
      });
    }
    return lines;
  }

  private applyHorizon(
    needed: number,
    productId: string,
    options: AggregateDemandOptions,
  ): number {
    const planDays = options.planDays;
    const horizon = options.productHorizons?.get(productId);
    if (!planDays || !horizon) return needed;
    const capped = packagingHorizonDays({
      planDays,
      shelfLifeDays: horizon.shelfLifeDays,
      preferredCycleDays: horizon.preferredCycleDays,
    });
    if (capped >= planDays) return needed;
    return Math.max(1, Math.ceil((needed * capped) / planDays));
  }
}

function toDateOnly(value: Date | string): Date {
  const date = typeof value === 'string' ? new Date(value) : value;
  return new Date(
    Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()),
  );
}
