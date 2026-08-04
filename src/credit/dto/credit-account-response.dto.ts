import {
  CreditAccount,
  CreditAccountStatus,
} from '../../../generated/prisma/client';

export class CreditAccountResponseDto {
  id!: string;
  creditLimitKobo!: number;
  manualLimitOverrideKobo!: number | null;
  effectiveLimitKobo!: number;
  principalOutstandingKobo!: number;
  postedInterestKobo!: number;
  postedFeesKobo!: number;
  postedPenaltiesKobo!: number;
  reservedKobo!: number;
  accruedInterestUnpostedKobo!: number;
  availableKobo!: number;
  totalOwedKobo!: number;
  status!: CreditAccountStatus;
  consecutiveMissedDeductions!: number;
  updatedAt!: string;
}

export function toCreditAccountResponseDto(
  account: CreditAccount,
): CreditAccountResponseDto {
  const effectiveLimitKobo =
    account.manualLimitOverrideKobo ?? account.creditLimitKobo;

  return {
    id: account.id,
    creditLimitKobo: account.creditLimitKobo,
    manualLimitOverrideKobo: account.manualLimitOverrideKobo,
    effectiveLimitKobo,
    principalOutstandingKobo: account.principalOutstandingKobo,
    postedInterestKobo: account.postedInterestKobo,
    postedFeesKobo: account.postedFeesKobo,
    postedPenaltiesKobo: account.postedPenaltiesKobo,
    reservedKobo: account.reservedKobo,
    accruedInterestUnpostedKobo: account.accruedInterestUnpostedKobo,
    availableKobo: account.availableKobo,
    totalOwedKobo:
      account.principalOutstandingKobo +
      account.postedInterestKobo +
      account.postedFeesKobo +
      account.postedPenaltiesKobo,
    status: account.status,
    consecutiveMissedDeductions: account.consecutiveMissedDeductions,
    updatedAt: account.updatedAt.toISOString(),
  };
}
