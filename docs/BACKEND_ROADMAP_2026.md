# Backend Roadmap 2026 - Call-to-Cash Risk Copilot

Cập nhật: 2026-06-19  
Phạm vi: roadmap backend và API contract, chưa triển khai code backend.

## 1. Mục Tiêu

Repo hiện tại là demo React/Vite mô phỏng toàn bộ Call-to-Cash loop ở frontend:

```text
Messy Voice -> Risk Score -> Agreement -> Payment Gate -> Solana Proof -> Trust Receipt
```

Mục tiêu backend là đưa demo từ mock state trong browser sang một API contract thật, có thể gắn dần với Agora Conversational AI và Solana Pay mà không phải viết lại frontend.

Backend cần làm 5 việc chính:

- Lưu conversation session, transcript turns, booking draft, risk snapshots, payment sessions, ledger proofs và trust receipts trong Postgres.
- Chuyển logic payment gate từ `gateUnlocked` mock thành rule engine có điều kiện rõ ràng.
- Tạo API/SSE contract ổn định để frontend React có thể thay mock bằng API adapter.
- Đặt các adapter ports cho Mock, Agora và Solana để hackathon demo vẫn chạy được khi API thật chưa sẵn sàng.
- Giữ đúng guardrail của proposal V6: khách hàng thấy "cọc tiền", "giữ chỗ", "biên nhận xác minh"; chỉ Mentor Console mới thấy proof/hash/tx detail.

## 2. Tech Stack 2026 Đề Xuất

| Lớp | Công nghệ | Lý do chọn năm 2026 |
| --- | --- | --- |
| API framework | FastAPI | Type-hint-first, OpenAPI tự động, phù hợp contract nhanh, hỗ trợ streaming response/SSE. |
| Runtime | Python 3.14.x | Python 3.14 là feature release ổn định hiện hành năm 2026; dùng type/runtime support mới nhưng tránh claim vào tính năng experimental. |
| Schema/validation | Pydantic v2 + Pydantic Settings | FastAPI đã deprecate hướng Pydantic v1 cho các Python mới; Settings quản lý env/secrets có type validation. |
| Database | PostgreSQL 18.x | Nhanh và production-ready; PostgreSQL 18 có AIO, `uuidv7()`, cải tiến index/upgrade. PostgreSQL 19 đang beta nên không chọn cho demo backend. |
| ORM | SQLAlchemy 2.x async ORM | `AsyncSession` phù hợp FastAPI, tách domain/service/repository rõ ràng. |
| Migration | Alembic | Migration chuẩn của SQLAlchemy, có autogenerate và SQL/offline mode. |
| Driver | asyncpg | PostgreSQL async driver phổ biến cho Python backend. |
| Realtime UI updates | Server-Sent Events (SSE) | Đủ cho transcript/score/payment/proof updates một chiều từ backend sang frontend, đơn giản hơn WebSocket cho MVP. |
| Local dev | Docker Compose | Chạy Postgres + API local bằng `.env`, dễ demo và onboarding. |
| Tests | pytest + httpx AsyncClient | Test async FastAPI app và DB flow. |

Quyết định quan trọng:

- Không dùng PostgreSQL 19 trong MVP vì năm 2026 nó vẫn ở beta.
- Không đưa Commerce Kit của Solana vào phase đầu như dependency bắt buộc vì tài liệu Solana ghi Commerce Kit còn beta. Phase đầu chỉ cần Solana Pay URL/QR protocol và adapter interface.
- Không expose Solana/blockchain/hash trong customer-facing flow; chỉ hiện trong Mentor Console hoặc technical details.

## 3. Kiến Trúc Backend Mục Tiêu

