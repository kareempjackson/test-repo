-- CreateEnum
CREATE TYPE "ReviewType" AS ENUM ('CAR_REVIEW', 'RENTER_REVIEW');

-- AlterTable
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "renter_rating" DOUBLE PRECISION DEFAULT 0,
ADD COLUMN IF NOT EXISTS "total_renter_reviews" INTEGER DEFAULT 0;

-- AlterTable
ALTER TABLE "vehicles" ADD COLUMN IF NOT EXISTS "average_rating" DOUBLE PRECISION DEFAULT 0,
ADD COLUMN IF NOT EXISTS "total_reviews" INTEGER DEFAULT 0;

-- CreateTable
CREATE TABLE "reviews" (
    "id" TEXT NOT NULL,
    "booking_id" TEXT NOT NULL,
    "reviewer_id" TEXT NOT NULL,
    "reviewee_id" TEXT,
    "vehicle_id" TEXT,
    "review_type" "ReviewType" NOT NULL,
    "rating" INTEGER NOT NULL,
    "comment" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "reviews_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "reviews_booking_id_idx" ON "reviews"("booking_id");

-- CreateIndex
CREATE INDEX "reviews_reviewer_id_idx" ON "reviews"("reviewer_id");

-- CreateIndex
CREATE INDEX "reviews_reviewee_id_idx" ON "reviews"("reviewee_id");

-- CreateIndex
CREATE INDEX "reviews_vehicle_id_idx" ON "reviews"("vehicle_id");

-- CreateIndex
CREATE UNIQUE INDEX "reviews_booking_id_review_type_key" ON "reviews"("booking_id", "review_type");

-- AddForeignKey
ALTER TABLE "reviews" ADD CONSTRAINT "reviews_booking_id_fkey" FOREIGN KEY ("booking_id") REFERENCES "bookings"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reviews" ADD CONSTRAINT "reviews_reviewer_id_fkey" FOREIGN KEY ("reviewer_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reviews" ADD CONSTRAINT "reviews_reviewee_id_fkey" FOREIGN KEY ("reviewee_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reviews" ADD CONSTRAINT "reviews_vehicle_id_fkey" FOREIGN KEY ("vehicle_id") REFERENCES "vehicles"("id") ON DELETE SET NULL ON UPDATE CASCADE;
