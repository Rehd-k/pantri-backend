-- CreateEnum
CREATE TYPE "MealItemStatus" AS ENUM ('PLANNED', 'COOKED', 'SKIPPED', 'SUBSTITUTED');

-- AlterEnum
ALTER TYPE "HouseholdStockLedgerReason" ADD VALUE 'SPOILAGE';

-- AlterTable PlatformDeliverySettings
ALTER TABLE "PlatformDeliverySettings" ADD COLUMN "minOrderKobo" INTEGER NOT NULL DEFAULT 5000000;

-- AlterTable HealthProfile
ALTER TABLE "HealthProfile" ADD COLUMN "targetWeightKg" INTEGER;
ALTER TABLE "HealthProfile" ADD COLUMN "foodPreferences" TEXT[] DEFAULT ARRAY[]::TEXT[];
ALTER TABLE "HealthProfile" ADD COLUMN "foodsToAvoid" TEXT[] DEFAULT ARRAY[]::TEXT[];

-- CreateTable ProgressCheckpoint
CREATE TABLE "ProgressCheckpoint" (
    "id" TEXT NOT NULL,
    "healthProfileId" TEXT NOT NULL,
    "metricKey" TEXT NOT NULL,
    "value" DOUBLE PRECISION NOT NULL,
    "unitLabel" TEXT NOT NULL DEFAULT '',
    "recordedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ProgressCheckpoint_pkey" PRIMARY KEY ("id")
);

-- CreateTable ProductReplenishmentProfile
CREATE TABLE "ProductReplenishmentProfile" (
    "id" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "shelfLifeDays" INTEGER,
    "preferredCycleDays" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ProductReplenishmentProfile_pkey" PRIMARY KEY ("id")
);

-- AlterTable Recipe
ALTER TABLE "Recipe" ADD COLUMN "baseServings" INTEGER NOT NULL DEFAULT 1;

-- AlterTable MealPlanItem
ALTER TABLE "MealPlanItem" ADD COLUMN "status" "MealItemStatus" NOT NULL DEFAULT 'PLANNED';
ALTER TABLE "MealPlanItem" ADD COLUMN "servings" INTEGER NOT NULL DEFAULT 1;
ALTER TABLE "MealPlanItem" ADD COLUMN "substitutedRecipeId" TEXT;

-- AlterTable CookedMeal
ALTER TABLE "CookedMeal" ADD COLUMN "servings" INTEGER NOT NULL DEFAULT 1;

-- Backfill COOKED status where a CookedMeal already exists
UPDATE "MealPlanItem" mpi
SET "status" = 'COOKED'
FROM "CookedMeal" cm
WHERE cm."mealPlanItemId" = mpi."id";

-- Indexes
CREATE INDEX "ProgressCheckpoint_healthProfileId_metricKey_recordedAt_idx" ON "ProgressCheckpoint"("healthProfileId", "metricKey", "recordedAt");
CREATE UNIQUE INDEX "ProductReplenishmentProfile_productId_key" ON "ProductReplenishmentProfile"("productId");
CREATE INDEX "MealPlanItem_status_idx" ON "MealPlanItem"("status");
CREATE INDEX "MealPlanItem_substitutedRecipeId_idx" ON "MealPlanItem"("substitutedRecipeId");

-- ForeignKeys
ALTER TABLE "ProgressCheckpoint" ADD CONSTRAINT "ProgressCheckpoint_healthProfileId_fkey" FOREIGN KEY ("healthProfileId") REFERENCES "HealthProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ProductReplenishmentProfile" ADD CONSTRAINT "ProductReplenishmentProfile_productId_fkey" FOREIGN KEY ("productId") REFERENCES "MarketplaceProduct"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "MealPlanItem" ADD CONSTRAINT "MealPlanItem_substitutedRecipeId_fkey" FOREIGN KEY ("substitutedRecipeId") REFERENCES "Recipe"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "HouseholdStockLedger" ADD CONSTRAINT "HouseholdStockLedger_cookedMealId_fkey" FOREIGN KEY ("cookedMealId") REFERENCES "CookedMeal"("id") ON DELETE SET NULL ON UPDATE CASCADE;
