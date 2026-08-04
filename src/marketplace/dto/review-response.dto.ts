import { RatingDistributionDto } from './product-response.dto';

export class ReviewAuthorDto {
  id!: string;
  firstName!: string;
  lastName!: string;
}

export class ReviewResponseDto {
  id!: string;
  productId!: string;
  rating!: number;
  body!: string;
  helpfulCount!: number;
  markedHelpfulByMe!: boolean;
  author!: ReviewAuthorDto;
  createdAt!: string;
  updatedAt!: string;
}

export class ReviewListResponseDto {
  items!: ReviewResponseDto[];
  total!: number;
  averageRating!: number;
  reviewCount!: number;
  ratingDistribution!: RatingDistributionDto;
  hasReviewed!: boolean;
}
