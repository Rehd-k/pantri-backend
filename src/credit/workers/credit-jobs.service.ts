import { Injectable, Logger } from '@nestjs/common';
import {
  CreditReservationStatus,
  OrderCreditStatus,
  OrderFulfillmentStatus,
} from '../../../generated/prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { ReservationService } from '../application/reservation.service';
import { InterestService } from '../interest/interest.service';

/** Fulfillment statuses that still have credit "in flight" and can be expired. */
const STALE_FULFILLMENT_STATUSES: OrderFulfillmentStatus[] = [
  OrderFulfillmentStatus.DRAFT,
  OrderFulfillmentStatus.PENDING_APPROVAL,
  OrderFulfillmentStatus.APPROVED,
  OrderFulfillmentStatus.PROCESSING,
  OrderFulfillmentStatus.READY_FOR_PICKUP,
  OrderFulfillmentStatus.OUT_FOR_DELIVERY,
];

const RELEASABLE_RESERVATION_STATUSES: CreditReservationStatus[] = [
  CreditReservationStatus.ACTIVE,
  CreditReservationStatus.PARTIALLY_CAPTURED,
];

/**
 * Batch jobs backing the credit engine's time-based state transitions:
 * reservation/approval expiry (M3) and the daily/monthly interest cycle
 * (M6). Every method here is idempotent and safe to re-run on every tick —
 * see `CreditSchedulerService` for how these are actually invoked.
 */
@Injectable()
export class CreditJobsService {
  private readonly logger = new Logger(CreditJobsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly reservationService: ReservationService,
    private readonly interestService: InterestService,
  ) {}

  /**
   * Releases any ACTIVE/PARTIALLY_CAPTURED reservations past their
   * `expiresAt`, then marks the still-in-flight orders they backed as
   * EXPIRED.
   */
  async expireReservations(
    now: Date = new Date(),
  ): Promise<{ expiredReservations: number; expiredOrders: number }> {
    const { expiredCount } =
      await this.reservationService.expireReservations(now);

    const result = await this.prisma.order.updateMany({
      where: {
        fulfillmentStatus: { in: STALE_FULFILLMENT_STATUSES },
        reservation: { status: CreditReservationStatus.EXPIRED },
      },
      data: {
        fulfillmentStatus: OrderFulfillmentStatus.EXPIRED,
        creditStatus: OrderCreditStatus.RELEASED,
      },
    });

    if (expiredCount > 0 || result.count > 0) {
      this.logger.log(
        `Expired ${expiredCount} reservation(s); marked ${result.count} order(s) EXPIRED`,
      );
    }

    return { expiredReservations: expiredCount, expiredOrders: result.count };
  }

  /** Auto-rejects PENDING_APPROVAL orders whose `approvalExpiresAt` has passed, releasing their reservation. */
  async expireApprovals(
    now: Date = new Date(),
  ): Promise<{ expiredCount: number }> {
    const expiring = await this.prisma.order.findMany({
      where: {
        fulfillmentStatus: OrderFulfillmentStatus.PENDING_APPROVAL,
        approvalExpiresAt: { lt: now },
      },
      include: { reservation: true },
      take: 200,
    });

    let expiredCount = 0;

    for (const order of expiring) {
      try {
        if (
          order.reservation &&
          RELEASABLE_RESERVATION_STATUSES.includes(order.reservation.status)
        ) {
          await this.reservationService.release({
            reservationId: order.reservation.id,
            reason: 'Approval window expired',
            idempotencyKey: `approval-expiry:${order.id}`,
          });
        }

        await this.prisma.order.update({
          where: { id: order.id },
          data: {
            fulfillmentStatus: OrderFulfillmentStatus.CANCELLED,
            creditStatus: OrderCreditStatus.RELEASED,
          },
        });
        expiredCount += 1;
      } catch (error) {
        this.logger.error(
          `Failed to auto-expire approval for order ${order.id}`,
          error as Error,
        );
      }
    }

    if (expiredCount > 0) {
      this.logger.log(`Auto-rejected ${expiredCount} expired approval(s)`);
    }

    return { expiredCount };
  }

  /** Runs the once-per-day interest accrual across all active revolving accounts. */
  async accrueDailyInterest() {
    return this.interestService.accrueDaily();
  }

  /** Posts every account's accumulated unposted interest accrual to the ledger (also run ahead of each payroll cycle). */
  async postMonthlyInterest() {
    return this.interestService.postMonthlyInterestForAllActiveAccounts();
  }
}
