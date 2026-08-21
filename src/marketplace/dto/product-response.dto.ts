import { PerfectForItemDto } from './perfect-for-item.dto';
import { MeasureFamilyResponseDto } from '../../measure/dto/measure-response.dto';
import { MeasureUnitResponseDto } from '../../measure/dto/measure-response.dto';

export class CanonicalNutritionDto {
  energyKcal!: number;
  proteinMg!: number;
  carbsMg!: number;
  fatMg!: number;
  fiberMg!: number;
  sugarMg!: number;
  sodiumMg!: number;
  ironUg!: number;
}

export class ProductAllergenDto {
  id!: string;
  name!: string;
}

export class RatingDistributionDto {
  star1!: number;
  star2!: number;
  star3!: number;
  star4!: number;
  star5!: number;
}

export class ProductPackResponseDto {
  id!: string;
  sku!: string;
  productId!: string;
  packUnitId!: string;
  packUnit!: MeasureUnitResponseDto;
  brand!: string;
  packAmount!: number;
  amountMg!: number | null;
  amountMl!: number | null;
  amountEach!: number | null;
  packageLabel!: string;
  imageUrl!: string;
  priceKobo!: number;
  retailPriceKobo!: number;
  discountPercent!: number;
  sortOrder!: number;
  isActive!: boolean;
  createdAt!: string;
  updatedAt!: string;
}

export class ProductResponseDto {
  id!: string;
  slug!: string;
  categoryId!: string;
  categoryName!: string;
  subcategoryId!: string;
  subcategoryName!: string;
  measureFamilyId!: string;
  measureFamily!: MeasureFamilyResponseDto;
  recipeUnitId!: string | null;
  recipeUnit!: MeasureUnitResponseDto | null;
  name!: string;
  imageUrl!: string;
  fromPriceKobo!: number;
  fromRetailPriceKobo!: number;
  discountPercent!: number;
  description!: string;
  origin!: string;
  recipeUnitOverrideMg!: number | null;
  recipeUnitOverrideMl!: number | null;
  expiresAt!: string | null;
  isVerified!: boolean;
  bulkAllocationClaimedPercent!: number;
  nutritionFacts!: Record<string, string>;
  nutrition!: CanonicalNutritionDto;
  allergens!: ProductAllergenDto[];
  perfectFor!: PerfectForItemDto[];
  tags!: string[];
  packs!: ProductPackResponseDto[];
  sortOrder!: number;
  isActive!: boolean;
  averageRating!: number;
  reviewCount!: number;
  ratingDistribution!: RatingDistributionDto;
  createdAt!: string;
  updatedAt!: string;
}
