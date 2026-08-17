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
import { Roles } from '../common/decorators/roles.decorator';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { BannerResponseDto } from './dto/banner-response.dto';
import { CategoryResponseDto } from './dto/category-response.dto';
import { CreateBannerDto } from './dto/create-banner.dto';
import { CreateCategoryDto } from './dto/create-category.dto';
import { CreateProductDto } from './dto/create-product.dto';
import { CreateSubcategoryDto } from './dto/create-subcategory.dto';
import { ListProductsQueryDto } from './dto/list-products-query.dto';
import { ProductListResponseDto } from './dto/product-list-response.dto';
import { ProductPackResponseDto } from './dto/product-response.dto';
import { ProductResponseDto } from './dto/product-response.dto';
import {
  CreateProductPackDto,
  UpdateProductPackDto,
} from './dto/product-pack.dto';
import { SubcategoryResponseDto } from './dto/subcategory-response.dto';
import { UpdateBannerDto } from './dto/update-banner.dto';
import { UpdateCategoryDto } from './dto/update-category.dto';
import { UpdateProductDto } from './dto/update-product.dto';
import { UpdateSubcategoryDto } from './dto/update-subcategory.dto';
import { MarketplaceCatalogService } from './marketplace-catalog.service';
import { MarketplaceService } from './marketplace.service';

@Controller('admin/marketplace')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.ADMIN)
export class MarketplaceAdminController {
  constructor(
    private readonly marketplaceService: MarketplaceService,
    private readonly catalogService: MarketplaceCatalogService,
  ) {}

  @Get('categories')
  listCategories(): Promise<CategoryResponseDto[]> {
    return this.marketplaceService.listAllCategories();
  }

  @Post('categories')
  createCategory(@Body() dto: CreateCategoryDto): Promise<CategoryResponseDto> {
    return this.marketplaceService.createCategory(dto);
  }

  @Patch('categories/:id')
  updateCategory(
    @Param('id') id: string,
    @Body() dto: UpdateCategoryDto,
  ): Promise<CategoryResponseDto> {
    return this.marketplaceService.updateCategory(id, dto);
  }

  @Patch('categories/:id/deactivate')
  deactivateCategory(
    @Param('id') id: string,
  ): Promise<CategoryResponseDto> {
    return this.marketplaceService.deactivateCategory(id);
  }

  @Get('banners')
  listBanners(): Promise<BannerResponseDto[]> {
    return this.marketplaceService.listAllBanners();
  }

  @Post('banners')
  createBanner(@Body() dto: CreateBannerDto): Promise<BannerResponseDto> {
    return this.marketplaceService.createBanner(dto);
  }

  @Patch('banners/:id')
  updateBanner(
    @Param('id') id: string,
    @Body() dto: UpdateBannerDto,
  ): Promise<BannerResponseDto> {
    return this.marketplaceService.updateBanner(id, dto);
  }

  @Patch('banners/:id/deactivate')
  deactivateBanner(@Param('id') id: string): Promise<BannerResponseDto> {
    return this.marketplaceService.deactivateBanner(id);
  }

  @Get('subcategories')
  listSubcategories(
    @Query('categoryId') categoryId?: string,
  ): Promise<SubcategoryResponseDto[]> {
    return this.catalogService.listAllSubcategories(categoryId);
  }

  @Post('subcategories')
  createSubcategory(
    @Body() dto: CreateSubcategoryDto,
  ): Promise<SubcategoryResponseDto> {
    return this.catalogService.createSubcategory(dto);
  }

  @Patch('subcategories/:id')
  updateSubcategory(
    @Param('id') id: string,
    @Body() dto: UpdateSubcategoryDto,
  ): Promise<SubcategoryResponseDto> {
    return this.catalogService.updateSubcategory(id, dto);
  }

  @Patch('subcategories/:id/deactivate')
  deactivateSubcategory(
    @Param('id') id: string,
  ): Promise<SubcategoryResponseDto> {
    return this.catalogService.deactivateSubcategory(id);
  }

  @Get('products')
  listProducts(
    @Query() query: ListProductsQueryDto,
  ): Promise<ProductListResponseDto> {
    return this.catalogService.listAllProducts(query);
  }

  @Get('products/:id')
  getProduct(@Param('id') id: string): Promise<ProductResponseDto> {
    return this.catalogService.getProduct(id);
  }

  @Post('products')
  createProduct(@Body() dto: CreateProductDto): Promise<ProductResponseDto> {
    return this.catalogService.createProduct(dto);
  }

  @Patch('products/:id')
  updateProduct(
    @Param('id') id: string,
    @Body() dto: UpdateProductDto,
  ): Promise<ProductResponseDto> {
    return this.catalogService.updateProduct(id, dto);
  }

  @Patch('products/:id/deactivate')
  deactivateProduct(@Param('id') id: string): Promise<ProductResponseDto> {
    return this.catalogService.deactivateProduct(id);
  }

  @Post('products/:id/packs')
  createPack(
    @Param('id') id: string,
    @Body() dto: CreateProductPackDto,
  ): Promise<ProductPackResponseDto> {
    return this.catalogService.createPack(id, dto);
  }

  @Patch('packs/:id')
  updatePack(
    @Param('id') id: string,
    @Body() dto: UpdateProductPackDto,
  ): Promise<ProductPackResponseDto> {
    return this.catalogService.updatePack(id, dto);
  }

  @Patch('packs/:id/deactivate')
  deactivatePack(@Param('id') id: string): Promise<ProductPackResponseDto> {
    return this.catalogService.deactivatePack(id);
  }
}
