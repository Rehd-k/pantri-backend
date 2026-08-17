import {
  Body,
  Controller,
  Get,
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
import {
  AddHouseholdStockDto,
  HouseholdStockResponseDto,
  RestockAlertResponseDto,
  UpdateHouseholdStockDto,
} from './dto/inventory.dto';
import { InventoryService } from './inventory.service';

@Controller('inventory')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.EMPLOYEE)
export class InventoryController {
  constructor(private readonly inventoryService: InventoryService) {}

  @Get()
  list(
    @CurrentUser() user: AuthUserPayload,
  ): Promise<HouseholdStockResponseDto[]> {
    return this.inventoryService.listForUser(user.id);
  }

  @Get('alerts')
  alerts(
    @CurrentUser() user: AuthUserPayload,
  ): Promise<RestockAlertResponseDto[]> {
    return this.inventoryService.listAlertsForUser(user.id);
  }

  @Post()
  add(
    @CurrentUser() user: AuthUserPayload,
    @Body() dto: AddHouseholdStockDto,
  ): Promise<HouseholdStockResponseDto> {
    return this.inventoryService.addForUser(user.id, dto);
  }

  @Patch(':id')
  update(
    @CurrentUser() user: AuthUserPayload,
    @Param('id') id: string,
    @Body() dto: UpdateHouseholdStockDto,
  ): Promise<HouseholdStockResponseDto> {
    return this.inventoryService.updateForUser(user.id, id, dto);
  }

  @Post('alerts/:id/stock-up')
  stockUp(
    @CurrentUser() user: AuthUserPayload,
    @Param('id') id: string,
  ): Promise<RestockAlertResponseDto> {
    return this.inventoryService.stockUpAlert(user.id, id);
  }

  @Post('alerts/:id/dismiss')
  dismiss(
    @CurrentUser() user: AuthUserPayload,
    @Param('id') id: string,
  ): Promise<RestockAlertResponseDto> {
    return this.inventoryService.dismissAlert(user.id, id);
  }
}
