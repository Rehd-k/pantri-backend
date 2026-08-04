import {
  OrderCreditStatus,
  OrderFulfillmentStatus,
  ProductType,
} from '../../../generated/prisma/client';
import { OrderWithRelations } from '../order.service';

export class OrderItemResponseDto {
  id!: string;
  productId!: string;
  name!: string;
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
  createdAt!: string;
  updatedAt!: string;
}

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
      name: i.name,
      quantity: i.quantity,
      fulfilledQuantity: i.fulfilledQuantity,
      unitPriceKobo: i.unitPriceKobo,
      lineTotalKobo: i.lineTotalKobo,
    })),
    createdAt: order.createdAt.toISOString(),
    updatedAt: order.updatedAt.toISOString(),
  };
}
