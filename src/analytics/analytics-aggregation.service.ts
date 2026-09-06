import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import {
  LedgerEntryType,
  OrderFulfillmentStatus,
  Prisma,
} from '../../generated/prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import {
  CustomerSegmentKeys,
  EmployeeAnalyticsEvents,
  QUALIFYING_ACTIVITY_EVENTS,
  RollupMetricKeys,
} from './taxonomy/analytics-events';
import { startOfUtcDay, uniqueActors } from './analytics-shared';

const NON_QUALIFYING: OrderFulfillmentStatus[] = [
  OrderFulfillmentStatus.DRAFT,
  OrderFulfillmentStatus.CANCELLED,
];

@Injectable()
export class AnalyticsAggregationService implements OnModuleInit {
  private readonly logger = new Logger(AnalyticsAggregationService.name);
  private timer: ReturnType<typeof setInterval> | null = null;

  constructor(private readonly prisma: PrismaService) {}

  onModuleInit(): void {
    setTimeout(() => {
      void this.rollUpRecentDays(3);
      void this.rebuildSegmentMemberships();
    }, 15_000);
    this.timer = setInterval(
      () => {
        void this.rollUpRecentDays(2);
        void this.cleanupExpiredRawEvents();
        const hour = new Date().getUTCHours();
        if (hour === 2) {
          void this.rebuildSegmentMemberships();
        }
      },
      60 * 60 * 1000,
    );
  }

  async rollUpRecentDays(dayCount = 2): Promise<void> {
    const today = startOfUtcDay(new Date());
    for (let i = 0; i < dayCount; i++) {
      const day = new Date(today);
      day.setUTCDate(day.getUTCDate() - i);
      try {
        await this.rollUpDay(day);
      } catch (err) {
        this.logger.warn(
          `rollup failed for ${day.toISOString()}: ${
            err instanceof Error ? err.message : String(err)
          }`,
        );
      }
    }
  }

  async rollUpDay(day: Date): Promise<void> {
    const dayStart = startOfUtcDay(day);
    const dayEnd = new Date(dayStart);
    dayEnd.setUTCDate(dayEnd.getUTCDate() + 1);

    const events = await this.prisma.analyticsEvent.findMany({
      where: { occurredAt: { gte: dayStart, lt: dayEnd } },
      select: {
        eventName: true,
        employeeId: true,
        userId: true,
        employerId: true,
        sessionId: true,
      },
    });

    const employerIds = new Set<string | null>([null]);
    for (const e of events) {
      if (e.employerId) employerIds.add(e.employerId);
    }

    // Also include employers that had business activity that day
    const orderEmployers = await this.prisma.order.findMany({
      where: {
        createdAt: { gte: dayStart, lt: dayEnd },
      },
      select: { employerId: true },
      distinct: ['employerId'],
    });
    for (const o of orderEmployers) employerIds.add(o.employerId);

    for (const employerId of employerIds) {
      const scoped =
        employerId === null
          ? events
          : events.filter((e) => e.employerId === employerId);

      const dau = uniqueActors(
        scoped.filter((e) => QUALIFYING_ACTIVITY_EVENTS.has(e.eventName)),
      );
      const sessions = new Set(
        scoped.map((e) => e.sessionId).filter((s): s is string => !!s),
      );
      const productViews = scoped.filter(
        (e) => e.eventName === EmployeeAnalyticsEvents.PRODUCT_VIEWED,
      ).length;
      const addToCart = scoped.filter(
        (e) => e.eventName === EmployeeAnalyticsEvents.PRODUCT_ADDED_TO_CART,
      ).length;
      const checkoutStarted = scoped.filter(
        (e) => e.eventName === EmployeeAnalyticsEvents.CHECKOUT_STARTED,
      ).length;
      const ordersSubmitted = scoped.filter(
        (e) => e.eventName === EmployeeAnalyticsEvents.ORDER_SUBMITTED,
      ).length;
      const searches = scoped.filter(
        (e) =>
          e.eventName === EmployeeAnalyticsEvents.SEARCH_SUBMITTED ||
          e.eventName === EmployeeAnalyticsEvents.SEARCH_RESULTS ||
          e.eventName === EmployeeAnalyticsEvents.SEARCH_NO_RESULTS,
      );
      const zeroResults = scoped.filter(
        (e) => e.eventName === EmployeeAnalyticsEvents.SEARCH_NO_RESULTS,
      ).length;

      await this.upsertRollup(
        dayStart,
        employerId,
        RollupMetricKeys.DAU,
        dau.size,
      );
      await this.upsertRollup(
        dayStart,
        employerId,
        RollupMetricKeys.SESSIONS,
        sessions.size,
      );
      await this.upsertRollup(
        dayStart,
        employerId,
        RollupMetricKeys.PRODUCT_VIEWS,
        productViews,
      );
      await this.upsertRollup(
        dayStart,
        employerId,
        RollupMetricKeys.ADD_TO_CART,
        addToCart,
      );
      await this.upsertRollup(
        dayStart,
        employerId,
        RollupMetricKeys.CHECKOUT_STARTED,
        checkoutStarted,
      );
      await this.upsertRollup(
        dayStart,
        employerId,
        RollupMetricKeys.ORDERS_SUBMITTED,
        ordersSubmitted,
      );
      await this.upsertRollup(
        dayStart,
        employerId,
        RollupMetricKeys.SEARCHES,
        searches.length,
      );
      await this.upsertRollup(
        dayStart,
        employerId,
        RollupMetricKeys.SEARCH_ZERO_RESULTS,
        zeroResults,
      );
      await this.upsertRollup(
        dayStart,
        employerId,
        RollupMetricKeys.EVENT_COUNT,
        scoped.length,
      );

      await this.rollUpBusinessDay(dayStart, dayEnd, employerId);
    }
  }

