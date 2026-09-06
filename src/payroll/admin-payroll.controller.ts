import {
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import {
  PayrollRunStatus,
  UserRole,
} from '../../generated/prisma/client';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import type { AuthUserPayload } from '../common/decorators/current-user.decorator';
import { Roles } from '../common/decorators/roles.decorator';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { AdminPayrollService } from './admin-payroll.service';

@Controller('admin')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.ADMIN)
export class AdminPayrollController {
  constructor(private readonly adminPayroll: AdminPayrollService) {}

  @Get('payroll-runs')
  listRuns(
    @Query('employerId') employerId?: string,
    @Query('status') status?: PayrollRunStatus,
    @Query('from') from?: string,
    @Query('to') to?: string,
  ) {
    return this.adminPayroll.listRuns({ employerId, status, from, to });
  }

  @Get('payroll-runs/:id')
  getRun(@Param('id') id: string) {
    return this.adminPayroll.getRunDetail(id);
  }

  @Patch('payroll-runs/:id/confirm')
  confirm(@CurrentUser() user: AuthUserPayload, @Param('id') id: string) {
    return this.adminPayroll.confirmRun(id, user.id);
  }

  @Post('payroll-runs/:id/remit')
  remit(@CurrentUser() user: AuthUserPayload, @Param('id') id: string) {
    return this.adminPayroll.remitRun(id, user.id);
  }

  @Patch('payroll-runs/:id/mark-missed')
  markMissed(@CurrentUser() user: AuthUserPayload, @Param('id') id: string) {
    return this.adminPayroll.markMissed(id, user.id);
  }

  @Get('ops/summary')
  opsSummary() {
    return this.adminPayroll.getOpsSummary();
  }
}
