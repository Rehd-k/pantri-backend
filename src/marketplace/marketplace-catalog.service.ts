import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import type {
  MarketplaceProduct,
  MarketplaceSubcategory,
  MeasureFamily,
  MeasureUnit,
  Prisma,
  ProductPack,
} from '../../generated/prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { slugify } from '../common/slug';
import { parseNutritionFacts } from '../common/nutrition-facts';
import { packAmountsFromUnit, effectiveRecipeUnit } from '../measure/measure-convert';
import { MeasureService } from '../measure/measure.service';
import { CreateProductDto } from './dto/create-product.dto';
import { CreateSubcategoryDto } from './dto/create-subcategory.dto';
import { ListProductsQueryDto } from './dto/list-products-query.dto';
import { PerfectForItemDto } from './dto/perfect-for-item.dto';
import { ProductListResponseDto } from './dto/product-list-response.dto';
import {
  ProductPackResponseDto,
  ProductResponseDto,
  RatingDistributionDto,
} from './dto/product-response.dto';
import {
  CreateProductPackDto,
  UpdateProductPackDto,
} from './dto/product-pack.dto';
import { SubcategoryResponseDto } from './dto/subcategory-response.dto';
import { UpdateProductDto } from './dto/update-product.dto';
import { UpdateSubcategoryDto } from './dto/update-subcategory.dto';
import { MarketplaceReviewsService } from './marketplace-reviews.service';

type PackWithUnit = ProductPack & { packUnit: MeasureUnit };

type ProductWithRelations = MarketplaceProduct & {
  category: { id: string; name: string };
  subcategory: { id: string; name: string };
  recipeUnit: MeasureUnit | null;
  measureFamily: MeasureFamily & {
    defaultRecipeUnit: MeasureUnit | null;
    defaultPurchaseUnit: MeasureUnit | null;
  };
  packs: PackWithUnit[];
  productAllergens: Array<{ allergy: { id: string; name: string } }>;
};

type RatingAggregates = {
  averageRating: number;
  reviewCount: number;
  ratingDistribution: RatingDistributionDto;
};

const emptyDistribution = (): RatingDistributionDto => ({
  star1: 0,
  star2: 0,
  star3: 0,
  star4: 0,
  star5: 0,
});

const productInclude = {
  category: { select: { id: true, name: true } },
  subcategory: { select: { id: true, name: true } },
  recipeUnit: true,
  measureFamily: {
    include: {
      defaultRecipeUnit: true,
      defaultPurchaseUnit: true,
    },
  },
  packs: {
    include: { packUnit: true },
    orderBy: [{ sortOrder: 'asc' as const }, { packageLabel: 'asc' as const }],
  },
  productAllergens: {
    include: { allergy: { select: { id: true, name: true } } },
  },
} satisfies Prisma.MarketplaceProductInclude;

