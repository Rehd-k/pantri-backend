import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  CreditAccount,
  CreditPolicy,
  CreditReservationStatus,
  Employee,
  Employer,
  LedgerEntryType,
  OrderCreditStatus,
  OrderFulfillmentStatus,
  OverDurationAction,
  OverLimitAction,
  Prisma,
} from '../../generated/prisma/client';
import { EmployeePickupPointDto } from '../companies/dto/pickup-point-response.dto';
import { haversineKm } from '../companies/geo.util';
import { CreditAccountService } from '../credit/application/credit-account.service';
import { ReservationService } from '../credit/application/reservation.service';
import {
  computeAvailableKobo,
  computeTotalOwedKobo,
} from '../credit/domain/money';
import { simulatePayoffMonths } from '../credit/domain/payoff-simulator';
import { LedgerPostingService } from '../credit/ledger/ledger-posting.service';
import { DeliverySettingsService } from '../delivery-settings/delivery-settings.service';
import { PrismaService } from '../prisma/prisma.service';
import { RiskEngineService } from '../risk/risk-engine.service';
import { CheckoutDto } from './dto/checkout.dto';
import { CheckoutResponseDto } from './dto/checkout-response.dto';
import {
  CreditSummaryDto,
  EmployeeDashboardDto,
  NextDeductionDto,
} from './dto/employee-dashboard.dto';
import { EmployeeLocationDto } from './dto/employee-location.dto';
import { UpdateEmployeeLocationDto } from './dto/update-employee-location.dto';

/** Fully-loaded order shape returned by the employer/logistics lifecycle operations below. */
export type OrderWithRelations = Prisma.OrderGetPayload<{
  include: { items: true; pickupPoint: true; reservation: true };
}>;

export interface FulfillOrderItemInput {
  orderItemId: string;
  fulfilledQuantity: number;
}

const ORDER_RELATIONS_INCLUDE = {
  items: true,
  pickupPoint: true,
  reservation: true,
} satisfies Prisma.OrderInclude;

const RELEASABLE_RESERVATION_STATUSES: CreditReservationStatus[] = [
  CreditReservationStatus.ACTIVE,
  CreditReservationStatus.PARTIALLY_CAPTURED,
];

/** Order fulfillment statuses that count towards purchase-frequency abuse rules (excludes DRAFT/CANCELLED). */
const COUNTED_FULFILLMENT_STATUSES: OrderFulfillmentStatus[] = [
  OrderFulfillmentStatus.PENDING_APPROVAL,
  OrderFulfillmentStatus.APPROVED,
  OrderFulfillmentStatus.PROCESSING,
  OrderFulfillmentStatus.READY_FOR_PICKUP,
  OrderFulfillmentStatus.OUT_FOR_DELIVERY,
  OrderFulfillmentStatus.FULFILLED,
  OrderFulfillmentStatus.EXPIRED,
];

interface ResolvedCreditPolicy {
  maxRepaymentMonths: number;
  reservationTtlHours: number;
  approvalTtlHours: number;
  interestAnnualRateBps: number;
  interestGraceDays: number;
  minDaysBetweenPurchases: number;
  maxPurchasesInWindow: number;
  purchaseWindowDays: number;
  requirePriorDeductionAfterFirst: boolean;
  overLimitAction: OverLimitAction;
  overDurationAction: OverDurationAction;
  approvalThresholdKobo: number | null;
  requireApprovalFirstPurchase: boolean;
  requireApprovalHighRisk: boolean;
  highRiskScoreThreshold: number;
}

interface EmployeeContext {
  employee: Employee;
  employer: Employer;
  account: CreditAccount;
}

