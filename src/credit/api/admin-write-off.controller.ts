import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { UserRole, WriteOffStatus } from '../../../generated/prisma/client';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import type { AuthUserPayload } from '../../common/decorators/current-user.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { WriteOffService } from '../application/write-off.service';
import { RequestWriteOffDto } from '../dto/request-write-off.dto';
import {
  WriteOffResponseDto,
  toWriteOffResponseDto,
} from '../dto/write-off-response.dto';

/**
 * Admin-only workflow for writing off uncollectable balances: an operator
 * requests a write-off against an employee's credit account, and a
 * different admin must approve it (dual approval) before the WRITE_OFF
 * ledger entry is posted, or rejects it outright.
 */
@Controller('admin/write-offs')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.ADMIN)
export class AdminWriteOffController {
  constructor(private readonly writeOffs: WriteOffService) {}

  @Get()
  async list(
    @Query('status') status?: WriteOffStatus,
  ): Promise<WriteOffResponseDto[]> {
    const requests = await this.writeOffs.list(status);
    return requests.map(toWriteOffResponseDto);
  }

  @Post()
  async request(
    @CurrentUser() user: AuthUserPayload,
    @Body() dto: RequestWriteOffDto,
  ): Promise<WriteOffResponseDto> {
    const request = await this.writeOffs.requestWriteOff({
      accountId: dto.creditAccountId,
      amountKobo: dto.amountKobo,
      reason: dto.reason,
      requesterId: user.id,
    });
    return toWriteOffResponseDto(request);
  }

  @Post(':id/approve')
  async approve(
    @CurrentUser() user: AuthUserPayload,
    @Param('id') id: string,
  ): Promise<WriteOffResponseDto> {
    const request = await this.writeOffs.approveWriteOff(id, user.id);
    return toWriteOffResponseDto(request);
  }

  @Post(':id/reject')
  async reject(
    @CurrentUser() user: AuthUserPayload,
    @Param('id') id: string,
  ): Promise<WriteOffResponseDto> {
    const request = await this.writeOffs.rejectWriteOff(id, user.id);
    return toWriteOffResponseDto(request);
  }
}
