import { Type } from 'class-transformer';
import {
  IsBoolean,
  IsEnum,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  Min,
} from 'class-validator';
import {
  MeasureDimension,
  MeasureKind,
} from '../../../generated/prisma/client';

export class CreateMeasureUnitDto {
  @IsOptional()
  @IsString()
  slug?: string;

  @IsString()
  @IsNotEmpty()
  name!: string;

  @IsString()
  @IsNotEmpty()
  shortLabel!: string;

  @IsEnum(MeasureKind)
  kind!: MeasureKind;

  @IsEnum(MeasureDimension)
  dimension!: MeasureDimension;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  milligrams?: number | null;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  millilitres?: number | null;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  piecesPerUnit?: number | null;

  @IsOptional()
  @IsBoolean()
  isPurchaseUnit?: boolean;

  @IsOptional()
  @IsBoolean()
  isRecipeUnit?: boolean;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  sortOrder?: number;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}

export class UpdateMeasureUnitDto {
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  name?: string;

  @IsOptional()
  @IsString()
  @IsNotEmpty()
  shortLabel?: string;

  @IsOptional()
  @IsEnum(MeasureKind)
  kind?: MeasureKind;

  @IsOptional()
  @IsEnum(MeasureDimension)
  dimension?: MeasureDimension;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  milligrams?: number | null;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  millilitres?: number | null;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  piecesPerUnit?: number | null;

  @IsOptional()
  @IsBoolean()
  isPurchaseUnit?: boolean;

  @IsOptional()
  @IsBoolean()
  isRecipeUnit?: boolean;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  sortOrder?: number;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}

export class CreateMeasureFamilyDto {
  @IsString()
  @IsNotEmpty()
  slug!: string;

  @IsString()
  @IsNotEmpty()
  name!: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsEnum(MeasureDimension)
  dimension!: MeasureDimension;

  @IsOptional()
  @IsString()
  defaultRecipeUnitId?: string | null;

  @IsOptional()
  @IsString()
  defaultPurchaseUnitId?: string | null;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  sortOrder?: number;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}

export class UpdateMeasureFamilyDto {
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  name?: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsEnum(MeasureDimension)
  dimension?: MeasureDimension;

  @IsOptional()
  @IsString()
  defaultRecipeUnitId?: string | null;

  @IsOptional()
  @IsString()
  defaultPurchaseUnitId?: string | null;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  sortOrder?: number;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
