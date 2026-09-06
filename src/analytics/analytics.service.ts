import { Injectable, Logger } from '@nestjs/common';
import {
  AnalyticsIngestionSource,
  Prisma,
} from '../../generated/prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { isKnownAnalyticsEvent } from './taxonomy/analytics-events';
import { sanitizeMetadata } from './sanitize-metadata';

export { sanitizeMetadata } from './sanitize-metadata';

export interface TrackAnalyticsInput {
  eventName: string;
  occurredAt?: Date;
  userId?: string | null;
  employeeId?: string | null;
  employerId?: string | null;
  sessionId?: string | null;
  entityType?: string | null;
  entityId?: string | null;
  platform?: string | null;
  appVersion?: string | null;
  metadata?: Record<string, unknown> | null;
  ingestionSource?: AnalyticsIngestionSource;
}

@Injectable()
export class AnalyticsService {
  private readonly logger = new Logger(AnalyticsService.name);
  private collectionStartedEnsured = false;

  constructor(private readonly prisma: PrismaService) {}

  /** Fail-soft track for server critical paths. Never throws. */
  async trackSafe(input: TrackAnalyticsInput): Promise<void> {
    try {
      await this.track(input);
    } catch (err) {
      this.logger.warn(
        `analytics track failed for ${input.eventName}: ${
          err instanceof Error ? err.message : String(err)
        }`,
      );
    }
  }

  async track(input: TrackAnalyticsInput): Promise<{ id: string } | null> {
    await this.ensureCollectionStarted();

    if (!isKnownAnalyticsEvent(input.eventName)) {
      this.logger.debug(`Ignoring unknown analytics event: ${input.eventName}`);
      return null;
    }

    const metadata = sanitizeMetadata(input.metadata ?? {});
    const occurredAt = input.occurredAt ?? new Date();
    const ingestionSource =
      input.ingestionSource ?? AnalyticsIngestionSource.SERVER;

    const row = await this.prisma.analyticsEvent.create({
      data: {
        eventName: input.eventName,
        occurredAt,
        userId: input.userId ?? undefined,
        employeeId: input.employeeId ?? undefined,
        employerId: input.employerId ?? undefined,
        sessionId: input.sessionId ?? undefined,
        entityType: input.entityType ?? undefined,
        entityId: input.entityId ?? undefined,
        platform: input.platform ?? undefined,
        appVersion: input.appVersion ?? undefined,
        metadata: metadata as Prisma.InputJsonValue,
        ingestionSource,
      },
      select: { id: true },
    });

    if (input.sessionId) {
      await this.upsertSession({
        sessionId: input.sessionId,
        userId: input.userId,
        employeeId: input.employeeId,
        employerId: input.employerId,
        platform: input.platform,
        occurredAt,
        ended: input.eventName.endsWith('.session_ended'),
      });
    }

    return row;
  }

  async trackBatch(
    events: TrackAnalyticsInput[],
  ): Promise<{ accepted: number; rejected: number }> {
    let accepted = 0;
    let rejected = 0;
    for (const event of events) {
      try {
        const result = await this.track(event);
        if (result) accepted += 1;
        else rejected += 1;
      } catch {
        rejected += 1;
      }
    }
    return { accepted, rejected };
  }

  async getCollectionStartedAt(): Promise<Date | null> {
    const settings = await this.prisma.platformSettings.findUnique({
      where: { id: 'default' },
      select: { behavioralCollectionStartedAt: true },
    });
    return settings?.behavioralCollectionStartedAt ?? null;
  }

  private async ensureCollectionStarted(): Promise<void> {
    if (this.collectionStartedEnsured) return;
    const existing = await this.prisma.platformSettings.findUnique({
      where: { id: 'default' },
    });
    if (!existing) {
      await this.prisma.platformSettings.create({
        data: {
          id: 'default',
          behavioralCollectionStartedAt: new Date(),
        },
      });
    } else if (!existing.behavioralCollectionStartedAt) {
      await this.prisma.platformSettings.update({
        where: { id: 'default' },
        data: { behavioralCollectionStartedAt: new Date() },
      });
    }
    this.collectionStartedEnsured = true;
  }

  private async upsertSession(params: {
    sessionId: string;
    userId?: string | null;
    employeeId?: string | null;
    employerId?: string | null;
    platform?: string | null;
    occurredAt: Date;
    ended: boolean;
  }): Promise<void> {
    const existing = await this.prisma.analyticsSession.findUnique({
      where: { sessionId: params.sessionId },
    });
    if (!existing) {
      await this.prisma.analyticsSession.create({
        data: {
          sessionId: params.sessionId,
          userId: params.userId ?? undefined,
          employeeId: params.employeeId ?? undefined,
          employerId: params.employerId ?? undefined,
          platform: params.platform ?? undefined,
          startedAt: params.occurredAt,
          lastSeenAt: params.occurredAt,
          endedAt: params.ended ? params.occurredAt : undefined,
          eventCount: 1,
        },
      });
      return;
    }
    await this.prisma.analyticsSession.update({
      where: { sessionId: params.sessionId },
      data: {
        lastSeenAt: params.occurredAt,
        eventCount: { increment: 1 },
        endedAt: params.ended ? params.occurredAt : existing.endedAt,
        userId: existing.userId ?? params.userId ?? undefined,
        employeeId: existing.employeeId ?? params.employeeId ?? undefined,
        employerId: existing.employerId ?? params.employerId ?? undefined,
      },
    });
  }
}
