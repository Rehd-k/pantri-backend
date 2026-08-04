import { PayrollDeductionLineStatus } from '../../../generated/prisma/client';
import { PayrollRunResponseDto } from './payroll-run-response.dto';

export class PayrollDeductionLineResponseDto {
  id!: string;
  employeeId!: string;
  salarySnapshotKobo!: number;
  deductionPercentSnapshot!: number;
  requestedKobo!: number;
  collectedKobo!: number;
  status!: PayrollDeductionLineStatus;
}

export class PayrollRunDetailResponseDto extends PayrollRunResponseDto {
  lines!: PayrollDeductionLineResponseDto[];
}
