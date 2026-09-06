import { Injectable, NotFoundException } from '@nestjs/common';
import {
  LedgerEntryType,
  OrderFulfillmentStatus,
  PayrollDeductionLineStatus,
  Prisma,
} from '../../generated/prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { AnalyticsInsightService, InsightCard } from './analytics-insight.service';
import {
  AnalyticsFilter,
  CompareMode,
  DateRange,
  MetricDelta,
  NON_QUALIFYING_ORDER,
  PAYROLL_REPAYMENT,
  REFUND_LEDGER,
  addDays,
  buildMetricDelta,
  csvEscape,
  monthKey,
  parseDateRange,
  previousEquivalentRange,
  qualifyingOrderWhere,
  uniqueActors,
} from './analytics-shared';
import { AnalyticsService } from './analytics.service';
import {
  CustomerSegmentKeys,
  EmployeeAnalyticsEvents,
  FUNNEL_EVENTS,
  QUALIFYING_ACTIVITY_EVENTS,
  RollupMetricKeys,
} from './taxonomy/analytics-events';

type ProductClassification =
  | 'top_performer'
  | 'hidden_winner'
  | 'browse_not_buy'
  | 'declining'
  | 'normal';
type ExplorerMetric = 'revenue' | 'orders' | 'aov' | 'active_users';
type ExplorerBreakdown = 'employer' | 'month' | 'category';
type CohortType = 'first_purchase' | 'signup' | 'employer_onboard';

export interface Snapshot {
  revenueKobo: number;
  orderCount: number;
  aovKobo: number;
  employeeCount: number;
  newEmployees: number;
  activeUsers: number;
  purchasingEmployees: number;
  repeatPurchasers: number;
  repeatPurchaseRate: number;
  credit: {
    outstandingKobo: number;
    limitKobo: number;
    utilization: number | null;
    accountCount: number;
  };
  payroll: {
    runCount: number;
    expectedKobo: number;
    collectedKobo: number;
    collectionRate: number | null;
  };
}

