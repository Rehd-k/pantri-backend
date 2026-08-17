import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { MeasureModule } from '../measure/measure.module';
import { MarketplaceAdminController } from './marketplace-admin.controller';
import { MarketplaceCatalogService } from './marketplace-catalog.service';
import { MarketplaceController } from './marketplace.controller';
import { MarketplaceReviewsService } from './marketplace-reviews.service';
import { MarketplaceService } from './marketplace.service';

@Module({
  imports: [AuthModule, MeasureModule],
  controllers: [MarketplaceController, MarketplaceAdminController],
  providers: [
    MarketplaceService,
    MarketplaceCatalogService,
    MarketplaceReviewsService,
  ],
  exports: [
    MarketplaceService,
    MarketplaceCatalogService,
    MarketplaceReviewsService,
  ],
})
export class MarketplaceModule {}
