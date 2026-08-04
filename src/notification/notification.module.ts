import { Module } from '@nestjs/common';
import { NotificationController } from './notification.controller';
import { NotificationService } from './notification.service';
import { OutboxService } from './outbox.service';

@Module({
  controllers: [NotificationController],
  providers: [OutboxService, NotificationService],
  exports: [OutboxService, NotificationService],
})
export class NotificationModule {}
