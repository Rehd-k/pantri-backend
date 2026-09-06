import {
  Controller,
  Get,
  Header,
  Query,
  UseGuards,
} from '@nestjs/common';
import { UserRole } from '../../generated/prisma/client';
import { AnalyticsIngestionSource } from '../../generated/prisma/client';
import {
  CurrentUser,
  type AuthUserPayload,
} from '../common/decorators/current-user.decorator';
import { Roles } from '../common/decorators/roles.decorator';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { AnalyticsQueryService } from './analytics-query.service';
import {
  AnalyticsDateRangeQueryDto,
  AnalyticsExportQueryDto,
} from './dto/analytics.dto';
import { AnalyticsService } from './analytics.service';
import { EmployerAnalyticsEvents } from './taxonomy/analytics-events';

@Controller('employer/analytics')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.EMPLOYER, UserRole.ADMIN)
export class EmployerAnalyticsController {
  constructor(
    private readonly query: AnalyticsQueryService,
    private readonly analytics: AnalyticsService,
  ) {}

  private async scope(user: AuthUserPayload) {
    return this.query.resolveEmployerContext(user.id);
  }

  @Get('definitions')
  definitions() {
    return this.query.getDefinitions();
  }

  @Get('overview')
  async overview(
    @CurrentUser() user: AuthUserPayload,
    @Query() q: AnalyticsDateRangeQueryDto,
  ) {
    const { employerId } = await this.scope(user);
    void this.analytics.trackSafe({
      eventName: EmployerAnalyticsEvents.ANALYTICS_VIEWED,
      userId: user.id,
      employerId,
      ingestionSource: AnalyticsIngestionSource.SERVER,
      metadata: { page: 'overview' },
    });
    return this.query.getOverview(
      this.query.parseRange(q.from, q.to),
      employerId,
    );
  }

  @Get('employees/engagement')
  async engagement(
    @CurrentUser() user: AuthUserPayload,
    @Query() q: AnalyticsDateRangeQueryDto,
  ) {
    const { employerId } = await this.scope(user);
    return this.query.getEngagement(
      this.query.parseRange(q.from, q.to),
      employerId,
    );
  }

  @Get('orders')
  async orders(
    @CurrentUser() user: AuthUserPayload,
    @Query() q: AnalyticsDateRangeQueryDto,
  ) {
    const { employerId } = await this.scope(user);
    const overview = await this.query.getOverview(
      this.query.parseRange(q.from, q.to),
      employerId,
    );
    const funnels = await this.query.getFunnels(
      this.query.parseRange(q.from, q.to),
      employerId,
    );
    return {
      ...overview,
      funnels: funnels.stages,
    };
  }

  @Get('payroll')
  async payroll(
    @CurrentUser() user: AuthUserPayload,
    @Query() q: AnalyticsDateRangeQueryDto,
  ) {
    const { employerId } = await this.scope(user);
    const overview = await this.query.getOverview(
      this.query.parseRange(q.from, q.to),
      employerId,
    );
    return {
      collectionStartedAt: overview.collectionStartedAt,
      behavioralNotice: overview.behavioralNotice,
      payroll: overview.business.payroll,
    };
  }

  @Get('credit')
  async credit(@CurrentUser() user: AuthUserPayload) {
    const { employerId } = await this.scope(user);
    return this.query.getCreditAnalytics(employerId);
  }

  @Get('funnels')
  async funnels(
    @CurrentUser() user: AuthUserPayload,
    @Query() q: AnalyticsDateRangeQueryDto,
  ) {
    const { employerId } = await this.scope(user);
    return this.query.getFunnels(
      this.query.parseRange(q.from, q.to),
      employerId,
    );
  }

  @Get('export')
  @Header('Content-Type', 'text/csv')
  @Header(
    'Content-Disposition',
    'attachment; filename="employer-analytics.csv"',
  )
  async export(
    @CurrentUser() user: AuthUserPayload,
    @Query() q: AnalyticsExportQueryDto,
  ) {
    const { employerId } = await this.scope(user);
    void this.analytics.trackSafe({
      eventName: EmployerAnalyticsEvents.EXPORT_PERFORMED,
      userId: user.id,
      employerId,
      metadata: { report: q.report ?? 'overview' },
    });
    return this.query.exportCsv(
      q.report ?? 'overview',
      this.query.parseRange(q.from, q.to),
      employerId,
    );
  }
}
