import {
  Body,
  Controller,
  Param,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import { UserRole } from '../../../generated/prisma/client';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import type { AuthUserPayload } from '../../common/decorators/current-user.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { AdminCreditService } from '../application/admin-credit.service';
import {
  AdjustCreditDto,
  SetCreditLimitDto,
} from '../dto/admin-credit.dto';

@Controller('admin/credit')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.ADMIN)
export class AdminCreditController {
  constructor(private readonly adminCredit: AdminCreditService) {}

  @Post('employees/:employeeId/adjustments')
  async adjust(
    @CurrentUser() user: AuthUserPayload,
    @Param('employeeId') employeeId: string,
    @Body() dto: AdjustCreditDto,
  ) {
    this.adminCredit.assertCanMutateFinance(user.platformRole);
    return this.adminCredit.adjustCredit({
      employeeId,
      amountKobo: dto.amountKobo,
      reason: dto.reason,
      actorId: user.id,
      entryType: dto.entryType,
    });
  }

  @Patch('employees/:employeeId/limit')
  async setLimit(
    @CurrentUser() user: AuthUserPayload,
    @Param('employeeId') employeeId: string,
    @Body() dto: SetCreditLimitDto,
  ) {
    this.adminCredit.assertCanMutateFinance(user.platformRole);
    return this.adminCredit.setCreditLimit({
      employeeId,
      manualLimitOverrideKobo: dto.manualLimitOverrideKobo,
      reason: dto.reason,
      actorId: user.id,
    });
  }

  @Patch('employees/:employeeId/freeze')
  async freeze(
    @CurrentUser() user: AuthUserPayload,
    @Param('employeeId') employeeId: string,
  ) {
    this.adminCredit.assertCanMutateFinance(user.platformRole);
    return this.adminCredit.freezeEmployee(employeeId, user.id);
  }

  @Patch('employees/:employeeId/unfreeze')
  async unfreeze(
    @CurrentUser() user: AuthUserPayload,
    @Param('employeeId') employeeId: string,
  ) {
    this.adminCredit.assertCanMutateFinance(user.platformRole);
    return this.adminCredit.unfreezeEmployee(employeeId, user.id);
  }
}
