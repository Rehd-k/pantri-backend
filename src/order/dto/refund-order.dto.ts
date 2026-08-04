import { Type } from 'class-transformer';
import { IsInt, IsNotEmpty, IsString, Min } from 'class-validator';

export class RefundOrderDto {
  @Type(() => Number)
  @IsInt()
  @Min(1)
  amountKobo!: number;

  @IsString()
  @IsNotEmpty()
  reason!: string;
}
