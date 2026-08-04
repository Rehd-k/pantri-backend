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
import { Roles } from '../common/decorators/roles.decorator';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import {
  CreateAdminPackageDto,
  CreateDiscountTierDto,
  UpdateAdminPackageDto,
  UpdateDiscountTierDto,
} from './dto/package-request.dto';
import {
  DiscountTierDto,
  PackageListItemDto,
  PackageResponseDto,
} from './dto/package-response.dto';
import { PackagesService } from './packages.service';

@Controller('admin/packages')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.ADMIN)
export class PackagesAdminController {
  constructor(private readonly packagesService: PackagesService) {}

  @Get('tiers')
  listTiers(): Promise<DiscountTierDto[]> {
    return this.packagesService.listTiers(false);
  }

  @Post('tiers')
  createTier(@Body() dto: CreateDiscountTierDto): Promise<DiscountTierDto> {
    return this.packagesService.createTier(dto);
  }

  @Patch('tiers/:id')
  updateTier(
    @Param('id') id: string,
    @Body() dto: UpdateDiscountTierDto,
  ): Promise<DiscountTierDto> {
    return this.packagesService.updateTier(id, dto);
  }

  @Patch('tiers/:id/deactivate')
  deactivateTier(@Param('id') id: string): Promise<DiscountTierDto> {
    return this.packagesService.deactivateTier(id);
  }

  @Get()
  list(): Promise<PackageListItemDto[]> {
    return this.packagesService.adminListPackages();
  }

  @Post()
  create(@Body() dto: CreateAdminPackageDto): Promise<PackageResponseDto> {
    return this.packagesService.adminCreatePackage(dto);
  }

  @Patch(':id')
  update(
    @Param('id') id: string,
    @Body() dto: UpdateAdminPackageDto,
  ): Promise<PackageResponseDto> {
    return this.packagesService.adminUpdatePackage(id, dto);
  }

  @Patch(':id/deactivate')
  deactivate(@Param('id') id: string): Promise<PackageResponseDto> {
    return this.packagesService.adminDeactivatePackage(id);
  }
}
