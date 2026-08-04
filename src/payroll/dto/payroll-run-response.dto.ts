import { PayrollRun, PayrollRunStatus } from '../../../generated/prisma/client';

export class PayrollRunResponseDto {
  id!: string;
  employerId!: string;
  periodStart!: string;
  periodEnd!: string;
  payrollDate!: string;
  status!: PayrollRunStatus;
  createdAt!: string;
  updatedAt!: string;
}

export function toPayrollRunResponseDto(run: PayrollRun): PayrollRunResponseDto {
  return {
    id: run.id,
    employerId: run.employerId,
    periodStart: run.periodStart.toISOString(),
    periodEnd: run.periodEnd.toISOString(),
    payrollDate: run.payrollDate.toISOString(),
    status: run.status,
    createdAt: run.createdAt.toISOString(),
    updatedAt: run.updatedAt.toISOString(),
  };
}
