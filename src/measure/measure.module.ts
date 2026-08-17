import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { MeasureAdminController } from './measure-admin.controller';
import { MeasureController } from './measure.controller';
import { MeasureService } from './measure.service';

@Module({
  imports: [AuthModule],
  controllers: [MeasureController, MeasureAdminController],
  providers: [MeasureService],
  exports: [MeasureService],
})
export class MeasureModule {}