```text
React/Vite UI
  |
  | REST commands + SSE events
  v
FastAPI Backend
  |
  +-- Conversation Service
  +-- Booking Draft Service
  +-- Risk Engine
  +-- Payment Gate Service
  +-- Ledger Auditor
  +-- Trust Receipt Service
  |
  +-- VoiceProvider port
  |     +-- MockVoiceProvider
  |     +-- AgoraProvider
  |
  +-- PaymentProvider port
  |     +-- MockPaymentProvider
  |     +-- SolanaPayProvider
  |
  +-- EventPublisher
        +-- SSE stream

PostgreSQL
  +-- sessions
  +-- conversation_turns
  +-- booking_drafts
  +-- risk_snapshots
  +-- payment_sessions
  +-- ledger_proofs
  +-- trust_receipts
```

Backend nên được viết theo ports/adapters:

- Core services không import Agora/Solana SDK trực tiếp.
- Adapter thật và adapter mock cùng implement một interface.
- Frontend chỉ biết REST/SSE contract, không biết provider nào đang được dùng.

## 4. Domain Model

### 4.1. `ConversationSession`

Đại diện một cuộc gọi/đặt chỗ.

Trường tối thiểu:

- `id`: UUIDv7 nếu dùng PostgreSQL 18 `uuidv7()`.
- `booking_id`: dạng `BK-YYYYMMDD-XXXX` hoặc UUID-derived friendly id.
- `status`: `idle`, `active`, `awaiting_confirmation`, `payment_pending`, `paid`, `receipt_issued`, `manual_review`, `cancelled`.
- `source`: `mock`, `agora`.
- `created_at`, `updated_at`, `ended_at`.

### 4.2. `ConversationTurn`

Lưu transcript off-chain.

Trường tối thiểu:

- `id`
- `session_id`
- `speaker`: `customer`, `ai`, `system`
- `content`
- `started_at`, `ended_at`
- `latency_ms`
- `provider_event_id`
- `raw_provider_payload_json` nullable, chỉ dùng cho Mentor/debug.

### 4.3. `BookingDraft`

Trạng thái booking đang được trích xuất từ hội thoại.

Trường tối thiểu:

- `session_id`
- `route_from`, `route_to`
- `departure_time`
- `passenger_count`
- `phone_plain_encrypted` hoặc không lưu plain phone trong MVP nếu chưa có encryption layer.
- `phone_masked`
- `total_amount_vnd`
- `deposit_amount_vnd`
- `refund_policy_confirmed`
- `explicit_confirmation`
- `agreement_version`

### 4.4. `RiskSnapshot`

Mỗi lần có turn mới, backend tính snapshot mới.

Trường tối thiểu:

- `session_id`
- `completeness`
- `dispute_risk`
- `payment_readiness`
- `agent_quality`
- `call_to_cash_readiness`
- `gate_status`: `locked`, `unlocked`
- `gate_reason`
- `missing_fields_json`
- `next_best_action`

Rule MVP:

```text
IF completeness >= 85
AND payment_readiness >= 80
AND dispute_risk <= 35
AND explicit_confirmation = true
THEN unlock payment gate
ELSE keep payment gate locked
```

### 4.5. `PaymentSession`

Phiên cọc tiền/giữ chỗ.

Trường tối thiểu:

- `id`
- `session_id`
- `amount_vnd`
- `provider`: `mock`, `solana_pay`
- `reference`
- `payment_url`
- `qr_payload`
- `expires_at`
- `status`: `created`, `pending`, `confirmed`, `expired`, `failed`
- `tx_signature` nullable
- `confirmed_at` nullable

### 4.6. `LedgerProof`

Bằng chứng đối soát agreement.

Trường tối thiểu:

- `id`
- `session_id`
- `payment_session_id`
- `agreement_payload_json`
- `agreement_hash_sha256`
- `anchored_hash`
- `computed_hash`
- `verification_status`: `match`, `mismatch`, `pending`
- `anchor_reference`
- `created_at`, `verified_at`

Hash policy:

- Dùng canonical JSON.
- Dùng SHA-256.
- Payload không chứa phone plain; chỉ chứa `phone_masked` hoặc phone hash.
- Mọi thay đổi booking sau khi receipt issued phải làm computed hash khác anchored hash.

