-- CreateEnum
CREATE TYPE "OrderStatus" AS ENUM ('PENDING_APPROVAL', 'DISPATCHED', 'COMPLETED', 'RETURNED');

-- CreateEnum
CREATE TYPE "DeductionStatus" AS ENUM ('ACTIVE', 'REPAID', 'DEFAULTED', 'SUSPENDED');

-- CreateEnum
CREATE TYPE "InstallmentStatus" AS ENUM ('SCHEDULED', 'COLLECTED', 'SKIPPED');

-- AlterTable
ALTER TABLE "Company" ADD COLUMN     "defaultMonthlyBudgetKobo" INTEGER NOT NULL DEFAULT 3000000,
ADD COLUMN     "payrollDayOfMonth" INTEGER NOT NULL DEFAULT 15;

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "monthlyBudgetKobo" INTEGER;

-- CreateTable
CREATE TABLE "Order" (
    "id" TEXT NOT NULL,
    "employeeId" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "totalKobo" INTEGER NOT NULL,
    "status" "OrderStatus" NOT NULL DEFAULT 'PENDING_APPROVAL',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Order_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PayrollDeductionPlan" (
    "id" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
    "intervalCount" INTEGER NOT NULL,
    "status" "DeductionStatus" NOT NULL DEFAULT 'ACTIVE',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PayrollDeductionPlan_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PayrollDeductionInstallment" (
    "id" TEXT NOT NULL,
    "planId" TEXT NOT NULL,
    "sequence" INTEGER NOT NULL,
    "amountKobo" INTEGER NOT NULL,
    "dueDate" TIMESTAMP(3) NOT NULL,
    "status" "InstallmentStatus" NOT NULL DEFAULT 'SCHEDULED',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PayrollDeductionInstallment_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Order_employeeId_companyId_idx" ON "Order"("employeeId", "companyId");

-- CreateIndex
CREATE INDEX "Order_id_status_idx" ON "Order"("id", "status");

-- CreateIndex
CREATE INDEX "Order_employeeId_status_createdAt_idx" ON "Order"("employeeId", "status", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "PayrollDeductionPlan_orderId_key" ON "PayrollDeductionPlan"("orderId");

-- CreateIndex
CREATE INDEX "PayrollDeductionInstallment_status_dueDate_idx" ON "PayrollDeductionInstallment"("status", "dueDate");

-- CreateIndex
CREATE UNIQUE INDEX "PayrollDeductionInstallment_planId_sequence_key" ON "PayrollDeductionInstallment"("planId", "sequence");

-- AddForeignKey
ALTER TABLE "Order" ADD CONSTRAINT "Order_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Order" ADD CONSTRAINT "Order_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PayrollDeductionPlan" ADD CONSTRAINT "PayrollDeductionPlan_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PayrollDeductionInstallment" ADD CONSTRAINT "PayrollDeductionInstallment_planId_fkey" FOREIGN KEY ("planId") REFERENCES "PayrollDeductionPlan"("id") ON DELETE CASCADE ON UPDATE CASCADE;
