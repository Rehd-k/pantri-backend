import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  CreditAccountStatus,
  CreditPolicy,
  OverDurationAction,
  OverLimitAction,
} from '../../../generated/prisma/client';
import { PrismaService } from '../../prisma/prisma.service';

export interface UpdateCreditPolicyParams {
  defaultDeductionPercent?: number;
  minDeductionPercent?: number;
  maxDeductionPercent?: number;
  employeeMaySetDeductionPercent?: boolean;
  creditMultiplierBps?: number;
  maxRepaymentMonths?: number;
  reservationTtlHours?: number;
  approvalTtlHours?: number;
  interestAnnualRateBps?: number;
  interestGraceDays?: number;
  penaltiesEnabled?: boolean;
  minDaysBetweenPurchases?: number;
  maxPurchasesInWindow?: number;
  purchaseWindowDays?: number;
  requirePriorDeductionAfterFirst?: boolean;
  overLimitAction?: OverLimitAction;
  overDurationAction?: OverDurationAction;
  approvalThresholdKobo?: number | null;
  requireApprovalFirstPurchase?: boolean;
  requireApprovalHighRisk?: boolean;
  highRiskScoreThreshold?: number;
  consecutiveMissesBeforeFreeze?: number;
}

/** Employer-facing management of the `CreditPolicy` that governs their tenant, and per-employee account controls. */
@Injectable()
export class EmployerCreditService {
  constructor(private readonly prisma: PrismaService) {}

  /** Resolves which employer a staff user acts on behalf of (membership first, legacy soft-link fallback). */
  async resolveEmployerId(userId: string): Promise<string> {
    const membership = await this.prisma.employerMembership.findFirst({
      where: { userId },
    });
    if (membership) {
      return membership.employerId;
    }

    const employer = await this.prisma.employer.findFirst({
      where: { users: { some: { id: userId } } },
    });
    if (employer) {
      return employer.id;
    }

    throw new ForbiddenException('This user is not associated with an employer');
  }

  async getPolicy(employerId: string): Promise<CreditPolicy> {
    const existing = await this.prisma.creditPolicy.findUnique({
      where: { employerId },
    });
    if (existing) {
      return existing;
    }
    return this.prisma.creditPolicy.create({ data: { employerId } });
  }

  async updatePolicy(
    employerId: string,
    params: UpdateCreditPolicyParams,
  ): Promise<CreditPolicy> {
    await this.getPolicy(employerId);
    return this.prisma.creditPolicy.update({
      where: { employerId },
      data: { ...params, version: { increment: 1 } },
    });
  }

  async listEmployees(employerId: string) {
    return this.prisma.employee.findMany({
      where: { employerId },
      include: { user: true, creditAccount: true },
      orderBy: { createdAt: 'asc' },
    });
  }

  async freezeEmployeeAccount(
    employerId: string,
    employeeId: string,
  ): Promise<void> {
    await this.ensureEmployeeBelongsToEmployer(employerId, employeeId);
    await this.prisma.creditAccount.update({
      where: { employeeId },
      data: { status: CreditAccountStatus.FROZEN },
    });
  }

  async unfreezeEmployeeAccount(
    employerId: string,
    employeeId: string,
  ): Promise<void> {
    await this.ensureEmployeeBelongsToEmployer(employerId, employeeId);
    await this.prisma.creditAccount.update({
      where: { employeeId },
      data: { status: CreditAccountStatus.ACTIVE },
    });
  }

  private async ensureEmployeeBelongsToEmployer(
    employerId: string,
    employeeId: string,
  ): Promise<void> {
    const employee = await this.prisma.employee.findFirst({
      where: { id: employeeId, employerId },
      select: { id: true },
    });
    if (!employee) {
      throw new NotFoundException('Employee not found for this employer');
    }
  }
}
