-- Credit engine migration (data-preserving)
-- Company → Employer, revolving credit tables, dual order statuses

-- ═══ Enums ═══
CREATE TYPE "PlatformRole" AS ENUM ('SUPER_ADMIN', 'FINANCE_OFFICER', 'AUDITOR');
CREATE TYPE "EmployerMembershipRole" AS ENUM ('EMPLOYER_ADMIN', 'PAYROLL_OFFICER', 'FINANCE_OFFICER', 'CREDIT_OFFICER', 'AUDITOR');
CREATE TYPE "EmployeeAccountStatus" AS ENUM ('ACTIVE', 'FROZEN', 'CLOSED');
CREATE TYPE "PayrollFrequency" AS ENUM ('MONTHLY', 'BIWEEKLY', 'WEEKLY');
CREATE TYPE "CreditAccountStatus" AS ENUM ('ACTIVE', 'FROZEN', 'CLOSED');
CREATE TYPE "OverLimitAction" AS ENUM ('REJECT', 'REQUIRE_APPROVAL');
CREATE TYPE "OverDurationAction" AS ENUM ('REJECT', 'REQUIRE_APPROVAL', 'SUGGEST_WAIT', 'ALLOW_HIGHER_DEDUCTION');
CREATE TYPE "LedgerEntryType" AS ENUM ('RESERVATION_CREATED', 'RESERVATION_RELEASED', 'PURCHASE_POSTED', 'DELIVERY_FEE', 'SERVICE_FEE', 'INTEREST', 'PENALTY', 'PAYROLL_REPAYMENT', 'REFUND', 'ADJUSTMENT', 'CREDIT_LIMIT_ADJUSTMENT', 'WRITE_OFF', 'MANUAL_CREDIT', 'MANUAL_DEBIT', 'MIGRATION');
CREATE TYPE "ProductType" AS ENUM ('FOOD', 'ELECTRONICS', 'RENT', 'SCHOOL_FEES', 'HEALTH', 'OTHER');
CREATE TYPE "CreditReservationStatus" AS ENUM ('ACTIVE', 'PARTIALLY_CAPTURED', 'CAPTURED', 'RELEASED', 'EXPIRED');
CREATE TYPE "WriteOffStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED', 'EXECUTED');
CREATE TYPE "OrderFulfillmentStatus" AS ENUM ('DRAFT', 'PENDING_APPROVAL', 'APPROVED', 'PROCESSING', 'READY_FOR_PICKUP', 'OUT_FOR_DELIVERY', 'FULFILLED', 'CANCELLED', 'EXPIRED');
CREATE TYPE "OrderCreditStatus" AS ENUM ('NONE', 'RESERVED', 'PARTIALLY_CAPTURED', 'CAPTURED', 'PARTIALLY_RELEASED', 'RELEASED', 'PARTIALLY_REFUNDED', 'REFUNDED');
CREATE TYPE "PayrollRunStatus" AS ENUM ('DRAFT', 'GENERATED', 'EMPLOYER_REVIEW', 'CONFIRMED', 'PROCESSING', 'COMPLETED', 'PARTIALLY_COMPLETED', 'FAILED', 'CANCELLED');
CREATE TYPE "PayrollDeductionLineStatus" AS ENUM ('PENDING', 'MISSED', 'REMITTED', 'REVERSED');
CREATE TYPE "OutboxEventStatus" AS ENUM ('PENDING', 'PROCESSING', 'PROCESSED', 'FAILED');
CREATE TYPE "NotificationChannel" AS ENUM ('IN_APP', 'PUSH', 'EMAIL');
CREATE TYPE "NotificationDeliveryStatus" AS ENUM ('PENDING', 'SENT', 'FAILED');

