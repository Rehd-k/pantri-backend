import { Controller, Get, Param } from '@nestjs/common';
import {
  PackageListItemDto,
  PackageResponseDto,
} from './dto/package-response.dto';
import { PackagesService } from './packages.service';

@Controller('public/packages')
export class PackagesPublicController {
  constructor(private readonly packagesService: PackagesService) {}

  @Get()
  list(): Promise<PackageListItemDto[]> {
    return this.packagesService.listPackages(false);
  }

  @Get(':id')
  getById(@Param('id') id: string): Promise<PackageResponseDto> {
    return this.packagesService.getById(id);
  }
}