@Injectable()
export class AnalyticsQueryService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly analytics: AnalyticsService,
    private readonly insights: AnalyticsInsightService,
  ) {}

  parseRange(from?: string, to?: string): DateRange {
    return parseDateRange(from, to);
  }

  async getMeta() {
    void this.analytics;
    return this.insights.getMeta();
  }

  getDefinitions() {
    return this.insights.getDefinitions();
  }

  async getOverview(
    range: DateRange,
    employerId?: string | null,
    compare: CompareMode = 'previous_period',
  ) {
    const meta = await this.getMeta();
    const compareRange = previousEquivalentRange(range, compare);
    const [current, previous, targets, revenue, dau] = await Promise.all([
      this.snapshot(range, employerId),
      compare === 'none'
        ? this.snapshot(range, employerId)
        : this.snapshot(compareRange, employerId),
      this.getTargets(employerId),
      this.dailyRevenueSeries(range, employerId),
      this.dauSeries(range, employerId),
    ]);
    const metric = (
      key: string,
      label: string,
      category: MetricDelta['category'],
      source: MetricDelta['source'],
      currentValue: number,
      previousValue: number,
      unit: MetricDelta['unit'],
    ) =>
      buildMetricDelta({
        key,
        label,
        category,
        source,
        current: currentValue,
        previous: previousValue,
        unit,
        target: targets.get(key) ?? null,
      });
    const scorecard: MetricDelta[] = [
      metric('employees', 'Employees', 'growth', 'business', current.employeeCount, previous.employeeCount, 'count'),
      metric('new_employees', 'New employees', 'growth', 'business', current.newEmployees, previous.newEmployees, 'count'),
      metric('active_users', 'Active users', 'growth', 'behavioral', current.activeUsers, previous.activeUsers, 'count'),
      metric('revenue_kobo', 'Revenue', 'commerce', 'business', current.revenueKobo, previous.revenueKobo, 'kobo'),
      metric('order_count', 'Orders', 'commerce', 'business', current.orderCount, previous.orderCount, 'count'),
      metric('aov_kobo', 'Average order value', 'commerce', 'business', current.aovKobo, previous.aovKobo, 'kobo'),
      metric('repeat_purchasers', 'Repeat purchasers', 'commerce', 'business', current.repeatPurchasers, previous.repeatPurchasers, 'count'),
      metric('repeat_purchase_rate', 'Repeat purchase rate', 'commerce', 'business', current.repeatPurchaseRate, previous.repeatPurchaseRate, 'rate'),
      metric('credit_outstanding_kobo', 'Credit outstanding', 'credit', 'business', current.credit.outstandingKobo, previous.credit.outstandingKobo, 'kobo'),
      metric('credit_utilization', 'Credit utilization', 'credit', 'business', current.credit.utilization ?? 0, previous.credit.utilization ?? 0, 'rate'),
      metric('payroll_expected_kobo', 'Payroll expected', 'payroll', 'business', current.payroll.expectedKobo, previous.payroll.expectedKobo, 'kobo'),
      metric('payroll_collected_kobo', 'Payroll collected', 'payroll', 'business', current.payroll.collectedKobo, previous.payroll.collectedKobo, 'kobo'),
      metric('payroll_collection_rate', 'Payroll collection rate', 'payroll', 'business', current.payroll.collectionRate ?? 0, previous.payroll.collectionRate ?? 0, 'rate'),
    ];
    const drivers = this.insights.buildWhatChangedNarrative(scorecard);
    const [opportunityResult, anomaliesResult] = await Promise.all([
      this.getOpportunities(range, employerId),
      this.getAnomalies(range, employerId),
    ]);
    const insightCards: InsightCard[] = [
      ...opportunityResult.opportunities.slice(0, 3).map((o) => ({
        id: o.id,
        title: o.title,
        body: o.why,
        severity: o.severity,
        href: o.href,
        evidence: o.evidence,
      })),
      ...anomaliesResult.anomalies.slice(0, 2).map((a) => ({
        id: `anomaly-${a.date}`,
        title: `Unusual revenue on ${a.date}`,
        body: `Daily revenue was ${Math.abs(a.zScore).toFixed(1)} standard deviations from the selected-period average.`,
        severity: Math.abs(a.zScore) >= 3 ? ('high' as const) : ('medium' as const),
        href: '/analytics/intelligence',
        evidence: a,
      })),
    ];
    const compareRangeDto = this.serializeRange(compareRange);
    return {
      ...meta,
      range: this.serializeRange(range),
      compareRange: compareRangeDto,
      scorecard,
      whatChanged: {
        narrative: this.insights.composeNarrative(drivers),
        drivers,
        scorecard,
        compareRange: compareRangeDto,
      },
      insights: insightCards,
      series: {
        revenue: revenue.map((r) => ({ date: r.date, value: r.revenueKobo })),
        dau,
      },
      business: {
        revenueKobo: current.revenueKobo,
        orderCount: current.orderCount,
        aovKobo: current.aovKobo,
        employeeCount: current.employeeCount,
        newEmployees: current.newEmployees,
        repeatPurchasers: current.repeatPurchasers,
        repeatPurchaseRate: current.repeatPurchaseRate,
        credit: current.credit,
        payroll: current.payroll,
      },
      behavioral: { activeUsers: current.activeUsers, dauSeries: dau },
    };
  }

  async getFunnels(range: DateRange, employerId?: string | null) {
    const meta = await this.getMeta();
    const [employees, events, orderGroups] = await Promise.all([
      this.prisma.employee.findMany({
        where: {
          ...(employerId ? { employerId } : {}),
          OR: [
            { createdAt: { gte: range.from, lte: range.to } },
            { verifiedAt: { gte: range.from, lte: range.to } },
          ],
        },
        select: { id: true, userId: true, createdAt: true, verifiedAt: true },
        take: 10000,
      }),
      this.prisma.analyticsEvent.findMany({
        where: {
          eventName: { in: Object.values(FUNNEL_EVENTS) },
          occurredAt: { gte: range.from, lte: range.to },
          ...(employerId ? { employerId } : {}),
        },
        select: { eventName: true, employeeId: true, userId: true },
        take: 10000,
      }),
      this.prisma.order.groupBy({
        by: ['employeeId'],
        where: qualifyingOrderWhere(range, employerId),
        _count: { _all: true },
      }),
    ]);
    const eventActors = (eventName: string) =>
      uniqueActors(events.filter((event) => event.eventName === eventName));
    const registered = eventActors(FUNNEL_EVENTS.registered);
    const activated = eventActors(FUNNEL_EVENTS.activated);
    for (const employee of employees) {
      const actor = `e:${employee.id}`;
      if (employee.createdAt >= range.from && employee.createdAt <= range.to) registered.add(actor);
      if (employee.verifiedAt && employee.verifiedAt >= range.from && employee.verifiedAt <= range.to) activated.add(actor);
    }
    const stageActors: Array<[string, string, Set<string>]> = [
      ['registered', FUNNEL_EVENTS.registered, registered],
      ['activated', FUNNEL_EVENTS.activated, activated],
      ['app_opened', FUNNEL_EVENTS.appOpened, eventActors(FUNNEL_EVENTS.appOpened)],
      ['product_viewed', FUNNEL_EVENTS.productViewed, eventActors(FUNNEL_EVENTS.productViewed)],
      ['added_to_cart', FUNNEL_EVENTS.addedToCart, eventActors(FUNNEL_EVENTS.addedToCart)],
      ['checkout_started', FUNNEL_EVENTS.checkoutStarted, eventActors(FUNNEL_EVENTS.checkoutStarted)],
      ['order_submitted', FUNNEL_EVENTS.orderSubmitted, eventActors(FUNNEL_EVENTS.orderSubmitted)],
      [
        'repeat_purchase',
        'business.qualifying_order',
        new Set(orderGroups.filter((row) => row._count._all >= 2).map((row) => `e:${row.employeeId}`)),
      ],
    ];
    let previous: number | null = null;
    const stages = stageActors.map(([key, eventName, actors]) => {
      const count = actors.size;
      const conversion = previous == null ? null : previous > 0 ? count / previous : 0;
      const dropOff = previous == null ? null : previous > 0 ? Math.max(0, (previous - count) / previous) : 0;
      previous = count;
      return {
        key,
        eventName,
        uniqueActors: count,
        conversionFromPrevious: conversion,
        dropOffFromPrevious: dropOff,
      };
    });
    const biggestDropOff =
      stages.slice(1).sort((a, b) => (b.dropOffFromPrevious ?? 0) - (a.dropOffFromPrevious ?? 0))[0]?.key ?? null;
    return { ...meta, stages, biggestDropOff };
  }

  async getProducts(range: DateRange, employerId?: string | null) {
    const meta = await this.getMeta();
    const previousRange = previousEquivalentRange(range);
    const [items, previousItems, viewEvents, orders] = await Promise.all([
      this.prisma.orderItem.groupBy({
        by: ['productId'],
        where: { order: qualifyingOrderWhere(range, employerId) },
        _sum: { quantity: true, lineTotalKobo: true },
        _count: { _all: true },
        orderBy: { _sum: { lineTotalKobo: 'desc' } },
        take: 1000,
      }),
      this.prisma.orderItem.groupBy({
        by: ['productId'],
        where: { order: qualifyingOrderWhere(previousRange, employerId) },
        _sum: { lineTotalKobo: true },
        orderBy: { productId: 'asc' },
        take: 1000,
      }),
      this.prisma.analyticsEvent.findMany({
        where: {
          eventName: EmployeeAnalyticsEvents.PRODUCT_VIEWED,
          occurredAt: { gte: range.from, lte: range.to },
          entityId: { not: null },
          ...(employerId ? { employerId } : {}),
        },
        select: { entityId: true, employeeId: true, userId: true },
        take: 10000,
      }),
      this.prisma.order.findMany({
        where: qualifyingOrderWhere(range, employerId),
        select: { items: { select: { productId: true } } },
        take: 5000,
      }),
    ]);
    const viewsByProduct = new Map<string, Set<string>>();
    for (const event of viewEvents) {
      if (!event.entityId) continue;
      const actors = viewsByProduct.get(event.entityId) ?? new Set<string>();
      for (const actor of uniqueActors([event])) actors.add(actor);
      viewsByProduct.set(event.entityId, actors);
    }
    const ids = [...new Set([...items.map((i) => i.productId), ...viewsByProduct.keys()])];
    const catalog = await this.prisma.marketplaceProduct.findMany({
      where: { id: { in: ids } },
      select: {
        id: true,
        name: true,
        categoryId: true,
        subcategoryId: true,
        category: { select: { name: true } },
        subcategory: { select: { name: true } },
      },
    });
    const catalogById = new Map(catalog.map((p) => [p.id, p]));
    const salesById = new Map(items.map((row) => [row.productId, row]));
    const previousById = new Map(previousItems.map((row) => [row.productId, row._sum.lineTotalKobo ?? 0]));
    const rankedRevenue = items.map((row) => row._sum.lineTotalKobo ?? 0).sort((a, b) => b - a);
    const topThreshold = rankedRevenue[Math.max(0, Math.ceil(rankedRevenue.length * 0.2) - 1)] ?? Number.MAX_SAFE_INTEGER;
    const products = ids
      .map((productId) => {
        const sale = salesById.get(productId);
        const revenueKobo = sale?._sum.lineTotalKobo ?? 0;
        const unitsSold = sale?._sum.quantity ?? 0;
        const views = viewsByProduct.get(productId)?.size ?? 0;
        const conversionRate = views > 0 ? Math.min(1, unitsSold / views) : null;
        const previousRevenue = previousById.get(productId) ?? 0;
        let classification: ProductClassification = 'normal';
        if (revenueKobo > 0 && revenueKobo >= topThreshold) classification = 'top_performer';
        else if (unitsSold > 0 && views <= 2) classification = 'hidden_winner';
        else if (views >= 5 && unitsSold === 0) classification = 'browse_not_buy';
        else if (previousRevenue > 0 && revenueKobo < previousRevenue * 0.75) classification = 'declining';
        const product = catalogById.get(productId);
        return {
          productId,
          name: product?.name ?? productId,
          categoryId: product?.categoryId ?? null,
          category: product?.category.name ?? null,
          subcategoryId: product?.subcategoryId ?? null,
          subcategory: product?.subcategory.name ?? null,
          unitsSold,
          revenueKobo,
          previousRevenueKobo: previousRevenue,
          lineCount: sale?._count._all ?? 0,
          views,
          conversionRate,
          classification,
          source: { sales: 'business' as const, views: 'behavioral' as const },
        };
      })
      .sort((a, b) => b.revenueKobo - a.revenueKobo);
    const categoryMap = new Map<string, { categoryId: string; category: string; unitsSold: number; revenueKobo: number; views: number }>();
    for (const product of products) {
      const key = product.categoryId ?? 'uncategorized';
      const row = categoryMap.get(key) ?? {
        categoryId: key,
        category: product.category ?? 'Uncategorized',
        unitsSold: 0,
        revenueKobo: 0,
        views: 0,
      };
      row.unitsSold += product.unitsSold;
      row.revenueKobo += product.revenueKobo;
      row.views += product.views;
      categoryMap.set(key, row);
    }
    const pairCounts = new Map<string, number>();
    for (const order of orders) {
      const productIds = [...new Set(order.items.map((item) => item.productId))].sort();
      for (let i = 0; i < productIds.length; i += 1) {
        for (let j = i + 1; j < productIds.length; j += 1) {
          const key = `${productIds[i]}|${productIds[j]}`;
          pairCounts.set(key, (pairCounts.get(key) ?? 0) + 1);
        }
      }
    }
    const frequentlyBoughtTogether = [...pairCounts.entries()]
      .map(([key, orderCount]) => {
        const [firstProductId, secondProductId] = key.split('|');
        return {
          firstProductId,
          firstProductName: catalogById.get(firstProductId)?.name ?? firstProductId,
          secondProductId,
          secondProductName: catalogById.get(secondProductId)?.name ?? secondProductId,
          orderCount,
        };
      })
      .sort((a, b) => b.orderCount - a.orderCount)
      .slice(0, 20);
    return {
      ...meta,
      products: products.slice(0, 100),
      frequentlyBoughtTogether,
      categories: [...categoryMap.values()].sort((a, b) => b.revenueKobo - a.revenueKobo),
    };
  }

  async getSearch(range: DateRange, employerId?: string | null) {
    const meta = await this.getMeta();
    const events = await this.prisma.analyticsEvent.findMany({
      where: {
        eventName: {
          in: [
            EmployeeAnalyticsEvents.SEARCH_SUBMITTED,
            EmployeeAnalyticsEvents.SEARCH_RESULTS,
            EmployeeAnalyticsEvents.SEARCH_NO_RESULTS,
          ],
        },
        occurredAt: { gte: range.from, lte: range.to },
        ...(employerId ? { employerId } : {}),
      },
      select: { eventName: true, metadata: true, sessionId: true },
      take: 10000,
    });
    const queries = new Map<string, { count: number; zero: number }>();
    let total = 0;
    let zero = 0;
    for (const event of events) {
      const metadata = this.metadata(event.metadata);
      const query = String(metadata.query ?? metadata.q ?? '').trim().toLowerCase();
      if (!query || event.eventName === EmployeeAnalyticsEvents.SEARCH_RESULTS) continue;
      const noResults =
        event.eventName === EmployeeAnalyticsEvents.SEARCH_NO_RESULTS ||
        Number(metadata.resultCount) === 0;
      const row = queries.get(query) ?? { count: 0, zero: 0 };
      row.count += 1;
      if (noResults) {
        row.zero += 1;
        zero += 1;
      }
      total += 1;
      queries.set(query, row);
    }
    const topQueries = [...queries.entries()]
      .map(([query, counts]) => ({ query, ...counts, zeroResultRate: counts.count ? counts.zero / counts.count : 0 }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 50);
    return {
      ...meta,
      totalSearches: total,
      zeroResultSearches: zero,
      zeroResultRate: total > 0 ? zero / total : 0,
      topQueries,
      unmetDemand: topQueries.filter((q) => q.zero > 0).sort((a, b) => b.zero - a.zero),
      searchToPurchaseRate: null,
      searchToPurchaseNote: 'Not calculated: search and qualifying purchase events are not reliably correlated by session.',
    };
  }

  async getEngagement(range: DateRange, employerId?: string | null) {
    const meta = await this.getMeta();
    const day = { from: this.startOfUtcDay(range.to), to: range.to };
    const week = { from: addDays(range.to, -7), to: range.to };
    const month = { from: addDays(range.to, -30), to: range.to };
    const [dau, wau, mau, sessionRows, activeRows, latestSegmentDate] = await Promise.all([
      this.countActiveActors(day, employerId),
      this.countActiveActors(week, employerId),
      this.countActiveActors(month, employerId),
      this.prisma.analyticsSession.findMany({
        where: {
          startedAt: { gte: range.from, lte: range.to },
          ...(employerId ? { employerId } : {}),
        },
        select: { startedAt: true, lastSeenAt: true, endedAt: true },
        take: 10000,
      }),
      this.prisma.analyticsEvent.groupBy({
        by: ['employeeId'],
        where: {
          eventName: { in: [...QUALIFYING_ACTIVITY_EVENTS] },
          occurredAt: { gte: range.from, lte: range.to },
          employeeId: { not: null },
          ...(employerId ? { employerId } : {}),
        },
        _max: { occurredAt: true },
        orderBy: { _max: { occurredAt: 'desc' } },
        take: 50,
      }),
      this.prisma.analyticsSegmentMembership.aggregate({ _max: { asOfDate: true } }),
    ]);
    const segmentRows = latestSegmentDate._max.asOfDate
      ? await this.prisma.analyticsSegmentMembership.groupBy({
          by: ['segmentKey'],
          where: {
            asOfDate: latestSegmentDate._max.asOfDate,
            segmentKey: { in: [CustomerSegmentKeys.DORMANT, CustomerSegmentKeys.REACTIVATED] },
            ...(employerId ? { employee: { employerId } } : {}),
          },
          _count: { _all: true },
        })
      : [];
    const segmentCount = new Map(segmentRows.map((row) => [row.segmentKey, row._count._all]));
    const durations = sessionRows.map((s) =>
      Math.max(0, (s.endedAt ?? s.lastSeenAt).getTime() - s.startedAt.getTime()),
    );
    return {
      ...meta,
      dau,
      wau,
      mau,
      stickiness: mau > 0 ? dau / mau : null,
      sessions: sessionRows.length,
      avgSessionDurationMs: durations.length
        ? Math.round(durations.reduce((sum, value) => sum + value, 0) / durations.length)
        : 0,
      dauSeries: await this.dauSeries(range, employerId),
      dormantCount: segmentCount.get(CustomerSegmentKeys.DORMANT) ?? 0,
      reactivatedCount: segmentCount.get(CustomerSegmentKeys.REACTIVATED) ?? 0,
      recentlyActive: activeRows.map((row) => ({
        employeeId: row.employeeId,
        lastActiveAt: row._max.occurredAt?.toISOString() ?? null,
      })),
    };
  }

  async getCreditAnalytics(employerId?: string | null) {
    const meta = await this.getMeta();
    const accounts = await this.prisma.creditAccount.findMany({
      where: employerId ? { employee: { employerId } } : undefined,
      select: {
        employeeId: true,
        creditLimitKobo: true,
        manualLimitOverrideKobo: true,
        principalOutstandingKobo: true,
        postedInterestKobo: true,
        postedFeesKobo: true,
        postedPenaltiesKobo: true,
        reservedKobo: true,
        availableKobo: true,
        consecutiveMissedDeductions: true,
        status: true,
        employee: {
          select: {
            employerId: true,
            employer: { select: { name: true } },
            riskProfile: { select: { score: true } },
          },
        },
      },
      take: 10000,
    });
    const [repayments, payrollLines] = await Promise.all([
      this.prisma.ledgerEntry.aggregate({
        where: {
          entryType: PAYROLL_REPAYMENT,
          ...(employerId ? { creditAccount: { employee: { employerId } } } : {}),
        },
        _sum: { amountKobo: true },
        _count: true,
      }),
      this.prisma.payrollDeductionLine.groupBy({
        by: ['employeeId', 'status'],
        where: employerId ? { employee: { employerId } } : undefined,
        _count: { _all: true },
        _sum: { requestedKobo: true, collectedKobo: true },
      }),
    ]);
    const bands = [
      { bucket: '0-24%', count: 0 },
      { bucket: '25-49%', count: 0 },
      { bucket: '50-74%', count: 0 },
      { bucket: '75-84%', count: 0 },
      { bucket: '85-100%+', count: 0 },
    ];
    const exposure = new Map<string, { employerId: string; name: string; outstandingKobo: number; limitKobo: number; accounts: number }>();
    const riskIndicators: Array<{ employeeId: string; indicators: string[]; severity: 'high' | 'medium' | 'low' }> = [];
    let outstandingKobo = 0;
    let limitKobo = 0;
    for (const account of accounts) {
      const limit = account.manualLimitOverrideKobo ?? account.creditLimitKobo;
      const outstanding =
        account.principalOutstandingKobo +
        account.postedInterestKobo +
        account.postedFeesKobo +
        account.postedPenaltiesKobo;
      const utilization = limit > 0 ? outstanding / limit : 0;
      bands[utilization < 0.25 ? 0 : utilization < 0.5 ? 1 : utilization < 0.75 ? 2 : utilization < 0.85 ? 3 : 4].count += 1;
      outstandingKobo += outstanding;
      limitKobo += limit;
      const row = exposure.get(account.employee.employerId) ?? {
        employerId: account.employee.employerId,
        name: account.employee.employer.name,
        outstandingKobo: 0,
        limitKobo: 0,
        accounts: 0,
      };
      row.outstandingKobo += outstanding;
      row.limitKobo += limit;
      row.accounts += 1;
      exposure.set(row.employerId, row);
      const indicators: string[] = [];
      if (utilization >= 0.85) indicators.push('high_utilization');
      if (account.consecutiveMissedDeductions > 0) indicators.push('missed_deductions');
      if ((account.employee.riskProfile?.score ?? 0) >= 70) indicators.push('high_risk_profile');
      if (account.status !== 'ACTIVE') indicators.push(`account_${account.status.toLowerCase()}`);
      if (indicators.length) {
        riskIndicators.push({
          employeeId: account.employeeId,
          indicators,
          severity:
            account.consecutiveMissedDeductions >= 2 || utilization >= 1
              ? 'high'
              : indicators.length >= 2
                ? 'medium'
                : 'low',
        });
      }
    }
    const repaymentExpected = payrollLines.reduce((sum, row) => sum + (row._sum.requestedKobo ?? 0), 0);
    const repaymentCollected = payrollLines.reduce((sum, row) => sum + (row._sum.collectedKobo ?? 0), 0);
    return {
      ...meta,
      outstandingKobo,
      limitKobo,
      utilization: limitKobo > 0 ? outstandingKobo / limitKobo : null,
      accountCount: accounts.length,
      utilizationBands: bands,
      approachingLimit: accounts.filter((a) => {
        const limit = a.manualLimitOverrideKobo ?? a.creditLimitKobo;
        return limit > 0 && a.principalOutstandingKobo / limit >= 0.85;
      }).length,
      riskIndicators: riskIndicators.sort((a, b) => this.severityRank(b.severity) - this.severityRank(a.severity)).slice(0, 100),
      repayment: {
        totalRepaymentsKobo: Math.abs(repayments._sum.amountKobo ?? 0),
        repaymentEntryCount: repayments._count,
        expectedKobo: repaymentExpected,
        collectedKobo: repaymentCollected,
        collectionRate: repaymentExpected > 0 ? repaymentCollected / repaymentExpected : null,
        missedLines: payrollLines
          .filter((row) => row.status === PayrollDeductionLineStatus.MISSED)
          .reduce((sum, row) => sum + row._count._all, 0),
      },
      employerExposure: [...exposure.values()].sort((a, b) => b.outstandingKobo - a.outstandingKobo).slice(0, 25),
    };
  }

  async getEmployersBenchmark(range: DateRange) {
    const meta = await this.getMeta();
    const [employers, employees, orders, events, accounts, payrollLines] = await Promise.all([
      this.prisma.employer.findMany({ select: { id: true, name: true } }),
      this.prisma.employee.findMany({ select: { id: true, employerId: true }, take: 10000 }),
      this.prisma.order.findMany({
        where: qualifyingOrderWhere(range),
        select: { employerId: true, employeeId: true, totalKobo: true },
        take: 10000,
      }),
      this.prisma.analyticsEvent.findMany({
        where: {
          eventName: { in: [...QUALIFYING_ACTIVITY_EVENTS] },
          occurredAt: { gte: range.from, lte: range.to },
          employeeId: { not: null },
        },
        select: { employerId: true, employeeId: true, userId: true },
        take: 10000,
      }),
      this.prisma.creditAccount.findMany({
        select: { principalOutstandingKobo: true, employee: { select: { employerId: true } } },
        take: 10000,
      }),
      this.prisma.payrollDeductionLine.findMany({
        where: { payrollRun: { createdAt: { gte: range.from, lte: range.to } } },
        select: { requestedKobo: true, collectedKobo: true, payrollRun: { select: { employerId: true } } },
        take: 10000,
      }),
    ]);
    const sizes = employers
      .map((employer) => employees.filter((e) => e.employerId === employer.id).length)
      .sort((a, b) => a - b);
    const quartile = (size: number) => {
      if (!sizes.length) return 'unknown';
      const rank = sizes.filter((value) => value <= size).length / sizes.length;
      return rank <= 0.25 ? 'small' : rank <= 0.5 ? 'medium' : rank <= 0.75 ? 'large' : 'enterprise';
    };
    const rows = employers.map((employer) => {
      const employerEmployees = employees.filter((e) => e.employerId === employer.id);
      const employerOrders = orders.filter((o) => o.employerId === employer.id);
      const activeEmployees = new Set(
        events.filter((e) => e.employerId === employer.id && e.employeeId).map((e) => e.employeeId!),
      ).size;
      const revenueKobo = employerOrders.reduce((sum, order) => sum + order.totalKobo, 0);
      const lines = payrollLines.filter((line) => line.payrollRun.employerId === employer.id);
      const expected = lines.reduce((sum, line) => sum + line.requestedKobo, 0);
      const collected = lines.reduce((sum, line) => sum + line.collectedKobo, 0);
      return {
        employerId: employer.id,
        name: employer.name,
        employeeCount: employerEmployees.length,
        activeEmployees,
        adoptionRate: employerEmployees.length ? activeEmployees / employerEmployees.length : 0,
        orderCount: employerOrders.length,
        revenueKobo,
        aovKobo: employerOrders.length ? Math.round(revenueKobo / employerOrders.length) : 0,
        exposureKobo: accounts
          .filter((a) => a.employee.employerId === employer.id)
          .reduce((sum, a) => sum + a.principalOutstandingKobo, 0),
        collectionRate: expected > 0 ? collected / expected : null,
        revenuePerEmployeeKobo: employerEmployees.length ? revenueKobo / employerEmployees.length : 0,
        peerBand: quartile(employerEmployees.length),
      };
    });
    const avgAdoption = this.average(rows.map((r) => r.adoptionRate));
    const avgRevenuePerEmployee = this.average(rows.map((r) => r.revenuePerEmployeeKobo));
    return {
      ...meta,
      platformAverage: { adoptionRate: avgAdoption, revenuePerEmployeeKobo: avgRevenuePerEmployee },
      employers: rows
        .map((row) => ({
          ...row,
          vsPlatformAvg: {
            adoption: row.adoptionRate - avgAdoption,
            revenuePerEmployeeKobo: row.revenuePerEmployeeKobo - avgRevenuePerEmployee,
          },
          peerBandNote: `${row.peerBand} employer by employee-count quartile`,
        }))
        .sort((a, b) => b.revenueKobo - a.revenueKobo),
    };
  }

  async getCartCheckout(range: DateRange, employerId?: string | null) {
    const meta = await this.getMeta();
    const eventNames = [
      EmployeeAnalyticsEvents.CART_VIEWED,
      EmployeeAnalyticsEvents.PRODUCT_ADDED_TO_CART,
      EmployeeAnalyticsEvents.PRODUCT_REMOVED_FROM_CART,
      EmployeeAnalyticsEvents.CHECKOUT_STARTED,
      EmployeeAnalyticsEvents.CHECKOUT_ABANDONED,
      EmployeeAnalyticsEvents.ORDER_SUBMITTED,
    ];
    const events = await this.prisma.analyticsEvent.findMany({
      where: {
        eventName: { in: eventNames },
        occurredAt: { gte: range.from, lte: range.to },
        ...(employerId ? { employerId } : {}),
      },
      select: { eventName: true, metadata: true, entityId: true, employeeId: true, userId: true },
      take: 10000,
    });
    const actorCount = (name: string) => uniqueActors(events.filter((event) => event.eventName === name)).size;
    const cartViews = actorCount(EmployeeAnalyticsEvents.CART_VIEWED);
    const addToCart = actorCount(EmployeeAnalyticsEvents.PRODUCT_ADDED_TO_CART);
    const checkoutStarted = actorCount(EmployeeAnalyticsEvents.CHECKOUT_STARTED);
    const checkoutAbandoned = actorCount(EmployeeAnalyticsEvents.CHECKOUT_ABANDONED);
    const ordersSubmitted = actorCount(EmployeeAnalyticsEvents.ORDER_SUBMITTED);
    const abandoned = new Map<string, number>();
    for (const event of events.filter((e) =>
      [EmployeeAnalyticsEvents.PRODUCT_REMOVED_FROM_CART, EmployeeAnalyticsEvents.CHECKOUT_ABANDONED].includes(
        e.eventName as typeof EmployeeAnalyticsEvents.PRODUCT_REMOVED_FROM_CART,
      ),
    )) {
      const productId = String(this.metadata(event.metadata).productId ?? event.entityId ?? '');
      if (productId) abandoned.set(productId, (abandoned.get(productId) ?? 0) + 1);
    }
    const productIds = [...abandoned.keys()];
    const products = await this.prisma.marketplaceProduct.findMany({
      where: { id: { in: productIds } },
      select: { id: true, name: true },
    });
    const names = new Map(products.map((p) => [p.id, p.name]));
    return {
      ...meta,
      funnel: [
        { key: 'cart_viewed', uniqueActors: cartViews },
        { key: 'added_to_cart', uniqueActors: addToCart },
        { key: 'checkout_started', uniqueActors: checkoutStarted },
        { key: 'order_submitted', uniqueActors: ordersSubmitted },
      ],
      cartViews,
      addToCart,
      checkoutStarted,
      checkoutAbandoned,
      ordersSubmitted,
      cartToCheckoutRate: addToCart > 0 ? checkoutStarted / addToCart : null,
      checkoutCompletionRate: checkoutStarted > 0 ? ordersSubmitted / checkoutStarted : null,
      abandonRate: checkoutStarted > 0 ? checkoutAbandoned / checkoutStarted : null,
      abandonedProducts: [...abandoned.entries()]
        .map(([productId, count]) => ({ productId, name: names.get(productId) ?? productId, count }))
        .sort((a, b) => b.count - a.count)
        .slice(0, 25),
    };
  }

  async getSeasonality(range: DateRange, employerId?: string | null) {
    const meta = await this.getMeta();
    const [orders, employers] = await Promise.all([
      this.prisma.order.findMany({
        where: qualifyingOrderWhere(range, employerId),
        select: { createdAt: true, totalKobo: true, employerId: true },
        take: 10000,
      }),
      this.prisma.employer.findMany({
        where: employerId ? { id: employerId } : undefined,
        select: { id: true, payrollDayOfMonth: true },
      }),
    ]);
    const payrollDays = new Map(employers.map((e) => [e.id, e.payrollDayOfMonth]));
    const byDayOfWeek = Array.from({ length: 7 }, (_, dayOfWeek) => ({ dayOfWeek, orderCount: 0, revenueKobo: 0 }));
    const byHour = Array.from({ length: 24 }, (_, hour) => ({ hour, orderCount: 0, revenueKobo: 0 }));
    const months = new Map<string, { orderCount: number; revenueKobo: number }>();
    const paydayBuckets = new Map<string, { orderCount: number; revenueKobo: number }>();
    for (const order of orders) {
      const day = byDayOfWeek[order.createdAt.getUTCDay()];
      const hour = byHour[order.createdAt.getUTCHours()];
      day.orderCount += 1;
      day.revenueKobo += order.totalKobo;
      hour.orderCount += 1;
      hour.revenueKobo += order.totalKobo;
      const m = monthKey(order.createdAt);
      const month = months.get(m) ?? { orderCount: 0, revenueKobo: 0 };
      month.orderCount += 1;
      month.revenueKobo += order.totalKobo;
      months.set(m, month);
      const payrollDay = payrollDays.get(order.employerId) ?? 15;
      const relative = order.createdAt.getUTCDate() - payrollDay;
      const bucket =
        relative < -7 ? 'more_than_7_days_before' :
          relative < 0 ? '7_days_before' :
            relative <= 2 ? 'payday_to_2_days_after' :
              relative <= 7 ? '3_to_7_days_after' : 'more_than_7_days_after';
      const payday = paydayBuckets.get(bucket) ?? { orderCount: 0, revenueKobo: 0 };
      payday.orderCount += 1;
      payday.revenueKobo += order.totalKobo;
      paydayBuckets.set(bucket, payday);
    }
    return {
      ...meta,
      byDayOfWeek,
      byHour,
      byMonth: [...months.entries()].map(([month, value]) => ({ month, ...value })).sort((a, b) => a.month.localeCompare(b.month)),
      paydayRelative: [...paydayBuckets.entries()].map(([bucket, value]) => ({ bucket, ...value })),
    };
  }

  async explore(params: {
    range: DateRange;
    employerId?: string | null;
    eventName?: string;
    limit?: number;
    offset?: number;
    metric?: ExplorerMetric;
    breakdown?: ExplorerBreakdown;
  }) {
    if (params.metric) {
      return this.exploreMetrics({
        range: params.range,
        employerId: params.employerId,
        metric: params.metric,
        breakdown: params.breakdown ?? 'month',
      });
    }
    const meta = await this.getMeta();
    const take = Math.min(Math.max(params.limit ?? 50, 1), 200);
    const skip = Math.max(params.offset ?? 0, 0);
    const where: Prisma.AnalyticsEventWhereInput = {
      occurredAt: { gte: params.range.from, lte: params.range.to },
      ...(params.employerId ? { employerId: params.employerId } : {}),
      ...(params.eventName ? { eventName: params.eventName } : {}),
    };
    const [total, events] = await Promise.all([
      this.prisma.analyticsEvent.count({ where }),
      this.prisma.analyticsEvent.findMany({
        where,
        orderBy: { occurredAt: 'desc' },
        take,
        skip,
        select: {
          id: true,
          eventName: true,
          occurredAt: true,
          userId: true,
          employeeId: true,
          employerId: true,
          sessionId: true,
          entityType: true,
          entityId: true,
          platform: true,
          appVersion: true,
          metadata: true,
          ingestionSource: true,
        },
      }),
    ]);
    return {
      ...meta,
      mode: 'events',
      total,
      limit: take,
      offset: skip,
      events: events.map((event) => ({ ...event, occurredAt: event.occurredAt.toISOString() })),
    };
  }

  async exploreMetrics(params: {
    range: DateRange;
    employerId?: string | null;
    metric: ExplorerMetric;
    breakdown: ExplorerBreakdown;
  }) {
    const meta = await this.getMeta();
    if (params.metric === 'active_users') {
      const events = await this.prisma.analyticsEvent.findMany({
        where: {
          eventName: { in: [...QUALIFYING_ACTIVITY_EVENTS] },
          occurredAt: { gte: params.range.from, lte: params.range.to },
          ...(params.employerId ? { employerId: params.employerId } : {}),
        },
        select: { occurredAt: true, employerId: true, employeeId: true, userId: true, entityId: true },
        take: 10000,
      });
      const groups = new Map<string, Set<string>>();
      for (const event of events) {
        const key =
          params.breakdown === 'employer' ? event.employerId ?? 'unknown' :
            params.breakdown === 'month' ? monthKey(event.occurredAt) :
              event.entityId ?? 'uncategorized';
        const set = groups.get(key) ?? new Set<string>();
        for (const actor of uniqueActors([event])) set.add(actor);
        groups.set(key, set);
      }
      return { ...meta, mode: 'metrics', metric: params.metric, breakdown: params.breakdown, rows: [...groups].map(([key, actors]) => ({ key, value: actors.size })) };
    }
    const orders = await this.prisma.order.findMany({
      where: qualifyingOrderWhere(params.range, params.employerId),
      select: {
        employerId: true,
        createdAt: true,
        totalKobo: true,
        items: { select: { productId: true, lineTotalKobo: true } },
      },
      take: 10000,
    });
    const productIds = params.breakdown === 'category'
      ? [...new Set(orders.flatMap((o) => o.items.map((i) => i.productId)))]
      : [];
    const products = productIds.length
      ? await this.prisma.marketplaceProduct.findMany({ where: { id: { in: productIds } }, select: { id: true, categoryId: true, category: { select: { name: true } } } })
      : [];
    const productCategory = new Map(products.map((p) => [p.id, { id: p.categoryId, name: p.category.name }]));
    const grouped = new Map<string, { label: string; revenueKobo: number; orders: Set<number> }>();
    orders.forEach((order, index) => {
      if (params.breakdown === 'category') {
        for (const item of order.items) {
          const category = productCategory.get(item.productId) ?? { id: 'uncategorized', name: 'Uncategorized' };
          const row = grouped.get(category.id) ?? { label: category.name, revenueKobo: 0, orders: new Set<number>() };
          row.revenueKobo += item.lineTotalKobo;
          row.orders.add(index);
          grouped.set(category.id, row);
        }
      } else {
        const key = params.breakdown === 'employer' ? order.employerId : monthKey(order.createdAt);
        const row = grouped.get(key) ?? { label: key, revenueKobo: 0, orders: new Set<number>() };
        row.revenueKobo += order.totalKobo;
        row.orders.add(index);
        grouped.set(key, row);
      }
    });
    return {
      ...meta,
      mode: 'metrics',
      metric: params.metric,
      breakdown: params.breakdown,
      rows: [...grouped.entries()].map(([key, row]) => ({
        key,
        label: row.label,
        value:
          params.metric === 'revenue' ? row.revenueKobo :
            params.metric === 'orders' ? row.orders.size :
              row.orders.size ? Math.round(row.revenueKobo / row.orders.size) : 0,
      })),
    };
  }

  async exportCsv(report: string, range: DateRange, employerId?: string | null): Promise<string> {
    if (report === 'events') {
      const data = await this.explore({ range, employerId, limit: 200 });
      if (!('events' in data)) return '';
      const header = 'id,eventName,occurredAt,userId,employeeId,employerId,platform,entityType,entityId';
      return [
        header,
        ...data.events.map((event) =>
          [event.id, event.eventName, event.occurredAt, event.userId ?? '', event.employeeId ?? '', event.employerId ?? '', event.platform ?? '', event.entityType ?? '', event.entityId ?? '']
            .map(csvEscape).join(','),
        ),
      ].join('\n');
    }
    if (report === 'products') {
      const data = await this.getProducts(range, employerId);
      return [
        'productId,name,unitsSold,revenueKobo,views,conversionRate,classification',
        ...data.products.map((p) => [p.productId, p.name, p.unitsSold, p.revenueKobo, p.views, p.conversionRate ?? '', p.classification].map(csvEscape).join(',')),
      ].join('\n');
    }
    if (report === 'orders') {
      const orders = await this.prisma.order.findMany({
        where: qualifyingOrderWhere(range, employerId),
        select: { id: true, employerId: true, employeeId: true, totalKobo: true, fulfillmentStatus: true, createdAt: true },
        take: 5000,
      });
      return [
        'id,employerId,employeeId,totalKobo,fulfillmentStatus,createdAt',
        ...orders.map((o) => [o.id, o.employerId, o.employeeId, o.totalKobo, o.fulfillmentStatus, o.createdAt.toISOString()].map(csvEscape).join(',')),
      ].join('\n');
    }
    if (report === 'employers') {
      const data = await this.getEmployersBenchmark(range);
      return [
        'employerId,name,employeeCount,activeEmployees,adoptionRate,orderCount,revenueKobo,exposureKobo',
        ...data.employers.map((e) =>
          [
            e.employerId,
            e.name,
            e.employeeCount,
            e.activeEmployees,
            e.adoptionRate ?? '',
            e.orderCount,
            e.revenueKobo,
            e.exposureKobo,
          ]
            .map(csvEscape)
            .join(','),
        ),
      ].join('\n');
    }
    if (report === 'segments') {
      const data = await this.getSegments(employerId);
      return [
        'segmentKey,count',
        ...(data.segments ?? []).map((s) =>
          [s.segmentKey, s.count].map(csvEscape).join(','),
        ),
      ].join('\n');
    }
    const overview = await this.getOverview(range, employerId, 'none');
    return [
      'metric,value,source',
      `revenueKobo,${overview.business.revenueKobo},business`,
      `orderCount,${overview.business.orderCount},business`,
      `aovKobo,${overview.business.aovKobo},business`,
      `activeUsers,${overview.behavioral.activeUsers},behavioral`,
      `repeatPurchasers,${overview.business.repeatPurchasers},business`,
    ].join('\n');
  }

  async exportExcel(
    report: string,
    range: DateRange,
    employerId?: string | null,
  ): Promise<Buffer> {
    const ExcelJS = await import('exceljs');
    const workbook = new ExcelJS.Workbook();
    const sheet = workbook.addWorksheet(report);
    const csv = await this.exportCsv(report, range, employerId);
    const lines = csv.split('\n').filter(Boolean);
    for (const line of lines) {
      sheet.addRow(parseCsvLine(line));
    }
    const buf = await workbook.xlsx.writeBuffer();
    return Buffer.from(buf);
  }

  async exportPdf(
    report: string,
    range: DateRange,
    employerId?: string | null,
  ): Promise<Buffer> {
    const PDFDocument = (await import('pdfkit')).default;
    const overview = await this.getOverview(range, employerId, 'previous_period');
    return new Promise((resolve, reject) => {
      const doc = new PDFDocument({ margin: 50 });
      const chunks: Buffer[] = [];
      doc.on('data', (c: Buffer) => chunks.push(c));
      doc.on('end', () => resolve(Buffer.concat(chunks)));
      doc.on('error', reject);
      doc.fontSize(18).text('Pantri Analytics Summary', { underline: true });
      doc.moveDown();
      doc.fontSize(11).text(`Report: ${report}`);
      doc.text(
        `Range: ${range.from.toISOString().slice(0, 10)} → ${range.to.toISOString().slice(0, 10)}`,
      );
      if (employerId) doc.text(`Employer filter: ${employerId}`);
      doc.moveDown();
      doc.text(`Revenue: ₦${((overview.business.revenueKobo ?? 0) / 100).toLocaleString()}`);
      doc.text(`Orders: ${overview.business.orderCount}`);
      doc.text(`AOV: ₦${((overview.business.aovKobo ?? 0) / 100).toLocaleString()}`);
      doc.text(`Active users: ${overview.behavioral.activeUsers}`);
      doc.moveDown();
      doc.fontSize(12).text('What changed');
      doc.fontSize(10).text(overview.whatChanged?.narrative ?? 'n/a');
      doc.moveDown();
      doc.fontSize(9).fillColor('#666').text(
        'Amounts are integer kobo converted for display. Estimated metrics are labeled separately in the admin UI.',
      );
      doc.end();
    });
  }

  async getRfm(employerId?: string | null) {
    const meta = await this.getMeta();
    const orders = await this.prisma.order.findMany({
      where: { fulfillmentStatus: { notIn: NON_QUALIFYING_ORDER }, ...(employerId ? { employerId } : {}) },
      select: { employeeId: true, totalKobo: true, createdAt: true },
      take: 10000,
    });
    const values = new Map<string, { last: Date; frequency: number; monetaryKobo: number }>();
    for (const order of orders) {
      const row = values.get(order.employeeId) ?? { last: order.createdAt, frequency: 0, monetaryKobo: 0 };
      if (order.createdAt > row.last) row.last = order.createdAt;
      row.frequency += 1;
      row.monetaryKobo += order.totalKobo;
      values.set(order.employeeId, row);
    }
    const customers = [...values.entries()].map(([employeeId, value]) => {
      const recencyDays = Math.floor((Date.now() - value.last.getTime()) / 86400000);
      const r = recencyDays <= 30 ? 3 : recencyDays <= 90 ? 2 : 1;
      const f = value.frequency >= 5 ? 3 : value.frequency >= 2 ? 2 : 1;
      const m = value.monetaryKobo >= 5_000_000 ? 3 : value.monetaryKobo >= 1_000_000 ? 2 : 1;
      const score = r + f + m;
      return {
        employeeId,
        recencyDays,
        frequency: value.frequency,
        monetaryKobo: value.monetaryKobo,
        r,
        f,
        m,
        score,
        segment: score >= 8 ? 'Champions' : score >= 6 ? 'Loyal' : score >= 4 ? 'Promising' : 'At risk',
      };
    });
    const segments = customers.reduce<Record<string, number>>((acc, row) => {
      acc[row.segment] = (acc[row.segment] ?? 0) + 1;
      return acc;
    }, {});
    return { ...meta, segments, customers: customers.sort((a, b) => b.score - a.score).slice(0, 100) };
  }

  async getClv(employerId?: string | null) {
    const meta = await this.getMeta();
    const groups = await this.prisma.order.groupBy({
      by: ['employeeId'],
      where: { fulfillmentStatus: { notIn: NON_QUALIFYING_ORDER }, ...(employerId ? { employerId } : {}) },
      _sum: { totalKobo: true },
      _count: { _all: true },
      _min: { createdAt: true },
      _max: { createdAt: true },
      orderBy: { employeeId: 'asc' },
      take: 10000,
    });
    const customers = groups.map((row) => {
      const lifetimeKobo = row._sum.totalKobo ?? 0;
      const first = row._min.createdAt ?? new Date();
      const last = row._max.createdAt ?? first;
      const observedMonths = Math.max(1, (last.getTime() - first.getTime()) / (30 * 86400000));
      const estimatedClvKobo = Math.round(lifetimeKobo / observedMonths) * 12;
      return {
        employeeId: row.employeeId,
        historicalLifetimeKobo: lifetimeKobo,
        historicalLabel: 'Observed lifetime purchase value',
        orderCount: row._count._all,
        avgOrderKobo: row._count._all ? Math.round(lifetimeKobo / row._count._all) : 0,
        estimatedClvKobo,
        estimateLabel: 'Estimated 12-month CLV (heuristic)',
      };
    }).sort((a, b) => b.estimatedClvKobo - a.estimatedClvKobo);
    return {
      ...meta,
      averageHistoricalLifetimeKobo: Math.round(this.average(customers.map((c) => c.historicalLifetimeKobo))),
      averageEstimatedClvKobo: Math.round(this.average(customers.map((c) => c.estimatedClvKobo))),
      customers: customers.slice(0, 100),
    };
  }

  async getCohorts(employerId?: string | null, cohortType: CohortType = 'first_purchase') {
    const meta = await this.getMeta();
    const [employees, orders, employers] = await Promise.all([
      this.prisma.employee.findMany({
        where: employerId ? { employerId } : undefined,
        select: { id: true, employerId: true, createdAt: true },
        take: 10000,
      }),
      this.prisma.order.findMany({
        where: { fulfillmentStatus: { notIn: NON_QUALIFYING_ORDER }, ...(employerId ? { employerId } : {}) },
        select: { employeeId: true, employerId: true, createdAt: true },
        orderBy: { createdAt: 'asc' },
        take: 10000,
      }),
      this.prisma.employer.findMany({
        where: employerId ? { id: employerId } : undefined,
        select: { id: true, createdAt: true },
      }),
    ]);
    const firstOrder = new Map<string, Date>();
    for (const order of orders) if (!firstOrder.has(order.employeeId)) firstOrder.set(order.employeeId, order.createdAt);
    const cohortMembers = new Map<string, Set<string>>();
    if (cohortType === 'employer_onboard') {
      for (const employer of employers) {
        const key = monthKey(employer.createdAt);
        const set = cohortMembers.get(key) ?? new Set<string>();
        set.add(employer.id);
        cohortMembers.set(key, set);
      }
    } else {
      for (const employee of employees) {
        const date = cohortType === 'signup' ? employee.createdAt : firstOrder.get(employee.id);
        if (!date) continue;
        const key = monthKey(date);
        const set = cohortMembers.get(key) ?? new Set<string>();
        set.add(employee.id);
        cohortMembers.set(key, set);
      }
    }
    const cohorts = [...cohortMembers.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([cohortMonth, members]) => {
      const cohortStart = this.parseMonth(cohortMonth);
      const retainedCounts = Array.from({ length: 12 }, (_, offset) => {
        const start = this.addMonths(cohortStart, offset);
        const end = this.addMonths(start, 1);
        const active = new Set(
          orders
            .filter((order) => {
              const memberId = cohortType === 'employer_onboard' ? order.employerId : order.employeeId;
              return members.has(memberId) && order.createdAt >= start && order.createdAt < end;
            })
            .map((order) => cohortType === 'employer_onboard' ? order.employerId : order.employeeId),
        );
        return active.size;
      });
      return {
        cohortMonth,
        cohortType,
        size: members.size,
        retainedCounts,
        retainedRates: retainedCounts.map((count) => members.size ? count / members.size : 0),
      };
    });
    return { ...meta, cohortType, cohorts: cohorts.slice(-24) };
  }

  async getRetention(range: DateRange, employerId?: string | null) {
    const meta = await this.getMeta();
    const windows = [7, 30, 60, 90];
    const baseStart = addDays(range.to, -90);
    const [events, orders] = await Promise.all([
      this.prisma.analyticsEvent.findMany({
        where: {
          eventName: { in: [...QUALIFYING_ACTIVITY_EVENTS] },
          occurredAt: { gte: baseStart, lte: range.to },
          employeeId: { not: null },
          ...(employerId ? { employerId } : {}),
        },
        select: { employeeId: true, occurredAt: true },
        take: 10000,
      }),
      this.prisma.order.findMany({
        where: qualifyingOrderWhere({ from: baseStart, to: range.to }, employerId),
        select: { employeeId: true, createdAt: true },
        take: 10000,
      }),
    ]);
    const measure = (rows: Array<{ employeeId: string | null; at: Date }>, days: number) => {
      const cohortEnd = addDays(range.to, -days);
      const base = new Set(rows.filter((r) => r.at >= range.from && r.at <= cohortEnd && r.employeeId).map((r) => r.employeeId!));
      const retained = new Set(rows.filter((r) => r.at > cohortEnd && r.at <= range.to && r.employeeId && base.has(r.employeeId)).map((r) => r.employeeId!));
      return { days, cohortSize: base.size, retained: retained.size, rate: base.size ? retained.size / base.size : null };
    };
    const activityRows = events.map((e) => ({ employeeId: e.employeeId, at: e.occurredAt }));
    const purchaseRows = orders.map((o) => ({ employeeId: o.employeeId, at: o.createdAt }));
    return {
      ...meta,
      activity: windows.map((days) => measure(activityRows, days)),
      purchase: windows.map((days) => measure(purchaseRows, days)),
      methodology: 'Employees active/purchasing in the eligible base interval who returned within the trailing N-day window.',
    };
  }

  async getSegments(employerId?: string | null) {
    const meta = await this.getMeta();
    const latest = await this.prisma.analyticsSegmentMembership.aggregate({
      where: employerId ? { employee: { employerId } } : undefined,
      _max: { asOfDate: true },
    });
    if (!latest._max.asOfDate) return { ...meta, asOfDate: null, segments: [] };
    const rows = await this.prisma.analyticsSegmentMembership.findMany({
      where: {
        asOfDate: latest._max.asOfDate,
        ...(employerId ? { employee: { employerId } } : {}),
      },
      select: { segmentKey: true, employeeId: true, scores: true },
      take: 10000,
    });
    const grouped = new Map<string, typeof rows>();
    for (const row of rows) grouped.set(row.segmentKey, [...(grouped.get(row.segmentKey) ?? []), row]);
    return {
      ...meta,
      asOfDate: latest._max.asOfDate.toISOString().slice(0, 10),
      segments: [...grouped.entries()].map(([segmentKey, members]) => ({
        segmentKey,
        count: members.length,
        sampleMembers: members.slice(0, 10).map((m) => ({ employeeId: m.employeeId, scores: m.scores })),
      })),
    };
  }

  async getAnomalies(range: DateRange, employerId?: string | null): Promise<{
    collectionStartedAt: string | null;
    behavioralNotice: string;
    metricDefinitions: typeof import('./taxonomy/metric-definitions').METRIC_DEFINITIONS;
    anomalies: Array<{ date: string; value: number; zScore: number }>;
    series: Array<{ date: string; value: number }>;
    threshold: number;
    note: string;
    whatChanged: {
      revenueDeltaKobo: number;
      orderDelta: number;
      activeUserDelta: number;
      firstHalf: Snapshot;
      secondHalf: Snapshot;
    };
  }> {
    const meta = await this.getMeta();
    const revenue = await this.dailyRevenueSeries(range, employerId);
    const series = revenue.map((row) => ({ date: row.date, value: row.revenueKobo }));
    const mid = new Date((range.from.getTime() + range.to.getTime()) / 2);
    const [firstHalf, secondHalf, orderSeries] = await Promise.all([
      this.snapshot({ from: range.from, to: mid }, employerId),
      this.snapshot({ from: mid, to: range.to }, employerId),
      this.prisma.order.groupBy({
        by: ['createdAt'],
        where: qualifyingOrderWhere(range, employerId),
        _count: { _all: true },
      }).catch(() => [] as Array<{ createdAt: Date; _count: { _all: number } }>),
    ]);
    void orderSeries;
    return {
      ...meta,
      anomalies: this.insights.zScoreAnomalies(series),
      series,
      threshold: 2,
      note: 'Anomalies are investigative signals, not fraud determinations.',
      whatChanged: {
        revenueDeltaKobo: secondHalf.revenueKobo - firstHalf.revenueKobo,
        orderDelta: secondHalf.orderCount - firstHalf.orderCount,
        activeUserDelta: secondHalf.activeUsers - firstHalf.activeUsers,
        firstHalf,
        secondHalf,
      },
    };
  }

  async getOpportunities(range: DateRange, employerId?: string | null) {
    const meta = await this.getMeta();
    const [search, cart, products] = await Promise.all([
      this.getSearch(range, employerId),
      this.getCartCheckout(range, employerId),
      this.getProducts(range, employerId),
    ]);
    const opportunities: Array<{
      id: string;
      title: string;
      why: string;
      severity: 'high' | 'medium' | 'low';
      href: string;
      evidence: Record<string, unknown>;
    }> = [];
    if (search.unmetDemand.length) opportunities.push({
      id: 'zero_search',
      title: 'Unmet search demand',
      why: 'Employees are searching for products with no matching results.',
      severity: search.zeroResultRate > 0.2 ? 'high' : 'medium',
      href: '/analytics/search',
      evidence: { zeroResultRate: search.zeroResultRate, queries: search.unmetDemand.slice(0, 5) },
    });
    if ((cart.abandonRate ?? 0) > 0.3) opportunities.push({
      id: 'checkout_abandon',
      title: 'Elevated checkout abandonment',
      why: 'A material share of checkout starters explicitly abandoned checkout.',
      severity: (cart.abandonRate ?? 0) > 0.5 ? 'high' : 'medium',
      href: '/analytics/cart',
      evidence: { abandonRate: cart.abandonRate, products: cart.abandonedProducts.slice(0, 5) },
    });
    const browseNotBuy = products.products.filter((p) => p.classification === 'browse_not_buy').slice(0, 5);
    if (browseNotBuy.length) opportunities.push({
      id: 'browse_not_buy',
      title: 'Product interest is not converting',
      why: 'These products attract views but no qualifying sales.',
      severity: 'medium',
      href: '/analytics/products',
      evidence: { products: browseNotBuy },
    });
    const hiddenWinners = products.products.filter((p) => p.classification === 'hidden_winner').slice(0, 5);
    if (hiddenWinners.length) opportunities.push({
      id: 'hidden_winners',
      title: 'Promote hidden winners',
      why: 'These products sell despite receiving little measured browsing traffic.',
      severity: 'low',
      href: '/analytics/products',
      evidence: { products: hiddenWinners },
    });
    return { ...meta, opportunities };
  }

  async getInventoryDemand(range: DateRange, employerId?: string | null) {
    const meta = await this.getMeta();
    const [products, search] = await Promise.all([this.getProducts(range, employerId), this.getSearch(range, employerId)]);
    return {
      ...meta,
      demand: products.products.map((product) => ({
        productId: product.productId,
        name: product.name,
        unitsSold: product.unitsSold,
        revenueKobo: product.revenueKobo,
        views: product.views,
        classification: product.classification,
        demandSignal:
          product.classification === 'top_performer' || product.unitsSold > 20 ? 'high' :
            product.unitsSold > 5 || product.views > 10 ? 'medium' : 'low',
      })),
      unmetDemand: search.unmetDemand,
      note: 'Demand signals guide assortment; Pantri does not infer warehouse stock from household inventory.',
    };
  }

  async getWhy(range: DateRange, employerId?: string | null, metric: ExplorerMetric = 'revenue') {
    const meta = await this.getMeta();
    const previousRange = previousEquivalentRange(range);
    const [currentOrders, previousOrders, refunds, previousRefunds] = await Promise.all([
      this.orderDetails(range, employerId),
      this.orderDetails(previousRange, employerId),
      this.refundTotal(range, employerId),
      this.refundTotal(previousRange, employerId),
    ]);
    const summarize = (orders: Awaited<ReturnType<AnalyticsQueryService['orderDetails']>>) => ({
      revenueKobo: orders.reduce((sum, o) => sum + o.totalKobo, 0),
      orderCount: orders.length,
      aovKobo: orders.length ? Math.round(orders.reduce((sum, o) => sum + o.totalKobo, 0) / orders.length) : 0,
    });
    const current = summarize(currentOrders);
    const previous = summarize(previousOrders);
    const employers = await this.prisma.employer.findMany({ select: { id: true, name: true } });
    const employerNames = new Map(employers.map((e) => [e.id, e.name]));
    const productIds = [...new Set([...currentOrders, ...previousOrders].flatMap((o) => o.items.map((i) => i.productId)))];
    const catalog = await this.prisma.marketplaceProduct.findMany({
      where: { id: { in: productIds } },
      select: { id: true, name: true, categoryId: true, category: { select: { name: true } } },
    });
    const productMap = new Map(catalog.map((p) => [p.id, p]));
    const movers = (
      dimension: 'employer' | 'category' | 'product',
      orders: typeof currentOrders,
      previousRows: typeof previousOrders,
    ) => {
      const aggregate = (source: typeof orders) => {
        const map = new Map<string, { label: string; value: number }>();
        for (const order of source) {
          if (dimension === 'employer') {
            const row = map.get(order.employerId) ?? { label: employerNames.get(order.employerId) ?? order.employerId, value: 0 };
            row.value += order.totalKobo;
            map.set(order.employerId, row);
          } else {
            for (const item of order.items) {
              const product = productMap.get(item.productId);
              const key = dimension === 'product' ? item.productId : product?.categoryId ?? 'uncategorized';
              const label = dimension === 'product' ? product?.name ?? item.productId : product?.category.name ?? 'Uncategorized';
              const row = map.get(key) ?? { label, value: 0 };
              row.value += item.lineTotalKobo;
              map.set(key, row);
            }
          }
        }
        return map;
      };
      const now = aggregate(orders);
      const before = aggregate(previousRows);
      return [...new Set([...now.keys(), ...before.keys()])].map((key) => ({
        key,
        label: now.get(key)?.label ?? before.get(key)?.label ?? key,
        current: now.get(key)?.value ?? 0,
        previous: before.get(key)?.value ?? 0,
        delta: (now.get(key)?.value ?? 0) - (before.get(key)?.value ?? 0),
      })).sort((a, b) => Math.abs(b.delta) - Math.abs(a.delta)).slice(0, 20);
    };
    const [cancelled, previousCancelled] = await Promise.all([
      this.prisma.order.count({ where: { createdAt: { gte: range.from, lte: range.to }, fulfillmentStatus: OrderFulfillmentStatus.CANCELLED, ...(employerId ? { employerId } : {}) } }),
      this.prisma.order.count({ where: { createdAt: { gte: previousRange.from, lte: previousRange.to }, fulfillmentStatus: OrderFulfillmentStatus.CANCELLED, ...(employerId ? { employerId } : {}) } }),
    ]);
    return {
      ...meta,
      metric,
      range: this.serializeRange(range),
      compareRange: this.serializeRange(previousRange),
      summary: {
        revenueKobo: { current: current.revenueKobo, previous: previous.revenueKobo, delta: current.revenueKobo - previous.revenueKobo },
        orderCount: { current: current.orderCount, previous: previous.orderCount, delta: current.orderCount - previous.orderCount },
        aovKobo: { current: current.aovKobo, previous: previous.aovKobo, delta: current.aovKobo - previous.aovKobo },
        cancellations: { current: cancelled, previous: previousCancelled, delta: cancelled - previousCancelled },
        refundsKobo: { current: refunds, previous: previousRefunds, delta: refunds - previousRefunds },
      },
      byEmployer: movers('employer', currentOrders, previousOrders),
      byCategory: movers('category', currentOrders, previousOrders),
      byProduct: movers('product', currentOrders, previousOrders),
    };
  }

  async getRevenueBreakdown(range: DateRange, employerId?: string | null) {
    const meta = await this.getMeta();
    const orders = await this.prisma.order.findMany({
      where: {
        fulfillmentStatus: { notIn: NON_QUALIFYING_ORDER },
        createdAt: { lte: range.to },
        ...(employerId ? { employerId } : {}),
      },
      select: { employeeId: true, employerId: true, createdAt: true, totalKobo: true, employer: { select: { name: true } } },
      orderBy: { createdAt: 'asc' },
      take: 10000,
    });
    const seen = new Set<string>();
    const months = new Map<string, { revenueKobo: number; firstPurchaseKobo: number; repeatPurchaseKobo: number; orders: number }>();
    const employers = new Map<string, { employerId: string; name: string; revenueKobo: number; firstPurchaseKobo: number; repeatPurchaseKobo: number; orders: number }>();
    for (const order of orders) {
      const first = !seen.has(order.employeeId);
      seen.add(order.employeeId);
      if (order.createdAt < range.from) continue;
      const month = months.get(monthKey(order.createdAt)) ?? { revenueKobo: 0, firstPurchaseKobo: 0, repeatPurchaseKobo: 0, orders: 0 };
      const employer = employers.get(order.employerId) ?? { employerId: order.employerId, name: order.employer.name, revenueKobo: 0, firstPurchaseKobo: 0, repeatPurchaseKobo: 0, orders: 0 };
      for (const row of [month, employer]) {
        row.revenueKobo += order.totalKobo;
        row.orders += 1;
        if (first) row.firstPurchaseKobo += order.totalKobo;
        else row.repeatPurchaseKobo += order.totalKobo;
      }
      months.set(monthKey(order.createdAt), month);
      employers.set(order.employerId, employer);
    }
    return {
      ...meta,
      byMonth: [...months.entries()].map(([month, values]) => ({ month, ...values })).sort((a, b) => a.month.localeCompare(b.month)),
      byEmployer: [...employers.values()].sort((a, b) => b.revenueKobo - a.revenueKobo),
      firstVsRepeat: [...months.values()].reduce(
        (result, row) => ({
          firstPurchaseKobo: result.firstPurchaseKobo + row.firstPurchaseKobo,
          repeatPurchaseKobo: result.repeatPurchaseKobo + row.repeatPurchaseKobo,
        }),
        { firstPurchaseKobo: 0, repeatPurchaseKobo: 0 },
      ),
    };
  }

  async resolveEmployerContext(userId: string): Promise<{ employerId: string }> {
    const membership = await this.prisma.employerMembership.findFirst({
      where: { userId },
      select: { employerId: true },
    });
    if (membership) return membership;
    const user = await this.prisma.user.findUnique({ where: { id: userId }, select: { employerId: true } });
    if (!user?.employerId) throw new NotFoundException('Employer context not found');
    return { employerId: user.employerId };
  }

  private async snapshot(range: DateRange, employerId?: string | null): Promise<Snapshot> {
    const orderWhere = qualifyingOrderWhere(range, employerId);
    const [orders, employeeCount, newEmployees, activeUsers, credit, payroll] = await Promise.all([
      this.prisma.order.groupBy({
        by: ['employeeId'],
        where: orderWhere,
        _sum: { totalKobo: true },
        _count: { _all: true },
      }),
      this.prisma.employee.count({ where: employerId ? { employerId } : undefined }),
      this.prisma.employee.count({
        where: { createdAt: { gte: range.from, lte: range.to }, ...(employerId ? { employerId } : {}) },
      }),
      this.countActiveActors(range, employerId),
      this.creditSnapshot(employerId),
      this.payrollSnapshot(range, employerId),
    ]);
    const revenueKobo = orders.reduce((sum, row) => sum + (row._sum.totalKobo ?? 0), 0);
    const orderCount = orders.reduce((sum, row) => sum + row._count._all, 0);
    const repeatPurchasers = orders.filter((row) => row._count._all >= 2).length;
    return {
      revenueKobo,
      orderCount,
      aovKobo: orderCount ? Math.round(revenueKobo / orderCount) : 0,
      employeeCount,
      newEmployees,
      activeUsers,
      purchasingEmployees: orders.length,
      repeatPurchasers,
      repeatPurchaseRate: orders.length ? repeatPurchasers / orders.length : 0,
      credit,
      payroll,
    };
  }

  private async countActiveActors(range: DateRange, employerId?: string | null): Promise<number> {
    const events = await this.prisma.analyticsEvent.findMany({
      where: {
        eventName: { in: [...QUALIFYING_ACTIVITY_EVENTS] },
        occurredAt: { gte: range.from, lte: range.to },
        ...(employerId ? { employerId } : {}),
      },
      select: { employeeId: true, userId: true },
      take: 10000,
    });
    return uniqueActors(events).size;
  }

  private async dauSeries(range: DateRange, employerId?: string | null) {
    const rollups = await this.prisma.analyticsDailyRollup.findMany({
      where: {
        metricKey: RollupMetricKeys.DAU,
        date: { gte: this.startOfUtcDay(range.from), lte: range.to },
        ...(employerId ? { employerId } : { employerId: null }),
      },
      orderBy: { date: 'asc' },
      take: 1000,
    });
    if (rollups.length) return rollups.map((r) => ({ date: r.date.toISOString().slice(0, 10), dau: r.valueNumeric ?? 0 }));
    const events = await this.prisma.analyticsEvent.findMany({
      where: {
        eventName: { in: [...QUALIFYING_ACTIVITY_EVENTS] },
        occurredAt: { gte: range.from, lte: range.to },
        ...(employerId ? { employerId } : {}),
      },
      select: { occurredAt: true, employeeId: true, userId: true },
      take: 10000,
    });
    const days = new Map<string, Set<string>>();
    for (const event of events) {
      const key = event.occurredAt.toISOString().slice(0, 10);
      const actors = days.get(key) ?? new Set<string>();
      for (const actor of uniqueActors([event])) actors.add(actor);
      days.set(key, actors);
    }
    return [...days.entries()].map(([date, actors]) => ({ date, dau: actors.size })).sort((a, b) => a.date.localeCompare(b.date));
  }

  private async dailyRevenueSeries(range: DateRange, employerId?: string | null) {
    const rollups = await this.prisma.analyticsDailyRollup.findMany({
      where: {
        metricKey: RollupMetricKeys.REVENUE_KOBO,
        date: { gte: this.startOfUtcDay(range.from), lte: range.to },
        ...(employerId ? { employerId } : { employerId: null }),
      },
      orderBy: { date: 'asc' },
      take: 1000,
    });
    if (rollups.length) return rollups.map((r) => ({ date: r.date.toISOString().slice(0, 10), revenueKobo: Math.round(r.valueNumeric ?? 0) }));
    const orders = await this.prisma.order.findMany({
      where: qualifyingOrderWhere(range, employerId),
      select: { createdAt: true, totalKobo: true },
      take: 10000,
    });
    const days = new Map<string, number>();
    for (const order of orders) {
      const key = order.createdAt.toISOString().slice(0, 10);
      days.set(key, (days.get(key) ?? 0) + order.totalKobo);
    }
    return [...days.entries()].map(([date, revenueKobo]) => ({ date, revenueKobo })).sort((a, b) => a.date.localeCompare(b.date));
  }

  private async creditSnapshot(employerId?: string | null) {
    const accounts = await this.prisma.creditAccount.findMany({
      where: employerId ? { employee: { employerId } } : undefined,
      select: {
        principalOutstandingKobo: true,
        postedInterestKobo: true,
        postedFeesKobo: true,
        postedPenaltiesKobo: true,
        creditLimitKobo: true,
        manualLimitOverrideKobo: true,
      },
      take: 10000,
    });
    const outstandingKobo = accounts.reduce(
      (sum, a) => sum + a.principalOutstandingKobo + a.postedInterestKobo + a.postedFeesKobo + a.postedPenaltiesKobo,
      0,
    );
    const limitKobo = accounts.reduce((sum, a) => sum + (a.manualLimitOverrideKobo ?? a.creditLimitKobo), 0);
    return { outstandingKobo, limitKobo, utilization: limitKobo ? outstandingKobo / limitKobo : null, accountCount: accounts.length };
  }

  private async payrollSnapshot(range: DateRange, employerId?: string | null) {
    const lines = await this.prisma.payrollDeductionLine.findMany({
      where: {
        payrollRun: {
          createdAt: { gte: range.from, lte: range.to },
          ...(employerId ? { employerId } : {}),
        },
      },
      select: { requestedKobo: true, collectedKobo: true, payrollRunId: true },
      take: 10000,
    });
    const expectedKobo = lines.reduce((sum, line) => sum + line.requestedKobo, 0);
    const collectedKobo = lines.reduce((sum, line) => sum + line.collectedKobo, 0);
    return {
      runCount: new Set(lines.map((line) => line.payrollRunId)).size,
      expectedKobo,
      collectedKobo,
      collectionRate: expectedKobo ? collectedKobo / expectedKobo : null,
    };
  }

  private async getTargets(employerId?: string | null): Promise<Map<string, number>> {
    const rows = await this.prisma.analyticsKpiTarget.findMany({
      where: employerId
        ? { OR: [{ employerId }, { employerId: null }] }
        : { employerId: null },
      orderBy: { employerId: 'desc' },
    });
    const targets = new Map<string, number>();
    for (const row of rows) if (!targets.has(row.metricKey)) targets.set(row.metricKey, row.targetNumeric);
    return targets;
  }

  private async orderDetails(range: DateRange, employerId?: string | null) {
    return this.prisma.order.findMany({
      where: qualifyingOrderWhere(range, employerId),
      select: {
        employerId: true,
        totalKobo: true,
        items: { select: { productId: true, lineTotalKobo: true } },
      },
      take: 10000,
    });
  }

  private async refundTotal(range: DateRange, employerId?: string | null): Promise<number> {
    const result = await this.prisma.ledgerEntry.aggregate({
      where: {
        entryType: REFUND_LEDGER,
        createdAt: { gte: range.from, lte: range.to },
        ...(employerId ? { creditAccount: { employee: { employerId } } } : {}),
      },
      _sum: { amountKobo: true },
    });
    return Math.abs(result._sum.amountKobo ?? 0);
  }

  private metadata(value: Prisma.JsonValue): Record<string, unknown> {
    return value && typeof value === 'object' && !Array.isArray(value)
      ? (value as Record<string, unknown>)
      : {};
  }

  private serializeRange(range: DateRange) {
    return { from: range.from.toISOString(), to: range.to.toISOString() };
  }

  private startOfUtcDay(date: Date): Date {
    return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
  }

  private parseMonth(key: string): Date {
    const [year, month] = key.split('-').map(Number);
    return new Date(Date.UTC(year, month - 1, 1));
  }

  private addMonths(date: Date, months: number): Date {
    return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + months, 1));
  }

  private average(values: number[]): number {
    return values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : 0;
  }

  private severityRank(severity: 'high' | 'medium' | 'low'): number {
    return severity === 'high' ? 3 : severity === 'medium' ? 2 : 1;
  }
}

function parseCsvLine(line: string): string[] {
  const out: string[] = [];
  let cur = '';
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (inQuotes) {
      if (ch === '"' && line[i + 1] === '"') {
        cur += '"';
        i += 1;
      } else if (ch === '"') {
        inQuotes = false;
      } else {
        cur += ch;
      }
    } else if (ch === '"') {
      inQuotes = true;
    } else if (ch === ',') {
      out.push(cur);
      cur = '';
    } else {
      cur += ch;
    }
  }
  out.push(cur);
  return out;
}
