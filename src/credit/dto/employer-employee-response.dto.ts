import {
  CreditAccount,
  CreditAccountStatus,
  Employee,
  EmployeeAccountStatus,
  User,
} from '../../../generated/prisma/client';

export class EmployerEmployeeCreditSummaryDto {
  id!: string;
  status!: CreditAccountStatus;
  creditLimitKobo!: number;
  effectiveLimitKobo!: number;
  availableKobo!: number;
  totalOwedKobo!: number;
}

export class EmployerEmployeeResponseDto {
  id!: string;
  userId!: string;
  firstName!: string;
  lastName!: string;
  email!: string;
  salaryKobo!: number;
  deductionPercent!: number;
  accountStatus!: EmployeeAccountStatus;
  creditAccount!: EmployerEmployeeCreditSummaryDto | null;
  createdAt!: string;
}

type EmployeeWithRelations = Employee & {
  user: User;
  creditAccount: CreditAccount | null;
};

export function toEmployerEmployeeResponseDto(
  employee: EmployeeWithRelations,
): EmployerEmployeeResponseDto {
  const account = employee.creditAccount;
  return {
    id: employee.id,
    userId: employee.userId,
    firstName: employee.user.firstName,
    lastName: employee.user.lastName,
    email: employee.user.email,
    salaryKobo: employee.salaryKobo,
    deductionPercent: employee.deductionPercent,
    accountStatus: employee.accountStatus,
    creditAccount: account
      ? {
          id: account.id,
          status: account.status,
          creditLimitKobo: account.creditLimitKobo,
          effectiveLimitKobo:
            account.manualLimitOverrideKobo ?? account.creditLimitKobo,
          availableKobo: account.availableKobo,
          totalOwedKobo:
            account.principalOutstandingKobo +
            account.postedInterestKobo +
            account.postedFeesKobo +
            account.postedPenaltiesKobo,
        }
      : null,
    createdAt: employee.createdAt.toISOString(),
  };
}
