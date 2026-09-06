import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  CreditAccountStatus,
  LedgerEntryType,
  PlatformRole,
} from '../../../generated/prisma/client';
import { AuditService } from '../../audit/audit.service';
import { PrismaService } from '../../prisma/prisma.service';
import { computeAvailableKobo } from '../domain/money';
import { LedgerPostingService } from '../ledger/ledger-posting.service';
import { EmployerCreditService } from './employer-credit.service';

export interface AdjustCreditParams {
  employeeId: string;
  amountKobo: number;
  reason: string;
  actorId: string;
  entryType?: 'ADJUSTMENT' | 'MANUAL_CREDIT' | 'MANUAL_DEBIT';
}

export interface SetCreditLimitParams {
  employeeId: string;
  /** Pass null to clear the manual override and restore computed limit. */
  manualLimitOverrideKobo: number | null;
  reason: string;
  actorId: string;
}

const FINANCE_MUTATION_ROLES: Array<PlatformRole | null> = [
  null,
  PlatformRole.SUPER_ADMIN,
  PlatformRole.FINANCE_OFFICER,
];

@Injectable()
export class AdminCreditService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly ledger: LedgerPostingService,
    private readonly employerCredit: EmployerCreditService,
    private readonly audit: AuditService,
  ) {}

  /** Rejects AUDITOR (and any other non-finance platform roles) from mutating money. */
  assertCanMutateFinance(platformRole: PlatformRole | null | undefined): void {
    if (platformRole === PlatformRole.AUDITOR) {
      throw new ForbiddenException(
        'Auditors have read-only access to financial operations',
      );
    }
    if (
      platformRole !== undefined &&
      platformRole !== null &&
      !FINANCE_MUTATION_ROLES.includes(platformRole)
    ) {
      // Nutritionist platform role on an ADMIN user should not mutate credit.
      if (platformRole === PlatformRole.NUTRITIONIST) {
        throw new ForbiddenException(
          'This platform role cannot perform financial mutations',
        );
      }
    }
  }

  async adjustCredit(params: AdjustCreditParams) {
    if (params.amountKobo === 0) {
      throw new BadRequestException('Adjustment amount must be non-zero');
    }
    if (!params.reason.trim()) {
      throw new BadRequestException('Adjustment reason is required');
    }

    const employee = await this.prisma.employee.findUnique({
      where: { id: params.employeeId },
      include: { creditAccount: true },
    });
    if (!employee?.creditAccount) {
      throw new NotFoundException('Employee credit account not found');
    }

    const account = employee.creditAccount;
    const signedAmount = params.amountKobo;
    let entryType: LedgerEntryType = LedgerEntryType.ADJUSTMENT;
    if (params.entryType === 'MANUAL_CREDIT') {
      entryType = LedgerEntryType.MANUAL_CREDIT;
    } else if (params.entryType === 'MANUAL_DEBIT') {
      entryType = LedgerEntryType.MANUAL_DEBIT;
    } else if (signedAmount < 0) {
      entryType = LedgerEntryType.MANUAL_CREDIT;
    } else {
      entryType = LedgerEntryType.MANUAL_DEBIT;
    }

    // Convention: positive amountKobo increases principal owed.
    const result = await this.prisma.$transaction(async (tx) => {
      const posted = await this.ledger.post(tx, {
        creditAccountId: account.id,
        entryType,
        amountKobo: signedAmount,
        referenceType: 'AdminAdjustment',
        createdByUserId: params.actorId,
        metadata: { reason: params.reason.trim() },
        apply: (_a, e) => ({
          principalOutstandingKobo: e.amountKobo,
        }),
      });

      await this.audit.log(
        {
          action: 'credit.adjustment',
          entityType: 'CreditAccount',
          entityId: account.id,
          actorId: params.actorId,
          before: {
            principalOutstandingKobo: account.principalOutstandingKobo,
            availableKobo: account.availableKobo,
          },
          after: {
            principalOutstandingKobo: posted.account.principalOutstandingKobo,
            availableKobo: posted.account.availableKobo,
            amountKobo: signedAmount,
            reason: params.reason.trim(),
            entryType,
            ledgerEntryId: posted.entry.id,
          },
        },
        tx,
      );

      return posted;
    });

    return {
      entryId: result.entry.id,
      entryType: result.entry.entryType,
      amountKobo: result.entry.amountKobo,
      balanceAfterKobo: result.entry.balanceAfterKobo,
      availableKobo: result.account.availableKobo,
      outstandingKobo:
        result.account.principalOutstandingKobo +
        result.account.postedInterestKobo +
        result.account.postedFeesKobo +
        result.account.postedPenaltiesKobo,
    };
  }

  async setCreditLimit(params: SetCreditLimitParams) {
    if (!params.reason.trim()) {
      throw new BadRequestException('Limit change reason is required');
    }
    if (
      params.manualLimitOverrideKobo !== null &&
      params.manualLimitOverrideKobo < 0
    ) {
      throw new BadRequestException('Credit limit cannot be negative');
    }

    const employee = await this.prisma.employee.findUnique({
      where: { id: params.employeeId },
      include: { creditAccount: true },
    });
    if (!employee?.creditAccount) {
      throw new NotFoundException('Employee credit account not found');
    }

    const account = employee.creditAccount;
    const previousOverride = account.manualLimitOverrideKobo;
    const previousEffective =
      account.manualLimitOverrideKobo ?? account.creditLimitKobo;
    const nextEffective =
      params.manualLimitOverrideKobo ?? account.creditLimitKobo;

    const result = await this.prisma.$transaction(async (tx) => {
      const nextAvailable = computeAvailableKobo({
        creditLimitKobo: nextEffective,
        principalOutstandingKobo: account.principalOutstandingKobo,
        postedInterestKobo: account.postedInterestKobo,
        postedFeesKobo: account.postedFeesKobo,
        postedPenaltiesKobo: account.postedPenaltiesKobo,
        reservedKobo: account.reservedKobo,
      });

      const updated = await tx.creditAccount.update({
        where: { id: account.id },
        data: {
          manualLimitOverrideKobo: params.manualLimitOverrideKobo,
          availableKobo: nextAvailable,
          version: { increment: 1 },
        },
      });

      const deltaKobo = nextEffective - previousEffective;
      const { entry } = await this.ledger.post(tx, {
        creditAccountId: account.id,
        entryType: LedgerEntryType.CREDIT_LIMIT_ADJUSTMENT,
        amountKobo: deltaKobo,
        referenceType: 'CreditLimitOverride',
        createdByUserId: params.actorId,
        metadata: {
          reason: params.reason.trim(),
          previousOverrideKobo: previousOverride,
          nextOverrideKobo: params.manualLimitOverrideKobo,
          previousEffectiveKobo: previousEffective,
          nextEffectiveKobo: nextEffective,
        },
        // Limit changes do not move owed balances — only audit via ledger amount.
        apply: () => ({}),
      });

      await this.audit.log(
        {
          action: 'credit.limit_change',
          entityType: 'CreditAccount',
          entityId: account.id,
          actorId: params.actorId,
          before: {
            manualLimitOverrideKobo: previousOverride,
            effectiveLimitKobo: previousEffective,
          },
          after: {
            manualLimitOverrideKobo: params.manualLimitOverrideKobo,
            effectiveLimitKobo: nextEffective,
            reason: params.reason.trim(),
            ledgerEntryId: entry.id,
          },
        },
        tx,
      );

      return { updated, entry };
    });

    return {
      creditLimitKobo: result.updated.creditLimitKobo,
      manualLimitOverrideKobo: result.updated.manualLimitOverrideKobo,
      effectiveCreditLimitKobo: nextEffective,
      availableKobo: result.updated.availableKobo,
      ledgerEntryId: result.entry.id,
    };
  }

  async freezeEmployee(employeeId: string, actorId: string) {
    const employee = await this.prisma.employee.findUnique({
      where: { id: employeeId },
      include: { creditAccount: true },
    });
    if (!employee?.creditAccount) {
      throw new NotFoundException('Employee credit account not found');
    }

    await this.employerCredit.freezeEmployeeAccount(
      employee.employerId,
      employeeId,
    );

    await this.audit.log({
      action: 'credit.freeze',
      entityType: 'CreditAccount',
      entityId: employee.creditAccount.id,
      actorId,
      before: { status: employee.creditAccount.status },
      after: { status: CreditAccountStatus.FROZEN },
    });

    return { success: true as const, status: CreditAccountStatus.FROZEN };
  }

  async unfreezeEmployee(employeeId: string, actorId: string) {
    const employee = await this.prisma.employee.findUnique({
      where: { id: employeeId },
      include: { creditAccount: true },
    });
    if (!employee?.creditAccount) {
      throw new NotFoundException('Employee credit account not found');
    }

    await this.employerCredit.unfreezeEmployeeAccount(
      employee.employerId,
      employeeId,
    );

    await this.audit.log({
      action: 'credit.unfreeze',
      entityType: 'CreditAccount',
      entityId: employee.creditAccount.id,
      actorId,
      before: { status: employee.creditAccount.status },
      after: { status: CreditAccountStatus.ACTIVE },
    });

    return { success: true as const, status: CreditAccountStatus.ACTIVE };
  }
}
