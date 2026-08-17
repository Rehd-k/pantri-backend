-- Product identity vs sellable packs, plus Pantra/metric measure catalog.

-- CreateEnum
DO $$ BEGIN
  CREATE TYPE "MeasureDimension" AS ENUM ('MASS', 'VOLUME', 'COUNT');
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
  CREATE TYPE "MeasureKind" AS ENUM ('METRIC', 'PANTRA', 'TRADITIONAL', 'COUNT');
EXCEPTION WHEN duplicate_object THEN null; END $$;

-- Measure units (created first so families can reference them)
CREATE TABLE IF NOT EXISTS "MeasureUnit" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "shortLabel" TEXT NOT NULL,
    "kind" "MeasureKind" NOT NULL,
    "dimension" "MeasureDimension" NOT NULL,
    "milligrams" INTEGER,
    "millilitres" INTEGER,
    "piecesPerUnit" INTEGER,
    "isPurchaseUnit" BOOLEAN NOT NULL DEFAULT false,
    "isRecipeUnit" BOOLEAN NOT NULL DEFAULT false,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "MeasureUnit_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "MeasureUnit_slug_key" ON "MeasureUnit"("slug");
CREATE INDEX IF NOT EXISTS "MeasureUnit_isActive_sortOrder_idx" ON "MeasureUnit"("isActive", "sortOrder");
CREATE INDEX IF NOT EXISTS "MeasureUnit_dimension_isRecipeUnit_idx" ON "MeasureUnit"("dimension", "isRecipeUnit");
CREATE INDEX IF NOT EXISTS "MeasureUnit_dimension_isPurchaseUnit_idx" ON "MeasureUnit"("dimension", "isPurchaseUnit");

CREATE TABLE IF NOT EXISTS "MeasureFamily" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT NOT NULL DEFAULT '',
    "dimension" "MeasureDimension" NOT NULL,
    "defaultRecipeUnitId" TEXT,
    "defaultPurchaseUnitId" TEXT,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "MeasureFamily_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "MeasureFamily_slug_key" ON "MeasureFamily"("slug");
CREATE INDEX IF NOT EXISTS "MeasureFamily_isActive_sortOrder_idx" ON "MeasureFamily"("isActive", "sortOrder");

ALTER TABLE "MeasureFamily"
  ADD CONSTRAINT "MeasureFamily_defaultRecipeUnitId_fkey"
  FOREIGN KEY ("defaultRecipeUnitId") REFERENCES "MeasureUnit"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "MeasureFamily"
  ADD CONSTRAINT "MeasureFamily_defaultPurchaseUnitId_fkey"
  FOREIGN KEY ("defaultPurchaseUnitId") REFERENCES "MeasureUnit"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Seed canonical units used by the data backfill (seed.ts upserts the full catalog).
INSERT INTO "MeasureUnit"
  ("id", "slug", "name", "shortLabel", "kind", "dimension", "milligrams", "millilitres", "piecesPerUnit", "isPurchaseUnit", "isRecipeUnit", "sortOrder", "isActive", "updatedAt")
VALUES
  ('mu_gram', 'gram', 'Gram', 'g', 'METRIC', 'MASS', 1000, NULL, NULL, true, true, 10, true, CURRENT_TIMESTAMP),
  ('mu_kilogram', 'kilogram', 'Kilogram', 'kg', 'METRIC', 'MASS', 1000000, NULL, NULL, true, false, 11, true, CURRENT_TIMESTAMP),
  ('mu_millilitre', 'millilitre', 'Millilitre', 'ml', 'METRIC', 'VOLUME', NULL, 1, NULL, true, true, 20, true, CURRENT_TIMESTAMP),
  ('mu_litre', 'litre', 'Litre', 'L', 'METRIC', 'VOLUME', NULL, 1000, NULL, true, false, 21, true, CURRENT_TIMESTAMP),
  ('mu_piece', 'piece', 'Piece', 'pc', 'COUNT', 'COUNT', NULL, NULL, 1, true, true, 30, true, CURRENT_TIMESTAMP),
  ('mu_pantra_cup', 'pantra-cup', 'Pantra Cup', 'PC', 'PANTRA', 'MASS', 150000, NULL, NULL, false, true, 1, true, CURRENT_TIMESTAMP),
  ('mu_pantra_pour', 'pantra-pour', 'Pantra Pour', 'PP', 'PANTRA', 'VOLUME', NULL, 250, NULL, false, true, 2, true, CURRENT_TIMESTAMP),
  ('mu_pantra_spoon', 'pantra-spoon', 'Pantra Spoon', 'PS', 'PANTRA', 'MASS', 5000, NULL, NULL, false, true, 3, true, CURRENT_TIMESTAMP),
  ('mu_pantra_scoop', 'pantra-scoop', 'Pantra Scoop', 'PSc', 'PANTRA', 'MASS', 50000, NULL, NULL, false, true, 4, true, CURRENT_TIMESTAMP),
  ('mu_pantra_piece', 'pantra-piece', 'Pantra Piece', 'PPc', 'PANTRA', 'COUNT', NULL, NULL, 1, false, true, 5, true, CURRENT_TIMESTAMP)