@Injectable()
export class OrderService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly deliverySettings: DeliverySettingsService,
    private readonly creditAccountService: CreditAccountService,
    private readonly reservationService: ReservationService,
    private readonly riskEngine: RiskEngineService,
    private readonly ledger: LedgerPostingService,
  ) {}

  async getEmployeeDashboard(userId: string): Promise<EmployeeDashboardDto> {
    const { employee, employer, account } =
      await this.requireEmployeeContext(userId);

    const effectiveLimitKobo =
      account.manualLimitOverrideKobo ?? account.creditLimitKobo;
    const credit: CreditSummaryDto = {
      creditLimitKobo: effectiveLimitKobo,
      outstandingKobo: computeTotalOwedKobo(account),
      availableKobo: account.availableKobo,
      reservedKobo: account.reservedKobo,
    };

    const nextDeduction = this.estimateNextDeduction(
      employee,
      employer,
      account,
    );

    return { credit, nextDeduction };
  }

  async getLocation(userId: string): Promise<EmployeeLocationDto> {
    const { employee } = await this.requireEmployeeContext(userId);
    return this.toLocationDto(employee);
  }

  async updateLocation(
    userId: string,
    dto: UpdateEmployeeLocationDto,
  ): Promise<EmployeeLocationDto> {
    const { employee } = await this.requireEmployeeContext(userId);
    const updated = await this.prisma.employee.update({
      where: { id: employee.id },
      data: {
        addressLine: dto.addressLine,
        city: dto.city,
        state: dto.state ?? null,
        latitude: dto.latitude,
        longitude: dto.longitude,
      },
    });
    return this.toLocationDto(updated);
  }

  async listPickupPoints(userId: string): Promise<EmployeePickupPointDto[]> {
    const { employee } = await this.requireEmployeeContext(userId);
    const location = this.toLocationDto(employee);
    if (!location.isSet) {
      throw new BadRequestException({
        message: 'Set your location before viewing pickup points',
        code: 'LOCATION_REQUIRED',
      });
    }

    const points = await this.prisma.employerPickupPoint.findMany({
      where: { employerId: employee.employerId, isActive: true },
      orderBy: { label: 'asc' },
    });

    const withDistance = points.map((p) => ({
      id: p.id,
      employerId: p.employerId,
      companyId: p.employerId,
      label: p.label,
      addressLine: p.addressLine,
      city: p.city,
      state: p.state,
      latitude: p.latitude,
      longitude: p.longitude,
      isActive: p.isActive,
      updatedAt: p.updatedAt.toISOString(),
      distanceKm: haversineKm(
        location.latitude!,
        location.longitude!,
        p.latitude,
        p.longitude,
      ),
    }));

    withDistance.sort((a, b) => a.distanceKm - b.distanceKm);
    return withDistance;
  }

  async checkout(
    userId: string,
    dto: CheckoutDto,
  ): Promise<CheckoutResponseDto> {
    const { employee, employer, account } =
      await this.requireEmployeeContext(userId);
    const location = this.toLocationDto(employee);
    if (!location.isSet) {
      throw new BadRequestException({
        message: 'Set your location before checkout',
        code: 'LOCATION_REQUIRED',
      });
    }

    const pickupPoint = await this.prisma.employerPickupPoint.findFirst({
      where: {
        id: dto.pickupPointId,
        employerId: employee.employerId,
        isActive: true,
      },
    });
    if (!pickupPoint) {
      throw new BadRequestException('Invalid or inactive pickup point');
    }

    const cart = await this.prisma.cart.findUnique({
      where: { userId },
      include: {
        items: {
          include: {
            product: {
              select: {
                id: true,
                name: true,
                isActive: true,
                priceKobo: true,
              },
            },
          },
        },
      },
    });

    if (!cart || cart.items.length === 0) {
      throw new BadRequestException('Cart is empty');
    }

    const lineItems = cart.items.map((item) => {
      if (!item.product.isActive) {
        throw new BadRequestException(
          `Product "${item.product.name}" is no longer available`,
        );
      }
      const unitPriceKobo = item.product.priceKobo;
      return {
        productId: item.product.id,
        name: item.product.name,
        quantity: item.quantity,
        unitPriceKobo,
        lineTotalKobo: unitPriceKobo * item.quantity,
      };
    });

    const subtotalKobo = lineItems.reduce((s, i) => s + i.lineTotalKobo, 0);
    const settings = await this.deliverySettings.ensureDefaults();
    const qualifiesForFreeDelivery =
      subtotalKobo >= settings.freeDeliveryMinKobo;
    const deliveryFeeKobo = qualifiesForFreeDelivery
      ? 0
      : settings.deliveryFeeKobo;
    const serviceFeeKobo = 0;
    const totalKobo = subtotalKobo + deliveryFeeKobo + serviceFeeKobo;

    const policy = this.resolvePolicy(
      await this.getEmployerPolicy(employer.id),
    );
    const { needsApproval } = await this.runCreditChecks({
      employee,
      employer,
      account,
      policy,
      totalKobo,
    });

    const draft = await this.prisma.order.create({
      data: {
        employeeId: employee.id,
        employerId: employer.id,
        pickupPointId: pickupPoint.id,
        subtotalKobo,
        deliveryFeeKobo,
        serviceFeeKobo,
        totalKobo,
        fulfillmentStatus: OrderFulfillmentStatus.DRAFT,
        creditStatus: OrderCreditStatus.NONE,
        items: {
          create: lineItems.map((i) => ({
            productId: i.productId,
            name: i.name,
            quantity: i.quantity,
            unitPriceKobo: i.unitPriceKobo,
            lineTotalKobo: i.lineTotalKobo,
          })),
        },
      },
      include: { items: true, pickupPoint: true },
    });

    try {
      await this.reservationService.reserve({
        creditAccountId: account.id,
        orderId: draft.id,
        amountKobo: totalKobo,
        ttlHours: policy.reservationTtlHours,
        createdByUserId: userId,
        idempotencyKey: `checkout:${draft.id}`,
      });
    } catch (error) {
      await this.prisma.order.update({
        where: { id: draft.id },
        data: { fulfillmentStatus: OrderFulfillmentStatus.CANCELLED },
      });
      throw error;
    }

    const fulfillmentStatus = needsApproval
      ? OrderFulfillmentStatus.PENDING_APPROVAL
      : OrderFulfillmentStatus.APPROVED;
    const approvalExpiresAt = needsApproval
      ? new Date(Date.now() + policy.approvalTtlHours * 60 * 60 * 1000)
      : null;

    const order = await this.prisma.order.update({
      where: { id: draft.id },
      data: {
        creditStatus: OrderCreditStatus.RESERVED,
        fulfillmentStatus,
        approvalExpiresAt,
      },
      include: { items: true, pickupPoint: true },
    });

    await this.prisma.cartItem.deleteMany({ where: { cartId: cart.id } });

    return {
      id: order.id,
      fulfillmentStatus: order.fulfillmentStatus,
      creditStatus: order.creditStatus,
      subtotalKobo: order.subtotalKobo,
      deliveryFeeKobo: order.deliveryFeeKobo,
      serviceFeeKobo: order.serviceFeeKobo,
      totalKobo: order.totalKobo,
      reservedKobo: order.totalKobo,
      pickupPointId: order.pickupPointId,
      pickupPointLabel: order.pickupPoint.label,
      items: order.items.map((i) => ({
        productId: i.productId,
        name: i.name,
        quantity: i.quantity,
        unitPriceKobo: i.unitPriceKobo,
        lineTotalKobo: i.lineTotalKobo,
      })),
      createdAt: order.createdAt.toISOString(),
    };
  }

  // ─── Employer/logistics order lifecycle (M5) ────────────────────

  /** Lists orders for an employer's review queue (or platform-wide for ADMIN when `employerId` is omitted), optionally filtered by status. */
  async listOrders(
    employerId?: string,
    status?: OrderFulfillmentStatus,
  ): Promise<OrderWithRelations[]> {
    return this.prisma.order.findMany({
      where: {
        ...(employerId ? { employerId } : {}),
        ...(status ? { fulfillmentStatus: status } : {}),
      },
      include: ORDER_RELATIONS_INCLUDE,
      orderBy: { createdAt: 'desc' },
    });
  }

  /** Approves a PENDING_APPROVAL order, optionally at a reduced amount (releasing the difference back to available credit). */
  async approveOrder(
    orderId: string,
    actorUserId?: string,
    reducedAmountKobo?: number,
    employerId?: string,
  ): Promise<OrderWithRelations> {
    const order = await this.findOrderOrThrow(orderId, employerId);
    if (order.fulfillmentStatus !== OrderFulfillmentStatus.PENDING_APPROVAL) {
      throw new BadRequestException(
        `Order cannot be approved from status ${order.fulfillmentStatus}`,
      );
    }

    let approvedAmountKobo = order.totalKobo;
    if (reducedAmountKobo != null) {
      if (reducedAmountKobo <= 0 || reducedAmountKobo > order.totalKobo) {
        throw new BadRequestException(
          'Reduced amount must be greater than zero and no more than the order total',
        );
      }
      approvedAmountKobo = reducedAmountKobo;
      const releaseKobo = order.totalKobo - reducedAmountKobo;
      if (releaseKobo > 0 && order.reservation) {
        await this.reservationService.release({
          reservationId: order.reservation.id,
          amountKobo: releaseKobo,
          reason: 'Order approved with reduced amount',
          createdByUserId: actorUserId,
          idempotencyKey: `approve-reduce:${orderId}`,
        });
      }
    }

    return this.prisma.order.update({
      where: { id: orderId },
      data: {
        fulfillmentStatus: OrderFulfillmentStatus.APPROVED,
        approvedAmountKobo,
        approvalExpiresAt: null,
      },
      include: ORDER_RELATIONS_INCLUDE,
    });
  }

  /** Rejects a PENDING_APPROVAL order, releasing its full reservation back to available credit. */
  async rejectOrder(
    orderId: string,
    actorUserId?: string,
    employerId?: string,
  ): Promise<OrderWithRelations> {
    const order = await this.findOrderOrThrow(orderId, employerId);
    if (order.fulfillmentStatus !== OrderFulfillmentStatus.PENDING_APPROVAL) {
      throw new BadRequestException(
        `Order cannot be rejected from status ${order.fulfillmentStatus}`,
      );
    }

    if (
      order.reservation &&
      RELEASABLE_RESERVATION_STATUSES.includes(order.reservation.status)
    ) {
      await this.reservationService.release({
        reservationId: order.reservation.id,
        reason: 'Order rejected by employer',
        createdByUserId: actorUserId,
        idempotencyKey: `reject:${orderId}`,
      });
    }

    return this.prisma.order.update({
      where: { id: orderId },
      data: {
        fulfillmentStatus: OrderFulfillmentStatus.CANCELLED,
        creditStatus: OrderCreditStatus.RELEASED,
      },
      include: ORDER_RELATIONS_INCLUDE,
    });
  }

  /**
   * Marks an order FULFILLED: captures the reservation (purchase + delivery
   * + service fees), records per-item fulfilled quantities, and starts the
   * interest grace period. If `items` omits some line items (partial
   * fulfillment), only their share of the subtotal is captured and any
   * remainder stays reserved for a later fulfillment or cancellation.
   */
  async fulfillOrder(
    orderId: string,
    actorUserId?: string,
    items?: FulfillOrderItemInput[],
    employerId?: string,
  ): Promise<OrderWithRelations> {
    const order = await this.findOrderOrThrow(orderId, employerId);

    const fulfillableStatuses: OrderFulfillmentStatus[] = [
      OrderFulfillmentStatus.APPROVED,
      OrderFulfillmentStatus.PROCESSING,
      OrderFulfillmentStatus.READY_FOR_PICKUP,
      OrderFulfillmentStatus.OUT_FOR_DELIVERY,
    ];
    if (!fulfillableStatuses.includes(order.fulfillmentStatus)) {
      throw new BadRequestException(
        `Order cannot be fulfilled from status ${order.fulfillmentStatus}`,
      );
    }
    if (!order.reservation) {
      throw new BadRequestException(
        'Order has no credit reservation to capture',
      );
    }

    let purchaseKobo = order.subtotalKobo;
    let itemUpdates: { id: string; fulfilledQuantity: number }[] =
      order.items.map((i) => ({ id: i.id, fulfilledQuantity: i.quantity }));

    if (items && items.length > 0) {
      let total = 0;
      itemUpdates = items.map((input) => {
        const item = order.items.find((oi) => oi.id === input.orderItemId);
        if (!item) {
          throw new BadRequestException(
            `Order item ${input.orderItemId} not found on this order`,
          );
        }
        if (
          !Number.isInteger(input.fulfilledQuantity) ||
          input.fulfilledQuantity < 0 ||
          input.fulfilledQuantity > item.quantity
        ) {
          throw new BadRequestException(
            `Invalid fulfilled quantity for item "${item.name}"`,
          );
        }
        total += item.unitPriceKobo * input.fulfilledQuantity;
        return { id: item.id, fulfilledQuantity: input.fulfilledQuantity };
      });
      purchaseKobo = total;
    }

    if (purchaseKobo <= 0) {
      throw new BadRequestException(
        'Nothing to fulfill: fulfilled quantities total zero',
      );
    }

    const policy = this.resolvePolicy(
      await this.getEmployerPolicy(order.employerId),
    );

    const capture = await this.reservationService.capture({
      reservationId: order.reservation.id,
      purchaseKobo,
      deliveryFeeKobo: order.deliveryFeeKobo,
      serviceFeeKobo: order.serviceFeeKobo,
      productType: order.productType,
      createdByUserId: actorUserId,
      idempotencyKey: `fulfill:${orderId}`,
    });

    const isFullyCaptured =
      capture.reservation.status === CreditReservationStatus.CAPTURED;

    return this.prisma.$transaction(async (tx) => {
      await Promise.all(
        itemUpdates.map((u) =>
          tx.orderItem.update({
            where: { id: u.id },
            data: { fulfilledQuantity: u.fulfilledQuantity },
          }),
        ),
      );

      return tx.order.update({
        where: { id: orderId },
        data: {
          fulfillmentStatus: OrderFulfillmentStatus.FULFILLED,
          creditStatus: isFullyCaptured
            ? OrderCreditStatus.CAPTURED
            : OrderCreditStatus.PARTIALLY_CAPTURED,
          graceInterestStartsAt: new Date(
            Date.now() + policy.interestGraceDays * 24 * 60 * 60 * 1000,
          ),
        },
        include: ORDER_RELATIONS_INCLUDE,
      });
    });
  }

  /** Cancels an order that hasn't been fulfilled yet, releasing any outstanding reservation. */
  async cancelOrder(
    orderId: string,
    actorUserId?: string,
    employerId?: string,
  ): Promise<OrderWithRelations> {
    const order = await this.findOrderOrThrow(orderId, employerId);

    const cancellableStatuses: OrderFulfillmentStatus[] = [
      OrderFulfillmentStatus.DRAFT,
      OrderFulfillmentStatus.PENDING_APPROVAL,
      OrderFulfillmentStatus.APPROVED,
      OrderFulfillmentStatus.PROCESSING,
      OrderFulfillmentStatus.READY_FOR_PICKUP,
      OrderFulfillmentStatus.OUT_FOR_DELIVERY,
    ];
    if (!cancellableStatuses.includes(order.fulfillmentStatus)) {
      throw new BadRequestException(
        `Order cannot be cancelled from status ${order.fulfillmentStatus}`,
      );
    }

    if (
      order.reservation &&
      RELEASABLE_RESERVATION_STATUSES.includes(order.reservation.status)
    ) {
      await this.reservationService.release({
        reservationId: order.reservation.id,
        reason: 'Order cancelled',
        createdByUserId: actorUserId,
        idempotencyKey: `cancel:${orderId}`,
      });
    }

    return this.prisma.order.update({
      where: { id: orderId },
      data: {
        fulfillmentStatus: OrderFulfillmentStatus.CANCELLED,
        creditStatus: OrderCreditStatus.RELEASED,
      },
      include: ORDER_RELATIONS_INCLUDE,
    });
  }

  /** Posts a (partial or full) refund against a FULFILLED order's captured balance. */
  async refundOrder(
    orderId: string,
    actorUserId: string | undefined,
    amountKobo: number,
    reason: string,
    employerId?: string,
  ): Promise<OrderWithRelations> {
    if (amountKobo <= 0) {
      throw new BadRequestException('Refund amount must be positive');
    }

    await this.findOrderOrThrow(orderId, employerId);

    return this.prisma.$transaction(async (tx) => {
      const order = await tx.order.findUnique({
        where: { id: orderId },
        include: ORDER_RELATIONS_INCLUDE,
      });
      if (!order) {
        throw new NotFoundException('Order not found');
      }
      if (order.fulfillmentStatus !== OrderFulfillmentStatus.FULFILLED) {
        throw new BadRequestException('Only fulfilled orders can be refunded');
      }
      if (!order.reservation) {
        throw new BadRequestException('Order has no credit reservation');
      }

      const priorRefunds = await tx.ledgerEntry.aggregate({
        where: {
          referenceType: 'Order',
          referenceId: orderId,
          entryType: LedgerEntryType.REFUND,
        },
        _sum: { amountKobo: true },
      });
      const alreadyRefundedKobo = Math.abs(priorRefunds._sum.amountKobo ?? 0);
      const capturedKobo = order.reservation.capturedKobo;
      if (alreadyRefundedKobo + amountKobo > capturedKobo) {
        throw new BadRequestException(
          'Refund amount exceeds the captured (non-refunded) balance for this order',
        );
      }

      await this.ledger.post(tx, {
        creditAccountId: order.reservation.creditAccountId,
        entryType: LedgerEntryType.REFUND,
        amountKobo: -amountKobo,
        referenceType: 'Order',
        referenceId: orderId,
        createdByUserId: actorUserId,
        metadata: { reason },
        apply: (_account, e) => ({ principalOutstandingKobo: e.amountKobo }),
      });

      const totalRefundedKobo = alreadyRefundedKobo + amountKobo;
      const creditStatus =
        totalRefundedKobo >= capturedKobo
          ? OrderCreditStatus.REFUNDED
          : OrderCreditStatus.PARTIALLY_REFUNDED;

      return tx.order.update({
        where: { id: orderId },
        data: { creditStatus },
        include: ORDER_RELATIONS_INCLUDE,
      });
    });
  }

  private async findOrderOrThrow(
    orderId: string,
    employerId?: string,
  ): Promise<OrderWithRelations> {
    const order = await this.prisma.order.findUnique({
      where: { id: orderId },
      include: ORDER_RELATIONS_INCLUDE,
    });
    if (!order) {
      throw new NotFoundException('Order not found');
    }
    if (employerId && order.employerId !== employerId) {
      throw new ForbiddenException(
        'This order does not belong to your employer',
      );
    }
    return order;
  }

  private async requireEmployeeContext(
    userId: string,
  ): Promise<EmployeeContext> {
    const employee = await this.prisma.employee.findUnique({
      where: { userId },
      include: { employer: true, creditAccount: true },
    });

    if (!employee) {
      throw new ForbiddenException('Available to employees only');
    }

    const account =
      employee.creditAccount ??
      (await this.creditAccountService.getOrCreateAccount(employee.id));

    return { employee, employer: employee.employer, account };
  }

  private async getEmployerPolicy(
    employerId: string,
  ): Promise<CreditPolicy | null> {
    return this.prisma.creditPolicy.findUnique({ where: { employerId } });
  }

  private resolvePolicy(policy: CreditPolicy | null): ResolvedCreditPolicy {
    return {
      maxRepaymentMonths: policy?.maxRepaymentMonths ?? 6,
      reservationTtlHours: policy?.reservationTtlHours ?? 72,
      approvalTtlHours: policy?.approvalTtlHours ?? 72,
      interestAnnualRateBps: policy?.interestAnnualRateBps ?? 1_800,
      interestGraceDays: policy?.interestGraceDays ?? 30,
      minDaysBetweenPurchases: policy?.minDaysBetweenPurchases ?? 14,
      maxPurchasesInWindow: policy?.maxPurchasesInWindow ?? 2,
      purchaseWindowDays: policy?.purchaseWindowDays ?? 30,
      requirePriorDeductionAfterFirst:
        policy?.requirePriorDeductionAfterFirst ?? true,
      overLimitAction: policy?.overLimitAction ?? OverLimitAction.REJECT,
      overDurationAction:
        policy?.overDurationAction ?? OverDurationAction.REJECT,
      approvalThresholdKobo: policy?.approvalThresholdKobo ?? null,
      requireApprovalFirstPurchase:
        policy?.requireApprovalFirstPurchase ?? false,
      requireApprovalHighRisk: policy?.requireApprovalHighRisk ?? true,
      highRiskScoreThreshold: policy?.highRiskScoreThreshold ?? 70,
    };
  }

  /**
   * Runs every pre-checkout credit safeguard: purchase-frequency abuse rules,
   * a payoff-within-max-months simulation, available-credit headroom, and the
   * employee's live risk score. Throws on hard rejections; otherwise reports
   * whether the order must be routed to `PENDING_APPROVAL`.
   */
  private async runCreditChecks(params: {
    employee: Employee;
    employer: Employer;
    account: CreditAccount;
    policy: ResolvedCreditPolicy;
    totalKobo: number;
  }): Promise<{ needsApproval: boolean }> {
    const { employee, employer, account, policy, totalKobo } = params;

    const priorOrders = await this.prisma.order.findMany({
      where: {
        employeeId: employee.id,
        fulfillmentStatus: { in: COUNTED_FULFILLMENT_STATUSES },
      },
      orderBy: { createdAt: 'desc' },
      take: Math.max(policy.maxPurchasesInWindow, 1) + 5,
      select: { createdAt: true },
    });

    const isFirstPurchase = priorOrders.length === 0;
    const now = new Date();
    const dayMs = 24 * 60 * 60 * 1000;
    const violations: string[] = [];

    if (!isFirstPurchase) {
      const daysSinceLast = Math.floor(
        (now.getTime() - priorOrders[0].createdAt.getTime()) / dayMs,
      );
      if (daysSinceLast < policy.minDaysBetweenPurchases) {
        violations.push(
          `Another purchase was made ${daysSinceLast} day(s) ago; must wait ${policy.minDaysBetweenPurchases} days between purchases`,
        );
      }
    }

    const windowStart = new Date(
      now.getTime() - policy.purchaseWindowDays * dayMs,
    );
    const purchasesInWindow = priorOrders.filter(
      (o) => o.createdAt >= windowStart,
    ).length;
    if (purchasesInWindow >= policy.maxPurchasesInWindow) {
      violations.push(
        `Maximum of ${policy.maxPurchasesInWindow} purchase(s) per ${policy.purchaseWindowDays} days already reached`,
      );
    }

    if (!isFirstPurchase && policy.requirePriorDeductionAfterFirst) {
      const priorRepayment = await this.prisma.ledgerEntry.findFirst({
        where: {
          creditAccountId: account.id,
          entryType: LedgerEntryType.PAYROLL_REPAYMENT,
        },
        select: { id: true },
      });
      if (!priorRepayment) {
        violations.push(
          'A payroll deduction must be collected before making another purchase',
        );
      }
    }

    const monthlyDeductionKobo = Math.floor(
      (employee.salaryKobo * employee.deductionPercent) / 100,
    );
    const payoff = simulatePayoffMonths({
      principalOutstanding: account.principalOutstandingKobo,
      postedInterest: account.postedInterestKobo,
      postedFees: account.postedFeesKobo,
      postedPenalties: account.postedPenaltiesKobo,
      reservedToAdd: totalKobo,
      monthlyDeductionKobo,
      annualRateBps: policy.interestAnnualRateBps,
      graceDaysRemaining: policy.interestGraceDays,
      maxMonths: policy.maxRepaymentMonths,
      payrollDayOfMonth: employer.payrollDayOfMonth,
      fromDate: now,
    });
    if (!payoff.paysOffWithinMax) {
      violations.push(
        `This purchase would not pay off within the maximum ${policy.maxRepaymentMonths}-month repayment window at the current deduction rate`,
      );
    }

    let needsApproval = false;
    if (violations.length > 0) {
      switch (policy.overDurationAction) {
        case OverDurationAction.REJECT:
          throw new BadRequestException({
            message: violations.join('; '),
            code: 'CREDIT_POLICY_VIOLATION',
          });
        case OverDurationAction.SUGGEST_WAIT:
          throw new BadRequestException({
            message: `${violations.join('; ')}. Please try again later.`,
            code: 'CREDIT_POLICY_SUGGEST_WAIT',
          });
        case OverDurationAction.REQUIRE_APPROVAL:
        case OverDurationAction.ALLOW_HIGHER_DEDUCTION:
          needsApproval = true;
          break;
      }
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
    if (totalKobo > availableKobo) {
      const suffix =
        policy.overLimitAction === OverLimitAction.REQUIRE_APPROVAL
          ? ' and requires employer approval to proceed'
          : '';
      throw new BadRequestException({
        message: `Order total exceeds available credit (₦${(availableKobo / 100).toFixed(2)} available)${suffix}`,
        code: 'OVER_CREDIT_LIMIT',
      });
    }

    const risk = await this.riskEngine.evaluateForEmployee(
      employee.id,
      totalKobo,
    );
    if (risk.overallDecision === 'REJECT') {
      throw new ForbiddenException({
        message: risk.decisions.map((d) => d.reason).join('; '),
        code: 'RISK_REJECTED',
      });
    }
    if (risk.overallDecision === 'REQUIRE_APPROVAL') {
      needsApproval = true;
    }
    if (
      policy.requireApprovalHighRisk &&
      risk.score >= policy.highRiskScoreThreshold
    ) {
      needsApproval = true;
    }

    if (policy.requireApprovalFirstPurchase && isFirstPurchase) {
      needsApproval = true;
    }
    if (
      policy.approvalThresholdKobo != null &&
      totalKobo > policy.approvalThresholdKobo
    ) {
      needsApproval = true;
    }

    return { needsApproval };
  }

  private toLocationDto(entity: {
    addressLine: string | null;
    city: string | null;
    state: string | null;
    latitude: number | null;
    longitude: number | null;
  }): EmployeeLocationDto {
    const isSet =
      entity.addressLine != null &&
      entity.addressLine.length > 0 &&
      entity.latitude != null &&
      entity.longitude != null;
    return {
      addressLine: entity.addressLine,
      city: entity.city,
      state: entity.state,
      latitude: entity.latitude,
      longitude: entity.longitude,
      isSet,
    };
  }

  private estimateNextDeduction(
    employee: Employee,
    employer: Employer,
    account: CreditAccount,
  ): NextDeductionDto | null {
    const owedKobo = computeTotalOwedKobo(account);
    if (owedKobo <= 0) {
      return null;
    }

    const amountKobo = Math.min(
      owedKobo,
      Math.floor((employee.salaryKobo * employee.deductionPercent) / 100),
    );
    if (amountKobo <= 0) {
      return null;
    }

    const now = new Date();
    const nextDue = new Date(
      Date.UTC(
        now.getUTCFullYear(),
        now.getUTCMonth(),
        employer.payrollDayOfMonth,
      ),
    );
    if (nextDue < now) {
      nextDue.setUTCMonth(nextDue.getUTCMonth() + 1);
    }

    return {
      amountKobo,
      scheduledFor: nextDue.toISOString().slice(0, 10),
    };
  }
}
