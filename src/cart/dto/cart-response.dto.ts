import { CartItemResponseDto } from './cart-item-response.dto';

export class CartResponseDto {
  id!: string;
  items!: CartItemResponseDto[];
  itemCount!: number;
  subtotalKobo!: number;
  freeDeliveryMinKobo!: number;
  deliveryFeeKobo!: number;
  appliedDeliveryFeeKobo!: number;
  amountUntilFreeDeliveryKobo!: number;
  qualifiesForFreeDelivery!: boolean;
  totalKobo!: number;
  updatedAt!: string;
}
