-- Nutritionist meal-plan builder: drafts, source, recipe steps, slot-level cook tracking.

-- AlterEnum
ALTER TYPE "MealPlanStatus" ADD VALUE 'DRAFT';

-- AlterEnum
CREATE TYPE "MealPlanSource" AS ENUM ('MANUAL', 'AI', 'HYBRID');

-- AlterEnum
ALTER TYPE "RecipeSource" ADD VALUE 'NUTRITIONIST';

-- AlterTable MealPlan
ALTER TABLE "MealPlan" ADD COLUMN "source" "MealPlanSource" NOT NULL DEFAULT 'AI';
ALTER TABLE "MealPlan" ADD COLUMN "createdById" TEXT;

-- AlterTable Recipe
ALTER TABLE "Recipe" ADD COLUMN "instructionSteps" TEXT[] DEFAULT ARRAY[]::TEXT[];

-- AlterTable CookedMeal
ALTER TABLE "CookedMeal" ADD COLUMN "mealPlanItemId" TEXT;

-- CreateIndex
CREATE INDEX "MealPlan_createdById_idx" ON "MealPlan"("createdById");

-- CreateIndex
CREATE UNIQUE INDEX "CookedMeal_mealPlanItemId_key" ON "CookedMeal"("mealPlanItemId");

-- CreateIndex
CREATE INDEX "CookedMeal_mealPlanItemId_idx" ON "CookedMeal"("mealPlanItemId");

-- AddForeignKey
ALTER TABLE "MealPlan" ADD CONSTRAINT "MealPlan_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CookedMeal" ADD CONSTRAINT "CookedMeal_mealPlanItemId_fkey" FOREIGN KEY ("mealPlanItemId") REFERENCES "MealPlanItem"("id") ON DELETE SET NULL ON UPDATE CASCADE;
