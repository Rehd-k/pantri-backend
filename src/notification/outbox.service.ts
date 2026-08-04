import { Injectable } from '@nestjs/common';
import {
  OutboxEvent,
  OutboxEventStatus,
  Prisma,
} from '../../generated/prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { PrismaTx } from '../prisma/prisma-tx.type';

const MAX_ERROR_LENGTH = 2_000;

/**
 * Transactional outbox: domain services enqueue events using the same `tx`
 * as their business write, guaranteeing the event is recorded if and only
 * if the write committed. A separate worker (not included here) polls
 * `fetchPendingBatch` and dispatches events (push/email/webhooks/etc), then
 * reports back via `markProcessed`/`markFailed`.
 */
@Injectable()
export class OutboxService {
  constructor(private readonly prisma: PrismaService) {}

  async enqueue(
    tx: PrismaTx,
    type: string,
    payload: Record<string, unknown>,
  ): Promise<OutboxEvent> {
    return tx.outboxEvent.create({
      data: {
        type,
        payload: payload as Prisma.InputJsonValue,
        status: OutboxEventStatus.PENDING,
      },
    });
  }

  async fetchPendingBatch(limit = 50): Promise<OutboxEvent[]> {
    return this.prisma.outboxEvent.findMany({
      where: { status: OutboxEventStatus.PENDING },
      orderBy: { createdAt: 'asc' },
      take: limit,
    });
  }

  async markProcessed(id: string): Promise<void> {
    await this.prisma.outboxEvent.update({
      where: { id },
      data: { status: OutboxEventStatus.PROCESSED, processedAt: new Date() },
    });
  }

  async markFailed(id: string, error: string): Promise<void> {
    await this.prisma.outboxEvent.update({
      where: { id },
      data: {
        status: OutboxEventStatus.FAILED,
        attempts: { increment: 1 },
        lastError: error.slice(0, MAX_ERROR_LENGTH),
      },
    });
  }
}
