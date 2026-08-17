import { IsDateString, IsNotEmpty } from 'class-validator';

export class GenerateCompanyInvoiceDto {
  @IsDateString()
  @IsNotEmpty()
  periodStart!: string;

  @IsDateString()
  @IsNotEmpty()
  periodEnd!: string;
}
