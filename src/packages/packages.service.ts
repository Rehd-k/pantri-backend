import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  PackageKind,
  PackageVisibility,
  Prisma,
} from '../../generated/prisma/client';
import { CartResponseDto } from '../cart/dto/cart-response.dto';
import { CartService } from '../cart/cart.service';
import { MediaService } from '../media/media.service';
import { PrismaService } from '../prisma/prisma.service';
import {
  CreateAdminPackageDto,
  CreateCommunityPackageDto,
  CreateDiscountTierDto,
  PackageItemInputDto,
  UpdateAdminPackageDto,
  UpdateCommunityPackageDto,
  UpdateDiscountTierDto,
} from './dto/package-request.dto';
import {
  DiscountTierDto,
  MinePackagesResponseDto,
  PackageItemResponseDto,
  PackageListItemDto,
  PackageResponseDto,
  PackageSubscriptionResponseDto,
} from './dto/package-response.dto';
import { PackagePricingService } from './package-pricing.service';

const packageInclude = {
  items: {
    include: {
      pack: {
        include: {
          product: {
            select: {
              id: true,
              name: true,
              imageUrl: true,
              isActive: true,
            },
          },
        },
      },
    },
    orderBy: { sortOrder: 'asc' as const },
  },
  createdBy: {
    select: { id: true, firstName: true, lastName: true },
  },
} satisfies Prisma.PantryPackageInclude;

type PackageWithRelations = Prisma.PantryPackageGetPayload<{
  include: typeof packageInclude;
}>;

