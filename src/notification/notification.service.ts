import { Injectable, NotFoundException } from '@nestjs/common';
import {
  AnalyticsIngestionSource,
  Notification,
  NotificationChannel,
  NotificationDeliveryStatus,
  Prisma,
} from '../../generated/prisma/client';
import { AnalyticsService } from '../analytics/analytics.service';
import { EmployeeAnalyticsEvents } from '../analytics/taxonomy/analytics-events';
import { PrismaService } from '../prisma/prisma.service';
import { OutboxService } from './outbox.service';

export interface NotifyParams {
  userId: string;
  type: string;
  title: string;
  body: string;
  channel?: NotificationChannel;
  payload?: Record<string, unknown>;
}

/**
 * Creates in-app/push/email notifications and fans them out to the
 * transactional outbox for actual delivery, so a delivery-provider outage
 * never blocks the business transaction that triggered the notification.
 */
@Injectable()
export class NotificationService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly outbox: OutboxService,
    private readonly analytics: AnalyticsService,
  ) {}

  async notify(params: NotifyParams): Promise<Notification> {
    return this.prisma.$transaction(async (tx) => {
      const notification = await tx.notification.create({
        data: {
          userId: params.userId,
          type: params.type,
          title: params.title,
          body: params.body,
          channel: params.channel ?? NotificationChannel.IN_APP,
          payload: (params.payload ?? {}) as Prisma.InputJsonValue,
          status: NotificationDeliveryStatus.PENDING,
        },
      });

      await this.outbox.enqueue(tx, 'notification.created', {
        notificationId: notification.id,
        userId: params.userId,
        type: params.type,
        channel: notification.channel,
      });

      return notification;
    });
  }

  async markRead(
    notificationId: string,
    userId: string,
  ): Promise<Notification> {
    const notification = await this.prisma.notification.findUnique({
      where: { id: notificationId },
    });
    if (!notification || notification.userId !== userId) {
      throw new NotFoundException('Notification not found');
    }

    const updated = await this.prisma.notification.update({
      where: { id: notificationId },
      data: { readAt: new Date(), status: NotificationDeliveryStatus.SENT },
    });

    void this.analytics.trackSafe({
      eventName: EmployeeAnalyticsEvents.NOTIFICATION_OPENED,
      userId,
      entityType: 'notification',
      entityId: notificationId,
      ingestionSource: AnalyticsIngestionSource.SERVER,
      metadata: { type: notification.type },
    });

    return updated;
  }

  async listForUser(userId: string, limit = 50): Promise<Notification[]> {
    return this.prisma.notification.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      take: Math.min(Math.max(limit, 1), 200),
    });
  }
}
