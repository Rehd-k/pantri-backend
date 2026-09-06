import { Injectable, NotFoundException } from '@nestjs/common';
import {
  CreditAccountStatus,
  LedgerEntryType,
  OrderFulfillmentStatus,
  PayrollDeductionLineStatus,
  PayrollRunStatus,
  Prisma,
  WriteOffStatus,
} from '../../generated/prisma/client';
import { AuditService } from '../audit/audit.service';
import { AdminCreditService } from '../credit/application/admin-credit.service';
import { PrismaService } from '../prisma/prisma.service';
import { PayrollService } from './payroll.service';

export interface ListAdminPayrollRunsQuery {
  employerId?: string;
  status?: PayrollRunStatus;
  from?: string;
  to?: string;
}

@Injectable()
export class AdminPayrollService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly payroll: PayrollService,
    private readonly audit: AuditService,
    private readonly adminCredit: AdminCreditService,
  ) {}

  async listRuns(query: ListAdminPayrollRunsQuery) {
    const where: Prisma.PayrollRunWhereInput = {
      ...(query.employerId ? { employerId: query.employerId } : {}),
      ...(query.status ? { status: query.status } : {}),
      ...(query.from || query.to
        ? {
            payrollDate: {
              ...(query.from ? { gte: new Date(query.from) } : {}),
              ...(query.to ? { lte: new Date(query.to) } : {}),
            },
          }
        : {}),
    };

    const runs = await this.prisma.payrollRun.findMany({
      where,
      include: {
        employer: { select: { id: true, name: true } },
        lines: {
          select: {
            requestedKobo: true,
            collectedKobo: true,
            status: true,
          },
        },
      },
      orderBy: { payrollDate: 'desc' },
      take: 100,
    });

    return runs.map((run) => {
      const expectedKobo = run.lines.reduce((s, l) => s + l.requestedKobo, 0);
      const receivedKobo = run.lines.reduce((s, l) => s + l.collectedKobo, 0);
      const pendingCount = run.lines.filter(
        (l) => l.status === PayrollDeductionLineStatus.PENDING,
      ).length;
      const missedCount = run.lines.filter(
        (l) => l.status === PayrollDeductionLineStatus.MISSED,
      ).length;
      const remittedCount = run.lines.filter(
        (l) => l.status === PayrollDeductionLineStatus.REMITTED,
      ).length;

      return {
        id: run.id,
        employerId: run.employerId,
        employerName: run.employer.name,
        periodStart: run.periodStart.toISOString(),
        periodEnd: run.periodEnd.toISOString(),
        payrollDate: run.payrollDate.toISOString(),
        status: run.status,
        lineCount: run.lines.length,
        expectedKobo,
        receivedKobo,
        differenceKobo: expectedKobo - receivedKobo,
        pendingCount,
        missedCount,
        remittedCount,
        createdAt: run.createdAt.toISOString(),
      };
    });
  }

  async getRunDetail(id: string) {
    const run = await this.prisma.payrollRun.findUnique({
      where: { id },
      include: {
        employer: { select: { id: true, name: true } },
        lines: {
          include: {
            employee: {
              include: {
                user: {
                  select: { firstName: true, lastName: true, email: true },
                },
              },
            },
          },
          orderBy: { createdAt: 'asc' },
        },
      },
    });
    if (!run) {
      throw new NotFoundException('Payroll run not found');
    }

    const expectedKobo = run.lines.reduce((s, l) => s + l.requestedKobo, 0);
    const receivedKobo = run.lines.reduce((s, l) => s + l.collectedKobo, 0);

    return {
      id: run.id,
      employerId: run.employerId,
      employerName: run.employer.name,
      periodStart: run.periodStart.toISOString(),
      periodEnd: run.periodEnd.toISOString(),
      payrollDate: run.payrollDate.toISOString(),
      status: run.status,
      expectedKobo,
      receivedKobo,
      differenceKobo: expectedKobo - receivedKobo,
      createdAt: run.createdAt.toISOString(),
      lines: run.lines.map((line) => ({
        id: line.id,
        employeeId: line.employeeId,
        employeeName:
          `${line.employee.user.firstName} ${line.employee.user.lastName}`.trim(),
        employeeEmail: line.employee.user.email,
        salarySnapshotKobo: line.salarySnapshotKobo,
        deductionPercentSnapshot: line.deductionPercentSnapshot,
        expectedKobo: line.requestedKobo,
        actualKobo: line.collectedKobo,
        differenceKobo: line.requestedKobo - line.collectedKobo,
        status: line.status,
        ledgerEntryId: line.ledgerEntryId,
        createdAt: line.createdAt.toISOString(),
      })),
    };
  }

  async confirmRun(id: string, actorId: string) {
    this.adminCredit.assertCanMutateFinance(
      await this.loadPlatformRole(actorId),
    );
    const run = await this.payroll.confirmRun(id);
    await this.audit.log({
      action: 'payroll.confirm',
      entityType: 'PayrollRun',
      entityId: id,
      actorId,
      after: { status: run.status },
    });
    return this.getRunDetail(id);
  }

  async remitRun(id: string, actorId: string) {
    this.adminCredit.assertCanMutateFinance(
      await this.loadPlatformRole(actorId),
    );
    const result = await this.payroll.remitLines({
      payrollRunId: id,
      createdByUserId: actorId,
    });
    await this.audit.log({
      action: 'payroll.remit',
      entityType: 'PayrollRun',
      entityId: id,
      actorId,
      after: {
        status: result.run.status,
        remittedCount: result.remittedCount,
        failedCount: result.failedCount,
      },
    });
    return {
      ...(await this.getRunDetail(id)),
      remittedCount: result.remittedCount,
      failedCount: result.failedCount,
    };
  }

  async markMissed(id: string, actorId: string) {
    this.adminCredit.assertCanMutateFinance(
      await this.loadPlatformRole(actorId),
    );
    const result = await this.payroll.markMissed(id);
    await this.audit.log({
      action: 'payroll.mark_missed',
      entityType: 'PayrollRun',
      entityId: id,
      actorId,
      after: { missedCount: result.missedCount },
    });
    return {
      ...(await this.getRunDetail(id)),
      missedCount: result.missedCount,
    };
  }

  async getOpsSummary() {
    const periodStart = new Date();
    periodStart.setUTCDate(1);
    periodStart.setUTCHours(0, 0, 0, 0);

    const [
      activeEmployees,
      accounts,
      purchaseAgg,
      openRuns,
      missedLines,
      frozenAccounts,
      pendingWriteOffs,
      attentionOrders,
      highUtilAccounts,
    ] = await Promise.all([
      this.prisma.employee.count({
        where: { accountStatus: 'ACTIVE' },
      }),
      this.prisma.creditAccount.findMany({
        select: {
          principalOutstandingKobo: true,
          postedInterestKobo: true,
          postedFeesKobo: true,
          postedPenaltiesKobo: true,
          reservedKobo: true,
          creditLimitKobo: true,
          manualLimitOverrideKobo: true,
          availableKobo: true,
        },
      }),
      this.prisma.ledgerEntry.aggregate({
        where: {
          entryType: LedgerEntryType.PURCHASE_POSTED,
          createdAt: { gte: periodStart },
        },
        _sum: { amountKobo: true },
      }),
      this.prisma.payrollRun.findMany({
        where: {
          status: {
            in: [
              PayrollRunStatus.GENERATED,
              PayrollRunStatus.EMPLOYER_REVIEW,
              PayrollRunStatus.CONFIRMED,
              PayrollRunStatus.PROCESSING,
              PayrollRunStatus.PARTIALLY_COMPLETED,
            ],
          },
        },
        include: {
          lines: {
            select: {
              requestedKobo: true,
              collectedKobo: true,
              status: true,
            },
          },
        },
        take: 50,
        orderBy: { payrollDate: 'desc' },
      }),
      this.prisma.payrollDeductionLine.count({
        where: { status: PayrollDeductionLineStatus.MISSED },
      }),
      this.prisma.creditAccount.count({
        where: { status: CreditAccountStatus.FROZEN },
      }),
      this.prisma.writeOffRequest.count({
        where: { status: WriteOffStatus.PENDING },
      }),
      this.prisma.order.count({
        where: {
          fulfillmentStatus: {
            in: [
              OrderFulfillmentStatus.PENDING_APPROVAL,
              OrderFulfillmentStatus.APPROVED,
              OrderFulfillmentStatus.PROCESSING,
              OrderFulfillmentStatus.OUT_FOR_DELIVERY,
              OrderFulfillmentStatus.READY_FOR_PICKUP,
            ],
          },
        },
      }),
      this.prisma.creditAccount.findMany({
        select: {
          principalOutstandingKobo: true,
          postedInterestKobo: true,
          postedFeesKobo: true,
          postedPenaltiesKobo: true,
          reservedKobo: true,
          creditLimitKobo: true,
          manualLimitOverrideKobo: true,
        },
      }),
    ]);

    const totalOutstandingKobo = accounts.reduce(
      (sum, a) =>
        sum +
        a.principalOutstandingKobo +
        a.postedInterestKobo +
        a.postedFeesKobo +
        a.postedPenaltiesKobo,
      0,
    );

    let expectedPayrollKobo = 0;
    let receivedPayrollKobo = 0;
    for (const run of openRuns) {
      for (const line of run.lines) {
        expectedPayrollKobo += line.requestedKobo;
        receivedPayrollKobo += line.collectedKobo;
      }
    }

    const highUtilizationCount = highUtilAccounts.filter((a) => {
      const limit = a.manualLimitOverrideKobo ?? a.creditLimitKobo;
      if (limit <= 0) return false;
      const committed =
        a.principalOutstandingKobo +
        a.postedInterestKobo +
        a.postedFeesKobo +
        a.postedPenaltiesKobo +
        a.reservedKobo;
      return committed / limit >= 0.9;
    }).length;

    const attentionItems: Array<{
      type: string;
      count: number;
      href: string;
      label: string;
    }> = [];

    if (missedLines > 0) {
      attentionItems.push({
        type: 'missed_deductions',
        count: missedLines,
        href: '/payroll',
        label: 'Missed payroll deductions',
      });
    }
    if (pendingWriteOffs > 0) {
      attentionItems.push({
        type: 'write_offs',
        count: pendingWriteOffs,
        href: '/write-offs',
        label: 'Write-offs awaiting approval',
      });
    }
    if (frozenAccounts > 0) {
      attentionItems.push({
        type: 'frozen_accounts',
        count: frozenAccounts,
        href: '/companies',
        label: 'Frozen credit accounts',
      });
    }
    if (attentionOrders > 0) {
      attentionItems.push({
        type: 'orders',
        count: attentionOrders,
        href: '/orders',
        label: 'Orders requiring attention',
      });
    }
    if (highUtilizationCount > 0) {
      attentionItems.push({
        type: 'high_utilization',
        count: highUtilizationCount,
        href: '/companies',
        label: 'Employees at ≥90% credit utilization',
      });
    }

    return {
      activeEmployees,
      totalOutstandingKobo,
      purchasesThisPeriodKobo: purchaseAgg._sum.amountKobo ?? 0,
      expectedPayrollKobo,
      receivedPayrollKobo,
      payrollDifferenceKobo: expectedPayrollKobo - receivedPayrollKobo,
      missedDeductionLines: missedLines,
      frozenAccounts,
      pendingWriteOffs,
      ordersRequiringAttention: attentionOrders,
      highUtilizationAccounts: highUtilizationCount,
      attentionItems,
      periodStart: periodStart.toISOString(),
    };
  }

  private async loadPlatformRole(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { platformRole: true },
    });
    return user?.platformRole ?? null;
  }
}
