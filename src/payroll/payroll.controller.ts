import {
  Body,
  Controller,
  ForbiddenException,
  Get,
  NotFoundException,
  Param,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import { UserRole } from '../../generated/prisma/client';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import type { AuthUserPayload } from '../common/decorators/current-user.decorator';
import { Roles } from '../common/decorators/roles.decorator';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { PrismaService } from '../prisma/prisma.service';
import { GeneratePayrollRunDto } from './dto/generate-payroll-run.dto';
import {
  PayrollRunDetailResponseDto,
} from './dto/payroll-run-detail-response.dto';
import {
  PayrollRunResponseDto,
  toPayrollRunResponseDto,
} from './dto/payroll-run-response.dto';
import { PayrollService } from './payroll.service';

/** Employer-facing payroll cycle management: generate a run, confirm it, then remit it against the credit ledger. */
@Controller('employer/payroll-runs')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.EMPLOYER, UserRole.ADMIN)
export class PayrollController {
  constructor(
    private readonly payrollService: PayrollService,
    private readonly prisma: PrismaService,
  ) {}

  @Get()
  async listRuns(
    @CurrentUser() user: AuthUserPayload,
  ): Promise<PayrollRunResponseDto[]> {
    const employerId = await this.resolveEmployerId(user.id);
    const runs = await this.prisma.payrollRun.findMany({
      where: { employerId },
      orderBy: { createdAt: 'desc' },
    });
    return runs.map(toPayrollRunResponseDto);
  }

  @Get(':id')
  async getRun(
    @CurrentUser() user: AuthUserPayload,
    @Param('id') id: string,
  ): Promise<PayrollRunDetailResponseDto> {
    const employerId = await this.resolveEmployerId(user.id);
    const run = await this.prisma.payrollRun.findFirst({
      where: { id, employerId },
      include: { lines: true },
    });
    if (!run) {
      throw new NotFoundException('Payroll run not found');
    }
    return {
      ...toPayrollRunResponseDto(run),
      lines: run.lines.map((line) => ({
        id: line.id,
        employeeId: line.employeeId,
        salarySnapshotKobo: line.salarySnapshotKobo,
        deductionPercentSnapshot: line.deductionPercentSnapshot,
        requestedKobo: line.requestedKobo,
        collectedKobo: line.collectedKobo,
        status: line.status,
      })),
    };
  }

  @Post()
  async generateRun(
    @CurrentUser() user: AuthUserPayload,
    @Body() dto: GeneratePayrollRunDto,
  ): Promise<PayrollRunResponseDto> {
    const employerId = await this.resolveEmployerId(user.id);
    const run = await this.payrollService.generateRun({
      employerId,
      periodStart: new Date(dto.periodStart),
      periodEnd: new Date(dto.periodEnd),
      payrollDate: new Date(dto.payrollDate),
      idempotencyKey: dto.idempotencyKey,
    });
    return toPayrollRunResponseDto(run);
  }

  @Patch(':id/confirm')
  async confirmRun(@Param('id') id: string): Promise<PayrollRunResponseDto> {
    const run = await this.payrollService.confirmRun(id);
    return toPayrollRunResponseDto(run);
  }

  @Post(':id/remit')
  async remitRun(
    @CurrentUser() user: AuthUserPayload,
    @Param('id') id: string,
  ): Promise<{
    run: PayrollRunResponseDto;
    remittedCount: number;
    failedCount: number;
  }> {
    const result = await this.payrollService.remitLines({
      payrollRunId: id,
      createdByUserId: user.id,
    });
    return {
      run: toPayrollRunResponseDto(result.run),
      remittedCount: result.remittedCount,
      failedCount: result.failedCount,
    };
  }

  @Patch(':id/mark-missed')
  async markMissed(@Param('id') id: string): Promise<{ missedCount: number }> {
    return this.payrollService.markMissed(id);
  }

  private async resolveEmployerId(userId: string): Promise<string> {
    const membership = await this.prisma.employerMembership.findFirst({
      where: { userId },
    });
    if (membership) {
      return membership.employerId;
    }

    const employer = await this.prisma.employer.findFirst({
      where: { users: { some: { id: userId } } },
    });
    if (employer) {
      return employer.id;
    }

    throw new ForbiddenException('This user is not associated with an employer');
  }
}