  private async rollUpBusinessDay(
    dayStart: Date,
    dayEnd: Date,
    employerId: string | null,
  ): Promise<void> {
    const orderWhere: Prisma.OrderWhereInput = {
      createdAt: { gte: dayStart, lt: dayEnd },
      fulfillmentStatus: { notIn: NON_QUALIFYING },
      ...(employerId ? { employerId } : {}),
    };

    const [orderAgg, orderCount, cancelled, newEmployees, newEmployers] =
      await Promise.all([
        this.prisma.order.aggregate({
          where: orderWhere,
          _sum: { totalKobo: true },
          _avg: { totalKobo: true },
        }),
        this.prisma.order.count({ where: orderWhere }),
        this.prisma.order.count({
          where: {
            createdAt: { gte: dayStart, lt: dayEnd },
            fulfillmentStatus: OrderFulfillmentStatus.CANCELLED,
            ...(employerId ? { employerId } : {}),
          },
        }),
        this.prisma.employee.count({
          where: {
            createdAt: { gte: dayStart, lt: dayEnd },
            ...(employerId ? { employerId } : {}),
          },
        }),
        employerId
          ? Promise.resolve(0)
          : this.prisma.employer.count({
              where: { createdAt: { gte: dayStart, lt: dayEnd } },
            }),
      ]);

    const refunds = await this.prisma.ledgerEntry.aggregate({
      where: {
        entryType: LedgerEntryType.REFUND,
        createdAt: { gte: dayStart, lt: dayEnd },
        ...(employerId
          ? { creditAccount: { employee: { employerId } } }
          : {}),
      },
      _sum: { amountKobo: true },
    });

    const payrollRuns = await this.prisma.payrollRun.findMany({
      where: {
        createdAt: { gte: dayStart, lt: dayEnd },
        ...(employerId ? { employerId } : {}),
      },
      include: {
        lines: { select: { requestedKobo: true, collectedKobo: true } },
      },
    });
    let expected = 0;
    let collected = 0;
    for (const run of payrollRuns) {
      for (const line of run.lines) {
        expected += line.requestedKobo ?? 0;
        collected += line.collectedKobo ?? 0;
      }
    }

    const revenue = orderAgg._sum.totalKobo ?? 0;
    await this.upsertRollup(
      dayStart,
      employerId,
      RollupMetricKeys.REVENUE_KOBO,
      revenue,
    );
    await this.upsertRollup(
      dayStart,
      employerId,
      RollupMetricKeys.ORDER_COUNT,
      orderCount,
    );
    await this.upsertRollup(
      dayStart,
      employerId,
      RollupMetricKeys.AOV_KOBO,
      Math.round(orderAgg._avg.totalKobo ?? 0),
    );
    await this.upsertRollup(
      dayStart,
      employerId,
      RollupMetricKeys.NEW_EMPLOYEES,
      newEmployees,
    );
    if (employerId === null) {
      await this.upsertRollup(
        dayStart,
        null,
        RollupMetricKeys.NEW_EMPLOYERS,
        newEmployers,
      );
    }
    await this.upsertRollup(
      dayStart,
      employerId,
      RollupMetricKeys.CANCELLED_ORDERS,
      cancelled,
    );
    await this.upsertRollup(
      dayStart,
      employerId,
      RollupMetricKeys.REFUND_KOBO,
      Math.abs(refunds._sum.amountKobo ?? 0),
    );
    await this.upsertRollup(
      dayStart,
      employerId,
      RollupMetricKeys.PAYROLL_EXPECTED_KOBO,
      expected,
    );
    await this.upsertRollup(
      dayStart,
      employerId,
      RollupMetricKeys.PAYROLL_COLLECTED_KOBO,
      collected,
    );
  }

