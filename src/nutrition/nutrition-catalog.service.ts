import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import type { Allergy, PrimaryGoal } from '../../generated/prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import {
  AllergyResponseDto,
  CreateAllergyDto,
  CreatePrimaryGoalDto,
  NutritionCatalogResponseDto,
  PrimaryGoalResponseDto,
  UpdateAllergyDto,
  UpdatePrimaryGoalDto,
} from './dto/catalog.dto';
import {
  HealthProfileResponseDto,
  UpsertHealthProfileDto,
} from './dto/health-profile.dto';
import { computeDailyTargets } from './nutrient-targets';

@Injectable()
export class NutritionCatalogService {
  constructor(private readonly prisma: PrismaService) {}

  async getPublicCatalog(): Promise<NutritionCatalogResponseDto> {
    const [allergies, goals] = await Promise.all([
      this.prisma.allergy.findMany({
        where: { isActive: true },
        orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
      }),
      this.prisma.primaryGoal.findMany({
        where: { isActive: true },
        orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
      }),
    ]);

    return {
      allergies: allergies.map((row) => this.toAllergyDto(row)),
      goals: goals.map((row) => this.toGoalDto(row)),
    };
  }

  listAllergies(activeOnly = false): Promise<AllergyResponseDto[]> {
    return this.prisma.allergy
      .findMany({
        where: activeOnly ? { isActive: true } : undefined,
        orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
      })
      .then((rows) => rows.map((row) => this.toAllergyDto(row)));
  }

  async createAllergy(dto: CreateAllergyDto): Promise<AllergyResponseDto> {
    const slug = this.slugify(dto.slug ?? dto.name);
    const sortOrder =
      dto.sortOrder ??
      ((await this.prisma.allergy.count()) > 0
        ? (await this.prisma.allergy.aggregate({ _max: { sortOrder: true } }))
            ._max.sortOrder! + 1
        : 0);

    const row = await this.prisma.allergy.create({
      data: {
        name: dto.name.trim(),
        slug,
        sortOrder,
        isActive: dto.isActive ?? true,
      },
    });
    return this.toAllergyDto(row);
  }

  async updateAllergy(
    id: string,
    dto: UpdateAllergyDto,
  ): Promise<AllergyResponseDto> {
    await this.requireAllergy(id);
    const row = await this.prisma.allergy.update({
      where: { id },
      data: {
        ...(dto.name !== undefined ? { name: dto.name.trim() } : {}),
        ...(dto.sortOrder !== undefined ? { sortOrder: dto.sortOrder } : {}),
        ...(dto.isActive !== undefined ? { isActive: dto.isActive } : {}),
      },
    });
    return this.toAllergyDto(row);
  }

  async deactivateAllergy(id: string): Promise<AllergyResponseDto> {
    await this.requireAllergy(id);
    const row = await this.prisma.allergy.update({
      where: { id },
      data: { isActive: false },
    });
    return this.toAllergyDto(row);
  }

  listGoals(activeOnly = false): Promise<PrimaryGoalResponseDto[]> {
    return this.prisma.primaryGoal
      .findMany({
        where: activeOnly ? { isActive: true } : undefined,
        orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
      })
      .then((rows) => rows.map((row) => this.toGoalDto(row)));
  }

  async createGoal(dto: CreatePrimaryGoalDto): Promise<PrimaryGoalResponseDto> {
    const slug = this.slugify(dto.slug ?? dto.name);
    const sortOrder =
      dto.sortOrder ??
      ((await this.prisma.primaryGoal.count()) > 0
        ? (
            await this.prisma.primaryGoal.aggregate({
              _max: { sortOrder: true },
            })
          )._max.sortOrder! + 1
        : 0);

    const row = await this.prisma.primaryGoal.create({
      data: {
        name: dto.name.trim(),
        slug,
        description: dto.description?.trim() ?? '',
        iconKey: dto.iconKey?.trim() || 'flag',
        sortOrder,
        isActive: dto.isActive ?? true,
      },
    });
    return this.toGoalDto(row);
  }

