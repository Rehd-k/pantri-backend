import { dailyInterestKobo } from './money';

export interface SimulatePayoffMonthsParams {
  principalOutstanding: number;
  postedInterest: number;
  postedFees: number;
  postedPenalties: number;
  /** Hypothetical amount to add to the balance before simulating (e.g. a pending reservation). */
  reservedToAdd: number;
  monthlyDeductionKobo: number;
  annualRateBps: number;
  /** Days remaining in the interest-free grace period, counted from `fromDate`. */
  graceDaysRemaining: number;
  maxMonths: number;
  payrollDayOfMonth: number;
  fromDate: Date;
}

export interface PayoffScheduleEntry {
  month: number;
  payrollDate: string;
  openingBalanceKobo: number;
  interestAccruedKobo: number;
  deductionAppliedKobo: number;
  closingBalanceKobo: number;
}

export interface SimulatePayoffMonthsResult {
  months: number;
  paysOffWithinMax: boolean;
  schedule: PayoffScheduleEntry[];
}

const MS_PER_DAY = 24 * 60 * 60 * 1000;

/**
 * Projects a month-by-month amortization schedule for a revolving balance
 * being repaid via fixed payroll deductions, applying simple daily interest
 * outside of the grace window. This is a planning/estimation tool (used to
 * warn employees/employers "this purchase pays off in N months") — it is
 * NOT the ledger; actual interest is posted by `InterestService` from real
 * daily accruals.
 */
export function simulatePayoffMonths(
  params: SimulatePayoffMonthsParams,
): SimulatePayoffMonthsResult {
  const {
    principalOutstanding,
    postedInterest,
    postedFees,
    postedPenalties,
    reservedToAdd,
    monthlyDeductionKobo,
    annualRateBps,
    graceDaysRemaining,
    maxMonths,
    payrollDayOfMonth,
    fromDate,
  } = params;

  let balanceKobo = Math.max(
    0,
    principalOutstanding +
      postedInterest +
      postedFees +
      postedPenalties +
      reservedToAdd,
  );

  const schedule: PayoffScheduleEntry[] = [];

  if (balanceKobo <= 0) {
    return { months: 0, paysOffWithinMax: true, schedule };
  }

  if (monthlyDeductionKobo <= 0) {
    return { months: maxMonths, paysOffWithinMax: false, schedule };
  }

  let graceDaysLeft = Math.max(0, graceDaysRemaining);
  let cursor = new Date(fromDate.getTime());
  let monthsUsed = 0;

  for (
    let month = 1;
    month <= Math.max(1, maxMonths) && balanceKobo > 0;
    month += 1
  ) {
    const payrollDate = nextPayrollDate(cursor, payrollDayOfMonth);
    const daysInPeriod = wholeDaysBetween(cursor, payrollDate);

    const interestDays = Math.max(0, daysInPeriod - graceDaysLeft);
    graceDaysLeft = Math.max(0, graceDaysLeft - daysInPeriod);

    const openingBalanceKobo = balanceKobo;
    const interestAccruedKobo =
      dailyInterestKobo(balanceKobo, annualRateBps) * interestDays;
    balanceKobo += interestAccruedKobo;

    const deductionAppliedKobo = Math.min(monthlyDeductionKobo, balanceKobo);
    balanceKobo = Math.max(0, balanceKobo - deductionAppliedKobo);

    schedule.push({
      month,
      payrollDate: payrollDate.toISOString().slice(0, 10),
      openingBalanceKobo,
      interestAccruedKobo,
      deductionAppliedKobo,
      closingBalanceKobo: balanceKobo,
    });

    monthsUsed = month;
    cursor = payrollDate;
  }

  return {
    months: monthsUsed,
    paysOffWithinMax: balanceKobo <= 0,
    schedule,
  };
}

/** Next occurrence of `payrollDayOfMonth` strictly after `from` (UTC calendar days). */
function nextPayrollDate(from: Date, payrollDayOfMonth: number): Date {
  const year = from.getUTCFullYear();
  const month = from.getUTCMonth();

  const sameMonthCandidate = clampedMonthDate(year, month, payrollDayOfMonth);
  if (sameMonthCandidate.getTime() > from.getTime()) {
    return sameMonthCandidate;
  }

  return clampedMonthDate(year, month + 1, payrollDayOfMonth);
}

function clampedMonthDate(
  year: number,
  month: number,
  dayOfMonth: number,
): Date {
  const daysInMonth = new Date(Date.UTC(year, month + 1, 0)).getUTCDate();
  const clampedDay = Math.min(Math.max(1, dayOfMonth), daysInMonth);
  return new Date(Date.UTC(year, month, clampedDay));
}

function wholeDaysBetween(a: Date, b: Date): number {
  return Math.max(0, Math.round((b.getTime() - a.getTime()) / MS_PER_DAY));
}
