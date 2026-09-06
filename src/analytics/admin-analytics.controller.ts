import {
  Controller,
  ForbiddenException,
  Get,
  Query,
  Res,
  UseGuards,
} from '@nestjs/common';
import type { Response } from 'express';
import { PlatformRole, UserRole } from '../../generated/prisma/client';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import type { AuthUserPayload } from '../common/decorators/current-user.decorator';
import { Roles } from '../common/decorators/roles.decorator';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { AnalyticsQueryService } from './analytics-query.service';
import { CompareMode } from './analytics-shared';
import {
  AnalyticsCohortsQueryDto,
  AnalyticsDateRangeQueryDto,
  AnalyticsExplorerQueryDto,
  AnalyticsExportQueryDto,
  AnalyticsWhyQueryDto,
} from './dto/analytics.dto';

@Controller('admin/analytics')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.ADMIN)
export class AdminAnalyticsController {
  constructor(private readonly query: AnalyticsQueryService) {}

  @Get('definitions')
  definitions() {
    return this.query.getDefinitions();
  }

  @Get('meta')
  meta() {
    return this.query.getMeta();
  }

  @Get('overview')
  overview(@Query() q: AnalyticsDateRangeQueryDto) {
    return this.query.getOverview(
      this.query.parseRange(q.from, q.to),
      q.employerId,
      (q.compare as CompareMode) ?? 'previous_period',
    );
  }

  @Get('funnels')
  funnels(@Query() q: AnalyticsDateRangeQueryDto) {
    return this.query.getFunnels(
      this.query.parseRange(q.from, q.to),
      q.employerId,
    );
  }

  @Get('products')
  products(@Query() q: AnalyticsDateRangeQueryDto) {
    return this.query.getProducts(
      this.query.parseRange(q.from, q.to),
      q.employerId,
    );
  }

  @Get('search')
  search(@Query() q: AnalyticsDateRangeQueryDto) {
    return this.query.getSearch(
      this.query.parseRange(q.from, q.to),
      q.employerId,
    );
  }

  @Get('users/engagement')
  engagement(@Query() q: AnalyticsDateRangeQueryDto) {
    return this.query.getEngagement(
      this.query.parseRange(q.from, q.to),
      q.employerId,
    );
  }

  @Get('credit')
  credit(
    @Query() q: AnalyticsDateRangeQueryDto,
    @CurrentUser() user: AuthUserPayload,
  ) {
    this.assertFinanceAccess(user);
    return this.query.getCreditAnalytics(q.employerId);
  }

  @Get('employers')
  employers(@Query() q: AnalyticsDateRangeQueryDto) {
    return this.query.getEmployersBenchmark(
      this.query.parseRange(q.from, q.to),
    );
  }

  @Get('cart-checkout')
  cartCheckout(@Query() q: AnalyticsDateRangeQueryDto) {
    return this.query.getCartCheckout(
      this.query.parseRange(q.from, q.to),
      q.employerId,
    );
  }

  @Get('seasonality')
  seasonality(@Query() q: AnalyticsDateRangeQueryDto) {
    return this.query.getSeasonality(
      this.query.parseRange(q.from, q.to),
      q.employerId,
    );
  }

  @Get('explorer')
  explorer(@Query() q: AnalyticsExplorerQueryDto) {
    if (q.mode === 'metrics') {
      return this.query.exploreMetrics({
        range: this.query.parseRange(q.from, q.to),
        employerId: q.employerId,
        metric: q.metric ?? 'revenue',
        breakdown: q.breakdown ?? 'employer',
      });
    }
    return this.query.explore({
      range: this.query.parseRange(q.from, q.to),
      employerId: q.employerId,
      eventName: q.eventName,
      limit: q.limit,
      offset: q.offset,
    });
  }

  @Get('export')
  async export(
    @Query() q: AnalyticsExportQueryDto,
    @Res() res: Response,
  ) {
    const format = q.format ?? 'csv';
    const report = q.report ?? 'overview';
    const range = this.query.parseRange(q.from, q.to);

    if (format === 'csv') {
      const csv = await this.query.exportCsv(report, range, q.employerId);
      res.setHeader('Content-Type', 'text/csv');
      res.setHeader(
        'Content-Disposition',
        `attachment; filename="pantri-analytics-${report}.csv"`,
      );
      res.send(csv);
      return;
    }

    if (format === 'xlsx') {
      const xlsx = await this.query.exportExcel(report, range, q.employerId);
      res.setHeader(
        'Content-Type',
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      );
      res.setHeader(
        'Content-Disposition',
        `attachment; filename="pantri-analytics-${report}.xlsx"`,
      );
      res.send(xlsx);
      return;
    }

    const pdf = await this.query.exportPdf(report, range, q.employerId);
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="pantri-analytics-${report}.pdf"`,
    );
    res.send(pdf);
  }

  @Get('rfm')
  rfm(@Query() q: AnalyticsDateRangeQueryDto) {
    return this.query.getRfm(q.employerId);
  }

  @Get('clv')
  clv(@Query() q: AnalyticsDateRangeQueryDto) {
    return this.query.getClv(q.employerId);
  }

  @Get('cohorts')
  cohorts(@Query() q: AnalyticsCohortsQueryDto) {
    return this.query.getCohorts(q.employerId, q.cohortType ?? 'first_purchase');
  }

  @Get('retention')
  retention(@Query() q: AnalyticsDateRangeQueryDto) {
    return this.query.getRetention(
      this.query.parseRange(q.from, q.to),
      q.employerId,
    );
  }

  @Get('segments')
  segments(@Query() q: AnalyticsDateRangeQueryDto) {
    return this.query.getSegments(q.employerId);
  }

  @Get('anomalies')
  async anomalies(@Query() q: AnalyticsDateRangeQueryDto) {
    return this.query.getAnomalies(
      this.query.parseRange(q.from, q.to),
      q.employerId,
    );
  }

  @Get('opportunities')
  opportunities(@Query() q: AnalyticsDateRangeQueryDto) {
    return this.query.getOpportunities(
      this.query.parseRange(q.from, q.to),
      q.employerId,
    );
  }

  @Get('inventory-demand')
  inventoryDemand(@Query() q: AnalyticsDateRangeQueryDto) {
    return this.query.getInventoryDemand(
      this.query.parseRange(q.from, q.to),
      q.employerId,
    );
  }

  @Get('what-changed')
  whatChanged(@Query() q: AnalyticsDateRangeQueryDto) {
    return this.query.getOverview(
      this.query.parseRange(q.from, q.to),
      q.employerId,
      (q.compare as CompareMode) ?? 'previous_period',
    );
  }

  @Get('why')
  why(@Query() q: AnalyticsWhyQueryDto) {
    return this.query.getWhy(
      this.query.parseRange(q.from, q.to),
      q.employerId,
      q.metric ?? 'revenue',
    );
  }

  @Get('revenue')
  revenue(@Query() q: AnalyticsDateRangeQueryDto) {
    return this.query.getRevenueBreakdown(
      this.query.parseRange(q.from, q.to),
      q.employerId,
    );
  }

  /** Finance-sensitive credit risk: SUPER_ADMIN, FINANCE_OFFICER, AUDITOR, or null platformRole. */
  private assertFinanceAccess(user: AuthUserPayload): void {
    const role = user.platformRole;
    if (
      role == null ||
      role === PlatformRole.SUPER_ADMIN ||
      role === PlatformRole.FINANCE_OFFICER ||
      role === PlatformRole.AUDITOR
    ) {
      return;
    }
    throw new ForbiddenException(
      'Credit analytics requires finance or auditor platform role',
    );
  }
}
