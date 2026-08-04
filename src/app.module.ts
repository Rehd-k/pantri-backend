import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AdminModule } from './admin/admin.module';
import { AuditModule } from './audit/audit.module';
import { AuthModule } from './auth/auth.module';
import { CartModule } from './cart/cart.module';
import { CompaniesModule } from './companies/companies.module';
import { CreditModule } from './credit/credit.module';
import { DeliverySettingsModule } from './delivery-settings/delivery-settings.module';
import { IdentityModule } from './identity/identity.module';
import { MarketplaceModule } from './marketplace/marketplace.module';
import { MediaModule } from './media/media.module';
import { NotificationModule } from './notification/notification.module';
import { OrderModule } from './order/order.module';
import { PackagesModule } from './packages/packages.module';
import { PayrollModule } from './payroll/payroll.module';
import { PrismaModule } from './prisma/prisma.module';
import { ReportingModule } from './reporting/reporting.module';
import { RiskModule } from './risk/risk.module';
import { WishlistModule } from './wishlist/wishlist.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    PrismaModule,
    AuthModule,
    AdminModule,
    MarketplaceModule,
    CartModule,
    WishlistModule,
    MediaModule,
    PackagesModule,
    OrderModule,
    DeliverySettingsModule,
    CompaniesModule,
    AuditModule,
    RiskModule,
    CreditModule,
    IdentityModule,
    PayrollModule,
    NotificationModule,
    ReportingModule,
  ],
})
export class AppModule {}
