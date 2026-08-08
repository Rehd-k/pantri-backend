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
} from '../../generated/prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { AiMealPlanService } from '../ai/ai-meal-plan.service';
import {
  ApproveMealPlanDto,
  MealPlanDetailDto,
  MealPlanSummaryDto,
  RejectMealPlanDto,
} from './dto/meal-plan.dto';

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
        status: {
          in: [MealPlanStatus.GENERATING, MealPlanStatus.PENDING_REVIEW],
        },
      },
    });
    if (pending) {
      throw new BadRequestException(
        'A meal plan is already pending review for this employee',
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
          brand: true,
          packageLabel: true,
          tags: true,
          nutritionFacts: true,
          productAllergens: { select: { allergyId: true } },
        },
        orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
        take: 120,
      });

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
          brand: p.brand,
          packageLabel: p.packageLabel,
          tags: p.tags,
          nutritionFacts: p.nutritionFacts,
        })),
      });

      const productIds = new Set(safeProducts.map((p) => p.id));

      await this.prisma.$transaction(async (tx) => {
        await tx.mealPlan.update({
          where: { id: draft.id },
          data: {
            status: MealPlanStatus.PENDING_REVIEW,
            title: aiResult.title || 'Personalized Meal Plan',
            promptSnapshot,
            rawAiResponse: aiResult.raw as Prisma.InputJsonValue,
            failureReason: null,
          },
        });

        for (const day of aiResult.days) {
          const createdDay = await tx.mealPlanDay.create({
            data: {
              mealPlanId: draft.id,
              dayIndex: day.dayIndex,
              label: day.label || `Day ${day.dayIndex}`,
            },
          });

          let sortOrder = 0;
          for (const item of day.items) {
            const productId =
              item.productId && productIds.has(item.productId)
                ? item.productId
                : null;
            await tx.mealPlanItem.create({
              data: {
                mealPlanDayId: createdDay.id,
                mealSlot: item.mealSlot,
                title: item.title,
                rationale: item.rationale ?? '',
                requestedProductName: item.requestedProductName ?? '',
                productId,
                matchType:
                  item.matchType === 'ALTERNATIVE'
                    ? MealItemMatchType.ALTERNATIVE
                    : MealItemMatchType.PRIMARY,
                quantity: Math.max(1, item.quantity ?? 1),
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
        quantityByProduct.set(
          item.productId,
          current + Math.max(1, item.quantity),
        );
      }
    }

    if (quantityByProduct.size === 0) {
      throw new BadRequestException(
        'Cannot approve a meal plan with no matched catalog products',
      );
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
              ([productId, quantity], index) => ({
                productId,
                quantity,
                sortOrder: index,
              }),
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
      packageId: row.packageId,
      failureReason: row.failureReason,
      adminNote: row.adminNote,
      reviewedAt: row.reviewedAt?.toISOString() ?? null,
      createdAt: row.createdAt.toISOString(),
      updatedAt: row.updatedAt.toISOString(),
    };
  }

  private toDetail(row: MealPlanWithRelations): MealPlanDetailDto {
    const profile = row.employee.healthProfile;
    return {
      ...this.toSummary(row),
      days: row.days.map((day) => ({
        id: day.id,
        dayIndex: day.dayIndex,
        label: day.label,
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
