-- AlterTable
ALTER TABLE "MarketplaceProduct" ADD COLUMN "recipeUnitId" TEXT;

-- CreateIndex
CREATE INDEX "MarketplaceProduct_recipeUnitId_idx" ON "MarketplaceProduct"("recipeUnitId");

-- AddForeignKey
ALTER TABLE "MarketplaceProduct" ADD CONSTRAINT "MarketplaceProduct_recipeUnitId_fkey" FOREIGN KEY ("recipeUnitId") REFERENCES "MeasureUnit"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Backfill from each family's default recipe unit
UPDATE "MarketplaceProduct" AS p
SET "recipeUnitId" = f."defaultRecipeUnitId"
FROM "MeasureFamily" AS f
WHERE p."measureFamilyId" = f."id"
  AND p."recipeUnitId" IS NULL
  AND f."defaultRecipeUnitId" IS NOT NULL;
