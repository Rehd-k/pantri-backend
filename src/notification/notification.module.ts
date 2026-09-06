import { Module, forwardRef } from '@nestjs/common';
import { AnalyticsModule } from '../analytics/analytics.module';
import { PrismaModule } from '../prisma/prisma.module';
import { NotificationController } from './notification.controller';
import { NotificationService } from './notification.service';
import { OutboxService } from './outbox.service';

@Module({
  imports: [PrismaModule, forwardRef(() => AnalyticsModule)],
  controllers: [NotificationController],
  providers: [OutboxService, NotificationService],
  exports: [OutboxService, NotificationService],
})
export class NotificationModule {}
