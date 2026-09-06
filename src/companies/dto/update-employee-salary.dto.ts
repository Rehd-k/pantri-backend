import { Type } from 'class-transformer';
import {
  IsInt,
  IsOptional,
  IsString,
  Max,
  Min,
  MinLength,
} from 'class-validator';

export class UpdateEmployeeSalaryDto {
  @Type(() => Number)
  @IsInt()
  @Min(1)
  salaryKobo!: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1000)
  @Max(100_000)
  creditMultiplierBps?: number;

  @IsOptional()
  @IsString()
  @MinLength(1)
  reason?: string;
}
