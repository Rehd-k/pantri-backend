-- AlterEnum
ALTER TYPE "PackageKind" ADD VALUE IF NOT EXISTS 'AI_GENERATED';

-- CreateEnum
DO $$ BEGIN
  CREATE TYPE "DietaryLifestyle" AS ENUM ('EVERYTHING', 'VEGAN', 'VEGETARIAN', 'KETO');
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
  CREATE TYPE "ActivityLevel" AS ENUM ('SEDENTARY', 'MODERATE', 'VERY_ACTIVE');
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
  CREATE TYPE "MealPlanStatus" AS ENUM ('GENERATING', 'PENDING_REVIEW', 'APPROVED', 'REJECTED', 'FAILED');
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
  CREATE TYPE "MealItemMatchType" AS ENUM ('PRIMARY', 'ALTERNATIVE');
EXCEPTION WHEN duplicate_object THEN null; END $$;

-- CreateTable
CREATE TABLE IF NOT EXISTS "Allergy" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "Allergy_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "PrimaryGoal" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "description" TEXT NOT NULL DEFAULT '',
    "iconKey" TEXT NOT NULL DEFAULT 'flag',
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "PrimaryGoal_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "HealthProfile" (
    "id" TEXT NOT NULL,
    "employeeId" TEXT NOT NULL,
    "age" INTEGER NOT NULL,
    "gender" TEXT NOT NULL,
    "heightCm" INTEGER NOT NULL,
    "weightKg" INTEGER NOT NULL,
    "lifestyle" "DietaryLifestyle" NOT NULL DEFAULT 'EVERYTHING',
    "activityLevel" "ActivityLevel" NOT NULL DEFAULT 'MODERATE',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "HealthProfile_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "HealthProfileAllergy" (
    "id" TEXT NOT NULL,
    "healthProfileId" TEXT NOT NULL,
    "allergyId" TEXT,
    "customLabel" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "HealthProfileAllergy_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "HealthProfileGoal" (
    "id" TEXT NOT NULL,
    "healthProfileId" TEXT NOT NULL,
    "goalId" TEXT,
    "customLabel" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "HealthProfileGoal_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "ProductAllergen" (
    "id" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "allergyId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ProductAllergen_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "MealPlan" (
    "id" TEXT NOT NULL,
    "employeeId" TEXT NOT NULL,
    "status" "MealPlanStatus" NOT NULL DEFAULT 'GENERATING',
    "title" TEXT NOT NULL DEFAULT 'Personalized Meal Plan',
    "promptSnapshot" JSONB NOT NULL DEFAULT '{}',
    "rawAiResponse" JSONB NOT NULL DEFAULT '{}',
    "failureReason" TEXT,
    "adminNote" TEXT,
    "reviewedById" TEXT,
    "reviewedAt" TIMESTAMP(3),
    "packageId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "MealPlan_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "MealPlanDay" (
    "id" TEXT NOT NULL,
    "mealPlanId" TEXT NOT NULL,
    "dayIndex" INTEGER NOT NULL,
    "label" TEXT NOT NULL DEFAULT '',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "MealPlanDay_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "MealPlanItem" (
    "id" TEXT NOT NULL,
    "mealPlanDayId" TEXT NOT NULL,
    "mealSlot" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "rationale" TEXT NOT NULL DEFAULT '',
    "requestedProductName" TEXT NOT NULL DEFAULT '',
    "productId" TEXT,
    "matchType" "MealItemMatchType" NOT NULL DEFAULT 'PRIMARY',
    "quantity" INTEGER NOT NULL DEFAULT 1,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "MealPlanItem_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "Allergy_slug_key" ON "Allergy"("slug");
CREATE INDEX IF NOT EXISTS "Allergy_isActive_sortOrder_idx" ON "Allergy"("isActive", "sortOrder");
CREATE UNIQUE INDEX IF NOT EXISTS "PrimaryGoal_slug_key" ON "PrimaryGoal"("slug");
CREATE INDEX IF NOT EXISTS "PrimaryGoal_isActive_sortOrder_idx" ON "PrimaryGoal"("isActive", "sortOrder");
CREATE UNIQUE INDEX IF NOT EXISTS "HealthProfile_employeeId_key" ON "HealthProfile"("employeeId");
CREATE INDEX IF NOT EXISTS "HealthProfileAllergy_healthProfileId_idx" ON "HealthProfileAllergy"("healthProfileId");
CREATE INDEX IF NOT EXISTS "HealthProfileAllergy_allergyId_idx" ON "HealthProfileAllergy"("allergyId");
CREATE INDEX IF NOT EXISTS "HealthProfileGoal_healthProfileId_idx" ON "HealthProfileGoal"("healthProfileId");
CREATE INDEX IF NOT EXISTS "HealthProfileGoal_goalId_idx" ON "HealthProfileGoal"("goalId");
CREATE UNIQUE INDEX IF NOT EXISTS "ProductAllergen_productId_allergyId_key" ON "ProductAllergen"("productId", "allergyId");
CREATE INDEX IF NOT EXISTS "ProductAllergen_allergyId_idx" ON "ProductAllergen"("allergyId");
CREATE INDEX IF NOT EXISTS "ProductAllergen_productId_idx" ON "ProductAllergen"("productId");
CREATE UNIQUE INDEX IF NOT EXISTS "MealPlan_packageId_key" ON "MealPlan"("packageId");
CREATE INDEX IF NOT EXISTS "MealPlan_employeeId_status_idx" ON "MealPlan"("employeeId", "status");
CREATE INDEX IF NOT EXISTS "MealPlan_status_createdAt_idx" ON "MealPlan"("status", "createdAt");
CREATE UNIQUE INDEX IF NOT EXISTS "MealPlanDay_mealPlanId_dayIndex_key" ON "MealPlanDay"("mealPlanId", "dayIndex");
CREATE INDEX IF NOT EXISTS "MealPlanDay_mealPlanId_idx" ON "MealPlanDay"("mealPlanId");
CREATE INDEX IF NOT EXISTS "MealPlanItem_mealPlanDayId_sortOrder_idx" ON "MealPlanItem"("mealPlanDayId", "sortOrder");
CREATE INDEX IF NOT EXISTS "MealPlanItem_productId_idx" ON "MealPlanItem"("productId");

DO $$ BEGIN
  ALTER TABLE "HealthProfile" ADD CONSTRAINT "HealthProfile_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "Employee"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
  ALTER TABLE "HealthProfileAllergy" ADD CONSTRAINT "HealthProfileAllergy_healthProfileId_fkey" FOREIGN KEY ("healthProfileId") REFERENCES "HealthProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
  ALTER TABLE "HealthProfileAllergy" ADD CONSTRAINT "HealthProfileAllergy_allergyId_fkey" FOREIGN KEY ("allergyId") REFERENCES "Allergy"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
  ALTER TABLE "HealthProfileGoal" ADD CONSTRAINT "HealthProfileGoal_healthProfileId_fkey" FOREIGN KEY ("healthProfileId") REFERENCES "HealthProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
  ALTER TABLE "HealthProfileGoal" ADD CONSTRAINT "HealthProfileGoal_goalId_fkey" FOREIGN KEY ("goalId") REFERENCES "PrimaryGoal"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
  ALTER TABLE "ProductAllergen" ADD CONSTRAINT "ProductAllergen_productId_fkey" FOREIGN KEY ("productId") REFERENCES "MarketplaceProduct"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
  ALTER TABLE "ProductAllergen" ADD CONSTRAINT "ProductAllergen_allergyId_fkey" FOREIGN KEY ("allergyId") REFERENCES "Allergy"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
  ALTER TABLE "MealPlan" ADD CONSTRAINT "MealPlan_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "Employee"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
  ALTER TABLE "MealPlan" ADD CONSTRAINT "MealPlan_reviewedById_fkey" FOREIGN KEY ("reviewedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
  ALTER TABLE "MealPlan" ADD CONSTRAINT "MealPlan_packageId_fkey" FOREIGN KEY ("packageId") REFERENCES "PantryPackage"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
  ALTER TABLE "MealPlanDay" ADD CONSTRAINT "MealPlanDay_mealPlanId_fkey" FOREIGN KEY ("mealPlanId") REFERENCES "MealPlan"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
  ALTER TABLE "MealPlanItem" ADD CONSTRAINT "MealPlanItem_mealPlanDayId_fkey" FOREIGN KEY ("mealPlanDayId") REFERENCES "MealPlanDay"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
  ALTER TABLE "MealPlanItem" ADD CONSTRAINT "MealPlanItem_productId_fkey" FOREIGN KEY ("productId") REFERENCES "MarketplaceProduct"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null; END $$;
