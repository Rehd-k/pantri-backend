-- Drop DB defaults on updatedAt so migrations match @updatedAt (Prisma-managed)
ALTER TABLE "CreditAccount" ALTER COLUMN "updatedAt" DROP DEFAULT;
ALTER TABLE "CreditPolicy" ALTER COLUMN "updatedAt" DROP DEFAULT;
ALTER TABLE "CreditReservation" ALTER COLUMN "updatedAt" DROP DEFAULT;
ALTER TABLE "Employee" ALTER COLUMN "updatedAt" DROP DEFAULT;
ALTER TABLE "EmployerMembership" ALTER COLUMN "updatedAt" DROP DEFAULT;
ALTER TABLE "PayrollDeductionLine" ALTER COLUMN "updatedAt" DROP DEFAULT;
ALTER TABLE "PayrollRun" ALTER COLUMN "updatedAt" DROP DEFAULT;
ALTER TABLE "PlatformSettings" ALTER COLUMN "updatedAt" DROP DEFAULT;
ALTER TABLE "RiskProfile" ALTER COLUMN "updatedAt" DROP DEFAULT;
ALTER TABLE "WriteOffRequest" ALTER COLUMN "updatedAt" DROP DEFAULT;
