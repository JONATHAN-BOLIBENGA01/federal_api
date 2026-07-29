-- CreateEnum
CREATE TYPE "SocialPlatform" AS ENUM ('FACEBOOK', 'INSTAGRAM', 'X');

-- CreateEnum
CREATE TYPE "SocialPublicationStatus" AS ENUM ('SUCCESS', 'FAILED', 'SKIPPED');

-- AlterTable
ALTER TABLE "articles"
ADD COLUMN "shareOnFacebook" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN "shareOnInstagram" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN "shareOnX" BOOLEAN NOT NULL DEFAULT true;

-- CreateTable
CREATE TABLE "social_publications" (
    "id" TEXT NOT NULL,
    "articleId" TEXT NOT NULL,
    "platform" "SocialPlatform" NOT NULL,
    "status" "SocialPublicationStatus" NOT NULL,
    "externalPostId" TEXT,
    "externalUrl" TEXT,
    "errorMessage" TEXT,
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "lastAttemptedAt" TIMESTAMP(3),
    "publishedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "social_publications_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "social_publications_articleId_platform_key" ON "social_publications"("articleId", "platform");

-- AddForeignKey
ALTER TABLE "social_publications" ADD CONSTRAINT "social_publications_articleId_fkey" FOREIGN KEY ("articleId") REFERENCES "articles"("id") ON DELETE CASCADE ON UPDATE CASCADE;
