-- CreateEnum
CREATE TYPE "EmployeeVerificationStatus" AS ENUM ('INVITED', 'REGISTERED', 'DOCS_SUBMITTED', 'APPROVED', 'REJECTED');

-- CreateEnum
CREATE TYPE "EmployeeInviteStatus" AS ENUM ('PENDING', 'USED', 'REVOKED', 'EXPIRED');

-- CreateEnum
CREATE TYPE "VerificationDocumentType" AS ENUM ('EMPLOYMENT_PROOF', 'PAYROLL_PROOF', 'OTHER');

-- CreateEnum
CREATE TYPE "VerificationDocumentStatus" AS ENUM ('UPLOADED', 'SUBMITTED', 'REJECTED');

-- CreateEnum
CREATE TYPE "CompanyInvoiceStatus" AS ENUM ('DRAFT', 'ISSUED', 'PAID', 'VOID');

-- AlterEnum UserRole
ALTER TYPE "UserRole" ADD VALUE 'NUTRITIONIST';

-- AlterEnum PlatformRole
ALTER TYPE "PlatformRole" ADD VALUE 'NUTRITIONIST';

-- AlterEnum OrderFulfillmentStatus
ALTER TYPE "OrderFulfillmentStatus" ADD VALUE 'VERIFICATION_HOLD';

-- AlterTable Employee
ALTER TABLE "Employee" ADD COLUMN     "creditMultiplierBps" INTEGER,
ADD COLUMN     "verificationStatus" "EmployeeVerificationStatus" NOT NULL DEFAULT 'APPROVED',
ADD COLUMN     "verifiedAt" TIMESTAMP(3),
ADD COLUMN     "verifiedById" TEXT,
ADD COLUMN     "rejectionReason" TEXT,
ADD COLUMN     "phone" TEXT;

ALTER TABLE "Employee" ALTER COLUMN "salaryKobo" SET DEFAULT 0;

-- AlterTable MealPlan
ALTER TABLE "MealPlan" ADD COLUMN "startsOn" DATE,
ADD COLUMN "endsOn" DATE,
ADD COLUMN "activatedAt" TIMESTAMP(3);

-- AlterTable MealPlanDay
ALTER TABLE "MealPlanDay" ADD COLUMN "planDate" DATE;

-- CreateTable EmployeeInvite
CREATE TABLE "EmployeeInvite" (
    "id" TEXT NOT NULL,
    "employerId" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "phone" TEXT,
    "status" "EmployeeInviteStatus" NOT NULL DEFAULT 'PENDING',
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "usedAt" TIMESTAMP(3),
    "usedByUserId" TEXT,
    "employeeId" TEXT,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "EmployeeInvite_pkey" PRIMARY KEY ("id")
);

-- CreateTable VerificationDocument
CREATE TABLE "VerificationDocument" (
    "id" TEXT NOT NULL,
    "employeeId" TEXT NOT NULL,
    "type" "VerificationDocumentType" NOT NULL,
    "status" "VerificationDocumentStatus" NOT NULL DEFAULT 'UPLOADED',
    "fileName" TEXT NOT NULL,
    "fileUrl" TEXT NOT NULL,
    "imageKitFileId" TEXT,
    "mimeType" TEXT,
    "uploadedById" TEXT NOT NULL,
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "VerificationDocument_pkey" PRIMARY KEY ("id")
);

-- CreateTable OrderStatusHistory
CREATE TABLE "OrderStatusHistory" (
    "id" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
    "fromStatus" "OrderFulfillmentStatus",
    "toStatus" "OrderFulfillmentStatus" NOT NULL,
    "note" TEXT,
    "changedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "OrderStatusHistory_pkey" PRIMARY KEY ("id")
);

-- CreateTable CompanyInvoice
CREATE TABLE "CompanyInvoice" (
    "id" TEXT NOT NULL,
    "employerId" TEXT NOT NULL,
    "periodStart" DATE NOT NULL,
    "periodEnd" DATE NOT NULL,
    "status" "CompanyInvoiceStatus" NOT NULL DEFAULT 'DRAFT',
    "subtotalKobo" INTEGER NOT NULL DEFAULT 0,
    "feesKobo" INTEGER NOT NULL DEFAULT 0,
    "interestKobo" INTEGER NOT NULL DEFAULT 0,
    "totalDueKobo" INTEGER NOT NULL DEFAULT 0,
    "remittedKobo" INTEGER NOT NULL DEFAULT 0,
    "generatedById" TEXT,
    "issuedAt" TIMESTAMP(3),
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CompanyInvoice_pkey" PRIMARY KEY ("id")
);

