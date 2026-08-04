import { Type } from 'class-transformer';
import { IsInt, IsOptional, IsString, Max, Min } from 'class-validator';

export class ListLedgerQueryDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(200)
  limit?: number;

  /** Cursor is the `id` of the last ledger entry seen (results are ordered by sequence desc). */
  @IsOptional()
  @IsString()
  cursor?: string;
}
