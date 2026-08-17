-- Measure tables were created with updatedAt defaults in product_packs;
-- drop them if one_big ran before those tables existed (shadow replay).
ALTER TABLE "MeasureFamily" ALTER COLUMN "updatedAt" DROP DEFAULT;
ALTER TABLE "MeasureUnit" ALTER COLUMN "updatedAt" DROP DEFAULT;
ALTER TABLE "ProductPack" ALTER COLUMN "updatedAt" DROP DEFAULT;

-- CreateEnum
CREATE TYPE "HouseholdStockLedgerReason" AS ENUM ('ORDER_FULFILLED', 'MANUAL_ADD', 'MANUAL_ADJUST', 'COOKED', 'RESTOCK_DISCARDED');

CREATE TYPE "RestockAlertStatus" AS ENUM ('OPEN', 'DISMISSED', 'ADDED_TO_CART');

CREATE TYPE "RecipeSource" AS ENUM ('AI', 'USER');

-- AlterTable
ALTER TABLE "HealthProfile" ADD COLUMN "targetEnergyKcal" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "HealthProfile" ADD COLUMN "targetProteinMg" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "HealthProfile" ADD COLUMN "targetCarbsMg" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "HealthProfile" ADD COLUMN "targetFatMg" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "HealthProfile" ADD COLUMN "targetFiberMg" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "HealthProfile" ADD COLUMN "targetSugarMg" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "HealthProfile" ADD COLUMN "targetSodiumMg" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "HealthProfile" ADD COLUMN "targetIronUg" INTEGER NOT NULL DEFAULT 0;

