import { Type } from 'class-transformer';
import { IsInt, IsOptional, Min } from 'class-validator';

export class ApproveOrderDto {
  /** If provided, approves the order for less than its reserved total, releasing the difference back to available credit. */
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  reducedAmountKobo?: number;
}
