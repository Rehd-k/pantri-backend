import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { CompaniesAdminController } from './companies-admin.controller';
import { CompaniesService } from './companies.service';

@Module({
  imports: [AuthModule],
  controllers: [CompaniesAdminController],
  providers: [CompaniesService],
  exports: [CompaniesService],
})
export class CompaniesModule {}
