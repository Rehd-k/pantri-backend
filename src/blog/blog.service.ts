import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  BlogPost,
  BlogPostCategory,
  BlogPostStatus,
  Prisma,
} from '../../generated/prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import {
  CreateBlogPostDto,
  ListBlogPostsQueryDto,
  UpdateBlogPostDto,
} from './dto/blog-request.dto';
import { BlogPostResponseDto } from './dto/blog-response.dto';

const CATEGORY_LABELS: Record<BlogPostCategory, string> = {
  [BlogPostCategory.FOOD]: 'Food',
  [BlogPostCategory.NUTRITION]: 'Nutrition',
  [BlogPostCategory.RECIPES]: 'Recipes',
  [BlogPostCategory.FAMILY]: 'Family',
  [BlogPostCategory.BUDGETING]: 'Budgeting',
  [BlogPostCategory.HEALTHY_LIVING]: 'Healthy Living',
  [BlogPostCategory.FOOD_PRICES]: 'Food Prices',
  [BlogPostCategory.COOKING]: 'Cooking',
  [BlogPostCategory.EVENTS]: 'Events',
  [BlogPostCategory.VIDEOS]: 'Videos',
};

@Injectable()
export class BlogService {
  constructor(private readonly prisma: PrismaService) {}

  listPublished(query: ListBlogPostsQueryDto): Promise<BlogPostResponseDto[]> {
    return this.prisma.blogPost
      .findMany({
        where: {
          status: BlogPostStatus.PUBLISHED,
          ...(query.category ? { category: query.category } : {}),
        },
        orderBy: [{ publishedAt: 'desc' }, { createdAt: 'desc' }],
      })
      .then((rows) => rows.map((row) => this.toDto(row)));
  }

  async getPublishedBySlug(slug: string): Promise<BlogPostResponseDto> {
    const row = await this.prisma.blogPost.findFirst({
      where: { slug, status: BlogPostStatus.PUBLISHED },
    });
    if (!row) {
      throw new NotFoundException('Blog post not found');
    }
    return this.toDto(row);
  }

  listAll(query: ListBlogPostsQueryDto): Promise<BlogPostResponseDto[]> {
    return this.prisma.blogPost
      .findMany({
        where: {
          ...(query.category ? { category: query.category } : {}),
          ...(query.status ? { status: query.status } : {}),
        },
        orderBy: [{ publishedAt: 'desc' }, { createdAt: 'desc' }],
      })
      .then((rows) => rows.map((row) => this.toDto(row)));
  }

  async getById(id: string): Promise<BlogPostResponseDto> {
    const row = await this.requirePost(id);
    return this.toDto(row);
  }

  async create(
    dto: CreateBlogPostDto,
    authorUserId: string,
  ): Promise<BlogPostResponseDto> {
    const slug = await this.resolveUniqueSlug(dto.slug, dto.title);
    const category = dto.category;
    const youtubeUrl = this.normalizeOptionalUrl(dto.youtubeUrl);
    const tiktokUrl = this.normalizeOptionalUrl(dto.tiktokUrl);
    this.assertVideoRules(category, youtubeUrl);

    const status = dto.status ?? BlogPostStatus.DRAFT;
    const publishedAt =
      status === BlogPostStatus.PUBLISHED ? new Date() : null;

    const bodyParagraphs = this.normalizeParagraphs(
      dto.bodyParagraphs,
      category === BlogPostCategory.VIDEOS,
    );

    try {
      const row = await this.prisma.blogPost.create({
        data: {
          slug,
          title: dto.title.trim(),
          excerpt: dto.excerpt.trim(),
          category,
          bodyParagraphs,
          coverGradient: dto.coverGradient.trim(),
          coverImageUrl: this.normalizeOptionalUrl(dto.coverImageUrl),
          youtubeUrl,
          tiktokUrl,
          readTimeMinutes:
            dto.readTimeMinutes ??
            (bodyParagraphs.length > 0
              ? this.estimateReadTime(bodyParagraphs)
              : 1),
          status,
          publishedAt,
          authorUserId,
        },
      });

      return this.toDto(row);
    } catch (err) {
      if (
        err instanceof Prisma.PrismaClientKnownRequestError &&
        err.code === 'P2002'
      ) {
        throw new ConflictException('A post with this slug already exists');
      }
      throw err;
    }
  }

