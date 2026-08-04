import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  LedgerEntryType,
  Prisma,
  WriteOffStatus,
} from '../../../generated/prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { computeTotalOwedKobo } from '../domain/money';
import {
  LedgerBalanceDelta,
  LedgerPostingService,
} from '../ledger/ledger-posting.service';

export interface RequestWriteOffParams {
  accountId: string;
  amountKobo: number;
  reason: string;
  requesterId: string;
}

const WRITE_OFF_RELATIONS_INCLUDE = {
  creditAccount: {
    include: { employee: { include: { user: true, employer: true } } },
  },
  requestedBy: true,
  approvedBy: true,
} satisfies Prisma.WriteOffRequestInclude;

export type WriteOffWithRelations = Prisma.WriteOffRequestGetPayload<{
  include: typeof WRITE_OFF_RELATIONS_INCLUDE;
}>;

/**
 * Write-offs of uncollectable balances require dual approval: whoever
 * requests a write-off cannot also approve it. Approval posts a single
 * `WRITE_OFF` ledger entry, allocated across owed buckets in the same
 * waterfall order as a repayment (interest → fees → penalties → principal),
 * so it works correctly even when the amount exceeds just principal.
 */
@Injectable()
export class WriteOffService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly ledger: LedgerPostingService,
  ) {}

  async list(status?: WriteOffStatus): Promise<WriteOffWithRelations[]> {
    return this.prisma.writeOffRequest.findMany({
      where: status ? { status } : undefined,
      include: WRITE_OFF_RELATIONS_INCLUDE,
      orderBy: { createdAt: 'desc' },
    });
  }

  async requestWriteOff(
    params: RequestWriteOffParams,
  ): Promise<WriteOffWithRelations> {
    if (params.amountKobo <= 0) {
      throw new BadRequestException('Write-off amount must be positive');
    }

    const account = await this.prisma.creditAccount.findUnique({
      where: { id: params.accountId },
    });
    if (!account) {
      throw new NotFoundException('Credit account not found');
    }

    const owedKobo = computeTotalOwedKobo(account);
    if (params.amountKobo > owedKobo) {
      throw new BadRequestException(
        'Write-off amount exceeds the total amount owed on this account',
      );
    }

    const request = await this.prisma.writeOffRequest.create({
      data: {
        creditAccountId: params.accountId,
        amountKobo: params.amountKobo,
        reason: params.reason,
        status: WriteOffStatus.PENDING,
        requestedById: params.requesterId,
      },
    });

    return this.reload(request.id);
  }

  /** Dual-approval gate: the approver must differ from the original requester. */
  async approveWriteOff(
    requestId: string,
    approverId: string,
  ): Promise<WriteOffWithRelations> {
    await this.prisma.$transaction(async (tx) => {
      const request = await tx.writeOffRequest.findUnique({
        where: { id: requestId },
      });
      if (!request) {
        throw new NotFoundException('Write-off request not found');
      }
      if (request.status !== WriteOffStatus.PENDING) {
        throw new BadRequestException(
          `Write-off request is already ${request.status.toLowerCase()}`,
        );
      }
      if (request.requestedById === approverId) {
        throw new ForbiddenException(
          'The requester cannot also approve their own write-off; dual approval is required',
        );
      }

      let account = await tx.creditAccount.findUnique({
        where: { id: request.creditAccountId },
      });
      if (!account) {
        throw new NotFoundException('Credit account not found');
      }

      let remaining = request.amountKobo;
      let lastEntryId: string | null = null;

      const applyStep = async (
        bucketKobo: number,
        applyDelta: (negativeAmountKobo: number) => LedgerBalanceDelta,
        suffix: string,
      ): Promise<void> => {
        const applied = Math.min(remaining, Math.max(0, bucketKobo));
        if (applied <= 0) return;

        const { entry, account: nextAccount } = await this.ledger.post(tx, {
          creditAccountId: account!.id,
          entryType: LedgerEntryType.WRITE_OFF,
          amountKobo: -applied,
          referenceType: 'WriteOffRequest',
          referenceId: request.id,
          createdByUserId: approverId,
          idempotencyKey: `write-off:${request.id}:${suffix}`,
          apply: () => applyDelta(-applied),
        });

        account = nextAccount;
        lastEntryId = entry.id;
        remaining -= applied;
      };

      await applyStep(
        account.postedInterestKobo,
        (amt) => ({ postedInterestKobo: amt }),
        'interest',
      );
      await applyStep(
        account.postedFeesKobo,
        (amt) => ({ postedFeesKobo: amt }),
        'fees',
      );
      await applyStep(
        account.postedPenaltiesKobo,
        (amt) => ({ postedPenaltiesKobo: amt }),
        'penalties',
      );
      await applyStep(
        account.principalOutstandingKobo,
        (amt) => ({ principalOutstandingKobo: amt }),
        'principal',
      );

      if (remaining > 0) {
        // The account's owed balance shrank (e.g. a repayment landed) since
        // this write-off was requested; fail closed rather than write off
        // more than is actually owed.
        throw new ConflictException(
          'Account balance changed since this write-off was requested; amount now exceeds what is owed',
        );
      }

      await tx.writeOffRequest.update({
        where: { id: requestId },
        data: {
          status: WriteOffStatus.EXECUTED,
          approvedById: approverId,
          ledgerEntryId: lastEntryId,
        },
      });
    });

    return this.reload(requestId);
  }

  async rejectWriteOff(
    requestId: string,
    approverId: string,
  ): Promise<WriteOffWithRelations> {
    const request = await this.prisma.writeOffRequest.findUnique({
      where: { id: requestId },
    });
    if (!request) {
      throw new NotFoundException('Write-off request not found');
    }
    if (request.status !== WriteOffStatus.PENDING) {
      throw new BadRequestException(
        `Write-off request is already ${request.status.toLowerCase()}`,
      );
    }

    await this.prisma.writeOffRequest.update({
      where: { id: requestId },
      data: { status: WriteOffStatus.REJECTED, approvedById: approverId },
    });

    return this.reload(requestId);
  }

  private async reload(id: string): Promise<WriteOffWithRelations> {
    return this.prisma.writeOffRequest.findUniqueOrThrow({
      where: { id },
      include: WRITE_OFF_RELATIONS_INCLUDE,
    });
  }
}
