import { Controller, Get, Param, Query } from '@nestjs/common';
import { ListBlogPostsQueryDto } from './dto/blog-request.dto';
import { BlogPostResponseDto } from './dto/blog-response.dto';
import { BlogService } from './blog.service';

@Controller('public/blog')
export class BlogPublicController {
  constructor(private readonly blogService: BlogService) {}

  @Get('categories')
  listCategories(): { key: string; label: string }[] {
    return this.blogService.categoryLabels();
  }

  @Get('posts')
  listPosts(
    @Query() query: ListBlogPostsQueryDto,
  ): Promise<BlogPostResponseDto[]> {
    return this.blogService.listPublished(query);
  }

  @Get('posts/:slug')
  getBySlug(@Param('slug') slug: string): Promise<BlogPostResponseDto> {
    return this.blogService.getPublishedBySlug(slug);
  }
}
