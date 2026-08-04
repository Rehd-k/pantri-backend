import { Module } from '@nestjs/common';
import { CreditModule } from '../credit/credit.module';
import { EmployeeService } from './employee.service';

@Module({
  imports: [CreditModule],
  providers: [EmployeeService],
  exports: [EmployeeService],
})
export class IdentityModule {}
