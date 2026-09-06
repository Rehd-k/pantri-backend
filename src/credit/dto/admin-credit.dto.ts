import { Type } from 'class-transformer';
import {
  IsIn,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  MaxLength,
  Min,
  ValidateIf,
} from 'class-validator';

export class AdjustCreditDto {
  /** Positive increases amount owed; negative decreases (credit). */
  @Type(() => Number)
  @IsInt()
  amountKobo!: number;

  @IsString()
  @IsNotEmpty()
  @MaxLength(500)
  reason!: string;

  @IsOptional()
  @IsIn(['ADJUSTMENT', 'MANUAL_CREDIT', 'MANUAL_DEBIT'])
  entryType?: 'ADJUSTMENT' | 'MANUAL_CREDIT' | 'MANUAL_DEBIT';
}

export class SetCreditLimitDto {
  /** Pass null to clear override and restore salary-based limit. */
  @ValidateIf((_, value) => value !== null)
  @Type(() => Number)
  @IsInt()
  @Min(0)
  manualLimitOverrideKobo!: number | null;

  @IsString()
  @IsNotEmpty()
  @MaxLength(500)
  reason!: string;
}
