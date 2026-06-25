CREATE TYPE "RevenueTwinWaitlistStatus" AS ENUM ('PENDING', 'OFFERED', 'CANCELLED', 'EXPIRED');

CREATE TABLE "revenue_twin_waitlist_entries" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "public_id" TEXT NOT NULL,
  "call_session_id" UUID NOT NULL,
  "booking_id" UUID,
  "evaluation_id" UUID NOT NULL,
  "requested_departure_id" TEXT NOT NULL,
  "passenger_count" INTEGER NOT NULL,
  "status" "RevenueTwinWaitlistStatus" NOT NULL DEFAULT 'PENDING',
  "idempotency_key" TEXT NOT NULL,
  "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ(3) NOT NULL,
  CONSTRAINT "revenue_twin_waitlist_entries_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "revenue_twin_waitlist_entries_public_id_key" ON "revenue_twin_waitlist_entries"("public_id");
CREATE UNIQUE INDEX "revenue_twin_waitlist_entries_idempotency_key_key" ON "revenue_twin_waitlist_entries"("idempotency_key");
CREATE UNIQUE INDEX "revenue_twin_waitlist_entries_call_session_id_evaluation_id_key" ON "revenue_twin_waitlist_entries"("call_session_id", "evaluation_id");
CREATE INDEX "revenue_twin_waitlist_entries_requested_departure_id_status_created_at_idx" ON "revenue_twin_waitlist_entries"("requested_departure_id", "status", "created_at");

ALTER TABLE "revenue_twin_waitlist_entries"
  ADD CONSTRAINT "revenue_twin_waitlist_entries_call_session_id_fkey"
    FOREIGN KEY ("call_session_id") REFERENCES "call_sessions"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT "revenue_twin_waitlist_entries_booking_id_fkey"
    FOREIGN KEY ("booking_id") REFERENCES "bookings"("id") ON DELETE SET NULL ON UPDATE CASCADE,
  ADD CONSTRAINT "revenue_twin_waitlist_entries_evaluation_id_fkey"
    FOREIGN KEY ("evaluation_id") REFERENCES "revenue_twin_evaluations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
