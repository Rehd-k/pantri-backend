export class PackageItemResponseDto {
  id!: string;
  packId!: string;
  productId!: string;
  quantity!: number;
  sortOrder!: number;
  name!: string;
  brand!: string;
  packageLabel!: string;
  imageUrl!: string;
  priceKobo!: number;
  retailPriceKobo!: number;
  lineWholesaleKobo!: number;
  lineRetailKobo!: number;
}

export class DiscountTierDto {
  id!: string;
  label!: string;
  minSpendKobo!: number;
  discountPercent!: number;
  sortOrder!: number;
  isActive!: boolean;
}

export class PackagePricingDto {
  wholesaleSubtotalKobo!: number;
  retailSubtotalKobo!: number;
  discountPercent!: number;
  savingsKobo!: number;
  totalKobo!: number;
  appliedTier!: DiscountTierDto | null;
  nextTier!: DiscountTierDto | null;
  nextTierProgress!: number;
  nextTierRemainingKobo!: number;
}

export class PackageCreatorDto {
  id!: string;
  firstName!: string;
  lastName!: string;
}

export class PackageResponseDto {
  id!: string;
  kind!: string;
  name!: string;
  description!: string;
  coverImageUrl!: string;
  isPopular!: boolean;
  sortOrder!: number;
  isActive!: boolean;
  visibility!: string;
  shareSlug!: string;
  shareUrl!: string;
  shareBannerUrl!: string;
  createdByUserId!: string | null;
  createdBy!: PackageCreatorDto | null;
  itemSummary!: string;
  itemCount!: number;
  items!: PackageItemResponseDto[];
  pricing!: PackagePricingDto;
  createdAt!: string;
  updatedAt!: string;
}

export class PackageListItemDto {
  id!: string;
  kind!: string;
  name!: string;
  description!: string;
  coverImageUrl!: string;
  isPopular!: boolean;
  visibility!: string;
  shareSlug!: string;
  shareUrl!: string;
  itemSummary!: string;
  itemCount!: number;
  pricing!: PackagePricingDto;
  createdBy!: PackageCreatorDto | null;
}

export class PackageSubscriptionResponseDto {
  id!: string;
  packageId!: string;
  packageName!: string;
  status!: string;
  snapshot!: Record<string, unknown>;
  createdAt!: string;
}

export class MinePackagesResponseDto {
  packages!: PackageListItemDto[];
  subscriptions!: PackageSubscriptionResponseDto[];
}