### 4.7. `TrustReceipt`

Output cuối cho customer và Mentor Console.

Trường tối thiểu:

- `id`
- `session_id`
- `booking_id`
- `receipt_status`: `verified`, `invalidated`, `manual_review`
- `booking_snapshot_json`
- `deposit_snapshot_json`
- `verification_summary_json`
- `support_action`
- `created_at`

## 5. API Contract

Base path: `/api/v1`

### 5.1. Sessions

#### `POST /sessions`

Tạo call session mới.

Request:

```json
{
  "source": "mock",
  "scenario_id": "normal_booking"
}
```

Response:

```json
{
  "session_id": "uuid",
  "booking_id": "BK-20260619-1028",
  "status": "idle",
  "sse_url": "/api/v1/sessions/{session_id}/events"
}
```

#### `GET /sessions/{session_id}`

Lấy current state để hydrate UI.

Response gồm:

- session status
- transcript turns
- booking draft
- latest risk snapshot
- payment session nếu có
- receipt nếu có

### 5.2. Conversation Turns

#### `POST /sessions/{session_id}/turns`

Thêm turn mới từ mock replay hoặc Agora transcript.

Request:

```json
{
  "speaker": "customer",
  "content": "Anh muốn đặt 3 vé Hà Nội đi Sa Pa lúc 22:30.",
  "provider_event_id": "optional"
}
```

Response:

```json
{
  "turn_id": "uuid",
  "booking": {
    "route_from": "Hà Nội",
    "route_to": "Sa Pa",
    "departure_time": "22:30",
    "passenger_count": 3,
    "phone_masked": null,
    "deposit_amount_vnd": 300000
  },
  "risk": {
    "completeness": 70,
    "dispute_risk": 10,
    "payment_readiness": 55,
    "gate_status": "locked",
    "gate_reason": "missing_phone_and_confirmation",
    "next_best_action": "Ask for contact phone number."
  }
}
```

### 5.3. Agreement Confirmation

#### `POST /sessions/{session_id}/agreement/confirm`

Đánh dấu explicit confirmation sau khi AI đọc lại terms.

Request:

```json
{
  "confirmed_by": "customer",
  "confirmation_text": "Đồng ý, thông tin đúng rồi, mở cổng cọc giúp anh."
}
```

Response:

```json
{
  "explicit_confirmation": true,
  "gate_status": "unlocked",
  "gate_reason": "all_conditions_met"
}
```

Nếu chưa đủ threshold, response trả `gate_status = locked` và `gate_reason` cụ thể.

### 5.4. Payment Sessions

#### `POST /sessions/{session_id}/payment-sessions`

Chỉ cho phép khi payment gate đã unlocked.

Response:

```json
{
  "payment_id": "uuid",
  "amount_vnd": 300000,
  "reference": "REF-BK-20260619-1028-001",
  "payment_url": "solana:...",
  "qr_payload": "solana:...",
  "expires_at": "2026-06-19T15:30:00Z",
  "status": "pending"
}
```

#### `POST /payments/{payment_id}/simulate-confirm`

Dev-only endpoint cho hackathon demo.

Response:

```json
{
  "payment_id": "uuid",
  "status": "confirmed",
  "tx_signature": "mock_tx_...",
  "proof_status": "match",
  "receipt_id": "uuid"
}
```

### 5.5. Webhooks

#### `POST /agora/webhook`

Slot nhận event từ Agora Conversational AI.

Cần map các event vào:

- agent joined/left/history
- transcript messages
- call-state events
- turn metrics: ASR, LLM, TTS latency

#### `POST /solana/webhook`

Slot nhận/trigger verify tx.

Phase đầu có thể không có webhook thật; backend có thể poll/verify theo reference, amount, recipient và tx signature.

### 5.6. Receipts

#### `GET /receipts/{receipt_id}`

