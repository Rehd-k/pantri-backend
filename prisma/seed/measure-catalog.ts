import type { PrismaClient } from '../../generated/prisma/client';
import {
  MeasureDimension,
  MeasureKind,
} from '../../generated/prisma/client';

type UnitSeed = {
  slug: string;
  name: string;
  shortLabel: string;
  kind: MeasureKind;
  dimension: MeasureDimension;
  milligrams?: number | null;
  millilitres?: number | null;
  piecesPerUnit?: number | null;
  isPurchaseUnit: boolean;
  isRecipeUnit: boolean;
  sortOrder: number;
};

type FamilySeed = {
  slug: string;
  name: string;
  description: string;
  dimension: MeasureDimension;
  defaultRecipeUnitSlug: string;
  defaultPurchaseUnitSlug: string;
  sortOrder: number;
};

const UNITS: UnitSeed[] = [
  {
    slug: 'pantra-cup',
    name: 'Pantra Cup',
    shortLabel: 'PC',
    kind: MeasureKind.PANTRA,
    dimension: MeasureDimension.MASS,
    milligrams: 150_000,
    isPurchaseUnit: false,
    isRecipeUnit: true,
    sortOrder: 1,
  },
  {
    slug: 'pantra-pour',
    name: 'Pantra Pour',
    shortLabel: 'PP',
    kind: MeasureKind.PANTRA,
    dimension: MeasureDimension.VOLUME,
    millilitres: 250,
    isPurchaseUnit: false,
    isRecipeUnit: true,
    sortOrder: 2,
  },
  {
    slug: 'pantra-spoon',
    name: 'Pantra Spoon',
    shortLabel: 'PS',
    kind: MeasureKind.PANTRA,
    dimension: MeasureDimension.MASS,
    milligrams: 5_000,
    isPurchaseUnit: false,
    isRecipeUnit: true,
    sortOrder: 3,
  },
  {
    slug: 'pantra-scoop',
    name: 'Pantra Scoop',
    shortLabel: 'PSc',
    kind: MeasureKind.PANTRA,
    dimension: MeasureDimension.MASS,
    milligrams: 50_000,
    isPurchaseUnit: false,
    isRecipeUnit: true,
    sortOrder: 4,
  },
  {
    slug: 'pantra-piece',
    name: 'Pantra Piece',
    shortLabel: 'PPc',
    kind: MeasureKind.PANTRA,
    dimension: MeasureDimension.COUNT,
    piecesPerUnit: 1,
    isPurchaseUnit: false,
    isRecipeUnit: true,
    sortOrder: 5,
  },
  {
    slug: 'gram',
    name: 'Gram',
    shortLabel: 'g',
    kind: MeasureKind.METRIC,
    dimension: MeasureDimension.MASS,
    milligrams: 1_000,
    isPurchaseUnit: true,
    isRecipeUnit: true,
    sortOrder: 10,
  },
  {
    slug: 'kilogram',
    name: 'Kilogram',
    shortLabel: 'kg',
    kind: MeasureKind.METRIC,
    dimension: MeasureDimension.MASS,
    milligrams: 1_000_000,
    isPurchaseUnit: true,
    isRecipeUnit: false,
    sortOrder: 11,
  },
  {
    slug: 'millilitre',
    name: 'Millilitre',
    shortLabel: 'ml',
    kind: MeasureKind.METRIC,
    dimension: MeasureDimension.VOLUME,
    millilitres: 1,
    isPurchaseUnit: true,
    isRecipeUnit: true,
    sortOrder: 20,
  },
  {
    slug: 'litre',
    name: 'Litre',
    shortLabel: 'L',
    kind: MeasureKind.METRIC,
    dimension: MeasureDimension.VOLUME,
    millilitres: 1_000,
    isPurchaseUnit: true,
    isRecipeUnit: false,
    sortOrder: 21,
  },
  {
    slug: 'teaspoon',
    name: 'Teaspoon',
    shortLabel: 'tsp',
    kind: MeasureKind.METRIC,
    dimension: MeasureDimension.VOLUME,
    millilitres: 5,
    isPurchaseUnit: false,
    isRecipeUnit: true,
    sortOrder: 22,
  },
  {
    slug: 'tablespoon',
    name: 'Tablespoon',
    shortLabel: 'tbsp',
    kind: MeasureKind.METRIC,
    dimension: MeasureDimension.VOLUME,
    millilitres: 15,
    isPurchaseUnit: false,
    isRecipeUnit: true,
    sortOrder: 23,
  },
  {
    slug: 'piece',
    name: 'Piece',
    shortLabel: 'pc',
    kind: MeasureKind.COUNT,
    dimension: MeasureDimension.COUNT,
    piecesPerUnit: 1,
    isPurchaseUnit: true,
    isRecipeUnit: true,
    sortOrder: 30,
  },
  {
    slug: 'dozen',
    name: 'Dozen',
    shortLabel: 'dz',
    kind: MeasureKind.COUNT,
    dimension: MeasureDimension.COUNT,
    piecesPerUnit: 12,
    isPurchaseUnit: true,
    isRecipeUnit: false,
    sortOrder: 31,
  },
  {
    slug: 'derica',
    name: 'Derica',
    shortLabel: 'derica',
    kind: MeasureKind.TRADITIONAL,
    dimension: MeasureDimension.MASS,
    milligrams: 400_000,
    isPurchaseUnit: false,
    isRecipeUnit: true,
    sortOrder: 40,
  },
  {
    slug: 'milk-cup',
    name: 'Milk cup',
    shortLabel: 'cup',
    kind: MeasureKind.TRADITIONAL,
    dimension: MeasureDimension.MASS,
    milligrams: 160_000,
    isPurchaseUnit: false,
    isRecipeUnit: true,
    sortOrder: 41,
  },
];

