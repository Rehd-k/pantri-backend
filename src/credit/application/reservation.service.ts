import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  CreditAccount,
  CreditAccountStatus,
  CreditReservation,
  CreditReservationStatus,
  LedgerEntryType,
  ProductType,
} from '../../../generated/prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { computeAvailableKobo } from '../domain/money';
import { LedgerPostingService } from '../ledger/ledger-posting.service';

const ACTIVE_RESERVATION_STATUSES: CreditReservationStatus[] = [
  CreditReservationStatus.ACTIVE,
  CreditReservationStatus.PARTIALLY_CAPTURED,
];

export interface ReserveParams {
  creditAccountId: string;
  orderId: string;
  amountKobo: number;
  productType?: ProductType;
  ttlHours: number;
  createdByUserId?: string;
  idempotencyKey?: string;
}

export interface ReleaseParams {
  reservationId: string;
  /** Defaults to the full remaining (un-captured, un-released) amount. */
  amountKobo?: number;
  reason?: string;
  createdByUserId?: string;
  idempotencyKey?: string;
}

export interface CaptureParams {
  reservationId: string;
  /** Portion of the reservation being converted into a posted purchase. */
  purchaseKobo: number;
  deliveryFeeKobo?: number;
  serviceFeeKobo?: number;
  productType?: ProductType;
  createdByUserId?: string;
  idempotencyKey?: string;
}

export interface CaptureResult {
  reservation: CreditReservation;
  account: CreditAccount;
}

/**
 * Manages the lifecycle of a hold placed against a `CreditAccount` while an
 * order is being approved/fulfilled: reserve → capture (fully or partially)
 * and/or release, until the reservation is fully resolved or it expires.
 */
