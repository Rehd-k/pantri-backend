import { Transform, Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsBoolean,
  IsDateString,
  IsEnum,
  IsIn,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
  ValidateNested,
} from 'class-validator';
import {
  MealItemMatchType,
  MealPlanSource,
  MealPlanStatus,
} from '../../../generated/prisma/client';
import { RecipeResponseDto } from './recipe.dto';

export const REQUIRED_MEAL_SLOTS = ['breakfast', 'lunch', 'dinner'] as const;
export const ALL_MEAL_SLOTS = ['breakfast', 'lunch', 'dinner', 'snack'] as const;

export class RejectMealPlanDto {
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  adminNote?: string;
}

export class ApproveMealPlanDto {
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  adminNote?: string;
}

export class ListMealPlansQueryDto {
  @IsOptional()
  @IsEnum(MealPlanStatus)
  status?: MealPlanStatus;
}

export class ListNutritionEmployeesQueryDto {
  @IsOptional()
  @IsString()
  q?: string;

  @IsOptional()
  @Transform(({ value }) => value === true || value === 'true')
  @IsBoolean()
  needsPlan?: boolean;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(200)
  take?: number;
}

export class ListCatalogProductsQueryDto {
  @IsOptional()
  @IsString()
  q?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  take?: number;
}

export class CreateMealPlanDraftDto {
  @IsString()
  @IsNotEmpty()
  employeeId!: string;

  @IsDateString()
  startsOn!: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(14)
  dayCount?: number;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  title?: string;
}

export class UpdateMealPlanDraftDto {
  @IsOptional()
  @IsString()
  @MaxLength(120)
  title?: string;

  @IsOptional()
  @IsDateString()
  startsOn?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(14)
  dayCount?: number;
}

export class MealIngredientInputDto {
  @IsString()
  @IsNotEmpty()
  productId!: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(99)
  quantity?: number;
}

export class UpsertMealPlanItemDto {
  @IsOptional()
  @IsString()
  dayId?: string;

  @IsOptional()
  @IsDateString()
  planDate?: string;

  @IsString()
  @IsNotEmpty()
  mealSlot!: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(120)
  title!: string;

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  rationale?: string;

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => MealIngredientInputDto)
  @ArrayMinSize(1)
  @ArrayMaxSize(12)
  ingredients?: MealIngredientInputDto[];

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  instructionSteps?: string[];
}

export class PatchMealPlanItemDto {
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  @MaxLength(120)
  title?: string;

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  rationale?: string;

  @IsOptional()
  @IsString()
  @IsNotEmpty()
  mealSlot?: string;

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => MealIngredientInputDto)
  @ArrayMinSize(1)
  @ArrayMaxSize(12)
  ingredients?: MealIngredientInputDto[];
}

export class UpsertMealRecipeDto {
  @IsOptional()
  @IsString()
  @MaxLength(120)
  title?: string;

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  rationale?: string;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => MealIngredientInputDto)
  @ArrayMinSize(1)
  @ArrayMaxSize(12)
  ingredients!: MealIngredientInputDto[];

  @IsArray()
  @IsString({ each: true })
  @ArrayMinSize(1)
  instructionSteps!: string[];
}

export class AiGenerateMealPlanDto {
  @IsOptional()
  @IsIn(['openai', 'anthropic', 'auto'])
  provider?: 'openai' | 'anthropic' | 'auto';

  @IsOptional()
  @IsBoolean()
  replaceExisting?: boolean;
}

export class AiSuggestSlotDto {
  @IsOptional()
  @IsIn(['openai', 'anthropic', 'auto'])
  provider?: 'openai' | 'anthropic' | 'auto';

  @IsOptional()
  @IsString()
  dayId?: string;

  @IsOptional()
  @IsDateString()
  planDate?: string;

  @IsString()
  @IsNotEmpty()
  mealSlot!: string;

  @IsOptional()
  @IsBoolean()
  apply?: boolean;
}

export class CompletenessGapDto {
  dayId!: string;
  planDate!: string | null;
  mealSlot!: string;
  reason!: 'missing_meal' | 'missing_product' | 'missing_directions';
}

export class MealPlanCompletenessDto {
  requiredSlots!: number;
  filledSlots!: number;
  recipesWithSteps!: number;
  unmatched!: number;
  cookedCount!: number;
  plannedCount!: number;
  readyToPublish!: boolean;
  missing!: CompletenessGapDto[];
}

export class MealPlanItemResponseDto {
  id!: string;
  mealSlot!: string;
  title!: string;
  rationale!: string;
  requestedProductName!: string;
  productId!: string | null;
  productName!: string | null;
  productImageUrl!: string | null;
  origin!: string | null;
  nutritionFacts!: Record<string, string>;
  tags!: string[];
  matchType!: MealItemMatchType;
  quantity!: number;
  quantityCanonical!: number;
  measureUnitId!: string | null;
  measureUnitLabel!: string | null;
  recipeId!: string | null;
  recipe!: RecipeResponseDto | null;
  cookedAt!: string | null;
  sortOrder!: number;
}

export class MealPlanDayResponseDto {
  id!: string;
  dayIndex!: number;
  label!: string;
  planDate!: string | null;
  items!: MealPlanItemResponseDto[];
}

export class MealPlanSummaryDto {
  id!: string;
  employeeId!: string;
  employeeName!: string;
  employerName!: string;
  status!: MealPlanStatus;
  source!: MealPlanSource;
  title!: string;
  startsOn!: string | null;
  endsOn!: string | null;
  activatedAt!: string | null;
  packageId!: string | null;
  failureReason!: string | null;
  adminNote!: string | null;
  reviewedAt!: string | null;
  createdAt!: string;
  updatedAt!: string;
  completeness!: MealPlanCompletenessDto;
}

export class MealPlanDetailDto extends MealPlanSummaryDto {
  days!: MealPlanDayResponseDto[];
  profile!: {
    age: number;
    gender: string;
    heightCm: number;
    weightKg: number;
    lifestyle: string;
    activityLevel: string;
    allergies: string[];
    goals: string[];
    targetEnergyKcal: number;
    targetProteinMg: number;
    targetCarbsMg: number;
    targetFatMg: number;
  } | null;
}

export class NutritionEmployeeProfileDto {
  age!: number;
  gender!: string;
  heightCm!: number;
  weightKg!: number;
  lifestyle!: string;
  activityLevel!: string;
  allergies!: string[];
  goals!: string[];
  targetEnergyKcal!: number;
  targetProteinMg!: number;
  targetCarbsMg!: number;
  targetFatMg!: number;
}

export class NutritionEmployeeDto {
  employeeId!: string;
  userId!: string;
  firstName!: string;
  lastName!: string;
  email!: string;
  employerName!: string;
  hasProfile!: boolean;
  hasActivePlan!: boolean;
  latestPlanStatus!: MealPlanStatus | null;
  latestPlanId!: string | null;
  profile!: NutritionEmployeeProfileDto | null;
}

export class CatalogProductPickDto {
  id!: string;
  name!: string;
  imageUrl!: string;
  origin!: string;
  tags!: string[];
  nutritionFacts!: Record<string, string>;
  measureUnitId!: string | null;
  measureUnitLabel!: string | null;
}

export class AiSlotSuggestionDto {
  mealSlot!: string;
  title!: string;
  rationale!: string;
  instructionSteps!: string[];
  ingredients!: MealIngredientInputDto[];
  applied!: boolean;
  item!: MealPlanItemResponseDto | null;
}
