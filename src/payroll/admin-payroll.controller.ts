import {
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Query,
  Res,
  UseGuards,
} from '@nestjs/common';
import type { Response } from 'express';
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
import { PayrollInvoicePdfService } from './payroll-invoice-pdf.service';

@Controller('admin')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.ADMIN)
export class AdminPayrollController {
  constructor(
    private readonly adminPayroll: AdminPayrollService,
    private readonly payrollInvoicePdf: PayrollInvoicePdfService,
  ) {}

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

  @Get('payroll-runs/:id/signed-invoice.pdf')
  async signedInvoicePdf(
    @CurrentUser() user: AuthUserPayload,
    @Param('id') id: string,
    @Res() res: Response,
  ) {
    const result = await this.payrollInvoicePdf.buildSignedInvoice(id, {
      id: user.id,
      email: user.email,
      firstName: user.firstName,
      lastName: user.lastName,
    });
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="${result.filename}"`,
    );
    res.send(result.buffer);
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
