-- Enterprise analytics: segment membership + KPI targets

CREATE TABLE "AnalyticsSegmentMembership" (
    "id" TEXT NOT NULL,
    "employeeId" TEXT NOT NULL,
    "segmentKey" TEXT NOT NULL,
    "asOfDate" DATE NOT NULL,
    "scores" JSONB NOT NULL DEFAULT '{}',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AnalyticsSegmentMembership_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "AnalyticsKpiTarget" (
    "id" TEXT NOT NULL,
    "metricKey" TEXT NOT NULL,
    "period" TEXT NOT NULL DEFAULT 'monthly',
    "targetNumeric" DOUBLE PRECISION NOT NULL,
    "employerId" TEXT,
    "label" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AnalyticsKpiTarget_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "AnalyticsSegmentMembership_employeeId_segmentKey_asOfDate_key"
  ON "AnalyticsSegmentMembership"("employeeId", "segmentKey", "asOfDate");
CREATE INDEX "AnalyticsSegmentMembership_segmentKey_asOfDate_idx"
  ON "AnalyticsSegmentMembership"("segmentKey", "asOfDate");
CREATE INDEX "AnalyticsSegmentMembership_asOfDate_idx"
  ON "AnalyticsSegmentMembership"("asOfDate");
CREATE INDEX "AnalyticsSegmentMembership_employeeId_asOfDate_idx"
  ON "AnalyticsSegmentMembership"("employeeId", "asOfDate");

CREATE UNIQUE INDEX "AnalyticsKpiTarget_metricKey_period_employerId_key"
  ON "AnalyticsKpiTarget"("metricKey", "period", "employerId");
CREATE INDEX "AnalyticsKpiTarget_metricKey_idx" ON "AnalyticsKpiTarget"("metricKey");

ALTER TABLE "AnalyticsSegmentMembership"
  ADD CONSTRAINT "AnalyticsSegmentMembership_employeeId_fkey"
  FOREIGN KEY ("employeeId") REFERENCES "Employee"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Seed default monthly KPI targets (platform-wide; values are illustrative defaults)
INSERT INTO "AnalyticsKpiTarget" ("id", "metricKey", "period", "targetNumeric", "employerId", "label", "createdAt", "updatedAt")
VALUES
  ('kpi_rev_m', 'revenue_kobo', 'monthly', 5000000000, NULL, 'Monthly gross purchase value (kobo)', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('kpi_orders_m', 'order_count', 'monthly', 500, NULL, 'Monthly qualifying orders', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('kpi_active_m', 'active_users', 'monthly', 200, NULL, 'Monthly active employees', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('kpi_collection_m', 'payroll_collection_rate', 'monthly', 0.95, NULL, 'Payroll collection rate', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('kpi_util_m', 'credit_utilization', 'monthly', 0.65, NULL, 'Target credit utilization', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP);