-- ═══ Rename Company → Employer ═══
ALTER TABLE "Company" RENAME TO "Employer";
ALTER TABLE "Employer" RENAME CONSTRAINT "Company_pkey" TO "Employer_pkey";
ALTER INDEX IF EXISTS "Company_inviteCode_key" RENAME TO "Employer_inviteCode_key";
ALTER TABLE "Employer" DROP COLUMN IF EXISTS "defaultMonthlyBudgetKobo";
ALTER TABLE "Employer" ADD COLUMN IF NOT EXISTS "payrollFrequency" "PayrollFrequency" NOT NULL DEFAULT 'MONTHLY';

-- ═══ Rename CompanyPickupPoint ═══
ALTER TABLE "CompanyPickupPoint" RENAME TO "EmployerPickupPoint";
ALTER TABLE "EmployerPickupPoint" RENAME CONSTRAINT "CompanyPickupPoint_pkey" TO "EmployerPickupPoint_pkey";
ALTER TABLE "EmployerPickupPoint" RENAME COLUMN "companyId" TO "employerId";
ALTER TABLE "EmployerPickupPoint" DROP CONSTRAINT IF EXISTS "CompanyPickupPoint_companyId_fkey";
DROP INDEX IF EXISTS "CompanyPickupPoint_companyId_isActive_idx";
CREATE INDEX "EmployerPickupPoint_employerId_isActive_idx" ON "EmployerPickupPoint"("employerId", "isActive");
ALTER TABLE "EmployerPickupPoint" ADD CONSTRAINT "EmployerPickupPoint_employerId_fkey" FOREIGN KEY ("employerId") REFERENCES "Employer"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- ═══ User: companyId → employerId, drop budget/location ═══
ALTER TABLE "User" DROP CONSTRAINT IF EXISTS "User_companyId_fkey";
DROP INDEX IF EXISTS "User_companyId_idx";
ALTER TABLE "User" RENAME COLUMN "companyId" TO "employerId";
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "platformRole" "PlatformRole";
ALTER TABLE "User" DROP COLUMN IF EXISTS "monthlyBudgetKobo";
-- Keep location on User temporarily for copy into Employee, then drop
ALTER TABLE "User" ADD CONSTRAINT "User_employerId_fkey" FOREIGN KEY ("employerId") REFERENCES "Employer"("id") ON DELETE SET NULL ON UPDATE CASCADE;
CREATE INDEX "User_employerId_idx" ON "User"("employerId");

-- ═══ EmployerMembership ═══
CREATE TABLE "EmployerMembership" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "employerId" TEXT NOT NULL,
    "role" "EmployerMembershipRole" NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "EmployerMembership_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "EmployerMembership_userId_employerId_role_key" ON "EmployerMembership"("userId", "employerId", "role");
CREATE INDEX "EmployerMembership_employerId_role_idx" ON "EmployerMembership"("employerId", "role");
CREATE INDEX "EmployerMembership_userId_idx" ON "EmployerMembership"("userId");
ALTER TABLE "EmployerMembership" ADD CONSTRAINT "EmployerMembership_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "EmployerMembership" ADD CONSTRAINT "EmployerMembership_employerId_fkey" FOREIGN KEY ("employerId") REFERENCES "Employer"("id") ON DELETE CASCADE ON UPDATE CASCADE;

INSERT INTO "EmployerMembership" ("id", "userId", "employerId", "role", "createdAt", "updatedAt")
SELECT md5(random()::text || clock_timestamp()::text), u."id", u."employerId", 'EMPLOYER_ADMIN'::"EmployerMembershipRole", NOW(), NOW()
FROM "User" u WHERE u."role" = 'EMPLOYER' AND u."employerId" IS NOT NULL;

-- ═══ Employee from EMPLOYEE users ═══
CREATE TABLE "Employee" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "employerId" TEXT NOT NULL,
    "salaryKobo" INTEGER NOT NULL,
    "deductionPercent" INTEGER NOT NULL DEFAULT 20,
    "employmentStartedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "accountStatus" "EmployeeAccountStatus" NOT NULL DEFAULT 'ACTIVE',
    "addressLine" TEXT,
    "city" TEXT,
    "state" TEXT,
    "latitude" DOUBLE PRECISION,
    "longitude" DOUBLE PRECISION,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Employee_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "Employee_userId_key" ON "Employee"("userId");
