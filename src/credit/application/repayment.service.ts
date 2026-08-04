import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  CreditAccount,
  LedgerEntryType,
} from '../../../generated/prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { PrismaTx } from '../../prisma/prisma-tx.type';
import {
  LedgerBalanceDelta,
  LedgerPostingService,
} from '../ledger/ledger-posting.service';

export interface PostRepaymentParams {
  creditAccountId: string;
  amountKobo: number;
  referenceType?: string;
  referenceId?: string;
  createdByUserId?: string;
  idempotencyKey?: string;
}

export interface RepaymentAllocation {
  interestKobo: number;
  feesKobo: number;
  penaltiesKobo: number;
  principalKobo: number;
  /** Any amount left over after every owed bucket has been zeroed out. */
  overpaymentKobo: number;
}

export interface PostRepaymentResult {
  account: CreditAccount;
  allocation: RepaymentAllocation;
}

interface WaterfallStepResult {
  account: CreditAccount;
  applied: number;
  remaining: number;
}

/**
 * Applies an incoming repayment (typically a payroll deduction) to a credit
 * account using the standard collections waterfall:
 *
 *   1. any unposted daily-accrued interest is posted first (so it competes
 *      for the payment like everything else),
 *   2. posted interest,
 *   3. posted fees,
 *   4. posted penalties,
 *   5. principal.
 *
 * Any amount left over after principal is fully repaid is reported back as
 * `overpaymentKobo` (callers may choose to refund it or hold it as credit).
 */
@Injectable()
export class RepaymentService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly ledger: LedgerPostingService,
  ) {}

  async postRepayment(
    params: PostRepaymentParams,
  ): Promise<PostRepaymentResult> {
    if (params.amountKobo <= 0) {
      throw new BadRequestException('Repayment amount must be positive');
    }

    return this.prisma.$transaction(async (tx) => {
      let account = await tx.creditAccount.findUnique({
        where: { id: params.creditAccountId },
      });
      if (!account) {
        throw new NotFoundException('Credit account not found');
      }

      // Fold any not-yet-posted daily interest accrual into postedInterestKobo
      // first, so the waterfall below (including this repayment) accounts
      // for the full amount actually owed, not just what was posted at the
      // last monthly cycle.
      if (account.accruedInterestUnpostedKobo > 0) {
        const accrualToPost = account.accruedInterestUnpostedKobo;
        const { account: afterAccrualPost } = await this.ledger.post(tx, {
          creditAccountId: params.creditAccountId,
          entryType: LedgerEntryType.INTEREST,
          amountKobo: accrualToPost,
          referenceType: 'InterestAccrual',
          idempotencyKey: params.idempotencyKey
            ? `${params.idempotencyKey}:accrual-post`
            : undefined,
          createdByUserId: params.createdByUserId,
          apply: (_a, e) => ({
            postedInterestKobo: e.amountKobo,
            accruedInterestUnpostedKobo: -e.amountKobo,
          }),
        });
        account = afterAccrualPost;
      }

      let remaining = params.amountKobo;
      const allocation: RepaymentAllocation = {
        interestKobo: 0,
        feesKobo: 0,
        penaltiesKobo: 0,
        principalKobo: 0,
        overpaymentKobo: 0,
      };

      const idKey = (suffix: string) =>
        params.idempotencyKey
          ? `${params.idempotencyKey}:${suffix}`
          : undefined;

      let step: WaterfallStepResult;

      step = await this.applyWaterfallStep(
        tx,
        account,
        remaining,
        account.postedInterestKobo,
        {
          entryType: LedgerEntryType.PAYROLL_REPAYMENT,
          applyDelta: (amt) => ({ postedInterestKobo: amt }),
          referenceType: params.referenceType,
          referenceId: params.referenceId,
          createdByUserId: params.createdByUserId,
          idempotencyKey: idKey('interest'),
        },
      );
      account = step.account;
      allocation.interestKobo = step.applied;
      remaining = step.remaining;

      step = await this.applyWaterfallStep(
        tx,
        account,
        remaining,
        account.postedFeesKobo,
        {
          entryType: LedgerEntryType.PAYROLL_REPAYMENT,
          applyDelta: (amt) => ({ postedFeesKobo: amt }),
          referenceType: params.referenceType,
          referenceId: params.referenceId,
          createdByUserId: params.createdByUserId,
          idempotencyKey: idKey('fees'),
        },
      );
      account = step.account;
      allocation.feesKobo = step.applied;
      remaining = step.remaining;

      step = await this.applyWaterfallStep(
        tx,
        account,
        remaining,
        account.postedPenaltiesKobo,
        {
          entryType: LedgerEntryType.PAYROLL_REPAYMENT,
          applyDelta: (amt) => ({ postedPenaltiesKobo: amt }),
          referenceType: params.referenceType,
          referenceId: params.referenceId,
          createdByUserId: params.createdByUserId,
          idempotencyKey: idKey('penalties'),
        },
      );
      account = step.account;
      allocation.penaltiesKobo = step.applied;
      remaining = step.remaining;

      step = await this.applyWaterfallStep(
        tx,
        account,
        remaining,
        account.principalOutstandingKobo,
        {
          entryType: LedgerEntryType.PAYROLL_REPAYMENT,
          applyDelta: (amt) => ({ principalOutstandingKobo: amt }),
          referenceType: params.referenceType,
          referenceId: params.referenceId,
          createdByUserId: params.createdByUserId,
          idempotencyKey: idKey('principal'),
        },
      );
      account = step.account;
      allocation.principalKobo = step.applied;
      remaining = step.remaining;

      allocation.overpaymentKobo = remaining;

      return { account, allocation };
    });
  }

  private async applyWaterfallStep(
    tx: PrismaTx,
    account: CreditAccount,
    remaining: number,
    availableInBucket: number,
    options: {
      entryType: LedgerEntryType;
      applyDelta: (negativeAmountKobo: number) => LedgerBalanceDelta;
      referenceType?: string;
      referenceId?: string;
      createdByUserId?: string;
      idempotencyKey?: string;
    },
  ): Promise<WaterfallStepResult> {
    const applied = Math.min(remaining, Math.max(0, availableInBucket));
    if (applied <= 0) {
      return { account, applied: 0, remaining };
    }

    const { account: nextAccount } = await this.ledger.post(tx, {
      creditAccountId: account.id,
      entryType: options.entryType,
      amountKobo: -applied,
      referenceType: options.referenceType,
      referenceId: options.referenceId,
      createdByUserId: options.createdByUserId,
      idempotencyKey: options.idempotencyKey,
      apply: () => options.applyDelta(-applied),
    });

    return { account: nextAccount, applied, remaining: remaining - applied };
  }
}
