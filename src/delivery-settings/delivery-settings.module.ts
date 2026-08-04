import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { DeliverySettingsAdminController } from './delivery-settings-admin.controller';
import { DeliverySettingsService } from './delivery-settings.service';

@Module({
  imports: [AuthModule],
  controllers: [DeliverySettingsAdminController],
  providers: [DeliverySettingsService],
  exports: [DeliverySettingsService],
})
export class DeliverySettingsModule {}
