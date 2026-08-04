import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { CartModule } from '../cart/cart.module';
import { MediaModule } from '../media/media.module';
import { PackagePricingService } from './package-pricing.service';
import { PackagesAdminController } from './packages-admin.controller';
import { PackagesController } from './packages.controller';
import { PackagesService } from './packages.service';

@Module({
  imports: [AuthModule, CartModule, MediaModule],
  controllers: [PackagesController, PackagesAdminController],
  providers: [PackagesService, PackagePricingService],
  exports: [PackagesService, PackagePricingService],
})
export class PackagesModule {}
