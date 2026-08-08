import {
  ArrayMaxSize,
  IsArray,
  IsEnum,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  Max,
  Min,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';
import {
  ActivityLevel,
  DietaryLifestyle,
} from '../../../generated/prisma/client';

export class AllergySelectionDto {
  @IsOptional()
  @IsString()
  allergyId?: string;

  @IsOptional()
  @IsString()
  customLabel?: string;
}

export class GoalSelectionDto {
  @IsOptional()
  @IsString()
  goalId?: string;

  @IsOptional()
  @IsString()
  customLabel?: string;
}

export class UpsertHealthProfileDto {
  @Type(() => Number)
  @IsInt()
  @Min(10)
  @Max(120)
  age!: number;

  @IsString()
  @IsNotEmpty()
  gender!: string;

  @Type(() => Number)
  @IsInt()
  @Min(50)
  @Max(250)
  heightCm!: number;

  @Type(() => Number)
  @IsInt()
  @Min(20)
  @Max(400)
  weightKg!: number;

  @IsEnum(DietaryLifestyle)
  lifestyle!: DietaryLifestyle;

  @IsEnum(ActivityLevel)
  activityLevel!: ActivityLevel;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => AllergySelectionDto)
  @ArrayMaxSize(50)
  allergies!: AllergySelectionDto[];

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => GoalSelectionDto)
  @ArrayMaxSize(50)
  goals!: GoalSelectionDto[];
}

export class HealthProfileAllergyDto {
  id!: string;
  allergyId!: string | null;
  allergyName!: string | null;
  customLabel!: string | null;
}

export class HealthProfileGoalDto {
  id!: string;
  goalId!: string | null;
  goalName!: string | null;
  customLabel!: string | null;
}

export class HealthProfileResponseDto {
  id!: string;
  employeeId!: string;
  age!: number;
  gender!: string;
  heightCm!: number;
  weightKg!: number;
  lifestyle!: DietaryLifestyle;
  activityLevel!: ActivityLevel;
  allergies!: HealthProfileAllergyDto[];
  goals!: HealthProfileGoalDto[];
  createdAt!: string;
  updatedAt!: string;
}
