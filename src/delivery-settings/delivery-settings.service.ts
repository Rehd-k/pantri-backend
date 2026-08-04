import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { DeliverySettingsResponseDto } from './dto/delivery-settings-response.dto';
import { UpdateDeliverySettingsDto } from './dto/update-delivery-settings.dto';

const DEFAULT_ID = 'default';
/** ₦50,000 */
const DEFAULT_FREE_DELIVERY_MIN_KOBO = 5_000_000;
/** ₦2,000 */
const DEFAULT_DELIVERY_FEE_KOBO = 200_000;

@Injectable()
export class DeliverySettingsService {
  constructor(private readonly prisma: PrismaService) {}

  async getSettings(): Promise<DeliverySettingsResponseDto> {
    const row = await this.ensureDefaults();
    return this.toDto(row);
  }

  async updateSettings(
    dto: UpdateDeliverySettingsDto,
  ): Promise<DeliverySettingsResponseDto> {
    await this.ensureDefaults();
    const row = await this.prisma.platformDeliverySettings.update({
      where: { id: DEFAULT_ID },
      data: {
        ...(dto.freeDeliveryMinKobo !== undefined
          ? { freeDeliveryMinKobo: dto.freeDeliveryMinKobo }
          : {}),
        ...(dto.deliveryFeeKobo !== undefined
          ? { deliveryFeeKobo: dto.deliveryFeeKobo }
          : {}),
      },
    });
    return this.toDto(row);
  }

  async ensureDefaults(): Promise<{
    id: string;
    freeDeliveryMinKobo: number;
    deliveryFeeKobo: number;
    updatedAt: Date;
  }> {
    return this.prisma.platformDeliverySettings.upsert({
      where: { id: DEFAULT_ID },
      create: {
        id: DEFAULT_ID,
        freeDeliveryMinKobo: DEFAULT_FREE_DELIVERY_MIN_KOBO,
        deliveryFeeKobo: DEFAULT_DELIVERY_FEE_KOBO,
      },
      update: {},
    });
  }

  private toDto(row: {
    id: string;
    freeDeliveryMinKobo: number;
    deliveryFeeKobo: number;
    updatedAt: Date;
  }): DeliverySettingsResponseDto {
    return {
      id: row.id,
      freeDeliveryMinKobo: row.freeDeliveryMinKobo,
      deliveryFeeKobo: row.deliveryFeeKobo,
      updatedAt: row.updatedAt.toISOString(),
    };
  }
}
