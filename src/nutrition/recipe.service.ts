import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  HouseholdStockLedgerReason,
  Prisma,
} from '../../generated/prisma/client';
import {
  addNutrition,
  EMPTY_NUTRITION,
  nutritionPercent,
  parseNutritionFacts,
  scaleNutritionByCanonical,
  type CanonicalNutrition,
} from '../common/nutrition-facts';
import { InventoryService } from '../inventory/inventory.service';
import { HouseholdStockResponseDto } from '../inventory/dto/inventory.dto';
import { PrismaService } from '../prisma/prisma.service';
import {
  CookedMealSummaryDto,
  CookMealResponseDto,
  NutrientProgressDto,
  NutritionProgressQueryDto,
  NutritionProgressResponseDto,
  RecipeCookability,
  RecipeIngredientResponseDto,
  RecipeResponseDto,
} from './dto/recipe.dto';
import { CanonicalNutritionDto } from '../marketplace/dto/product-response.dto';

const recipeInclude = {
  ingredients: {
    orderBy: { sortOrder: 'asc' as const },
    include: {
      product: {
        select: {
          id: true,
          name: true,
          imageUrl: true,
          nutritionFacts: true,
          measureFamily: { select: { dimension: true } },
        },
      },
      measureUnit: true,
    },
  },
} satisfies Prisma.RecipeInclude;

type RecipeRow = Prisma.RecipeGetPayload<{ include: typeof recipeInclude }>;

