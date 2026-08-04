import { Body, Controller, Get, Param, Patch, UseGuards } from '@nestjs/common';
import { UserRole } from '../../../generated/prisma/client';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import type { AuthUserPayload } from '../../common/decorators/current-user.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { EmployerCreditService } from '../application/employer-credit.service';
import {
  CreditPolicyResponseDto,
  toCreditPolicyResponseDto,
} from '../dto/credit-policy-response.dto';
import {
  EmployerEmployeeResponseDto,
  toEmployerEmployeeResponseDto,
} from '../dto/employer-employee-response.dto';
import { UpdateCreditPolicyDto } from '../dto/update-credit-policy.dto';

/** Employer-facing controls over the credit engine: policy configuration and per-employee account freezes. */
@Controller('employer/credit')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.EMPLOYER, UserRole.ADMIN)
export class EmployerCreditController {
  constructor(private readonly employerCredit: EmployerCreditService) {}

  @Get('policy')
  async getPolicy(
    @CurrentUser() user: AuthUserPayload,
  ): Promise<CreditPolicyResponseDto> {
    const employerId = await this.employerCredit.resolveEmployerId(user.id);
    const policy = await this.employerCredit.getPolicy(employerId);
    return toCreditPolicyResponseDto(policy);
  }

  @Patch('policy')
  async updatePolicy(
    @CurrentUser() user: AuthUserPayload,
    @Body() dto: UpdateCreditPolicyDto,
  ): Promise<CreditPolicyResponseDto> {
    const employerId = await this.employerCredit.resolveEmployerId(user.id);
    const policy = await this.employerCredit.updatePolicy(employerId, dto);
    return toCreditPolicyResponseDto(policy);
  }

  @Get('employees')
  async listEmployees(
    @CurrentUser() user: AuthUserPayload,
  ): Promise<EmployerEmployeeResponseDto[]> {
    const employerId = await this.employerCredit.resolveEmployerId(user.id);
    const employees = await this.employerCredit.listEmployees(employerId);
    return employees.map(toEmployerEmployeeResponseDto);
  }

  @Patch('employees/:employeeId/freeze')
  async freezeEmployee(
    @CurrentUser() user: AuthUserPayload,
    @Param('employeeId') employeeId: string,
  ): Promise<{ success: true }> {
    const employerId = await this.employerCredit.resolveEmployerId(user.id);
    await this.employerCredit.freezeEmployeeAccount(employerId, employeeId);
    return { success: true };
  }

  @Patch('employees/:employeeId/unfreeze')
  async unfreezeEmployee(
    @CurrentUser() user: AuthUserPayload,
    @Param('employeeId') employeeId: string,
  ): Promise<{ success: true }> {
    const employerId = await this.employerCredit.resolveEmployerId(user.id);
    await this.employerCredit.unfreezeEmployeeAccount(employerId, employeeId);
    return { success: true };
  }
}
