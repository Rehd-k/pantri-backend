import { PerfectForItemDto } from './perfect-for-item.dto';

export class RatingDistributionDto {
  star1!: number;
  star2!: number;
  star3!: number;
  star4!: number;
  star5!: number;
}

export class ProductResponseDto {
  id!: string;
  categoryId!: string;
  categoryName!: string;
  subcategoryId!: string;
  subcategoryName!: string;
  name!: string;
  brand!: string;
  packageLabel!: string;
  imageUrl!: string;
  priceKobo!: number;
  retailPriceKobo!: number;
  discountPercent!: number;
  description!: string;
  origin!: string;
  expiresAt!: string | null;
  isVerified!: boolean;
  bulkAllocationClaimedPercent!: number;
  nutritionFacts!: Record<string, string>;
  perfectFor!: PerfectForItemDto[];
  tags!: string[];
  sortOrder!: number;
  isActive!: boolean;
  averageRating!: number;
  reviewCount!: number;
  ratingDistribution!: RatingDistributionDto;
  createdAt!: string;
  updatedAt!: string;
}
