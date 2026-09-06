import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  MealItemStatus,
  MealPlanStatus,
} from '../../generated/prisma/client';
import { CartService } from '../cart/cart.service';
import { packsNeeded } from '../measure/measure-convert';
import { PrismaService } from '../prisma/prisma.service';
import { MealPlanDemandService } from './meal-plan-demand.service';

export class ReplenishmentLineDto {
  productId!: string;
  productName!: string;
  productImageUrl!: string;
  neededCanonical!: number;
  haveCanonical!: number;
  shortfallCanonical!: number;
  daysUntilEmpty!: number | null;
  suggestedPackId!: string | null;
  suggestedPackLabel!: string | null;
  suggestedPackQuantity!: number;
  unitPriceKobo!: number | null;
  lineTotalKobo!: number;
}

export class ReplenishmentSuggestionDto {
  minOrderKobo!: number;
  requiredTotalKobo!: number;
  recommendedTotalKobo!: number;
  meetsMinimum!: boolean;
  message!: string;
  lines!: ReplenishmentLineDto[];
  /** Extra packs from upcoming plan demand added only to reach the minimum. */
  topUpLines!: ReplenishmentLineDto[];
}

@Injectable()
export class ReplenishmentService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly demand: MealPlanDemandService,
    private readonly cartService: CartService,
  ) {}

  async suggestForUser(userId: string): Promise<ReplenishmentSuggestionDto> {
    const employee = await this.requireEmployee(userId);
    const minOrderKobo = await this.minOrderKobo();

    const plan = await this.prisma.mealPlan.findFirst({
      where: {
        employeeId: employee.id,
        status: MealPlanStatus.APPROVED,
      },
      orderBy: { activatedAt: 'desc' },
      include: {
        days: {
          orderBy: { dayIndex: 'asc' },
          include: {
            items: {
              include: {
                recipe: {
                  include: { ingredients: true },
                },
                substitutedRecipe: {
                  include: { ingredients: true },
                },
              },
            },
          },
        },
      },
    });

    const today = utcDateOnly(new Date());
    const stockRows = await this.prisma.householdStock.findMany({
      where: { employeeId: employee.id },
      select: { productId: true, quantityCanonical: true },
    });
    const stock = new Map(
      stockRows.map((row) => [row.productId, row.quantityCanonical]),
    );

    const remainingDemand = plan
      ? this.demand.aggregateCanonical(
          plan.days.map((day) => ({
            planDate: day.planDate,
            items: day.items.map((item) => ({
              matchType: item.matchType,
              status: item.status,
              servings: item.servings,
              recipe: item.recipe
                ? {
                    baseServings: item.recipe.baseServings,
                    ingredients: item.recipe.ingredients.map((ing) => ({
                      productId: ing.productId,
                      quantityCanonical: ing.quantityCanonical,
                    })),
                  }
                : null,
              substitutedRecipe: item.substitutedRecipe
                ? {
                    baseServings: item.substitutedRecipe.baseServings,
                    ingredients: item.substitutedRecipe.ingredients.map(
                      (ing) => ({
                        productId: ing.productId,
                        quantityCanonical: ing.quantityCanonical,
                      }),
                    ),
                  }
                : null,
            })),
          })),
          {
            from: today,
            statuses: [MealItemStatus.PLANNED, MealItemStatus.SUBSTITUTED],
          },
        )
      : new Map<string, number>();

    const dailyBurn = this.estimateDailyBurn(plan, today);
    const productIds = [...remainingDemand.keys()];
    const products = productIds.length
      ? await this.prisma.marketplaceProduct.findMany({
          where: { id: { in: productIds } },
          select: { id: true, name: true, imageUrl: true },
        })
      : [];
    const productById = new Map(products.map((p) => [p.id, p]));

    const packs = productIds.length
      ? await this.prisma.productPack.findMany({
          where: { productId: { in: productIds }, isActive: true },
          orderBy: [{ priceKobo: 'asc' }, { packAmount: 'asc' }],
        })
      : [];
    const cheapestByProduct = new Map<string, (typeof packs)[number]>();
    for (const pack of packs) {
      if (!cheapestByProduct.has(pack.productId)) {
        cheapestByProduct.set(pack.productId, pack);
      }
    }

    const requiredLines: ReplenishmentLineDto[] = [];
    for (const [productId, neededCanonical] of remainingDemand.entries()) {
      const have = stock.get(productId) ?? 0;
      const shortfall = Math.max(0, neededCanonical - have);
      if (shortfall <= 0) continue;
      const pack = cheapestByProduct.get(productId);
      const qty = pack ? packsNeeded(shortfall, pack) : 0;
      const product = productById.get(productId);
      const burn = dailyBurn.get(productId) ?? 0;
      const daysUntilEmpty =
        burn > 0 ? Math.max(0, Math.floor(have / burn)) : null;
      requiredLines.push({
        productId,
        productName: product?.name ?? 'Product',
        productImageUrl: product?.imageUrl ?? '',
        neededCanonical,
        haveCanonical: have,
        shortfallCanonical: shortfall,
        daysUntilEmpty,
        suggestedPackId: pack?.id ?? null,
        suggestedPackLabel: pack?.packageLabel ?? null,
        suggestedPackQuantity: Math.max(1, qty),
        unitPriceKobo: pack?.priceKobo ?? null,
        lineTotalKobo: pack ? pack.priceKobo * Math.max(1, qty) : 0,
      });
    }

    requiredLines.sort((a, b) => {
      const da = a.daysUntilEmpty ?? 999;
      const db = b.daysUntilEmpty ?? 999;
      return da - db;
    });

    let requiredTotalKobo = requiredLines.reduce(
      (sum, line) => sum + line.lineTotalKobo,
      0,
    );
    const topUpLines: ReplenishmentLineDto[] = [];
    let recommendedTotalKobo = requiredTotalKobo;

    if (recommendedTotalKobo > 0 && recommendedTotalKobo < minOrderKobo) {
      // Top up from the same upcoming demand set (extra packs), never unrelated catalog.
      const candidates = [...requiredLines];
      let guard = 0;
      while (recommendedTotalKobo < minOrderKobo && guard < 200) {
        guard += 1;
        let progressed = false;
        for (const line of candidates) {
          if (!line.suggestedPackId || line.unitPriceKobo == null) continue;
          const existing = topUpLines.find(
            (row) => row.productId === line.productId,
          );
          if (existing) {
            existing.suggestedPackQuantity += 1;
            existing.lineTotalKobo += line.unitPriceKobo;
          } else {
            topUpLines.push({
              ...line,
              shortfallCanonical: 0,
              suggestedPackQuantity: 1,
              lineTotalKobo: line.unitPriceKobo,
            });
          }
          recommendedTotalKobo += line.unitPriceKobo;
          progressed = true;
          if (recommendedTotalKobo >= minOrderKobo) break;
        }
        if (!progressed) break;
      }
    }

    const meetsMinimum =
      recommendedTotalKobo === 0 || recommendedTotalKobo >= minOrderKobo;
    let message: string;
    if (requiredLines.length === 0) {
      message = 'Your pantry covers the remaining meal plan.';
    } else if (requiredTotalKobo < minOrderKobo) {
      message = `Your recommended replenishment is ₦${(requiredTotalKobo / 100).toLocaleString('en-NG')}. Pantri orders require a minimum of ₦${(minOrderKobo / 100).toLocaleString('en-NG')}.`;
    } else {
      message = `Recommended replenishment totals ₦${(recommendedTotalKobo / 100).toLocaleString('en-NG')}.`;
    }

    return {
      minOrderKobo,
      requiredTotalKobo,
      recommendedTotalKobo,
      meetsMinimum,
      message,
      lines: requiredLines,
      topUpLines,
    };
  }

  async addSuggestionToCart(userId: string): Promise<ReplenishmentSuggestionDto> {
    const suggestion = await this.suggestForUser(userId);
    const all = [...suggestion.lines, ...suggestion.topUpLines];
    if (all.length === 0) {
      throw new BadRequestException('Nothing to add to cart');
    }
    for (const line of all) {
      if (!line.suggestedPackId || line.suggestedPackQuantity <= 0) continue;
      await this.cartService.addItem(userId, {
        packId: line.suggestedPackId,
        quantity: line.suggestedPackQuantity,
      });
    }
    return suggestion;
  }

  private estimateDailyBurn(
    plan:
      | {
          days: Array<{
            planDate: Date | null;
            items: Array<{
              status: MealItemStatus;
              servings: number;
              matchType: string;
              recipe: {
                baseServings: number;
                ingredients: Array<{
                  productId: string;
                  quantityCanonical: number;
                }>;
              } | null;
              substitutedRecipe: {
                baseServings: number;
                ingredients: Array<{
                  productId: string;
                  quantityCanonical: number;
                }>;
              } | null;
            }>;
          }>;
        }
      | null,
    from: Date,
  ): Map<string, number> {
    if (!plan) return new Map();
    const futureDays = plan.days.filter((day) => {
      if (!day.planDate) return true;
      return utcDateOnly(day.planDate).getTime() >= from.getTime();
    });
    const dayCount = Math.max(1, futureDays.length);
    const total = this.demand.aggregateCanonical(
      futureDays.map((day) => ({
        planDate: day.planDate,
        items: day.items.map((item) => ({
          matchType: item.matchType,
          status: item.status,
          servings: item.servings,
          recipe: item.recipe,
          substitutedRecipe: item.substitutedRecipe,
        })),
      })),
      { statuses: [MealItemStatus.PLANNED, MealItemStatus.SUBSTITUTED] },
    );
    const daily = new Map<string, number>();
    for (const [productId, amount] of total.entries()) {
      daily.set(productId, Math.max(1, Math.ceil(amount / dayCount)));
    }
    return daily;
  }

  private async minOrderKobo(): Promise<number> {
    const settings = await this.prisma.platformDeliverySettings.findUnique({
      where: { id: 'default' },
    });
    return settings?.minOrderKobo ?? 5_000_000;
  }

  private async requireEmployee(userId: string) {
    const employee = await this.prisma.employee.findUnique({
      where: { userId },
    });
    if (!employee) {
      throw new NotFoundException('Employee profile not found for this user');
    }
    return employee;
  }
}

function utcDateOnly(date: Date): Date {
  return new Date(
    Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()),
  );
}
