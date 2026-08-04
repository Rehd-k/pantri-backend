import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { CreditModule } from '../credit/credit.module';
import { DeliverySettingsModule } from '../delivery-settings/delivery-settings.module';
import { IdentityModule } from '../identity/identity.module';
import { RiskModule } from '../risk/risk.module';
import { OrderOpsController } from './order-ops.controller';
import { OrderController } from './order.controller';
import { OrderService } from './order.service';

@Module({
  imports: [
    AuthModule,
    DeliverySettingsModule,
    CreditModule,
    RiskModule,
    IdentityModule,
  ],
  controllers: [OrderController, OrderOpsController],
  providers: [OrderService],
  exports: [OrderService],
})
export class OrderModule {}
