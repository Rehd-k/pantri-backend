import { IsDateString, IsOptional } from 'class-validator';
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
  cookability!: RecipeCookability;
  nutrition!: CanonicalNutritionDto;
  ingredients!: RecipeIngredientResponseDto[];
  createdAt!: string;
  updatedAt!: string;
}

export class CookMealResponseDto {
  recipe!: RecipeResponseDto;
  mealPlanItemId!: string | null;
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
