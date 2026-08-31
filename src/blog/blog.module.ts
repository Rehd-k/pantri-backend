import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { BlogAdminController } from './blog-admin.controller';
import { BlogPublicController } from './blog-public.controller';
import { BlogService } from './blog.service';

@Module({
  imports: [AuthModule],
  controllers: [BlogPublicController, BlogAdminController],
  providers: [BlogService],
  exports: [BlogService],
})
export class BlogModule {}
