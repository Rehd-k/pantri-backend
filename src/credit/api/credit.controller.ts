import { Body, Controller, Get, Patch, Query, UseGuards } from '@nestjs/common';
import { UserRole } from '../../../generated/prisma/client';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import type { AuthUserPayload } from '../../common/decorators/current-user.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { CreditAccountService } from '../application/credit-account.service';
import {
  CreditAccountResponseDto,
  toCreditAccountResponseDto,
} from '../dto/credit-account-response.dto';
import {
  LedgerEntryResponseDto,
  toLedgerEntryResponseDto,
} from '../dto/ledger-entry-response.dto';
import { ListLedgerQueryDto } from '../dto/list-ledger-query.dto';
import { UpdateDeductionPercentDto } from '../dto/update-deduction-percent.dto';

@Controller('employees/me')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.EMPLOYEE)
export class CreditController {
  constructor(private readonly creditAccountService: CreditAccountService) {}

  @Get('credit-account')
  async getCreditAccount(
    @CurrentUser() user: AuthUserPayload,
  ): Promise<CreditAccountResponseDto> {
    const account = await this.creditAccountService.getAccountByUserId(user.id);
    return toCreditAccountResponseDto(account);
  }

  @Get('ledger')
  async getLedger(
    @CurrentUser() user: AuthUserPayload,
    @Query() query: ListLedgerQueryDto,
  ): Promise<LedgerEntryResponseDto[]> {
    const entries = await this.creditAccountService.listLedgerForUser(
      user.id,
      query.limit,
      query.cursor,
    );
    return entries.map(toLedgerEntryResponseDto);
  }

  @Patch('deduction-percent')
  async updateDeductionPercent(
    @CurrentUser() user: AuthUserPayload,
    @Body() dto: UpdateDeductionPercentDto,
  ): Promise<{ deductionPercent: number }> {
    const employee = await this.creditAccountService.updateDeductionPercent(
      user.id,
      dto.deductionPercent,
    );
    return { deductionPercent: employee.deductionPercent };
  }
}