ON CONFLICT ("slug") DO NOTHING;

INSERT INTO "MeasureFamily"
  ("id", "slug", "name", "description", "dimension", "defaultRecipeUnitId", "defaultPurchaseUnitId", "sortOrder", "isActive", "updatedAt")
VALUES
  ('mf_dry_staple', 'dry-staple', 'Dry staples', 'Rice, beans, garri, flours and powdery foods. 1 Pantra Cup = 150g.', 'MASS', 'mu_pantra_cup', 'mu_kilogram', 0, true, CURRENT_TIMESTAMP),
  ('mf_liquid', 'liquid', 'Liquids', 'Oils, water, milk and stocks. 1 Pantra Pour = 250ml.', 'VOLUME', 'mu_pantra_pour', 'mu_litre', 1, true, CURRENT_TIMESTAMP),
  ('mf_paste', 'paste', 'Pastes', 'Tomato paste, pepper mix, iru and thick condiments. 1 Pantra Scoop = 50g.', 'MASS', 'mu_pantra_scoop', 'mu_gram', 2, true, CURRENT_TIMESTAMP),
  ('mf_spice', 'spice', 'Spices', 'Dry seasonings. 1 Pantra Spoon = 5g.', 'MASS', 'mu_pantra_spoon', 'mu_gram', 3, true, CURRENT_TIMESTAMP),
  ('mf_produce_count', 'produce-count', 'Countable produce', 'Eggs, onions, peppers, Maggi. Sold and cooked by piece.', 'COUNT', 'mu_pantra_piece', 'mu_piece', 4, true, CURRENT_TIMESTAMP),
  ('mf_protein_mass', 'protein-mass', 'Proteins by mass', 'Meat, fish and offals sold by kilogram.', 'MASS', 'mu_gram', 'mu_kilogram', 5, true, CURRENT_TIMESTAMP)
ON CONFLICT ("slug") DO NOTHING;

-- Category / subcategory slugs
ALTER TABLE "MarketplaceCategory" ADD COLUMN IF NOT EXISTS "slug" TEXT;
UPDATE "MarketplaceCategory"
SET "slug" = NULLIF(lower(regexp_replace(trim("name"), '[^a-zA-Z0-9]+', '-', 'g')), '')
WHERE "slug" IS NULL;
UPDATE "MarketplaceCategory" SET "slug" = "id" WHERE "slug" IS NULL OR "slug" = '';
CREATE UNIQUE INDEX IF NOT EXISTS "MarketplaceCategory_slug_key" ON "MarketplaceCategory"("slug");

ALTER TABLE "MarketplaceSubcategory" ADD COLUMN IF NOT EXISTS "slug" TEXT;
UPDATE "MarketplaceSubcategory"
SET "slug" = NULLIF(lower(regexp_replace(trim("name"), '[^a-zA-Z0-9]+', '-', 'g')), '')
WHERE "slug" IS NULL;
UPDATE "MarketplaceSubcategory" SET "slug" = "id" WHERE "slug" IS NULL OR "slug" = '';
CREATE UNIQUE INDEX IF NOT EXISTS "MarketplaceSubcategory_categoryId_slug_key" ON "MarketplaceSubcategory"("categoryId", "slug");

