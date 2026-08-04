import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { UserRole } from '../../generated/prisma/client';
import {
  CurrentUser,
  type AuthUserPayload,
} from '../common/decorators/current-user.decorator';
import { Roles } from '../common/decorators/roles.decorator';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { BannerResponseDto } from './dto/banner-response.dto';
import { CategoryResponseDto } from './dto/category-response.dto';
import { CreateReviewDto } from './dto/create-review.dto';
import { ListProductsQueryDto } from './dto/list-products-query.dto';
import { ListReviewsQueryDto } from './dto/list-reviews-query.dto';
import { ProductListResponseDto } from './dto/product-list-response.dto';
import { ProductResponseDto } from './dto/product-response.dto';
import {
  ReviewListResponseDto,
  ReviewResponseDto,
} from './dto/review-response.dto';
import { SubcategoryResponseDto } from './dto/subcategory-response.dto';
import { MarketplaceCatalogService } from './marketplace-catalog.service';
import { MarketplaceReviewsService } from './marketplace-reviews.service';
import { MarketplaceService } from './marketplace.service';

@Controller('marketplace')
@UseGuards(JwtAuthGuard)
export class MarketplaceController {
  constructor(
    private readonly marketplaceService: MarketplaceService,
    private readonly catalogService: MarketplaceCatalogService,
    private readonly reviewsService: MarketplaceReviewsService,
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

  @Get('products/:id/reviews')
  listReviews(
    @Param('id') id: string,
    @Query() query: ListReviewsQueryDto,
    @CurrentUser() user: AuthUserPayload,
  ): Promise<ReviewListResponseDto> {
    return this.reviewsService.listReviews(id, query, user.id);
  }

  @Post('products/:id/reviews')
  @UseGuards(RolesGuard)
  @Roles(UserRole.EMPLOYEE)
  createReview(
    @Param('id') id: string,
    @CurrentUser() user: AuthUserPayload,
    @Body() dto: CreateReviewDto,
  ): Promise<ReviewResponseDto> {
    return this.reviewsService.createReview(id, user.id, dto);
  }

  @Post('products/:id/reviews/:reviewId/helpful')
  @UseGuards(RolesGuard)
  @Roles(UserRole.EMPLOYEE)
  toggleHelpful(
    @Param('id') id: string,
    @Param('reviewId') reviewId: string,
    @CurrentUser() user: AuthUserPayload,
  ): Promise<ReviewResponseDto> {
    return this.reviewsService.toggleHelpful(id, reviewId, user.id);
  }
}
