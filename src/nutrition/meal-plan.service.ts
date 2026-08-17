import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  MealItemMatchType,
  MealPlanStatus,
  PackageKind,
  PackageVisibility,
  Prisma,
  RecipeSource,
} from '../../generated/prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { AiMealPlanService } from '../ai/ai-meal-plan.service';
import { recipeToCanonical } from '../measure/measure-convert';
import {
  ApproveMealPlanDto,
  MealPlanDetailDto,
  MealPlanSummaryDto,
  RejectMealPlanDto,
} from './dto/meal-plan.dto';
import { RecipeService } from './recipe.service';

const mealPlanInclude = {
  employee: {
    include: {
      user: { select: { firstName: true, lastName: true } },
      employer: { select: { name: true } },
      healthProfile: {
        include: {
          allergies: { include: { allergy: true } },
          goals: { include: { goal: true } },
        },
      },
    },
  },
  days: {
    orderBy: { dayIndex: 'asc' as const },
    include: {
      items: {
        orderBy: { sortOrder: 'asc' as const },
          include: {
            product: {
              select: {
                id: true,
                name: true,
                imageUrl: true,
                origin: true,
                nutritionFacts: true,
                tags: true,
              },
            },
            measureUnit: true,
            recipe: {
              include: {
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
              },
            },
          },
      },
    },
  },
} satisfies Prisma.MealPlanInclude;

type MealPlanWithRelations = Prisma.MealPlanGetPayload<{
  include: typeof mealPlanInclude;
}>;

