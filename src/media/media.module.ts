import { Module } from '@nestjs/common';
import { MediaController } from './media.controller';
import { MediaService } from './media.service';

/**
 * Auth is not imported here: AppModule already loads AuthModule, and importing
 * it from MediaModule creates Auth → Verification → Media → Auth cycles.
 */
@Module({
  controllers: [MediaController],
  providers: [MediaService],
  exports: [MediaService],
})
export class MediaModule {}
