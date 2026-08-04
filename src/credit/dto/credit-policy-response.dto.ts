import {
  CreditPolicy,
  OverDurationAction,
  OverLimitAction,
} from '../../../generated/prisma/client';

export class CreditPolicyResponseDto {
  employerId!: string;
  version!: number;
  defaultDeductionPercent!: number;
  minDeductionPercent!: number;
  maxDeductionPercent!: number;
  employeeMaySetDeductionPercent!: boolean;
  creditMultiplierBps!: number;
  maxRepaymentMonths!: number;
  reservationTtlHours!: number;
  approvalTtlHours!: number;
  interestAnnualRateBps!: number;
  interestGraceDays!: number;
  penaltiesEnabled!: boolean;
  minDaysBetweenPurchases!: number;
  maxPurchasesInWindow!: number;
  purchaseWindowDays!: number;
  requirePriorDeductionAfterFirst!: boolean;
  overLimitAction!: OverLimitAction;
  overDurationAction!: OverDurationAction;
  approvalThresholdKobo!: number | null;
  requireApprovalFirstPurchase!: boolean;
  requireApprovalHighRisk!: boolean;
  highRiskScoreThreshold!: number;
  consecutiveMissesBeforeFreeze!: number;
  updatedAt!: string;
}

export function toCreditPolicyResponseDto(
  policy: CreditPolicy,
): CreditPolicyResponseDto {
  return {
    employerId: policy.employerId,
    version: policy.version,
    defaultDeductionPercent: policy.defaultDeductionPercent,
    minDeductionPercent: policy.minDeductionPercent,
    maxDeductionPercent: policy.maxDeductionPercent,
    employeeMaySetDeductionPercent: policy.employeeMaySetDeductionPercent,
    creditMultiplierBps: policy.creditMultiplierBps,
    maxRepaymentMonths: policy.maxRepaymentMonths,
    reservationTtlHours: policy.reservationTtlHours,
    approvalTtlHours: policy.approvalTtlHours,
    interestAnnualRateBps: policy.interestAnnualRateBps,
    interestGraceDays: policy.interestGraceDays,
    penaltiesEnabled: policy.penaltiesEnabled,
    minDaysBetweenPurchases: policy.minDaysBetweenPurchases,
    maxPurchasesInWindow: policy.maxPurchasesInWindow,
    purchaseWindowDays: policy.purchaseWindowDays,
    requirePriorDeductionAfterFirst: policy.requirePriorDeductionAfterFirst,
    overLimitAction: policy.overLimitAction,
    overDurationAction: policy.overDurationAction,
    approvalThresholdKobo: policy.approvalThresholdKobo,
    requireApprovalFirstPurchase: policy.requireApprovalFirstPurchase,
    requireApprovalHighRisk: policy.requireApprovalHighRisk,
    highRiskScoreThreshold: policy.highRiskScoreThreshold,
    consecutiveMissesBeforeFreeze: policy.consecutiveMissesBeforeFreeze,
    updatedAt: policy.updatedAt.toISOString(),
  };
}