@Injectable()
export class ReservationService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly ledger: LedgerPostingService,
  ) {}

  async reserve(params: ReserveParams): Promise<CreditReservation> {
    if (params.amountKobo <= 0) {
      throw new BadRequestException('Reservation amount must be positive');
    }

    return this.prisma.$transaction(async (tx) => {
      const account = await tx.creditAccount.findUnique({
        where: { id: params.creditAccountId },
      });
      if (!account) {
        throw new NotFoundException('Credit account not found');
      }
      if (account.status !== CreditAccountStatus.ACTIVE) {
        throw new BadRequestException(
          `Credit account is ${account.status.toLowerCase()} and cannot draw new credit`,
        );
      }

      const effectiveLimitKobo =
        account.manualLimitOverrideKobo ?? account.creditLimitKobo;
      const availableKobo = computeAvailableKobo({
        creditLimitKobo: effectiveLimitKobo,
        principalOutstandingKobo: account.principalOutstandingKobo,
        postedInterestKobo: account.postedInterestKobo,
        postedFeesKobo: account.postedFeesKobo,
        postedPenaltiesKobo: account.postedPenaltiesKobo,
        reservedKobo: account.reservedKobo,
      });

      if (params.amountKobo > availableKobo) {
        throw new BadRequestException(
          `Requested amount exceeds available credit (₦${(availableKobo / 100).toFixed(2)} available)`,
        );
      }

      const expiresAt = new Date(Date.now() + params.ttlHours * 60 * 60 * 1000);

      const reservation = await tx.creditReservation.create({
        data: {
          creditAccountId: params.creditAccountId,
          orderId: params.orderId,
          amountKobo: params.amountKobo,
          status: CreditReservationStatus.ACTIVE,
          expiresAt,
        },
      });

      const { entry } = await this.ledger.post(tx, {
        creditAccountId: params.creditAccountId,
        entryType: LedgerEntryType.RESERVATION_CREATED,
        amountKobo: params.amountKobo,
        productType: params.productType,
        referenceType: 'CreditReservation',
        referenceId: reservation.id,
        idempotencyKey: params.idempotencyKey,
        createdByUserId: params.createdByUserId,
        expectedVersion: account.version,
        apply: (_account, e) => ({ reservedKobo: e.amountKobo }),
      });

      return tx.creditReservation.update({
        where: { id: reservation.id },
        data: { createdLedgerEntryId: entry.id },
      });
    });
  }

  async release(params: ReleaseParams): Promise<CreditReservation> {
    return this.prisma.$transaction(async (tx) => {
      const reservation = await tx.creditReservation.findUnique({
        where: { id: params.reservationId },
      });
      if (!reservation) {
        throw new NotFoundException('Reservation not found');
      }
      if (!ACTIVE_RESERVATION_STATUSES.includes(reservation.status)) {
        throw new BadRequestException(
          `Cannot release a reservation in status ${reservation.status}`,
        );
      }

      const remainingKobo =
        reservation.amountKobo -
        reservation.capturedKobo -
        reservation.releasedKobo;
      const releaseKobo = params.amountKobo ?? remainingKobo;

      if (releaseKobo <= 0 || releaseKobo > remainingKobo) {
        throw new BadRequestException(
          'Invalid release amount for this reservation',
        );
      }

      await this.ledger.post(tx, {
        creditAccountId: reservation.creditAccountId,
        entryType: LedgerEntryType.RESERVATION_RELEASED,
        amountKobo: -releaseKobo,
        referenceType: 'CreditReservation',
        referenceId: reservation.id,
        idempotencyKey: params.idempotencyKey,
        createdByUserId: params.createdByUserId,
        metadata: params.reason ? { reason: params.reason } : undefined,
        apply: (_account, e) => ({ reservedKobo: e.amountKobo }),
      });

      const releasedKobo = reservation.releasedKobo + releaseKobo;
      const status = resolveReservationStatus({
        totalKobo: reservation.amountKobo,
        capturedKobo: reservation.capturedKobo,
        releasedKobo,
      });

      return tx.creditReservation.update({
        where: { id: reservation.id },
        data: { releasedKobo, status },
      });
    });
  }

  /** Converts (all or part of) a reservation into a posted purchase, plus any delivery/service fees. */
  async capture(params: CaptureParams): Promise<CaptureResult> {
    if (params.purchaseKobo <= 0) {
      throw new BadRequestException('Capture amount must be positive');
    }

    return this.prisma.$transaction(async (tx) => {
      const reservation = await tx.creditReservation.findUnique({
        where: { id: params.reservationId },
      });
      if (!reservation) {
        throw new NotFoundException('Reservation not found');
      }
      if (!ACTIVE_RESERVATION_STATUSES.includes(reservation.status)) {
        throw new BadRequestException(
          `Cannot capture a reservation in status ${reservation.status}`,
        );
      }

      const remainingKobo =
        reservation.amountKobo -
        reservation.capturedKobo -
        reservation.releasedKobo;
      const captureKobo = Math.min(params.purchaseKobo, remainingKobo);
      if (captureKobo <= 0) {
        throw new BadRequestException(
          'Nothing left to capture on this reservation',
        );
      }

      const idKey = (suffix: string) =>
        params.idempotencyKey
          ? `${params.idempotencyKey}:${suffix}`
          : undefined;

      const { account: afterPurchase } = await this.ledger.post(tx, {
        creditAccountId: reservation.creditAccountId,
        entryType: LedgerEntryType.PURCHASE_POSTED,
        amountKobo: captureKobo,
        productType: params.productType,
        referenceType: 'CreditReservation',
        referenceId: reservation.id,
        idempotencyKey: idKey('purchase'),
        createdByUserId: params.createdByUserId,
        apply: (_account, e) => ({
          principalOutstandingKobo: e.amountKobo,
          reservedKobo: -e.amountKobo,
        }),
      });

      let account = afterPurchase;

      if (params.deliveryFeeKobo && params.deliveryFeeKobo > 0) {
        const result = await this.ledger.post(tx, {
          creditAccountId: reservation.creditAccountId,
          entryType: LedgerEntryType.DELIVERY_FEE,
          amountKobo: params.deliveryFeeKobo,
          referenceType: 'CreditReservation',
          referenceId: reservation.id,
          idempotencyKey: idKey('delivery-fee'),
          createdByUserId: params.createdByUserId,
          apply: (_account, e) => ({ postedFeesKobo: e.amountKobo }),
        });
        account = result.account;
      }

      if (params.serviceFeeKobo && params.serviceFeeKobo > 0) {
        const result = await this.ledger.post(tx, {
          creditAccountId: reservation.creditAccountId,
          entryType: LedgerEntryType.SERVICE_FEE,
          amountKobo: params.serviceFeeKobo,
          referenceType: 'CreditReservation',
          referenceId: reservation.id,
          idempotencyKey: idKey('service-fee'),
          createdByUserId: params.createdByUserId,
          apply: (_account, e) => ({ postedFeesKobo: e.amountKobo }),
        });
        account = result.account;
      }

      const capturedKobo = reservation.capturedKobo + captureKobo;
      const status = resolveReservationStatus({
        totalKobo: reservation.amountKobo,
        capturedKobo,
        releasedKobo: reservation.releasedKobo,
      });

      const updatedReservation = await tx.creditReservation.update({
        where: { id: reservation.id },
        data: { capturedKobo, status },
      });

      return { reservation: updatedReservation, account };
    });
  }

  /** Batch job: releases any ACTIVE/PARTIALLY_CAPTURED reservations past their `expiresAt`. */
  async expireReservations(
    now: Date = new Date(),
    batchSize = 200,
  ): Promise<{ expiredCount: number }> {
    const expired = await this.prisma.creditReservation.findMany({
      where: {
        status: { in: ACTIVE_RESERVATION_STATUSES },
        expiresAt: { lt: now },
      },
      take: batchSize,
    });

    let expiredCount = 0;

    for (const reservation of expired) {
      await this.prisma.$transaction(async (tx) => {
        const remainingKobo =
          reservation.amountKobo -
          reservation.capturedKobo -
          reservation.releasedKobo;

        if (remainingKobo <= 0) {
          await tx.creditReservation.update({
            where: { id: reservation.id },
            data: { status: CreditReservationStatus.EXPIRED },
          });
          return;
        }

        await this.ledger.post(tx, {
          creditAccountId: reservation.creditAccountId,
          entryType: LedgerEntryType.RESERVATION_RELEASED,
          amountKobo: -remainingKobo,
          referenceType: 'CreditReservation',
          referenceId: reservation.id,
          metadata: { reason: 'expired' },
          apply: (_account, e) => ({ reservedKobo: e.amountKobo }),
        });

        await tx.creditReservation.update({
          where: { id: reservation.id },
          data: {
            releasedKobo: reservation.releasedKobo + remainingKobo,
            status: CreditReservationStatus.EXPIRED,
          },
        });
      });

      expiredCount += 1;
    }

    return { expiredCount };
  }
}

function resolveReservationStatus(params: {
  totalKobo: number;
  capturedKobo: number;
  releasedKobo: number;
}): CreditReservationStatus {
  const remaining =
    params.totalKobo - params.capturedKobo - params.releasedKobo;

  if (remaining > 0) {
    return params.capturedKobo > 0
      ? CreditReservationStatus.PARTIALLY_CAPTURED
      : CreditReservationStatus.ACTIVE;
  }

  return params.capturedKobo > 0
    ? CreditReservationStatus.CAPTURED
    : CreditReservationStatus.RELEASED;
}
