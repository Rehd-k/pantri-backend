import { Controller, Get, Param, Query } from '@nestjs/common';
import { BannerResponseDto } from './dto/banner-response.dto';
import { CategoryResponseDto } from './dto/category-response.dto';
import { ListProductsQueryDto } from './dto/list-products-query.dto';
import { ProductListResponseDto } from './dto/product-list-response.dto';
import { ProductResponseDto } from './dto/product-response.dto';
import { SubcategoryResponseDto } from './dto/subcategory-response.dto';
import { MarketplaceCatalogService } from './marketplace-catalog.service';
import { MarketplaceService } from './marketplace.service';

@Controller('public/marketplace')
export class MarketplacePublicController {
  constructor(
    private readonly marketplaceService: MarketplaceService,
    private readonly catalogService: MarketplaceCatalogService,
  ) {}

  @Get('categories')
  listCategories(): Promise<CategoryResponseDto[]> {
    return this.marketplaceService.listActiveCategories();
  }

  @Get('banners')
  listBanners(): Promise<BannerResponseDto[]> {
    return this.marketplaceService.listActiveBanners();
  }

  @Get('categories/:id/subcategories')
  listSubcategories(
    @Param('id') id: string,
  ): Promise<SubcategoryResponseDto[]> {
    return this.catalogService.listActiveSubcategories(id);
  }

  @Get('products')
  listProducts(
    @Query() query: ListProductsQueryDto,
  ): Promise<ProductListResponseDto> {
    return this.catalogService.listActiveProducts(query);
  }

  @Get('products/:id')
  getProduct(@Param('id') id: string): Promise<ProductResponseDto> {
    return this.catalogService.getActiveProduct(id);
  }
}
