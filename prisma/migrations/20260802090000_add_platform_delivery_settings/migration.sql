-- CreateTable
CREATE TABLE "PlatformDeliverySettings" (
    "id" TEXT NOT NULL DEFAULT 'default',
    "freeDeliveryMinKobo" INTEGER NOT NULL,
    "deliveryFeeKobo" INTEGER NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PlatformDeliverySettings_pkey" PRIMARY KEY ("id")
);

-- Seed singleton row (₦50,000 free-delivery min / ₦2,000 fee)
INSERT INTO "PlatformDeliverySettings" ("id", "freeDeliveryMinKobo", "deliveryFeeKobo", "updatedAt")
VALUES ('default', 5000000, 200000, CURRENT_TIMESTAMP);
