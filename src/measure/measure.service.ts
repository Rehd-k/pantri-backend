import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import type { MeasureFamily, MeasureUnit } from '../../generated/prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { slugify } from '../common/slug';
import {
  CreateMeasureFamilyDto,
  CreateMeasureUnitDto,
  UpdateMeasureFamilyDto,
  UpdateMeasureUnitDto,
} from './dto/measure-request.dto';
import {
  MeasureFamilyResponseDto,
  MeasureUnitResponseDto,
} from './dto/measure-response.dto';

type FamilyWithUnits = MeasureFamily & {
  defaultRecipeUnit: MeasureUnit | null;
  defaultPurchaseUnit: MeasureUnit | null;
};

const familyInclude = {
  defaultRecipeUnit: true,
  defaultPurchaseUnit: true,
} as const;

@Injectable()
export class MeasureService {
  constructor(private readonly prisma: PrismaService) {}

  listUnits(activeOnly: boolean): Promise<MeasureUnitResponseDto[]> {
    return this.prisma.measureUnit
      .findMany({
        where: activeOnly ? { isActive: true } : undefined,
        orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
      })
      .then((rows) => rows.map((row) => this.toUnitDto(row)));
  }

  listFamilies(activeOnly: boolean): Promise<MeasureFamilyResponseDto[]> {
    return this.prisma.measureFamily
      .findMany({
        where: activeOnly ? { isActive: true } : undefined,
        include: familyInclude,
        orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
      })
      .then((rows) => rows.map((row) => this.toFamilyDto(row)));
  }

  async createUnit(dto: CreateMeasureUnitDto): Promise<MeasureUnitResponseDto> {
    this.assertCanonical(dto.dimension, dto);
    const slug = slugify(dto.slug);
    const existing = await this.prisma.measureUnit.findUnique({
      where: { slug },
    });
    if (existing) {
      throw new BadRequestException(`Measure unit slug "${slug}" already exists`);
    }
    const row = await this.prisma.measureUnit.create({
      data: {
        slug,
        name: dto.name.trim(),
        shortLabel: dto.shortLabel.trim(),
        kind: dto.kind,
        dimension: dto.dimension,
        milligrams: dto.milligrams ?? null,
        millilitres: dto.millilitres ?? null,
        piecesPerUnit: dto.piecesPerUnit ?? null,
        isPurchaseUnit: dto.isPurchaseUnit ?? false,
        isRecipeUnit: dto.isRecipeUnit ?? false,
        sortOrder: dto.sortOrder ?? 0,
        isActive: dto.isActive ?? true,
      },
    });
    return this.toUnitDto(row);
  }

  async updateUnit(
    id: string,
    dto: UpdateMeasureUnitDto,
  ): Promise<MeasureUnitResponseDto> {
    const existing = await this.requireUnit(id);
    const dimension = dto.dimension ?? existing.dimension;
    this.assertCanonical(dimension, {
      milligrams: dto.milligrams === undefined ? existing.milligrams : dto.milligrams,
      millilitres:
        dto.millilitres === undefined ? existing.millilitres : dto.millilitres,
      piecesPerUnit:
        dto.piecesPerUnit === undefined
          ? existing.piecesPerUnit
          : dto.piecesPerUnit,
    });
    const row = await this.prisma.measureUnit.update({
      where: { id },
      data: {
        ...(dto.name !== undefined ? { name: dto.name.trim() } : {}),
        ...(dto.shortLabel !== undefined
          ? { shortLabel: dto.shortLabel.trim() }
          : {}),
        ...(dto.kind !== undefined ? { kind: dto.kind } : {}),
        ...(dto.dimension !== undefined ? { dimension: dto.dimension } : {}),
        ...(dto.milligrams !== undefined ? { milligrams: dto.milligrams } : {}),
        ...(dto.millilitres !== undefined
          ? { millilitres: dto.millilitres }
          : {}),
        ...(dto.piecesPerUnit !== undefined
          ? { piecesPerUnit: dto.piecesPerUnit }
          : {}),
        ...(dto.isPurchaseUnit !== undefined
          ? { isPurchaseUnit: dto.isPurchaseUnit }
          : {}),
        ...(dto.isRecipeUnit !== undefined
          ? { isRecipeUnit: dto.isRecipeUnit }
          : {}),
        ...(dto.sortOrder !== undefined ? { sortOrder: dto.sortOrder } : {}),
        ...(dto.isActive !== undefined ? { isActive: dto.isActive } : {}),
      },
    });
    return this.toUnitDto(row);
  }

  async deactivateUnit(id: string): Promise<MeasureUnitResponseDto> {
    await this.requireUnit(id);
    const row = await this.prisma.measureUnit.update({
      where: { id },
      data: { isActive: false },
    });
    return this.toUnitDto(row);
  }

