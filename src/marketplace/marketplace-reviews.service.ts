import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import type { Prisma, ProductReview } from '../../generated/prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { CreateReviewDto } from './dto/create-review.dto';
import { ListReviewsQueryDto } from './dto/list-reviews-query.dto';
import { RatingDistributionDto } from './dto/product-response.dto';
import {
  ReviewListResponseDto,
  ReviewResponseDto,
} from './dto/review-response.dto';

type ReviewWithAuthor = ProductReview & {
  user: { id: string; firstName: string; lastName: string };
};

@Injectable()
export class MarketplaceReviewsService {
  constructor(private readonly prisma: PrismaService) {}

  async listReviews(
    productId: string,
    query: ListReviewsQueryDto,
    viewerUserId?: string,
  ): Promise<ReviewListResponseDto> {
    await this.requireActiveProduct(productId);

    const take = query.take ?? 10;
    const skip = query.skip ?? 0;
    const sort = query.sort ?? 'recent';

    const orderBy: Prisma.ProductReviewOrderByWithRelationInput[] =
      sort === 'helpful'
        ? [{ helpfulCount: 'desc' }, { createdAt: 'desc' }]
        : [{ createdAt: 'desc' }];

    const [rows, total, aggregates, hasReviewed, myVotes] = await Promise.all([
      this.prisma.productReview.findMany({
        where: { productId },
        include: {
          user: { select: { id: true, firstName: true, lastName: true } },
        },
        orderBy,
        skip,
        take,
      }),
      this.prisma.productReview.count({ where: { productId } }),
      this.computeRatingAggregates(productId),
      viewerUserId
        ? this.prisma.productReview
            .findUnique({
              where: {
                productId_userId: { productId, userId: viewerUserId },
              },
              select: { id: true },
            })
            .then((r) => Boolean(r))
        : Promise.resolve(false),
      viewerUserId
        ? this.prisma.productReviewHelpful.findMany({
            where: {
              userId: viewerUserId,
              review: { productId },
            },
            select: { reviewId: true },
          })
        : Promise.resolve([] as { reviewId: string }[]),
    ]);

    const voted = new Set(myVotes.map((v) => v.reviewId));

    return {
      items: rows.map((row) =>
        this.toReviewDto(row, voted.has(row.id)),
      ),
      total,
      averageRating: aggregates.averageRating,
      reviewCount: aggregates.reviewCount,
      ratingDistribution: aggregates.ratingDistribution,
      hasReviewed,
    };
  }

  async createReview(
    productId: string,
    userId: string,
    dto: CreateReviewDto,
  ): Promise<ReviewResponseDto> {
    await this.requireActiveProduct(productId);

    const existing = await this.prisma.productReview.findUnique({
      where: { productId_userId: { productId, userId } },
    });
    if (existing) {
      throw new ConflictException('You have already reviewed this product');
    }

    const body = dto.body.trim();
    if (!body) {
      throw new BadRequestException('Review body cannot be empty');
    }

    const row = await this.prisma.productReview.create({
      data: {
        productId,
        userId,
        rating: dto.rating,
        body,
      },
      include: {
        user: { select: { id: true, firstName: true, lastName: true } },
      },
    });

    return this.toReviewDto(row, false);
  }

  async toggleHelpful(
    productId: string,
    reviewId: string,
    userId: string,
  ): Promise<ReviewResponseDto> {
    await this.requireActiveProduct(productId);

    const review = await this.prisma.productReview.findFirst({
      where: { id: reviewId, productId },
      include: {
        user: { select: { id: true, firstName: true, lastName: true } },
      },
    });
    if (!review) {
      throw new NotFoundException('Review not found');
    }

    const existingVote = await this.prisma.productReviewHelpful.findUnique({
      where: { reviewId_userId: { reviewId, userId } },
    });

    const updated = await this.prisma.$transaction(async (tx) => {
      if (existingVote) {
        await tx.productReviewHelpful.delete({
          where: { reviewId_userId: { reviewId, userId } },
        });
        return tx.productReview.update({
          where: { id: reviewId },
          data: { helpfulCount: { decrement: 1 } },
          include: {
            user: { select: { id: true, firstName: true, lastName: true } },
          },
        });
      }

      await tx.productReviewHelpful.create({
        data: { reviewId, userId },
      });
      return tx.productReview.update({
        where: { id: reviewId },
        data: { helpfulCount: { increment: 1 } },
        include: {
          user: { select: { id: true, firstName: true, lastName: true } },
        },
      });
    });

    // Clamp helpfulCount if somehow negative
    if (updated.helpfulCount < 0) {
      const fixed = await this.prisma.productReview.update({
        where: { id: reviewId },
        data: { helpfulCount: 0 },
        include: {
          user: { select: { id: true, firstName: true, lastName: true } },
        },
      });
      return this.toReviewDto(fixed, false);
    }

    return this.toReviewDto(updated, !existingVote);
  }

  async computeRatingAggregates(productId: string): Promise<{
    averageRating: number;
    reviewCount: number;
    ratingDistribution: RatingDistributionDto;
  }> {
    const grouped = await this.prisma.productReview.groupBy({
      by: ['rating'],
      where: { productId },
      _count: { rating: true },
    });

    const distribution: RatingDistributionDto = {
      star1: 0,
      star2: 0,
      star3: 0,
      star4: 0,
      star5: 0,
    };

    let totalScore = 0;
    let reviewCount = 0;
    for (const row of grouped) {
      const count = row._count.rating;
      reviewCount += count;
      totalScore += row.rating * count;
      if (row.rating === 1) distribution.star1 = count;
      if (row.rating === 2) distribution.star2 = count;
      if (row.rating === 3) distribution.star3 = count;
      if (row.rating === 4) distribution.star4 = count;
      if (row.rating === 5) distribution.star5 = count;
    }

    const averageRating =
      reviewCount === 0
        ? 0
        : Math.round((totalScore / reviewCount) * 10) / 10;

    return { averageRating, reviewCount, ratingDistribution: distribution };
  }

  private async requireActiveProduct(productId: string): Promise<void> {
    const product = await this.prisma.marketplaceProduct.findFirst({
      where: { id: productId, isActive: true },
      select: { id: true },
    });
    if (!product) {
      throw new NotFoundException('Product not found');
    }
  }

  private toReviewDto(
    row: ReviewWithAuthor,
    markedHelpfulByMe: boolean,
  ): ReviewResponseDto {
    return {
      id: row.id,
      productId: row.productId,
      rating: row.rating,
      body: row.body,
      helpfulCount: Math.max(0, row.helpfulCount),
      markedHelpfulByMe,
      author: {
        id: row.user.id,
        firstName: row.user.firstName,
        lastName: row.user.lastName,
      },
      createdAt: row.createdAt.toISOString(),
      updatedAt: row.updatedAt.toISOString(),
    };
  }
}
