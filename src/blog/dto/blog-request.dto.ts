import {
  IsArray,
  IsEnum,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUrl,
  Matches,
  MaxLength,
  Min,
} from 'class-validator';
import { Type } from 'class-transformer';
import {
  BlogPostCategory,
  BlogPostStatus,
} from '../../../generated/prisma/client';

export class CreateBlogPostDto {
  @IsOptional()
  @IsString()
  @Matches(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, {
    message: 'slug must be lowercase kebab-case',
  })
  @MaxLength(120)
  slug?: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(200)
  title!: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(500)
  excerpt!: string;

  @IsEnum(BlogPostCategory)
  category!: BlogPostCategory;

  @IsArray()
  @IsString({ each: true })
  bodyParagraphs!: string[];

  @IsString()
  @IsNotEmpty()
  @MaxLength(120)
  coverGradient!: string;

  @IsOptional()
  @IsString()
  @IsUrl({ require_protocol: true })
  coverImageUrl?: string | null;

  @IsOptional()
  @IsString()
  youtubeUrl?: string | null;

  @IsOptional()
  @IsString()
  tiktokUrl?: string | null;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  readTimeMinutes?: number;

  @IsOptional()
  @IsEnum(BlogPostStatus)
  status?: BlogPostStatus;
}

export class UpdateBlogPostDto {
  @IsOptional()
  @IsString()
  @Matches(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, {
    message: 'slug must be lowercase kebab-case',
  })
  @MaxLength(120)
  slug?: string;

  @IsOptional()
  @IsString()
  @IsNotEmpty()
  @MaxLength(200)
  title?: string;

  @IsOptional()
  @IsString()
  @IsNotEmpty()
  @MaxLength(500)
  excerpt?: string;

  @IsOptional()
  @IsEnum(BlogPostCategory)
  category?: BlogPostCategory;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  bodyParagraphs?: string[];

  @IsOptional()
  @IsString()
  @IsNotEmpty()
  @MaxLength(120)
  coverGradient?: string;

  @IsOptional()
  @IsString()
  coverImageUrl?: string | null;

  @IsOptional()
  @IsString()
  youtubeUrl?: string | null;

  @IsOptional()
  @IsString()
  tiktokUrl?: string | null;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  readTimeMinutes?: number;

  @IsOptional()
  @IsEnum(BlogPostStatus)
  status?: BlogPostStatus;
}

export class ListBlogPostsQueryDto {
  @IsOptional()
  @IsEnum(BlogPostCategory)
  category?: BlogPostCategory;

  @IsOptional()
  @IsEnum(BlogPostStatus)
  status?: BlogPostStatus;
}
