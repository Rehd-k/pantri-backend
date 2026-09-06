import { Module } from '@nestjs/common';
import { AuditModule } from '../audit/audit.module';
import { AdminCreditController } from './api/admin-credit.controller';
import { AdminWriteOffController } from './api/admin-write-off.controller';
import { CreditController } from './api/credit.controller';
import { EmployerCreditController } from './api/employer-credit.controller';
import { AdminCreditService } from './application/admin-credit.service';
import { CreditAccountService } from './application/credit-account.service';
import { EmployerCreditService } from './application/employer-credit.service';
import { ReservationService } from './application/reservation.service';
import { RepaymentService } from './application/repayment.service';
import { WriteOffService } from './application/write-off.service';
import { InterestService } from './interest/interest.service';
import { LedgerPostingService } from './ledger/ledger-posting.service';
import { CreditJobsService } from './workers/credit-jobs.service';
import { CreditSchedulerService } from './workers/credit-scheduler.service';

@Module({
  imports: [AuditModule],
  controllers: [
    CreditController,
    EmployerCreditController,
    AdminWriteOffController,
    AdminCreditController,
  ],
  providers: [
    LedgerPostingService,
    CreditAccountService,
    EmployerCreditService,
    AdminCreditService,
    ReservationService,
    RepaymentService,
    InterestService,
    WriteOffService,
    CreditJobsService,
    CreditSchedulerService,
  ],
  exports: [
    LedgerPostingService,
    CreditAccountService,
    EmployerCreditService,
    AdminCreditService,
    ReservationService,
    RepaymentService,
    InterestService,
    WriteOffService,
    CreditJobsService,
  ],
})
export class CreditModule {}
