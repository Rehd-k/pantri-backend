import {
  ALL_ANALYTICS_EVENTS,
  CustomerSegmentKeys,
  EmployeeAnalyticsEvents,
  isKnownAnalyticsEvent,
  QUALIFYING_ACTIVITY_EVENTS,
  RollupMetricKeys,
} from './taxonomy/analytics-events';
import { sanitizeMetadata } from './sanitize-metadata';
import { LEARNING_CENTER, METRIC_DEFINITIONS } from './taxonomy/metric-definitions';

describe('analytics taxonomy', () => {
  it('exposes a non-empty canonical event list', () => {
    expect(ALL_ANALYTICS_EVENTS.length).toBeGreaterThan(20);
    expect(isKnownAnalyticsEvent(EmployeeAnalyticsEvents.PRODUCT_VIEWED)).toBe(
      true,
    );
    expect(isKnownAnalyticsEvent('random.fake_event')).toBe(false);
  });

  it('includes notification and account lifecycle events', () => {
    expect(
      isKnownAnalyticsEvent(EmployeeAnalyticsEvents.NOTIFICATION_OPENED),
    ).toBe(true);
    expect(
      isKnownAnalyticsEvent(EmployeeAnalyticsEvents.ACCOUNT_DEACTIVATED),
    ).toBe(true);
  });

  it('counts product and checkout events as qualifying activity', () => {
    expect(
      QUALIFYING_ACTIVITY_EVENTS.has(EmployeeAnalyticsEvents.PRODUCT_VIEWED),
    ).toBe(true);
    expect(
      QUALIFYING_ACTIVITY_EVENTS.has(EmployeeAnalyticsEvents.ORDER_SUBMITTED),
    ).toBe(true);
    expect(
      QUALIFYING_ACTIVITY_EVENTS.has(EmployeeAnalyticsEvents.SESSION_ENDED),
    ).toBe(false);
  });

  it('defines customer segments and rollup keys', () => {
    expect(CustomerSegmentKeys.DORMANT).toBe('dormant');
    expect(RollupMetricKeys.REVENUE_KOBO).toBe('revenue_kobo');
  });
});

describe('sanitizeMetadata', () => {
  it('strips sensitive keys and truncates long strings', () => {
    const out = sanitizeMetadata({
      query: 'rice',
      password: 'secret',
      token: 'abc',
      note: 'x'.repeat(600),
    });
    expect(out.query).toBe('rice');
    expect(out.password).toBeUndefined();
    expect(out.token).toBeUndefined();
    expect(String(out.note).length).toBeLessThanOrEqual(500);
  });
});

describe('metric definitions & learning center', () => {
  it('documents core business and behavioral metrics', () => {
    const ids = new Set(METRIC_DEFINITIONS.map((m) => m.id));
    expect(ids.has('aov')).toBe(true);
    expect(ids.has('clv_estimated')).toBe(true);
    expect(ids.has('clv_historical')).toBe(true);
  });

  it('covers major learning questions', () => {
    expect(LEARNING_CENTER.length).toBeGreaterThanOrEqual(6);
    expect(LEARNING_CENTER.some((t) => t.id === 'coming_back')).toBe(true);
    expect(LEARNING_CENTER.some((t) => t.id === 'sales_fall')).toBe(true);
  });
});

describe('scorecard delta math', () => {
  it('computes percent change for narratives', () => {
    const pct = (current: number, previous: number) =>
      previous === 0 ? (current === 0 ? 0 : null) : (current - previous) / previous;
    expect(pct(118, 100)).toBeCloseTo(0.18);
    expect(pct(50, 0)).toBeNull();
  });
});
