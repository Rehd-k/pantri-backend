import { Type } from 'class-transformer';
import {
  IsBoolean,
  IsEnum,
  IsInt,
  IsOptional,
  Max,
  Min,
} from 'class-validator';
import {
  OverDurationAction,
  OverLimitAction,
} from '../../../generated/prisma/client';

export class UpdateCreditPolicyDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(100)
  defaultDeductionPercent?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(100)
  minDeductionPercent?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(100)
  maxDeductionPercent?: number;

  @IsOptional()
  @IsBoolean()
  employeeMaySetDeductionPercent?: boolean;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  creditMultiplierBps?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  maxRepaymentMonths?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  reservationTtlHours?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  approvalTtlHours?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  interestAnnualRateBps?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  interestGraceDays?: number;

  @IsOptional()
  @IsBoolean()
  penaltiesEnabled?: boolean;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  minDaysBetweenPurchases?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  maxPurchasesInWindow?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  purchaseWindowDays?: number;

  @IsOptional()
  @IsBoolean()
  requirePriorDeductionAfterFirst?: boolean;

  @IsOptional()
  @IsEnum(OverLimitAction)
  overLimitAction?: OverLimitAction;

  @IsOptional()
  @IsEnum(OverDurationAction)
  overDurationAction?: OverDurationAction;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  approvalThresholdKobo?: number;

  @IsOptional()
  @IsBoolean()
  requireApprovalFirstPurchase?: boolean;

  @IsOptional()
  @IsBoolean()
  requireApprovalHighRisk?: boolean;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(100)
  highRiskScoreThreshold?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  consecutiveMissesBeforeFreeze?: number;
}
