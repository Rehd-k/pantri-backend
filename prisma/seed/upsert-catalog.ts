import type { PrismaClient } from '../../generated/prisma/client';
import { CATEGORY_DEFS } from './categories';
import { ALL_PRODUCTS } from './catalog';
import type { SeedProductDef } from './types';

function packAmountsFromUnit(
  packAmount: number,
  unit: {
    milligrams: number | null;
    millilitres: number | null;
    piecesPerUnit: number | null;
  },
): { amountMg: number | null; amountMl: number | null; amountEach: number | null } {
  const amount = Math.max(0, packAmount);
  return {
    amountMg: unit.milligrams != null ? amount * unit.milligrams : null,
    amountMl: unit.millilitres != null ? amount * unit.millilitres : null,
    amountEach: unit.piecesPerUnit != null ? amount * unit.piecesPerUnit : null,
  };
}

export async function seedCategories(prisma: PrismaClient): Promise<void> {
  for (const [index, cat] of CATEGORY_DEFS.entries()) {
    const row = await prisma.marketplaceCategory.upsert({
      where: { slug: cat.slug },
      create: {
        slug: cat.slug,
        name: cat.name,
        imageUrl: cat.imageUrl,
        accentColor: cat.accentColor,
        sortOrder: index,
        isActive: true,
      },
      update: {
        name: cat.name,
        imageUrl: cat.imageUrl,
        accentColor: cat.accentColor,
        sortOrder: index,
        isActive: true,
      },
    });

    for (const [subIndex, sub] of cat.subs.entries()) {
      const existing = await prisma.marketplaceSubcategory.findFirst({
        where: { categoryId: row.id, slug: sub.slug },
      });
      if (existing) {
        await prisma.marketplaceSubcategory.update({
          where: { id: existing.id },
          data: {
            name: sub.name,
            sortOrder: subIndex,
            isActive: true,
          },
        });
      } else {
        await prisma.marketplaceSubcategory.create({
          data: {
            categoryId: row.id,
            slug: sub.slug,
            name: sub.name,
            sortOrder: subIndex,
            isActive: true,
          },
        });
      }
    }
  }

  const keepSlugs = CATEGORY_DEFS.map((c) => c.slug);
  await prisma.marketplaceCategory.updateMany({
    where: { slug: { notIn: keepSlugs } },
    data: { isActive: false },
  });
  console.log(`Seeded ${CATEGORY_DEFS.length} marketplace categories`);
}

export async function seedProducts(prisma: PrismaClient): Promise<void> {
  const families = await prisma.measureFamily.findMany();
  const familyBySlug = Object.fromEntries(families.map((f) => [f.slug, f]));
  const units = await prisma.measureUnit.findMany();
  const unitBySlug = Object.fromEntries(units.map((u) => [u.slug, u]));
  const categories = await prisma.marketplaceCategory.findMany({
    include: { subcategories: true },
  });
  const categoryBySlug = Object.fromEntries(categories.map((c) => [c.slug, c]));

  const catalogSlugs = ALL_PRODUCTS.map((p) => p.slug);
  let created = 0;
  let updated = 0;

  for (const [index, def] of ALL_PRODUCTS.entries()) {
    await upsertProduct(
      prisma,
      def,
      index,
      familyBySlug,
      unitBySlug,
      categoryBySlug,
    );
    const existed = await prisma.marketplaceProduct.findUnique({
      where: { slug: def.slug },
      select: { createdAt: true, updatedAt: true },
    });
    if (existed && existed.createdAt.getTime() === existed.updatedAt.getTime()) {
      created += 1;
    } else {
      updated += 1;
    }
  }

  await prisma.marketplaceProduct.updateMany({
    where: { slug: { notIn: catalogSlugs } },
    data: { isActive: false },
  });

  console.log(
    `Upserted ${ALL_PRODUCTS.length} products (${created} new-looking, ${updated} updated) and deactivated leftovers`,
  );
}

