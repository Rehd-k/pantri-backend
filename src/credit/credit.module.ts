import { Module } from '@nestjs/common';
import { AdminWriteOffController } from './api/admin-write-off.controller';
import { CreditController } from './api/credit.controller';
import { EmployerCreditController } from './api/employer-credit.controller';
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
  controllers: [
    CreditController,
    EmployerCreditController,
    AdminWriteOffController,
  ],
  providers: [
    LedgerPostingService,
    CreditAccountService,
    EmployerCreditService,
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
    ReservationService,
    RepaymentService,
    InterestService,
    WriteOffService,
    CreditJobsService,
  ],
})
export class CreditModule {}
