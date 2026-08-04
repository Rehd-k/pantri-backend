import { IsISO8601, IsOptional, IsString } from 'class-validator';

export class GeneratePayrollRunDto {
  @IsISO8601()
  periodStart!: string;

  @IsISO8601()
  periodEnd!: string;

  @IsISO8601()
  payrollDate!: string;

  @IsOptional()
  @IsString()
  idempotencyKey?: string;
}
