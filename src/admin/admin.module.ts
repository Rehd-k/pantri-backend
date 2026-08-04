import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { AdminController } from './admin.controller';
import { AdminService } from './admin.service';
import { PlatformSettingsController } from './platform-settings.controller';

@Module({
  imports: [AuthModule],
  controllers: [AdminController, PlatformSettingsController],
  providers: [AdminService],
})
export class AdminModule {}