-- Product identity columns
ALTER TABLE "MarketplaceProduct" ADD COLUMN IF NOT EXISTS "slug" TEXT;
ALTER TABLE "MarketplaceProduct" ADD COLUMN IF NOT EXISTS "measureFamilyId" TEXT;
ALTER TABLE "MarketplaceProduct" ADD COLUMN IF NOT EXISTS "recipeUnitOverrideMg" INTEGER;
ALTER TABLE "MarketplaceProduct" ADD COLUMN IF NOT EXISTS "recipeUnitOverrideMl" INTEGER;

UPDATE "MarketplaceProduct"
SET
  "slug" = lower(regexp_replace(trim("name"), '[^a-zA-Z0-9]+', '-', 'g')) || '-' || "id",
  "measureFamilyId" = 'mf_dry_staple'
WHERE "slug" IS NULL OR "measureFamilyId" IS NULL;

ALTER TABLE "MarketplaceProduct" ALTER COLUMN "slug" SET NOT NULL;
ALTER TABLE "MarketplaceProduct" ALTER COLUMN "measureFamilyId" SET NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS "MarketplaceProduct_slug_key" ON "MarketplaceProduct"("slug");
CREATE INDEX IF NOT EXISTS "MarketplaceProduct_measureFamilyId_idx" ON "MarketplaceProduct"("measureFamilyId");

ALTER TABLE "MarketplaceProduct"
  ADD CONSTRAINT "MarketplaceProduct_measureFamilyId_fkey"
  FOREIGN KEY ("measureFamilyId") REFERENCES "MeasureFamily"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Sellable packs (one pack per legacy product row)
CREATE TABLE IF NOT EXISTS "ProductPack" (
    "id" TEXT NOT NULL,
    "sku" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "packUnitId" TEXT NOT NULL,
    "brand" TEXT NOT NULL,
    "packAmount" INTEGER NOT NULL,
    "amountMg" INTEGER,
    "amountMl" INTEGER,
    "amountEach" INTEGER,
    "packageLabel" TEXT NOT NULL,
    "imageUrl" TEXT NOT NULL,
    "priceKobo" INTEGER NOT NULL,
    "retailPriceKobo" INTEGER NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ProductPack_pkey" PRIMARY KEY ("id")
);

INSERT INTO "ProductPack" (
  "id", "sku", "productId", "packUnitId", "brand", "packAmount",
  "amountMg", "amountMl", "amountEach", "packageLabel", "imageUrl",
  "priceKobo", "retailPriceKobo", "sortOrder", "isActive", "updatedAt"
)
SELECT
  "id",
  'legacy-' || "id",
  "id",
  'mu_kilogram',
  "brand",
  GREATEST(1, COALESCE(NULLIF(regexp_replace("packageLabel", '[^0-9]', '', 'g'), '')::int, 1)),
  CASE
    WHEN "packageLabel" ~* 'kg' THEN (GREATEST(1, COALESCE(NULLIF(regexp_replace("packageLabel", '[^0-9]', '', 'g'), '')::int, 1)) * 1000000)
    WHEN "packageLabel" ~* 'g' THEN (GREATEST(1, COALESCE(NULLIF(regexp_replace("packageLabel", '[^0-9]', '', 'g'), '')::int, 1)) * 1000)
    ELSE NULL
  END,
  NULL,
  NULL,
  "packageLabel",
  "imageUrl",
  "priceKobo",
  "retailPriceKobo",
  "sortOrder",
  "isActive",
  CURRENT_TIMESTAMP
FROM "MarketplaceProduct"
ON CONFLICT DO NOTHING;

CREATE UNIQUE INDEX IF NOT EXISTS "ProductPack_sku_key" ON "ProductPack"("sku");
CREATE UNIQUE INDEX IF NOT EXISTS "ProductPack_productId_brand_packageLabel_key" ON "ProductPack"("productId", "brand", "packageLabel");
CREATE INDEX IF NOT EXISTS "ProductPack_productId_isActive_sortOrder_idx" ON "ProductPack"("productId", "isActive", "sortOrder");
CREATE INDEX IF NOT EXISTS "ProductPack_isActive_sortOrder_idx" ON "ProductPack"("isActive", "sortOrder");