  async update(
    id: string,
    dto: UpdateBlogPostDto,
  ): Promise<BlogPostResponseDto> {
    const existing = await this.requirePost(id);

    const category = dto.category ?? existing.category;
    const youtubeUrl =
      dto.youtubeUrl !== undefined
        ? this.normalizeOptionalUrl(dto.youtubeUrl)
        : existing.youtubeUrl;
    const tiktokUrl =
      dto.tiktokUrl !== undefined
        ? this.normalizeOptionalUrl(dto.tiktokUrl)
        : existing.tiktokUrl;
    this.assertVideoRules(category, youtubeUrl);

    let slug = existing.slug;
    if (dto.slug && dto.slug !== existing.slug) {
      slug = await this.resolveUniqueSlug(dto.slug, dto.title ?? existing.title);
    } else if (dto.title && !dto.slug) {
      // keep existing slug when only title changes
    }

    const nextStatus = dto.status ?? existing.status;
    let publishedAt = existing.publishedAt;
    if (
      nextStatus === BlogPostStatus.PUBLISHED &&
      existing.status !== BlogPostStatus.PUBLISHED
    ) {
      publishedAt = new Date();
    } else if (
      nextStatus !== BlogPostStatus.PUBLISHED &&
      existing.status === BlogPostStatus.PUBLISHED
    ) {
      publishedAt = null;
    }

    const bodyParagraphs =
      dto.bodyParagraphs !== undefined
        ? this.normalizeParagraphs(
            dto.bodyParagraphs,
            category === BlogPostCategory.VIDEOS,
          )
        : undefined;

    try {
      const row = await this.prisma.blogPost.update({
        where: { id },
        data: {
          ...(dto.title !== undefined ? { title: dto.title.trim() } : {}),
          ...(dto.excerpt !== undefined ? { excerpt: dto.excerpt.trim() } : {}),
          ...(dto.category !== undefined ? { category: dto.category } : {}),
          ...(bodyParagraphs !== undefined ? { bodyParagraphs } : {}),
          ...(dto.coverGradient !== undefined
            ? { coverGradient: dto.coverGradient.trim() }
            : {}),
          ...(dto.coverImageUrl !== undefined
            ? {
                coverImageUrl: this.normalizeOptionalUrl(dto.coverImageUrl),
              }
            : {}),
          ...(dto.youtubeUrl !== undefined ? { youtubeUrl } : {}),
          ...(dto.tiktokUrl !== undefined ? { tiktokUrl } : {}),
          ...(dto.readTimeMinutes !== undefined
            ? { readTimeMinutes: dto.readTimeMinutes }
            : bodyParagraphs !== undefined
              ? { readTimeMinutes: this.estimateReadTime(bodyParagraphs) }
              : {}),
          ...(dto.status !== undefined ? { status: dto.status } : {}),
          ...(slug !== existing.slug ? { slug } : {}),
          publishedAt,
        },
      });
      return this.toDto(row);
    } catch (err) {
      if (
        err instanceof Prisma.PrismaClientKnownRequestError &&
        err.code === 'P2002'
      ) {
        throw new ConflictException('A post with this slug already exists');
      }
      throw err;
    }
  }

  async archive(id: string): Promise<BlogPostResponseDto> {
    await this.requirePost(id);
    const row = await this.prisma.blogPost.update({
      where: { id },
      data: {
        status: BlogPostStatus.ARCHIVED,
        publishedAt: null,
      },
    });
    return this.toDto(row);
  }

  categoryLabels(): { key: string; label: string }[] {
    return (Object.keys(CATEGORY_LABELS) as BlogPostCategory[]).map((key) => ({
      key,
      label: CATEGORY_LABELS[key],
    }));
  }

  private async requirePost(id: string): Promise<BlogPost> {
    const row = await this.prisma.blogPost.findUnique({ where: { id } });
    if (!row) {
      throw new NotFoundException('Blog post not found');
    }
    return row;
  }

