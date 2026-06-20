-- CreateEnum
CREATE TYPE "UserRole" AS ENUM ('CUSTOMER', 'OPERATOR', 'PROVIDER_ADMIN', 'SYSTEM');

-- CreateEnum
CREATE TYPE "CallStatus" AS ENUM ('CREATED', 'ACTIVE', 'ENDED', 'FAILED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "CallPurpose" AS ENUM ('BOOKING');

-- CreateEnum
CREATE TYPE "CallSourceMode" AS ENUM ('LIVE_AGORA', 'TRANSCRIPT_REPLAY', 'DEMO');

-- CreateEnum
CREATE TYPE "ConsentType" AS ENUM ('RECORDING', 'ANALYSIS', 'TRAINING');

-- CreateEnum
CREATE TYPE "ConsentStatus" AS ENUM ('GRANTED', 'REVOKED', 'DECLINED');

-- CreateEnum
CREATE TYPE "ConsentCaptureMethod" AS ENUM ('WEB_MODAL', 'VOICE_CONFIRMATION', 'OPERATOR');

-- CreateEnum
CREATE TYPE "TranscriptSpeaker" AS ENUM ('CUSTOMER', 'AGENT', 'OPERATOR', 'SYSTEM');

-- CreateEnum
CREATE TYPE "TranscriptSource" AS ENUM ('AGORA', 'REPLAY', 'MANUAL');

-- CreateEnum
CREATE TYPE "ExtractionStatus" AS ENUM ('PROPOSED', 'ACCEPTED', 'REJECTED', 'SUPERSEDED');

-- CreateEnum
CREATE TYPE "PaymentGateStatus" AS ENUM ('LOCKED', 'READY_FOR_CONFIRMATION', 'UNLOCKED', 'MANUAL_REVIEW_REQUIRED');

-- CreateEnum
CREATE TYPE "RiskNextAction" AS ENUM ('ASK_CLARIFICATION', 'HOLD', 'ASK_CONFIRMATION', 'OPEN', 'BLOCK', 'HANDOFF', 'RENDER_UPDATED_AGREEMENT', 'ISSUE_RECEIPT', 'MANUAL_REVIEW');

-- CreateEnum
CREATE TYPE "TripDepartureStatus" AS ENUM ('SCHEDULED', 'BOARDING', 'DEPARTED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "InventoryHoldStatus" AS ENUM ('ACTIVE', 'RELEASED', 'EXPIRED', 'CONSUMED');

-- CreateEnum
CREATE TYPE "BookingStatus" AS ENUM ('DRAFT', 'FIELDS_PARTIAL', 'BOOKING_DRAFT_READY', 'AGREEMENT_READY', 'AGREEMENT_LOCKED', 'PAYMENT_PENDING', 'PAYMENT_CONFIRMED', 'BOOKING_CONFIRMED', 'RECEIPT_ISSUED', 'CANCELLED', 'MANUAL_REVIEW_REQUIRED', 'EXPIRED');

-- CreateEnum
CREATE TYPE "Currency" AS ENUM ('VND');

-- CreateEnum
CREATE TYPE "AgreementStatus" AS ENUM ('DRAFT', 'READY', 'LOCKED', 'SUPERSEDED', 'EXPIRED');

-- CreateEnum
CREATE TYPE "ConfirmationMethod" AS ENUM ('VOICE', 'WEB', 'OPERATOR');

-- CreateEnum
CREATE TYPE "PaymentIntentStatus" AS ENUM ('NOT_CREATED', 'CREATED', 'PENDING', 'CONFIRMED', 'FAILED', 'EXPIRED', 'REJECTED', 'MANUAL_REVIEW_REQUIRED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "PaymentChain" AS ENUM ('MOCK', 'SOLANA_DEVNET', 'SOLANA_MAINNET');

-- CreateEnum
CREATE TYPE "PaymentTransactionStatus" AS ENUM ('OBSERVED', 'VALIDATING', 'CONFIRMED', 'REJECTED', 'FAILED');

-- CreateEnum
CREATE TYPE "PaymentAnchorType" AS ENUM ('SOLANA_MEMO', 'SOLANA_REFERENCE', 'SERVER_ATTESTATION');

-- CreateEnum
CREATE TYPE "ProofStatus" AS ENUM ('PENDING', 'MATCH', 'MISMATCH', 'UNAVAILABLE');

-- CreateEnum
CREATE TYPE "ReceiptStatus" AS ENUM ('NOT_CREATED', 'ISSUED', 'VERIFIED_MATCH', 'MISMATCH', 'MANUAL_REVIEW');

-- CreateEnum
CREATE TYPE "ObjectAssetKind" AS ENUM ('RAW_AUDIO', 'RECORDING', 'REDACTED_TRANSCRIPT_EXPORT', 'EVIDENCE_ATTACHMENT');

-- CreateEnum
CREATE TYPE "StorageProvider" AS ENUM ('MINIO', 'S3');

-- CreateEnum
CREATE TYPE "AuditActorType" AS ENUM ('USER', 'OPERATOR', 'SYSTEM', 'WEBHOOK');

-- CreateTable
CREATE TABLE "users" (
    "id" UUID NOT NULL,
    "public_id" TEXT NOT NULL,
    "role" "UserRole" NOT NULL,
    "display_name" TEXT,
    "phone_e164_encrypted" TEXT,
    "phone_masked" TEXT,
    "wallet_address" TEXT,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "trip_departures" (
    "id" UUID NOT NULL,
    "public_id" TEXT NOT NULL,
    "route_code" TEXT NOT NULL,
    "route_from" TEXT NOT NULL,
    "route_to" TEXT NOT NULL,
    "departure_at_utc" TIMESTAMPTZ(3) NOT NULL,
    "departure_timezone" TEXT NOT NULL,
    "capacity" INTEGER NOT NULL,
    "operational_status" "TripDepartureStatus" NOT NULL DEFAULT 'SCHEDULED',
    "currency" "Currency" NOT NULL DEFAULT 'VND',
    "fare_per_seat_minor" INTEGER NOT NULL,
    "deposit_amount_minor" INTEGER NOT NULL,
    "price_policy_version" TEXT NOT NULL,
    "refund_policy_version" TEXT NOT NULL,
    "version" INTEGER NOT NULL DEFAULT 1,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "trip_departures_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "call_sessions" (
    "id" UUID NOT NULL,
    "public_id" TEXT NOT NULL,
    "customer_id" UUID,
    "operator_id" UUID,
    "booking_id" UUID,
    "status" "CallStatus" NOT NULL DEFAULT 'CREATED',
    "channel_name" TEXT NOT NULL,
    "purpose" "CallPurpose" NOT NULL DEFAULT 'BOOKING',
    "started_at" TIMESTAMPTZ(3),
    "ended_at" TIMESTAMPTZ(3),
    "audio_recording_enabled" BOOLEAN NOT NULL DEFAULT false,
    "analysis_enabled" BOOLEAN NOT NULL DEFAULT false,
    "source_mode" "CallSourceMode" NOT NULL,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "call_sessions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "consent_records" (
    "id" UUID NOT NULL,
    "call_session_id" UUID NOT NULL,
    "user_id" UUID,
    "consent_type" "ConsentType" NOT NULL,
    "status" "ConsentStatus" NOT NULL,
    "policy_version" TEXT NOT NULL,
    "captured_via" "ConsentCaptureMethod" NOT NULL,
    "evidence_turn_id" UUID,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "consent_records_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "transcript_turns" (
    "id" UUID NOT NULL,
    "public_id" TEXT NOT NULL,
    "call_session_id" UUID NOT NULL,
    "provider_event_id" TEXT,
    "sequence_no" INTEGER NOT NULL,
    "speaker" "TranscriptSpeaker" NOT NULL,
    "content_redacted" TEXT NOT NULL,
    "content_encrypted" TEXT,
    "language" TEXT NOT NULL,
    "is_final" BOOLEAN NOT NULL,
    "stt_confidence" DECIMAL(5,4),
    "started_at" TIMESTAMPTZ(3),
    "ended_at" TIMESTAMPTZ(3),
    "source" "TranscriptSource" NOT NULL,
    "supersedes_turn_id" UUID,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "transcript_turns_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "booking_extractions" (
    "id" UUID NOT NULL,
    "public_id" TEXT NOT NULL,
    "call_session_id" UUID NOT NULL,
    "source_turn_from" INTEGER NOT NULL,
    "source_turn_to" INTEGER NOT NULL,
    "extraction_version" TEXT NOT NULL,
    "payload" JSONB NOT NULL,
    "field_confidence" JSONB NOT NULL,
    "missing_fields" JSONB NOT NULL DEFAULT '[]',
    "contradictions" JSONB NOT NULL DEFAULT '[]',
    "status" "ExtractionStatus" NOT NULL DEFAULT 'PROPOSED',
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "booking_extractions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "risk_assessments" (
    "id" UUID NOT NULL,
    "public_id" TEXT NOT NULL,
    "call_session_id" UUID,
    "booking_id" UUID,
    "assessment_version" INTEGER NOT NULL,
    "policy_version" TEXT NOT NULL,
    "completeness_score" INTEGER NOT NULL,
    "dispute_risk_score" INTEGER NOT NULL,
    "payment_readiness_score" INTEGER NOT NULL,
    "agent_quality_score" INTEGER,
    "gate_decision" "PaymentGateStatus" NOT NULL,
    "next_action" "RiskNextAction" NOT NULL,
    "reason_codes" JSONB NOT NULL DEFAULT '[]',
    "evidence" JSONB NOT NULL DEFAULT '[]',
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "risk_assessments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "bookings" (
    "id" UUID NOT NULL,
    "public_id" TEXT NOT NULL,
    "call_session_id" UUID,
    "customer_id" UUID,
    "provider_id" UUID,
    "trip_departure_id" UUID,
    "status" "BookingStatus" NOT NULL DEFAULT 'DRAFT',
    "route_from" TEXT,
    "route_to" TEXT,
    "departure_at_utc" TIMESTAMPTZ(3),
    "departure_timezone" TEXT NOT NULL DEFAULT 'Asia/Ho_Chi_Minh',
    "passenger_count" INTEGER,
    "pickup_point_encrypted" TEXT,
    "pickup_point_display" TEXT,
    "contact_phone_encrypted" TEXT,
    "contact_phone_masked" TEXT,
    "currency" "Currency" NOT NULL DEFAULT 'VND',
    "total_amount_minor" INTEGER,
    "deposit_amount_minor" INTEGER,
    "refund_policy_version" TEXT,
    "inventory_hold_expires_at" TIMESTAMPTZ(3),
    "version" INTEGER NOT NULL DEFAULT 1,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "bookings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "inventory_holds" (
    "id" UUID NOT NULL,
    "public_id" TEXT NOT NULL,
    "departure_id" UUID NOT NULL,
    "booking_id" UUID NOT NULL,
    "quantity" INTEGER NOT NULL,
    "status" "InventoryHoldStatus" NOT NULL DEFAULT 'ACTIVE',
    "expires_at" TIMESTAMPTZ(3) NOT NULL,
    "idempotency_key" TEXT NOT NULL,
    "released_at" TIMESTAMPTZ(3),
    "consumed_at" TIMESTAMPTZ(3),
    "version" INTEGER NOT NULL DEFAULT 1,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "inventory_holds_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "agreements" (
    "id" UUID NOT NULL,
    "public_id" TEXT NOT NULL,
    "booking_id" UUID NOT NULL,
    "inventory_hold_id" UUID NOT NULL,
    "version" INTEGER NOT NULL,
    "status" "AgreementStatus" NOT NULL DEFAULT 'DRAFT',
    "canonical_payload" JSONB NOT NULL,
    "payload_hash_sha256" CHAR(64) NOT NULL,
    "policy_version" TEXT NOT NULL,
    "explicit_confirmation_method" "ConfirmationMethod",
    "confirmed_turn_id" UUID,
    "confirmed_at" TIMESTAMPTZ(3),
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "agreements_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "payment_intents" (
    "id" UUID NOT NULL,
    "public_id" TEXT NOT NULL,
    "booking_id" UUID NOT NULL,
    "agreement_id" UUID NOT NULL,
    "status" "PaymentIntentStatus" NOT NULL DEFAULT 'CREATED',
    "currency" "Currency" NOT NULL DEFAULT 'VND',
    "amount_minor" INTEGER NOT NULL,
    "recipient_wallet" TEXT NOT NULL,
    "token_mint" TEXT,
    "solana_reference" TEXT NOT NULL,
    "memo_reference" TEXT NOT NULL,
    "expires_at" TIMESTAMPTZ(3) NOT NULL,
    "idempotency_key" TEXT NOT NULL,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "payment_intents_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "payment_transactions" (
    "id" UUID NOT NULL,
    "payment_intent_id" UUID NOT NULL,
    "chain" "PaymentChain" NOT NULL,
    "tx_signature" TEXT NOT NULL,
    "slot" BIGINT,
    "submitted_at" TIMESTAMPTZ(3),
    "verified_at" TIMESTAMPTZ(3),
    "observed_amount_minor" INTEGER,
    "observed_recipient_wallet" TEXT,
    "observed_reference" TEXT,
    "verification_status" "PaymentTransactionStatus" NOT NULL DEFAULT 'OBSERVED',
    "rejection_reason_code" TEXT,
    "raw_chain_metadata" JSONB,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "payment_transactions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "proof_records" (
    "id" UUID NOT NULL,
    "public_id" TEXT NOT NULL,
    "booking_id" UUID NOT NULL,
    "agreement_id" UUID NOT NULL,
    "payment_transaction_id" UUID,
    "proof_hash_sha256" CHAR(64) NOT NULL,
    "anchor_type" "PaymentAnchorType" NOT NULL,
    "anchor_value" TEXT NOT NULL,
    "verification_status" "ProofStatus" NOT NULL DEFAULT 'PENDING',
    "verified_at" TIMESTAMPTZ(3),
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "proof_records_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "trust_receipts" (
    "id" UUID NOT NULL,
    "public_id" TEXT NOT NULL,
    "booking_id" UUID NOT NULL,
    "payment_intent_id" UUID NOT NULL,
    "proof_record_id" UUID,
    "status" "ReceiptStatus" NOT NULL DEFAULT 'ISSUED',
    "receipt_payload" JSONB NOT NULL,
    "issued_at" TIMESTAMPTZ(3) NOT NULL,
    "verified_at" TIMESTAMPTZ(3),
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "trust_receipts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "object_assets" (
    "id" UUID NOT NULL,
    "call_session_id" UUID,
    "booking_id" UUID,
    "kind" "ObjectAssetKind" NOT NULL,
    "storage_provider" "StorageProvider" NOT NULL,
    "bucket" TEXT NOT NULL,
    "object_key" TEXT NOT NULL,
    "checksum_sha256" CHAR(64),
    "content_type" TEXT NOT NULL,
    "size_bytes" BIGINT NOT NULL,
    "retention_until" TIMESTAMPTZ(3) NOT NULL,
    "deleted_at" TIMESTAMPTZ(3),
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "object_assets_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "audit_logs" (
    "id" UUID NOT NULL,
    "actor_type" "AuditActorType" NOT NULL,
    "actor_id" TEXT,
    "action" TEXT NOT NULL,
    "aggregate_type" TEXT NOT NULL,
    "aggregate_id" TEXT NOT NULL,
    "request_id" TEXT,
    "event_id" TEXT,
    "before_state" JSONB,
    "after_state" JSONB,
    "metadata" JSONB NOT NULL DEFAULT '{}',
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "audit_logs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_public_id_key" ON "users"("public_id");

-- CreateIndex
CREATE UNIQUE INDEX "trip_departures_public_id_key" ON "trip_departures"("public_id");

-- CreateIndex
CREATE INDEX "trip_departures_route_from_route_to_departure_at_utc_idx" ON "trip_departures"("route_from", "route_to", "departure_at_utc");

-- CreateIndex
CREATE INDEX "trip_departures_operational_status_departure_at_utc_idx" ON "trip_departures"("operational_status", "departure_at_utc");

-- CreateIndex
CREATE UNIQUE INDEX "trip_departures_route_code_departure_at_utc_key" ON "trip_departures"("route_code", "departure_at_utc");

-- CreateIndex
CREATE UNIQUE INDEX "call_sessions_public_id_key" ON "call_sessions"("public_id");

-- CreateIndex
CREATE UNIQUE INDEX "call_sessions_booking_id_key" ON "call_sessions"("booking_id");

-- CreateIndex
CREATE UNIQUE INDEX "call_sessions_channel_name_key" ON "call_sessions"("channel_name");

-- CreateIndex
CREATE INDEX "call_sessions_customer_id_created_at_idx" ON "call_sessions"("customer_id", "created_at");

-- CreateIndex
CREATE INDEX "call_sessions_status_created_at_idx" ON "call_sessions"("status", "created_at");

-- CreateIndex
CREATE INDEX "consent_records_call_session_id_consent_type_created_at_idx" ON "consent_records"("call_session_id", "consent_type", "created_at");

-- CreateIndex
CREATE UNIQUE INDEX "transcript_turns_public_id_key" ON "transcript_turns"("public_id");

-- CreateIndex
CREATE INDEX "transcript_turns_call_session_id_created_at_idx" ON "transcript_turns"("call_session_id", "created_at");

-- CreateIndex
CREATE UNIQUE INDEX "transcript_turns_call_session_id_sequence_no_key" ON "transcript_turns"("call_session_id", "sequence_no");

-- CreateIndex
CREATE UNIQUE INDEX "transcript_turns_call_session_id_provider_event_id_key" ON "transcript_turns"("call_session_id", "provider_event_id");

-- CreateIndex
CREATE UNIQUE INDEX "booking_extractions_public_id_key" ON "booking_extractions"("public_id");

-- CreateIndex
CREATE INDEX "booking_extractions_call_session_id_created_at_idx" ON "booking_extractions"("call_session_id", "created_at");

-- CreateIndex
CREATE UNIQUE INDEX "risk_assessments_public_id_key" ON "risk_assessments"("public_id");

-- CreateIndex
CREATE INDEX "risk_assessments_call_session_id_created_at_idx" ON "risk_assessments"("call_session_id", "created_at");

-- CreateIndex
CREATE INDEX "risk_assessments_booking_id_created_at_idx" ON "risk_assessments"("booking_id", "created_at");

-- CreateIndex
CREATE UNIQUE INDEX "risk_assessments_call_session_id_assessment_version_key" ON "risk_assessments"("call_session_id", "assessment_version");

-- CreateIndex
CREATE UNIQUE INDEX "risk_assessments_booking_id_assessment_version_key" ON "risk_assessments"("booking_id", "assessment_version");

-- CreateIndex
CREATE UNIQUE INDEX "bookings_public_id_key" ON "bookings"("public_id");

-- CreateIndex
CREATE UNIQUE INDEX "bookings_call_session_id_key" ON "bookings"("call_session_id");

-- CreateIndex
CREATE INDEX "bookings_customer_id_created_at_idx" ON "bookings"("customer_id", "created_at");

-- CreateIndex
CREATE INDEX "bookings_status_departure_at_utc_idx" ON "bookings"("status", "departure_at_utc");

-- CreateIndex
CREATE INDEX "bookings_trip_departure_id_idx" ON "bookings"("trip_departure_id");

-- CreateIndex
CREATE UNIQUE INDEX "inventory_holds_public_id_key" ON "inventory_holds"("public_id");

-- CreateIndex
CREATE UNIQUE INDEX "inventory_holds_idempotency_key_key" ON "inventory_holds"("idempotency_key");

-- CreateIndex
CREATE INDEX "inventory_holds_departure_id_status_expires_at_idx" ON "inventory_holds"("departure_id", "status", "expires_at");

-- CreateIndex
CREATE INDEX "inventory_holds_booking_id_status_idx" ON "inventory_holds"("booking_id", "status");

-- CreateIndex
CREATE UNIQUE INDEX "agreements_public_id_key" ON "agreements"("public_id");

-- CreateIndex
CREATE INDEX "agreements_booking_id_status_idx" ON "agreements"("booking_id", "status");

-- CreateIndex
CREATE UNIQUE INDEX "agreements_booking_id_version_key" ON "agreements"("booking_id", "version");

-- CreateIndex
CREATE UNIQUE INDEX "payment_intents_public_id_key" ON "payment_intents"("public_id");

-- CreateIndex
CREATE UNIQUE INDEX "payment_intents_solana_reference_key" ON "payment_intents"("solana_reference");

-- CreateIndex
CREATE UNIQUE INDEX "payment_intents_idempotency_key_key" ON "payment_intents"("idempotency_key");

-- CreateIndex
CREATE INDEX "payment_intents_booking_id_status_idx" ON "payment_intents"("booking_id", "status");

-- CreateIndex
CREATE INDEX "payment_intents_agreement_id_status_idx" ON "payment_intents"("agreement_id", "status");

-- CreateIndex
CREATE UNIQUE INDEX "payment_transactions_tx_signature_key" ON "payment_transactions"("tx_signature");

-- CreateIndex
CREATE INDEX "payment_transactions_payment_intent_id_created_at_idx" ON "payment_transactions"("payment_intent_id", "created_at");

-- CreateIndex
CREATE UNIQUE INDEX "proof_records_public_id_key" ON "proof_records"("public_id");

-- CreateIndex
CREATE UNIQUE INDEX "proof_records_payment_transaction_id_key" ON "proof_records"("payment_transaction_id");

-- CreateIndex
CREATE INDEX "proof_records_booking_id_created_at_idx" ON "proof_records"("booking_id", "created_at");

-- CreateIndex
CREATE INDEX "proof_records_agreement_id_idx" ON "proof_records"("agreement_id");

-- CreateIndex
CREATE UNIQUE INDEX "trust_receipts_public_id_key" ON "trust_receipts"("public_id");

-- CreateIndex
CREATE UNIQUE INDEX "trust_receipts_payment_intent_id_key" ON "trust_receipts"("payment_intent_id");

-- CreateIndex
CREATE UNIQUE INDEX "trust_receipts_proof_record_id_key" ON "trust_receipts"("proof_record_id");

-- CreateIndex
CREATE INDEX "trust_receipts_booking_id_created_at_idx" ON "trust_receipts"("booking_id", "created_at");

-- CreateIndex
CREATE INDEX "object_assets_call_session_id_created_at_idx" ON "object_assets"("call_session_id", "created_at");

-- CreateIndex
CREATE INDEX "object_assets_booking_id_created_at_idx" ON "object_assets"("booking_id", "created_at");

-- CreateIndex
CREATE INDEX "object_assets_retention_until_deleted_at_idx" ON "object_assets"("retention_until", "deleted_at");

-- CreateIndex
CREATE UNIQUE INDEX "object_assets_storage_provider_bucket_object_key_key" ON "object_assets"("storage_provider", "bucket", "object_key");

-- CreateIndex
CREATE INDEX "audit_logs_aggregate_type_aggregate_id_created_at_idx" ON "audit_logs"("aggregate_type", "aggregate_id", "created_at");

-- CreateIndex
CREATE INDEX "audit_logs_request_id_idx" ON "audit_logs"("request_id");

-- CreateIndex
CREATE INDEX "audit_logs_event_id_idx" ON "audit_logs"("event_id");

-- AddForeignKey
ALTER TABLE "call_sessions" ADD CONSTRAINT "call_sessions_customer_id_fkey" FOREIGN KEY ("customer_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "call_sessions" ADD CONSTRAINT "call_sessions_operator_id_fkey" FOREIGN KEY ("operator_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "call_sessions" ADD CONSTRAINT "call_sessions_booking_id_fkey" FOREIGN KEY ("booking_id") REFERENCES "bookings"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "consent_records" ADD CONSTRAINT "consent_records_call_session_id_fkey" FOREIGN KEY ("call_session_id") REFERENCES "call_sessions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "consent_records" ADD CONSTRAINT "consent_records_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "consent_records" ADD CONSTRAINT "consent_records_evidence_turn_id_fkey" FOREIGN KEY ("evidence_turn_id") REFERENCES "transcript_turns"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "transcript_turns" ADD CONSTRAINT "transcript_turns_call_session_id_fkey" FOREIGN KEY ("call_session_id") REFERENCES "call_sessions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "transcript_turns" ADD CONSTRAINT "transcript_turns_supersedes_turn_id_fkey" FOREIGN KEY ("supersedes_turn_id") REFERENCES "transcript_turns"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "booking_extractions" ADD CONSTRAINT "booking_extractions_call_session_id_fkey" FOREIGN KEY ("call_session_id") REFERENCES "call_sessions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "risk_assessments" ADD CONSTRAINT "risk_assessments_call_session_id_fkey" FOREIGN KEY ("call_session_id") REFERENCES "call_sessions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "risk_assessments" ADD CONSTRAINT "risk_assessments_booking_id_fkey" FOREIGN KEY ("booking_id") REFERENCES "bookings"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bookings" ADD CONSTRAINT "bookings_call_session_id_fkey" FOREIGN KEY ("call_session_id") REFERENCES "call_sessions"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bookings" ADD CONSTRAINT "bookings_customer_id_fkey" FOREIGN KEY ("customer_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bookings" ADD CONSTRAINT "bookings_provider_id_fkey" FOREIGN KEY ("provider_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bookings" ADD CONSTRAINT "bookings_trip_departure_id_fkey" FOREIGN KEY ("trip_departure_id") REFERENCES "trip_departures"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "inventory_holds" ADD CONSTRAINT "inventory_holds_departure_id_fkey" FOREIGN KEY ("departure_id") REFERENCES "trip_departures"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "inventory_holds" ADD CONSTRAINT "inventory_holds_booking_id_fkey" FOREIGN KEY ("booking_id") REFERENCES "bookings"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "agreements" ADD CONSTRAINT "agreements_booking_id_fkey" FOREIGN KEY ("booking_id") REFERENCES "bookings"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "agreements" ADD CONSTRAINT "agreements_inventory_hold_id_fkey" FOREIGN KEY ("inventory_hold_id") REFERENCES "inventory_holds"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "agreements" ADD CONSTRAINT "agreements_confirmed_turn_id_fkey" FOREIGN KEY ("confirmed_turn_id") REFERENCES "transcript_turns"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payment_intents" ADD CONSTRAINT "payment_intents_booking_id_fkey" FOREIGN KEY ("booking_id") REFERENCES "bookings"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payment_intents" ADD CONSTRAINT "payment_intents_agreement_id_fkey" FOREIGN KEY ("agreement_id") REFERENCES "agreements"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payment_transactions" ADD CONSTRAINT "payment_transactions_payment_intent_id_fkey" FOREIGN KEY ("payment_intent_id") REFERENCES "payment_intents"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "proof_records" ADD CONSTRAINT "proof_records_booking_id_fkey" FOREIGN KEY ("booking_id") REFERENCES "bookings"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "proof_records" ADD CONSTRAINT "proof_records_agreement_id_fkey" FOREIGN KEY ("agreement_id") REFERENCES "agreements"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "proof_records" ADD CONSTRAINT "proof_records_payment_transaction_id_fkey" FOREIGN KEY ("payment_transaction_id") REFERENCES "payment_transactions"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "trust_receipts" ADD CONSTRAINT "trust_receipts_booking_id_fkey" FOREIGN KEY ("booking_id") REFERENCES "bookings"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "trust_receipts" ADD CONSTRAINT "trust_receipts_payment_intent_id_fkey" FOREIGN KEY ("payment_intent_id") REFERENCES "payment_intents"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "trust_receipts" ADD CONSTRAINT "trust_receipts_proof_record_id_fkey" FOREIGN KEY ("proof_record_id") REFERENCES "proof_records"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "object_assets" ADD CONSTRAINT "object_assets_call_session_id_fkey" FOREIGN KEY ("call_session_id") REFERENCES "call_sessions"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "object_assets" ADD CONSTRAINT "object_assets_booking_id_fkey" FOREIGN KEY ("booking_id") REFERENCES "bookings"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Phase 4 domain invariants that Prisma cannot express in schema.prisma.
ALTER TABLE "trip_departures"
  ADD CONSTRAINT "trip_departures_capacity_positive" CHECK ("capacity" > 0),
  ADD CONSTRAINT "trip_departures_fare_non_negative" CHECK ("fare_per_seat_minor" >= 0),
  ADD CONSTRAINT "trip_departures_deposit_positive" CHECK ("deposit_amount_minor" > 0);

ALTER TABLE "bookings"
  ADD CONSTRAINT "bookings_passenger_count_positive" CHECK ("passenger_count" IS NULL OR "passenger_count" > 0),
  ADD CONSTRAINT "bookings_total_amount_non_negative" CHECK ("total_amount_minor" IS NULL OR "total_amount_minor" >= 0),
  ADD CONSTRAINT "bookings_deposit_amount_non_negative" CHECK ("deposit_amount_minor" IS NULL OR "deposit_amount_minor" >= 0),
  ADD CONSTRAINT "bookings_deposit_not_above_total" CHECK (
    "deposit_amount_minor" IS NULL
    OR "total_amount_minor" IS NULL
    OR "deposit_amount_minor" <= "total_amount_minor"
  );

ALTER TABLE "inventory_holds"
  ADD CONSTRAINT "inventory_holds_quantity_positive" CHECK ("quantity" > 0),
  ADD CONSTRAINT "inventory_holds_expiry_after_creation" CHECK ("expires_at" > "created_at");

ALTER TABLE "risk_assessments"
  ADD CONSTRAINT "risk_assessments_completeness_range" CHECK ("completeness_score" BETWEEN 0 AND 100),
  ADD CONSTRAINT "risk_assessments_dispute_range" CHECK ("dispute_risk_score" BETWEEN 0 AND 100),
  ADD CONSTRAINT "risk_assessments_readiness_range" CHECK ("payment_readiness_score" BETWEEN 0 AND 100),
  ADD CONSTRAINT "risk_assessments_agent_quality_range" CHECK (
    "agent_quality_score" IS NULL OR "agent_quality_score" BETWEEN 0 AND 100
  ),
  ADD CONSTRAINT "risk_assessments_locked_has_evidence" CHECK (
    "gate_decision" = 'UNLOCKED'
    OR jsonb_array_length("reason_codes") > 0
    OR jsonb_array_length("evidence") > 0
  );

ALTER TABLE "agreements"
  ADD CONSTRAINT "agreements_version_positive" CHECK ("version" > 0),
  ADD CONSTRAINT "agreements_hash_is_lower_hex" CHECK ("payload_hash_sha256" ~ '^[0-9a-f]{64}$'),
  ADD CONSTRAINT "agreements_locked_has_confirmation" CHECK (
    "status" <> 'LOCKED'
    OR (
      "explicit_confirmation_method" IS NOT NULL
      AND "confirmed_at" IS NOT NULL
    )
  );

ALTER TABLE "payment_intents"
  ADD CONSTRAINT "payment_intents_amount_positive" CHECK ("amount_minor" > 0),
  ADD CONSTRAINT "payment_intents_expiry_after_creation" CHECK ("expires_at" > "created_at"),
  ADD CONSTRAINT "payment_intents_not_created_is_virtual" CHECK ("status" <> 'NOT_CREATED');

ALTER TABLE "proof_records"
  ADD CONSTRAINT "proof_records_hash_is_lower_hex" CHECK ("proof_hash_sha256" ~ '^[0-9a-f]{64}$');

ALTER TABLE "object_assets"
  ADD CONSTRAINT "object_assets_size_non_negative" CHECK ("size_bytes" >= 0);

-- One live resource per aggregate while retaining expired/released history.
CREATE UNIQUE INDEX "inventory_holds_one_active_per_booking"
  ON "inventory_holds" ("booking_id")
  WHERE "status" = 'ACTIVE';

CREATE UNIQUE INDEX "agreements_one_locked_per_booking"
  ON "agreements" ("booking_id")
  WHERE "status" = 'LOCKED';

CREATE UNIQUE INDEX "payment_intents_one_active_per_agreement"
  ON "payment_intents" ("booking_id", "agreement_id")
  WHERE "status" IN ('CREATED', 'PENDING', 'FAILED');

-- Composite references prevent a valid child id from being attached to the
-- wrong booking aggregate.
CREATE UNIQUE INDEX "inventory_holds_id_booking_id_key"
  ON "inventory_holds" ("id", "booking_id");
CREATE UNIQUE INDEX "agreements_id_booking_id_key"
  ON "agreements" ("id", "booking_id");
CREATE UNIQUE INDEX "payment_intents_id_booking_id_key"
  ON "payment_intents" ("id", "booking_id");
CREATE UNIQUE INDEX "proof_records_id_booking_id_key"
  ON "proof_records" ("id", "booking_id");

ALTER TABLE "agreements"
  ADD CONSTRAINT "agreements_inventory_hold_booking_fkey"
  FOREIGN KEY ("inventory_hold_id", "booking_id")
  REFERENCES "inventory_holds" ("id", "booking_id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "payment_intents"
  ADD CONSTRAINT "payment_intents_agreement_booking_fkey"
  FOREIGN KEY ("agreement_id", "booking_id")
  REFERENCES "agreements" ("id", "booking_id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "proof_records"
  ADD CONSTRAINT "proof_records_agreement_booking_fkey"
  FOREIGN KEY ("agreement_id", "booking_id")
  REFERENCES "agreements" ("id", "booking_id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "trust_receipts"
  ADD CONSTRAINT "trust_receipts_intent_booking_fkey"
  FOREIGN KEY ("payment_intent_id", "booking_id")
  REFERENCES "payment_intents" ("id", "booking_id")
  ON DELETE RESTRICT ON UPDATE CASCADE,
  ADD CONSTRAINT "trust_receipts_proof_booking_fkey"
  FOREIGN KEY ("proof_record_id", "booking_id")
  REFERENCES "proof_records" ("id", "booking_id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

-- Locked agreement terms are immutable. Only lifecycle status may move to
-- SUPERSEDED or EXPIRED through an audited service command.
CREATE FUNCTION "protect_locked_agreement_terms"()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF OLD."status" = 'LOCKED' AND (
    NEW."booking_id" IS DISTINCT FROM OLD."booking_id"
    OR NEW."inventory_hold_id" IS DISTINCT FROM OLD."inventory_hold_id"
    OR NEW."version" IS DISTINCT FROM OLD."version"
    OR NEW."canonical_payload" IS DISTINCT FROM OLD."canonical_payload"
    OR NEW."payload_hash_sha256" IS DISTINCT FROM OLD."payload_hash_sha256"
    OR NEW."policy_version" IS DISTINCT FROM OLD."policy_version"
    OR NEW."explicit_confirmation_method" IS DISTINCT FROM OLD."explicit_confirmation_method"
    OR NEW."confirmed_turn_id" IS DISTINCT FROM OLD."confirmed_turn_id"
    OR NEW."confirmed_at" IS DISTINCT FROM OLD."confirmed_at"
  ) THEN
    RAISE EXCEPTION 'locked agreement terms are immutable';
  END IF;

  IF OLD."status" = 'LOCKED'
    AND NEW."status" NOT IN ('LOCKED', 'SUPERSEDED', 'EXPIRED') THEN
    RAISE EXCEPTION 'invalid locked agreement lifecycle transition';
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER "agreements_protect_locked_terms"
BEFORE UPDATE ON "agreements"
FOR EACH ROW
EXECUTE FUNCTION "protect_locked_agreement_terms"();

CREATE FUNCTION "prevent_audit_log_mutation"()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  RAISE EXCEPTION 'audit logs are append-only';
END;
$$;

CREATE TRIGGER "audit_logs_append_only"
BEFORE UPDATE OR DELETE ON "audit_logs"
FOR EACH ROW
EXECUTE FUNCTION "prevent_audit_log_mutation"();