@Injectable()
export class RecipeService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly inventory: InventoryService,
  ) {}

  async getForUser(userId: string, recipeId: string): Promise<RecipeResponseDto> {
    const employee = await this.requireEmployee(userId);
    const recipe = await this.prisma.recipe.findFirst({
      where: { id: recipeId, employeeId: employee.id },
      include: recipeInclude,
    });
    if (!recipe) {
      throw new NotFoundException('Recipe not found');
    }
    const stock = await this.stockMap(employee.id);
    return this.toRecipeDto(recipe, stock, employee.id);
  }

  async cookForUser(
    userId: string,
    recipeId: string,
  ): Promise<CookMealResponseDto> {
    const employee = await this.requireEmployee(userId);
    const recipe = await this.prisma.recipe.findFirst({
      where: { id: recipeId, employeeId: employee.id },
      include: recipeInclude,
    });
    if (!recipe) {
      throw new NotFoundException('Recipe not found');
    }

    const stock = await this.stockMap(employee.id);
    const dto = this.toRecipeDto(recipe, stock, employee.id);
    if (dto.cookability === 'blocked' || dto.cookability === 'partial') {
      throw new ConflictException({
        message: 'Not enough pantry stock to cook this recipe',
        recipe: dto,
      });
    }

    const nutrition = this.sumRecipeNutrition(recipe);
    const cookedAt = new Date();
    const day = utcDateOnly(cookedAt);

    const result = await this.prisma.$transaction(async (tx) => {
      const cooked = await tx.cookedMeal.create({
        data: {
          employeeId: employee.id,
          recipeId: recipe.id,
          cookedAt,
          ...nutrition,
        },
      });

      const updatedStock: HouseholdStockResponseDto[] = [];
      for (const ingredient of recipe.ingredients) {
        const row = await this.inventory.applyDelta(tx, {
          employeeId: employee.id,
          productId: ingredient.productId,
          deltaCanonical: -ingredient.quantityCanonical,
          reason: HouseholdStockLedgerReason.COOKED,
          cookedMealId: cooked.id,
        });
        updatedStock.push(this.inventory.toStockDto(row));
      }

      await tx.dailyNutritionLog.upsert({
        where: {
          employeeId_day: { employeeId: employee.id, day },
        },
        create: {
          employeeId: employee.id,
          day,
          ...nutrition,
          cookedCount: 1,
        },
        update: {
          energyKcal: { increment: nutrition.energyKcal },
          proteinMg: { increment: nutrition.proteinMg },
          carbsMg: { increment: nutrition.carbsMg },
          fatMg: { increment: nutrition.fatMg },
          fiberMg: { increment: nutrition.fiberMg },
          sugarMg: { increment: nutrition.sugarMg },
          sodiumMg: { increment: nutrition.sodiumMg },
          ironUg: { increment: nutrition.ironUg },
          cookedCount: { increment: 1 },
        },
      });

      const restockAlerts = await tx.restockAlert.findMany({
        where: {
          employeeId: employee.id,
          status: 'OPEN',
          productId: { in: recipe.ingredients.map((i) => i.productId) },
        },
        include: {
          stock: {
            include: { product: { select: { name: true, imageUrl: true } } },
          },
        },
        orderBy: { createdAt: 'desc' },
      });

      return { cooked, updatedStock, restockAlerts };
    });

    const nextStock = await this.stockMap(employee.id);
    const alerts = await this.inventory.listAlertsForUser(userId);
    const opened = alerts.filter((alert) =>
      recipe.ingredients.some((i) => i.productId === alert.productId),
    );

    return {
      recipe: this.toRecipeDto(recipe, nextStock, employee.id),
      nutrition,
      cookedAt: result.cooked.cookedAt.toISOString(),
      restockAlerts: opened,
      updatedStock: result.updatedStock,
    };
  }

  async progressForUser(
    userId: string,
    query: NutritionProgressQueryDto,
  ): Promise<NutritionProgressResponseDto> {
    const employee = await this.requireEmployee(userId);
    const profile = await this.prisma.healthProfile.findUnique({
      where: { employeeId: employee.id },
    });
    if (!profile) {
      throw new NotFoundException('Health profile not found');
    }

    const from = query.from ? new Date(query.from) : startOfUtcDay(new Date());
    const to = query.to ? new Date(query.to) : endOfUtcDay(new Date());
    const fromDay = utcDateOnly(from);
    const toDay = utcDateOnly(to);

    const [logs, meals] = await Promise.all([
      this.prisma.dailyNutritionLog.findMany({
        where: {
          employeeId: employee.id,
          day: { gte: fromDay, lte: toDay },
        },
        orderBy: { day: 'asc' },
      }),
      this.prisma.cookedMeal.findMany({
        where: {
          employeeId: employee.id,
          cookedAt: { gte: from, lte: endOfUtcDay(to) },
        },
        include: { recipe: { select: { title: true, mealSlot: true } } },
        orderBy: { cookedAt: 'desc' },
      }),
    ]);

    const consumed = logs.reduce(
      (acc, log) =>
        addNutrition(acc, {
          energyKcal: log.energyKcal,
          proteinMg: log.proteinMg,
          carbsMg: log.carbsMg,
          fatMg: log.fatMg,
          fiberMg: log.fiberMg,
          sugarMg: log.sugarMg,
          sodiumMg: log.sodiumMg,
          ironUg: log.ironUg,
        }),
      { ...EMPTY_NUTRITION },
    );

    const targets: CanonicalNutrition = {
      energyKcal: profile.targetEnergyKcal,
      proteinMg: profile.targetProteinMg,
      carbsMg: profile.targetCarbsMg,
      fatMg: profile.targetFatMg,
      fiberMg: profile.targetFiberMg,
      sugarMg: profile.targetSugarMg,
      sodiumMg: profile.targetSodiumMg,
      ironUg: profile.targetIronUg,
    };

    const dayCount = Math.max(1, daysInclusive(fromDay, toDay));
    const periodTargets = scaleTargets(targets, dayCount);

    return {
      from: fromDay.toISOString(),
      to: toDay.toISOString(),
      targets: periodTargets,
      consumed,
      totals: {
        energyKcal: progress(consumed.energyKcal, periodTargets.energyKcal),
        proteinMg: progress(consumed.proteinMg, periodTargets.proteinMg),
        carbsMg: progress(consumed.carbsMg, periodTargets.carbsMg),
        fatMg: progress(consumed.fatMg, periodTargets.fatMg),
        fiberMg: progress(consumed.fiberMg, periodTargets.fiberMg),
        sugarMg: progress(consumed.sugarMg, periodTargets.sugarMg),
        sodiumMg: progress(consumed.sodiumMg, periodTargets.sodiumMg),
        ironUg: progress(consumed.ironUg, periodTargets.ironUg),
      },
      days: logs.map((log) => ({
        day: log.day.toISOString(),
        consumed: {
          energyKcal: log.energyKcal,
          proteinMg: log.proteinMg,
          carbsMg: log.carbsMg,
          fatMg: log.fatMg,
          fiberMg: log.fiberMg,
          sugarMg: log.sugarMg,
          sodiumMg: log.sodiumMg,
          ironUg: log.ironUg,
        },
        cookedCount: log.cookedCount,
      })),
      meals: meals.map(
        (meal): CookedMealSummaryDto => ({
          id: meal.id,
          recipeId: meal.recipeId,
          title: meal.recipe.title,
          mealSlot: meal.recipe.mealSlot,
          cookedAt: meal.cookedAt.toISOString(),
          nutrition: {
            energyKcal: meal.energyKcal,
            proteinMg: meal.proteinMg,
            carbsMg: meal.carbsMg,
            fatMg: meal.fatMg,
            fiberMg: meal.fiberMg,
            sugarMg: meal.sugarMg,
            sodiumMg: meal.sodiumMg,
            ironUg: meal.ironUg,
          },
        }),
      ),
    };
  }

  async stockMap(employeeId: string): Promise<Map<string, number>> {
    const rows = await this.prisma.householdStock.findMany({
      where: { employeeId },
      select: { productId: true, quantityCanonical: true },
    });
    return new Map(rows.map((row) => [row.productId, row.quantityCanonical]));
  }

  toRecipeDto(
    recipe: RecipeRow,
    stock: Map<string, number>,
    _employeeId: string,
  ): RecipeResponseDto {
    const neededByProduct = new Map<string, number>();
    for (const ingredient of recipe.ingredients) {
      neededByProduct.set(
        ingredient.productId,
        (neededByProduct.get(ingredient.productId) ?? 0) +
          ingredient.quantityCanonical,
      );
    }

    const ingredients: RecipeIngredientResponseDto[] = recipe.ingredients.map(
      (ingredient) => {
        const have = stock.get(ingredient.productId) ?? 0;
        const neededTotal = neededByProduct.get(ingredient.productId) ?? 0;
        return {
          id: ingredient.id,
          productId: ingredient.productId,
          productName: ingredient.product.name,
          productImageUrl: ingredient.product.imageUrl,
          measureUnitId: ingredient.measureUnitId,
          measureUnitLabel: ingredient.measureUnit?.shortLabel ?? null,
          quantity: ingredient.quantity,
          quantityCanonical: ingredient.quantityCanonical,
          haveCanonical: have,
          isShort: have < neededTotal,
          sortOrder: ingredient.sortOrder,
        };
      },
    );
    const cookability: RecipeCookability = ingredients.some((i) => i.isShort)
      ? 'partial'
      : 'ready';

    return {
      id: recipe.id,
      employeeId: recipe.employeeId,
      title: recipe.title,
      mealSlot: recipe.mealSlot,
      instructions: recipe.instructions,
      rationale: recipe.rationale,
      source: recipe.source,
      cookability,
      nutrition: this.sumRecipeNutrition(recipe),
      ingredients,
      createdAt: recipe.createdAt.toISOString(),
      updatedAt: recipe.updatedAt.toISOString(),
    };
  }

  sumRecipeNutrition(recipe: RecipeRow): CanonicalNutritionDto {
    return recipe.ingredients.reduce((acc, ingredient) => {
      const profile = parseNutritionFacts(ingredient.product.nutritionFacts);
      const scaled = scaleNutritionByCanonical(
        profile,
        ingredient.quantityCanonical,
        ingredient.product.measureFamily.dimension,
      );
      return addNutrition(acc, scaled);
    }, { ...EMPTY_NUTRITION });
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

function progress(consumed: number, target: number): NutrientProgressDto {
  return {
    consumed,
    target,
    percent: nutritionPercent(consumed, target),
  };
}

function scaleTargets(
  daily: CanonicalNutrition,
  days: number,
): CanonicalNutrition {
  return {
    energyKcal: daily.energyKcal * days,
    proteinMg: daily.proteinMg * days,
    carbsMg: daily.carbsMg * days,
    fatMg: daily.fatMg * days,
    fiberMg: daily.fiberMg * days,
    sugarMg: daily.sugarMg * days,
    sodiumMg: daily.sodiumMg * days,
    ironUg: daily.ironUg * days,
  };
}

function utcDateOnly(date: Date): Date {
  return new Date(
    Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()),
  );
}

function startOfUtcDay(date: Date): Date {
  return utcDateOnly(date);
}

function endOfUtcDay(date: Date): Date {
  const start = utcDateOnly(date);
  return new Date(start.getTime() + 24 * 60 * 60 * 1000 - 1);
}

function daysInclusive(from: Date, to: Date): number {
  const ms = utcDateOnly(to).getTime() - utcDateOnly(from).getTime();
  return Math.floor(ms / (24 * 60 * 60 * 1000)) + 1;
}
