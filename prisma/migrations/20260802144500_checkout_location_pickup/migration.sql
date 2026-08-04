-- AlterTable User: location fields
ALTER TABLE "User" ADD COLUMN "addressLine" TEXT,
ADD COLUMN "city" TEXT,
ADD COLUMN "state" TEXT,
ADD COLUMN "latitude" DOUBLE PRECISION,
ADD COLUMN "longitude" DOUBLE PRECISION;

-- CreateTable CompanyPickupPoint
CREATE TABLE "CompanyPickupPoint" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "addressLine" TEXT NOT NULL,
    "city" TEXT NOT NULL,
    "state" TEXT,
    "latitude" DOUBLE PRECISION NOT NULL,
    "longitude" DOUBLE PRECISION NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CompanyPickupPoint_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "CompanyPickupPoint_companyId_isActive_idx" ON "CompanyPickupPoint"("companyId", "isActive");

ALTER TABLE "CompanyPickupPoint" ADD CONSTRAINT "CompanyPickupPoint_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Seed a default pickup point for every existing company (Lagos CBD coords)
INSERT INTO "CompanyPickupPoint" ("id", "companyId", "label", "addressLine", "city", "state", "latitude", "longitude", "isActive", "createdAt", "updatedAt")
SELECT
  'pp_' || c."id",
  c."id",
  'Main office pickup',
  'Company HQ',
  'Lagos',
  'Lagos',
  6.5244,
  3.3792,
  true,
  CURRENT_TIMESTAMP,
  CURRENT_TIMESTAMP
FROM "Company" c;

-- AlterTable Order: fulfillment + fee breakdown
ALTER TABLE "Order" ADD COLUMN "pickupPointId" TEXT,
ADD COLUMN "subtotalKobo" INTEGER,
ADD COLUMN "deliveryFeeKobo" INTEGER;

UPDATE "Order" o
SET
  "subtotalKobo" = o."totalKobo",
  "deliveryFeeKobo" = 0,
  "pickupPointId" = (
    SELECT p."id" FROM "CompanyPickupPoint" p
    WHERE p."companyId" = o."companyId"
    ORDER BY p."createdAt" ASC
    LIMIT 1
  )
WHERE o."subtotalKobo" IS NULL;

ALTER TABLE "Order" ALTER COLUMN "pickupPointId" SET NOT NULL;
ALTER TABLE "Order" ALTER COLUMN "subtotalKobo" SET NOT NULL;
ALTER TABLE "Order" ALTER COLUMN "deliveryFeeKobo" SET NOT NULL;

ALTER TABLE "Order" ADD CONSTRAINT "Order_pickupPointId_fkey" FOREIGN KEY ("pickupPointId") REFERENCES "CompanyPickupPoint"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE INDEX "Order_pickupPointId_idx" ON "Order"("pickupPointId");

-- CreateTable OrderItem
CREATE TABLE "OrderItem" (
    "id" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL,
    "unitPriceKobo" INTEGER NOT NULL,
    "lineTotalKobo" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "OrderItem_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "OrderItem_orderId_idx" ON "OrderItem"("orderId");

ALTER TABLE "OrderItem" ADD CONSTRAINT "OrderItem_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE CASCADE ON UPDATE CASCADE;
