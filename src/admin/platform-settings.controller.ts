import { Body, Controller, Get, Patch, UseGuards } from '@nestjs/common';
import { UserRole } from '../../generated/prisma/client';
import { Roles } from '../common/decorators/roles.decorator';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { PrismaService } from '../prisma/prisma.service';
import { UpdatePlatformSettingsDto } from './dto/update-platform-settings.dto';
import {
  PlatformSettingsResponseDto,
  toPlatformSettingsResponseDto,
} from './dto/platform-settings-response.dto';

const SETTINGS_ID = 'default';

/** Platform-wide caps and toggles that apply as guardrails above per-employer credit policies. */
@Controller('admin/platform-settings')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.ADMIN)
export class PlatformSettingsController {
  constructor(private readonly prisma: PrismaService) {}

  @Get()
  async get(): Promise<PlatformSettingsResponseDto> {
    const settings = await this.prisma.platformSettings.upsert({
      where: { id: SETTINGS_ID },
      update: {},
      create: { id: SETTINGS_ID },
    });
    return toPlatformSettingsResponseDto(settings);
  }

  @Patch()
  async update(
    @Body() dto: UpdatePlatformSettingsDto,
  ): Promise<PlatformSettingsResponseDto> {
    const settings = await this.prisma.platformSettings.upsert({
      where: { id: SETTINGS_ID },
      update: dto,
      create: { id: SETTINGS_ID, ...dto },
    });
    return toPlatformSettingsResponseDto(settings);
  }
}