  /**
   * Rebuilds auto-segment membership for all employees (nightly).
   * Segments are descriptive labels for analytics — not credit decisions.
   */
  async rebuildSegmentMemberships(): Promise<void> {
    const asOf = startOfUtcDay(new Date());
    const now = Date.now();

    const employees = await this.prisma.employee.findMany({
      select: {
        id: true,
        createdAt: true,
        employerId: true,
        creditAccount: {
          select: {
            principalOutstandingKobo: true,
            creditLimitKobo: true,
            manualLimitOverrideKobo: true,
            availableKobo: true,
          },
        },
      },
    });

    const orders = await this.prisma.order.findMany({
      where: { fulfillmentStatus: { notIn: NON_QUALIFYING } },
      select: {
        employeeId: true,
        totalKobo: true,
        createdAt: true,
      },
    });

    const byEmployee = new Map<
      string,
      { count: number; monetary: number; last: Date; first: Date }
    >();
    for (const o of orders) {
      const cur = byEmployee.get(o.employeeId);
      if (!cur) {
        byEmployee.set(o.employeeId, {
          count: 1,
          monetary: o.totalKobo,
          last: o.createdAt,
          first: o.createdAt,
        });
      } else {
        cur.count += 1;
        cur.monetary += o.totalKobo;
        if (o.createdAt > cur.last) cur.last = o.createdAt;
        if (o.createdAt < cur.first) cur.first = o.createdAt;
      }
    }

    // Delete today's memberships then rewrite
    await this.prisma.analyticsSegmentMembership.deleteMany({
      where: { asOfDate: asOf },
    });

    const rows: Prisma.AnalyticsSegmentMembershipCreateManyInput[] = [];

    for (const emp of employees) {
      const hist = byEmployee.get(emp.id);
      const ageDays = Math.floor(
        (now - emp.createdAt.getTime()) / 86400000,
      );
      const recencyDays = hist
        ? Math.floor((now - hist.last.getTime()) / 86400000)
        : null;
      const limit =
        emp.creditAccount?.manualLimitOverrideKobo ??
        emp.creditAccount?.creditLimitKobo ??
        0;
      const outstanding = emp.creditAccount?.principalOutstandingKobo ?? 0;
      const util = limit > 0 ? outstanding / limit : 0;

      const segments: Array<{ key: string; scores: Record<string, number> }> =
        [];

      if (ageDays <= 30 && (!hist || hist.count <= 1)) {
        segments.push({
          key: CustomerSegmentKeys.NEW,
          scores: { ageDays, orders: hist?.count ?? 0 },
        });
      }
      if (hist && recencyDays != null && recencyDays <= 30 && hist.count >= 2) {
        segments.push({
          key: CustomerSegmentKeys.ACTIVE,
          scores: { recencyDays, frequency: hist.count },
        });
      }
      if (hist && hist.monetary >= 5_000_000) {
        segments.push({
          key: CustomerSegmentKeys.HIGH_VALUE,
          scores: { monetaryKobo: hist.monetary },
        });
      }
      if (hist && hist.count >= 5) {
        segments.push({
          key: CustomerSegmentKeys.FREQUENT,
          scores: { frequency: hist.count },
        });
      }
      if (hist && recencyDays != null && recencyDays > 60) {
        segments.push({
          key: CustomerSegmentKeys.DORMANT,
          scores: { recencyDays },
        });
      }
      if (
        hist &&
        recencyDays != null &&
        recencyDays > 30 &&
        recencyDays <= 60 &&
        hist.count >= 2
      ) {
        segments.push({
          key: CustomerSegmentKeys.AT_RISK,
          scores: { recencyDays, frequency: hist.count },
        });
      }
      if (
        hist &&
        recencyDays != null &&
        recencyDays <= 14 &&
        hist.count >= 2
      ) {
        const gap =
          (hist.last.getTime() - hist.first.getTime()) / 86400000;
        if (gap > 45) {
          segments.push({
            key: CustomerSegmentKeys.REACTIVATED,
            scores: { recencyDays, spanDays: gap },
          });
        }
      }
      if (util >= 0.75) {
        segments.push({
          key: CustomerSegmentKeys.CREDIT_HEAVY,
          scores: { utilization: util, outstandingKobo: outstanding },
        });
      }
      if (limit >= 1_000_000 && util < 0.15 && (!hist || hist.count <= 1)) {
        segments.push({
          key: CustomerSegmentKeys.LOW_UTILIZATION,
          scores: { utilization: util, limitKobo: limit },
        });
      }

      // RFM-style labels
      if (hist && recencyDays != null) {
        const r = recencyDays <= 30 ? 3 : recencyDays <= 90 ? 2 : 1;
        const f = hist.count >= 5 ? 3 : hist.count >= 2 ? 2 : 1;
        const m =
          hist.monetary >= 5_000_000 ? 3 : hist.monetary >= 1_000_000 ? 2 : 1;
        const score = r + f + m;
        if (score >= 8) {
          segments.push({
            key: CustomerSegmentKeys.CHAMPIONS,
            scores: { r, f, m, score },
          });
        } else if (score >= 6) {
          segments.push({
            key: CustomerSegmentKeys.LOYAL,
            scores: { r, f, m, score },
          });
        } else if (recencyDays > 90) {
          segments.push({
            key: CustomerSegmentKeys.LOST,
            scores: { r, f, m, score },
          });
        }
      }

      for (const seg of segments) {
        rows.push({
          employeeId: emp.id,
          segmentKey: seg.key,
          asOfDate: asOf,
          scores: seg.scores,
        });
      }
    }

    // Batch insert
    const chunk = 500;
    for (let i = 0; i < rows.length; i += chunk) {
      await this.prisma.analyticsSegmentMembership.createMany({
        data: rows.slice(i, i + chunk),
      });
    }

    // Platform-wide segment counts rollup
    const counts: Record<string, number> = {};
    for (const r of rows) {
      counts[r.segmentKey] = (counts[r.segmentKey] ?? 0) + 1;
    }
    await this.upsertRollupJson(
      asOf,
      null,
      RollupMetricKeys.SEGMENT_COUNTS,
      counts,
    );

    this.logger.log(
      `Rebuilt ${rows.length} segment memberships for ${employees.length} employees`,
    );
  }

