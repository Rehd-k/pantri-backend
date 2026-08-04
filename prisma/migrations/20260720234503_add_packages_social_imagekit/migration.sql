-- CreateEnum
CREATE TYPE "PackageKind" AS ENUM ('CURATED', 'COMMUNITY');

-- CreateEnum
CREATE TYPE "PackageVisibility" AS ENUM ('PRIVATE', 'UNLISTED', 'PUBLIC');

-- CreateEnum
CREATE TYPE "PackageSubscriptionStatus" AS ENUM ('PENDING', 'CANCELLED');

-- CreateTable
CREATE TABLE "PantryPackage" (
    "id" TEXT NOT NULL,
    "kind" "PackageKind" NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT NOT NULL DEFAULT '',
    "coverImageUrl" TEXT NOT NULL,
    "isPopular" BOOLEAN NOT NULL DEFAULT false,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "visibility" "PackageVisibility" NOT NULL DEFAULT 'PRIVATE',
    "shareSlug" TEXT NOT NULL,
    "createdByUserId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PantryPackage_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PackageItem" (
    "id" TEXT NOT NULL,
    "packageId" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL DEFAULT 1,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PackageItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PackageDiscountTier" (
    "id" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "minSpendKobo" INTEGER NOT NULL,
    "discountPercent" INTEGER NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PackageDiscountTier_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PackageSubscription" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "packageId" TEXT NOT NULL,
    "status" "PackageSubscriptionStatus" NOT NULL DEFAULT 'PENDING',
    "snapshot" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PackageSubscription_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "PantryPackage_shareSlug_key" ON "PantryPackage"("shareSlug");

-- CreateIndex
CREATE INDEX "PantryPackage_kind_isActive_sortOrder_idx" ON "PantryPackage"("kind", "isActive", "sortOrder");

-- CreateIndex
CREATE INDEX "PantryPackage_visibility_kind_idx" ON "PantryPackage"("visibility", "kind");

-- CreateIndex
CREATE INDEX "PantryPackage_createdByUserId_idx" ON "PantryPackage"("createdByUserId");

-- CreateIndex
CREATE INDEX "PackageItem_packageId_sortOrder_idx" ON "PackageItem"("packageId", "sortOrder");

-- CreateIndex
CREATE UNIQUE INDEX "PackageItem_packageId_productId_key" ON "PackageItem"("packageId", "productId");

-- CreateIndex
CREATE INDEX "PackageDiscountTier_isActive_minSpendKobo_idx" ON "PackageDiscountTier"("isActive", "minSpendKobo");

-- CreateIndex
CREATE INDEX "PackageSubscription_userId_status_idx" ON "PackageSubscription"("userId", "status");

-- CreateIndex
CREATE INDEX "PackageSubscription_packageId_status_idx" ON "PackageSubscription"("packageId", "status");

-- AddForeignKey
ALTER TABLE "PantryPackage" ADD CONSTRAINT "PantryPackage_createdByUserId_fkey" FOREIGN KEY ("createdByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PackageItem" ADD CONSTRAINT "PackageItem_packageId_fkey" FOREIGN KEY ("packageId") REFERENCES "PantryPackage"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PackageItem" ADD CONSTRAINT "PackageItem_productId_fkey" FOREIGN KEY ("productId") REFERENCES "MarketplaceProduct"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PackageSubscription" ADD CONSTRAINT "PackageSubscription_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PackageSubscription" ADD CONSTRAINT "PackageSubscription_packageId_fkey" FOREIGN KEY ("packageId") REFERENCES "PantryPackage"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
