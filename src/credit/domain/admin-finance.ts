import {
  CreditAccount,
  CreditPolicy,
  LedgerEntry,
  LedgerEntryType,
} from '../../../generated/prisma/client';
import {
  computeTotalOwedKobo,
  computeUtilizationPercent,
} from './money';
import { simulatePayoffMonths } from './payoff-simulator';

const PURCHASE_TYPES: LedgerEntryType[] = [
  LedgerEntryType.PURCHASE_POSTED,
  LedgerEntryType.DELIVERY_FEE,
  LedgerEntryType.SERVICE_FEE,
];

const REPAYMENT_TYPES: LedgerEntryType[] = [
  LedgerEntryType.PAYROLL_REPAYMENT,
  LedgerEntryType.REFUND,
  LedgerEntryType.WRITE_OFF,
];

export interface AdminLedgerEntryView {
  id: string;
  sequence: number;
  entryType: LedgerEntryType;
  amountKobo: number;
  balanceAfterKobo: number;
  balanceBeforeKobo: number;
  reservedAfterKobo: number;
  referenceType: string | null;
  referenceId: string | null;
  metadata: Record<string, unknown>;
  createdByUserId: string | null;
  createdByName: string | null;
  createdAt: string;
}

export interface AdminCreditFinanceSummary {
  creditLimitKobo: number;
  manualLimitOverrideKobo: number | null;
  effectiveCreditLimitKobo: number;
  outstandingKobo: number;
  availableKobo: number;
  reservedKobo: number;
  utilizationBps: number;
  utilizationPercent: number;
  monthlyDeductionKobo: number;
  deductionPercent: number;
  estimatedPayoffMonths: number | null;
  estimatedPayoffDate: string | null;
  paysOffWithinMax: boolean;
  accountStatus: string;
  lastPurchaseAt: string | null;
  lastRepaymentAt: string | null;
  principalOutstandingKobo: number;
  postedInterestKobo: number;
  postedFeesKobo: number;
  postedPenaltiesKobo: number;
}

export function monthlyDeductionFromSalary(
  salaryKobo: number,
  deductionPercent: number,
): number {
  if (salaryKobo <= 0 || deductionPercent <= 0) {
    return 0;
  }
  return Math.floor((salaryKobo * deductionPercent) / 100);
}

export function mapLedgerEntries(
  entries: Array<
    LedgerEntry & {
      createdBy?: {
        firstName: string;
        lastName: string;
      } | null;
    }
  >,
): AdminLedgerEntryView[] {
  // Entries may arrive newest-first; compute balanceBefore from balanceAfter - amount.
  return entries.map((entry) => {
    const metadata =
      entry.metadata &&
      typeof entry.metadata === 'object' &&
      !Array.isArray(entry.metadata)
        ? (entry.metadata as Record<string, unknown>)
        : {};
    return {
      id: entry.id,
      sequence: entry.sequence,
      entryType: entry.entryType,
      amountKobo: entry.amountKobo,
      balanceAfterKobo: entry.balanceAfterKobo,
      balanceBeforeKobo: entry.balanceAfterKobo - entry.amountKobo,
      reservedAfterKobo: entry.reservedAfterKobo,
      referenceType: entry.referenceType,
      referenceId: entry.referenceId,
      metadata,
      createdByUserId: entry.createdByUserId,
      createdByName: entry.createdBy
        ? `${entry.createdBy.firstName} ${entry.createdBy.lastName}`.trim()
        : null,
      createdAt: entry.createdAt.toISOString(),
    };
  });
}

export function buildCreditFinanceSummary(params: {
  salaryKobo: number;
  deductionPercent: number;
  account: CreditAccount | null;
  policy?: Pick<
    CreditPolicy,
    | 'interestAnnualRateBps'
    | 'interestGraceDays'
    | 'maxRepaymentMonths'
  > | null;
  payrollDayOfMonth?: number | null;
  ledgerEntries?: Array<Pick<LedgerEntry, 'entryType' | 'createdAt'>>;
}): AdminCreditFinanceSummary | null {
  const { account } = params;
  if (!account) {
    return null;
  }

  const monthlyDeductionKobo = monthlyDeductionFromSalary(
    params.salaryKobo,
    params.deductionPercent,
  );
  const outstandingKobo = computeTotalOwedKobo(account);
  const effectiveCreditLimitKobo =
    account.manualLimitOverrideKobo ?? account.creditLimitKobo;
  const committedKobo = outstandingKobo + account.reservedKobo;
  const utilizationPercent = computeUtilizationPercent(
    committedKobo,
    effectiveCreditLimitKobo,
  );

  const policy = params.policy;
  const maxMonths = policy?.maxRepaymentMonths ?? 24;
  const payrollDay = params.payrollDayOfMonth ?? 25;

  let estimatedPayoffMonths: number | null = null;
  let estimatedPayoffDate: string | null = null;
  let paysOffWithinMax = true;

  if (outstandingKobo <= 0) {
    estimatedPayoffMonths = 0;
    estimatedPayoffDate = null;
  } else if (monthlyDeductionKobo > 0) {
    // Simple revolving estimate (matches Pantri ops mental model): outstanding ÷ fixed monthly deduction.
    // Fractional months are meaningful (e.g. ₦450k / ₦100k = 4.5).
    const simpleMonths = outstandingKobo / monthlyDeductionKobo;
    estimatedPayoffMonths = Math.round(simpleMonths * 10) / 10;

    const sim = simulatePayoffMonths({
      principalOutstanding: account.principalOutstandingKobo,
      postedInterest: account.postedInterestKobo,
      postedFees: account.postedFeesKobo,
      postedPenalties: account.postedPenaltiesKobo,
      reservedToAdd: 0,
      monthlyDeductionKobo,
      annualRateBps: policy?.interestAnnualRateBps ?? 0,
      graceDaysRemaining: policy?.interestGraceDays ?? 0,
      maxMonths,
      payrollDayOfMonth: payrollDay,
      fromDate: new Date(),
    });
    paysOffWithinMax = sim.paysOffWithinMax;
    const last = sim.schedule[sim.schedule.length - 1];
    estimatedPayoffDate = last?.payrollDate ?? null;
  }

  const entries = params.ledgerEntries ?? [];
  const lastPurchase = entries.find((e) => PURCHASE_TYPES.includes(e.entryType));
  const lastRepayment = entries.find((e) =>
    REPAYMENT_TYPES.includes(e.entryType),
  );

  return {
    creditLimitKobo: account.creditLimitKobo,
    manualLimitOverrideKobo: account.manualLimitOverrideKobo,
    effectiveCreditLimitKobo,
    outstandingKobo,
    availableKobo: account.availableKobo,
    reservedKobo: account.reservedKobo,
    utilizationBps: utilizationPercent * 100,
    utilizationPercent,
    monthlyDeductionKobo,
    deductionPercent: params.deductionPercent,
    estimatedPayoffMonths,
    estimatedPayoffDate,
    paysOffWithinMax,
    accountStatus: account.status,
    lastPurchaseAt: lastPurchase?.createdAt.toISOString() ?? null,
    lastRepaymentAt: lastRepayment?.createdAt.toISOString() ?? null,
    principalOutstandingKobo: account.principalOutstandingKobo,
    postedInterestKobo: account.postedInterestKobo,
    postedFeesKobo: account.postedFeesKobo,
    postedPenaltiesKobo: account.postedPenaltiesKobo,
  };
}
