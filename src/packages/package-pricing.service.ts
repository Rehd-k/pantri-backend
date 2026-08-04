import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { DiscountTierDto, PackagePricingDto } from './dto/package-response.dto';

export type PricedLine = {
  productId: string;
  quantity: number;
  priceKobo: number;
  retailPriceKobo: number;
};

@Injectable()
export class PackagePricingService {
  constructor(private readonly prisma: PrismaService) {}

  async computePricing(lines: PricedLine[]): Promise<PackagePricingDto> {
    const wholesaleSubtotalKobo = lines.reduce(
      (sum, line) => sum + line.priceKobo * line.quantity,
      0,
    );
    const retailSubtotalKobo = lines.reduce(
      (sum, line) => sum + line.retailPriceKobo * line.quantity,
      0,
    );

    const tiers = await this.prisma.packageDiscountTier.findMany({
      where: { isActive: true },
      orderBy: { minSpendKobo: 'asc' },
    });

    const tierDtos: DiscountTierDto[] = tiers.map((t) => ({
      id: t.id,
      label: t.label,
      minSpendKobo: t.minSpendKobo,
      discountPercent: t.discountPercent,
      sortOrder: t.sortOrder,
      isActive: t.isActive,
    }));

    const qualifying = [...tierDtos]
      .filter((t) => retailSubtotalKobo >= t.minSpendKobo)
      .sort((a, b) => b.minSpendKobo - a.minSpendKobo);

    const appliedTier = qualifying[0] ?? null;
    const discountPercent = appliedTier?.discountPercent ?? 0;
    const totalKobo = Math.round(
      retailSubtotalKobo * (1 - discountPercent / 100),
    );
    const savingsKobo = Math.max(0, retailSubtotalKobo - totalKobo);

    const nextTier =
      tierDtos.find((t) => t.minSpendKobo > retailSubtotalKobo) ?? null;

    let nextTierProgress = 1;
    let nextTierRemainingKobo = 0;
    if (nextTier) {
      const prevMin = appliedTier?.minSpendKobo ?? 0;
      const span = Math.max(1, nextTier.minSpendKobo - prevMin);
      nextTierProgress = Math.min(
        1,
        Math.max(0, (retailSubtotalKobo - prevMin) / span),
      );
      nextTierRemainingKobo = Math.max(
        0,
        nextTier.minSpendKobo - retailSubtotalKobo,
      );
    }

    return {
      wholesaleSubtotalKobo,
      retailSubtotalKobo,
      discountPercent,
      savingsKobo,
      totalKobo,
      appliedTier,
      nextTier,
      nextTierProgress,
      nextTierRemainingKobo,
    };
  }
}
