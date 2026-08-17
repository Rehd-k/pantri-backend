import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { CreditModule } from '../credit/credit.module';
import {
  AdminCompanyInvoiceController,
  EmployerCompanyInvoiceController,
} from './company-invoice.controller';
import { CompanyInvoiceService } from './company-invoice.service';
import { CompaniesAdminController } from './companies-admin.controller';
import { CompaniesService } from './companies.service';

@Module({
  imports: [AuthModule, CreditModule],
  controllers: [
    CompaniesAdminController,
    AdminCompanyInvoiceController,
    EmployerCompanyInvoiceController,
  ],
  providers: [CompaniesService, CompanyInvoiceService],
  exports: [CompaniesService],
})
export class CompaniesModule {}
