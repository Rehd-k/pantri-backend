import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  MealItemMatchType,
  MealPlanSource,
  MealPlanStatus,
  PackageKind,
  PackageVisibility,
  Prisma,
  RecipeSource,
} from '../../generated/prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { AiMealPlanService, type AiGeneratedItem } from '../ai/ai-meal-plan.service';
import { recipeToCanonical, effectiveRecipeUnit } from '../measure/measure-convert';
import {
  AiGenerateMealPlanDto,
  AiSlotSuggestionDto,
  AiSuggestSlotDto,
  ApproveMealPlanDto,
  CatalogProductPickDto,
  CreateMealPlanDraftDto,
  ListCatalogProductsQueryDto,
  ListNutritionEmployeesQueryDto,
  MealIngredientInputDto,
  MealPlanDetailDto,
  MealPlanSummaryDto,
  NutritionEmployeeDto,
  PatchMealPlanItemDto,
  RejectMealPlanDto,
  UpdateMealPlanDraftDto,
  UpsertMealPlanItemDto,
  UpsertMealRecipeDto,
} from './dto/meal-plan.dto';
import { RecipeService } from './recipe.service';
import {
  addUtcDays,
  computeCompleteness,
  isoDate,
  joinInstructionSteps,
  normalizeInstructionSteps,
  utcDateOnly,
  weekdayLabel,
} from './meal-plan.util';

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
          cookedMeals: {
            orderBy: { cookedAt: 'desc' as const },
            take: 1,
            select: { cookedAt: true },
          },
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

type ProductForRecipe = {
  id: string;
  name: string;
  recipeUnitOverrideMg: number | null;
  recipeUnitOverrideMl: number | null;
  recipeUnit: {
    id: string;
    milligrams: number | null;
    millilitres: number | null;
    piecesPerUnit: number | null;
    shortLabel: string;
  } | null;
  measureFamily: {
    defaultRecipeUnit: {
      id: string;
      milligrams: number | null;
      millilitres: number | null;
      piecesPerUnit: number | null;
      shortLabel: string;
    } | null;
  };
};

type Tx = Prisma.TransactionClient;