Lấy Trust Receipt.

#### `POST /receipts/{receipt_id}/verify`

Recompute agreement hash từ booking snapshot hiện tại và so với anchored hash.

Response:

```json
{
  "receipt_id": "uuid",
  "computed_hash": "sha256:...",
  "anchored_hash": "sha256:...",
  "verification_status": "match"
}
```

### 5.7. Dev Tamper

#### `POST /dev/tamper`

Dev-only endpoint để demo mismatch.

Request:

```json
{
  "session_id": "uuid",
  "patch": {
    "route_to": "Nha Trang",
    "passenger_count": 10
  }
}
```

Response:

```json
{
  "receipt_status": "invalidated",
  "verification_status": "mismatch",
  "support_action": "manual_review_required"
}
```

## 6. SSE Event Contract

Endpoint:

```text
GET /api/v1/sessions/{session_id}/events
```

Event format:

```text
event: booking_updated
id: 42
data: {"session_id":"...","booking":{...}}
```

Event names:

- `session_started`
- `turn_added`
- `booking_updated`
- `risk_scored`
- `gate_locked`
- `gate_unlocked`
- `payment_created`
- `payment_pending`
- `payment_confirmed`
- `proof_anchored`
- `proof_verified`
- `receipt_issued`
- `proof_mismatch`
- `manual_review_required`
- `session_ended`

Frontend adapter can map SSE events vào state hiện tại của `useCallSimulation`:

- `turn_added` -> transcript/subtitles
- `booking_updated` -> bookingData
- `risk_scored` -> scores/performance/decision
- `gate_unlocked` -> showPaymentDrawer
- `payment_confirmed` + `receipt_issued` -> showBoardingPass
- `proof_mismatch` -> isTampered + ledgerLogs mismatch

### 6.1. Mobile Operator Dashboard Mapping

`PhoneDashboardView` is a mobile-only operator/demo view. It should be hydrated from the same session state used by the desktop mentor console, not from a separate endpoint.

Frontend props and backend sources:

| Prop | Backend source |
| --- | --- |
| `scores` | latest `RiskSnapshot` fields: `completeness`, `payment_readiness`, `dispute_risk` |
| `performance` | latest voice/turn telemetry: `ttfr`, `turngap`, `clarify` |
| `brainMode` | risk/voice routing hint such as `fast`, `slow`, or `human` |
| `showPrefetch`, `prefetchContent` | optional next-best context prepared by backend |
| `timelineSteps` | derived event progress across call, risk, gate, payment, proof, receipt |
| `ledgerLogs` | latest `LedgerProof`: tx signature, anchored hash, computed hash, verification status |
| `bookingData` | current `BookingDraft`/receipt booking snapshot with phone already masked |
| `simStatus` | current `ConversationSession.status` display label |
| `isTampered` | true when proof status is `mismatch` or receipt is invalidated |
| `showPaymentDrawer` | true after `gate_unlocked` and before payment completion |

The mobile dashboard intentionally does not render raw JSON. Backend API mode should preserve this priority order: operator gate status first, risk gate scores, voice telemetry, booking snapshot, then ledger trust proof. Phone numbers must be masked before reaching the dashboard.

## 7. Adapter Ports

### 7.1. `VoiceProvider`

Interface:

- `start_session(session_id)`
- `ingest_turn(session_id, turn_payload)`
- `stop_session(session_id)`

Implementations:

- `MockVoiceProvider`: replay 3 scenarios hiện tại.
- `AgoraProvider`: nhận transcript qua Signaling messages và webhook event notifications.

### 7.2. `RiskEngine`

Interface:

- `extract_booking(turns, current_booking)`
- `score(current_booking, turns)`
- `decide_gate(risk_snapshot, booking)`
- `next_best_action(risk_snapshot, missing_fields)`

Implementations:

- `RuleBasedRiskEngine`: phase đầu, deterministic.
- `LLMRiskEngine`: phase sau, chỉ dùng khi có eval/test set.