  async createFamily(
    dto: CreateMeasureFamilyDto,
  ): Promise<MeasureFamilyResponseDto> {
    const slug = slugify(dto.slug);
    const existing = await this.prisma.measureFamily.findUnique({
      where: { slug },
    });
    if (existing) {
      throw new BadRequestException(
        `Measure family slug "${slug}" already exists`,
      );
    }
    await this.assertOptionalUnit(dto.defaultRecipeUnitId);
    await this.assertOptionalUnit(dto.defaultPurchaseUnitId);
    const row = await this.prisma.measureFamily.create({
      data: {
        slug,
        name: dto.name.trim(),
        description: dto.description?.trim() ?? '',
        dimension: dto.dimension,
        defaultRecipeUnitId: dto.defaultRecipeUnitId ?? null,
        defaultPurchaseUnitId: dto.defaultPurchaseUnitId ?? null,
        sortOrder: dto.sortOrder ?? 0,
        isActive: dto.isActive ?? true,
      },
      include: familyInclude,
    });
    return this.toFamilyDto(row);
  }

  async updateFamily(
    id: string,
    dto: UpdateMeasureFamilyDto,
  ): Promise<MeasureFamilyResponseDto> {
    await this.requireFamily(id);
    await this.assertOptionalUnit(dto.defaultRecipeUnitId);
    await this.assertOptionalUnit(dto.defaultPurchaseUnitId);
    const row = await this.prisma.measureFamily.update({
      where: { id },
      data: {
        ...(dto.name !== undefined ? { name: dto.name.trim() } : {}),
        ...(dto.description !== undefined
          ? { description: dto.description.trim() }
          : {}),
        ...(dto.dimension !== undefined ? { dimension: dto.dimension } : {}),
        ...(dto.defaultRecipeUnitId !== undefined
          ? { defaultRecipeUnitId: dto.defaultRecipeUnitId }
          : {}),
        ...(dto.defaultPurchaseUnitId !== undefined
          ? { defaultPurchaseUnitId: dto.defaultPurchaseUnitId }
          : {}),
        ...(dto.sortOrder !== undefined ? { sortOrder: dto.sortOrder } : {}),
        ...(dto.isActive !== undefined ? { isActive: dto.isActive } : {}),
      },
      include: familyInclude,
    });
    return this.toFamilyDto(row);
  }

  async deactivateFamily(id: string): Promise<MeasureFamilyResponseDto> {
    await this.requireFamily(id);
    const row = await this.prisma.measureFamily.update({
      where: { id },
      data: { isActive: false },
      include: familyInclude,
    });
    return this.toFamilyDto(row);
  }

  async requireUnit(id: string): Promise<MeasureUnit> {
    const row = await this.prisma.measureUnit.findUnique({ where: { id } });
    if (!row) {
      throw new NotFoundException('Measure unit not found');
    }
    return row;
  }

  private async requireFamily(id: string): Promise<MeasureFamily> {
    const row = await this.prisma.measureFamily.findUnique({ where: { id } });
    if (!row) {
      throw new NotFoundException('Measure family not found');
    }
    return row;
  }

  private async assertOptionalUnit(
    id: string | null | undefined,
  ): Promise<void> {
    if (!id) return;
    await this.requireUnit(id);
  }

  private assertCanonical(
    dimension: string,
    values: {
      milligrams?: number | null;
      millilitres?: number | null;
      piecesPerUnit?: number | null;
    },
  ): void {
    if (dimension === 'MASS' && !(values.milligrams && values.milligrams > 0)) {
      throw new BadRequestException('Mass units require milligrams > 0');
    }
    if (
      dimension === 'VOLUME' &&
      !(values.millilitres && values.millilitres > 0)
    ) {
      throw new BadRequestException('Volume units require millilitres > 0');
    }
    if (
      dimension === 'COUNT' &&
      !(values.piecesPerUnit && values.piecesPerUnit > 0)
    ) {
      throw new BadRequestException('Count units require piecesPerUnit > 0');
    }
  }

  toUnitDto(row: MeasureUnit): MeasureUnitResponseDto {
    return {
      id: row.id,
      slug: row.slug,
      name: row.name,
      shortLabel: row.shortLabel,
      kind: row.kind,
      dimension: row.dimension,
      milligrams: row.milligrams,
      millilitres: row.millilitres,
      piecesPerUnit: row.piecesPerUnit,
      isPurchaseUnit: row.isPurchaseUnit,
      isRecipeUnit: row.isRecipeUnit,
      sortOrder: row.sortOrder,
      isActive: row.isActive,
      createdAt: row.createdAt.toISOString(),
      updatedAt: row.updatedAt.toISOString(),
    };
  }

  toFamilyDto(row: FamilyWithUnits): MeasureFamilyResponseDto {
    return {
      id: row.id,
      slug: row.slug,
      name: row.name,
      description: row.description,
      dimension: row.dimension,
      defaultRecipeUnitId: row.defaultRecipeUnitId,
      defaultPurchaseUnitId: row.defaultPurchaseUnitId,
      defaultRecipeUnit: row.defaultRecipeUnit
        ? this.toUnitDto(row.defaultRecipeUnit)
        : null,
      defaultPurchaseUnit: row.defaultPurchaseUnit
        ? this.toUnitDto(row.defaultPurchaseUnit)
        : null,
      sortOrder: row.sortOrder,
      isActive: row.isActive,
      createdAt: row.createdAt.toISOString(),
      updatedAt: row.updatedAt.toISOString(),
    };
  }
}