  private assertVideoRules(
    category: BlogPostCategory,
    youtubeUrl: string | null,
  ): void {
    if (category === BlogPostCategory.VIDEOS) {
      if (!youtubeUrl) {
        throw new BadRequestException(
          'youtubeUrl is required when category is VIDEOS',
        );
      }
      if (!this.extractYoutubeId(youtubeUrl)) {
        throw new BadRequestException(
          'youtubeUrl must be a valid YouTube watch, share, or shorts URL',
        );
      }
      return;
    }
    if (youtubeUrl && !this.extractYoutubeId(youtubeUrl)) {
      throw new BadRequestException(
        'youtubeUrl must be a valid YouTube watch, share, or shorts URL',
      );
    }
  }

  private normalizeParagraphs(
    paragraphs: string[],
    allowEmpty = false,
  ): string[] {
    const cleaned = paragraphs
      .map((p) => p.trim())
      .filter((p) => p.length > 0);
    if (cleaned.length === 0 && !allowEmpty) {
      throw new BadRequestException('bodyParagraphs must not be empty');
    }
    return cleaned;
  }

  private normalizeOptionalUrl(value?: string | null): string | null {
    if (value === undefined || value === null) return null;
    const trimmed = value.trim();
    return trimmed.length === 0 ? null : trimmed;
  }

  private estimateReadTime(paragraphs: string[]): number {
    const words = paragraphs.join(' ').split(/\s+/).filter(Boolean).length;
    return Math.max(1, Math.ceil(words / 200));
  }

  private slugify(input: string): string {
    return input
      .toLowerCase()
      .normalize('NFKD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 100);
  }

  private async resolveUniqueSlug(
    explicit: string | undefined,
    title: string,
  ): Promise<string> {
    const base = (explicit?.trim() || this.slugify(title) || 'post').slice(
      0,
      100,
    );
    let candidate = base;
    let n = 2;
    while (await this.prisma.blogPost.findUnique({ where: { slug: candidate } })) {
      candidate = `${base}-${n}`;
      n += 1;
    }
    return candidate;
  }

  extractYoutubeId(url: string): string | null {
    try {
      const parsed = new URL(url.trim());
      const host = parsed.hostname.replace(/^www\./, '');
      if (host === 'youtu.be') {
        const id = parsed.pathname.split('/').filter(Boolean)[0];
        return id && /^[\w-]{11}$/.test(id) ? id : null;
      }
      if (host === 'youtube.com' || host === 'm.youtube.com') {
        if (parsed.pathname === '/watch') {
          const id = parsed.searchParams.get('v');
          return id && /^[\w-]{11}$/.test(id) ? id : null;
        }
        const parts = parsed.pathname.split('/').filter(Boolean);
        if (
          (parts[0] === 'shorts' || parts[0] === 'embed' || parts[0] === 'live') &&
          parts[1] &&
          /^[\w-]{11}$/.test(parts[1])
        ) {
          return parts[1];
        }
      }
      return null;
    } catch {
      return null;
    }
  }

  youtubeEmbedUrl(url: string | null): string | null {
    if (!url) return null;
    const id = this.extractYoutubeId(url);
    return id ? `https://www.youtube.com/embed/${id}` : null;
  }

  private parseParagraphs(value: Prisma.JsonValue): string[] {
    if (!Array.isArray(value)) return [];
    return value.filter((item): item is string => typeof item === 'string');
  }

  private toDto(row: BlogPost): BlogPostResponseDto {
    return {
      id: row.id,
      slug: row.slug,
      title: row.title,
      excerpt: row.excerpt,
      category: CATEGORY_LABELS[row.category],
      categoryKey: row.category,
      bodyParagraphs: this.parseParagraphs(row.bodyParagraphs),
      coverGradient: row.coverGradient,
      coverImageUrl: row.coverImageUrl,
      youtubeUrl: row.youtubeUrl,
      youtubeEmbedUrl: this.youtubeEmbedUrl(row.youtubeUrl),
      tiktokUrl: row.tiktokUrl,
      readTimeMinutes: row.readTimeMinutes,
      status: row.status,
      publishedAt: row.publishedAt?.toISOString() ?? null,
      authorUserId: row.authorUserId,
      createdAt: row.createdAt.toISOString(),
      updatedAt: row.updatedAt.toISOString(),
    };
  }
}
