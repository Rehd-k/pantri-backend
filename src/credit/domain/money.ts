import { CreditAccountBalances } from './types';

/**
 * Pure money math for the revolving credit engine. All amounts are integer
 * kobo (1/100 Naira). Nothing here touches the database — keep it that way
 * so the rules can be unit tested in isolation.
 */

const BPS_DENOMINATOR = 10_000;
const DAYS_PER_YEAR = 365;

/**
 * creditLimit = floor(salaryKobo * multiplierBps / 10000)
 */
export function computeCreditLimitKobo(
  salaryKobo: number,
  multiplierBps: number,
): number {
  if (salaryKobo <= 0 || multiplierBps <= 0) {
    return 0;
  }
  return Math.floor((salaryKobo * multiplierBps) / BPS_DENOMINATOR);
}

/**
 * available = max(0, limit - principal - postedInterest - postedFees - postedPenalties - reserved)
 */
export function computeAvailableKobo(balances: CreditAccountBalances): number {
  const committed =
    balances.principalOutstandingKobo +
    balances.postedInterestKobo +
    balances.postedFeesKobo +
    balances.postedPenaltiesKobo +
    balances.reservedKobo;

  return Math.max(0, balances.creditLimitKobo - committed);
}

/**
 * Simple daily interest on an outstanding balance:
 * floor(outstandingKobo * annualRateBps / 10000 / 365)
 */
export function dailyInterestKobo(
  outstandingKobo: number,
  annualRateBps: number,
): number {
  if (outstandingKobo <= 0 || annualRateBps <= 0) {
    return 0;
  }
  return Math.floor(
    (outstandingKobo * annualRateBps) / BPS_DENOMINATOR / DAYS_PER_YEAR,
  );
}

/** Total amount currently owed (excludes reservations, which are not yet drawn). */
export function computeTotalOwedKobo(
  balances: Pick<
    CreditAccountBalances,
    | 'principalOutstandingKobo'
    | 'postedInterestKobo'
    | 'postedFeesKobo'
    | 'postedPenaltiesKobo'
  >,
): number {
  return (
    balances.principalOutstandingKobo +
    balances.postedInterestKobo +
    balances.postedFeesKobo +
    balances.postedPenaltiesKobo
  );
}

/** Utilization as a whole-number percent of the effective limit, clamped to [0, 100+]. */
export function computeUtilizationPercent(
  committedKobo: number,
  effectiveLimitKobo: number,
): number {
  if (effectiveLimitKobo <= 0) {
    return 0;
  }
  return Math.round((committedKobo / effectiveLimitKobo) * 100);
}

export function clampNonNegative(amountKobo: number): number {
  return amountKobo < 0 ? 0 : amountKobo;
}
