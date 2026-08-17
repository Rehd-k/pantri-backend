import {
  OrderCreditStatus,
  OrderFulfillmentStatus,
  ProductType,
} from '../../../generated/prisma/client';
import { OrderWithRelations } from '../order.service';

export class OrderItemResponseDto {
  id!: string;
  productId!: string;
  packId!: string | null;
  name!: string;
  brand!: string;
  packageLabel!: string;
  quantity!: number;
  fulfilledQuantity!: number;
  unitPriceKobo!: number;
  lineTotalKobo!: number;
}

export class OrderResponseDto {
  id!: string;
  employeeId!: string;
  employerId!: string;
  pickupPointId!: string;
  productType!: ProductType;
  fulfillmentStatus!: OrderFulfillmentStatus;
  /** Product-facing label for fulfillmentStatus. */
  statusLabel!: string;
  creditStatus!: OrderCreditStatus;
  subtotalKobo!: number;
  deliveryFeeKobo!: number;
  serviceFeeKobo!: number;
  totalKobo!: number;
  approvedAmountKobo!: number | null;
  approvalExpiresAt!: string | null;
  graceInterestStartsAt!: string | null;
  reservedKobo!: number | null;
  reservationStatus!: string | null;
  items!: OrderItemResponseDto[];
  statusHistory!: {
    id: string;
    fromStatus: OrderFulfillmentStatus | null;
    toStatus: OrderFulfillmentStatus;
    note: string | null;
    changedById: string | null;
    createdAt: string;
  }[];
  createdAt!: string;
  updatedAt!: string;
}

const STATUS_LABELS: Record<OrderFulfillmentStatus, string> = {
  DRAFT: 'Draft',
  VERIFICATION_HOLD: 'Pending verification',
  PENDING_APPROVAL: 'Pending',
  APPROVED: 'Approved',
  PROCESSING: 'Sourcing',
  READY_FOR_PICKUP: 'Waiting for pickup',
  OUT_FOR_DELIVERY: 'In transit',
  FULFILLED: 'Delivered',
  CANCELLED: 'Cancelled',
  EXPIRED: 'Expired',
};

export function toOrderResponseDto(
  order: OrderWithRelations,
): OrderResponseDto {
  return {
    id: order.id,
    employeeId: order.employeeId,
    employerId: order.employerId,
    pickupPointId: order.pickupPointId,
    productType: order.productType,
    fulfillmentStatus: order.fulfillmentStatus,
    statusLabel: STATUS_LABELS[order.fulfillmentStatus] ?? order.fulfillmentStatus,
    creditStatus: order.creditStatus,
    subtotalKobo: order.subtotalKobo,
    deliveryFeeKobo: order.deliveryFeeKobo,
    serviceFeeKobo: order.serviceFeeKobo,
    totalKobo: order.totalKobo,
    approvedAmountKobo: order.approvedAmountKobo,
    approvalExpiresAt: order.approvalExpiresAt
      ? order.approvalExpiresAt.toISOString()
      : null,
    graceInterestStartsAt: order.graceInterestStartsAt
      ? order.graceInterestStartsAt.toISOString()
      : null,
    reservedKobo: order.reservation
      ? order.reservation.amountKobo -
        order.reservation.capturedKobo -
        order.reservation.releasedKobo
      : null,
    reservationStatus: order.reservation?.status ?? null,
    items: order.items.map((i) => ({
      id: i.id,
      productId: i.productId,
      packId: i.packId,
      name: i.name,
      brand: i.brand,
      packageLabel: i.packageLabel,
      quantity: i.quantity,
      fulfilledQuantity: i.fulfilledQuantity,
      unitPriceKobo: i.unitPriceKobo,
      lineTotalKobo: i.lineTotalKobo,
    })),
    statusHistory: (order.statusHistory ?? []).map((h) => ({
      id: h.id,
      fromStatus: h.fromStatus,
      toStatus: h.toStatus,
      note: h.note,
      changedById: h.changedById,
      createdAt: h.createdAt.toISOString(),
    })),
    createdAt: order.createdAt.toISOString(),
    updatedAt: order.updatedAt.toISOString(),
  };
}
