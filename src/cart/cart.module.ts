import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { DeliverySettingsModule } from '../delivery-settings/delivery-settings.module';
import { CartController } from './cart.controller';
import { CartService } from './cart.service';

@Module({
  imports: [AuthModule, DeliverySettingsModule],
  controllers: [CartController],
  providers: [CartService],
  exports: [CartService],
})
export class CartModule {}
