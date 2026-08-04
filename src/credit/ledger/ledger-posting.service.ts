import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  CreditAccount,
  LedgerEntry,
  LedgerEntryType,
  Prisma,
  ProductType,
} from '../../../generated/prisma/client';
import { PrismaTx } from '../../prisma/prisma-tx.type';
import { computeAvailableKobo } from '../domain/money';

/**
 * Deltas an `apply` callback returns to describe how a ledger entry moves
 * the cached balance columns on `CreditAccount`. Only include the fields
 * that change; omitted fields are treated as zero.
 */
export interface LedgerBalanceDelta {
  principalOutstandingKobo?: number;
  postedInterestKobo?: number;
  postedFeesKobo?: number;
  postedPenaltiesKobo?: number;
  reservedKobo?: number;
  accruedInterestUnpostedKobo?: number;
}

export interface LedgerEntryInput {
  entryType: LedgerEntryType;
  amountKobo: number;
  productType: ProductType | null;
}

export type LedgerApplyFn = (
  account: CreditAccount,
  entry: LedgerEntryInput,
) => LedgerBalanceDelta;

export interface PostLedgerEntryParams {
  creditAccountId: string;
  entryType: LedgerEntryType;
  /** Convention: positive increases reserved/outstanding components, negative decreases them. */
  amountKobo: number;
  productType?: ProductType | null;
  referenceType?: string | null;
  referenceId?: string | null;
  idempotencyKey?: string | null;
  metadata?: Record<string, unknown>;
  createdByUserId?: string | null;
  /** Optimistic-lock guard: if provided, must match the account's current version or a ConflictException is thrown. */
  expectedVersion?: number;
  /** Determines exactly which cached balance columns this entry moves, and by how much. */
  apply: LedgerApplyFn;
}

export interface PostLedgerEntryResult {
  entry: LedgerEntry;
  account: CreditAccount;
  /** True if an existing entry was returned because `idempotencyKey` was already used. */
  idempotentReplay: boolean;
}

const BALANCE_FIELDS = [
  'principalOutstandingKobo',
  'postedInterestKobo',
  'postedFeesKobo',
  'postedPenaltiesKobo',
  'reservedKobo',
  'accruedInterestUnpostedKobo',
] as const;

/**
 * Sole writer of `LedgerEntry` rows and the cached balance columns on
 * `CreditAccount`. Every credit movement in the system (reservations,
 * captures, repayments, interest, fees, penalties, write-offs, manual
 * adjustments) MUST go through `post()` so the ledger stays the single
 * source of truth and the cached balances never drift from it.
 */
