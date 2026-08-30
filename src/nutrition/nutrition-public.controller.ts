import { Controller, Get } from '@nestjs/common';
import { NutritionCatalogResponseDto } from './dto/catalog.dto';
import { NutritionCatalogService } from './nutrition-catalog.service';

@Controller('public/nutrition')
export class NutritionPublicController {
  constructor(private readonly catalogService: NutritionCatalogService) {}

  @Get('catalog')
  getCatalog(): Promise<NutritionCatalogResponseDto> {
    return this.catalogService.getPublicCatalog();
  }
}