  async updateGoal(
    id: string,
    dto: UpdatePrimaryGoalDto,
  ): Promise<PrimaryGoalResponseDto> {
    await this.requireGoal(id);
    const row = await this.prisma.primaryGoal.update({
      where: { id },
      data: {
        ...(dto.name !== undefined ? { name: dto.name.trim() } : {}),
        ...(dto.description !== undefined
          ? { description: dto.description.trim() }
          : {}),
        ...(dto.iconKey !== undefined
          ? { iconKey: dto.iconKey.trim() || 'flag' }
          : {}),
        ...(dto.sortOrder !== undefined ? { sortOrder: dto.sortOrder } : {}),
        ...(dto.isActive !== undefined ? { isActive: dto.isActive } : {}),
      },
    });
    return this.toGoalDto(row);
  }

  async deactivateGoal(id: string): Promise<PrimaryGoalResponseDto> {
    await this.requireGoal(id);
    const row = await this.prisma.primaryGoal.update({
      where: { id },
      data: { isActive: false },
    });
    return this.toGoalDto(row);
  }

  async setProductAllergens(
    productId: string,
    allergyIds: string[],
  ): Promise<{ productId: string; allergyIds: string[] }> {
    const product = await this.prisma.marketplaceProduct.findUnique({
      where: { id: productId },
      select: { id: true },
    });
    if (!product) {
      throw new NotFoundException(`Product ${productId} not found`);
    }

    const uniqueIds = [...new Set(allergyIds.filter(Boolean))];
    if (uniqueIds.length > 0) {
      const found = await this.prisma.allergy.findMany({
        where: { id: { in: uniqueIds } },
        select: { id: true },
      });
      if (found.length !== uniqueIds.length) {
        throw new BadRequestException('One or more allergy IDs are invalid');
      }
    }

    await this.prisma.$transaction([
      this.prisma.productAllergen.deleteMany({ where: { productId } }),
      ...(uniqueIds.length > 0
        ? [
            this.prisma.productAllergen.createMany({
              data: uniqueIds.map((allergyId) => ({ productId, allergyId })),
            }),
          ]
        : []),
    ]);

    return { productId, allergyIds: uniqueIds };
  }

  async getProductAllergenIds(productId: string): Promise<string[]> {
    const rows = await this.prisma.productAllergen.findMany({
      where: { productId },
      select: { allergyId: true },
    });
    return rows.map((row) => row.allergyId);
  }

  async getProfileForUser(
    userId: string,
  ): Promise<HealthProfileResponseDto | null> {
    const employee = await this.requireEmployeeForUser(userId);
    const profile = await this.prisma.healthProfile.findUnique({
      where: { employeeId: employee.id },
      include: {
        allergies: { include: { allergy: true } },
        goals: { include: { goal: true } },
      },
    });
    if (!profile) {
      return null;
    }
    return this.toProfileDto(profile);
  }

