export class BlogPostResponseDto {
  id!: string;
  slug!: string;
  title!: string;
  excerpt!: string;
  /** Marketing label, e.g. "Food", "Videos" */
  category!: string;
  /** Prisma enum value, e.g. FOOD, VIDEOS */
  categoryKey!: string;
  bodyParagraphs!: string[];
  coverGradient!: string;
  coverImageUrl!: string | null;
  youtubeUrl!: string | null;
  youtubeEmbedUrl!: string | null;
  tiktokUrl!: string | null;
  readTimeMinutes!: number;
  status!: string;
  publishedAt!: string | null;
  authorUserId!: string | null;
  createdAt!: string;
  updatedAt!: string;
}
