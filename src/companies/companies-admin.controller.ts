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
import { CompaniesService } from './companies.service';
import {
  CreatePickupPointDto,
  UpdatePickupPointDto,
} from './dto/pickup-point-request.dto';
import {
  CompanyListItemDto,
  PickupPointDto,
} from './dto/pickup-point-response.dto';

@Controller('admin')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.ADMIN)
export class CompaniesAdminController {
  constructor(private readonly companiesService: CompaniesService) {}

  @Get('companies')
  listCompanies(): Promise<CompanyListItemDto[]> {
    return this.companiesService.listCompanies();
  }

  @Get('companies/:companyId/pickup-points')
  listPickupPoints(
    @Param('companyId') companyId: string,
  ): Promise<PickupPointDto[]> {
    return this.companiesService.listPickupPoints(companyId);
  }

  @Post('companies/:companyId/pickup-points')
  createPickupPoint(
    @Param('companyId') companyId: string,
    @Body() dto: CreatePickupPointDto,
  ): Promise<PickupPointDto> {
    return this.companiesService.createPickupPoint(companyId, dto);
  }

  @Patch('pickup-points/:id')
  updatePickupPoint(
    @Param('id') id: string,
    @Body() dto: UpdatePickupPointDto,
  ): Promise<PickupPointDto> {
    return this.companiesService.updatePickupPoint(id, dto);
  }

  @Patch('pickup-points/:id/deactivate')
  deactivatePickupPoint(@Param('id') id: string): Promise<PickupPointDto> {
    return this.companiesService.deactivatePickupPoint(id);
  }
}
