import { Body, Controller, Get, Patch, UseGuards } from '@nestjs/common';
import { UserRole } from '../../generated/prisma/client';
import { Roles } from '../common/decorators/roles.decorator';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { DeliverySettingsService } from './delivery-settings.service';
import { DeliverySettingsResponseDto } from './dto/delivery-settings-response.dto';
import { UpdateDeliverySettingsDto } from './dto/update-delivery-settings.dto';

@Controller('admin/delivery-settings')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.ADMIN)
export class DeliverySettingsAdminController {
  constructor(
    private readonly deliverySettingsService: DeliverySettingsService,
  ) {}

  @Get()
  get(): Promise<DeliverySettingsResponseDto> {
    return this.deliverySettingsService.getSettings();
  }

  @Patch()
  update(
    @Body() dto: UpdateDeliverySettingsDto,
  ): Promise<DeliverySettingsResponseDto> {
    return this.deliverySettingsService.updateSettings(dto);
  }
}