@Injectable()
export class MealPlanService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly aiMealPlan: AiMealPlanService,
    private readonly recipeService: RecipeService,
  ) {}

  async generateForUser(userId: string): Promise<MealPlanDetailDto> {
    const employee = await this.prisma.employee.findUnique({
      where: { userId },
      include: {
        healthProfile: {
          include: {
            allergies: { include: { allergy: true } },
            goals: { include: { goal: true } },
          },
        },
      },
    });
    if (!employee) {
      throw new NotFoundException('Employee profile not found for this user');
    }
    if (!employee.healthProfile) {
      throw new BadRequestException(
        'Complete the health questionnaire before generating a meal plan',
      );
    }

    const pending = await this.prisma.mealPlan.findFirst({
      where: {
        employeeId: employee.id,
        status: MealPlanStatus.GENERATING,
      },
    });
    if (pending) {
      throw new BadRequestException(
        'A meal plan is already being generated for this employee',
      );
    }

    const draft = await this.prisma.mealPlan.create({
      data: {
        employeeId: employee.id,
        status: MealPlanStatus.GENERATING,
        title: 'Personalized Meal Plan',
      },
    });

    try {
      const products = await this.prisma.marketplaceProduct.findMany({
        where: { isActive: true },
        select: {
          id: true,
          name: true,
          tags: true,
          nutritionFacts: true,
          recipeUnitOverrideMg: true,
          recipeUnitOverrideMl: true,
          productAllergens: { select: { allergyId: true } },
          measureFamily: {
            include: { defaultRecipeUnit: true },
          },
        },
        orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
        take: 120,
      });

      const pantryRows = await this.prisma.householdStock.findMany({
        where: { employeeId: employee.id, quantityCanonical: { gt: 0 } },
        select: { productId: true, quantityCanonical: true },
      });
      const pantryByProduct = new Map(
        pantryRows.map((row) => [row.productId, row.quantityCanonical]),
      );

      const profile = employee.healthProfile;
      const allergies = profile.allergies.map(
        (row) => row.allergy?.name ?? row.customLabel ?? 'Unknown',
      );
      const goals = profile.goals.map(
        (row) => row.goal?.name ?? row.customLabel ?? 'Unknown',
      );
      const allergyIds = new Set(
        profile.allergies
          .map((row) => row.allergyId)
          .filter((id): id is string => Boolean(id)),
      );

      const safeProducts = products.filter(
        (product) =>
          !product.productAllergens.some((pa) => allergyIds.has(pa.allergyId)),
      );

      const promptSnapshot = {
        age: profile.age,
        gender: profile.gender,
        heightCm: profile.heightCm,
        weightKg: profile.weightKg,
        lifestyle: profile.lifestyle,
        activityLevel: profile.activityLevel,
        allergies,
        goals,
        productCount: safeProducts.length,
      };

      const aiResult = await this.aiMealPlan.generatePlan({
        profile: promptSnapshot,
        products: safeProducts.map((p) => ({
          id: p.id,
          name: p.name,
          brand: '',
          packageLabel:
            p.measureFamily.defaultRecipeUnit?.shortLabel ?? 'unit',
          tags: p.tags,
          nutritionFacts: p.nutritionFacts,
          inPantry: pantryByProduct.has(p.id),
          pantryCanonical: pantryByProduct.get(p.id) ?? 0,
        })),
      });

      const productById = new Map(safeProducts.map((p) => [p.id, p]));

      await this.prisma.$transaction(async (tx) => {
        await tx.mealPlan.update({
          where: { id: draft.id },
          data: {
            status: MealPlanStatus.PENDING_REVIEW,
            title: aiResult.title || 'Pantry meal plan',
            startsOn: new Date(),
            endsOn: new Date(
              Date.now() + Math.max(aiResult.days.length - 1, 0) * 86400000,
            ),
            promptSnapshot,
            rawAiResponse: aiResult.raw as Prisma.InputJsonValue,
            failureReason: null,
          },
        });

        const start = new Date();
        start.setUTCHours(0, 0, 0, 0);

        for (const day of aiResult.days) {
          const planDate = new Date(start);
          planDate.setUTCDate(start.getUTCDate() + (day.dayIndex - 1));
          const createdDay = await tx.mealPlanDay.create({
            data: {
              mealPlanId: draft.id,
              dayIndex: day.dayIndex,
              label: day.label || `Day ${day.dayIndex}`,
              planDate,
            },
          });

          let sortOrder = 0;
          for (const item of day.items) {
            if (item.matchType === 'ALTERNATIVE') continue;
            const ingredientInputs =
              item.ingredients && item.ingredients.length > 0
                ? item.ingredients
                : item.productId
                  ? [{ productId: item.productId, quantity: item.quantity ?? 1 }]
                  : [];
            const resolved = ingredientInputs
              .map((ing) => {
                const product = productById.get(ing.productId);
                if (!product) return null;
                const unit = product.measureFamily.defaultRecipeUnit;
                const quantity = Math.max(1, ing.quantity ?? 1);
                const quantityCanonical = unit
                  ? recipeToCanonical(quantity, unit, {
                      recipeUnitOverrideMg: product.recipeUnitOverrideMg,
                      recipeUnitOverrideMl: product.recipeUnitOverrideMl,
                    })
                  : 0;
                return {
                  product,
                  unit,
                  quantity,
                  quantityCanonical: Math.max(1, quantityCanonical),
                };
              })
              .filter((row): row is NonNullable<typeof row> => row != null);

            if (resolved.length === 0) continue;

            const primary = resolved[0];
            const recipe = await tx.recipe.create({
              data: {
                employeeId: employee.id,
                title: item.title,
                mealSlot: item.mealSlot,
                instructions:
                  item.instructions?.trim() ||
                  'Cook with the measured pantry ingredients listed, then mark this meal cooked.',
                rationale: item.rationale ?? '',
                source: RecipeSource.AI,
                goalSnapshot: { goals } as Prisma.InputJsonValue,
                ingredients: {
                  create: resolved.map((row, index) => ({
                    productId: row.product.id,
                    measureUnitId: row.unit?.id ?? null,
                    quantity: row.quantity,
                    quantityCanonical: row.quantityCanonical,
                    sortOrder: index,
                  })),
                },
              },
            });

            await tx.mealPlanItem.create({
              data: {
                mealPlanDayId: createdDay.id,
                mealSlot: item.mealSlot,
                title: item.title,
                rationale: item.rationale ?? '',
                requestedProductName:
                  item.requestedProductName || primary?.product.name || '',
                productId: primary?.product.id ?? null,
                matchType: MealItemMatchType.PRIMARY,
                quantity: primary?.quantity ?? 1,
                quantityCanonical: primary?.quantityCanonical ?? 0,
                measureUnitId: primary?.unit?.id ?? null,
                recipeId: recipe.id,
                sortOrder: sortOrder++,
              },
            });
          }
        }
      });
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'Meal plan generation failed';
      await this.prisma.mealPlan.update({
        where: { id: draft.id },
        data: {
          status: MealPlanStatus.FAILED,
          failureReason: message,
        },
      });
      throw new BadRequestException(message);
    }

    return this.getByIdForEmployee(draft.id, employee.id);
  }

  async listForUser(userId: string): Promise<MealPlanSummaryDto[]> {
    const employee = await this.prisma.employee.findUnique({
      where: { userId },
    });
    if (!employee) {
      throw new NotFoundException('Employee profile not found for this user');
    }

    const rows = await this.prisma.mealPlan.findMany({
      where: { employeeId: employee.id },
      include: mealPlanInclude,
      orderBy: { createdAt: 'desc' },
    });
    return rows.map((row) => this.toSummary(row));
  }

  async getForUser(userId: string, id: string): Promise<MealPlanDetailDto> {
    const employee = await this.prisma.employee.findUnique({
      where: { userId },
    });
    if (!employee) {
      throw new NotFoundException('Employee profile not found for this user');
    }
    return this.getByIdForEmployee(id, employee.id);
  }

  async getActiveForUser(userId: string): Promise<MealPlanDetailDto | null> {
    const employee = await this.prisma.employee.findUnique({
      where: { userId },
    });
    if (!employee) {
      throw new NotFoundException('Employee profile not found for this user');
    }

    const row = await this.prisma.mealPlan.findFirst({
      where: {
        employeeId: employee.id,
        status: MealPlanStatus.APPROVED,
      },
      include: mealPlanInclude,
      orderBy: [{ activatedAt: 'desc' }, { createdAt: 'desc' }],
    });
    if (!row) {
      return null;
    }
    return this.toDetail(row);
  }

  async listAdmin(status?: MealPlanStatus): Promise<MealPlanSummaryDto[]> {
    const rows = await this.prisma.mealPlan.findMany({
      where: status ? { status } : undefined,
      include: mealPlanInclude,
      orderBy: { createdAt: 'desc' },
    });
    return rows.map((row) => this.toSummary(row));
  }

  async getAdmin(id: string): Promise<MealPlanDetailDto> {
    const row = await this.prisma.mealPlan.findUnique({
      where: { id },
      include: mealPlanInclude,
    });
    if (!row) {
      throw new NotFoundException(`Meal plan ${id} not found`);
    }
    return this.toDetail(row);
  }

  async approve(
    id: string,
    reviewerId: string,
    dto: ApproveMealPlanDto,
  ): Promise<MealPlanDetailDto> {
    const plan = await this.prisma.mealPlan.findUnique({
      where: { id },
      include: {
        ...mealPlanInclude,
        employee: {
          include: {
            user: { select: { id: true, firstName: true, lastName: true } },
            employer: { select: { name: true } },
            healthProfile: {
              include: {
                allergies: { include: { allergy: true } },
                goals: { include: { goal: true } },
              },
            },
          },
        },
      },
    });
    if (!plan) {
      throw new NotFoundException(`Meal plan ${id} not found`);
    }
    if (plan.status !== MealPlanStatus.PENDING_REVIEW) {
      throw new BadRequestException('Only pending meal plans can be approved');
    }

    const quantityByProduct = new Map<string, number>();
    for (const day of plan.days) {
      for (const item of day.items) {
        if (!item.productId) continue;
        const current = quantityByProduct.get(item.productId) ?? 0;
        const add = item.quantityCanonical > 0 ? item.quantityCanonical : 0;
        quantityByProduct.set(item.productId, current + add);
      }
    }

    if (quantityByProduct.size === 0) {
      throw new BadRequestException(
        'Cannot approve a meal plan with no matched catalog products',
      );
    }

    const productIds = [...quantityByProduct.keys()];
    const packs = await this.prisma.productPack.findMany({
      where: { productId: { in: productIds }, isActive: true },
      orderBy: [{ priceKobo: 'asc' }, { packAmount: 'asc' }],
    });
    const cheapestByProduct = new Map<string, (typeof packs)[number]>();
    for (const pack of packs) {
      if (!cheapestByProduct.has(pack.productId)) {
        cheapestByProduct.set(pack.productId, pack);
      }
    }
    for (const productId of productIds) {
      if (!cheapestByProduct.has(productId)) {
        throw new BadRequestException(
          `No sellable pack found for product ${productId}`,
        );
      }
    }

    const shareSlug = `ai-meal-${id.slice(-8)}-${Date.now().toString(36)}`;
    const coverImageUrl =
      'https://images.unsplash.com/photo-1490645935967-10de6ba17061?w=800';

    const updated = await this.prisma.$transaction(async (tx) => {
      const pkg = await tx.pantryPackage.create({
        data: {
          kind: PackageKind.AI_GENERATED,
          name: plan.title,
          description: `AI meal plan for ${plan.employee.user.firstName} ${plan.employee.user.lastName}`,
          coverImageUrl,
          isPopular: false,
          sortOrder: 0,
          isActive: true,
          visibility: PackageVisibility.PRIVATE,
          shareSlug,
          createdByUserId: plan.employee.user.id,
          items: {
            create: [...quantityByProduct.entries()].map(
              ([productId, neededCanonical], index) => {
                const pack = cheapestByProduct.get(productId)!;
                const size =
                  pack.amountMg ?? pack.amountMl ?? pack.amountEach ?? 0;
                const quantity =
                  size > 0 && neededCanonical > 0
                    ? Math.max(1, Math.ceil(neededCanonical / size))
                    : 1;
                return {
                  packId: pack.id,
                  quantity,
                  sortOrder: index,
                };
              },
            ),
          },
        },
      });

      return tx.mealPlan.update({
        where: { id },
        data: {
          status: MealPlanStatus.APPROVED,
          adminNote: dto.adminNote?.trim() || null,
          reviewedById: reviewerId,
          reviewedAt: new Date(),
          activatedAt: new Date(),
          packageId: pkg.id,
        },
        include: mealPlanInclude,
      });
    });

    return this.toDetail(updated);
  }

  async reject(
    id: string,
    reviewerId: string,
    dto: RejectMealPlanDto,
  ): Promise<MealPlanDetailDto> {
    const plan = await this.prisma.mealPlan.findUnique({ where: { id } });
    if (!plan) {
      throw new NotFoundException(`Meal plan ${id} not found`);
    }
    if (plan.status !== MealPlanStatus.PENDING_REVIEW) {
      throw new BadRequestException('Only pending meal plans can be rejected');
    }

    const updated = await this.prisma.mealPlan.update({
      where: { id },
      data: {
        status: MealPlanStatus.REJECTED,
        adminNote: dto.adminNote?.trim() || null,
        reviewedById: reviewerId,
        reviewedAt: new Date(),
      },
      include: mealPlanInclude,
    });
    return this.toDetail(updated);
  }

  private async getByIdForEmployee(
    id: string,
    employeeId: string,
  ): Promise<MealPlanDetailDto> {
    const row = await this.prisma.mealPlan.findFirst({
      where: { id, employeeId },
      include: mealPlanInclude,
    });
    if (!row) {
      throw new NotFoundException(`Meal plan ${id} not found`);
    }
    return this.toDetail(row);
  }

  private toSummary(row: MealPlanWithRelations): MealPlanSummaryDto {
    return {
      id: row.id,
      employeeId: row.employeeId,
      employeeName: `${row.employee.user.firstName} ${row.employee.user.lastName}`,
      employerName: row.employee.employer.name,
      status: row.status,
      title: row.title,
      startsOn: row.startsOn?.toISOString().slice(0, 10) ?? null,
      endsOn: row.endsOn?.toISOString().slice(0, 10) ?? null,
      activatedAt: row.activatedAt?.toISOString() ?? null,
      packageId: row.packageId,
      failureReason: row.failureReason,
      adminNote: row.adminNote,
      reviewedAt: row.reviewedAt?.toISOString() ?? null,
      createdAt: row.createdAt.toISOString(),
      updatedAt: row.updatedAt.toISOString(),
    };
  }

  private async toDetail(row: MealPlanWithRelations): Promise<MealPlanDetailDto> {
    const profile = row.employee.healthProfile;
    const stock = await this.recipeService.stockMap(row.employeeId);
    return {
      ...this.toSummary(row),
      days: row.days.map((day) => ({
        id: day.id,
        dayIndex: day.dayIndex,
        label: day.label,
        planDate: day.planDate?.toISOString().slice(0, 10) ?? null,
        items: day.items.map((item) => ({
          id: item.id,
          mealSlot: item.mealSlot,
          title: item.title,
          rationale: item.rationale,
          requestedProductName: item.requestedProductName,
          productId: item.productId,
          productName: item.product?.name ?? null,
          productImageUrl: item.product?.imageUrl ?? null,
          origin: item.product?.origin ?? null,
          nutritionFacts: this.asStringRecord(item.product?.nutritionFacts),
          tags: item.product?.tags ?? [],
          matchType: item.matchType,
          quantity: item.quantity,
          quantityCanonical: item.quantityCanonical,
          measureUnitId: item.measureUnitId,
          measureUnitLabel: item.measureUnit?.shortLabel ?? null,
          recipeId: item.recipeId,
          recipe: item.recipe
            ? this.recipeService.toRecipeDto(item.recipe, stock, row.employeeId)
            : null,
          sortOrder: item.sortOrder,
        })),
      })),
      profile: profile
        ? {
            age: profile.age,
            gender: profile.gender,
            heightCm: profile.heightCm,
            weightKg: profile.weightKg,
            lifestyle: profile.lifestyle,
            activityLevel: profile.activityLevel,
            allergies: profile.allergies.map(
              (a) => a.allergy?.name ?? a.customLabel ?? 'Custom',
            ),
            goals: profile.goals.map(
              (g) => g.goal?.name ?? g.customLabel ?? 'Custom',
            ),
          }
        : null,
    };
  }

  private asStringRecord(value: unknown): Record<string, string> {
    if (!value || typeof value !== 'object' || Array.isArray(value)) {
      return {};
    }
    const result: Record<string, string> = {};
    for (const [key, raw] of Object.entries(value as Record<string, unknown>)) {
      if (raw === null || raw === undefined) continue;
      result[key] = String(raw);
    }
    return result;
  }
}
