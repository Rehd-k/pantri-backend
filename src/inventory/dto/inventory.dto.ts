import { Type } from 'class-transformer';
import {
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  Min,
} from 'class-validator';
import {
  RestockAlertStatus,
} from '../../../generated/prisma/client';

export class AddHouseholdStockDto {
  @IsString()
  @IsNotEmpty()
  productId!: string;

  @Type(() => Number)
  @IsInt()
  @Min(1)
  quantity!: number;

  @IsOptional()
  @IsString()
  measureUnitId?: string;
}

export class UpdateHouseholdStockDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  quantityCanonical?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  restockThresholdCanonical?: number;
}

export class HouseholdStockProductDto {
  id!: string;
  name!: string;
  imageUrl!: string;
  slug!: string;
}

export class HouseholdStockResponseDto {
  id!: string;
  employeeId!: string;
  productId!: string;
  product!: HouseholdStockProductDto;
  quantityCanonical!: number;
  restockThresholdCanonical!: number;
  displayQuantity!: string;
  displayUnit!: string;
  isLow!: boolean;
  isEmpty!: boolean;
  dimension!: string;
  createdAt!: string;
  updatedAt!: string;
}

export class RestockAlertResponseDto {
  id!: string;
  employeeId!: string;
  stockId!: string;
  productId!: string;
  productName!: string;
  productImageUrl!: string;
  status!: RestockAlertStatus;
  quantityCanonical!: number;
  suggestedPackId!: string | null;
  suggestedPackLabel!: string | null;
  createdAt!: string;
  updatedAt!: string;
}