CREATE INDEX "Employee_employerId_idx" ON "Employee"("employerId");
CREATE INDEX "Employee_employerId_accountStatus_idx" ON "Employee"("employerId", "accountStatus");
CREATE INDEX "Employee_userId_employerId_idx" ON "Employee"("userId", "employerId");
ALTER TABLE "Employee" ADD CONSTRAINT "Employee_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Employee" ADD CONSTRAINT "Employee_employerId_fkey" FOREIGN KEY ("employerId") REFERENCES "Employer"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

INSERT INTO "Employee" ("id", "userId", "employerId", "salaryKobo", "deductionPercent", "employmentStartedAt", "accountStatus", "addressLine", "city", "state", "latitude", "longitude", "createdAt", "updatedAt")
SELECT md5(random()::text || u."id"), u."id", u."employerId", 50000000, 20, u."createdAt", 'ACTIVE'::"EmployeeAccountStatus", u."addressLine", u."city", u."state", u."latitude", u."longitude", u."createdAt", NOW()
FROM "User" u WHERE u."role" = 'EMPLOYEE' AND u."employerId" IS NOT NULL;

-- Drop location from User now that copied
ALTER TABLE "User" DROP COLUMN IF EXISTS "addressLine";
ALTER TABLE "User" DROP COLUMN IF EXISTS "city";
ALTER TABLE "User" DROP COLUMN IF EXISTS "state";
ALTER TABLE "User" DROP COLUMN IF EXISTS "latitude";
ALTER TABLE "User" DROP COLUMN IF EXISTS "longitude";

