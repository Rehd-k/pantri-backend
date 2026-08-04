import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  EmployeeAccountStatus,
  PayrollDeductionLineStatus,
  PayrollRun,
  PayrollRunStatus,
} from '../../generated/prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { RepaymentService } from '../credit/application/repayment.service';
import { InterestService } from '../credit/interest/interest.service';

export interface GenerateRunParams {
  employerId: string;
  periodStart: Date;
  periodEnd: Date;
  payrollDate: Date;
  idempotencyKey?: string;
}

export interface RemitLinesParams {
  payrollRunId: string;
  createdByUserId?: string;
}

export interface RemitLinesResult {
  run: PayrollRun;
  remittedCount: number;
  failedCount: number;
}

const CONFIRMABLE_STATUSES: PayrollRunStatus[] = [
  PayrollRunStatus.GENERATED,
  PayrollRunStatus.EMPLOYER_REVIEW,
];

/**
 * Orchestrates a payroll cycle for an employer: post any outstanding
 * interest accrual, snapshot each active employee's requested deduction
 * into a `PayrollRun`/`PayrollDeductionLine`, have the employer confirm it,
 * then remit each line against the credit ledger via `RepaymentService`.
 */
@Injectable()
export class PayrollService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly repayment: RepaymentService,
    private readonly interest: InterestService,
  ) {}

  async generateRun(params: GenerateRunParams): Promise<PayrollRun> {
    if (params.idempotencyKey) {
      const existing = await this.prisma.payrollRun.findFirst({
        where: {
          employerId: params.employerId,
          idempotencyKey: params.idempotencyKey,
        },
      });
      if (existing) {
        return existing;
      }
    }

    // Make sure this cycle's interest is posted before we snapshot what's owed.
    await this.interest.postMonthlyInterestForAllActiveAccounts();

    const employees = await this.prisma.employee.findMany({
      where: {
        employerId: params.employerId,
        accountStatus: EmployeeAccountStatus.ACTIVE,
      },
      include: { creditAccount: true },
    });

    return this.prisma.$transaction(async (tx) => {
      const run = await tx.payrollRun.create({
        data: {
          employerId: params.employerId,
          periodStart: params.periodStart,
          periodEnd: params.periodEnd,
          payrollDate: params.payrollDate,
          status: PayrollRunStatus.GENERATED,
          idempotencyKey: params.idempotencyKey,
        },
      });

      for (const employee of employees) {
        const account = employee.creditAccount;
        const owedKobo = account
          ? account.principalOutstandingKobo +
            account.postedInterestKobo +
            account.postedFeesKobo +
            account.postedPenaltiesKobo
          : 0;
        if (owedKobo <= 0) {
          continue;
        }

        const requestedKobo = Math.min(
          owedKobo,
          Math.floor((employee.salaryKobo * employee.deductionPercent) / 100),
        );
        if (requestedKobo <= 0) {
          continue;
        }

        await tx.payrollDeductionLine.create({
          data: {
            payrollRunId: run.id,
            employeeId: employee.id,
            salarySnapshotKobo: employee.salaryKobo,
            deductionPercentSnapshot: employee.deductionPercent,
            requestedKobo,
            status: PayrollDeductionLineStatus.PENDING,
          },
        });
      }

      return run;
    });
  }

  async confirmRun(payrollRunId: string): Promise<PayrollRun> {
    const run = await this.prisma.payrollRun.findUnique({
      where: { id: payrollRunId },
    });
    if (!run) {
      throw new NotFoundException('Payroll run not found');
    }
    if (!CONFIRMABLE_STATUSES.includes(run.status)) {
      throw new BadRequestException(
        `Cannot confirm a payroll run in status ${run.status}`,
      );
    }

    return this.prisma.payrollRun.update({
      where: { id: payrollRunId },
      data: { status: PayrollRunStatus.CONFIRMED },
    });
  }

  /** Remits every PENDING line on a CONFIRMED run against the credit ledger. */
  async remitLines(params: RemitLinesParams): Promise<RemitLinesResult> {
    const run = await this.prisma.payrollRun.findUnique({
      where: { id: params.payrollRunId },
    });
    if (!run) {
      throw new NotFoundException('Payroll run not found');
    }
    if (run.status !== PayrollRunStatus.CONFIRMED) {
      throw new BadRequestException(
        `Payroll run must be CONFIRMED before remitting (currently ${run.status})`,
      );
    }

    await this.prisma.payrollRun.update({
      where: { id: params.payrollRunId },
      data: { status: PayrollRunStatus.PROCESSING },
    });

    const lines = await this.prisma.payrollDeductionLine.findMany({
      where: {
        payrollRunId: params.payrollRunId,
        status: PayrollDeductionLineStatus.PENDING,
      },
      include: { employee: { include: { creditAccount: true } } },
    });

    let remittedCount = 0;
    let failedCount = 0;

    for (const line of lines) {
      const account = line.employee.creditAccount;
      if (!account) {
        failedCount += 1;
        continue;
      }

      try {
        await this.repayment.postRepayment({
          creditAccountId: account.id,
          amountKobo: line.requestedKobo,
          referenceType: 'PayrollDeductionLine',
          referenceId: line.id,
          createdByUserId: params.createdByUserId,
          idempotencyKey: `payroll-line:${line.id}`,
        });

        await this.prisma.payrollDeductionLine.update({
          where: { id: line.id },
          data: {
            status: PayrollDeductionLineStatus.REMITTED,
            collectedKobo: line.requestedKobo,
          },
        });
        remittedCount += 1;
      } catch {
        failedCount += 1;
      }
    }

    const finalStatus =
      failedCount === 0
        ? PayrollRunStatus.COMPLETED
        : PayrollRunStatus.PARTIALLY_COMPLETED;
    const updatedRun = await this.prisma.payrollRun.update({
      where: { id: params.payrollRunId },
      data: { status: finalStatus },
    });

    return { run: updatedRun, remittedCount, failedCount };
  }

  /** Marks any still-PENDING lines as MISSED (e.g. payroll date passed without remittance) and tracks strikes. */
  async markMissed(payrollRunId: string): Promise<{ missedCount: number }> {
    const pendingLines = await this.prisma.payrollDeductionLine.findMany({
      where: { payrollRunId, status: PayrollDeductionLineStatus.PENDING },
      include: { employee: { include: { creditAccount: true } } },
    });

    let missedCount = 0;

    await this.prisma.$transaction(async (tx) => {
      for (const line of pendingLines) {
        await tx.payrollDeductionLine.update({
          where: { id: line.id },
          data: { status: PayrollDeductionLineStatus.MISSED },
        });

        if (line.employee.creditAccount) {
          await tx.creditAccount.update({
            where: { id: line.employee.creditAccount.id },
            data: { consecutiveMissedDeductions: { increment: 1 } },
          });
        }

        missedCount += 1;
      }

      await tx.payrollRun.update({
        where: { id: payrollRunId },
        data: { status: PayrollRunStatus.PARTIALLY_COMPLETED },
      });
    });

    return { missedCount };
  }
}
