import { CreditAccountStatus } from '../../../generated/prisma/client';

export class EmployeeExposureLineDto {
  employeeId!: string;
  salaryKobo!: number;
  creditLimitKobo!: number;
  exposureKobo!: number;
  reservedKobo!: number;
  availableKobo!: number;
  utilizationPercent!: number;
  consecutiveMissedDeductions!: number;
  status!: CreditAccountStatus;
}

export class EmployerExposureBreakdownDto {
  employerId!: string;
  totalExposureKobo!: number;
  employees!: EmployeeExposureLineDto[];
}
