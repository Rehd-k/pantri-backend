import {
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import { CreditJobsService } from './credit-jobs.service';

const HOUR_MS = 60 * 60 * 1000;
const DAY_MS = 24 * HOUR_MS;

/**
 * Drives the credit engine's background jobs without pulling in
 * `@nestjs/schedule` (not a dependency of this project): reservation and
 * approval expiry run hourly, and the daily interest accrual runs once a
 * day. Every job is idempotent (see `CreditJobsService`), so overlapping or
 * missed ticks are harmless  this is a plain best-effort in-process
 * scheduler, not a durable job queue.
 */
@Injectable()
export class CreditSchedulerService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(CreditSchedulerService.name);
  private expiryTimer?: NodeJS.Timeout;
  private interestTimer?: NodeJS.Timeout;

  constructor(private readonly creditJobs: CreditJobsService) {}

  onModuleInit(): void {
    if (process.env.DISABLE_CREDIT_SCHEDULER === 'true') {
      this.logger.log('Credit scheduler disabled via DISABLE_CREDIT_SCHEDULER');
      return;
    }

    void this.runExpiryJobs();
    this.expiryTimer = setInterval(() => void this.runExpiryJobs(), HOUR_MS);

    void this.runInterestJobs();
    this.interestTimer = setInterval(() => void this.runInterestJobs(), DAY_MS);
  }

  onModuleDestroy(): void {
    if (this.expiryTimer) clearInterval(this.expiryTimer);
    if (this.interestTimer) clearInterval(this.interestTimer);
  }

  private async runExpiryJobs(): Promise<void> {
    try {
      await this.creditJobs.expireReservations();
      await this.creditJobs.expireApprovals();
    } catch (error) {
      this.logger.error('Expiry job run failed', error as Error);
    }
  }

  private async runInterestJobs(): Promise<void> {
    try {
      await this.creditJobs.accrueDailyInterest();
      await this.creditJobs.postMonthlyInterest();
    } catch (error) {
      this.logger.error('Daily interest job run failed', error as Error);
    }
  }
}
