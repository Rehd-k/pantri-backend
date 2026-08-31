import 'dotenv/config';
import { PrismaPg } from '@prisma/adapter-pg';
import {
  DeductionStatus,
  LedgerEntryType,
  PrismaClient,
} from '../../generated/prisma/client';

/**
 * M11  one-time (idempotent) migration from the legacy per-order
 * `PayrollDeductionPlan`/`PayrollDeductionInstallment` installment model to
 * the revolving `CreditAccount` ledger.
 *
 * The bulk of the opening-balance sync (summing each employee's still
 * SCHEDULED installments into `CreditAccount.principalOutstandingKobo`,
 * plus an opening `MIGRATION` ledger entry) already ran as part of the
 * `20260802180000_credit_engine` SQL migration. This script exists as a
 * safe, idempotent re-run/backfill for:
 *
 *   - environments where that SQL migration ran before any of this logic
 *     existed and never got backfilled,
 *   - any legacy plan/installment rows created (or left SCHEDULED) after
 *     the credit-engine cutover.
 *
 * It performs two idempotent steps:
 *
 *   1. Re-syncs any `CreditAccount` whose cached balance doesn't yet
 *      reflect its employee's outstanding SCHEDULED installment total,
 *      posting the delta as a `MIGRATION` ledger entry (skipped per
 *      account once posted, via a stable idempotency key).
 *   2. Marks every remaining ACTIVE `PayrollDeductionPlan` as SUSPENDED,
 *      since no new installment plans should be created or collected
 *      against after the revolving-credit cutover.
 *
 * Run with: `npx tsx prisma/scripts/migrate-installments-to-credit.ts`
 */
async function main(): Promise<void> {
  const connectionString = process.env.DIRECT_URL ?? process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error('DIRECT_URL or DATABASE_URL must be set');
  }

  const adapter = new PrismaPg({ connectionString });
  const prisma = new PrismaClient({ adapter });

  console.log('--- M11: installment -> revolving-credit migration ---');

  const accounts = await prisma.creditAccount.findMany({
    include: {
      employee: {
        include: {
          orders: {
            include: {
              deductionPlan: { include: { installments: true } },
            },
          },
        },
      },
    },
  });

  let resynced = 0;

  for (const account of accounts) {
    const outstandingFromPlansKobo = account.employee.orders.reduce(
      (sum, order) => {
        if (!order.deductionPlan) return sum;
        const scheduledKobo = order.deductionPlan.installments
          .filter((installment) => installment.status === 'SCHEDULED')
          .reduce((s, installment) => s + installment.amountKobo, 0);
        return sum + scheduledKobo;
      },
      0,
    );

    if (outstandingFromPlansKobo <= 0) {
      continue;
    }

    const idempotencyKey = `migration-opening-${account.id}`;
    const existingEntry = await prisma.ledgerEntry.findUnique({
      where: {
        creditAccountId_idempotencyKey: {
          creditAccountId: account.id,
          idempotencyKey,
        },
      },
    });
    if (existingEntry) {
      continue; // Already synced by the SQL migration or a prior run of this script.
    }

    await prisma.$transaction(async (tx) => {
      const lastSequence = await tx.ledgerEntry.aggregate({
        where: { creditAccountId: account.id },
        _max: { sequence: true },
      });
      const sequence = (lastSequence._max.sequence ?? 0) + 1;

      const balanceAfterKobo =
        account.principalOutstandingKobo +
        account.postedInterestKobo +
        account.postedFeesKobo +
        account.postedPenaltiesKobo +
        outstandingFromPlansKobo;

      await tx.ledgerEntry.create({
        data: {
          creditAccountId: account.id,
          sequence,
          entryType: LedgerEntryType.MIGRATION,
          amountKobo: outstandingFromPlansKobo,
          balanceAfterKobo,
          reservedAfterKobo: account.reservedKobo,
          idempotencyKey,
          metadata: { source: 'installment_migration_backfill' },
        },
      });

      await tx.creditAccount.update({
        where: { id: account.id },
        data: {
          principalOutstandingKobo: { increment: outstandingFromPlansKobo },
          availableKobo: {
            decrement: Math.min(account.availableKobo, outstandingFromPlansKobo),
          },
          version: { increment: 1 },
        },
      });
    });

    resynced += 1;
  }

  console.log(`Backfilled opening balance for ${resynced} credit account(s)`);

  const suspended = await prisma.payrollDeductionPlan.updateMany({
    where: { status: DeductionStatus.ACTIVE },
    data: { status: DeductionStatus.SUSPENDED },
  });
  console.log(
    `Suspended ${suspended.count} legacy ACTIVE PayrollDeductionPlan row(s)`,
  );

  await prisma.$disconnect();
  console.log('--- Migration complete ---');
}

main().catch(async (error) => {
  console.error(error);
  process.exit(1);
});