### 7.3. `PaymentProvider`

Interface:

- `create_payment_session(booking, deposit_amount)`
- `verify_payment(reference, amount, recipient)`
- `expire_payment(payment_id)`

Implementations:

- `MockPaymentProvider`: simulate-confirm endpoint.
- `SolanaPayProvider`: tạo Solana Pay URL/QR, verify tx bằng reference/memo.

### 7.4. `LedgerAuditor`

Interface:

- `build_agreement_payload(booking, payment)`
- `hash_agreement(payload)`
- `anchor_proof(payment, hash)`
- `verify_current_payload(receipt)`

Phase đầu:

- anchor proof trong DB/mock transaction metadata.

Phase Solana:

- gắn hash/reference vào memo/reference tùy theo cách implement Solana Pay.
- không đưa full transcript, full audio, phone plain lên chain.

## 8. Roadmap Theo Phase

### Phase 0 - Documentation & API Freeze

Output:

- File roadmap này.
- Chốt REST/SSE contract v1.
- Chốt domain states và gate rule.

Exit criteria:

- Frontend và backend có chung ngôn ngữ: session, turn, booking draft, risk snapshot, payment session, ledger proof, receipt.

### Phase 1 - Backend Scaffold

Output:

- `backend/` FastAPI app.
- `pyproject.toml` hoặc dependency file cho Python.
- Docker Compose: API + PostgreSQL 18.
- Pydantic Settings config.
- Health endpoint: `GET /health`.
- CORS cho Vite local.

Exit criteria:

- Chạy được API local.
- OpenAPI docs hiện endpoint skeleton.
- Kết nối Postgres thành công.

### Phase 2 - Database & Migrations

Output:

- SQLAlchemy async models.
- Alembic initial migration.
- Repositories cho sessions, turns, bookings, risk snapshots, payments, proofs, receipts.

Exit criteria:

- Tạo session -> lưu turn -> lưu booking/risk snapshot qua test integration.
- Migration chạy clean trên database rỗng.

### Phase 3 - Mock Contract Backend

Output:

- Port 3 scenarios hiện tại sang backend seed/mock provider.
- Rule-based extraction/scoring/gate.
- SHA-256 canonical agreement hash.
- Dev simulate payment + tamper endpoints.

Exit criteria:

- Happy path tạo receipt `match`.
- Tamper path tạo `mismatch` và `manual_review_required`.
- Payment gate không mở nếu thiếu explicit confirmation.

### Phase 4 - Frontend API Adapter

Output:

- `VITE_API_MODE=mock|api`.
- `VITE_API_BASE_URL`.
- API client/service layer.
- SSE listener.
- Mock fallback khi backend offline.

Exit criteria:

- UI hiện tại chạy được với backend API mode.
- UI vẫn chạy được mock mode nếu backend tắt.
- Không gọi trực tiếp Agora/Solana từ frontend.

### Phase 5A - Agora Adapter

Output:

- Agora webhook endpoint.
- Mapping transcript/event notifications vào `ConversationTurn`.
- Mapping metrics vào `RiskSnapshot`/performance.
- Slot token/session management nếu cần browser voice client.

Exit criteria:

- Backend nhận được transcript turns từ Agora test/stub.
- SSE đẩy transcript và metrics sang Mentor Console.

### Phase 5B - Solana Adapter

Output:

- Tạo Solana Pay transfer request/payment URL/QR.
- Reference/memo mapping với booking.
- Verify tx signature/reference/amount/recipient.
- Lưu tx signature và anchor hash.

Exit criteria:

- Payment session có reference duy nhất.
- Backend confirm payment theo tx/reference.
- Receipt verify `match`.

### Phase 6 - Demo Hardening

Output:

- `.env.example`.
- Backend README/runbook.
- Dev-only endpoints bị tắt khi `APP_ENV != development`.
- Structured logs.
- Basic rate limiting cho webhook/dev endpoints nếu kịp.

