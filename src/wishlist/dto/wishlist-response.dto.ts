export class WishlistStatusDto {
  saved!: boolean;
}

export class WishlistItemResponseDto {
  id!: string;
  productId!: string;
  name!: string;
  brand!: string;
  packageLabel!: string;
  imageUrl!: string;
  priceKobo!: number;
  retailPriceKobo!: number;
  bulkAllocationClaimedPercent!: number;
  priceKoboAtSave!: number;
  priceDropped!: boolean;
  dropAmountKobo!: number;
  savedAt!: string;
}

export class WishlistListResponseDto {
  items!: WishlistItemResponseDto[];
  total!: number;
  priceDropCount!: number;
}