CREATE TABLE "SalaryHistory" (
    "id" TEXT NOT NULL,
    "employeeId" TEXT NOT NULL,
    "salaryKobo" INTEGER NOT NULL,
    "effectiveAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "reason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "SalaryHistory_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "SalaryHistory_employeeId_effectiveAt_idx" ON "SalaryHistory"("employeeId", "effectiveAt");
ALTER TABLE "SalaryHistory" ADD CONSTRAINT "SalaryHistory_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "Employee"("id") ON DELETE CASCADE ON UPDATE CASCADE;

INSERT INTO "SalaryHistory" ("id", "employeeId", "salaryKobo", "effectiveAt", "reason", "createdAt")
SELECT md5(random()::text || e."id"), e."id", e."salaryKobo", e."employmentStartedAt", 'Initial', NOW()
FROM "Employee" e;

-- ═══ CreditPolicy per employer ═══
CREATE TABLE "CreditPolicy" (
    "id" TEXT NOT NULL,
    "employerId" TEXT NOT NULL,
    "version" INTEGER NOT NULL DEFAULT 1,
    "defaultDeductionPercent" INTEGER NOT NULL DEFAULT 20,
    "minDeductionPercent" INTEGER NOT NULL DEFAULT 10,
    "maxDeductionPercent" INTEGER NOT NULL DEFAULT 35,
    "employeeMaySetDeductionPercent" BOOLEAN NOT NULL DEFAULT true,
    "creditMultiplierBps" INTEGER NOT NULL DEFAULT 15000,
    "maxRepaymentMonths" INTEGER NOT NULL DEFAULT 6,
    "reservationTtlHours" INTEGER NOT NULL DEFAULT 72,
    "approvalTtlHours" INTEGER NOT NULL DEFAULT 72,
    "interestAnnualRateBps" INTEGER NOT NULL DEFAULT 1800,
    "interestGraceDays" INTEGER NOT NULL DEFAULT 30,
    "penaltiesEnabled" BOOLEAN NOT NULL DEFAULT false,
    "minDaysBetweenPurchases" INTEGER NOT NULL DEFAULT 14,
    "maxPurchasesInWindow" INTEGER NOT NULL DEFAULT 2,
    "purchaseWindowDays" INTEGER NOT NULL DEFAULT 30,
    "requirePriorDeductionAfterFirst" BOOLEAN NOT NULL DEFAULT true,
    "overLimitAction" "OverLimitAction" NOT NULL DEFAULT 'REJECT',
    "overDurationAction" "OverDurationAction" NOT NULL DEFAULT 'REJECT',
    "approvalThresholdKobo" INTEGER,
    "requireApprovalFirstPurchase" BOOLEAN NOT NULL DEFAULT false,
    "requireApprovalHighRisk" BOOLEAN NOT NULL DEFAULT true,
    "highRiskScoreThreshold" INTEGER NOT NULL DEFAULT 70,
    "consecutiveMissesBeforeFreeze" INTEGER NOT NULL DEFAULT 3,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "CreditPolicy_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "CreditPolicy_employerId_key" ON "CreditPolicy"("employerId");
ALTER TABLE "CreditPolicy" ADD CONSTRAINT "CreditPolicy_employerId_fkey" FOREIGN KEY ("employerId") REFERENCES "Employer"("id") ON DELETE CASCADE ON UPDATE CASCADE;

INSERT INTO "CreditPolicy" ("id", "employerId", "updatedAt")
SELECT md5(random()::text || e."id"), e."id", NOW() FROM "Employer" e;

-- ═══ CreditAccount ═══
CREATE TABLE "CreditAccount" (
    "id" TEXT NOT NULL,
    "employeeId" TEXT NOT NULL,
    "creditLimitKobo" INTEGER NOT NULL DEFAULT 0,
    "manualLimitOverrideKobo" INTEGER,
    "principalOutstandingKobo" INTEGER NOT NULL DEFAULT 0,
    "postedInterestKobo" INTEGER NOT NULL DEFAULT 0,
    "postedFeesKobo" INTEGER NOT NULL DEFAULT 0,
    "postedPenaltiesKobo" INTEGER NOT NULL DEFAULT 0,
    "reservedKobo" INTEGER NOT NULL DEFAULT 0,
    "accruedInterestUnpostedKobo" INTEGER NOT NULL DEFAULT 0,
    "availableKobo" INTEGER NOT NULL DEFAULT 0,
    "version" INTEGER NOT NULL DEFAULT 0,
    "status" "CreditAccountStatus" NOT NULL DEFAULT 'ACTIVE',
    "consecutiveMissedDeductions" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "CreditAccount_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "CreditAccount_employeeId_key" ON "CreditAccount"("employeeId");
CREATE INDEX "CreditAccount_status_idx" ON "CreditAccount"("status");
ALTER TABLE "CreditAccount" ADD CONSTRAINT "CreditAccount_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "Employee"("id") ON DELETE CASCADE ON UPDATE CASCADE;

INSERT INTO "CreditAccount" ("id", "employeeId", "creditLimitKobo", "availableKobo", "updatedAt")
SELECT md5(random()::text || e."id"), e."id",
  FLOOR(e."salaryKobo" * 15000.0 / 10000)::int,
  FLOOR(e."salaryKobo" * 15000.0 / 10000)::int,
  NOW()
FROM "Employee" e;

-- ═══ RiskProfile ═══
CREATE TABLE "RiskProfile" (
    "id" TEXT NOT NULL,
    "employeeId" TEXT NOT NULL,
    "score" INTEGER NOT NULL DEFAULT 50,
    "factors" JSONB NOT NULL DEFAULT '{}',
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "RiskProfile_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "RiskProfile_employeeId_key" ON "RiskProfile"("employeeId");
ALTER TABLE "RiskProfile" ADD CONSTRAINT "RiskProfile_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "Employee"("id") ON DELETE CASCADE ON UPDATE CASCADE;

INSERT INTO "RiskProfile" ("id", "employeeId", "updatedAt")
SELECT md5(random()::text || e."id"), e."id", NOW() FROM "Employee" e;

-- ═══ Transform Order ═══
ALTER TABLE "Order" DROP CONSTRAINT IF EXISTS "Order_companyId_fkey";
ALTER TABLE "Order" DROP CONSTRAINT IF EXISTS "Order_employeeId_fkey";
ALTER TABLE "Order" DROP CONSTRAINT IF EXISTS "Order_pickupPointId_fkey";
DROP INDEX IF EXISTS "Order_employeeId_companyId_idx";
DROP INDEX IF EXISTS "Order_employeeId_status_createdAt_idx";
DROP INDEX IF EXISTS "Order_id_status_idx";

ALTER TABLE "Order" RENAME COLUMN "companyId" TO "employerId";
ALTER TABLE "Order" ADD COLUMN IF NOT EXISTS "fulfillmentStatus" "OrderFulfillmentStatus";
ALTER TABLE "Order" ADD COLUMN IF NOT EXISTS "creditStatus" "OrderCreditStatus" NOT NULL DEFAULT 'NONE';
ALTER TABLE "Order" ADD COLUMN IF NOT EXISTS "productType" "ProductType" NOT NULL DEFAULT 'FOOD';
ALTER TABLE "Order" ADD COLUMN IF NOT EXISTS "serviceFeeKobo" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "Order" ADD COLUMN IF NOT EXISTS "approvalExpiresAt" TIMESTAMP(3);
ALTER TABLE "Order" ADD COLUMN IF NOT EXISTS "approvedAmountKobo" INTEGER;
ALTER TABLE "Order" ADD COLUMN IF NOT EXISTS "graceInterestStartsAt" TIMESTAMP(3);

UPDATE "Order" SET "fulfillmentStatus" = CASE
  WHEN "status"::text = 'PENDING_APPROVAL' THEN 'PENDING_APPROVAL'::"OrderFulfillmentStatus"
  WHEN "status"::text = 'DISPATCHED' THEN 'OUT_FOR_DELIVERY'::"OrderFulfillmentStatus"
  WHEN "status"::text = 'COMPLETED' THEN 'FULFILLED'::"OrderFulfillmentStatus"
  WHEN "status"::text = 'RETURNED' THEN 'CANCELLED'::"OrderFulfillmentStatus"
  ELSE 'DRAFT'::"OrderFulfillmentStatus"
END
WHERE "fulfillmentStatus" IS NULL;

ALTER TABLE "Order" ALTER COLUMN "fulfillmentStatus" SET NOT NULL;
ALTER TABLE "Order" ALTER COLUMN "fulfillmentStatus" SET DEFAULT 'DRAFT';
ALTER TABLE "Order" DROP COLUMN IF EXISTS "status";

-- Remap employeeId User → Employee
ALTER TABLE "Order" ADD COLUMN "employeeId_new" TEXT;
UPDATE "Order" o SET "employeeId_new" = e."id"
FROM "Employee" e WHERE e."userId" = o."employeeId";
-- Delete orphan orders without employee
DELETE FROM "Order" WHERE "employeeId_new" IS NULL;
ALTER TABLE "Order" DROP COLUMN "employeeId";
ALTER TABLE "Order" RENAME COLUMN "employeeId_new" TO "employeeId";
ALTER TABLE "Order" ALTER COLUMN "employeeId" SET NOT NULL;

ALTER TABLE "OrderItem" ADD COLUMN IF NOT EXISTS "fulfilledQuantity" INTEGER NOT NULL DEFAULT 0;

CREATE INDEX IF NOT EXISTS "Order_employeeId_employerId_idx" ON "Order"("employeeId", "employerId");
CREATE INDEX IF NOT EXISTS "Order_employeeId_fulfillmentStatus_createdAt_idx" ON "Order"("employeeId", "fulfillmentStatus", "createdAt");
CREATE INDEX IF NOT EXISTS "Order_employerId_fulfillmentStatus_idx" ON "Order"("employerId", "fulfillmentStatus");
-- Order_pickupPointId_idx may already exist from prior migrations
CREATE INDEX IF NOT EXISTS "Order_pickupPointId_idx" ON "Order"("pickupPointId");
CREATE INDEX IF NOT EXISTS "Order_creditStatus_fulfillmentStatus_idx" ON "Order"("creditStatus", "fulfillmentStatus");

ALTER TABLE "Order" ADD CONSTRAINT "Order_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "Employee"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Order" ADD CONSTRAINT "Order_employerId_fkey" FOREIGN KEY ("employerId") REFERENCES "Employer"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Order" ADD CONSTRAINT "Order_pickupPointId_fkey" FOREIGN KEY ("pickupPointId") REFERENCES "EmployerPickupPoint"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

DROP TYPE IF EXISTS "OrderStatus";

-- ═══ Migrate outstanding from SCHEDULED installments ═══
UPDATE "CreditAccount" ca SET
  "principalOutstandingKobo" = sub.owed,
  "availableKobo" = GREATEST(0, ca."creditLimitKobo" - sub.owed)
FROM (
  SELECT e."id" AS employee_id,
    COALESCE(SUM(i."amountKobo"), 0)::int AS owed
  FROM "Employee" e
  LEFT JOIN "Order" o ON o."employeeId" = e."id"
  LEFT JOIN "PayrollDeductionPlan" p ON p."orderId" = o."id"
  LEFT JOIN "PayrollDeductionInstallment" i ON i."planId" = p."id" AND i."status" = 'SCHEDULED'
  GROUP BY e."id"
) sub
WHERE ca."employeeId" = sub.employee_id AND sub.owed > 0;

-- Mark fulfilled orders as captured if they had plans
UPDATE "Order" SET "creditStatus" = 'CAPTURED'
WHERE "fulfillmentStatus" = 'FULFILLED';

-- Opening MIGRATION ledger entries
CREATE TABLE "LedgerEntry" (
    "id" TEXT NOT NULL,
    "creditAccountId" TEXT NOT NULL,
    "sequence" INTEGER NOT NULL,
    "entryType" "LedgerEntryType" NOT NULL,
    "amountKobo" INTEGER NOT NULL,
    "balanceAfterKobo" INTEGER NOT NULL,
    "reservedAfterKobo" INTEGER NOT NULL DEFAULT 0,
    "productType" "ProductType",
    "referenceType" TEXT,
    "referenceId" TEXT,
    "idempotencyKey" TEXT,
    "metadata" JSONB NOT NULL DEFAULT '{}',
    "createdByUserId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "LedgerEntry_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "LedgerEntry_creditAccountId_sequence_key" ON "LedgerEntry"("creditAccountId", "sequence");
CREATE UNIQUE INDEX "LedgerEntry_creditAccountId_idempotencyKey_key" ON "LedgerEntry"("creditAccountId", "idempotencyKey");
CREATE INDEX "LedgerEntry_creditAccountId_createdAt_idx" ON "LedgerEntry"("creditAccountId", "createdAt");
CREATE INDEX "LedgerEntry_referenceType_referenceId_idx" ON "LedgerEntry"("referenceType", "referenceId");
CREATE INDEX "LedgerEntry_entryType_createdAt_idx" ON "LedgerEntry"("entryType", "createdAt");
ALTER TABLE "LedgerEntry" ADD CONSTRAINT "LedgerEntry_creditAccountId_fkey" FOREIGN KEY ("creditAccountId") REFERENCES "CreditAccount"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "LedgerEntry" ADD CONSTRAINT "LedgerEntry_createdByUserId_fkey" FOREIGN KEY ("createdByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

INSERT INTO "LedgerEntry" ("id", "creditAccountId", "sequence", "entryType", "amountKobo", "balanceAfterKobo", "reservedAfterKobo", "idempotencyKey", "metadata", "createdAt")
SELECT md5(random()::text || ca."id"), ca."id", 1, 'MIGRATION'::"LedgerEntryType",
  ca."principalOutstandingKobo", ca."principalOutstandingKobo", 0,
  'migration-opening-' || ca."id",
  '{"source":"installment_migration"}'::jsonb, NOW()
FROM "CreditAccount" ca WHERE ca."principalOutstandingKobo" > 0;

-- Remaining credit tables
CREATE TABLE "CreditReservation" (
    "id" TEXT NOT NULL,
    "creditAccountId" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
    "amountKobo" INTEGER NOT NULL,
    "capturedKobo" INTEGER NOT NULL DEFAULT 0,
    "releasedKobo" INTEGER NOT NULL DEFAULT 0,
    "status" "CreditReservationStatus" NOT NULL DEFAULT 'ACTIVE',
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdLedgerEntryId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "CreditReservation_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "CreditReservation_orderId_key" ON "CreditReservation"("orderId");
CREATE INDEX "CreditReservation_creditAccountId_status_idx" ON "CreditReservation"("creditAccountId", "status");
CREATE INDEX "CreditReservation_status_expiresAt_idx" ON "CreditReservation"("status", "expiresAt");
ALTER TABLE "CreditReservation" ADD CONSTRAINT "CreditReservation_creditAccountId_fkey" FOREIGN KEY ("creditAccountId") REFERENCES "CreditAccount"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "CreditReservation" ADD CONSTRAINT "CreditReservation_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE TABLE "InterestAccrualDay" (
    "id" TEXT NOT NULL,
    "creditAccountId" TEXT NOT NULL,
    "accrualDate" DATE NOT NULL,
    "outstandingBaseKobo" INTEGER NOT NULL,
    "accrualKobo" INTEGER NOT NULL,
    "posted" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "InterestAccrualDay_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "InterestAccrualDay_creditAccountId_accrualDate_key" ON "InterestAccrualDay"("creditAccountId", "accrualDate");
CREATE INDEX "InterestAccrualDay_posted_accrualDate_idx" ON "InterestAccrualDay"("posted", "accrualDate");
ALTER TABLE "InterestAccrualDay" ADD CONSTRAINT "InterestAccrualDay_creditAccountId_fkey" FOREIGN KEY ("creditAccountId") REFERENCES "CreditAccount"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE TABLE "WriteOffRequest" (
    "id" TEXT NOT NULL,
    "creditAccountId" TEXT NOT NULL,
    "amountKobo" INTEGER NOT NULL,
    "reason" TEXT NOT NULL,
    "status" "WriteOffStatus" NOT NULL DEFAULT 'PENDING',
    "requestedById" TEXT NOT NULL,
    "approvedById" TEXT,
    "ledgerEntryId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "WriteOffRequest_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "WriteOffRequest_status_createdAt_idx" ON "WriteOffRequest"("status", "createdAt");
ALTER TABLE "WriteOffRequest" ADD CONSTRAINT "WriteOffRequest_creditAccountId_fkey" FOREIGN KEY ("creditAccountId") REFERENCES "CreditAccount"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "WriteOffRequest" ADD CONSTRAINT "WriteOffRequest_requestedById_fkey" FOREIGN KEY ("requestedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "WriteOffRequest" ADD CONSTRAINT "WriteOffRequest_approvedById_fkey" FOREIGN KEY ("approvedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE TABLE "PlatformSettings" (
    "id" TEXT NOT NULL DEFAULT 'default',
    "maxInterestAnnualRateBps" INTEGER NOT NULL DEFAULT 2400,
    "penaltiesEnabledGlobal" BOOLEAN NOT NULL DEFAULT false,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "PlatformSettings_pkey" PRIMARY KEY ("id")
);
INSERT INTO "PlatformSettings" ("id", "updatedAt") VALUES ('default', NOW()) ON CONFLICT DO NOTHING;

CREATE TABLE "PayrollRun" (
    "id" TEXT NOT NULL,
    "employerId" TEXT NOT NULL,
    "periodStart" TIMESTAMP(3) NOT NULL,
    "periodEnd" TIMESTAMP(3) NOT NULL,
    "payrollDate" TIMESTAMP(3) NOT NULL,
    "status" "PayrollRunStatus" NOT NULL DEFAULT 'DRAFT',
    "idempotencyKey" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "PayrollRun_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "PayrollRun_employerId_idempotencyKey_key" ON "PayrollRun"("employerId", "idempotencyKey");
CREATE INDEX "PayrollRun_employerId_status_idx" ON "PayrollRun"("employerId", "status");
CREATE INDEX "PayrollRun_employerId_payrollDate_idx" ON "PayrollRun"("employerId", "payrollDate");
ALTER TABLE "PayrollRun" ADD CONSTRAINT "PayrollRun_employerId_fkey" FOREIGN KEY ("employerId") REFERENCES "Employer"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE TABLE "PayrollDeductionLine" (
    "id" TEXT NOT NULL,
    "payrollRunId" TEXT NOT NULL,
    "employeeId" TEXT NOT NULL,
    "salarySnapshotKobo" INTEGER NOT NULL,
    "deductionPercentSnapshot" INTEGER NOT NULL,
    "requestedKobo" INTEGER NOT NULL,
    "collectedKobo" INTEGER NOT NULL DEFAULT 0,
    "status" "PayrollDeductionLineStatus" NOT NULL DEFAULT 'PENDING',
    "ledgerEntryId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "PayrollDeductionLine_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "PayrollDeductionLine_payrollRunId_employeeId_key" ON "PayrollDeductionLine"("payrollRunId", "employeeId");
CREATE INDEX "PayrollDeductionLine_employeeId_status_idx" ON "PayrollDeductionLine"("employeeId", "status");
CREATE INDEX "PayrollDeductionLine_status_idx" ON "PayrollDeductionLine"("status");
ALTER TABLE "PayrollDeductionLine" ADD CONSTRAINT "PayrollDeductionLine_payrollRunId_fkey" FOREIGN KEY ("payrollRunId") REFERENCES "PayrollRun"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "PayrollDeductionLine" ADD CONSTRAINT "PayrollDeductionLine_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "Employee"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE TABLE "AuditLog" (
    "id" TEXT NOT NULL,
    "actorId" TEXT,
    "action" TEXT NOT NULL,
    "entityType" TEXT NOT NULL,
    "entityId" TEXT,
    "before" JSONB,
    "after" JSONB,
    "ipAddress" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "AuditLog_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "AuditLog_entityType_entityId_idx" ON "AuditLog"("entityType", "entityId");
CREATE INDEX "AuditLog_actorId_createdAt_idx" ON "AuditLog"("actorId", "createdAt");
CREATE INDEX "AuditLog_action_createdAt_idx" ON "AuditLog"("action", "createdAt");
ALTER TABLE "AuditLog" ADD CONSTRAINT "AuditLog_actorId_fkey" FOREIGN KEY ("actorId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE TABLE "OutboxEvent" (
    "id" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "payload" JSONB NOT NULL,
    "status" "OutboxEventStatus" NOT NULL DEFAULT 'PENDING',
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "lastError" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "processedAt" TIMESTAMP(3),
    CONSTRAINT "OutboxEvent_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "OutboxEvent_status_createdAt_idx" ON "OutboxEvent"("status", "createdAt");

CREATE TABLE "Notification" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "channel" "NotificationChannel" NOT NULL DEFAULT 'IN_APP',
    "status" "NotificationDeliveryStatus" NOT NULL DEFAULT 'PENDING',
    "payload" JSONB NOT NULL DEFAULT '{}',
    "readAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Notification_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "Notification_userId_createdAt_idx" ON "Notification"("userId", "createdAt");
CREATE INDEX "Notification_userId_readAt_idx" ON "Notification"("userId", "readAt");
ALTER TABLE "Notification" ADD CONSTRAINT "Notification_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "IdempotencyRecord" (
    "id" TEXT NOT NULL,
    "actorId" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "requestHash" TEXT NOT NULL,
    "responseJson" JSONB,
    "responseCode" INTEGER,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "IdempotencyRecord_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "IdempotencyRecord_actorId_action_key_key" ON "IdempotencyRecord"("actorId", "action", "key");
CREATE INDEX "IdempotencyRecord_expiresAt_idx" ON "IdempotencyRecord"("expiresAt");
ALTER TABLE "IdempotencyRecord" ADD CONSTRAINT "IdempotencyRecord_actorId_fkey" FOREIGN KEY ("actorId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
