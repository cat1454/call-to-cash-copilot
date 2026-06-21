ALTER TABLE "transcript_turns"
  ADD COLUMN "provider" TEXT,
  ADD COLUMN "provider_turn_id" TEXT;

UPDATE "transcript_turns"
SET "provider" = lower("source"::text),
    "provider_turn_id" = "provider_event_id"
WHERE "provider_event_id" IS NOT NULL;

CREATE UNIQUE INDEX "transcript_turns_provider_provider_turn_id_key"
  ON "transcript_turns"("provider", "provider_turn_id");

CREATE TABLE "provider_webhook_notices" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "provider" TEXT NOT NULL,
  "notice_id" TEXT NOT NULL,
  "call_id" UUID NOT NULL,
  "received_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "provider_webhook_notices_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "provider_webhook_notices_provider_notice_id_key"
  ON "provider_webhook_notices"("provider", "notice_id");
CREATE INDEX "provider_webhook_notices_call_id_received_at_idx"
  ON "provider_webhook_notices"("call_id", "received_at");
