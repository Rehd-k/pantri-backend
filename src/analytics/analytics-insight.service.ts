import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { AnalyticsService } from './analytics.service';
import {
  buildMetricDelta,
  DateRange,
  MetricDelta,
  pctChange,
  previousEquivalentRange,
  CompareMode,
} from './analytics-shared';
import { LEARNING_CENTER, METRIC_DEFINITIONS } from './taxonomy/metric-definitions';

export interface InsightCard {
  id: string;
  title: string;
  body: string;
  severity: 'high' | 'medium' | 'low';
  href: string;
  evidence: Record<string, unknown>;
}

export interface WhatChangedResult {
  narrative: string;
  drivers: Array<{
    key: string;
    label: string;
    deltaPct: number | null;
    contributionNote: string;
  }>;
  scorecard: MetricDelta[];
  compareRange: { from: string; to: string };
}

@Injectable()
export class AnalyticsInsightService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly analytics: AnalyticsService,
  ) {}

  async getMeta() {
    const collectionStartedAt = await this.analytics.getCollectionStartedAt();
    return {
      collectionStartedAt: collectionStartedAt?.toISOString() ?? null,
      behavioralNotice: collectionStartedAt
        ? `Data collection started on ${collectionStartedAt.toISOString().slice(0, 10)}. Historical behavioral data is unavailable before this date.`
        : 'Behavioral analytics collection has not started yet.',
      metricDefinitions: METRIC_DEFINITIONS,
    };
  }

  getDefinitions() {
    return {
      metrics: METRIC_DEFINITIONS,
      learningCenter: LEARNING_CENTER,
    };
  }

  buildWhatChangedNarrative(
    scorecard: MetricDelta[],
  ): WhatChangedResult['drivers'] {
    const material = scorecard
      .filter((m) => m.deltaPct != null && Math.abs(m.deltaPct) >= 0.03)
      .sort(
        (a, b) => Math.abs(b.deltaPct ?? 0) - Math.abs(a.deltaPct ?? 0),
      );

    return material.slice(0, 8).map((m) => {
      const dir = (m.deltaPct ?? 0) > 0 ? 'increased' : 'decreased';
      const pct = m.deltaPct != null ? `${(Math.abs(m.deltaPct) * 100).toFixed(1)}%` : 'n/a';
      return {
        key: m.key,
        label: m.label,
        deltaPct: m.deltaPct,
        contributionNote: `${m.label} ${dir} ${pct} vs previous period.`,
      };
    });
  }

  composeNarrative(drivers: WhatChangedResult['drivers']): string {
    if (drivers.length === 0) {
      return 'No material changes (≥3%) detected versus the comparison period based on available data.';
    }
    const revenue = drivers.find((d) => d.key === 'revenue_kobo');
    const active = drivers.find((d) => d.key === 'active_users');
    const aov = drivers.find((d) => d.key === 'aov_kobo');
    const parts: string[] = [];
    if (revenue) parts.push(revenue.contributionNote);
    if (active) parts.push(active.contributionNote);
    if (aov) parts.push(aov.contributionNote);
    const rest = drivers
      .filter((d) => !['revenue_kobo', 'active_users', 'aov_kobo'].includes(d.key))
      .slice(0, 3)
      .map((d) => d.contributionNote);
    return [...parts, ...rest].join(' ');
  }

  metricDeltaFromPair(
    key: string,
    label: string,
    category: MetricDelta['category'],
    source: MetricDelta['source'],
    current: number,
    previous: number,
    unit: MetricDelta['unit'],
    target?: number | null,
    higherIsBetter = true,
  ): MetricDelta {
    return buildMetricDelta({
      key,
      label,
      category,
      source,
      current,
      previous,
      unit,
      target,
      higherIsBetter,
    });
  }

  compareRanges(range: DateRange, mode: CompareMode = 'previous_period') {
    return {
      current: range,
      previous: previousEquivalentRange(range, mode),
    };
  }

  zScoreAnomalies(
    series: Array<{ date: string; value: number }>,
    threshold = 2,
  ): Array<{ date: string; value: number; zScore: number }> {
    if (series.length < 3) return [];
    const values = series.map((s) => s.value);
    const mean = values.reduce((a, b) => a + b, 0) / values.length;
    const variance =
      values.reduce((a, b) => a + (b - mean) ** 2, 0) / values.length;
    const std = Math.sqrt(variance) || 1;
    return series
      .map((s) => ({
        date: s.date,
        value: s.value,
        zScore: (s.value - mean) / std,
      }))
      .filter((s) => Math.abs(s.zScore) >= threshold);
  }

  pct = pctChange;
}