@Injectable()
export class LedgerPostingService {
  async post(
    tx: PrismaTx,
    params: PostLedgerEntryParams,
  ): Promise<PostLedgerEntryResult> {
    if (params.idempotencyKey) {
      const existingReplay = await this.tryReplay(
        tx,
        params.creditAccountId,
        params.idempotencyKey,
      );
      if (existingReplay) {
        return existingReplay;
      }
    }

    const account = await tx.creditAccount.findUnique({
      where: { id: params.creditAccountId },
    });
    if (!account) {
      throw new NotFoundException('Credit account not found');
    }

    if (
      params.expectedVersion !== undefined &&
      params.expectedVersion !== account.version
    ) {
      throw new ConflictException(
        'Credit account was modified concurrently, please retry',
      );
    }

    const delta = params.apply(account, {
      entryType: params.entryType,
      amountKobo: params.amountKobo,
      productType: params.productType ?? null,
    });

    const nextBalances = {
      principalOutstandingKobo:
        account.principalOutstandingKobo +
        (delta.principalOutstandingKobo ?? 0),
      postedInterestKobo:
        account.postedInterestKobo + (delta.postedInterestKobo ?? 0),
      postedFeesKobo: account.postedFeesKobo + (delta.postedFeesKobo ?? 0),
      postedPenaltiesKobo:
        account.postedPenaltiesKobo + (delta.postedPenaltiesKobo ?? 0),
      reservedKobo: account.reservedKobo + (delta.reservedKobo ?? 0),
      accruedInterestUnpostedKobo:
        account.accruedInterestUnpostedKobo +
        (delta.accruedInterestUnpostedKobo ?? 0),
    };

    for (const field of BALANCE_FIELDS) {
      if (nextBalances[field] < 0) {
        throw new ConflictException(
          `Ledger posting for entry type ${params.entryType} would drive "${field}" negative`,
        );
      }
    }

    const effectiveLimitKobo =
      account.manualLimitOverrideKobo ?? account.creditLimitKobo;
    const nextAvailableKobo = computeAvailableKobo({
      creditLimitKobo: effectiveLimitKobo,
      principalOutstandingKobo: nextBalances.principalOutstandingKobo,
      postedInterestKobo: nextBalances.postedInterestKobo,
      postedFeesKobo: nextBalances.postedFeesKobo,
      postedPenaltiesKobo: nextBalances.postedPenaltiesKobo,
      reservedKobo: nextBalances.reservedKobo,
    });

    const balanceAfterKobo =
      nextBalances.principalOutstandingKobo +
      nextBalances.postedInterestKobo +
      nextBalances.postedFeesKobo +
      nextBalances.postedPenaltiesKobo;

    const lastSequence = await tx.ledgerEntry.aggregate({
      where: { creditAccountId: params.creditAccountId },
      _max: { sequence: true },
    });
    const sequence = (lastSequence._max.sequence ?? 0) + 1;

    // Optimistic lock: only the transaction that still sees `account.version`
    // wins this update. A concurrent writer that changed the account first
    // will cause this to affect zero rows, so we bail out with a retryable
    // conflict instead of creating a ledger entry against stale balances.
    const updateResult = await tx.creditAccount.updateMany({
      where: { id: params.creditAccountId, version: account.version },
      data: {
        principalOutstandingKobo: nextBalances.principalOutstandingKobo,
        postedInterestKobo: nextBalances.postedInterestKobo,
        postedFeesKobo: nextBalances.postedFeesKobo,
        postedPenaltiesKobo: nextBalances.postedPenaltiesKobo,
        reservedKobo: nextBalances.reservedKobo,
        accruedInterestUnpostedKobo: nextBalances.accruedInterestUnpostedKobo,
        availableKobo: nextAvailableKobo,
        version: { increment: 1 },
      },
    });

    if (updateResult.count === 0) {
      throw new ConflictException(
        'Credit account was modified concurrently, please retry',
      );
    }

    let entry: LedgerEntry;
    try {
      entry = await tx.ledgerEntry.create({
        data: {
          creditAccountId: params.creditAccountId,
          sequence,
          entryType: params.entryType,
          amountKobo: params.amountKobo,
          balanceAfterKobo,
          reservedAfterKobo: nextBalances.reservedKobo,
          productType: params.productType ?? undefined,
          referenceType: params.referenceType ?? undefined,
          referenceId: params.referenceId ?? undefined,
          idempotencyKey: params.idempotencyKey ?? undefined,
          metadata: (params.metadata ?? {}) as Prisma.InputJsonValue,
          createdByUserId: params.createdByUserId ?? undefined,
        },
      });
    } catch (error) {
      // Unique violation on (creditAccountId, idempotencyKey): another
      // concurrent request with the same key won the race between our
      // replay-check and our insert. Treat it as a replay.
      if (isUniqueConstraintViolation(error) && params.idempotencyKey) {
        const replay = await this.tryReplay(
          tx,
          params.creditAccountId,
          params.idempotencyKey,
        );
        if (replay) {
          return replay;
        }
      }
      throw error;
    }

    const updatedAccount = await tx.creditAccount.findUniqueOrThrow({
      where: { id: params.creditAccountId },
    });

    return { entry, account: updatedAccount, idempotentReplay: false };
  }

  private async tryReplay(
    tx: PrismaTx,
    creditAccountId: string,
    idempotencyKey: string,
  ): Promise<PostLedgerEntryResult | null> {
    const existing = await tx.ledgerEntry.findUnique({
      where: {
        creditAccountId_idempotencyKey: { creditAccountId, idempotencyKey },
      },
    });
    if (!existing) {
      return null;
    }

    const account = await tx.creditAccount.findUniqueOrThrow({
      where: { id: creditAccountId },
    });
    return { entry: existing, account, idempotentReplay: true };
  }
}

function isUniqueConstraintViolation(error: unknown): boolean {
  return (
    error instanceof Prisma.PrismaClientKnownRequestError &&
    error.code === 'P2002'
  );
}
