import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  CreditAccount,
  CreditAccountStatus,
  Employee,
  LedgerEntry,
} from '../../../generated/prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { computeAvailableKobo, computeCreditLimitKobo } from '../domain/money';

const DEFAULT_CREDIT_MULTIPLIER_BPS = 15_000;

@Injectable()
export class CreditAccountService {
  constructor(private readonly prisma: PrismaService) {}

  /** Fetches the employee's credit account, creating it (with a freshly computed limit) if absent. */
  async getOrCreateAccount(
    employeeId: string,
    options?: {
      forceZeroLimit?: boolean;
      initialStatus?: CreditAccountStatus;
    },
  ): Promise<CreditAccount> {
    const existing = await this.prisma.creditAccount.findUnique({
      where: { employeeId },
    });
    if (existing) {
      return existing;
    }

    const employee = await this.prisma.employee.findUnique({
      where: { id: employeeId },
      include: { employer: { include: { creditPolicy: true } } },
    });
    if (!employee) {
      throw new NotFoundException('Employee not found');
    }

    const multiplierBps =
      employee.creditMultiplierBps ??
      employee.employer.creditPolicy?.creditMultiplierBps ??
      DEFAULT_CREDIT_MULTIPLIER_BPS;
    const creditLimitKobo = options?.forceZeroLimit
      ? 0
      : computeCreditLimitKobo(employee.salaryKobo, multiplierBps);

    try {
      return await this.prisma.creditAccount.create({
        data: {
          employeeId,
          creditLimitKobo,
          availableKobo: creditLimitKobo,
          status: options?.initialStatus ?? CreditAccountStatus.ACTIVE,
        },
      });
    } catch (error) {
      // Lost a create race with another request for the same employee.
      const existingAfterRace = await this.prisma.creditAccount.findUnique({
        where: { employeeId },
      });
      if (existingAfterRace) {
        return existingAfterRace;
      }
      throw error;
    }
  }

  async getAccountByUserId(userId: string): Promise<CreditAccount> {
    const employee = await this.prisma.employee.findUnique({
      where: { userId },
    });
    if (!employee) {
      throw new NotFoundException('Employee profile not found for this user');
    }
    return this.getOrCreateAccount(employee.id);
  }

  async getAccountById(creditAccountId: string): Promise<CreditAccount> {
    const account = await this.prisma.creditAccount.findUnique({
      where: { id: creditAccountId },
    });
    if (!account) {
      throw new NotFoundException('Credit account not found');
    }
    return account;
  }

  async listLedgerForUser(
    userId: string,
    limit = 50,
    cursorId?: string,
  ): Promise<LedgerEntry[]> {
    const account = await this.getAccountByUserId(userId);
    const take = Math.min(Math.max(limit, 1), 200);

    return this.prisma.ledgerEntry.findMany({
      where: { creditAccountId: account.id },
      orderBy: { sequence: 'desc' },
      take,
      ...(cursorId ? { cursor: { id: cursorId }, skip: 1 } : {}),
    });
  }

  /**
   * Recomputes `creditLimitKobo` (and cached `availableKobo`) from the
   * employee's current salary and the employer's active credit policy.
   * Called after salary changes or policy updates.
   */
  async recalculateLimit(employeeId: string): Promise<CreditAccount> {
    return this.prisma.$transaction(async (tx) => {
      const account = await tx.creditAccount.findUnique({
        where: { employeeId },
      });
      if (!account) {
        throw new NotFoundException('Credit account not found');
      }

      const employee = await tx.employee.findUniqueOrThrow({
        where: { id: employeeId },
        include: { employer: { include: { creditPolicy: true } } },
      });

      const multiplierBps =
        employee.creditMultiplierBps ??
        employee.employer.creditPolicy?.creditMultiplierBps ??
        DEFAULT_CREDIT_MULTIPLIER_BPS;
      const creditLimitKobo = computeCreditLimitKobo(
        employee.salaryKobo,
        multiplierBps,
      );
      const effectiveLimitKobo =
        account.manualLimitOverrideKobo ?? creditLimitKobo;

      const availableKobo = computeAvailableKobo({
        creditLimitKobo: effectiveLimitKobo,
        principalOutstandingKobo: account.principalOutstandingKobo,
        postedInterestKobo: account.postedInterestKobo,
        postedFeesKobo: account.postedFeesKobo,
        postedPenaltiesKobo: account.postedPenaltiesKobo,
        reservedKobo: account.reservedKobo,
      });

      return tx.creditAccount.update({
        where: { id: account.id },
        data: { creditLimitKobo, availableKobo },
      });
    });
  }

  /** Employee self-service update of their payroll deduction percent, bounded by the employer's policy. */
  async updateDeductionPercent(
    userId: string,
    deductionPercent: number,
  ): Promise<Employee> {
    const employee = await this.prisma.employee.findUnique({
      where: { userId },
      include: { employer: { include: { creditPolicy: true } } },
    });
    if (!employee) {
      throw new NotFoundException('Employee profile not found for this user');
    }

    const policy = employee.employer.creditPolicy;
    const minPercent = policy?.minDeductionPercent ?? 10;
    const maxPercent = policy?.maxDeductionPercent ?? 35;
    const employeeMaySet = policy?.employeeMaySetDeductionPercent ?? true;

    if (!employeeMaySet) {
      throw new ForbiddenException(
        'Your employer does not allow adjusting the deduction percent',
      );
    }
    if (
      !Number.isInteger(deductionPercent) ||
      deductionPercent < minPercent ||
      deductionPercent > maxPercent
    ) {
      throw new BadRequestException(
        `Deduction percent must be a whole number between ${minPercent}% and ${maxPercent}%`,
      );
    }

    return this.prisma.employee.update({
      where: { id: employee.id },
      data: { deductionPercent },
    });
  }
}
