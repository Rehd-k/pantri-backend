import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { AdminAnalyticsController } from './admin-analytics.controller';
import { AnalyticsAggregationService } from './analytics-aggregation.service';
import { AnalyticsIngestController } from './analytics-ingest.controller';
import { AnalyticsInsightService } from './analytics-insight.service';
import { AnalyticsQueryService } from './analytics-query.service';
import { AnalyticsService } from './analytics.service';
import { EmployerAnalyticsController } from './employer-analytics.controller';

@Module({
  imports: [PrismaModule],
  controllers: [
    AnalyticsIngestController,
    AdminAnalyticsController,
    EmployerAnalyticsController,
  ],
  providers: [
    AnalyticsService,
    AnalyticsInsightService,
    AnalyticsQueryService,
    AnalyticsAggregationService,
  ],
  exports: [
    AnalyticsService,
    AnalyticsQueryService,
    AnalyticsAggregationService,
    AnalyticsInsightService,
  ],
})
export class AnalyticsModule {}
