export class CartItemResponseDto {
  id!: string;
  productId!: string;
  name!: string;
  brand!: string;
  packageLabel!: string;
  imageUrl!: string;
  quantity!: number;
  unitPriceKobo!: number;
  lineTotalKobo!: number;
  retailPriceKobo!: number;
}
