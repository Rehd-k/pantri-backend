import { Module } from '@nestjs/common';
import { AnalyticsModule } from '../analytics/analytics.module';
import { AuditModule } from '../audit/audit.module';
import { CreditModule } from '../credit/credit.module';
import { AdminPayrollController } from './admin-payroll.controller';
import { AdminPayrollService } from './admin-payroll.service';
import { PayrollController } from './payroll.controller';
import { PayrollInvoicePdfService } from './payroll-invoice-pdf.service';
import { PayrollService } from './payroll.service';

@Module({
  imports: [CreditModule, AuditModule, AnalyticsModule],
  controllers: [PayrollController, AdminPayrollController],
  providers: [PayrollService, AdminPayrollService, PayrollInvoicePdfService],
  exports: [PayrollService, AdminPayrollService],
})
export class PayrollModule {}