ALTER TABLE "ProductPack"
  ADD CONSTRAINT "ProductPack_productId_fkey"
  FOREIGN KEY ("productId") REFERENCES "MarketplaceProduct"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "ProductPack"
  ADD CONSTRAINT "ProductPack_packUnitId_fkey"
  FOREIGN KEY ("packUnitId") REFERENCES "MeasureUnit"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Cart items: productId -> packId
ALTER TABLE "CartItem" ADD COLUMN IF NOT EXISTS "packId" TEXT;
UPDATE "CartItem" c
SET "packId" = p."id"
FROM "ProductPack" p
WHERE p."productId" = c."productId" AND c."packId" IS NULL;

DELETE FROM "CartItem" WHERE "packId" IS NULL;

ALTER TABLE "CartItem" DROP CONSTRAINT IF EXISTS "CartItem_productId_fkey";
DROP INDEX IF EXISTS "CartItem_cartId_productId_key";
DROP INDEX IF EXISTS "CartItem_productId_idx";
ALTER TABLE "CartItem" DROP COLUMN IF EXISTS "productId";
ALTER TABLE "CartItem" ALTER COLUMN "packId" SET NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS "CartItem_cartId_packId_key" ON "CartItem"("cartId", "packId");
CREATE INDEX IF NOT EXISTS "CartItem_packId_idx" ON "CartItem"("packId");
ALTER TABLE "CartItem"
  ADD CONSTRAINT "CartItem_packId_fkey"
  FOREIGN KEY ("packId") REFERENCES "ProductPack"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Package items: productId -> packId
ALTER TABLE "PackageItem" ADD COLUMN IF NOT EXISTS "packId" TEXT;
UPDATE "PackageItem" i
SET "packId" = p."id"
FROM "ProductPack" p
WHERE p."productId" = i."productId" AND i."packId" IS NULL;

DELETE FROM "PackageItem" WHERE "packId" IS NULL;

ALTER TABLE "PackageItem" DROP CONSTRAINT IF EXISTS "PackageItem_productId_fkey";
DROP INDEX IF EXISTS "PackageItem_packageId_productId_key";
ALTER TABLE "PackageItem" DROP COLUMN IF EXISTS "productId";
ALTER TABLE "PackageItem" ALTER COLUMN "packId" SET NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS "PackageItem_packageId_packId_key" ON "PackageItem"("packageId", "packId");
CREATE INDEX IF NOT EXISTS "PackageItem_packId_idx" ON "PackageItem"("packId");
ALTER TABLE "PackageItem"
  ADD CONSTRAINT "PackageItem_packId_fkey"
  FOREIGN KEY ("packId") REFERENCES "ProductPack"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Order snapshots
ALTER TABLE "OrderItem" ADD COLUMN IF NOT EXISTS "packId" TEXT;
ALTER TABLE "OrderItem" ADD COLUMN IF NOT EXISTS "brand" TEXT NOT NULL DEFAULT '';
ALTER TABLE "OrderItem" ADD COLUMN IF NOT EXISTS "packageLabel" TEXT NOT NULL DEFAULT '';
CREATE INDEX IF NOT EXISTS "OrderItem_packId_idx" ON "OrderItem"("packId");

-- Meal-plan recipe quantities
ALTER TABLE "MealPlanItem" ADD COLUMN IF NOT EXISTS "measureUnitId" TEXT;
ALTER TABLE "MealPlanItem" ADD COLUMN IF NOT EXISTS "quantityCanonical" INTEGER NOT NULL DEFAULT 0;
CREATE INDEX IF NOT EXISTS "MealPlanItem_measureUnitId_idx" ON "MealPlanItem"("measureUnitId");
ALTER TABLE "MealPlanItem"
  ADD CONSTRAINT "MealPlanItem_measureUnitId_fkey"
  FOREIGN KEY ("measureUnitId") REFERENCES "MeasureUnit"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Drop identity fields that now live on ProductPack
ALTER TABLE "MarketplaceProduct" DROP COLUMN IF EXISTS "brand";
ALTER TABLE "MarketplaceProduct" DROP COLUMN IF EXISTS "packageLabel";
ALTER TABLE "MarketplaceProduct" DROP COLUMN IF EXISTS "priceKobo";
ALTER TABLE "MarketplaceProduct" DROP COLUMN IF EXISTS "retailPriceKobo";