@Injectable()
export class PackagesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly pricing: PackagePricingService,
    private readonly cartService: CartService,
    private readonly media: MediaService,
  ) {}

  async listPackages(includeCommunity = false): Promise<PackageListItemDto[]> {
    const packages = await this.prisma.pantryPackage.findMany({
      where: {
        isActive: true,
        OR: [
          { kind: PackageKind.CURATED, visibility: PackageVisibility.PUBLIC },
          ...(includeCommunity
            ? [
                {
                  kind: PackageKind.COMMUNITY,
                  visibility: PackageVisibility.PUBLIC,
                },
              ]
            : []),
        ],
      },
      include: packageInclude,
      orderBy: [{ sortOrder: 'asc' }, { createdAt: 'desc' }],
    });

    return Promise.all(packages.map((pkg) => this.toListItem(pkg)));
  }

  async getById(
    id: string,
    viewerId?: string,
  ): Promise<PackageResponseDto> {
    const pkg = await this.findPackageOrThrow(id);
    this.assertCanView(pkg, viewerId);
    return this.toDetail(pkg);
  }

  async getByShareSlug(slug: string): Promise<PackageResponseDto> {
    const pkg = await this.prisma.pantryPackage.findUnique({
      where: { shareSlug: slug },
      include: packageInclude,
    });
    if (!pkg || !pkg.isActive) {
      throw new NotFoundException('Package not found');
    }
    if (
      pkg.visibility === PackageVisibility.PRIVATE ||
      (pkg.kind === PackageKind.CURATED && !pkg.isActive)
    ) {
      throw new NotFoundException('Package not found');
    }
    if (
      pkg.visibility !== PackageVisibility.PUBLIC &&
      pkg.visibility !== PackageVisibility.UNLISTED
    ) {
      throw new NotFoundException('Package not found');
    }
    return this.toDetail(pkg);
  }

  async listMine(userId: string): Promise<MinePackagesResponseDto> {
    const [packages, subscriptions] = await Promise.all([
      this.prisma.pantryPackage.findMany({
        where: { createdByUserId: userId },
        include: packageInclude,
        orderBy: { updatedAt: 'desc' },
      }),
      this.prisma.packageSubscription.findMany({
        where: { userId },
        include: { package: { select: { name: true } } },
        orderBy: { createdAt: 'desc' },
      }),
    ]);

    return {
      packages: await Promise.all(packages.map((p) => this.toListItem(p))),
      subscriptions: subscriptions.map(
        (s): PackageSubscriptionResponseDto => ({
          id: s.id,
          packageId: s.packageId,
          packageName: s.package.name,
          status: s.status,
          snapshot: s.snapshot as Record<string, unknown>,
          createdAt: s.createdAt.toISOString(),
        }),
      ),
    };
  }

  async createCommunity(
    userId: string,
    dto: CreateCommunityPackageDto,
  ): Promise<PackageResponseDto> {
    await this.assertPacksExist(dto.items);
    const shareSlug = await this.uniqueSlug(dto.name);

    const pkg = await this.prisma.pantryPackage.create({
      data: {
        kind: PackageKind.COMMUNITY,
        name: dto.name.trim(),
        description: dto.description?.trim() ?? '',
        coverImageUrl: dto.coverImageUrl,
        visibility: dto.visibility,
        shareSlug,
        createdByUserId: userId,
        isActive: true,
        items: {
          create: dto.items.map((item, index) => ({
            packId: item.packId,
            quantity: item.quantity,
            sortOrder: item.sortOrder ?? index,
          })),
        },
      },
      include: packageInclude,
    });

    return this.toDetail(pkg);
  }

  async updateCommunity(
    userId: string,
    id: string,
    dto: UpdateCommunityPackageDto,
  ): Promise<PackageResponseDto> {
    const existing = await this.findPackageOrThrow(id);
    if (
      existing.kind !== PackageKind.COMMUNITY ||
      existing.createdByUserId !== userId
    ) {
      throw new ForbiddenException('You can only edit your own packages');
    }

    if (dto.items) {
      await this.assertPacksExist(dto.items);
    }

    const pkg = await this.prisma.$transaction(async (tx) => {
      if (dto.items) {
        await tx.packageItem.deleteMany({ where: { packageId: id } });
        await tx.packageItem.createMany({
          data: dto.items.map((item, index) => ({
            packageId: id,
            packId: item.packId,
            quantity: item.quantity,
            sortOrder: item.sortOrder ?? index,
          })),
        });
      }

      return tx.pantryPackage.update({
        where: { id },
        data: {
          ...(dto.name !== undefined ? { name: dto.name.trim() } : {}),
          ...(dto.description !== undefined
            ? { description: dto.description.trim() }
            : {}),
          ...(dto.coverImageUrl !== undefined
            ? { coverImageUrl: dto.coverImageUrl }
            : {}),
          ...(dto.visibility !== undefined
            ? { visibility: dto.visibility }
            : {}),
        },
        include: packageInclude,
      });
    });

    return this.toDetail(pkg);
  }

  async customizePreview(
    id: string,
    items: PackageItemInputDto[] | undefined,
    viewerId?: string,
  ): Promise<PackageResponseDto> {
    const pkg = await this.findPackageOrThrow(id);
    this.assertCanView(pkg, viewerId);
    const resolved =
      items?.length && items.length > 0
        ? items
        : pkg.items.map((i) => ({
            packId: i.packId,
            quantity: i.quantity,
            sortOrder: i.sortOrder,
          }));
    await this.assertPacksExist(resolved);

    const packs = await this.prisma.productPack.findMany({
      where: {
        id: { in: resolved.map((i) => i.packId) },
        isActive: true,
        product: { isActive: true },
      },
      include: {
        product: { select: { id: true, name: true, imageUrl: true } },
      },
    });
    const byId = Object.fromEntries(packs.map((p) => [p.id, p]));

    const syntheticItems: PackageItemResponseDto[] = resolved.map(
      (item, index) => {
        const pack = byId[item.packId];
        if (!pack) {
          throw new BadRequestException(`Pack not found: ${item.packId}`);
        }
        return {
          id: `preview-${index}`,
          packId: pack.id,
          productId: pack.product.id,
          quantity: item.quantity,
          sortOrder: item.sortOrder ?? index,
          name: pack.product.name,
          brand: pack.brand,
          packageLabel: pack.packageLabel,
          imageUrl: pack.imageUrl || pack.product.imageUrl,
          priceKobo: pack.priceKobo,
          retailPriceKobo: pack.retailPriceKobo,
          lineWholesaleKobo: pack.priceKobo * item.quantity,
          lineRetailKobo: pack.retailPriceKobo * item.quantity,
        };
      },
    );

    const pricing = await this.pricing.computePricing(
      syntheticItems.map((i) => ({
        packId: i.packId,
        quantity: i.quantity,
        priceKobo: i.priceKobo,
        retailPriceKobo: i.retailPriceKobo,
      })),
    );

    const detail = await this.toDetail(pkg);
    return {
      ...detail,
      items: syntheticItems,
      itemCount: syntheticItems.length,
      itemSummary: this.buildItemSummary(syntheticItems),
      pricing,
    };
  }

  async addToCart(
    userId: string,
    id: string,
    overrides?: PackageItemInputDto[],
  ): Promise<CartResponseDto> {
    const pkg = await this.findPackageOrThrow(id);
    this.assertCanView(pkg, userId);

    const lines =
      overrides?.length && overrides.length > 0
        ? overrides
        : pkg.items.map((i) => ({
            packId: i.packId,
            quantity: i.quantity,
          }));

    await this.assertPacksExist(lines);

    for (const line of lines) {
      await this.cartService.addItem(userId, {
        packId: line.packId,
        quantity: line.quantity,
      });
    }

    return this.cartService.getCart(userId);
  }

  async subscribe(
    userId: string,
    id: string,
    overrides?: PackageItemInputDto[],
  ): Promise<PackageSubscriptionResponseDto> {
    const preview = await this.customizePreview(id, overrides, userId);

    const snapshot = JSON.parse(
      JSON.stringify({
        packageName: preview.name,
        items: preview.items,
        pricing: preview.pricing,
        subtotalKobo: preview.pricing.retailSubtotalKobo,
        discountPercent: preview.pricing.discountPercent,
        totalKobo: preview.pricing.totalKobo,
      }),
    ) as Prisma.InputJsonValue;

    const subscription = await this.prisma.packageSubscription.create({
      data: {
        userId,
        packageId: id,
        status: 'PENDING',
        snapshot,
      },
      include: { package: { select: { name: true } } },
    });

    return {
      id: subscription.id,
      packageId: subscription.packageId,
      packageName: subscription.package.name,
      status: subscription.status,
      snapshot: subscription.snapshot as Record<string, unknown>,
      createdAt: subscription.createdAt.toISOString(),
    };
  }

  // ── Admin curated packages ──────────────────────────────────────────

  async adminListPackages(): Promise<PackageListItemDto[]> {
    const packages = await this.prisma.pantryPackage.findMany({
      where: { kind: PackageKind.CURATED },
      include: packageInclude,
      orderBy: [{ sortOrder: 'asc' }, { createdAt: 'desc' }],
    });
    return Promise.all(packages.map((p) => this.toListItem(p)));
  }

  async adminCreatePackage(
    dto: CreateAdminPackageDto,
  ): Promise<PackageResponseDto> {
    await this.assertPacksExist(dto.items);
    const shareSlug = await this.uniqueSlug(dto.name);

    const pkg = await this.prisma.pantryPackage.create({
      data: {
        kind: PackageKind.CURATED,
        name: dto.name.trim(),
        description: dto.description?.trim() ?? '',
        coverImageUrl: dto.coverImageUrl,
        isPopular: dto.isPopular ?? false,
        sortOrder: dto.sortOrder ?? 0,
        isActive: dto.isActive ?? true,
        visibility: PackageVisibility.PUBLIC,
        shareSlug,
        items: {
          create: dto.items.map((item, index) => ({
            packId: item.packId,
            quantity: item.quantity,
            sortOrder: item.sortOrder ?? index,
          })),
        },
      },
      include: packageInclude,
    });

    return this.toDetail(pkg);
  }

  async adminUpdatePackage(
    id: string,
    dto: UpdateAdminPackageDto,
  ): Promise<PackageResponseDto> {
    const existing = await this.findPackageOrThrow(id);
    if (existing.kind !== PackageKind.CURATED) {
      throw new BadRequestException('Only curated packages can be edited here');
    }

    if (dto.items) {
      await this.assertPacksExist(dto.items);
    }

    const pkg = await this.prisma.$transaction(async (tx) => {
      if (dto.items) {
        await tx.packageItem.deleteMany({ where: { packageId: id } });
        await tx.packageItem.createMany({
          data: dto.items.map((item, index) => ({
            packageId: id,
            packId: item.packId,
            quantity: item.quantity,
            sortOrder: item.sortOrder ?? index,
          })),
        });
      }

      return tx.pantryPackage.update({
        where: { id },
        data: {
          ...(dto.name !== undefined ? { name: dto.name.trim() } : {}),
          ...(dto.description !== undefined
            ? { description: dto.description.trim() }
            : {}),
          ...(dto.coverImageUrl !== undefined
            ? { coverImageUrl: dto.coverImageUrl }
            : {}),
          ...(dto.isPopular !== undefined ? { isPopular: dto.isPopular } : {}),
          ...(dto.sortOrder !== undefined ? { sortOrder: dto.sortOrder } : {}),
          ...(dto.isActive !== undefined ? { isActive: dto.isActive } : {}),
        },
        include: packageInclude,
      });
    });

    return this.toDetail(pkg);
  }

  async adminDeactivatePackage(id: string): Promise<PackageResponseDto> {
    const existing = await this.findPackageOrThrow(id);
    if (existing.kind !== PackageKind.CURATED) {
      throw new BadRequestException('Only curated packages can be deactivated');
    }
    const pkg = await this.prisma.pantryPackage.update({
      where: { id },
      data: { isActive: false },
      include: packageInclude,
    });
    return this.toDetail(pkg);
  }

  // ── Discount tiers ──────────────────────────────────────────────────

  async listTiers(activeOnly = true): Promise<DiscountTierDto[]> {
    const tiers = await this.prisma.packageDiscountTier.findMany({
      where: activeOnly ? { isActive: true } : undefined,
      orderBy: { minSpendKobo: 'asc' },
    });
    return tiers.map((t) => this.toTierDto(t));
  }

  async createTier(dto: CreateDiscountTierDto): Promise<DiscountTierDto> {
    const tier = await this.prisma.packageDiscountTier.create({
      data: {
        label: dto.label.trim(),
        minSpendKobo: dto.minSpendKobo,
        discountPercent: dto.discountPercent,
        sortOrder: dto.sortOrder ?? 0,
        isActive: dto.isActive ?? true,
      },
    });
    return this.toTierDto(tier);
  }

  async updateTier(
    id: string,
    dto: UpdateDiscountTierDto,
  ): Promise<DiscountTierDto> {
    await this.findTierOrThrow(id);
    const tier = await this.prisma.packageDiscountTier.update({
      where: { id },
      data: {
        ...(dto.label !== undefined ? { label: dto.label.trim() } : {}),
        ...(dto.minSpendKobo !== undefined
          ? { minSpendKobo: dto.minSpendKobo }
          : {}),
        ...(dto.discountPercent !== undefined
          ? { discountPercent: dto.discountPercent }
          : {}),
        ...(dto.sortOrder !== undefined ? { sortOrder: dto.sortOrder } : {}),
        ...(dto.isActive !== undefined ? { isActive: dto.isActive } : {}),
      },
    });
    return this.toTierDto(tier);
  }

  async deactivateTier(id: string): Promise<DiscountTierDto> {
    await this.findTierOrThrow(id);
    const tier = await this.prisma.packageDiscountTier.update({
      where: { id },
      data: { isActive: false },
    });
    return this.toTierDto(tier);
  }

  // ── Helpers ─────────────────────────────────────────────────────────

  private async findPackageOrThrow(id: string): Promise<PackageWithRelations> {
    const pkg = await this.prisma.pantryPackage.findUnique({
      where: { id },
      include: packageInclude,
    });
    if (!pkg) {
      throw new NotFoundException('Package not found');
    }
    return pkg;
  }

  private async findTierOrThrow(id: string) {
    const tier = await this.prisma.packageDiscountTier.findUnique({
      where: { id },
    });
    if (!tier) {
      throw new NotFoundException('Discount tier not found');
    }
    return tier;
  }

  private assertCanView(pkg: PackageWithRelations, viewerId?: string): void {
    if (pkg.kind === PackageKind.CURATED && pkg.isActive) {
      return;
    }
    if (pkg.visibility === PackageVisibility.PUBLIC && pkg.isActive) {
      return;
    }
    if (
      pkg.visibility === PackageVisibility.UNLISTED &&
      pkg.isActive &&
      viewerId
    ) {
      return;
    }
    if (viewerId && pkg.createdByUserId === viewerId) {
      return;
    }
    throw new NotFoundException('Package not found');
  }

  private async assertPacksExist(
    items: PackageItemInputDto[],
  ): Promise<void> {
    const ids = [...new Set(items.map((i) => i.packId))];
    if (ids.length === 0) {
      throw new BadRequestException('At least one item is required');
    }
    const count = await this.prisma.productPack.count({
      where: {
        id: { in: ids },
        isActive: true,
        product: { isActive: true },
      },
    });
    if (count !== ids.length) {
      throw new BadRequestException('One or more packs are invalid');
    }
  }

  private async uniqueSlug(name: string): Promise<string> {
    const base = name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '')
      .slice(0, 48) || 'package';
    let candidate = base;
    let n = 0;
    while (await this.prisma.pantryPackage.findUnique({ where: { shareSlug: candidate } })) {
      n += 1;
      candidate = `${base}-${n}`;
    }
    return candidate;
  }

  private buildItemSummary(
    items: Array<{ name: string; packageLabel: string; quantity: number }>,
  ): string {
    return items
      .slice(0, 5)
      .map((i) =>
        i.quantity > 1
          ? `${i.quantity}× ${i.name} (${i.packageLabel})`
          : `${i.name} (${i.packageLabel})`,
      )
      .join(', ');
  }

  private toTierDto(tier: {
    id: string;
    label: string;
    minSpendKobo: number;
    discountPercent: number;
    sortOrder: number;
    isActive: boolean;
  }): DiscountTierDto {
    return {
      id: tier.id,
      label: tier.label,
      minSpendKobo: tier.minSpendKobo,
      discountPercent: tier.discountPercent,
      sortOrder: tier.sortOrder,
      isActive: tier.isActive,
    };
  }

  private mapItems(
    pkg: PackageWithRelations,
  ): PackageItemResponseDto[] {
    return pkg.items
      .filter((i) => i.pack.isActive && i.pack.product.isActive)
      .map((item) => ({
        id: item.id,
        packId: item.packId,
        productId: item.pack.product.id,
        quantity: item.quantity,
        sortOrder: item.sortOrder,
        name: item.pack.product.name,
        brand: item.pack.brand,
        packageLabel: item.pack.packageLabel,
        imageUrl: item.pack.imageUrl || item.pack.product.imageUrl,
        priceKobo: item.pack.priceKobo,
        retailPriceKobo: item.pack.retailPriceKobo,
        lineWholesaleKobo: item.pack.priceKobo * item.quantity,
        lineRetailKobo: item.pack.retailPriceKobo * item.quantity,
      }));
  }

  private async toListItem(
    pkg: PackageWithRelations,
  ): Promise<PackageListItemDto> {
    const items = this.mapItems(pkg);
    const pricing = await this.pricing.computePricing(
      items.map((i) => ({
        packId: i.packId,
        quantity: i.quantity,
        priceKobo: i.priceKobo,
        retailPriceKobo: i.retailPriceKobo,
      })),
    );
    const shareUrl = `${this.media.getShareBaseUrl()}/p/${pkg.shareSlug}`;

    return {
      id: pkg.id,
      kind: pkg.kind,
      name: pkg.name,
      description: pkg.description,
      coverImageUrl: pkg.coverImageUrl,
      isPopular: pkg.isPopular,
      visibility: pkg.visibility,
      shareSlug: pkg.shareSlug,
      shareUrl,
      itemSummary: this.buildItemSummary(items),
      itemCount: items.length,
      pricing,
      createdBy: pkg.createdBy
        ? {
            id: pkg.createdBy.id,
            firstName: pkg.createdBy.firstName,
            lastName: pkg.createdBy.lastName,
          }
        : null,
    };
  }

  private async toDetail(
    pkg: PackageWithRelations,
  ): Promise<PackageResponseDto> {
    const list = await this.toListItem(pkg);
    const items = this.mapItems(pkg);
    return {
      ...list,
      sortOrder: pkg.sortOrder,
      isActive: pkg.isActive,
      createdByUserId: pkg.createdByUserId,
      shareBannerUrl: this.media.buildShareBannerUrl(
        pkg.coverImageUrl,
        pkg.name,
      ),
      items,
      createdAt: pkg.createdAt.toISOString(),
      updatedAt: pkg.updatedAt.toISOString(),
    };
  }
}
