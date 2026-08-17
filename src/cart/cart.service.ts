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
    packId: string;
    quantity: number;
    unitPriceKobo: number;
    pack: {
      brand: string;
      packageLabel: string;
      imageUrl: string;
      retailPriceKobo: number;
      isActive: boolean;
      priceKobo: number;
      product: {
        id: string;
        name: string;
        isActive: boolean;
        imageUrl: string;
      };
    };
  }>;
};

const cartItemInclude = {
  items: {
    include: {
      pack: {
        include: {
          product: {
            select: {
              id: true,
              name: true,
              isActive: true,
              imageUrl: true,
            },
          },
        },
      },
    },
    orderBy: { createdAt: 'asc' as const },
  },
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
    const pack = await this.prisma.productPack.findFirst({
      where: {
        id: dto.packId,
        isActive: true,
        product: { isActive: true },
      },
    });
    if (!pack) {
      throw new NotFoundException('Pack not found');
    }

    const quantity = dto.quantity ?? 1;
    const cart = await this.getOrCreateCart(userId);

    const existing = await this.prisma.cartItem.findUnique({
      where: {
        cartId_packId: { cartId: cart.id, packId: pack.id },
      },
    });

    if (existing) {
      await this.prisma.cartItem.update({
        where: { id: existing.id },
        data: {
          quantity: existing.quantity + quantity,
          unitPriceKobo: pack.priceKobo,
        },
      });
    } else {
      await this.prisma.cartItem.create({
        data: {
          cartId: cart.id,
          packId: pack.id,
          quantity,
          unitPriceKobo: pack.priceKobo,
        },
      });
    }

    return this.getCart(userId);
  }

  async updateItem(
    userId: string,
    packId: string,
    dto: UpdateCartItemDto,
  ): Promise<CartResponseDto> {
    const cart = await this.getOrCreateCart(userId);
    const item = await this.prisma.cartItem.findUnique({
      where: {
        cartId_packId: { cartId: cart.id, packId },
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

  async removeItem(userId: string, packId: string): Promise<CartResponseDto> {
    const cart = await this.getOrCreateCart(userId);
    const item = await this.prisma.cartItem.findUnique({
      where: {
        cartId_packId: { cartId: cart.id, packId },
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
      include: cartItemInclude,
    });

    if (existing) {
      return existing;
    }

    return this.prisma.cart.create({
      data: { userId },
      include: cartItemInclude,
    });
  }

  private async toCartDto(cart: CartWithItems): Promise<CartResponseDto> {
    const items: CartItemResponseDto[] = cart.items.map((item) => {
      const available = item.pack.isActive && item.pack.product.isActive;
      const unitPrice = available ? item.pack.priceKobo : item.unitPriceKobo;
      return {
        id: item.id,
        packId: item.packId,
        productId: item.pack.product.id,
        name: item.pack.product.name,
        brand: item.pack.brand,
        packageLabel: item.pack.packageLabel,
        imageUrl: item.pack.imageUrl || item.pack.product.imageUrl,
        quantity: item.quantity,
        unitPriceKobo: unitPrice,
        lineTotalKobo: unitPrice * item.quantity,
        retailPriceKobo: item.pack.retailPriceKobo,
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
