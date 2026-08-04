export class CreditSummaryDto {
  creditLimitKobo!: number;
  outstandingKobo!: number;
  availableKobo!: number;
  reservedKobo!: number;
}

export class NextDeductionDto {
  amountKobo!: number;
  scheduledFor!: string;
}

export class EmployeeDashboardDto {
  credit!: CreditSummaryDto;
  nextDeduction!: NextDeductionDto | null;
}
