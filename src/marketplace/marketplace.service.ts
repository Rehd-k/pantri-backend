import { Injectable, NotFoundException } from '@nestjs/common';
import type {
  MarketplaceBanner,
  MarketplaceCategory,
} from '../../generated/prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { BannerResponseDto } from './dto/banner-response.dto';
import { CategoryResponseDto } from './dto/category-response.dto';
import { CreateBannerDto } from './dto/create-banner.dto';
import { CreateCategoryDto } from './dto/create-category.dto';
import { UpdateBannerDto } from './dto/update-banner.dto';
import { UpdateCategoryDto } from './dto/update-category.dto';

@Injectable()
export class MarketplaceService {
  constructor(private readonly prisma: PrismaService) {}

  listActiveCategories(): Promise<CategoryResponseDto[]> {
    return this.prisma.marketplaceCategory
      .findMany({
        where: { isActive: true },
        orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }],
      })
      .then((rows) => rows.map((row) => this.toCategoryDto(row)));
  }

  listActiveBanners(): Promise<BannerResponseDto[]> {
    return this.prisma.marketplaceBanner
      .findMany({
        where: { isActive: true },
        orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }],
      })
      .then((rows) => rows.map((row) => this.toBannerDto(row)));
  }

  listAllCategories(): Promise<CategoryResponseDto[]> {
    return this.prisma.marketplaceCategory
      .findMany({
        orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }],
      })
      .then((rows) => rows.map((row) => this.toCategoryDto(row)));
  }

  listAllBanners(): Promise<BannerResponseDto[]> {
    return this.prisma.marketplaceBanner
      .findMany({
        orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }],
      })
      .then((rows) => rows.map((row) => this.toBannerDto(row)));
  }

  async createCategory(dto: CreateCategoryDto): Promise<CategoryResponseDto> {
    const sortOrder =
      dto.sortOrder ?? (await this.nextCategorySortOrder());

    const row = await this.prisma.marketplaceCategory.create({
      data: {
        name: dto.name,
        imageUrl: dto.imageUrl,
        accentColor: dto.accentColor,
        sortOrder,
        isActive: dto.isActive ?? true,
      },
    });

    return this.toCategoryDto(row);
  }

  async updateCategory(
    id: string,
    dto: UpdateCategoryDto,
  ): Promise<CategoryResponseDto> {
    await this.requireCategory(id);

    const row = await this.prisma.marketplaceCategory.update({
      where: { id },
      data: {
        ...(dto.name !== undefined ? { name: dto.name } : {}),
        ...(dto.imageUrl !== undefined ? { imageUrl: dto.imageUrl } : {}),
        ...(dto.accentColor !== undefined
          ? { accentColor: dto.accentColor }
          : {}),
        ...(dto.sortOrder !== undefined ? { sortOrder: dto.sortOrder } : {}),
        ...(dto.isActive !== undefined ? { isActive: dto.isActive } : {}),
      },
    });

    return this.toCategoryDto(row);
  }

  async deactivateCategory(id: string): Promise<CategoryResponseDto> {
    await this.requireCategory(id);

    const row = await this.prisma.marketplaceCategory.update({
      where: { id },
      data: { isActive: false },
    });

    return this.toCategoryDto(row);
  }

  async createBanner(dto: CreateBannerDto): Promise<BannerResponseDto> {
    const sortOrder = dto.sortOrder ?? (await this.nextBannerSortOrder());

    const row = await this.prisma.marketplaceBanner.create({
      data: {
        badgeLabel: dto.badgeLabel,
        title: dto.title,
        subtitle: dto.subtitle,
        ctaLabel: dto.ctaLabel,
        ctaRoute: dto.ctaRoute ?? null,
        gradientStart: dto.gradientStart,
        gradientEnd: dto.gradientEnd,
        sortOrder,
        isActive: dto.isActive ?? true,
      },
    });

    return this.toBannerDto(row);
  }

  async updateBanner(
    id: string,
    dto: UpdateBannerDto,
  ): Promise<BannerResponseDto> {
    await this.requireBanner(id);

    const row = await this.prisma.marketplaceBanner.update({
      where: { id },
      data: {
        ...(dto.badgeLabel !== undefined ? { badgeLabel: dto.badgeLabel } : {}),
        ...(dto.title !== undefined ? { title: dto.title } : {}),
        ...(dto.subtitle !== undefined ? { subtitle: dto.subtitle } : {}),
        ...(dto.ctaLabel !== undefined ? { ctaLabel: dto.ctaLabel } : {}),
        ...(dto.ctaRoute !== undefined ? { ctaRoute: dto.ctaRoute } : {}),
        ...(dto.gradientStart !== undefined
          ? { gradientStart: dto.gradientStart }
          : {}),
        ...(dto.gradientEnd !== undefined
          ? { gradientEnd: dto.gradientEnd }
          : {}),
        ...(dto.sortOrder !== undefined ? { sortOrder: dto.sortOrder } : {}),
        ...(dto.isActive !== undefined ? { isActive: dto.isActive } : {}),
      },
    });

    return this.toBannerDto(row);
  }

  async deactivateBanner(id: string): Promise<BannerResponseDto> {
    await this.requireBanner(id);

    const row = await this.prisma.marketplaceBanner.update({
      where: { id },
      data: { isActive: false },
    });

    return this.toBannerDto(row);
  }

  private async requireCategory(id: string): Promise<MarketplaceCategory> {
    const row = await this.prisma.marketplaceCategory.findUnique({
      where: { id },
    });
    if (!row) {
      throw new NotFoundException('Category not found');
    }
    return row;
  }

  private async requireBanner(id: string): Promise<MarketplaceBanner> {
    const row = await this.prisma.marketplaceBanner.findUnique({
      where: { id },
    });
    if (!row) {
      throw new NotFoundException('Banner not found');
    }
    return row;
  }

  private async nextCategorySortOrder(): Promise<number> {
    const last = await this.prisma.marketplaceCategory.findFirst({
      orderBy: { sortOrder: 'desc' },
      select: { sortOrder: true },
    });
    return (last?.sortOrder ?? -1) + 1;
  }

  private async nextBannerSortOrder(): Promise<number> {
    const last = await this.prisma.marketplaceBanner.findFirst({
      orderBy: { sortOrder: 'desc' },
      select: { sortOrder: true },
    });
    return (last?.sortOrder ?? -1) + 1;
  }

  private toCategoryDto(row: MarketplaceCategory): CategoryResponseDto {
    return {
      id: row.id,
      name: row.name,
      imageUrl: row.imageUrl,
      accentColor: row.accentColor,
      sortOrder: row.sortOrder,
      isActive: row.isActive,
      createdAt: row.createdAt.toISOString(),
      updatedAt: row.updatedAt.toISOString(),
    };
  }

  private toBannerDto(row: MarketplaceBanner): BannerResponseDto {
    return {
      id: row.id,
      badgeLabel: row.badgeLabel,
      title: row.title,
      subtitle: row.subtitle,
      ctaLabel: row.ctaLabel,
      ctaRoute: row.ctaRoute,
      gradientStart: row.gradientStart,
      gradientEnd: row.gradientEnd,
      sortOrder: row.sortOrder,
      isActive: row.isActive,
      createdAt: row.createdAt.toISOString(),
      updatedAt: row.updatedAt.toISOString(),
    };
  }
}