async function upsertProduct(
  prisma: PrismaClient,
  def: SeedProductDef,
  sortOrder: number,
  familyBySlug: Record<string, { id: string }>,
  unitBySlug: Record<string, { id: string; milligrams: number | null; millilitres: number | null; piecesPerUnit: number | null }>,
  categoryBySlug: Record<
    string,
    { id: string; subcategories: Array<{ id: string; slug: string }> }
  >,
): Promise<void> {
  const category = categoryBySlug[def.categorySlug];
  if (!category) {
    throw new Error(`Unknown category slug ${def.categorySlug} for ${def.slug}`);
  }
  const subcategory = category.subcategories.find(
    (s) => s.slug === def.subcategorySlug,
  );
  if (!subcategory) {
    throw new Error(
      `Unknown subcategory ${def.subcategorySlug} in ${def.categorySlug} for ${def.slug}`,
    );
  }
  const family = familyBySlug[def.familySlug];
  if (!family) {
    throw new Error(`Unknown measure family ${def.familySlug} for ${def.slug}`);
  }

  const product = await prisma.marketplaceProduct.upsert({
    where: { slug: def.slug },
    create: {
      slug: def.slug,
      categoryId: category.id,
      subcategoryId: subcategory.id,
      measureFamilyId: family.id,
      name: def.name,
      imageUrl: def.imageUrl,
      description: def.description,
      origin: def.origin,
      recipeUnitOverrideMg: def.recipeUnitOverrideMg ?? null,
      recipeUnitOverrideMl: def.recipeUnitOverrideMl ?? null,
      nutritionFacts: def.nutritionFacts ?? {},
      tags: def.tags,
      sortOrder,
      isVerified: def.isVerified ?? true,
      isActive: true,
    },
    update: {
      categoryId: category.id,
      subcategoryId: subcategory.id,
      measureFamilyId: family.id,
      name: def.name,
      imageUrl: def.imageUrl,
      description: def.description,
      origin: def.origin,
      recipeUnitOverrideMg: def.recipeUnitOverrideMg ?? null,
      recipeUnitOverrideMl: def.recipeUnitOverrideMl ?? null,
      nutritionFacts: def.nutritionFacts ?? {},
      tags: def.tags,
      sortOrder,
      isVerified: def.isVerified ?? true,
      isActive: true,
    },
  });

  const keepSkus: string[] = [];
  for (const [packIndex, pack] of def.packs.entries()) {
    const unit = unitBySlug[pack.unitSlug];
    if (!unit) {
      throw new Error(`Unknown pack unit ${pack.unitSlug} for ${def.slug}`);
    }
    const amounts = packAmountsFromUnit(pack.packAmount, unit);
    const sku = pack.sku ?? `${def.slug}-${pack.unitSlug}-${pack.packAmount}-${packIndex}`;
    keepSkus.push(sku);
    await prisma.productPack.upsert({
      where: { sku },
      create: {
        sku,
        productId: product.id,
        packUnitId: unit.id,
        brand: pack.brand,
        packAmount: pack.packAmount,
        amountMg: amounts.amountMg,
        amountMl: amounts.amountMl,
        amountEach: amounts.amountEach,
        packageLabel: pack.packageLabel,
        imageUrl: def.imageUrl,
        priceKobo: pack.priceKobo,
        retailPriceKobo: pack.retailPriceKobo,
        sortOrder: packIndex,
        isActive: true,
      },
      update: {
        productId: product.id,
        packUnitId: unit.id,
        brand: pack.brand,
        packAmount: pack.packAmount,
        amountMg: amounts.amountMg,
        amountMl: amounts.amountMl,
        amountEach: amounts.amountEach,
        packageLabel: pack.packageLabel,
        imageUrl: def.imageUrl,
        priceKobo: pack.priceKobo,
        retailPriceKobo: pack.retailPriceKobo,
        sortOrder: packIndex,
        isActive: true,
      },
    });
  }

  await prisma.productPack.updateMany({
    where: { productId: product.id, sku: { notIn: keepSkus } },
    data: { isActive: false },
  });
}
