-- CreateEnum
CREATE TYPE "BookingStatus" AS ENUM ('pending', 'approved', 'rejected', 'cancelled', 'completed');

-- CreateTable
CREATE TABLE "bookings" (
    "id" TEXT NOT NULL,
    "vehicle_id" TEXT NOT NULL,
    "renter_id" TEXT NOT NULL,
    "start_date" TIMESTAMP(3) NOT NULL,
    "end_date" TIMESTAMP(3) NOT NULL,
    "total_days" INTEGER NOT NULL,
    "daily_rate" DOUBLE PRECISION NOT NULL,
    "total_amount" DOUBLE PRECISION NOT NULL,
    "platform_fee" DOUBLE PRECISION NOT NULL,
    "owner_payout" DOUBLE PRECISION NOT NULL,
    "status" "BookingStatus" NOT NULL DEFAULT 'pending',
    "stripe_payment_intent_id" TEXT,
    "payment_confirmed_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "bookings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "vehicle_availabilities" (
    "id" TEXT NOT NULL,
    "vehicle_id" TEXT NOT NULL,
    "start_date" TIMESTAMP(3) NOT NULL,
    "end_date" TIMESTAMP(3) NOT NULL,
    "is_blocked" BOOLEAN NOT NULL DEFAULT true,
    "booking_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "vehicle_availabilities_pkey" PRIMARY KEY ("id")
);

-- AddColumn
ALTER TABLE "users" ADD COLUMN "stripe_connect_account_id" TEXT;

-- CreateIndex
CREATE INDEX "bookings_vehicle_id_idx" ON "bookings"("vehicle_id");

-- CreateIndex
CREATE INDEX "bookings_renter_id_idx" ON "bookings"("renter_id");

-- CreateIndex
CREATE INDEX "bookings_status_idx" ON "bookings"("status");

-- CreateIndex
CREATE INDEX "vehicle_availabilities_vehicle_id_idx" ON "vehicle_availabilities"("vehicle_id");

-- CreateIndex
CREATE INDEX "vehicle_availabilities_dates_idx" ON "vehicle_availabilities"("start_date", "end_date");

-- AddForeignKey
ALTER TABLE "bookings" ADD CONSTRAINT "bookings_vehicle_id_fkey" FOREIGN KEY ("vehicle_id") REFERENCES "vehicles"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bookings" ADD CONSTRAINT "bookings_renter_id_fkey" FOREIGN KEY ("renter_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "vehicle_availabilities" ADD CONSTRAINT "vehicle_availabilities_vehicle_id_fkey" FOREIGN KEY ("vehicle_id") REFERENCES "vehicles"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "vehicle_availabilities" ADD CONSTRAINT "vehicle_availabilities_booking_id_fkey" FOREIGN KEY ("booking_id") REFERENCES "bookings"("id") ON DELETE SET NULL ON UPDATE CASCADE;
