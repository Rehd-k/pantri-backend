import {
  Notification,
  NotificationChannel,
  NotificationDeliveryStatus,
} from '../../../generated/prisma/client';

export class NotificationResponseDto {
  id!: string;
  type!: string;
  title!: string;
  body!: string;
  channel!: NotificationChannel;
  status!: NotificationDeliveryStatus;
  payload!: Record<string, unknown>;
  readAt!: string | null;
  createdAt!: string;
}

export function toNotificationResponseDto(
  notification: Notification,
): NotificationResponseDto {
  return {
    id: notification.id,
    type: notification.type,
    title: notification.title,
    body: notification.body,
    channel: notification.channel,
    status: notification.status,
    payload: (notification.payload ?? {}) as Record<string, unknown>,
    readAt: notification.readAt ? notification.readAt.toISOString() : null,
    createdAt: notification.createdAt.toISOString(),
  };
}