  async cleanupExpiredRawEvents(): Promise<void> {
    const settings = await this.prisma.platformSettings.findUnique({
      where: { id: 'default' },
    });
    const days = settings?.analyticsRawRetentionDays ?? 90;
    if (days <= 0) return;
    const cutoff = new Date();
    cutoff.setUTCDate(cutoff.getUTCDate() - days);
    const result = await this.prisma.analyticsEvent.deleteMany({
      where: { occurredAt: { lt: cutoff } },
    });
    if (result.count > 0) {
      this.logger.log(
        `Deleted ${result.count} analytics events older than ${days}d`,
      );
    }
  }

  private async upsertRollup(
    date: Date,
    employerId: string | null,
    metricKey: string,
    valueNumeric: number,
  ): Promise<void> {
    const existing = await this.prisma.analyticsDailyRollup.findFirst({
      where: {
        date,
        metricKey,
        ...(employerId === null ? { employerId: null } : { employerId }),
      },
    });
    if (existing) {
      await this.prisma.analyticsDailyRollup.update({
        where: { id: existing.id },
        data: { valueNumeric },
      });
      return;
    }
    await this.prisma.analyticsDailyRollup.create({
      data: {
        date,
        employerId: employerId ?? undefined,
        metricKey,
        valueNumeric,
      },
    });
  }

  private async upsertRollupJson(
    date: Date,
    employerId: string | null,
    metricKey: string,
    valueJson: Prisma.InputJsonValue,
  ): Promise<void> {
    const existing = await this.prisma.analyticsDailyRollup.findFirst({
      where: {
        date,
        metricKey,
        ...(employerId === null ? { employerId: null } : { employerId }),
      },
    });
    if (existing) {
      await this.prisma.analyticsDailyRollup.update({
        where: { id: existing.id },
        data: { valueJson },
      });
      return;
    }
    await this.prisma.analyticsDailyRollup.create({
      data: {
        date,
        employerId: employerId ?? undefined,
        metricKey,
        valueJson,
      },
    });
  }
}
