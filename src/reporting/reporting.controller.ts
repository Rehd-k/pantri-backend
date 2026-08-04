import { Controller, Get, Header, UseGuards } from '@nestjs/common';
import { UserRole } from '../../generated/prisma/client';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import type { AuthUserPayload } from '../common/decorators/current-user.decorator';
import { Roles } from '../common/decorators/roles.decorator';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { EmployerBalanceSummaryDto } from './dto/employer-balance-summary.dto';
import { EmployerExposureBreakdownDto } from './dto/employer-exposure-breakdown.dto';
import { ReportingService } from './reporting.service';

@Controller('employers/me/reporting')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.EMPLOYER, UserRole.ADMIN)
export class ReportingController {
  constructor(private readonly reporting: ReportingService) {}

  @Get('balance-summary')
  async getBalanceSummary(
    @CurrentUser() user: AuthUserPayload,
  ): Promise<EmployerBalanceSummaryDto> {
    const { employerId } = await this.reporting.resolveEmployerContext(user.id);
    return this.reporting.getEmployerBalanceSummary(employerId);
  }

  @Get('exposure')
  async getExposure(
    @CurrentUser() user: AuthUserPayload,
  ): Promise<EmployerExposureBreakdownDto> {
    const { employerId } = await this.reporting.resolveEmployerContext(user.id);
    return this.reporting.getEmployerExposureBreakdown(employerId);
  }

  @Get('balances.csv')
  @Header('Content-Type', 'text/csv')
  @Header('Content-Disposition', 'attachment; filename="employer-balances.csv"')
  async exportBalancesCsv(
    @CurrentUser() user: AuthUserPayload,
  ): Promise<string> {
    const { employerId } = await this.reporting.resolveEmployerContext(user.id);
    return this.reporting.exportEmployerBalancesCsv(employerId);
  }
}
