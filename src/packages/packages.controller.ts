import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { UserRole } from '../../generated/prisma/client';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import type { AuthUserPayload } from '../common/decorators/current-user.decorator';
import { Roles } from '../common/decorators/roles.decorator';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { CartResponseDto } from '../cart/dto/cart-response.dto';
import {
  CreateCommunityPackageDto,
  CustomizeItemsDto,
  ListPackagesQueryDto,
  UpdateCommunityPackageDto,
} from './dto/package-request.dto';
import {
  MinePackagesResponseDto,
  PackageResponseDto,
  PackageListItemDto,
  PackageSubscriptionResponseDto,
} from './dto/package-response.dto';
import { PackagesService } from './packages.service';

@Controller('packages')
export class PackagesController {
  constructor(private readonly packagesService: PackagesService) {}

  @Get('share/:slug')
  getByShareSlug(@Param('slug') slug: string): Promise<PackageResponseDto> {
    return this.packagesService.getByShareSlug(slug);
  }

  @Get()
  @UseGuards(JwtAuthGuard)
  list(@Query() query: ListPackagesQueryDto): Promise<PackageListItemDto[]> {
    return this.packagesService.listPackages(query.includeCommunity === true);
  }

  @Get('mine')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.EMPLOYEE)
  listMine(
    @CurrentUser() user: AuthUserPayload,
  ): Promise<MinePackagesResponseDto> {
    return this.packagesService.listMine(user.id);
  }

  @Get(':id')
  @UseGuards(JwtAuthGuard)
  getById(
    @Param('id') id: string,
    @CurrentUser() user: AuthUserPayload,
  ): Promise<PackageResponseDto> {
    return this.packagesService.getById(id, user.id);
  }

  @Post()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.EMPLOYEE)
  create(
    @CurrentUser() user: AuthUserPayload,
    @Body() dto: CreateCommunityPackageDto,
  ): Promise<PackageResponseDto> {
    return this.packagesService.createCommunity(user.id, dto);
  }

  @Patch(':id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.EMPLOYEE)
  update(
    @CurrentUser() user: AuthUserPayload,
    @Param('id') id: string,
    @Body() dto: UpdateCommunityPackageDto,
  ): Promise<PackageResponseDto> {
    return this.packagesService.updateCommunity(user.id, id, dto);
  }

  @Post(':id/customize-preview')
  @UseGuards(JwtAuthGuard)
  customizePreview(
    @CurrentUser() user: AuthUserPayload,
    @Param('id') id: string,
    @Body() dto: CustomizeItemsDto,
  ): Promise<PackageResponseDto> {
    return this.packagesService.customizePreview(id, dto.items, user.id);
  }

  @Post(':id/add-to-cart')
  @UseGuards(JwtAuthGuard)
  addToCart(
    @CurrentUser() user: AuthUserPayload,
    @Param('id') id: string,
    @Body() dto: CustomizeItemsDto,
  ): Promise<CartResponseDto> {
    return this.packagesService.addToCart(user.id, id, dto.items);
  }

  @Post(':id/subscribe')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.EMPLOYEE)
  subscribe(
    @CurrentUser() user: AuthUserPayload,
    @Param('id') id: string,
    @Body() dto: CustomizeItemsDto,
  ): Promise<PackageSubscriptionResponseDto> {
    return this.packagesService.subscribe(user.id, id, dto.items);
  }
}