@Injectable()
export class MarketplaceCatalogService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly reviewsService: MarketplaceReviewsService,
    private readonly measureService: MeasureService,
  ) {}

  listActiveSubcategories(
    categoryId: string,
  ): Promise<SubcategoryResponseDto[]> {
    return this.prisma.marketplaceSubcategory
      .findMany({
        where: { categoryId, isActive: true },
        orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }],
      })
      .then((rows) => rows.map((row) => this.toSubcategoryDto(row)));
  }

  listAllSubcategories(
    categoryId?: string,
  ): Promise<SubcategoryResponseDto[]> {
    return this.prisma.marketplaceSubcategory
      .findMany({
        where: categoryId ? { categoryId } : undefined,
        orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }],
      })
      .then((rows) => rows.map((row) => this.toSubcategoryDto(row)));
  }

  async createSubcategory(
    dto: CreateSubcategoryDto,
  ): Promise<SubcategoryResponseDto> {
    await this.requireCategory(dto.categoryId);
    const sortOrder =
      dto.sortOrder ?? (await this.nextSubcategorySortOrder(dto.categoryId));
    const slug = await this.uniqueSubcategorySlug(
      dto.categoryId,
      dto.slug || dto.name,
    );

    const row = await this.prisma.marketplaceSubcategory.create({
      data: {
        categoryId: dto.categoryId,
        slug,
        name: dto.name,
        sortOrder,
        isActive: dto.isActive ?? true,
      },
    });
    return this.toSubcategoryDto(row);
  }

  async updateSubcategory(
    id: string,
    dto: UpdateSubcategoryDto,
  ): Promise<SubcategoryResponseDto> {
    const existing = await this.requireSubcategory(id);
    const slug =
      dto.slug !== undefined
        ? await this.uniqueSubcategorySlug(
            existing.categoryId,
            dto.slug,
            existing.id,
          )
        : undefined;
    const row = await this.prisma.marketplaceSubcategory.update({
      where: { id },
      data: {
        ...(dto.name !== undefined ? { name: dto.name } : {}),
        ...(slug !== undefined ? { slug } : {}),
        ...(dto.sortOrder !== undefined ? { sortOrder: dto.sortOrder } : {}),
        ...(dto.isActive !== undefined ? { isActive: dto.isActive } : {}),
      },
    });
    return this.toSubcategoryDto(row);
  }

  async deactivateSubcategory(id: string): Promise<SubcategoryResponseDto> {
    await this.requireSubcategory(id);
    const row = await this.prisma.marketplaceSubcategory.update({
      where: { id },
      data: { isActive: false },
    });
    return this.toSubcategoryDto(row);
  }

  async listActiveProducts(
    query: ListProductsQueryDto,
  ): Promise<ProductListResponseDto> {
    return this.listProducts(query, true);
  }

  async listAllProducts(
    query: ListProductsQueryDto,
  ): Promise<ProductListResponseDto> {
    return this.listProducts(query, false);
  }

  async getActiveProduct(id: string): Promise<ProductResponseDto> {
    const row = await this.prisma.marketplaceProduct.findFirst({
      where: { id, isActive: true },
      include: productInclude,
    });
    if (!row) {
      throw new NotFoundException('Product not found');
    }
    const aggregates = await this.reviewsService.computeRatingAggregates(id);
    return this.toProductDto(row, aggregates);
  }

  async getProduct(id: string): Promise<ProductResponseDto> {
    const row = await this.prisma.marketplaceProduct.findUnique({
      where: { id },
      include: productInclude,
    });
    if (!row) {
      throw new NotFoundException('Product not found');
    }
    const aggregates = await this.reviewsService.computeRatingAggregates(id);
    return this.toProductDto(row, aggregates);
  }

  async createProduct(dto: CreateProductDto): Promise<ProductResponseDto> {
    await this.assertSubcategoryBelongsToCategory(
      dto.subcategoryId,
      dto.categoryId,
    );
    const family = await this.prisma.measureFamily.findUnique({
      where: { id: dto.measureFamilyId },
    });
    if (!family) {
      throw new NotFoundException('Measure family not found');
    }
    const recipeUnitId = await this.resolveRecipeUnitId(
      family.dimension,
      dto.recipeUnitId,
      family.defaultRecipeUnitId,
    );

    const sortOrder =
      dto.sortOrder ?? (await this.nextProductSortOrder(dto.categoryId));
    const slug = await this.uniqueProductSlug(dto.slug || dto.name);

    const row = await this.prisma.$transaction(async (tx) => {
      const product = await tx.marketplaceProduct.create({
        data: {
          slug,
          categoryId: dto.categoryId,
          subcategoryId: dto.subcategoryId,
          measureFamilyId: dto.measureFamilyId,
          recipeUnitId,
          name: dto.name,
          imageUrl: dto.imageUrl,
          description: dto.description?.trim() ?? '',
          origin: dto.origin?.trim() ?? '',
          recipeUnitOverrideMg: dto.recipeUnitOverrideMg ?? null,
          recipeUnitOverrideMl: dto.recipeUnitOverrideMl ?? null,
          expiresAt: this.parseExpiresAt(dto.expiresAt),
          isVerified: dto.isVerified ?? false,
          bulkAllocationClaimedPercent: dto.bulkAllocationClaimedPercent ?? 0,
          nutritionFacts: this.normalizeNutritionFacts(dto.nutritionFacts),
          perfectFor: this.normalizePerfectFor(dto.perfectFor),
          tags: (dto.tags ?? []).map((t) => t.trim()).filter(Boolean),
          sortOrder,
          isActive: dto.isActive ?? true,
        },
      });

      if (dto.packs?.length) {
        for (const [index, pack] of dto.packs.entries()) {
          await this.insertPack(tx, product.id, product.imageUrl, pack, index);
        }
      }

      return tx.marketplaceProduct.findUniqueOrThrow({
        where: { id: product.id },
        include: productInclude,
      });
    });

    return this.toProductDto(row, {
      averageRating: 0,
      reviewCount: 0,
      ratingDistribution: emptyDistribution(),
    });
  }

  async updateProduct(
    id: string,
    dto: UpdateProductDto,
  ): Promise<ProductResponseDto> {
    const existing = await this.requireProduct(id);
    const categoryId = dto.categoryId ?? existing.categoryId;
    const subcategoryId = dto.subcategoryId ?? existing.subcategoryId;
    await this.assertSubcategoryBelongsToCategory(subcategoryId, categoryId);
    const familyId = dto.measureFamilyId ?? existing.measureFamilyId;
    const family = await this.prisma.measureFamily.findUnique({
      where: { id: familyId },
    });
    if (!family) {
      throw new NotFoundException('Measure family not found');
    }
    const recipeUnitId = await this.resolveRecipeUnitId(
      family.dimension,
      dto.recipeUnitId !== undefined ? dto.recipeUnitId : existing.recipeUnitId,
      family.defaultRecipeUnitId,
    );
    const slug =
      dto.slug !== undefined
        ? await this.uniqueProductSlug(dto.slug, existing.id)
        : undefined;

    const row = await this.prisma.marketplaceProduct.update({
      where: { id },
      data: {
        ...(dto.categoryId !== undefined ? { categoryId: dto.categoryId } : {}),
        ...(dto.subcategoryId !== undefined
          ? { subcategoryId: dto.subcategoryId }
          : {}),
        ...(dto.measureFamilyId !== undefined
          ? { measureFamilyId: dto.measureFamilyId }
          : {}),
        recipeUnitId,
        ...(dto.name !== undefined ? { name: dto.name } : {}),
        ...(slug !== undefined ? { slug } : {}),
        ...(dto.imageUrl !== undefined ? { imageUrl: dto.imageUrl } : {}),
        ...(dto.description !== undefined
          ? { description: dto.description.trim() }
          : {}),
        ...(dto.origin !== undefined ? { origin: dto.origin.trim() } : {}),
        ...(dto.recipeUnitOverrideMg !== undefined
          ? { recipeUnitOverrideMg: dto.recipeUnitOverrideMg }
          : {}),
        ...(dto.recipeUnitOverrideMl !== undefined
          ? { recipeUnitOverrideMl: dto.recipeUnitOverrideMl }
          : {}),
        ...(dto.expiresAt !== undefined
          ? { expiresAt: this.parseExpiresAt(dto.expiresAt) }
          : {}),
        ...(dto.isVerified !== undefined
          ? { isVerified: dto.isVerified }
          : {}),
        ...(dto.bulkAllocationClaimedPercent !== undefined
          ? {
              bulkAllocationClaimedPercent: dto.bulkAllocationClaimedPercent,
            }
          : {}),
        ...(dto.nutritionFacts !== undefined
          ? {
              nutritionFacts: this.normalizeNutritionFacts(dto.nutritionFacts),
            }
          : {}),
        ...(dto.perfectFor !== undefined
          ? { perfectFor: this.normalizePerfectFor(dto.perfectFor) }
          : {}),
        ...(dto.tags !== undefined
          ? { tags: dto.tags.map((t) => t.trim()).filter(Boolean) }
          : {}),
        ...(dto.sortOrder !== undefined ? { sortOrder: dto.sortOrder } : {}),
        ...(dto.isActive !== undefined ? { isActive: dto.isActive } : {}),
      },
      include: productInclude,
    });
    const aggregates = await this.reviewsService.computeRatingAggregates(id);
    return this.toProductDto(row, aggregates);
  }

  async deactivateProduct(id: string): Promise<ProductResponseDto> {
    await this.requireProduct(id);
    const row = await this.prisma.marketplaceProduct.update({
      where: { id },
      data: { isActive: false },
      include: productInclude,
    });
    const aggregates = await this.reviewsService.computeRatingAggregates(id);
    return this.toProductDto(row, aggregates);
  }

  async createPack(
    productId: string,
    dto: CreateProductPackDto,
  ): Promise<ProductPackResponseDto> {
    const product = await this.requireProduct(productId);
    const created = await this.prisma.$transaction(async (tx) => {
      const sortOrder = dto.sortOrder ?? (await this.nextPackSortOrder(productId));
      return this.insertPack(
        tx,
        product.id,
        product.imageUrl,
        { ...dto, sortOrder },
        sortOrder,
      );
    });
    return this.toPackDto(created);
  }

  async updatePack(
    packId: string,
    dto: UpdateProductPackDto,
  ): Promise<ProductPackResponseDto> {
    const existing = await this.prisma.productPack.findUnique({
      where: { id: packId },
      include: { packUnit: true },
    });
    if (!existing) {
      throw new NotFoundException('Pack not found');
    }
    if (
      dto.retailPriceKobo !== undefined ||
      dto.priceKobo !== undefined
    ) {
      const price = dto.priceKobo ?? existing.priceKobo;
      const retail = dto.retailPriceKobo ?? existing.retailPriceKobo;
      if (retail < price) {
        throw new BadRequestException(
          'retailPriceKobo must be greater than or equal to priceKobo',
        );
      }
    }

    let amounts = {
      amountMg: dto.amountMg !== undefined ? dto.amountMg : existing.amountMg,
      amountMl: dto.amountMl !== undefined ? dto.amountMl : existing.amountMl,
      amountEach:
        dto.amountEach !== undefined ? dto.amountEach : existing.amountEach,
    };
    if (dto.packUnitId || dto.packAmount) {
      const unit = await this.measureService.requireUnit(
        dto.packUnitId ?? existing.packUnitId,
      );
      const computed = packAmountsFromUnit(
        dto.packAmount ?? existing.packAmount,
        unit,
      );
      amounts = {
        amountMg: dto.amountMg !== undefined ? dto.amountMg : computed.amountMg,
        amountMl: dto.amountMl !== undefined ? dto.amountMl : computed.amountMl,
        amountEach:
          dto.amountEach !== undefined ? dto.amountEach : computed.amountEach,
      };
    }

    const row = await this.prisma.productPack.update({
      where: { id: packId },
      data: {
        ...(dto.brand !== undefined ? { brand: dto.brand.trim() } : {}),
        ...(dto.packUnitId !== undefined ? { packUnitId: dto.packUnitId } : {}),
        ...(dto.packAmount !== undefined ? { packAmount: dto.packAmount } : {}),
        ...(dto.packageLabel !== undefined
          ? { packageLabel: dto.packageLabel.trim() }
          : {}),
        ...(dto.priceKobo !== undefined ? { priceKobo: dto.priceKobo } : {}),
        ...(dto.retailPriceKobo !== undefined
          ? { retailPriceKobo: dto.retailPriceKobo }
          : {}),
        ...(dto.imageUrl !== undefined ? { imageUrl: dto.imageUrl } : {}),
        amountMg: amounts.amountMg,
        amountMl: amounts.amountMl,
        amountEach: amounts.amountEach,
        ...(dto.sortOrder !== undefined ? { sortOrder: dto.sortOrder } : {}),
        ...(dto.isActive !== undefined ? { isActive: dto.isActive } : {}),
      },
      include: { packUnit: true },
    });
    return this.toPackDto(row);
  }

  async deactivatePack(packId: string): Promise<ProductPackResponseDto> {
    const existing = await this.prisma.productPack.findUnique({
      where: { id: packId },
    });
    if (!existing) {
      throw new NotFoundException('Pack not found');
    }
    const row = await this.prisma.productPack.update({
      where: { id: packId },
      data: { isActive: false },
      include: { packUnit: true },
    });
    return this.toPackDto(row);
  }

  private async listProducts(
    query: ListProductsQueryDto,
    activeOnly: boolean,
  ): Promise<ProductListResponseDto> {
    const take = Math.min(query.take ?? (activeOnly ? 40 : 24), 100);
    const skip = query.skip ?? 0;
    const where = this.buildProductWhere(query, activeOnly);

    const [rows, total] = await Promise.all([
      this.prisma.marketplaceProduct.findMany({
        where,
        include: productInclude,
        orderBy: this.buildProductOrderBy(query),
        skip,
        take,
      }),
      this.prisma.marketplaceProduct.count({ where }),
    ]);

    return {
      items: await this.toProductDtos(rows),
      total,
    };
  }

  private buildProductOrderBy(
    query: ListProductsQueryDto,
  ): Prisma.MarketplaceProductOrderByWithRelationInput[] {
    const direction = query.order === 'desc' ? 'desc' : 'asc';
    switch (query.sort) {
      case 'name':
        return [{ name: direction }, { createdAt: 'asc' }];
      case 'createdAt':
        return [{ createdAt: direction }];
      case 'updatedAt':
        return [{ updatedAt: direction }];
      case 'sortOrder':
      default:
        return [
          { sortOrder: query.order ? direction : 'asc' },
          { createdAt: 'asc' },
        ];
    }
  }

  private buildProductWhere(
    query: ListProductsQueryDto,
    activeOnly: boolean,
  ): Prisma.MarketplaceProductWhereInput {
    const where: Prisma.MarketplaceProductWhereInput = {};
    if (activeOnly) {
      where.isActive = true;
    } else if (query.isActive !== undefined) {
      where.isActive = query.isActive;
    }
    if (query.isVerified !== undefined) {
      where.isVerified = query.isVerified;
    }
    if (query.categoryId) {
      where.categoryId = query.categoryId;
    }
    if (query.subcategoryId) {
      where.subcategoryId = query.subcategoryId;
    }

    const origin = query.origin?.trim();
    if (origin) {
      where.origin = { contains: origin, mode: 'insensitive' };
    }

    const tag = query.tag?.trim();
    if (tag) {
      where.tags = {
        hasSome: [tag, tag.toLowerCase(), tag.toUpperCase()],
      };
    }

    const packSome: Prisma.ProductPackWhereInput = {};
    if (
      query.minPriceKobo !== undefined ||
      query.maxPriceKobo !== undefined
    ) {
      packSome.isActive = true;
      packSome.priceKobo = {
        ...(query.minPriceKobo !== undefined
          ? { gte: query.minPriceKobo }
          : {}),
        ...(query.maxPriceKobo !== undefined
          ? { lte: query.maxPriceKobo }
          : {}),
      };
    }

    if (query.hasPacks === false) {
      where.packs = { none: {} };
    } else if (
      query.hasPacks === true ||
      Object.keys(packSome).length > 0
    ) {
      where.packs = {
        some: Object.keys(packSome).length > 0 ? packSome : {},
      };
    }

    const q = query.q?.trim();
    if (q) {
      where.OR = [
        { name: { contains: q, mode: 'insensitive' } },
        { slug: { contains: q, mode: 'insensitive' } },
        { origin: { contains: q, mode: 'insensitive' } },
        { tags: { has: q.toLowerCase() } },
        { tags: { hasSome: [q, q.toLowerCase(), q.toUpperCase()] } },
        {
          packs: {
            some: {
              brand: { contains: q, mode: 'insensitive' },
            },
          },
        },
        {
          packs: {
            some: {
              sku: { contains: q, mode: 'insensitive' },
            },
          },
        },
        {
          packs: {
            some: {
              packageLabel: { contains: q, mode: 'insensitive' },
            },
          },
        },
        {
          category: {
            name: { contains: q, mode: 'insensitive' },
          },
        },
        {
          subcategory: {
            name: { contains: q, mode: 'insensitive' },
          },
        },
      ];

      const tokens = q.split(/\s+/).filter((t) => t.length > 1);
      if (tokens.length > 1) {
        where.OR = [
          ...(where.OR ?? []),
          ...tokens.flatMap((token) => [
            { name: { contains: token, mode: 'insensitive' as const } },
            { tags: { has: token.toLowerCase() } },
            {
              packs: {
                some: {
                  brand: { contains: token, mode: 'insensitive' as const },
                },
              },
            },
          ]),
        ];
      }
    }

    return where;
  }

  private async insertPack(
    tx: Prisma.TransactionClient,
    productId: string,
    productImageUrl: string,
    dto: CreateProductPackDto,
    index: number,
  ): Promise<PackWithUnit> {
    if (dto.retailPriceKobo < dto.priceKobo) {
      throw new BadRequestException(
        'retailPriceKobo must be greater than or equal to priceKobo',
      );
    }
    const unit = await tx.measureUnit.findUnique({
      where: { id: dto.packUnitId },
    });
    if (!unit) {
      throw new NotFoundException('Pack unit not found');
    }
    const computed = packAmountsFromUnit(dto.packAmount, unit);
    const sku = await this.uniquePackSku(
      tx,
      dto.sku || `${productId}-${slugify(dto.packageLabel)}`,
    );
    return tx.productPack.create({
      data: {
        sku,
        productId,
        packUnitId: dto.packUnitId,
        brand: dto.brand.trim(),
        packAmount: dto.packAmount,
        amountMg: dto.amountMg ?? computed.amountMg,
        amountMl: dto.amountMl ?? computed.amountMl,
        amountEach: dto.amountEach ?? computed.amountEach,
        packageLabel: dto.packageLabel.trim(),
        imageUrl: dto.imageUrl?.trim() || productImageUrl,
        priceKobo: dto.priceKobo,
        retailPriceKobo: dto.retailPriceKobo,
        sortOrder: dto.sortOrder ?? index,
        isActive: dto.isActive ?? true,
      },
      include: { packUnit: true },
    });
  }

  private async resolveRecipeUnitId(
    familyDimension: string,
    requestedId: string | null | undefined,
    familyDefaultId: string | null,
  ): Promise<string | null> {
    const candidateId = requestedId?.trim() || familyDefaultId;
    if (!candidateId) return null;
    const unit = await this.prisma.measureUnit.findUnique({
      where: { id: candidateId },
    });
    if (!unit) {
      throw new NotFoundException('Recipe unit not found');
    }
    if (unit.dimension !== familyDimension) {
      throw new BadRequestException(
        'Recipe unit must match the measure family (mass, volume, or count)',
      );
    }
    return unit.id;
  }

  private async requireCategory(id: string): Promise<void> {
    const row = await this.prisma.marketplaceCategory.findUnique({
      where: { id },
    });
    if (!row) {
      throw new NotFoundException('Category not found');
    }
  }

  private async requireSubcategory(
    id: string,
  ): Promise<MarketplaceSubcategory> {
    const row = await this.prisma.marketplaceSubcategory.findUnique({
      where: { id },
    });
    if (!row) {
      throw new NotFoundException('Subcategory not found');
    }
    return row;
  }

  private async requireProduct(id: string): Promise<MarketplaceProduct> {
    const row = await this.prisma.marketplaceProduct.findUnique({
      where: { id },
    });
    if (!row) {
      throw new NotFoundException('Product not found');
    }
    return row;
  }

  private async assertSubcategoryBelongsToCategory(
    subcategoryId: string,
    categoryId: string,
  ): Promise<void> {
    await this.requireCategory(categoryId);
    const sub = await this.requireSubcategory(subcategoryId);
    if (sub.categoryId !== categoryId) {
      throw new BadRequestException(
        'Subcategory does not belong to the given category',
      );
    }
  }

  private async nextSubcategorySortOrder(categoryId: string): Promise<number> {
    const last = await this.prisma.marketplaceSubcategory.findFirst({
      where: { categoryId },
      orderBy: { sortOrder: 'desc' },
      select: { sortOrder: true },
    });
    return (last?.sortOrder ?? -1) + 1;
  }

  private async nextProductSortOrder(categoryId: string): Promise<number> {
    const last = await this.prisma.marketplaceProduct.findFirst({
      where: { categoryId },
      orderBy: { sortOrder: 'desc' },
      select: { sortOrder: true },
    });
    return (last?.sortOrder ?? -1) + 1;
  }

  private async nextPackSortOrder(productId: string): Promise<number> {
    const last = await this.prisma.productPack.findFirst({
      where: { productId },
      orderBy: { sortOrder: 'desc' },
      select: { sortOrder: true },
    });
    return (last?.sortOrder ?? -1) + 1;
  }

  private async uniqueProductSlug(
    raw: string,
    excludeId?: string,
  ): Promise<string> {
    const base = slugify(raw, 'product');
    let candidate = base;
    let n = 2;
    while (true) {
      const clash = await this.prisma.marketplaceProduct.findUnique({
        where: { slug: candidate },
        select: { id: true },
      });
      if (!clash || clash.id === excludeId) return candidate;
      candidate = `${base}-${n++}`;
    }
  }

  private async uniqueSubcategorySlug(
    categoryId: string,
    raw: string,
    excludeId?: string,
  ): Promise<string> {
    const base = slugify(raw, 'subcategory');
    let candidate = base;
    let n = 2;
    while (true) {
      const clash = await this.prisma.marketplaceSubcategory.findFirst({
        where: { categoryId, slug: candidate },
        select: { id: true },
      });
      if (!clash || clash.id === excludeId) return candidate;
      candidate = `${base}-${n++}`;
    }
  }

  private async uniquePackSku(
    tx: Prisma.TransactionClient,
    raw: string,
  ): Promise<string> {
    const base = slugify(raw, 'pack');
    let candidate = base;
    let n = 2;
    while (true) {
      const clash = await tx.productPack.findUnique({
        where: { sku: candidate },
        select: { id: true },
      });
      if (!clash) return candidate;
      candidate = `${base}-${n++}`;
    }
  }

  private computeDiscountPercent(
    priceKobo: number,
    retailPriceKobo: number,
  ): number {
    if (retailPriceKobo <= 0 || priceKobo >= retailPriceKobo) {
      return 0;
    }
    return Math.round(((retailPriceKobo - priceKobo) / retailPriceKobo) * 100);
  }

  private parseExpiresAt(
    value: string | null | undefined,
  ): Date | null | undefined {
    if (value === undefined) return undefined;
    if (value === null || value === '') return null;
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) {
      throw new BadRequestException('Invalid expiresAt date');
    }
    return date;
  }

  private normalizeNutritionFacts(
    value?: Record<string, string>,
  ): Prisma.InputJsonValue {
    if (!value) return {};
    const out: Record<string, string> = {};
    for (const [key, raw] of Object.entries(value)) {
      const k = key.trim();
      const v = String(raw ?? '').trim();
      if (k && v) out[k] = v;
    }
    return out;
  }

  private normalizePerfectFor(
    value?: PerfectForItemDto[],
  ): Prisma.InputJsonValue {
    if (!value) return [];
    return value
      .map((item) => ({
        title: item.title.trim(),
        description: item.description.trim(),
        imageUrl: item.imageUrl.trim(),
      }))
      .filter((item) => item.title && item.description && item.imageUrl);
  }

  private parseNutritionFacts(value: Prisma.JsonValue): Record<string, string> {
    if (!value || typeof value !== 'object' || Array.isArray(value)) {
      return {};
    }
    const out: Record<string, string> = {};
    for (const [key, raw] of Object.entries(value)) {
      if (typeof raw === 'string' && key.trim() && raw.trim()) {
        out[key] = raw;
      }
    }
    return out;
  }

  private parsePerfectFor(value: Prisma.JsonValue): PerfectForItemDto[] {
    if (!Array.isArray(value)) return [];
    const items: PerfectForItemDto[] = [];
    for (const entry of value) {
      if (!entry || typeof entry !== 'object' || Array.isArray(entry)) continue;
      const record = entry as Record<string, unknown>;
      const title = String(record.title ?? '').trim();
      const description = String(record.description ?? '').trim();
      const imageUrl = String(record.imageUrl ?? '').trim();
      if (title && description && imageUrl) {
        items.push({ title, description, imageUrl });
      }
    }
    return items;
  }

  private async toProductDtos(
    rows: ProductWithRelations[],
  ): Promise<ProductResponseDto[]> {
    if (rows.length === 0) return [];
    return Promise.all(
      rows.map(async (row) => {
        const aggregates =
          await this.reviewsService.computeRatingAggregates(row.id);
        return this.toProductDto(row, aggregates);
      }),
    );
  }

  private toSubcategoryDto(
    row: MarketplaceSubcategory,
  ): SubcategoryResponseDto {
    return {
      id: row.id,
      slug: row.slug,
      categoryId: row.categoryId,
      name: row.name,
      sortOrder: row.sortOrder,
      isActive: row.isActive,
      createdAt: row.createdAt.toISOString(),
      updatedAt: row.updatedAt.toISOString(),
    };
  }

  private toPackDto(row: PackWithUnit): ProductPackResponseDto {
    return {
      id: row.id,
      sku: row.sku,
      productId: row.productId,
      packUnitId: row.packUnitId,
      packUnit: this.measureService.toUnitDto(row.packUnit),
      brand: row.brand,
      packAmount: row.packAmount,
      amountMg: row.amountMg,
      amountMl: row.amountMl,
      amountEach: row.amountEach,
      packageLabel: row.packageLabel,
      imageUrl: row.imageUrl,
      priceKobo: row.priceKobo,
      retailPriceKobo: row.retailPriceKobo,
      discountPercent: this.computeDiscountPercent(
        row.priceKobo,
        row.retailPriceKobo,
      ),
      sortOrder: row.sortOrder,
      isActive: row.isActive,
      createdAt: row.createdAt.toISOString(),
      updatedAt: row.updatedAt.toISOString(),
    };
  }

  private toProductDto(
    row: ProductWithRelations,
    aggregates: RatingAggregates,
  ): ProductResponseDto {
    const activePacks = row.packs.filter((p) => p.isActive);
    const priced = (activePacks.length > 0 ? activePacks : row.packs).slice();
    priced.sort((a, b) => a.priceKobo - b.priceKobo);
    const cheapest = priced[0];
    const fromPriceKobo = cheapest?.priceKobo ?? 0;
    const fromRetailPriceKobo = cheapest?.retailPriceKobo ?? 0;

    return {
      id: row.id,
      slug: row.slug,
      categoryId: row.categoryId,
      categoryName: row.category.name,
      subcategoryId: row.subcategoryId,
      subcategoryName: row.subcategory.name,
      measureFamilyId: row.measureFamilyId,
      measureFamily: this.measureService.toFamilyDto(row.measureFamily),
      recipeUnitId: row.recipeUnitId,
      recipeUnit: (() => {
        const unit = effectiveRecipeUnit(row);
        return unit ? this.measureService.toUnitDto(unit) : null;
      })(),
      name: row.name,
      imageUrl: row.imageUrl,
      fromPriceKobo,
      fromRetailPriceKobo,
      discountPercent: this.computeDiscountPercent(
        fromPriceKobo,
        fromRetailPriceKobo,
      ),
      description: row.description,
      origin: row.origin,
      recipeUnitOverrideMg: row.recipeUnitOverrideMg,
      recipeUnitOverrideMl: row.recipeUnitOverrideMl,
      expiresAt: row.expiresAt?.toISOString() ?? null,
      isVerified: row.isVerified,
      bulkAllocationClaimedPercent: row.bulkAllocationClaimedPercent,
      nutritionFacts: this.parseNutritionFacts(row.nutritionFacts),
      nutrition: parseNutritionFacts(row.nutritionFacts),
      allergens: row.productAllergens.map((link) => ({
        id: link.allergy.id,
        name: link.allergy.name,
      })),
      perfectFor: this.parsePerfectFor(row.perfectFor),
      tags: row.tags,
      packs: row.packs.map((pack) => this.toPackDto(pack)),
      sortOrder: row.sortOrder,
      isActive: row.isActive,
      averageRating: aggregates.averageRating,
      reviewCount: aggregates.reviewCount,
      ratingDistribution: aggregates.ratingDistribution,
      createdAt: row.createdAt.toISOString(),
      updatedAt: row.updatedAt.toISOString(),
    };
  }
}
