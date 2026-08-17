import {
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import {
  WishlistItemResponseDto,
  WishlistListResponseDto,
  WishlistStatusDto,
} from './dto/wishlist-response.dto';

type WishlistRow = {
  id: string;
  productId: string;
  priceKoboAtSave: number;
  createdAt: Date;
  product: {
    name: string;
    imageUrl: string;
    bulkAllocationClaimedPercent: number;
    isActive: boolean;
    packs: Array<{
      id: string;
      brand: string;
      packageLabel: string;
      priceKobo: number;
      retailPriceKobo: number;
      isActive: boolean;
    }>;
  };
};

const productSelect = {
  name: true,
  imageUrl: true,
  bulkAllocationClaimedPercent: true,
  isActive: true,
  packs: {
    where: { isActive: true },
    orderBy: { priceKobo: 'asc' as const },
    select: {
      id: true,
      brand: true,
      packageLabel: true,
      priceKobo: true,
      retailPriceKobo: true,
      isActive: true,
    },
  },
};

@Injectable()
export class WishlistService {
  constructor(private readonly prisma: PrismaService) {}

  async list(userId: string): Promise<WishlistListResponseDto> {
    const rows = await this.prisma.wishlistItem.findMany({
      where: {
        userId,
        product: { isActive: true },
      },
      include: { product: { select: productSelect } },
      orderBy: { createdAt: 'desc' },
    });

    const items = rows.map((row) => this.toItemDto(row));
    return {
      items,
      total: items.length,
      priceDropCount: items.filter((i) => i.priceDropped).length,
    };
  }

  async add(
    userId: string,
    productId: string,
  ): Promise<WishlistItemResponseDto> {
    const product = await this.prisma.marketplaceProduct.findFirst({
      where: { id: productId, isActive: true },
      include: {
        packs: {
          where: { isActive: true },
          orderBy: { priceKobo: 'asc' },
        },
      },
    });
    if (!product) {
      throw new NotFoundException('Product not found');
    }

    const cheapest = product.packs[0];
    const priceKoboAtSave = cheapest?.priceKobo ?? 0;

    const existing = await this.prisma.wishlistItem.findUnique({
      where: { userId_productId: { userId, productId } },
      include: { product: { select: productSelect } },
    });
    if (existing) {
      return this.toItemDto(existing);
    }

    const row = await this.prisma.wishlistItem.create({
      data: {
        userId,
        productId,
        priceKoboAtSave,
      },
      include: { product: { select: productSelect } },
    });
    return this.toItemDto(row);
  }

  async remove(userId: string, productId: string): Promise<WishlistStatusDto> {
    const existing = await this.prisma.wishlistItem.findUnique({
      where: { userId_productId: { userId, productId } },
    });
    if (existing) {
      await this.prisma.wishlistItem.delete({
        where: { id: existing.id },
      });
    }
    return { saved: false };
  }

  async status(
    userId: string,
    productId: string,
  ): Promise<WishlistStatusDto> {
    const existing = await this.prisma.wishlistItem.findUnique({
      where: { userId_productId: { userId, productId } },
      select: { id: true },
    });
    return { saved: Boolean(existing) };
  }

  private toItemDto(row: WishlistRow): WishlistItemResponseDto {
    const cheapest = row.product.packs[0];
    const priceKobo = cheapest?.priceKobo ?? 0;
    const dropAmountKobo = Math.max(0, row.priceKoboAtSave - priceKobo);
    return {
      id: row.id,
      productId: row.productId,
      packId: cheapest?.id ?? null,
      name: row.product.name,
      brand: cheapest?.brand ?? '',
      packageLabel: cheapest
        ? `from ${cheapest.packageLabel}`
        : '',
      imageUrl: row.product.imageUrl,
      priceKobo,
      retailPriceKobo: cheapest?.retailPriceKobo ?? 0,
      bulkAllocationClaimedPercent: row.product.bulkAllocationClaimedPercent,
      priceKoboAtSave: row.priceKoboAtSave,
      priceDropped: dropAmountKobo > 0,
      dropAmountKobo,
      savedAt: row.createdAt.toISOString(),
    };
  }
}
