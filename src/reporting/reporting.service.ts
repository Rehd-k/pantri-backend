import { ForbiddenException, Injectable } from '@nestjs/common';
import { CreditAccountStatus } from '../../generated/prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { EmployerBalanceSummaryDto } from './dto/employer-balance-summary.dto';
import {
  EmployeeExposureLineDto,
  EmployerExposureBreakdownDto,
} from './dto/employer-exposure-breakdown.dto';

/** Read-side reporting over the credit ledger, scoped per employer tenant. */
@Injectable()
export class ReportingService {
  constructor(private readonly prisma: PrismaService) {}

  /** Resolves which employer a staff user acts on behalf of (membership first, legacy soft-link fallback). */
  async resolveEmployerContext(
    userId: string,
  ): Promise<{ employerId: string }> {
    const membership = await this.prisma.employerMembership.findFirst({
      where: { userId },
    });
    if (membership) {
      return { employerId: membership.employerId };
    }

    const employer = await this.prisma.employer.findFirst({
      where: { users: { some: { id: userId } } },
    });
    if (employer) {
      return { employerId: employer.id };
    }

    throw new ForbiddenException(
      'This user is not associated with an employer',
    );
  }

  async getEmployerBalanceSummary(
    employerId: string,
  ): Promise<EmployerBalanceSummaryDto> {
    const accounts = await this.prisma.creditAccount.findMany({
      where: { employee: { employerId } },
      select: {
        creditLimitKobo: true,
        manualLimitOverrideKobo: true,
        principalOutstandingKobo: true,
        postedInterestKobo: true,
        postedFeesKobo: true,
        postedPenaltiesKobo: true,
        reservedKobo: true,
        availableKobo: true,
        status: true,
      },
    });

    const summary = accounts.reduce(
      (acc, account) => {
        acc.totalCreditLimitKobo +=
          account.manualLimitOverrideKobo ?? account.creditLimitKobo;
        acc.totalPrincipalOutstandingKobo += account.principalOutstandingKobo;
        acc.totalPostedInterestKobo += account.postedInterestKobo;
        acc.totalPostedFeesKobo += account.postedFeesKobo;
        acc.totalPostedPenaltiesKobo += account.postedPenaltiesKobo;
        acc.totalReservedKobo += account.reservedKobo;
        acc.totalAvailableKobo += account.availableKobo;
        acc.activeAccounts +=
          account.status === CreditAccountStatus.ACTIVE ? 1 : 0;
        return acc;
      },
      {
        totalCreditLimitKobo: 0,
        totalPrincipalOutstandingKobo: 0,
        totalPostedInterestKobo: 0,
        totalPostedFeesKobo: 0,
        totalPostedPenaltiesKobo: 0,
        totalReservedKobo: 0,
        totalAvailableKobo: 0,
        activeAccounts: 0,
      },
    );

    return {
      employerId,
      totalAccounts: accounts.length,
      ...summary,
      totalExposureKobo:
        summary.totalPrincipalOutstandingKobo +
        summary.totalPostedInterestKobo +
        summary.totalPostedFeesKobo +
        summary.totalPostedPenaltiesKobo,
    };
  }

  async getEmployerExposureBreakdown(
    employerId: string,
  ): Promise<EmployerExposureBreakdownDto> {
    const employees = await this.prisma.employee.findMany({
      where: { employerId },
      include: { creditAccount: true },
      orderBy: { createdAt: 'asc' },
    });

    const lines: EmployeeExposureLineDto[] = employees
      .filter((employee) => employee.creditAccount !== null)
      .map((employee) => {
        const account = employee.creditAccount!;
        const effectiveLimitKobo =
          account.manualLimitOverrideKobo ?? account.creditLimitKobo;
        const exposureKobo =
          account.principalOutstandingKobo +
          account.postedInterestKobo +
          account.postedFeesKobo +
          account.postedPenaltiesKobo;

        return {
          employeeId: employee.id,
          salaryKobo: employee.salaryKobo,
          creditLimitKobo: effectiveLimitKobo,
          exposureKobo,
          reservedKobo: account.reservedKobo,
          availableKobo: account.availableKobo,
          utilizationPercent:
            effectiveLimitKobo > 0
              ? Math.round((exposureKobo / effectiveLimitKobo) * 100)
              : 0,
          consecutiveMissedDeductions: account.consecutiveMissedDeductions,
          status: account.status,
        };
      })
      .sort((a, b) => b.exposureKobo - a.exposureKobo);

    const totalExposureKobo = lines.reduce(
      (sum, line) => sum + line.exposureKobo,
      0,
    );

    return { employerId, totalExposureKobo, employees: lines };
  }

  /** Renders every employee's current credit balance for an employer as a downloadable CSV. */
  async exportEmployerBalancesCsv(employerId: string): Promise<string> {
    const employees = await this.prisma.employee.findMany({
      where: { employerId },
      include: {
        user: { select: { firstName: true, lastName: true, email: true } },
        creditAccount: true,
      },
      orderBy: { createdAt: 'asc' },
    });

    const header = [
      'employeeId',
      'firstName',
      'lastName',
      'email',
      'salaryKobo',
      'creditLimitKobo',
      'principalOutstandingKobo',
      'postedInterestKobo',
      'postedFeesKobo',
      'postedPenaltiesKobo',
      'reservedKobo',
      'availableKobo',
      'exposureKobo',
      'utilizationPercent',
      'status',
    ];

    const rows = employees.map((employee) => {
      const account = employee.creditAccount;
      const effectiveLimitKobo = account
        ? (account.manualLimitOverrideKobo ?? account.creditLimitKobo)
        : 0;
      const exposureKobo = account
        ? account.principalOutstandingKobo +
          account.postedInterestKobo +
          account.postedFeesKobo +
          account.postedPenaltiesKobo
        : 0;
      const utilizationPercent =
        effectiveLimitKobo > 0
          ? Math.round((exposureKobo / effectiveLimitKobo) * 100)
          : 0;

      return [
        employee.id,
        employee.user.firstName,
        employee.user.lastName,
        employee.user.email,
        String(employee.salaryKobo),
        String(effectiveLimitKobo),
        String(account?.principalOutstandingKobo ?? 0),
        String(account?.postedInterestKobo ?? 0),
        String(account?.postedFeesKobo ?? 0),
        String(account?.postedPenaltiesKobo ?? 0),
        String(account?.reservedKobo ?? 0),
        String(account?.availableKobo ?? 0),
        String(exposureKobo),
        String(utilizationPercent),
        account?.status ?? 'N/A',
      ];
    });

    return [header, ...rows]
      .map((row) => row.map(csvEscapeField).join(','))
      .join('\n');
  }
}

function csvEscapeField(value: string): string {
  if (/[",\n]/.test(value)) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}
