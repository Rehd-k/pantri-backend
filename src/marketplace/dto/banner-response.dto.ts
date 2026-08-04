export class BannerResponseDto {
  id!: string;
  badgeLabel!: string;
  title!: string;
  subtitle!: string;
  ctaLabel!: string;
  ctaRoute!: string | null;
  gradientStart!: string;
  gradientEnd!: string;
  sortOrder!: number;
  isActive!: boolean;
  createdAt!: string;
  updatedAt!: string;
}
