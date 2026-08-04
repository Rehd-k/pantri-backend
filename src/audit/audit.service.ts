import { Injectable } from '@nestjs/common';
import { AuditLog, Prisma } from '../../generated/prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { PrismaTx } from '../prisma/prisma-tx.type';

export interface AuditLogParams {
  action: string;
  entityType: string;
  entityId?: string | null;
  actorId?: string | null;
  before?: unknown;
  after?: unknown;
  ipAddress?: string | null;
}

/**
 * Append-only audit trail. Every mutation of sensitive state (credit
 * policies, manual limit overrides, write-offs, role changes, etc.) should
 * call `log()`, ideally passing the same `tx` used for the mutation so the
 * audit row commits atomically with it.
 */
@Injectable()
export class AuditService {
  constructor(private readonly prisma: PrismaService) {}

  async log(
    params: AuditLogParams,
    tx: PrismaTx = this.prisma,
  ): Promise<AuditLog> {
    return tx.auditLog.create({
      data: {
        action: params.action,
        entityType: params.entityType,
        entityId: params.entityId ?? undefined,
        actorId: params.actorId ?? undefined,
        before: toJsonInput(params.before),
        after: toJsonInput(params.after),
        ipAddress: params.ipAddress ?? undefined,
      },
    });
  }
}

function toJsonInput(value: unknown): Prisma.InputJsonValue | undefined {
  return value === undefined ? undefined : (value as Prisma.InputJsonValue);
}