-- CreateTable
CREATE TABLE "HouseholdStock" (
    "id" TEXT NOT NULL,
    "employeeId" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "quantityCanonical" INTEGER NOT NULL DEFAULT 0,
    "restockThresholdCanonical" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "HouseholdStock_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "HouseholdStockLedger" (
    "id" TEXT NOT NULL,
    "stockId" TEXT NOT NULL,
    "reason" "HouseholdStockLedgerReason" NOT NULL,
    "deltaCanonical" INTEGER NOT NULL,
    "orderId" TEXT,
    "cookedMealId" TEXT,
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "HouseholdStockLedger_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "RestockAlert" (
    "id" TEXT NOT NULL,
    "employeeId" TEXT NOT NULL,
    "stockId" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "status" "RestockAlertStatus" NOT NULL DEFAULT 'OPEN',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "resolvedAt" TIMESTAMP(3),

    CONSTRAINT "RestockAlert_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "Recipe" (
    "id" TEXT NOT NULL,
    "employeeId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "mealSlot" TEXT NOT NULL,
    "instructions" TEXT NOT NULL DEFAULT '',
    "rationale" TEXT NOT NULL DEFAULT '',
    "source" "RecipeSource" NOT NULL DEFAULT 'AI',
    "goalSnapshot" JSONB NOT NULL DEFAULT '{}',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Recipe_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "RecipeIngredient" (
    "id" TEXT NOT NULL,
    "recipeId" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "measureUnitId" TEXT,
    "quantity" INTEGER NOT NULL DEFAULT 1,
    "quantityCanonical" INTEGER NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RecipeIngredient_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "CookedMeal" (
    "id" TEXT NOT NULL,
    "employeeId" TEXT NOT NULL,
    "recipeId" TEXT NOT NULL,
    "cookedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "energyKcal" INTEGER NOT NULL DEFAULT 0,
    "proteinMg" INTEGER NOT NULL DEFAULT 0,
    "carbsMg" INTEGER NOT NULL DEFAULT 0,
    "fatMg" INTEGER NOT NULL DEFAULT 0,
    "fiberMg" INTEGER NOT NULL DEFAULT 0,
    "sugarMg" INTEGER NOT NULL DEFAULT 0,
    "sodiumMg" INTEGER NOT NULL DEFAULT 0,
    "ironUg" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CookedMeal_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "DailyNutritionLog" (
    "id" TEXT NOT NULL,
    "employeeId" TEXT NOT NULL,
    "day" DATE NOT NULL,
    "energyKcal" INTEGER NOT NULL DEFAULT 0,
    "proteinMg" INTEGER NOT NULL DEFAULT 0,
    "carbsMg" INTEGER NOT NULL DEFAULT 0,
    "fatMg" INTEGER NOT NULL DEFAULT 0,
    "fiberMg" INTEGER NOT NULL DEFAULT 0,
    "sugarMg" INTEGER NOT NULL DEFAULT 0,
    "sodiumMg" INTEGER NOT NULL DEFAULT 0,
    "ironUg" INTEGER NOT NULL DEFAULT 0,
    "cookedCount" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DailyNutritionLog_pkey" PRIMARY KEY ("id")
);

-- AlterTable
ALTER TABLE "MealPlanItem" ADD COLUMN "recipeId" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "HouseholdStock_employeeId_productId_key" ON "HouseholdStock"("employeeId", "productId");
CREATE INDEX "HouseholdStock_employeeId_idx" ON "HouseholdStock"("employeeId");
CREATE INDEX "HouseholdStock_productId_idx" ON "HouseholdStock"("productId");
CREATE INDEX "HouseholdStockLedger_stockId_createdAt_idx" ON "HouseholdStockLedger"("stockId", "createdAt");
CREATE INDEX "HouseholdStockLedger_orderId_idx" ON "HouseholdStockLedger"("orderId");
CREATE INDEX "HouseholdStockLedger_cookedMealId_idx" ON "HouseholdStockLedger"("cookedMealId");
CREATE INDEX "RestockAlert_employeeId_status_idx" ON "RestockAlert"("employeeId", "status");
CREATE INDEX "RestockAlert_stockId_status_idx" ON "RestockAlert"("stockId", "status");
CREATE INDEX "RestockAlert_productId_idx" ON "RestockAlert"("productId");
CREATE INDEX "Recipe_employeeId_createdAt_idx" ON "Recipe"("employeeId", "createdAt");
CREATE INDEX "RecipeIngredient_recipeId_sortOrder_idx" ON "RecipeIngredient"("recipeId", "sortOrder");
CREATE INDEX "RecipeIngredient_productId_idx" ON "RecipeIngredient"("productId");
CREATE INDEX "RecipeIngredient_measureUnitId_idx" ON "RecipeIngredient"("measureUnitId");
CREATE INDEX "CookedMeal_employeeId_cookedAt_idx" ON "CookedMeal"("employeeId", "cookedAt");
CREATE INDEX "CookedMeal_recipeId_idx" ON "CookedMeal"("recipeId");
CREATE UNIQUE INDEX "DailyNutritionLog_employeeId_day_key" ON "DailyNutritionLog"("employeeId", "day");
CREATE INDEX "DailyNutritionLog_employeeId_day_idx" ON "DailyNutritionLog"("employeeId", "day");
CREATE INDEX "MealPlanItem_recipeId_idx" ON "MealPlanItem"("recipeId");

-- AddForeignKey
ALTER TABLE "HouseholdStock" ADD CONSTRAINT "HouseholdStock_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "Employee"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "HouseholdStock" ADD CONSTRAINT "HouseholdStock_productId_fkey" FOREIGN KEY ("productId") REFERENCES "MarketplaceProduct"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "HouseholdStockLedger" ADD CONSTRAINT "HouseholdStockLedger_stockId_fkey" FOREIGN KEY ("stockId") REFERENCES "HouseholdStock"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "RestockAlert" ADD CONSTRAINT "RestockAlert_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "Employee"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "RestockAlert" ADD CONSTRAINT "RestockAlert_stockId_fkey" FOREIGN KEY ("stockId") REFERENCES "HouseholdStock"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Recipe" ADD CONSTRAINT "Recipe_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "Employee"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "RecipeIngredient" ADD CONSTRAINT "RecipeIngredient_recipeId_fkey" FOREIGN KEY ("recipeId") REFERENCES "Recipe"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "RecipeIngredient" ADD CONSTRAINT "RecipeIngredient_productId_fkey" FOREIGN KEY ("productId") REFERENCES "MarketplaceProduct"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "RecipeIngredient" ADD CONSTRAINT "RecipeIngredient_measureUnitId_fkey" FOREIGN KEY ("measureUnitId") REFERENCES "MeasureUnit"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "CookedMeal" ADD CONSTRAINT "CookedMeal_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "Employee"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "CookedMeal" ADD CONSTRAINT "CookedMeal_recipeId_fkey" FOREIGN KEY ("recipeId") REFERENCES "Recipe"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "DailyNutritionLog" ADD CONSTRAINT "DailyNutritionLog_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "Employee"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "MealPlanItem" ADD CONSTRAINT "MealPlanItem_recipeId_fkey" FOREIGN KEY ("recipeId") REFERENCES "Recipe"("id") ON DELETE SET NULL ON UPDATE CASCADE;
