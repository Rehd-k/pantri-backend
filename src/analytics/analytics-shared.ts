import {
  LedgerEntryType,
  OrderFulfillmentStatus,
  Prisma,
} from '../../generated/prisma/client';

export const NON_QUALIFYING_ORDER: OrderFulfillmentStatus[] = [
  OrderFulfillmentStatus.DRAFT,
  OrderFulfillmentStatus.CANCELLED,
];

export type CompareMode =
  | 'previous_period'
  | 'previous_year'
  | 'none';

export interface DateRange {
  from: Date;
  to: Date;
}

export interface AnalyticsFilter {
  range: DateRange;
  compare?: CompareMode;
  employerId?: string | null;
  segmentKey?: string | null;
  categoryId?: string | null;
  orderStatus?: OrderFulfillmentStatus | null;
}

export interface MetricDelta {
  key: string;
  label: string;
  category: 'growth' | 'commerce' | 'credit' | 'payroll' | 'customers';
  source: 'business' | 'behavioral';
  current: number;
  previous: number;
  delta: number;
  deltaPct: number | null;
  unit: 'kobo' | 'count' | 'rate' | 'days';
  target?: number | null;
  vsTargetPct?: number | null;
  trend: 'up' | 'down' | 'flat';
}

export function startOfUtcDay(d: Date): Date {
  return new Date(
    Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()),
  );
}

export function addDays(d: Date, days: number): Date {
  const x = new Date(d);
  x.setUTCDate(x.getUTCDate() + days);
  return x;
}

export function rangeDurationMs(range: DateRange): number {
  return Math.max(1, range.to.getTime() - range.from.getTime());
}

export function previousEquivalentRange(
  range: DateRange,
  mode: CompareMode = 'previous_period',
): DateRange {
  if (mode === 'previous_year') {
    const from = new Date(range.from);
    const to = new Date(range.to);
    from.setUTCFullYear(from.getUTCFullYear() - 1);
    to.setUTCFullYear(to.getUTCFullYear() - 1);
    return { from, to };
  }
  if (mode === 'none') {
    return range;
  }
  const dur = rangeDurationMs(range);
  return {
    from: new Date(range.from.getTime() - dur),
    to: new Date(range.from.getTime()),
  };
}

export function parseDateRange(from?: string, to?: string): DateRange {
  const end = to ? new Date(to) : new Date();
  const start = from
    ? new Date(from)
    : new Date(end.getTime() - 30 * 24 * 60 * 60 * 1000);
  return { from: start, to: end };
}

export function qualifyingOrderWhere(
  range: DateRange,
  employerId?: string | null,
  orderStatus?: OrderFulfillmentStatus | null,
): Prisma.OrderWhereInput {
  return {
    createdAt: { gte: range.from, lte: range.to },
    fulfillmentStatus: orderStatus
      ? orderStatus
      : { notIn: NON_QUALIFYING_ORDER },
    ...(employerId ? { employerId } : {}),
  };
}

export function pctChange(current: number, previous: number): number | null {
  if (previous === 0) {
    return current === 0 ? 0 : null;
  }
  return (current - previous) / previous;
}

export function trendFromDelta(
  deltaPct: number | null,
  higherIsBetter = true,
): 'up' | 'down' | 'flat' {
  if (deltaPct == null || Math.abs(deltaPct) < 0.005) return 'flat';
  const up = deltaPct > 0;
  if (higherIsBetter) return up ? 'up' : 'down';
  return up ? 'down' : 'up';
}

export function buildMetricDelta(input: {
  key: string;
  label: string;
  category: MetricDelta['category'];
  source: MetricDelta['source'];
  current: number;
  previous: number;
  unit: MetricDelta['unit'];
  target?: number | null;
  higherIsBetter?: boolean;
}): MetricDelta {
  const delta = input.current - input.previous;
  const deltaPct = pctChange(input.current, input.previous);
  const vsTargetPct =
    input.target != null && input.target !== 0
      ? (input.current - input.target) / input.target
      : null;
  return {
    key: input.key,
    label: input.label,
    category: input.category,
    source: input.source,
    current: input.current,
    previous: input.previous,
    delta,
    deltaPct,
    unit: input.unit,
    target: input.target ?? null,
    vsTargetPct,
    trend: trendFromDelta(deltaPct, input.higherIsBetter ?? true),
  };
}

export function csvEscape(value: string | number): string {
  const s = String(value);
  if (s.includes(',') || s.includes('"') || s.includes('\n')) {
    return `"${s.replace(/"/g, '""')}"`;
  }
  return s;
}

export function monthKey(d: Date): string {
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`;
}

export function uniqueActors(
  events: Array<{ employeeId: string | null; userId: string | null }>,
): Set<string> {
  const set = new Set<string>();
  for (const e of events) {
    if (e.employeeId) set.add(`e:${e.employeeId}`);
    else if (e.userId) set.add(`u:${e.userId}`);
  }
  return set;
}

export const REFUND_LEDGER = LedgerEntryType.REFUND;
export const PAYROLL_REPAYMENT = LedgerEntryType.PAYROLL_REPAYMENT;
