CREATE TYPE "RevenueTwinOfferStatus" AS ENUM (
  'OPEN', 'ACCEPTED', 'DECLINED', 'EXPIRED', 'SUPERSEDED', 'REQUIRES_REEVALUATION'
);

CREATE TABLE "revenue_twin_evaluations" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "public_id" TEXT NOT NULL,
  "call_session_id" UUID NOT NULL,
  "booking_id" UUID,
  "requested_departure_id" TEXT NOT NULL,
  "status" TEXT NOT NULL,
  "policy_version" TEXT NOT NULL,
  "demand_context" JSONB NOT NULL,
  "impact" JSONB NOT NULL,
  "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "revenue_twin_evaluations_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "revenue_twin_evaluations_public_id_key" ON "revenue_twin_evaluations"("public_id");
CREATE INDEX "revenue_twin_evaluations_call_session_id_created_at_idx" ON "revenue_twin_evaluations"("call_session_id", "created_at");
CREATE INDEX "revenue_twin_evaluations_booking_id_created_at_idx" ON "revenue_twin_evaluations"("booking_id", "created_at");

CREATE TABLE "revenue_twin_offers" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "public_id" TEXT NOT NULL,
  "evaluation_id" UUID NOT NULL,
  "alternative_departure_id" UUID NOT NULL,
  "rank" INTEGER NOT NULL,
  "operator_relation" TEXT NOT NULL,
  "scheduled_at" TIMESTAMPTZ(3) NOT NULL,
  "time_shift_minutes" INTEGER NOT NULL,
  "passenger_count" INTEGER NOT NULL,
  "available_seats_at_evaluation" INTEGER NOT NULL,
  "inventory_version_at_evaluation" INTEGER NOT NULL,
  "original_fare_amount_minor" INTEGER NOT NULL,
  "discount_amount_minor" INTEGER NOT NULL,
  "final_fare_amount_minor" INTEGER NOT NULL,
  "reason_codes" JSONB NOT NULL DEFAULT '[]',
  "status" "RevenueTwinOfferStatus" NOT NULL DEFAULT 'OPEN',
  "expires_at" TIMESTAMPTZ(3) NOT NULL,
  "decided_at" TIMESTAMPTZ(3),
  "decision_idempotency_key" TEXT,
  "inventory_hold_id" UUID,
  CONSTRAINT "revenue_twin_offers_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "revenue_twin_offers_public_id_key" ON "revenue_twin_offers"("public_id");
CREATE UNIQUE INDEX "revenue_twin_offers_evaluation_id_rank_key" ON "revenue_twin_offers"("evaluation_id", "rank");
CREATE UNIQUE INDEX "revenue_twin_offers_decision_idempotency_key_key" ON "revenue_twin_offers"("decision_idempotency_key");
CREATE INDEX "revenue_twin_offers_evaluation_id_status_idx" ON "revenue_twin_offers"("evaluation_id", "status");
CREATE INDEX "revenue_twin_offers_alternative_departure_id_status_expires_at_idx" ON "revenue_twin_offers"("alternative_departure_id", "status", "expires_at");

ALTER TABLE "revenue_twin_evaluations"
  ADD CONSTRAINT "revenue_twin_evaluations_call_session_id_fkey"
  FOREIGN KEY ("call_session_id") REFERENCES "call_sessions"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT "revenue_twin_evaluations_booking_id_fkey"
  FOREIGN KEY ("booking_id") REFERENCES "bookings"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "revenue_twin_offers"
  ADD CONSTRAINT "revenue_twin_offers_evaluation_id_fkey"
  FOREIGN KEY ("evaluation_id") REFERENCES "revenue_twin_evaluations"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT "revenue_twin_offers_alternative_departure_id_fkey"
  FOREIGN KEY ("alternative_departure_id") REFERENCES "trip_departures"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  ADD CONSTRAINT "revenue_twin_offers_inventory_hold_id_fkey"
  FOREIGN KEY ("inventory_hold_id") REFERENCES "inventory_holds"("id") ON DELETE SET NULL ON UPDATE CASCADE;