  async upsertProfile(
    userId: string,
    dto: UpsertHealthProfileDto,
  ): Promise<HealthProfileResponseDto> {
    this.assertSelections(dto);

    const employee = await this.requireEmployeeForUser(userId);
    const allergyIds = dto.allergies
      .map((a) => a.allergyId)
      .filter((id): id is string => Boolean(id));
    const goalIds = dto.goals
      .map((g) => g.goalId)
      .filter((id): id is string => Boolean(id));

    if (allergyIds.length > 0) {
      const found = await this.prisma.allergy.count({
        where: { id: { in: allergyIds }, isActive: true },
      });
      if (found !== allergyIds.length) {
        throw new BadRequestException('One or more allergy IDs are invalid');
      }
    }
    if (goalIds.length > 0) {
      const found = await this.prisma.primaryGoal.count({
        where: { id: { in: goalIds }, isActive: true },
      });
      if (found !== goalIds.length) {
        throw new BadRequestException('One or more goal IDs are invalid');
      }
    }

    const catalogGoals =
      goalIds.length > 0
        ? await this.prisma.primaryGoal.findMany({
            where: { id: { in: goalIds } },
            select: { slug: true },
          })
        : [];
    const goalSlugs = [
      ...catalogGoals.map((g) => g.slug),
      ...dto.goals
        .map((g) => g.customLabel?.trim())
        .filter((label): label is string => Boolean(label)),
    ];
    const targets = computeDailyTargets({
      age: dto.age,
      gender: dto.gender,
      heightCm: dto.heightCm,
      weightKg: dto.weightKg,
      activityLevel: dto.activityLevel,
      goalSlugs,
    });

    const profile = await this.prisma.$transaction(async (tx) => {
      const upserted = await tx.healthProfile.upsert({
        where: { employeeId: employee.id },
        create: {
          employeeId: employee.id,
          age: dto.age,
          gender: dto.gender.trim(),
          heightCm: dto.heightCm,
          weightKg: dto.weightKg,
          lifestyle: dto.lifestyle,
          activityLevel: dto.activityLevel,
          targetEnergyKcal: targets.energyKcal,
          targetProteinMg: targets.proteinMg,
          targetCarbsMg: targets.carbsMg,
          targetFatMg: targets.fatMg,
          targetFiberMg: targets.fiberMg,
          targetSugarMg: targets.sugarMg,
          targetSodiumMg: targets.sodiumMg,
          targetIronUg: targets.ironUg,
        },
        update: {
          age: dto.age,
          gender: dto.gender.trim(),
          heightCm: dto.heightCm,
          weightKg: dto.weightKg,
          lifestyle: dto.lifestyle,
          activityLevel: dto.activityLevel,
          targetEnergyKcal: targets.energyKcal,
          targetProteinMg: targets.proteinMg,
          targetCarbsMg: targets.carbsMg,
          targetFatMg: targets.fatMg,
          targetFiberMg: targets.fiberMg,
          targetSugarMg: targets.sugarMg,
          targetSodiumMg: targets.sodiumMg,
          targetIronUg: targets.ironUg,
        },
      });

      await tx.healthProfileAllergy.deleteMany({
        where: { healthProfileId: upserted.id },
      });
      await tx.healthProfileGoal.deleteMany({
        where: { healthProfileId: upserted.id },
      });

      if (dto.allergies.length > 0) {
        await tx.healthProfileAllergy.createMany({
          data: dto.allergies.map((item) => ({
            healthProfileId: upserted.id,
            allergyId: item.allergyId || null,
            customLabel: item.customLabel?.trim() || null,
          })),
        });
      }
      if (dto.goals.length > 0) {
        await tx.healthProfileGoal.createMany({
          data: dto.goals.map((item) => ({
            healthProfileId: upserted.id,
            goalId: item.goalId || null,
            customLabel: item.customLabel?.trim() || null,
          })),
        });
      }

      return tx.healthProfile.findUniqueOrThrow({
        where: { id: upserted.id },
        include: {
          allergies: { include: { allergy: true } },
          goals: { include: { goal: true } },
        },
      });
    });

    return this.toProfileDto(profile);
  }

  private assertSelections(dto: UpsertHealthProfileDto): void {
    for (const item of dto.allergies) {
      const hasCatalog = Boolean(item.allergyId);
      const hasCustom = Boolean(item.customLabel?.trim());
      if (hasCatalog === hasCustom) {
        throw new BadRequestException(
          'Each allergy must specify either allergyId or customLabel',
        );
      }
    }
    for (const item of dto.goals) {
      const hasCatalog = Boolean(item.goalId);
      const hasCustom = Boolean(item.customLabel?.trim());
      if (hasCatalog === hasCustom) {
        throw new BadRequestException(
          'Each goal must specify either goalId or customLabel',
        );
      }
    }
    if (dto.goals.length === 0) {
      throw new BadRequestException('Select at least one primary goal');
    }
  }

