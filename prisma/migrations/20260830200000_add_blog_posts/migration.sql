-- CreateEnum
CREATE TYPE "BlogPostCategory" AS ENUM (
  'FOOD',
  'NUTRITION',
  'RECIPES',
  'FAMILY',
  'BUDGETING',
  'HEALTHY_LIVING',
  'FOOD_PRICES',
  'COOKING',
  'EVENTS',
  'VIDEOS'
);

-- CreateEnum
CREATE TYPE "BlogPostStatus" AS ENUM ('DRAFT', 'PUBLISHED', 'ARCHIVED');

-- CreateTable
CREATE TABLE "BlogPost" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "excerpt" TEXT NOT NULL,
    "category" "BlogPostCategory" NOT NULL,
    "bodyParagraphs" JSONB NOT NULL,
    "coverGradient" TEXT NOT NULL,
    "coverImageUrl" TEXT,
    "youtubeUrl" TEXT,
    "tiktokUrl" TEXT,
    "readTimeMinutes" INTEGER NOT NULL DEFAULT 1,
    "status" "BlogPostStatus" NOT NULL DEFAULT 'DRAFT',
    "publishedAt" TIMESTAMP(3),
    "authorUserId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BlogPost_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "BlogPost_slug_key" ON "BlogPost"("slug");

-- CreateIndex
CREATE INDEX "BlogPost_status_publishedAt_idx" ON "BlogPost"("status", "publishedAt");

-- CreateIndex
CREATE INDEX "BlogPost_category_status_idx" ON "BlogPost"("category", "status");

-- CreateIndex
CREATE INDEX "BlogPost_authorUserId_idx" ON "BlogPost"("authorUserId");

-- AddForeignKey
ALTER TABLE "BlogPost" ADD CONSTRAINT "BlogPost_authorUserId_fkey" FOREIGN KEY ("authorUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
