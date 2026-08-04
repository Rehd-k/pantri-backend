import { Type } from 'class-transformer';
import {
  IsArray,
  IsInt,
  IsOptional,
  IsString,
  Min,
  ValidateNested,
} from 'class-validator';

export class FulfillOrderItemDto {
  @IsString()
  orderItemId!: string;

  @Type(() => Number)
  @IsInt()
  @Min(0)
  fulfilledQuantity!: number;
}

export class FulfillOrderDto {
  /** Omit to fulfill every line item at its full ordered quantity. */
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => FulfillOrderItemDto)
  items?: FulfillOrderItemDto[];
}
