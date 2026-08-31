import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { UserRole } from '../../generated/prisma/client';
import {
  CurrentUser,
  type AuthUserPayload,
} from '../common/decorators/current-user.decorator';
import { Roles } from '../common/decorators/roles.decorator';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import {
  CreateBlogPostDto,
  ListBlogPostsQueryDto,
  UpdateBlogPostDto,
} from './dto/blog-request.dto';
import { BlogPostResponseDto } from './dto/blog-response.dto';
import { BlogService } from './blog.service';

@Controller('admin/blog')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.ADMIN)
export class BlogAdminController {
  constructor(private readonly blogService: BlogService) {}

  @Get('categories')
  listCategories(): { key: string; label: string }[] {
    return this.blogService.categoryLabels();
  }

  @Get('posts')
  listPosts(
    @Query() query: ListBlogPostsQueryDto,
  ): Promise<BlogPostResponseDto[]> {
    return this.blogService.listAll(query);
  }

  @Get('posts/:id')
  getPost(@Param('id') id: string): Promise<BlogPostResponseDto> {
    return this.blogService.getById(id);
  }

  @Post('posts')
  createPost(
    @Body() dto: CreateBlogPostDto,
    @CurrentUser() user: AuthUserPayload,
  ): Promise<BlogPostResponseDto> {
    return this.blogService.create(dto, user.id);
  }

  @Patch('posts/:id')
  updatePost(
    @Param('id') id: string,
    @Body() dto: UpdateBlogPostDto,
  ): Promise<BlogPostResponseDto> {
    return this.blogService.update(id, dto);
  }

  @Patch('posts/:id/archive')
  archivePost(@Param('id') id: string): Promise<BlogPostResponseDto> {
    return this.blogService.archive(id);
  }
}
