import { Body, Controller, Get, Param, Post, UseGuards } from '@nestjs/common';
import { UserRole } from '../../generated/prisma/client';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import type { AuthUserPayload } from '../common/decorators/current-user.decorator';
import { Roles } from '../common/decorators/roles.decorator';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import {
  ApproveEmployeeVerificationDto,
  RejectEmployeeVerificationDto,
} from './dto/verification.dto';
import { EmployeeVerificationResponseDto } from './dto/verification-response.dto';
import { EmployeeVerificationService } from './employee-verification.service';

@Controller('admin/verification')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.ADMIN)
export class AdminVerificationController {
  constructor(private readonly verification: EmployeeVerificationService) {}

  @Get('employees')
  listPending(): Promise<EmployeeVerificationResponseDto[]> {
    return this.verification.listPendingForAdmin();
  }

  @Get('employees/:employeeId')
  getEmployee(
    @Param('employeeId') employeeId: string,
  ): Promise<EmployeeVerificationResponseDto> {
    return this.verification.getEmployee(employeeId);
  }

  @Post('employees/:employeeId/approve')
  approve(
    @CurrentUser() user: AuthUserPayload,
    @Param('employeeId') employeeId: string,
    @Body() dto: ApproveEmployeeVerificationDto,
  ): Promise<EmployeeVerificationResponseDto> {
    return this.verification.approve(employeeId, user.id, dto);
  }

  @Post('employees/:employeeId/reject')
  reject(
    @CurrentUser() user: AuthUserPayload,
    @Param('employeeId') employeeId: string,
    @Body() dto: RejectEmployeeVerificationDto,
  ): Promise<EmployeeVerificationResponseDto> {
    return this.verification.reject(employeeId, user.id, dto);
  }
}
