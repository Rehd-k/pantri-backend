/*
  This file is timestamped before 20260815120000_product_packs_and_measures,
  which is the migration that originally added category/subcategory slugs and
  created MeasureFamily / MeasureUnit / ProductPack. The statements below are
  therefore idempotent so a shadow-database replay still succeeds.
*/

-- Category / subcategory slugs (added here if a later migration has not run yet)
ALTER TABLE "MarketplaceCategory" ADD COLUMN IF NOT EXISTS "slug" TEXT;
UPDATE "MarketplaceCategory"
SET "slug" = NULLIF(lower(regexp_replace(trim("name"), '[^a-zA-Z0-9]+', '-', 'g')), '')
WHERE "slug" IS NULL;
UPDATE "MarketplaceCategory" SET "slug" = "id" WHERE "slug" IS NULL OR "slug" = '';
ALTER TABLE "MarketplaceCategory" ALTER COLUMN "slug" SET NOT NULL;

ALTER TABLE "MarketplaceSubcategory" ADD COLUMN IF NOT EXISTS "slug" TEXT;
UPDATE "MarketplaceSubcategory"
SET "slug" = NULLIF(lower(regexp_replace(trim("name"), '[^a-zA-Z0-9]+', '-', 'g')), '')
WHERE "slug" IS NULL;
UPDATE "MarketplaceSubcategory" SET "slug" = "id" WHERE "slug" IS NULL OR "slug" = '';
ALTER TABLE "MarketplaceSubcategory" ALTER COLUMN "slug" SET NOT NULL;

-- These tables only exist after product_packs_and_measures.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'MeasureFamily'
  ) THEN
    ALTER TABLE "MeasureFamily" ALTER COLUMN "updatedAt" DROP DEFAULT;
  END IF;
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'MeasureUnit'
  ) THEN
    ALTER TABLE "MeasureUnit" ALTER COLUMN "updatedAt" DROP DEFAULT;
  END IF;
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'ProductPack'
  ) THEN
    ALTER TABLE "ProductPack" ALTER COLUMN "updatedAt" DROP DEFAULT;
  END IF;
END $$;