const FAMILIES: FamilySeed[] = [
  {
    slug: 'dry-staple',
    name: 'Dry staples',
    description:
      'Rice, beans, garri, flours and powdery foods. 1 Pantra Cup = 150g.',
    dimension: MeasureDimension.MASS,
    defaultRecipeUnitSlug: 'pantra-cup',
    defaultPurchaseUnitSlug: 'kilogram',
    sortOrder: 0,
  },
  {
    slug: 'liquid',
    name: 'Liquids',
    description: 'Oils, water, milk and stocks. 1 Pantra Pour = 250ml.',
    dimension: MeasureDimension.VOLUME,
    defaultRecipeUnitSlug: 'pantra-pour',
    defaultPurchaseUnitSlug: 'litre',
    sortOrder: 1,
  },
  {
    slug: 'paste',
    name: 'Pastes',
    description:
      'Tomato paste, pepper mix, iru and thick condiments. 1 Pantra Scoop = 50g.',
    dimension: MeasureDimension.MASS,
    defaultRecipeUnitSlug: 'pantra-scoop',
    defaultPurchaseUnitSlug: 'gram',
    sortOrder: 2,
  },
  {
    slug: 'spice',
    name: 'Spices',
    description: 'Dry seasonings. 1 Pantra Spoon = 5g.',
    dimension: MeasureDimension.MASS,
    defaultRecipeUnitSlug: 'pantra-spoon',
    defaultPurchaseUnitSlug: 'gram',
    sortOrder: 3,
  },
  {
    slug: 'produce-count',
    name: 'Countable produce',
    description: 'Eggs, onions, peppers and stock cubes. Sold by piece.',
    dimension: MeasureDimension.COUNT,
    defaultRecipeUnitSlug: 'pantra-piece',
    defaultPurchaseUnitSlug: 'piece',
    sortOrder: 4,
  },
  {
    slug: 'protein-mass',
    name: 'Proteins by mass',
    description: 'Meat, fish and offals sold by kilogram.',
    dimension: MeasureDimension.MASS,
    defaultRecipeUnitSlug: 'gram',
    defaultPurchaseUnitSlug: 'kilogram',
    sortOrder: 5,
  },
];

export async function seedMeasures(prisma: PrismaClient): Promise<void> {
  for (const unit of UNITS) {
    await prisma.measureUnit.upsert({
      where: { slug: unit.slug },
      create: {
        slug: unit.slug,
        name: unit.name,
        shortLabel: unit.shortLabel,
        kind: unit.kind,
        dimension: unit.dimension,
        milligrams: unit.milligrams ?? null,
        millilitres: unit.millilitres ?? null,
        piecesPerUnit: unit.piecesPerUnit ?? null,
        isPurchaseUnit: unit.isPurchaseUnit,
        isRecipeUnit: unit.isRecipeUnit,
        sortOrder: unit.sortOrder,
        isActive: true,
      },
      update: {
        name: unit.name,
        shortLabel: unit.shortLabel,
        kind: unit.kind,
        dimension: unit.dimension,
        milligrams: unit.milligrams ?? null,
        millilitres: unit.millilitres ?? null,
        piecesPerUnit: unit.piecesPerUnit ?? null,
        isPurchaseUnit: unit.isPurchaseUnit,
        isRecipeUnit: unit.isRecipeUnit,
        sortOrder: unit.sortOrder,
        isActive: true,
      },
    });
  }

  const units = await prisma.measureUnit.findMany();
  const unitBySlug = Object.fromEntries(units.map((u) => [u.slug, u]));

  for (const family of FAMILIES) {
    const recipe = unitBySlug[family.defaultRecipeUnitSlug];
    const purchase = unitBySlug[family.defaultPurchaseUnitSlug];
    if (!recipe || !purchase) {
      throw new Error(`Missing units for family ${family.slug}`);
    }
    await prisma.measureFamily.upsert({
      where: { slug: family.slug },
      create: {
        slug: family.slug,
        name: family.name,
        description: family.description,
        dimension: family.dimension,
        defaultRecipeUnitId: recipe.id,
        defaultPurchaseUnitId: purchase.id,
        sortOrder: family.sortOrder,
        isActive: true,
      },
      update: {
        name: family.name,
        description: family.description,
        dimension: family.dimension,
        defaultRecipeUnitId: recipe.id,
        defaultPurchaseUnitId: purchase.id,
        sortOrder: family.sortOrder,
        isActive: true,
      },
    });
  }

  console.log(`Seeded ${UNITS.length} measure units and ${FAMILIES.length} families`);
}
