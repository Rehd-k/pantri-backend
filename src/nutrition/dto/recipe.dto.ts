import { Type } from 'class-transformer';
import { IsDateString, IsInt, IsOptional, Max, Min } from 'class-validator';
import { RecipeSource } from '../../../generated/prisma/client';
import { HouseholdStockResponseDto } from '../../inventory/dto/inventory.dto';
import { RestockAlertResponseDto } from '../../inventory/dto/inventory.dto';
import { CanonicalNutritionDto } from '../../marketplace/dto/product-response.dto';

export type RecipeCookability = 'ready' | 'partial' | 'blocked';

export class RecipeIngredientResponseDto {
  id!: string;
  productId!: string;
  productName!: string;
  productImageUrl!: string;
  measureUnitId!: string | null;
  measureUnitLabel!: string | null;
  /** Full Pantra/user-facing label, e.g. "1 Pantra Cup". */
  displayLabel!: string;
  quantity!: number;
  quantityCanonical!: number;
  haveCanonical!: number;
  isShort!: boolean;
  sortOrder!: number;
}

export class RecipeResponseDto {
  id!: string;
  employeeId!: string;
  title!: string;
  mealSlot!: string;
  instructions!: string;
  instructionSteps!: string[];
  rationale!: string;
  source!: RecipeSource;
  baseServings!: number;
  cookability!: RecipeCookability;
  nutrition!: CanonicalNutritionDto;
  ingredients!: RecipeIngredientResponseDto[];
  createdAt!: string;
  updatedAt!: string;
}

export class CookMealRequestDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(20)
  servings?: number;
}

export class CookMealResponseDto {
  recipe!: RecipeResponseDto;
  mealPlanItemId!: string | null;
  servings!: number;
  nutrition!: CanonicalNutritionDto;
  cookedAt!: string;
  restockAlerts!: RestockAlertResponseDto[];
  updatedStock!: HouseholdStockResponseDto[];
}

export class NutrientProgressDto {
  consumed!: number;
  target!: number;
  percent!: number;
}

export class NutritionProgressTotalsDto {
  energyKcal!: NutrientProgressDto;
  proteinMg!: NutrientProgressDto;
  carbsMg!: NutrientProgressDto;
  fatMg!: NutrientProgressDto;
  fiberMg!: NutrientProgressDto;
  sugarMg!: NutrientProgressDto;
  sodiumMg!: NutrientProgressDto;
  ironUg!: NutrientProgressDto;
}

export class NutritionProgressDayDto {
  day!: string;
  consumed!: CanonicalNutritionDto;
  cookedCount!: number;
}

export class CookedMealSummaryDto {
  id!: string;
  recipeId!: string;
  title!: string;
  mealSlot!: string;
  cookedAt!: string;
  nutrition!: CanonicalNutritionDto;
}

export class NutritionProgressResponseDto {
  from!: string;
  to!: string;
  targets!: CanonicalNutritionDto;
  consumed!: CanonicalNutritionDto;
  totals!: NutritionProgressTotalsDto;
  days!: NutritionProgressDayDto[];
  meals!: CookedMealSummaryDto[];
}

export class NutritionProgressQueryDto {
  @IsOptional()
  @IsDateString()
  from?: string;

  @IsOptional()
  @IsDateString()
  to?: string;
}