  private async requireEmployeeForUser(userId: string) {
    const employee = await this.prisma.employee.findUnique({
      where: { userId },
    });
    if (!employee) {
      throw new NotFoundException('Employee profile not found for this user');
    }
    return employee;
  }

  private async requireAllergy(id: string): Promise<Allergy> {
    const row = await this.prisma.allergy.findUnique({ where: { id } });
    if (!row) {
      throw new NotFoundException(`Allergy ${id} not found`);
    }
    return row;
  }

  private async requireGoal(id: string): Promise<PrimaryGoal> {
    const row = await this.prisma.primaryGoal.findUnique({ where: { id } });
    if (!row) {
      throw new NotFoundException(`Goal ${id} not found`);
    }
    return row;
  }

  private slugify(value: string): string {
    const slug = value
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '');
    if (!slug) {
      throw new BadRequestException('Unable to derive a valid slug');
    }
    return slug;
  }

  private toAllergyDto(row: Allergy): AllergyResponseDto {
    return {
      id: row.id,
      name: row.name,
      slug: row.slug,
      isActive: row.isActive,
      sortOrder: row.sortOrder,
      createdAt: row.createdAt.toISOString(),
      updatedAt: row.updatedAt.toISOString(),
    };
  }

  private toGoalDto(row: PrimaryGoal): PrimaryGoalResponseDto {
    return {
      id: row.id,
      name: row.name,
      slug: row.slug,
      description: row.description,
      iconKey: row.iconKey,
      isActive: row.isActive,
      sortOrder: row.sortOrder,
      createdAt: row.createdAt.toISOString(),
      updatedAt: row.updatedAt.toISOString(),
    };
  }

  private toProfileDto(profile: {
    id: string;
    employeeId: string;
    age: number;
    gender: string;
    heightCm: number;
    weightKg: number;
    lifestyle: HealthProfileResponseDto['lifestyle'];
    activityLevel: HealthProfileResponseDto['activityLevel'];
    targetEnergyKcal: number;
    targetProteinMg: number;
    targetCarbsMg: number;
    targetFatMg: number;
    targetFiberMg: number;
    targetSugarMg: number;
    targetSodiumMg: number;
    targetIronUg: number;
    createdAt: Date;
    updatedAt: Date;
    allergies: Array<{
      id: string;
      allergyId: string | null;
      customLabel: string | null;
      allergy: { name: string } | null;
    }>;
    goals: Array<{
      id: string;
      goalId: string | null;
      customLabel: string | null;
      goal: { name: string } | null;
    }>;
  }): HealthProfileResponseDto {
    return {
      id: profile.id,
      employeeId: profile.employeeId,
      age: profile.age,
      gender: profile.gender,
      heightCm: profile.heightCm,
      weightKg: profile.weightKg,
      lifestyle: profile.lifestyle,
      activityLevel: profile.activityLevel,
      targetEnergyKcal: profile.targetEnergyKcal,
      targetProteinMg: profile.targetProteinMg,
      targetCarbsMg: profile.targetCarbsMg,
      targetFatMg: profile.targetFatMg,
      targetFiberMg: profile.targetFiberMg,
      targetSugarMg: profile.targetSugarMg,
      targetSodiumMg: profile.targetSodiumMg,
      targetIronUg: profile.targetIronUg,
      allergies: profile.allergies.map((row) => ({
        id: row.id,
        allergyId: row.allergyId,
        allergyName: row.allergy?.name ?? null,
        customLabel: row.customLabel,
      })),
      goals: profile.goals.map((row) => ({
        id: row.id,
        goalId: row.goalId,
        goalName: row.goal?.name ?? null,
        customLabel: row.customLabel,
      })),
      createdAt: profile.createdAt.toISOString(),
      updatedAt: profile.updatedAt.toISOString(),
    };
  }
}
