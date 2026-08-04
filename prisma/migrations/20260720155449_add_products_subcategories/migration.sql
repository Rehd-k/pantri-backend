-- CreateTable
CREATE TABLE "MarketplaceSubcategory" (
    "id" TEXT NOT NULL,
    "categoryId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MarketplaceSubcategory_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MarketplaceProduct" (
    "id" TEXT NOT NULL,
    "categoryId" TEXT NOT NULL,
    "subcategoryId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "brand" TEXT NOT NULL,
    "packageLabel" TEXT NOT NULL,
    "imageUrl" TEXT NOT NULL,
    "priceKobo" INTEGER NOT NULL,
    "retailPriceKobo" INTEGER NOT NULL,
    "tags" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MarketplaceProduct_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "MarketplaceSubcategory_categoryId_isActive_sortOrder_idx" ON "MarketplaceSubcategory"("categoryId", "isActive", "sortOrder");

-- CreateIndex
CREATE INDEX "MarketplaceProduct_categoryId_isActive_idx" ON "MarketplaceProduct"("categoryId", "isActive");

-- CreateIndex
CREATE INDEX "MarketplaceProduct_subcategoryId_isActive_idx" ON "MarketplaceProduct"("subcategoryId", "isActive");

-- CreateIndex
CREATE INDEX "MarketplaceProduct_isActive_sortOrder_idx" ON "MarketplaceProduct"("isActive", "sortOrder");

-- AddForeignKey
ALTER TABLE "MarketplaceSubcategory" ADD CONSTRAINT "MarketplaceSubcategory_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "MarketplaceCategory"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MarketplaceProduct" ADD CONSTRAINT "MarketplaceProduct_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "MarketplaceCategory"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MarketplaceProduct" ADD CONSTRAINT "MarketplaceProduct_subcategoryId_fkey" FOREIGN KEY ("subcategoryId") REFERENCES "MarketplaceSubcategory"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
