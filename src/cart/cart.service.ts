import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { DeliverySettingsService } from '../delivery-settings/delivery-settings.service';
import { PrismaService } from '../prisma/prisma.service';
import { AddCartItemDto } from './dto/add-cart-item.dto';
import { CartItemResponseDto } from './dto/cart-item-response.dto';
import { CartResponseDto } from './dto/cart-response.dto';
import { UpdateCartItemDto } from './dto/update-cart-item.dto';

type CartWithItems = {
  id: string;
  updatedAt: Date;
  items: Array<{
    id: string;
    productId: string;
    quantity: number;
    unitPriceKobo: number;
    product: {
      name: string;
      brand: string;
      packageLabel: string;
      imageUrl: string;
      retailPriceKobo: number;
      isActive: boolean;
      priceKobo: number;
    };
  }>;
};

@Injectable()
export class CartService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly deliverySettings: DeliverySettingsService,
  ) {}

  async getCart(userId: string): Promise<CartResponseDto> {
    const cart = await this.getOrCreateCart(userId);
    return this.toCartDto(cart);
  }

  async addItem(
    userId: string,
    dto: AddCartItemDto,
  ): Promise<CartResponseDto> {
    const product = await this.prisma.marketplaceProduct.findFirst({
      where: { id: dto.productId, isActive: true },
    });
    if (!product) {
      throw new NotFoundException('Product not found');
    }

    const quantity = dto.quantity ?? 1;
    const cart = await this.getOrCreateCart(userId);

    const existing = await this.prisma.cartItem.findUnique({
      where: {
        cartId_productId: { cartId: cart.id, productId: product.id },
      },
    });

    if (existing) {
      await this.prisma.cartItem.update({
        where: { id: existing.id },
        data: {
          quantity: existing.quantity + quantity,
          unitPriceKobo: product.priceKobo,
        },
      });
    } else {
      await this.prisma.cartItem.create({
        data: {
          cartId: cart.id,
          productId: product.id,
          quantity,
          unitPriceKobo: product.priceKobo,
        },
      });
    }

    return this.getCart(userId);
  }

  async updateItem(
    userId: string,
    productId: string,
    dto: UpdateCartItemDto,
  ): Promise<CartResponseDto> {
    const cart = await this.getOrCreateCart(userId);
    const item = await this.prisma.cartItem.findUnique({
      where: {
        cartId_productId: { cartId: cart.id, productId },
      },
    });
    if (!item) {
      throw new NotFoundException('Cart item not found');
    }

    if (dto.quantity < 1) {
      throw new BadRequestException('Quantity must be at least 1');
    }

    await this.prisma.cartItem.update({
      where: { id: item.id },
      data: { quantity: dto.quantity },
    });

    return this.getCart(userId);
  }

  async removeItem(
    userId: string,
    productId: string,
  ): Promise<CartResponseDto> {
    const cart = await this.getOrCreateCart(userId);
    const item = await this.prisma.cartItem.findUnique({
      where: {
        cartId_productId: { cartId: cart.id, productId },
      },
    });
    if (!item) {
      throw new NotFoundException('Cart item not found');
    }

    await this.prisma.cartItem.delete({ where: { id: item.id } });
    return this.getCart(userId);
  }

  async clearCart(userId: string): Promise<CartResponseDto> {
    const cart = await this.getOrCreateCart(userId);
    await this.prisma.cartItem.deleteMany({ where: { cartId: cart.id } });
    return this.getCart(userId);
  }

  private async getOrCreateCart(userId: string): Promise<CartWithItems> {
    const existing = await this.prisma.cart.findUnique({
      where: { userId },
      include: {
        items: {
          include: {
            product: {
              select: {
                name: true,
                brand: true,
                packageLabel: true,
                imageUrl: true,
                retailPriceKobo: true,
                isActive: true,
                priceKobo: true,
              },
            },
          },
          orderBy: { createdAt: 'asc' },
        },
      },
    });

    if (existing) {
      return existing;
    }

    return this.prisma.cart.create({
      data: { userId },
      include: {
        items: {
          include: {
            product: {
              select: {
                name: true,
                brand: true,
                packageLabel: true,
                imageUrl: true,
                retailPriceKobo: true,
                isActive: true,
                priceKobo: true,
              },
            },
          },
          orderBy: { createdAt: 'asc' },
        },
      },
    });
  }

  private async toCartDto(cart: CartWithItems): Promise<CartResponseDto> {
    const items: CartItemResponseDto[] = cart.items.map((item) => {
      const unitPrice = item.product.isActive
        ? item.product.priceKobo
        : item.unitPriceKobo;
      return {
        id: item.id,
        productId: item.productId,
        name: item.product.name,
        brand: item.product.brand,
        packageLabel: item.product.packageLabel,
        imageUrl: item.product.imageUrl,
        quantity: item.quantity,
        unitPriceKobo: unitPrice,
        lineTotalKobo: unitPrice * item.quantity,
        retailPriceKobo: item.product.retailPriceKobo,
      };
    });

    const itemCount = items.reduce((sum, i) => sum + i.quantity, 0);
    const subtotalKobo = items.reduce((sum, i) => sum + i.lineTotalKobo, 0);

    const settings = await this.deliverySettings.ensureDefaults();
    const freeDeliveryMinKobo = settings.freeDeliveryMinKobo;
    const deliveryFeeKobo = settings.deliveryFeeKobo;
    const qualifiesForFreeDelivery = subtotalKobo >= freeDeliveryMinKobo;
    const appliedDeliveryFeeKobo = qualifiesForFreeDelivery
      ? 0
      : deliveryFeeKobo;
    const amountUntilFreeDeliveryKobo = Math.max(
      0,
      freeDeliveryMinKobo - subtotalKobo,
    );
    const totalKobo = subtotalKobo + appliedDeliveryFeeKobo;

    return {
      id: cart.id,
      items,
      itemCount,
      subtotalKobo,
      freeDeliveryMinKobo,
      deliveryFeeKobo,
      appliedDeliveryFeeKobo,
      amountUntilFreeDeliveryKobo,
      qualifiesForFreeDelivery,
      totalKobo,
      updatedAt: cart.updatedAt.toISOString(),
    };
  }
}