Exit criteria:

- Demo 3 phút chạy ổn định.
- Failure mode có message dễ hiểu.
- Mentor có thể mở technical details và thấy API/proof flow.

## 9. Test Plan

### Unit Tests

- Gate locked khi missing route/time/seats/phone.
- Gate locked khi readiness < 80.
- Gate locked khi dispute risk > 35.
- Gate locked khi chưa explicit confirmation.
- Gate unlocked khi đủ cả 4 điều kiện.
- Canonical SHA-256 hash ổn định với cùng payload.
- Tampered payload tạo hash khác.

### Integration Tests

- `POST /sessions` -> `POST /turns` -> `POST /agreement/confirm` -> `POST /payment-sessions` -> `POST /simulate-confirm` -> `GET /receipts`.
- SSE event order đúng happy path.
- SSE event order đúng mismatch path.
- Payment session expired sau `expires_at`.
- Dev tamper endpoint bị chặn khi non-dev mode.

### Frontend Acceptance

- 3 scenario hiện tại chạy được bằng API mode.
- Mock fallback chạy được khi backend offline.
- Payment drawer chỉ mở sau `gate_unlocked`.
- Trust Receipt hiện `MATCH` sau payment confirmed.
- Tamper hiện `MISMATCH` và khóa vé.

## 10. Guardrails

- Không hardcode Agora keys, Solana private keys, recipient secrets trong frontend.
- Không lưu full audio, full transcript, full phone plain text lên chain.
- Không claim blockchain là phán quyết pháp lý tuyệt đối; proof hash chỉ chứng minh snapshot có khớp với dữ liệu sau đó hay không.
- Customer-facing UI tránh các từ: blockchain, on-chain, memo, proof hash, tx signature.
- Payment link chỉ mở khi có explicit confirmation.
- Tắt dev-only endpoints trong non-dev.
- Mọi provider thật phải nằm sau adapter interface.

## 11. Acceptance Criteria Cho Backend Roadmap

Backend được xem là sẵn sàng để gắn API khi:

- Có FastAPI app chạy local với Postgres 18.
- Có OpenAPI docs cho tất cả endpoint trong contract.
- Có SSE stream cho session events.
- Có DB migrations cho domain model.
- Có mock provider replay đủ 3 scenario hiện tại.
- Có payment gate rule đúng proposal V6.
- Có SHA-256 agreement proof và tamper mismatch demo.
- Có frontend API adapter/fallback plan.
- Có slot rõ ràng để gắn Agora webhook và Solana Pay provider mà không đổi domain/service core.

## 12. Nguồn Cập Nhật 2026

- FastAPI docs: https://fastapi.tiangolo.com/
- FastAPI Pydantic migration notes: https://fastapi.tiangolo.com/how-to/migrate-from-pydantic-v1-to-pydantic-v2/
- Python 3.14 docs: https://docs.python.org/3/whatsnew/3.14.html
- PostgreSQL 18 release notes: https://www.postgresql.org/docs/release/18.0/
- PostgreSQL release archive/current minors: https://www.postgresql.org/docs/release/
- SQLAlchemy async docs: https://docs.sqlalchemy.org/en/latest/orm/extensions/asyncio.html
- Alembic docs: https://alembic.sqlalchemy.org/
- Pydantic Settings docs: https://docs.pydantic.dev/latest/concepts/pydantic_settings/
- Solana Pay docs: https://solana.com/docs/payments/accept-payments/solana-pay
- Solana Payment with Memo: https://solana.com/docs/payments/send-payments/payment-with-memo
- Agora Conversational AI event notifications: https://docs.agora.io/en/conversational-ai/develop/event-notifications
- Agora event types: https://docs.agora.io/en/conversational-ai/develop/event-types
- Agora Conversational AI release notes: https://docs.agora.io/en/conversational-ai/overview/release-notes
