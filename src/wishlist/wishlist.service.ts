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
    brand: string;
    packageLabel: string;
    imageUrl: string;
    priceKobo: number;
    retailPriceKobo: number;
    bulkAllocationClaimedPercent: number;
    isActive: boolean;
  };
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
      include: {
        product: {
          select: {
            name: true,
            brand: true,
            packageLabel: true,
            imageUrl: true,
            priceKobo: true,
            retailPriceKobo: true,
            bulkAllocationClaimedPercent: true,
            isActive: true,
          },
        },
      },
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
    });
    if (!product) {
      throw new NotFoundException('Product not found');
    }

    const existing = await this.prisma.wishlistItem.findUnique({
      where: { userId_productId: { userId, productId } },
      include: {
        product: {
          select: {
            name: true,
            brand: true,
            packageLabel: true,
            imageUrl: true,
            priceKobo: true,
            retailPriceKobo: true,
            bulkAllocationClaimedPercent: true,
            isActive: true,
          },
        },
      },
    });
    if (existing) {
      return this.toItemDto(existing);
    }

    const row = await this.prisma.wishlistItem.create({
      data: {
        userId,
        productId,
        priceKoboAtSave: product.priceKobo,
      },
      include: {
        product: {
          select: {
            name: true,
            brand: true,
            packageLabel: true,
            imageUrl: true,
            priceKobo: true,
            retailPriceKobo: true,
            bulkAllocationClaimedPercent: true,
            isActive: true,
          },
        },
      },
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
    const dropAmountKobo = Math.max(
      0,
      row.priceKoboAtSave - row.product.priceKobo,
    );
    return {
      id: row.id,
      productId: row.productId,
      name: row.product.name,
      brand: row.product.brand,
      packageLabel: row.product.packageLabel,
      imageUrl: row.product.imageUrl,
      priceKobo: row.product.priceKobo,
      retailPriceKobo: row.product.retailPriceKobo,
      bulkAllocationClaimedPercent: row.product.bulkAllocationClaimedPercent,
      priceKoboAtSave: row.priceKoboAtSave,
      priceDropped: dropAmountKobo > 0,
      dropAmountKobo,
      savedAt: row.createdAt.toISOString(),
    };
  }
}
