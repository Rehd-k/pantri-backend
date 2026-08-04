import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import type {
  MarketplaceProduct,
  MarketplaceSubcategory,
  Prisma,
} from '../../generated/prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { CreateProductDto } from './dto/create-product.dto';
import { CreateSubcategoryDto } from './dto/create-subcategory.dto';
import { ListProductsQueryDto } from './dto/list-products-query.dto';
import { PerfectForItemDto } from './dto/perfect-for-item.dto';
import { ProductListResponseDto } from './dto/product-list-response.dto';
import {
  ProductResponseDto,
  RatingDistributionDto,
} from './dto/product-response.dto';
import { SubcategoryResponseDto } from './dto/subcategory-response.dto';
import { UpdateProductDto } from './dto/update-product.dto';
import { UpdateSubcategoryDto } from './dto/update-subcategory.dto';
import { MarketplaceReviewsService } from './marketplace-reviews.service';

type ProductWithRelations = MarketplaceProduct & {
  category: { id: string; name: string };
  subcategory: { id: string; name: string };
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

@Injectable()
export class MarketplaceCatalogService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly reviewsService: MarketplaceReviewsService,
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

    const row = await this.prisma.marketplaceSubcategory.create({
      data: {
        categoryId: dto.categoryId,
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
    await this.requireSubcategory(id);
    const row = await this.prisma.marketplaceSubcategory.update({
      where: { id },
      data: {
        ...(dto.name !== undefined ? { name: dto.name } : {}),
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
    const take = query.take ?? 40;
    const skip = query.skip ?? 0;
    const where = this.buildProductWhere(query, true);

    const [rows, total] = await Promise.all([
      this.prisma.marketplaceProduct.findMany({
        where,
        include: {
          category: { select: { id: true, name: true } },
          subcategory: { select: { id: true, name: true } },
        },
        orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }],
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

  async listAllProducts(
    query: ListProductsQueryDto,
  ): Promise<ProductListResponseDto> {
    const take = query.take ?? 100;
    const skip = query.skip ?? 0;
    const where = this.buildProductWhere(query, false);

    const [rows, total] = await Promise.all([
      this.prisma.marketplaceProduct.findMany({
        where,
        include: {
          category: { select: { id: true, name: true } },
          subcategory: { select: { id: true, name: true } },
        },
        orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }],
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

  async getActiveProduct(id: string): Promise<ProductResponseDto> {
    const row = await this.prisma.marketplaceProduct.findFirst({
      where: { id, isActive: true },
      include: {
        category: { select: { id: true, name: true } },
        subcategory: { select: { id: true, name: true } },
      },
    });
    if (!row) {
      throw new NotFoundException('Product not found');
    }
    const aggregates =
      await this.reviewsService.computeRatingAggregates(id);
    return this.toProductDto(row, aggregates);
  }

  async createProduct(dto: CreateProductDto): Promise<ProductResponseDto> {
    await this.assertSubcategoryBelongsToCategory(
      dto.subcategoryId,
      dto.categoryId,
    );
    if (dto.retailPriceKobo < dto.priceKobo) {
      throw new BadRequestException(
        'retailPriceKobo must be greater than or equal to priceKobo',
      );
    }

    const sortOrder =
      dto.sortOrder ?? (await this.nextProductSortOrder(dto.categoryId));

    const row = await this.prisma.marketplaceProduct.create({
      data: {
        categoryId: dto.categoryId,
        subcategoryId: dto.subcategoryId,
        name: dto.name,
        brand: dto.brand,
        packageLabel: dto.packageLabel,
        imageUrl: dto.imageUrl,
        priceKobo: dto.priceKobo,
        retailPriceKobo: dto.retailPriceKobo,
        description: dto.description?.trim() ?? '',
        origin: dto.origin?.trim() ?? '',
        expiresAt: this.parseExpiresAt(dto.expiresAt),
        isVerified: dto.isVerified ?? false,
        bulkAllocationClaimedPercent: dto.bulkAllocationClaimedPercent ?? 0,
        nutritionFacts: this.normalizeNutritionFacts(dto.nutritionFacts),
        perfectFor: this.normalizePerfectFor(dto.perfectFor),
        tags: (dto.tags ?? []).map((t) => t.trim()).filter(Boolean),
        sortOrder,
        isActive: dto.isActive ?? true,
      },
      include: {
        category: { select: { id: true, name: true } },
        subcategory: { select: { id: true, name: true } },
      },
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

    const priceKobo = dto.priceKobo ?? existing.priceKobo;
    const retailPriceKobo = dto.retailPriceKobo ?? existing.retailPriceKobo;
    if (retailPriceKobo < priceKobo) {
      throw new BadRequestException(
        'retailPriceKobo must be greater than or equal to priceKobo',
      );
    }

    const row = await this.prisma.marketplaceProduct.update({
      where: { id },
      data: {
        ...(dto.categoryId !== undefined ? { categoryId: dto.categoryId } : {}),
        ...(dto.subcategoryId !== undefined
          ? { subcategoryId: dto.subcategoryId }
          : {}),
        ...(dto.name !== undefined ? { name: dto.name } : {}),
        ...(dto.brand !== undefined ? { brand: dto.brand } : {}),
        ...(dto.packageLabel !== undefined
          ? { packageLabel: dto.packageLabel }
          : {}),
        ...(dto.imageUrl !== undefined ? { imageUrl: dto.imageUrl } : {}),
        ...(dto.priceKobo !== undefined ? { priceKobo: dto.priceKobo } : {}),
        ...(dto.retailPriceKobo !== undefined
          ? { retailPriceKobo: dto.retailPriceKobo }
          : {}),
        ...(dto.description !== undefined
          ? { description: dto.description.trim() }
          : {}),
        ...(dto.origin !== undefined ? { origin: dto.origin.trim() } : {}),
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
      include: {
        category: { select: { id: true, name: true } },
        subcategory: { select: { id: true, name: true } },
      },
    });
    const aggregates =
      await this.reviewsService.computeRatingAggregates(id);
    return this.toProductDto(row, aggregates);
  }

  async deactivateProduct(id: string): Promise<ProductResponseDto> {
    await this.requireProduct(id);
    const row = await this.prisma.marketplaceProduct.update({
      where: { id },
      data: { isActive: false },
      include: {
        category: { select: { id: true, name: true } },
        subcategory: { select: { id: true, name: true } },
      },
    });
    const aggregates =
      await this.reviewsService.computeRatingAggregates(id);
    return this.toProductDto(row, aggregates);
  }

  private buildProductWhere(
    query: ListProductsQueryDto,
    activeOnly: boolean,
  ): Prisma.MarketplaceProductWhereInput {
    const where: Prisma.MarketplaceProductWhereInput = {};
    if (activeOnly) {
      where.isActive = true;
    }
    if (query.categoryId) {
      where.categoryId = query.categoryId;
    }
    if (query.subcategoryId) {
      where.subcategoryId = query.subcategoryId;
    }

    const q = query.q?.trim();
    if (q) {
      where.OR = [
        { name: { contains: q, mode: 'insensitive' } },
        { brand: { contains: q, mode: 'insensitive' } },
        { packageLabel: { contains: q, mode: 'insensitive' } },
        { tags: { has: q.toLowerCase() } },
        { tags: { hasSome: [q, q.toLowerCase(), q.toUpperCase()] } },
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
            { brand: { contains: token, mode: 'insensitive' as const } },
            { tags: { has: token.toLowerCase() } },
          ]),
        ];
      }
    }

    return where;
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
      categoryId: row.categoryId,
      name: row.name,
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
    return {
      id: row.id,
      categoryId: row.categoryId,
      categoryName: row.category.name,
      subcategoryId: row.subcategoryId,
      subcategoryName: row.subcategory.name,
      name: row.name,
      brand: row.brand,
      packageLabel: row.packageLabel,
      imageUrl: row.imageUrl,
      priceKobo: row.priceKobo,
      retailPriceKobo: row.retailPriceKobo,
      discountPercent: this.computeDiscountPercent(
        row.priceKobo,
        row.retailPriceKobo,
      ),
      description: row.description,
      origin: row.origin,
      expiresAt: row.expiresAt?.toISOString() ?? null,
      isVerified: row.isVerified,
      bulkAllocationClaimedPercent: row.bulkAllocationClaimedPercent,
      nutritionFacts: this.parseNutritionFacts(row.nutritionFacts),
      perfectFor: this.parsePerfectFor(row.perfectFor),
      tags: row.tags,
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
