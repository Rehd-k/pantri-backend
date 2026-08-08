import {
  Body,
  Controller,
  Get,
  NotFoundException,
  Put,
  UseGuards,
} from '@nestjs/common';
import { UserRole } from '../../generated/prisma/client';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import type { AuthUserPayload } from '../common/decorators/current-user.decorator';
import { Roles } from '../common/decorators/roles.decorator';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { NutritionCatalogResponseDto } from './dto/catalog.dto';
import {
  HealthProfileResponseDto,
  UpsertHealthProfileDto,
} from './dto/health-profile.dto';
import { NutritionCatalogService } from './nutrition-catalog.service';

@Controller('nutrition')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.EMPLOYEE)
export class NutritionController {
  constructor(private readonly catalogService: NutritionCatalogService) {}

  @Get('catalog')
  getCatalog(): Promise<NutritionCatalogResponseDto> {
    return this.catalogService.getPublicCatalog();
  }

  @Get('profile')
  async getProfile(
    @CurrentUser() user: AuthUserPayload,
  ): Promise<HealthProfileResponseDto> {
    const profile = await this.catalogService.getProfileForUser(user.id);
    if (!profile) {
      throw new NotFoundException('Health profile not found');
    }
    return profile;
  }

  @Put('profile')
  upsertProfile(
    @CurrentUser() user: AuthUserPayload,
    @Body() dto: UpsertHealthProfileDto,
  ): Promise<HealthProfileResponseDto> {
    return this.catalogService.upsertProfile(user.id, dto);
  }
}
