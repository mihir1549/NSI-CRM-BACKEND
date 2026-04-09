-- AlterTable
ALTER TABLE "distributor_plans" ADD COLUMN     "ctaText" TEXT,
ADD COLUMN     "features" TEXT[],
ADD COLUMN     "highlightBadge" TEXT,
ADD COLUMN     "tagline" TEXT,
ADD COLUMN     "testimonials" JSONB NOT NULL DEFAULT '[]',
ADD COLUMN     "trustBadges" TEXT[];
