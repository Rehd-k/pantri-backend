import { Controller, Get, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import {
  MeasureFamilyResponseDto,
  MeasureUnitResponseDto,
} from './dto/measure-response.dto';
import { MeasureService } from './measure.service';

@Controller('marketplace/measures')
@UseGuards(JwtAuthGuard)
export class MeasureController {
  constructor(private readonly measureService: MeasureService) {}

  @Get('units')
  listUnits(): Promise<MeasureUnitResponseDto[]> {
    return this.measureService.listUnits(true);
  }

  @Get('families')
  listFamilies(): Promise<MeasureFamilyResponseDto[]> {
    return this.measureService.listFamilies(true);
  }
}
