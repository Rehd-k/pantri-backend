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
  CreateMeasureFamilyDto,
  CreateMeasureUnitDto,
  UpdateMeasureFamilyDto,
  UpdateMeasureUnitDto,
} from './dto/measure-request.dto';
import {
  MeasureFamilyResponseDto,
  MeasureUnitResponseDto,
} from './dto/measure-response.dto';
import { MeasureService } from './measure.service';

@Controller('admin/measures')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.ADMIN)
export class MeasureAdminController {
  constructor(private readonly measureService: MeasureService) {}

  @Get('units')
  listUnits(): Promise<MeasureUnitResponseDto[]> {
    return this.measureService.listUnits(false);
  }

  @Post('units')
  createUnit(@Body() dto: CreateMeasureUnitDto): Promise<MeasureUnitResponseDto> {
    return this.measureService.createUnit(dto);
  }

  @Patch('units/:id')
  updateUnit(
    @Param('id') id: string,
    @Body() dto: UpdateMeasureUnitDto,
  ): Promise<MeasureUnitResponseDto> {
    return this.measureService.updateUnit(id, dto);
  }

  @Patch('units/:id/deactivate')
  deactivateUnit(@Param('id') id: string): Promise<MeasureUnitResponseDto> {
    return this.measureService.deactivateUnit(id);
  }

  @Get('families')
  listFamilies(): Promise<MeasureFamilyResponseDto[]> {
    return this.measureService.listFamilies(false);
  }

  @Post('families')
  createFamily(
    @Body() dto: CreateMeasureFamilyDto,
  ): Promise<MeasureFamilyResponseDto> {
    return this.measureService.createFamily(dto);
  }

  @Patch('families/:id')
  updateFamily(
    @Param('id') id: string,
    @Body() dto: UpdateMeasureFamilyDto,
  ): Promise<MeasureFamilyResponseDto> {
    return this.measureService.updateFamily(id, dto);
  }

  @Patch('families/:id/deactivate')
  deactivateFamily(
    @Param('id') id: string,
  ): Promise<MeasureFamilyResponseDto> {
    return this.measureService.deactivateFamily(id);
  }
}
