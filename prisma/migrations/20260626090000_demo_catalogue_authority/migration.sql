ALTER TABLE "trip_departures"
  ADD COLUMN "catalogue_source" TEXT NOT NULL DEFAULT 'LEGACY',
  ADD COLUMN "catalogue_version" TEXT,
  ADD COLUMN "pickup_point_codes" JSONB NOT NULL DEFAULT '[]';

CREATE INDEX "trip_departures_catalogue_source_catalogue_version_operational_status_departure_at_utc_idx"
  ON "trip_departures"("catalogue_source", "catalogue_version", "operational_status", "departure_at_utc");

CREATE TABLE "catalogue_pickup_points" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "public_id" TEXT NOT NULL,
  "catalogue_source" TEXT NOT NULL,
  "catalogue_version" TEXT NOT NULL,
  "pickup_point_code" TEXT NOT NULL,
  "route_from_code" TEXT NOT NULL,
  "canonical_name" TEXT NOT NULL,
  "aliases" JSONB NOT NULL DEFAULT '[]',
  "active" BOOLEAN NOT NULL DEFAULT true,
  "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ(3) NOT NULL,
  CONSTRAINT "catalogue_pickup_points_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "catalogue_pickup_points_public_id_key"
  ON "catalogue_pickup_points"("public_id");

CREATE UNIQUE INDEX "catalogue_pickup_points_catalogue_source_catalogue_version_pickup_point_code_key"
  ON "catalogue_pickup_points"("catalogue_source", "catalogue_version", "pickup_point_code");

CREATE INDEX "catalogue_pickup_points_catalogue_source_catalogue_version_active_idx"
  ON "catalogue_pickup_points"("catalogue_source", "catalogue_version", "active");

CREATE INDEX "catalogue_pickup_points_route_from_code_active_idx"
  ON "catalogue_pickup_points"("route_from_code", "active");
