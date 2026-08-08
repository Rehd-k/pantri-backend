import { IsEnum, IsOptional, IsString, MaxLength } from 'class-validator';
import {
  MealItemMatchType,
  MealPlanStatus,
} from '../../../generated/prisma/client';

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
  sortOrder!: number;
}

export class MealPlanDayResponseDto {
  id!: string;
  dayIndex!: number;
  label!: string;
  items!: MealPlanItemResponseDto[];
}

export class MealPlanSummaryDto {
  id!: string;
  employeeId!: string;
  employeeName!: string;
  employerName!: string;
  status!: MealPlanStatus;
  title!: string;
  packageId!: string | null;
  failureReason!: string | null;
  adminNote!: string | null;
  reviewedAt!: string | null;
  createdAt!: string;
  updatedAt!: string;
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
  } | null;
}
