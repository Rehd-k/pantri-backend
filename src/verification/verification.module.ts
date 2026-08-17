import { Module } from '@nestjs/common';
import { CreditModule } from '../credit/credit.module';
import { MediaModule } from '../media/media.module';
import { AdminVerificationController } from './admin-verification.controller';
import { EmployeeInviteService } from './employee-invite.service';
import { EmployeeVerificationService } from './employee-verification.service';
import { EmployerVerificationController } from './employer-verification.controller';

@Module({
  imports: [CreditModule, MediaModule],
  controllers: [EmployerVerificationController, AdminVerificationController],
  providers: [EmployeeInviteService, EmployeeVerificationService],
  exports: [EmployeeInviteService, EmployeeVerificationService],
})
export class VerificationModule {}
