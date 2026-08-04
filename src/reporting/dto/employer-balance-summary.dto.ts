export class EmployerBalanceSummaryDto {
  employerId!: string;
  totalAccounts!: number;
  activeAccounts!: number;
  totalCreditLimitKobo!: number;
  totalPrincipalOutstandingKobo!: number;
  totalPostedInterestKobo!: number;
  totalPostedFeesKobo!: number;
  totalPostedPenaltiesKobo!: number;
  totalReservedKobo!: number;
  totalAvailableKobo!: number;
  totalExposureKobo!: number;
}
