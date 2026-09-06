-- CreateEnum
CREATE TYPE "AnalyticsIngestionSource" AS ENUM ('CLIENT', 'SERVER');

-- AlterTable
ALTER TABLE "PlatformSettings" ADD COLUMN IF NOT EXISTS "behavioralCollectionStartedAt" TIMESTAMP(3),
ADD COLUMN IF NOT EXISTS "analyticsRawRetentionDays" INTEGER NOT NULL DEFAULT 90;

-- CreateTable
CREATE TABLE "AnalyticsEvent" (
    "id" TEXT NOT NULL,
    "eventName" TEXT NOT NULL,
    "occurredAt" TIMESTAMP(3) NOT NULL,
    "receivedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "userId" TEXT,
    "employeeId" TEXT,
    "employerId" TEXT,
    "sessionId" TEXT,
    "entityType" TEXT,
    "entityId" TEXT,
    "platform" TEXT,
    "appVersion" TEXT,
    "metadata" JSONB NOT NULL DEFAULT '{}',
    "ingestionSource" "AnalyticsIngestionSource" NOT NULL DEFAULT 'CLIENT',

    CONSTRAINT "AnalyticsEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AnalyticsSession" (
    "id" TEXT NOT NULL,
    "sessionId" TEXT NOT NULL,
    "userId" TEXT,
    "employeeId" TEXT,
    "employerId" TEXT,
    "platform" TEXT,
    "startedAt" TIMESTAMP(3) NOT NULL,
    "lastSeenAt" TIMESTAMP(3) NOT NULL,
    "endedAt" TIMESTAMP(3),
    "eventCount" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AnalyticsSession_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AnalyticsDailyRollup" (
    "id" TEXT NOT NULL,
    "date" DATE NOT NULL,
    "employerId" TEXT,
    "metricKey" TEXT NOT NULL,
    "valueNumeric" DOUBLE PRECISION,
    "valueJson" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AnalyticsDailyRollup_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "AnalyticsEvent_eventName_occurredAt_idx" ON "AnalyticsEvent"("eventName", "occurredAt");
CREATE INDEX "AnalyticsEvent_employerId_occurredAt_idx" ON "AnalyticsEvent"("employerId", "occurredAt");
CREATE INDEX "AnalyticsEvent_employeeId_occurredAt_idx" ON "AnalyticsEvent"("employeeId", "occurredAt");
CREATE INDEX "AnalyticsEvent_userId_occurredAt_idx" ON "AnalyticsEvent"("userId", "occurredAt");
CREATE INDEX "AnalyticsEvent_sessionId_idx" ON "AnalyticsEvent"("sessionId");
CREATE INDEX "AnalyticsEvent_entityType_entityId_idx" ON "AnalyticsEvent"("entityType", "entityId");
CREATE INDEX "AnalyticsEvent_occurredAt_idx" ON "AnalyticsEvent"("occurredAt");

CREATE UNIQUE INDEX "AnalyticsSession_sessionId_key" ON "AnalyticsSession"("sessionId");
CREATE INDEX "AnalyticsSession_userId_startedAt_idx" ON "AnalyticsSession"("userId", "startedAt");
CREATE INDEX "AnalyticsSession_employeeId_startedAt_idx" ON "AnalyticsSession"("employeeId", "startedAt");
CREATE INDEX "AnalyticsSession_employerId_startedAt_idx" ON "AnalyticsSession"("employerId", "startedAt");
CREATE INDEX "AnalyticsSession_startedAt_idx" ON "AnalyticsSession"("startedAt");

CREATE UNIQUE INDEX "AnalyticsDailyRollup_date_employerId_metricKey_key" ON "AnalyticsDailyRollup"("date", "employerId", "metricKey");
CREATE INDEX "AnalyticsDailyRollup_metricKey_date_idx" ON "AnalyticsDailyRollup"("metricKey", "date");
CREATE INDEX "AnalyticsDailyRollup_employerId_date_idx" ON "AnalyticsDailyRollup"("employerId", "date");

-- AddForeignKey
ALTER TABLE "AnalyticsEvent" ADD CONSTRAINT "AnalyticsEvent_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "AnalyticsEvent" ADD CONSTRAINT "AnalyticsEvent_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "Employee"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "AnalyticsEvent" ADD CONSTRAINT "AnalyticsEvent_employerId_fkey" FOREIGN KEY ("employerId") REFERENCES "Employer"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "AnalyticsSession" ADD CONSTRAINT "AnalyticsSession_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "AnalyticsSession" ADD CONSTRAINT "AnalyticsSession_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "Employee"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "AnalyticsSession" ADD CONSTRAINT "AnalyticsSession_employerId_fkey" FOREIGN KEY ("employerId") REFERENCES "Employer"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "AnalyticsDailyRollup" ADD CONSTRAINT "AnalyticsDailyRollup_employerId_fkey" FOREIGN KEY ("employerId") REFERENCES "Employer"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Seed collection start on existing PlatformSettings row (or insert default)
INSERT INTO "PlatformSettings" ("id", "maxInterestAnnualRateBps", "penaltiesEnabledGlobal", "behavioralCollectionStartedAt", "analyticsRawRetentionDays", "updatedAt")
VALUES ('default', 2400, false, CURRENT_TIMESTAMP, 90, CURRENT_TIMESTAMP)
ON CONFLICT ("id") DO UPDATE SET
  "behavioralCollectionStartedAt" = COALESCE("PlatformSettings"."behavioralCollectionStartedAt", CURRENT_TIMESTAMP),
  "analyticsRawRetentionDays" = COALESCE("PlatformSettings"."analyticsRawRetentionDays", 90);
