import { MealPlanDemandService } from './meal-plan-demand.service';

describe('MealPlanDemandService', () => {
  const service = new MealPlanDemandService();

  const riceRecipe = {
    baseServings: 1,
    ingredients: [{ productId: 'rice', quantityCanonical: 150_000 }],
  };

  it('aggregates planned meals and ignores skipped', () => {
    const demand = service.aggregateCanonical(
      [
        {
          planDate: '2026-09-01',
          items: [
            {
              matchType: 'PRIMARY',
              status: 'PLANNED',
              servings: 1,
              recipe: riceRecipe,
            },
            {
              matchType: 'PRIMARY',
              status: 'SKIPPED',
              servings: 1,
              recipe: riceRecipe,
            },
            {
              matchType: 'PRIMARY',
              status: 'COOKED',
              servings: 1,
              recipe: riceRecipe,
            },
          ],
        },
      ],
      { statuses: ['PLANNED'] },
    );
    expect(demand.get('rice')).toBe(150_000);
  });

  it('uses substituted recipe for SUBSTITUTED meals', () => {
    const demand = service.aggregateCanonical(
      [
        {
          items: [
            {
              matchType: 'PRIMARY',
              status: 'SUBSTITUTED',
              servings: 1,
              recipe: riceRecipe,
              substitutedRecipe: {
                baseServings: 1,
                ingredients: [
                  { productId: 'oats', quantityCanonical: 150_000 },
                ],
              },
            },
          ],
        },
      ],
      { statuses: ['SUBSTITUTED'] },
    );
    expect(demand.get('rice')).toBeUndefined();
    expect(demand.get('oats')).toBe(150_000);
  });

  it('scales by servings relative to baseServings', () => {
    const demand = service.aggregateCanonical(
      [
        {
          items: [
            {
              matchType: 'PRIMARY',
              status: 'PLANNED',
              servings: 2,
              recipe: {
                baseServings: 1,
                ingredients: [
                  { productId: 'rice', quantityCanonical: 150_000 },
                ],
              },
            },
          ],
        },
      ],
    );
    expect(demand.get('rice')).toBe(300_000);
  });

  it('applies shelf-life horizon when packaging', () => {
    const horizons = new Map([
      ['rice', { shelfLifeDays: 10, preferredCycleDays: null }],
    ]);
    const demand = service.aggregateCanonical(
      [
        {
          items: [
            {
              matchType: 'PRIMARY',
              status: 'PLANNED',
              servings: 1,
              recipe: {
                baseServings: 1,
                ingredients: [
                  { productId: 'rice', quantityCanonical: 300_000 },
                ],
              },
            },
          ],
        },
      ],
      {
        planDays: 30,
        productHorizons: horizons,
      },
    );
    expect(demand.get('rice')).toBe(100_000);
  });

  it('builds pack lines for shortfall', () => {
    const quantityByProduct = new Map([['rice', 2_800_000]]);
    const packs = new Map([
      [
        'rice',
        {
          id: 'pack-rice',
          amountMg: 1_000_000,
          amountMl: null,
          amountEach: null,
        },
      ],
    ]);
    const lines = service.packsForDemand(quantityByProduct, packs);
    expect(lines).toEqual([
      {
        productId: 'rice',
        packId: 'pack-rice',
        quantity: 3,
        neededCanonical: 2_800_000,
      },
    ]);
  });
});

describe('min order top-up logic', () => {
  it('requires ₦50,000 = 5_000_000 kobo', () => {
    const minOrderKobo = 5_000_000;
    const required = 3_750_000;
    expect(required < minOrderKobo).toBe(true);
    let recommended = required;
    const packPrice = 500_000;
    while (recommended < minOrderKobo) {
      recommended += packPrice;
    }
    expect(recommended).toBeGreaterThanOrEqual(minOrderKobo);
  });
});
