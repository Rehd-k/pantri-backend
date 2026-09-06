import {
  formatPantraDisplay,
  packagingHorizonDays,
  packsNeeded,
  recipeToCanonical,
  scaleCanonical,
} from './measure-convert';

describe('measure-convert', () => {
  const pantraCup = {
    name: 'Pantra Cup',
    shortLabel: 'PC',
    kind: 'PANTRA',
    milligrams: 150_000,
    millilitres: null,
    piecesPerUnit: null,
  };

  it('converts 1 Pantra Cup of rice to 150g (150000mg)', () => {
    expect(recipeToCanonical(1, pantraCup)).toBe(150_000);
  });

  it('honours product-specific cup overrides', () => {
    expect(
      recipeToCanonical(1, pantraCup, { recipeUnitOverrideMg: 160_000 }),
    ).toBe(160_000);
  });

  it('scales servings: base 2 servings of 300g → 1 serving 150g', () => {
    expect(scaleCanonical(300_000, 1, 2)).toBe(150_000);
    expect(scaleCanonical(300_000, 2, 2)).toBe(300_000);
  });

  it('formats Pantra display for rice stock', () => {
    const display = formatPantraDisplay(10_000_000, pantraCup);
    expect(display.unitName).toBe('Pantra Cup');
    expect(display.quantity).toBe(66.67);
    expect(display.label).toContain('Pantra Cup');
  });

  it('formats exactly 1 cup after cooking deduction', () => {
    const after = formatPantraDisplay(9_850_000, pantraCup);
    // 9850000 / 150000 ≈ 65.666 → 65.67
    expect(after.quantityLabel).toBe('65.67');
  });

  it('computes packs needed', () => {
    expect(
      packsNeeded(10_000_000, {
        amountMg: 1_000_000,
        amountMl: null,
        amountEach: null,
      }),
    ).toBe(10);
  });

  it('caps packaging horizon by shelf life without inventing 90 days', () => {
    expect(
      packagingHorizonDays({
        planDays: 30,
        shelfLifeDays: 7,
        preferredCycleDays: null,
      }),
    ).toBe(7);
    expect(
      packagingHorizonDays({
        planDays: 30,
        shelfLifeDays: null,
        preferredCycleDays: null,
      }),
    ).toBe(30);
  });
});

describe('rice cook scenario (canonical math)', () => {
  it('10kg → cook 150g cup twice', () => {
    let stock = 10_000_000; // 10kg in mg
    const cup = 150_000;
    stock -= cup;
    expect(stock).toBe(9_850_000);
    stock -= cup;
    expect(stock).toBe(9_700_000);
  });
});
