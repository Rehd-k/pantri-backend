import { Injectable, NotFoundException } from '@nestjs/common';
import {
  CreditAccount,
  CreditAccountStatus,
  LedgerEntryType,
} from '../../../generated/prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { dailyInterestKobo } from '../domain/money';
import { LedgerPostingService } from '../ledger/ledger-posting.service';

const DEFAULT_ANNUAL_RATE_BPS = 1_800;
const DEFAULT_GRACE_DAYS = 30;
const MS_PER_DAY = 24 * 60 * 60 * 1000;

export interface AccrueDailyResult {
  accrualDate: string;
  accountsProcessed: number;
  accountsSkippedInGrace: number;
  totalAccruedKobo: number;
}

export interface PostMonthlyInterestParams {
  createdByUserId?: string;
  idempotencyKey?: string;
}

export interface PostMonthlyInterestResult {
  account: CreditAccount;
  postedKobo: number;
}

/**
 * Runs the two-phase interest cycle for revolving balances:
 *
 *  - `accrueDaily` runs once per calendar day and records (but does not
 *    post) interest into `CreditAccount.accruedInterestUnpostedKobo` and an
 *    `InterestAccrualDay` audit row, skipping accounts still inside their
 *    grace period.
 *  - `postMonthlyInterest` converts the accumulated unposted accrual into a
 *    real `LedgerEntry` (bucket: postedInterestKobo), typically run right
 *    before a payroll cycle so it is captured by that month's deduction.
 */
@Injectable()
export class InterestService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly ledger: LedgerPostingService,
  ) {}

  async accrueDaily(forDate: Date = new Date()): Promise<AccrueDailyResult> {
    const accrualDate = startOfUtcDay(forDate);

    const accounts = await this.prisma.creditAccount.findMany({
      where: {
        status: CreditAccountStatus.ACTIVE,
        principalOutstandingKobo: { gt: 0 },
      },
      include: {
        employee: {
          include: { employer: { include: { creditPolicy: true } } },
        },
      },
    });

    let accountsProcessed = 0;
    let accountsSkippedInGrace = 0;
    let totalAccruedKobo = 0;

    for (const account of accounts) {
      const alreadyAccrued = await this.prisma.interestAccrualDay.findUnique({
        where: {
          creditAccountId_accrualDate: {
            creditAccountId: account.id,
            accrualDate,
          },
        },
      });
      if (alreadyAccrued) {
        continue;
      }

      const policy = account.employee.employer.creditPolicy;
      const annualRateBps =
        policy?.interestAnnualRateBps ?? DEFAULT_ANNUAL_RATE_BPS;
      const graceDays = policy?.interestGraceDays ?? DEFAULT_GRACE_DAYS;

      const firstDraw = await this.prisma.ledgerEntry.findFirst({
        where: {
          creditAccountId: account.id,
          entryType: LedgerEntryType.PURCHASE_POSTED,
        },
        orderBy: { sequence: 'asc' },
      });

      // No purchase yet: nothing has started accruing, so the account is
      // (trivially) still within grace  record a zero accrual for the day
      // so `accrueDaily` remains idempotent per calendar day.
      const graceEndsAt = firstDraw
        ? addDays(startOfUtcDay(firstDraw.createdAt), graceDays)
        : addDays(accrualDate, graceDays);

      const inGrace = accrualDate < graceEndsAt;
      const outstandingBaseKobo = account.principalOutstandingKobo;
      const accrualKobo = inGrace
        ? 0
        : dailyInterestKobo(outstandingBaseKobo, annualRateBps);

      await this.prisma.$transaction(async (tx) => {
        await tx.interestAccrualDay.create({
          data: {
            creditAccountId: account.id,
            accrualDate,
            outstandingBaseKobo,
            accrualKobo,
            posted: false,
          },
        });

        if (accrualKobo > 0) {
          await tx.creditAccount.update({
            where: { id: account.id },
            data: { accruedInterestUnpostedKobo: { increment: accrualKobo } },
          });
        }
      });

      accountsProcessed += 1;
      totalAccruedKobo += accrualKobo;
      if (inGrace) {
        accountsSkippedInGrace += 1;
      }
    }

    return {
      accrualDate: accrualDate.toISOString().slice(0, 10),
      accountsProcessed,
      accountsSkippedInGrace,
      totalAccruedKobo,
    };
  }

  /**
   * Posts a single account's accumulated unposted interest accrual to the
   * ledger. Returns `null` if there is nothing to post (idempotent no-op).
   */
  async postMonthlyInterest(
    creditAccountId: string,
    params: PostMonthlyInterestParams = {},
  ): Promise<PostMonthlyInterestResult | null> {
    return this.prisma.$transaction(async (tx) => {
      const account = await tx.creditAccount.findUnique({
        where: { id: creditAccountId },
      });
      if (!account) {
        throw new NotFoundException('Credit account not found');
      }
      if (account.accruedInterestUnpostedKobo <= 0) {
        return null;
      }

      const postedKobo = account.accruedInterestUnpostedKobo;

      const { account: updatedAccount } = await this.ledger.post(tx, {
        creditAccountId,
        entryType: LedgerEntryType.INTEREST,
        amountKobo: postedKobo,
        referenceType: 'MonthlyInterestPosting',
        idempotencyKey: params.idempotencyKey,
        createdByUserId: params.createdByUserId,
        apply: (_a, e) => ({
          postedInterestKobo: e.amountKobo,
          accruedInterestUnpostedKobo: -e.amountKobo,
        }),
      });

      await tx.interestAccrualDay.updateMany({
        where: { creditAccountId, posted: false },
        data: { posted: true },
      });

      return { account: updatedAccount, postedKobo };
    });
  }

  /** Convenience batch runner used ahead of a payroll cycle. */
  async postMonthlyInterestForAllActiveAccounts(): Promise<{
    accountsPosted: number;
    totalPostedKobo: number;
  }> {
    const accounts = await this.prisma.creditAccount.findMany({
      where: {
        status: CreditAccountStatus.ACTIVE,
        accruedInterestUnpostedKobo: { gt: 0 },
      },
      select: { id: true },
    });

    let accountsPosted = 0;
    let totalPostedKobo = 0;

    for (const account of accounts) {
      const result = await this.postMonthlyInterest(account.id, {
        idempotencyKey: `monthly-interest:${account.id}:${startOfUtcDay(new Date()).toISOString().slice(0, 10)}`,
      });
      if (result) {
        accountsPosted += 1;
        totalPostedKobo += result.postedKobo;
      }
    }

    return { accountsPosted, totalPostedKobo };
  }
}

function startOfUtcDay(date: Date): Date {
  return new Date(
    Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()),
  );
}

function addDays(date: Date, days: number): Date {
  return new Date(date.getTime() + days * MS_PER_DAY);
}
