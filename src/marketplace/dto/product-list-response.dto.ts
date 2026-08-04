import { ProductResponseDto } from './product-response.dto';

export class ProductListResponseDto {
  items!: ProductResponseDto[];
  total!: number;
}