@Injectable()
export class MealPlanService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly aiMealPlan: AiMealPlanService,
    private readonly recipeService: RecipeService,
  ) {}

  async generateForUser(userId: string): Promise<MealPlanDetailDto> {
    const employee = await this.requireEmployeeByUser(userId);
    if (!employee.healthProfile) {
      throw new BadRequestException(
        'Complete the health questionnaire before generating a meal plan',
      );
    }

    const pending = await this.prisma.mealPlan.findFirst({
      where: { employeeId: employee.id, status: MealPlanStatus.GENERATING },
    });
    if (pending) {
      throw new BadRequestException(
        'A meal plan is already being generated for this employee',
      );
    }

    const start = utcDateOnly(new Date());
    const draft = await this.prisma.mealPlan.create({
      data: {
        employeeId: employee.id,
        status: MealPlanStatus.GENERATING,
        source: MealPlanSource.AI,
        title: 'Personalized Meal Plan',
        startsOn: start,
        endsOn: addUtcDays(start, 6),
      },
    });

    try {
      const catalog = await this.loadCatalog(employee.id, employee.healthProfile);
      const aiResult = await this.aiMealPlan.generatePlan({
        profile: catalog.promptSnapshot,
        products: catalog.products,
        dayCount: 7,
      });
      await this.prisma.$transaction(async (tx) => {
        await tx.mealPlan.update({
          where: { id: draft.id },
          data: {
            status: MealPlanStatus.PENDING_REVIEW,
            title: aiResult.title || 'Pantry meal plan',
            startsOn: start,
            endsOn: addUtcDays(start, Math.max(aiResult.days.length - 1, 0)),
            promptSnapshot: catalog.promptSnapshot,
            rawAiResponse: aiResult.raw as Prisma.InputJsonValue,
            failureReason: null,
            source: MealPlanSource.AI,
          },
        });
        await this.writeGeneratedDays(tx, {
          mealPlanId: draft.id,
          employeeId: employee.id,
          start,
          days: aiResult.days,
          productById: catalog.productById,
          goals: catalog.promptSnapshot.goals,
          recipeSource: RecipeSource.AI,
          replaceExisting: true,
        });
      });
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'Meal plan generation failed';
      await this.prisma.mealPlan.update({
        where: { id: draft.id },
        data: { status: MealPlanStatus.FAILED, failureReason: message },
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
      where: { employeeId: employee.id, status: MealPlanStatus.APPROVED },
      include: mealPlanInclude,
      orderBy: [{ activatedAt: 'desc' }, { createdAt: 'desc' }],
    });
    return row ? this.toDetail(row) : null;
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
    return this.loadPlanOrThrow(id);
  }

  async listNutritionEmployees(
    query: ListNutritionEmployeesQueryDto,
  ): Promise<NutritionEmployeeDto[]> {
    const take = query.take ?? 50;
    const q = query.q?.trim();
    const rows = await this.prisma.employee.findMany({
      where: {
        ...(q
          ? {
              OR: [
                { user: { firstName: { contains: q, mode: 'insensitive' } } },
                { user: { lastName: { contains: q, mode: 'insensitive' } } },
                { user: { email: { contains: q, mode: 'insensitive' } } },
                { employer: { name: { contains: q, mode: 'insensitive' } } },
              ],
            }
          : {}),
        ...(query.needsPlan
          ? {
              healthProfile: { isNot: null },
              mealPlans: { none: { status: MealPlanStatus.APPROVED } },
            }
          : {}),
      },
      include: {
        user: {
          select: { id: true, firstName: true, lastName: true, email: true },
        },
        employer: { select: { name: true } },
        healthProfile: {
          include: {
            allergies: { include: { allergy: true } },
            goals: { include: { goal: true } },
          },
        },
        mealPlans: {
          orderBy: { createdAt: 'desc' },
          take: 1,
          select: { id: true, status: true },
        },
      },
      orderBy: { createdAt: 'desc' },
      take,
    });

    return rows.map((row) => {
      const latest = row.mealPlans[0] ?? null;
      const profile = row.healthProfile;
      return {
        employeeId: row.id,
        userId: row.user.id,
        firstName: row.user.firstName,
        lastName: row.user.lastName,
        email: row.user.email,
        employerName: row.employer.name,
        hasProfile: Boolean(profile),
        hasActivePlan: latest?.status === MealPlanStatus.APPROVED,
        latestPlanStatus: latest?.status ?? null,
        latestPlanId: latest?.id ?? null,
        profile: profile
          ? {
              age: profile.age,
              gender: profile.gender,
              heightCm: profile.heightCm,
              weightKg: profile.weightKg,
              lifestyle: profile.lifestyle,
              activityLevel: profile.activityLevel,
              householdSize: profile.householdSize,
              hasChildren: profile.hasChildren,
              allergies: profile.allergies.map(
                (a) => a.allergy?.name ?? a.customLabel ?? 'Custom',
              ),
              goals: profile.goals.map(
                (g) => g.goal?.name ?? g.customLabel ?? 'Custom',
              ),
              targetEnergyKcal: profile.targetEnergyKcal,
              targetProteinMg: profile.targetProteinMg,
              targetCarbsMg: profile.targetCarbsMg,
              targetFatMg: profile.targetFatMg,
            }
          : null,
      };
    });
  }

  async searchCatalogProducts(
    query: ListCatalogProductsQueryDto,
  ): Promise<CatalogProductPickDto[]> {
    const take = query.take ?? 40;
    const q = query.q?.trim();
    const rows = await this.prisma.marketplaceProduct.findMany({
      where: {
        isActive: true,
        ...(q
          ? {
              OR: [
                { name: { contains: q, mode: 'insensitive' } },
                { tags: { has: q } },
              ],
            }
          : {}),
      },
      include: {
        recipeUnit: true,
        measureFamily: { include: { defaultRecipeUnit: true } },
      },
      orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
      take,
    });
    return rows.map((row) => {
      const unit = effectiveRecipeUnit(row);
      return {
        id: row.id,
        name: row.name,
        imageUrl: row.imageUrl,
        origin: row.origin,
        tags: row.tags,
        nutritionFacts: this.asStringRecord(row.nutritionFacts),
        measureUnitId: unit?.id ?? null,
        measureUnitLabel: unit?.shortLabel ?? null,
      };
    });
  }

  async createDraft(
    actorId: string,
    dto: CreateMealPlanDraftDto,
  ): Promise<MealPlanDetailDto> {
    const employee = await this.prisma.employee.findUnique({
      where: { id: dto.employeeId },
      include: { healthProfile: true },
    });
    if (!employee) {
      throw new NotFoundException('Employee not found');
    }
    if (!employee.healthProfile) {
      throw new BadRequestException(
        'This employee has not completed the health questionnaire',
      );
    }
    const dayCount = dto.dayCount ?? 7;
    const start = utcDateOnly(dto.startsOn);
    const created = await this.prisma.mealPlan.create({
      data: {
        employeeId: employee.id,
        createdById: actorId,
        status: MealPlanStatus.DRAFT,
        source: MealPlanSource.MANUAL,
        title: dto.title?.trim() || 'Personalized Meal Plan',
        startsOn: start,
        endsOn: addUtcDays(start, dayCount - 1),
        days: {
          create: Array.from({ length: dayCount }, (_, index) => {
            const planDate = addUtcDays(start, index);
            return {
              dayIndex: index + 1,
              label: weekdayLabel(planDate),
              planDate,
            };
          }),
        },
      },
    });
    return this.loadPlanOrThrow(created.id);
  }

  async updateDraft(
    id: string,
    dto: UpdateMealPlanDraftDto,
  ): Promise<MealPlanDetailDto> {
    const plan = await this.prisma.mealPlan.findUnique({
      where: { id },
      include: { days: { orderBy: { dayIndex: 'asc' } } },
    });
    if (!plan) {
      throw new NotFoundException(`Meal plan ${id} not found`);
    }
    this.assertEditable(plan.status);

    const start = dto.startsOn
      ? utcDateOnly(dto.startsOn)
      : plan.startsOn
        ? utcDateOnly(plan.startsOn)
        : utcDateOnly(new Date());
    const dayCount = dto.dayCount ?? plan.days.length ?? 7;

    await this.prisma.$transaction(async (tx) => {
      await tx.mealPlan.update({
        where: { id },
        data: {
          title: dto.title?.trim() || plan.title,
          startsOn: start,
          endsOn: addUtcDays(start, dayCount - 1),
        },
      });
      for (let index = 0; index < dayCount; index++) {
        const planDate = addUtcDays(start, index);
        const existing = plan.days[index];
        if (existing) {
          await tx.mealPlanDay.update({
            where: { id: existing.id },
            data: {
              dayIndex: index + 1,
              label: weekdayLabel(planDate),
              planDate,
            },
          });
        } else {
          await tx.mealPlanDay.create({
            data: {
              mealPlanId: id,
              dayIndex: index + 1,
              label: weekdayLabel(planDate),
              planDate,
            },
          });
        }
      }
      if (plan.days.length > dayCount) {
        await tx.mealPlanDay.deleteMany({
          where: {
            mealPlanId: id,
            dayIndex: { gt: dayCount },
          },
        });
      }
    });

    return this.loadPlanOrThrow(id);
  }

  async upsertItem(
    planId: string,
    dto: UpsertMealPlanItemDto,
  ): Promise<MealPlanDetailDto> {
    const plan = await this.requireEditablePlan(planId);
    const day = this.resolveDay(plan, dto.dayId, dto.planDate);
    const ingredients = dto.ingredients ?? [];
    if (ingredients.length === 0) {
      throw new BadRequestException('Add at least one catalog product');
    }

    await this.prisma.$transaction(async (tx) => {
      const existing = day.items.find(
        (item) => item.mealSlot.toLowerCase() === dto.mealSlot.toLowerCase(),
      );
      if (existing) {
        await this.writeItemRecipe(tx, {
          plan,
          itemId: existing.id,
          dayId: day.id,
          mealSlot: dto.mealSlot,
          title: dto.title,
          rationale: dto.rationale ?? '',
          ingredients,
          instructionSteps: dto.instructionSteps,
          recipeSource: RecipeSource.NUTRITIONIST,
        });
      } else {
        await this.writeItemRecipe(tx, {
          plan,
          itemId: null,
          dayId: day.id,
          mealSlot: dto.mealSlot,
          title: dto.title,
          rationale: dto.rationale ?? '',
          ingredients,
          instructionSteps: dto.instructionSteps,
          recipeSource: RecipeSource.NUTRITIONIST,
        });
      }
      await this.markHybridIfNeeded(tx, plan);
    });

    return this.loadPlanOrThrow(planId);
  }

  async patchItem(
    planId: string,
    itemId: string,
    dto: PatchMealPlanItemDto,
  ): Promise<MealPlanDetailDto> {
    const plan = await this.requireEditablePlan(planId);
    const item = this.requireItem(plan, itemId);
    await this.prisma.$transaction(async (tx) => {
      if (dto.ingredients?.length) {
        await this.writeItemRecipe(tx, {
          plan,
          itemId,
          dayId: item.mealPlanDayId,
          mealSlot: dto.mealSlot ?? item.mealSlot,
          title: dto.title ?? item.title,
          rationale: dto.rationale ?? item.rationale,
          ingredients: dto.ingredients,
          recipeSource: RecipeSource.NUTRITIONIST,
        });
      } else {
        await tx.mealPlanItem.update({
          where: { id: itemId },
          data: {
            title: dto.title ?? item.title,
            rationale: dto.rationale ?? item.rationale,
            mealSlot: dto.mealSlot ?? item.mealSlot,
          },
        });
        if (item.recipeId && (dto.title || dto.rationale || dto.mealSlot)) {
          await tx.recipe.update({
            where: { id: item.recipeId },
            data: {
              title: dto.title ?? item.title,
              rationale: dto.rationale ?? item.rationale,
              mealSlot: dto.mealSlot ?? item.mealSlot,
              source: RecipeSource.NUTRITIONIST,
            },
          });
        }
      }
      await this.markHybridIfNeeded(tx, plan);
    });
    return this.loadPlanOrThrow(planId);
  }

  async deleteItem(planId: string, itemId: string): Promise<MealPlanDetailDto> {
    const plan = await this.requireEditablePlan(planId);
    const item = this.requireItem(plan, itemId);
    await this.prisma.$transaction(async (tx) => {
      await tx.mealPlanItem.delete({ where: { id: itemId } });
      if (item.recipeId) {
        const remaining = await tx.mealPlanItem.count({
          where: { recipeId: item.recipeId },
        });
        if (remaining === 0) {
          await tx.cookedMeal.deleteMany({ where: { recipeId: item.recipeId } }).catch(() => undefined);
          await tx.recipe.delete({ where: { id: item.recipeId } }).catch(() => undefined);
        }
      }
    });
    return this.loadPlanOrThrow(planId);
  }

  async upsertRecipe(
    planId: string,
    itemId: string,
    dto: UpsertMealRecipeDto,
  ): Promise<MealPlanDetailDto> {
    const plan = await this.requireEditablePlan(planId);
    const item = this.requireItem(plan, itemId);
    const steps = normalizeInstructionSteps(dto.instructionSteps);
    if (steps.length === 0) {
      throw new BadRequestException('Add at least one cooking step');
    }
    await this.prisma.$transaction(async (tx) => {
      await this.writeItemRecipe(tx, {
        plan,
        itemId,
        dayId: item.mealPlanDayId,
        mealSlot: item.mealSlot,
        title: dto.title ?? item.title,
        rationale: dto.rationale ?? item.rationale,
        ingredients: dto.ingredients,
        instructionSteps: steps,
        recipeSource: RecipeSource.NUTRITIONIST,
      });
      await this.markHybridIfNeeded(tx, plan);
    });
    return this.loadPlanOrThrow(planId);
  }

  async publish(
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
    if (
      plan.status !== MealPlanStatus.PENDING_REVIEW &&
      plan.status !== MealPlanStatus.DRAFT
    ) {
      throw new BadRequestException(
        'Only draft or pending meal plans can be published',
      );
    }

    const completeness = this.completenessFromRow(plan);
    if (!completeness.readyToPublish) {
      throw new BadRequestException(
        completeness.missing[0]
          ? `Plan is incomplete: ${completeness.missing[0].mealSlot} ${completeness.missing[0].reason.replaceAll('_', ' ')}`
          : 'Plan is incomplete',
      );
    }

    return this.activatePlan(plan, reviewerId, dto);
  }

  async approve(
    id: string,
    reviewerId: string,
    dto: ApproveMealPlanDto,
  ): Promise<MealPlanDetailDto> {
    return this.publish(id, reviewerId, dto);
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
    if (
      plan.status !== MealPlanStatus.PENDING_REVIEW &&
      plan.status !== MealPlanStatus.DRAFT
    ) {
      throw new BadRequestException(
        'Only draft or pending meal plans can be rejected',
      );
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

  async generateWithAi(
    id: string,
    dto: AiGenerateMealPlanDto,
  ): Promise<MealPlanDetailDto> {
    const plan = await this.requireEditablePlan(id);
    const catalog = await this.loadCatalog(
      plan.employeeId,
      plan.employee.healthProfile,
    );
    const dayCount = plan.days.length || 7;
    const start = plan.startsOn
      ? utcDateOnly(plan.startsOn)
      : utcDateOnly(new Date());
    const aiResult = await this.aiMealPlan.generatePlan({
      profile: catalog.promptSnapshot,
      products: catalog.products,
      dayCount,
      provider: dto.provider,
    });

    await this.prisma.$transaction(async (tx) => {
      await tx.mealPlan.update({
        where: { id },
        data: {
          title: aiResult.title || plan.title,
          promptSnapshot: catalog.promptSnapshot,
          rawAiResponse: aiResult.raw as Prisma.InputJsonValue,
          source:
            dto.replaceExisting || plan.days.every((day) => day.items.length === 0)
              ? MealPlanSource.AI
              : MealPlanSource.HYBRID,
          failureReason: null,
        },
      });
      await this.writeGeneratedDays(tx, {
        mealPlanId: id,
        employeeId: plan.employeeId,
        start,
        days: aiResult.days,
        productById: catalog.productById,
        goals: catalog.promptSnapshot.goals,
        recipeSource: RecipeSource.AI,
        replaceExisting: Boolean(dto.replaceExisting),
        existingDays: plan.days,
      });
    });

    return this.loadPlanOrThrow(id);
  }

  async suggestSlot(
    id: string,
    dto: AiSuggestSlotDto,
  ): Promise<AiSlotSuggestionDto> {
    const plan = await this.requireEditablePlan(id);
    const day = this.resolveDay(plan, dto.dayId, dto.planDate);
    const catalog = await this.loadCatalog(
      plan.employeeId,
      plan.employee.healthProfile,
    );
    const existingTitles = day.items.map((item) => item.title);
    const suggestion = await this.aiMealPlan.suggestSlot({
      profile: catalog.promptSnapshot,
      products: catalog.products,
      mealSlot: dto.mealSlot,
      dayLabel: day.label || isoDate(day.planDate) || `Day ${day.dayIndex}`,
      existingTitles,
      provider: dto.provider,
    });
    const steps = normalizeInstructionSteps(
      suggestion.instructionSteps,
      suggestion.instructions,
    );
    const ingredients = (suggestion.ingredients ?? []).filter((row) =>
      catalog.productById.has(row.productId),
    );
    let applied = false;
    if (dto.apply) {
      if (ingredients.length === 0) {
        throw new BadRequestException(
          'AI suggestion did not match catalog products',
        );
      }
      await this.prisma.$transaction(async (tx) => {
        const existing = day.items.find(
          (item) => item.mealSlot.toLowerCase() === dto.mealSlot.toLowerCase(),
        );
        await this.writeItemRecipe(tx, {
          plan,
          itemId: existing?.id ?? null,
          dayId: day.id,
          mealSlot: dto.mealSlot,
          title: suggestion.title,
          rationale: suggestion.rationale ?? '',
          ingredients: ingredients.map((row) => ({
            productId: row.productId,
            quantity: row.quantity ?? 1,
          })),
          instructionSteps: steps,
          recipeSource: RecipeSource.AI,
        });
        await tx.mealPlan.update({
          where: { id },
          data: { source: MealPlanSource.HYBRID },
        });
      });
      applied = true;
    }

    const detail = await this.loadPlanOrThrow(id);
    const item =
      detail.days
        .find((row) => row.id === day.id)
        ?.items.find(
          (row) => row.mealSlot.toLowerCase() === dto.mealSlot.toLowerCase(),
        ) ?? null;

    return {
      mealSlot: dto.mealSlot,
      title: suggestion.title,
      rationale: suggestion.rationale ?? '',
      instructionSteps: steps,
      ingredients: ingredients.map((row) => ({
        productId: row.productId,
        quantity: row.quantity ?? 1,
      })),
      applied,
      item: applied ? item : null,
    };
  }

  private async activatePlan(
    plan: MealPlanWithRelations & {
      employee: { user: { id: string; firstName: string; lastName: string } };
    },
    reviewerId: string,
    dto: ApproveMealPlanDto,
  ): Promise<MealPlanDetailDto> {
    const quantityByProduct = new Map<string, number>();
    for (const day of plan.days) {
      for (const item of day.items) {
        const fromRecipe = item.recipe?.ingredients ?? [];
        if (fromRecipe.length > 0) {
          for (const ingredient of fromRecipe) {
            quantityByProduct.set(
              ingredient.productId,
              (quantityByProduct.get(ingredient.productId) ?? 0) +
                ingredient.quantityCanonical,
            );
          }
        } else if (item.productId) {
          quantityByProduct.set(
            item.productId,
            (quantityByProduct.get(item.productId) ?? 0) +
              (item.quantityCanonical > 0 ? item.quantityCanonical : 0),
          );
        }
      }
    }
    if (quantityByProduct.size === 0) {
      throw new BadRequestException(
        'Cannot publish a meal plan with no matched catalog products',
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

    const shareSlug = `meal-${plan.id.slice(-8)}-${Date.now().toString(36)}`;
    const updated = await this.prisma.$transaction(async (tx) => {
      const pkg = await tx.pantryPackage.create({
        data: {
          kind: PackageKind.AI_GENERATED,
          name: plan.title,
          description: `Meal plan for ${plan.employee.user.firstName} ${plan.employee.user.lastName}`,
          coverImageUrl:
            'https://images.unsplash.com/photo-1490645935967-10de6ba17061?w=800',
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
                return { packId: pack.id, quantity, sortOrder: index };
              },
            ),
          },
        },
      });

      return tx.mealPlan.update({
        where: { id: plan.id },
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

  private async writeGeneratedDays(
    tx: Tx,
    input: {
      mealPlanId: string;
      employeeId: string;
      start: Date;
      days: Array<{ dayIndex: number; label?: string; items: AiGeneratedItem[] }>;
      productById: Map<string, ProductForRecipe>;
      goals: string[];
      recipeSource: RecipeSource;
      replaceExisting: boolean;
      existingDays?: MealPlanWithRelations['days'];
    },
  ): Promise<void> {
    if (input.replaceExisting) {
      await tx.mealPlanDay.deleteMany({ where: { mealPlanId: input.mealPlanId } });
    }

    for (const day of input.days) {
      const planDate = addUtcDays(input.start, Math.max(day.dayIndex - 1, 0));
      let dayId = input.existingDays?.find((row) => row.dayIndex === day.dayIndex)?.id;
      if (input.replaceExisting || !dayId) {
        const createdDay = await tx.mealPlanDay.create({
          data: {
            mealPlanId: input.mealPlanId,
            dayIndex: day.dayIndex,
            label: day.label || weekdayLabel(planDate),
            planDate,
          },
        });
        dayId = createdDay.id;
      }

      let sortOrder = 0;
      for (const item of day.items) {
        if (item.matchType === 'ALTERNATIVE') continue;
        if (
          !input.replaceExisting &&
          input.existingDays
            ?.find((row) => row.dayIndex === day.dayIndex)
            ?.items.some(
              (existing) =>
                existing.mealSlot.toLowerCase() === item.mealSlot.toLowerCase(),
            )
        ) {
          continue;
        }
        const ingredients =
          item.ingredients && item.ingredients.length > 0
            ? item.ingredients
            : item.productId
              ? [{ productId: item.productId, quantity: item.quantity ?? 1 }]
              : [];
        await this.writeItemRecipe(tx, {
          plan: { employeeId: input.employeeId },
          itemId: null,
          dayId,
          mealSlot: item.mealSlot,
          title: item.title,
          rationale: item.rationale ?? '',
          ingredients,
          instructionSteps: normalizeInstructionSteps(
            item.instructionSteps,
            item.instructions,
          ),
          recipeSource: input.recipeSource,
          productById: input.productById,
          goals: input.goals,
          sortOrder: sortOrder++,
        });
      }
    }
  }

  private async writeItemRecipe(
    tx: Tx,
    input: {
      plan: { employeeId: string; source?: MealPlanSource };
      itemId: string | null;
      dayId: string;
      mealSlot: string;
      title: string;
      rationale: string;
      ingredients: MealIngredientInputDto[];
      instructionSteps?: string[];
      recipeSource: RecipeSource;
      productById?: Map<string, ProductForRecipe>;
      goals?: string[];
      sortOrder?: number;
    },
  ): Promise<void> {
    const productById =
      input.productById ?? (await this.loadProductsByIds(tx, input.ingredients.map((i) => i.productId)));
    const resolved = input.ingredients
      .map((ing) => {
        const product = productById.get(ing.productId);
        if (!product) return null;
        const unit = effectiveRecipeUnit(product);
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

    if (resolved.length === 0) {
      throw new BadRequestException('None of the selected products are in the catalog');
    }

    const primary = resolved[0];
    const steps = normalizeInstructionSteps(input.instructionSteps);
    const recipeData = {
      employeeId: input.plan.employeeId,
      title: input.title,
      mealSlot: input.mealSlot,
      instructions: joinInstructionSteps(steps),
      instructionSteps: steps,
      rationale: input.rationale,
      source: input.recipeSource,
      goalSnapshot: { goals: input.goals ?? [] } as Prisma.InputJsonValue,
    };

    let recipeId: string;
    const existingItem = input.itemId
      ? await tx.mealPlanItem.findUnique({ where: { id: input.itemId } })
      : null;
    if (existingItem?.recipeId) {
      await tx.recipeIngredient.deleteMany({
        where: { recipeId: existingItem.recipeId },
      });
      await tx.recipe.update({
        where: { id: existingItem.recipeId },
        data: {
          ...recipeData,
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
      recipeId = existingItem.recipeId;
    } else {
      const recipe = await tx.recipe.create({
        data: {
          ...recipeData,
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
      recipeId = recipe.id;
    }

    const itemData = {
      mealPlanDayId: input.dayId,
      mealSlot: input.mealSlot,
      title: input.title,
      rationale: input.rationale,
      requestedProductName: primary.product.name,
      productId: primary.product.id,
      matchType: MealItemMatchType.PRIMARY,
      quantity: primary.quantity,
      quantityCanonical: primary.quantityCanonical,
      measureUnitId: primary.unit?.id ?? null,
      recipeId,
      sortOrder: input.sortOrder ?? 0,
    };

    if (existingItem) {
      await tx.mealPlanItem.update({
        where: { id: existingItem.id },
        data: itemData,
      });
    } else {
      await tx.mealPlanItem.create({ data: itemData });
    }
  }

  private async loadProductsByIds(
    tx: Tx,
    ids: string[],
  ): Promise<Map<string, ProductForRecipe>> {
    const rows = await tx.marketplaceProduct.findMany({
      where: { id: { in: ids }, isActive: true },
      select: {
        id: true,
        name: true,
        recipeUnitOverrideMg: true,
        recipeUnitOverrideMl: true,
        recipeUnit: true,
        measureFamily: { include: { defaultRecipeUnit: true } },
      },
    });
    return new Map(rows.map((row) => [row.id, row]));
  }

  private async loadCatalog(
    employeeId: string,
    profile: {
      age: number;
      gender: string;
      heightCm: number;
      weightKg: number;
      lifestyle: string;
      activityLevel: string;
      householdSize: number;
      hasChildren: boolean;
      allergies: Array<{
        allergyId: string | null;
        allergy: { name: string } | null;
        customLabel: string | null;
      }>;
      goals: Array<{
        goal: { name: string } | null;
        customLabel: string | null;
      }>;
    } | null,
  ) {
    if (!profile) {
      throw new BadRequestException('Employee health profile is required');
    }
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
        recipeUnit: true,
        measureFamily: { include: { defaultRecipeUnit: true } },
      },
      orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
      take: 120,
    });
    const pantryRows = await this.prisma.householdStock.findMany({
      where: { employeeId, quantityCanonical: { gt: 0 } },
      select: { productId: true, quantityCanonical: true },
    });
    const pantryByProduct = new Map(
      pantryRows.map((row) => [row.productId, row.quantityCanonical]),
    );
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
    const householdSize = Math.min(8, Math.max(1, profile.householdSize || 1));
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
      householdSize,
      hasChildren: householdSize > 1 && Boolean(profile.hasChildren),
      servings: householdSize,
    };
    return {
      promptSnapshot,
      products: safeProducts.map((p) => ({
        id: p.id,
        name: p.name,
        brand: '',
        packageLabel: effectiveRecipeUnit(p)?.shortLabel ?? 'unit',
        tags: p.tags,
        nutritionFacts: p.nutritionFacts,
        inPantry: pantryByProduct.has(p.id),
        pantryCanonical: pantryByProduct.get(p.id) ?? 0,
      })),
      productById: new Map(safeProducts.map((p) => [p.id, p])),
    };
  }

  private async requireEmployeeByUser(userId: string) {
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
    return employee;
  }

  private async loadPlanOrThrow(id: string): Promise<MealPlanDetailDto> {
    const row = await this.prisma.mealPlan.findUnique({
      where: { id },
      include: mealPlanInclude,
    });
    if (!row) {
      throw new NotFoundException(`Meal plan ${id} not found`);
    }
    return this.toDetail(row);
  }

  private async requireEditablePlan(id: string): Promise<MealPlanWithRelations> {
    const plan = await this.prisma.mealPlan.findUnique({
      where: { id },
      include: mealPlanInclude,
    });
    if (!plan) {
      throw new NotFoundException(`Meal plan ${id} not found`);
    }
    this.assertEditable(plan.status);
    return plan;
  }

  private assertEditable(status: MealPlanStatus): void {
    if (
      status !== MealPlanStatus.DRAFT &&
      status !== MealPlanStatus.PENDING_REVIEW
    ) {
      throw new BadRequestException('Only draft or pending plans can be edited');
    }
  }

  private resolveDay(
    plan: MealPlanWithRelations,
    dayId?: string,
    planDate?: string,
  ): MealPlanWithRelations['days'][number] {
    const day = dayId
      ? plan.days.find((row) => row.id === dayId)
      : planDate
        ? plan.days.find((row) => isoDate(row.planDate) === isoDate(planDate))
        : undefined;
    if (!day) {
      throw new BadRequestException('Meal plan day not found');
    }
    return day;
  }

  private requireItem(plan: MealPlanWithRelations, itemId: string) {
    for (const day of plan.days) {
      const item = day.items.find((row) => row.id === itemId);
      if (item) {
        return { ...item, mealPlanDayId: day.id };
      }
    }
    throw new NotFoundException('Meal plan item not found');
  }

  private async markHybridIfNeeded(
    tx: Tx,
    plan: { id?: string; source?: MealPlanSource } & { id?: string },
  ): Promise<void> {
    const id = 'id' in plan && typeof plan.id === 'string' ? plan.id : undefined;
    if (!id) return;
    if (plan.source === MealPlanSource.AI) {
      await tx.mealPlan.update({
        where: { id },
        data: { source: MealPlanSource.HYBRID },
      });
    }
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

  private completenessFromRow(row: MealPlanWithRelations) {
    return computeCompleteness(
      row.days.map((day) => ({
        id: day.id,
        planDate: day.planDate,
        items: day.items.map((item) => ({
          id: item.id,
          mealSlot: item.mealSlot,
          productId: item.productId,
          recipeId: item.recipeId,
          instructions: item.recipe?.instructions,
          instructionSteps: item.recipe?.instructionSteps,
          ingredientCount: item.recipe?.ingredients.length ?? 0,
          cookedAt: item.cookedMeals[0]?.cookedAt ?? null,
        })),
      })),
    );
  }

  private toSummary(row: MealPlanWithRelations): MealPlanSummaryDto {
    return {
      id: row.id,
      employeeId: row.employeeId,
      employeeName: `${row.employee.user.firstName} ${row.employee.user.lastName}`,
      employerName: row.employee.employer.name,
      status: row.status,
      source: row.source,
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
      completeness: this.completenessFromRow(row),
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
          cookedAt: item.cookedMeals[0]?.cookedAt.toISOString() ?? null,
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
            householdSize: profile.householdSize,
            hasChildren: profile.hasChildren,
            allergies: profile.allergies.map(
              (a) => a.allergy?.name ?? a.customLabel ?? 'Custom',
            ),
            goals: profile.goals.map(
              (g) => g.goal?.name ?? g.customLabel ?? 'Custom',
            ),
            targetEnergyKcal: profile.targetEnergyKcal,
            targetProteinMg: profile.targetProteinMg,
            targetCarbsMg: profile.targetCarbsMg,
            targetFatMg: profile.targetFatMg,
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
