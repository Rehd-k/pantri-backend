import { IsBoolean, IsInt, IsNotEmpty, IsOptional, IsString, Matches, Min } from 'class-validator';
import { Type } from 'class-transformer';

const HEX_COLOR = /^#[0-9A-Fa-f]{6}$/;

export class CreateBannerDto {
  @IsString()
  @IsNotEmpty()
  badgeLabel!: string;

  @IsString()
  @IsNotEmpty()
  title!: string;

  @IsString()
  @IsNotEmpty()
  subtitle!: string;

  @IsString()
  @IsNotEmpty()
  ctaLabel!: string;

  @IsOptional()
  @IsString()
  ctaRoute?: string | null;

  @IsString()
  @IsNotEmpty()
  @Matches(HEX_COLOR, {
    message: 'gradientStart must be a hex color like #1A3A5C',
  })
  gradientStart!: string;

  @IsString()
  @IsNotEmpty()
  @Matches(HEX_COLOR, {
    message: 'gradientEnd must be a hex color like #2D6A8F',
  })
  gradientEnd!: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  sortOrder?: number;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