-- CreateTable CompanyInvoiceLine
CREATE TABLE "CompanyInvoiceLine" (
    "id" TEXT NOT NULL,
    "invoiceId" TEXT NOT NULL,
    "employeeId" TEXT,
    "description" TEXT NOT NULL,
    "orderId" TEXT,
    "amountKobo" INTEGER NOT NULL,
    "category" TEXT NOT NULL DEFAULT 'PURCHASE',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CompanyInvoiceLine_pkey" PRIMARY KEY ("id")
);

-- Indexes & uniques
CREATE UNIQUE INDEX "EmployeeInvite_code_key" ON "EmployeeInvite"("code");
CREATE UNIQUE INDEX "EmployeeInvite_employeeId_key" ON "EmployeeInvite"("employeeId");
CREATE INDEX "EmployeeInvite_employerId_status_idx" ON "EmployeeInvite"("employerId", "status");
CREATE INDEX "EmployeeInvite_email_status_idx" ON "EmployeeInvite"("email", "status");
CREATE INDEX "EmployeeInvite_expiresAt_idx" ON "EmployeeInvite"("expiresAt");

CREATE INDEX "VerificationDocument_employeeId_type_idx" ON "VerificationDocument"("employeeId", "type");
CREATE INDEX "VerificationDocument_employeeId_status_idx" ON "VerificationDocument"("employeeId", "status");

CREATE INDEX "OrderStatusHistory_orderId_createdAt_idx" ON "OrderStatusHistory"("orderId", "createdAt");
CREATE INDEX "OrderStatusHistory_toStatus_createdAt_idx" ON "OrderStatusHistory"("toStatus", "createdAt");

CREATE UNIQUE INDEX "CompanyInvoice_employerId_periodStart_periodEnd_key" ON "CompanyInvoice"("employerId", "periodStart", "periodEnd");
CREATE INDEX "CompanyInvoice_employerId_status_idx" ON "CompanyInvoice"("employerId", "status");
CREATE INDEX "CompanyInvoice_periodEnd_idx" ON "CompanyInvoice"("periodEnd");

CREATE INDEX "CompanyInvoiceLine_invoiceId_idx" ON "CompanyInvoiceLine"("invoiceId");
CREATE INDEX "CompanyInvoiceLine_employeeId_idx" ON "CompanyInvoiceLine"("employeeId");

CREATE INDEX "Employee_employerId_verificationStatus_idx" ON "Employee"("employerId", "verificationStatus");
CREATE INDEX "Employee_verificationStatus_createdAt_idx" ON "Employee"("verificationStatus", "createdAt");
CREATE INDEX "MealPlanDay_planDate_idx" ON "MealPlanDay"("planDate");

-- Foreign keys
ALTER TABLE "Employee" ADD CONSTRAINT "Employee_verifiedById_fkey" FOREIGN KEY ("verifiedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "EmployeeInvite" ADD CONSTRAINT "EmployeeInvite_employerId_fkey" FOREIGN KEY ("employerId") REFERENCES "Employer"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "EmployeeInvite" ADD CONSTRAINT "EmployeeInvite_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "Employee"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "EmployeeInvite" ADD CONSTRAINT "EmployeeInvite_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "VerificationDocument" ADD CONSTRAINT "VerificationDocument_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "Employee"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "VerificationDocument" ADD CONSTRAINT "VerificationDocument_uploadedById_fkey" FOREIGN KEY ("uploadedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "OrderStatusHistory" ADD CONSTRAINT "OrderStatusHistory_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "OrderStatusHistory" ADD CONSTRAINT "OrderStatusHistory_changedById_fkey" FOREIGN KEY ("changedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "CompanyInvoice" ADD CONSTRAINT "CompanyInvoice_employerId_fkey" FOREIGN KEY ("employerId") REFERENCES "Employer"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "CompanyInvoice" ADD CONSTRAINT "CompanyInvoice_generatedById_fkey" FOREIGN KEY ("generatedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "CompanyInvoiceLine" ADD CONSTRAINT "CompanyInvoiceLine_invoiceId_fkey" FOREIGN KEY ("invoiceId") REFERENCES "CompanyInvoice"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "CompanyInvoiceLine" ADD CONSTRAINT "CompanyInvoiceLine_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "Employee"("id") ON DELETE SET NULL ON UPDATE CASCADE;
