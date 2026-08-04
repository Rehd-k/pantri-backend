import {
  OrderCreditStatus,
  OrderFulfillmentStatus,
} from '../../../generated/prisma/client';

export class CheckoutOrderItemDto {
  productId!: string;
  name!: string;
  quantity!: number;
  unitPriceKobo!: number;
  lineTotalKobo!: number;
}

export class CheckoutResponseDto {
  id!: string;
  fulfillmentStatus!: OrderFulfillmentStatus;
  creditStatus!: OrderCreditStatus;
  subtotalKobo!: number;
  deliveryFeeKobo!: number;
  serviceFeeKobo!: number;
  totalKobo!: number;
  /** Amount held against the employee's credit account for this order. */
  reservedKobo!: number;
  pickupPointId!: string;
  pickupPointLabel!: string;
  items!: CheckoutOrderItemDto[];
  createdAt!: string;
}
