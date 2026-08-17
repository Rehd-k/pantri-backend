import { Type } from 'class-transformer';
import {
  IsBoolean,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  Min,
} from 'class-validator';

export class CreateProductPackDto {
  @IsString()
  @IsNotEmpty()
  brand!: string;

  @IsString()
  @IsNotEmpty()
  packUnitId!: string;

  @Type(() => Number)
  @IsInt()
  @Min(1)
  packAmount!: number;

  @IsString()
  @IsNotEmpty()
  packageLabel!: string;

  @Type(() => Number)
  @IsInt()
  @Min(0)
  priceKobo!: number;

  @Type(() => Number)
  @IsInt()
  @Min(0)
  retailPriceKobo!: number;

  @IsOptional()
  @IsString()
  sku?: string;

  @IsOptional()
  @IsString()
  imageUrl?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  amountMg?: number | null;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  amountMl?: number | null;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  amountEach?: number | null;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  sortOrder?: number;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}

export class UpdateProductPackDto {
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  brand?: string;

  @IsOptional()
  @IsString()
  packUnitId?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  packAmount?: number;

  @IsOptional()
  @IsString()
  @IsNotEmpty()
  packageLabel?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  priceKobo?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  retailPriceKobo?: number;

  @IsOptional()
  @IsString()
  imageUrl?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  amountMg?: number | null;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  amountMl?: number | null;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  amountEach?: number | null;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  sortOrder?: number;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
