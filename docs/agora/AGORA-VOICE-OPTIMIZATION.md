# Agora Voice Optimization & Demo Readiness

> **Status:** Execution plan and verification standard  
> **Scope:** Call-to-Cash Risk Copilot — live Agora voice flow, transcript visibility, recovery UX, and voice-agent optimization  
> **Non-goal:** This document does **not** introduce LLM extraction, new payment rules, or a new backend architecture.

## Phase 9 runtime baseline — 2026-06-21

Evidence level for branch `develop`, commit `60d8fd6` plus the current uncommitted hardening change:

| Check | Status |
|---|---|
| pnpm version | Built and verified with `11.1.1` |
| Internal package source/dist exports | Built and runtime-resolved; regression test imports all API-required symbols from `dist` |
| Standard root gates | `db:validate`, lint, typecheck, test, and build passed locally |
| API `/health` | Passed locally (`ok`) |
| API `/ready` | Passed locally: database ready, voice `agora`, payment `solana_devnet` |
| Browser/API provider alignment | Passed safe preflight: `agora / agora` |
| Live microphone + agent audio + novel transcript | **PASS — three independent redacted browser runs, user-attested 2026-06-21** |
| Three-run manual smoke | **PASS — evidence ledger in `docs/operations/AGORA-LIVE-SMOKE-TEST.md`** |

Current recommendation: **GO for Phase 9.2 static prompt implementation.** V1 is injected only by the server-side join request and remains draft-only until its controlled live evaluation is recorded.

### Phase 9.2 gate - Conversation Quality Optimization

**Status: GO - static prompt artifacts are in draft; RTC-first agent startup now passes, while controlled conversation evaluation remains pending.**

The P0 safe preflight passes with the effective Vite browser configuration (`apps/web/.env.local` before `apps/web/.env`) and the server configuration both set to Agora. The three-run browser evidence gate is passed and preserved in `docs/operations/AGORA-LIVE-SMOKE-TEST.md` with redacted, user-attested evidence.

Phase 9.2 may now create a versioned static prompt, evaluation matrix, and artifact tests. Replay remains visibly labelled and cannot masquerade as Agora Live. The V1 prompt stays `DRAFT` until its own three happy-path runs plus interruption, silence, and payment-verifying evaluation are recorded.

#### Prompt deployment discovery

The server reads the server-only `AGORA_CAI_PROPERTIES_JSON` environment value into `config.agora.agentProperties`. `AgoraConversationAgentClient` takes its required `pipeline_id`, preserves compatible non-prompt properties, and loads `packages/agora/prompts/call-to-cash-vi-v1.md` into the supported Agora join field `properties.llm.system_messages`. Prompt content stays server-side and does not enter browser configuration. The repository source, safe pipeline fingerprint, deployment procedure, and recovery boundary are documented in `packages/agora/prompts/README.md`.

No provider prompt-revision or provider rollback API is configured or verified by this repository. Do not invent revision labels or a dashboard workflow. Do not promote V1 until its three happy-path, interruption, silence, and payment-verifying evaluations are recorded with visible transcripts and no unsupported authority claim.

On 2026-06-21, the API was restarted from the built code and its `/health`, `/ready`, and secret-safe preflight checks passed with aligned Agora providers. A legacy server-side V1 join attempt happened before browser RTC readiness and Agora returned `AGORA_CHANNEL_UNAVAILABLE`; that adapter did not retain provider detail/reason. The current implementation reverses that order and preserves future safe provider diagnostics: browser RTC join and microphone publication complete first, then one UID-verified agent start is allowed. On 2026-06-22 a Playwright fake-microphone browser run reached a `200` agent start with `CONNECTED`/`agentStarted`; real audible speech and transcript evidence remain required before V1 evaluation or activation.

The eventual Phase 9.2 static-prompt baseline must remain conversational only. It must not replace deterministic extraction or decide booking, inventory, risk, payment, proof, or receipt state. Phase 9.3 runtime directives remain a separate, unimplemented follow-up.

### Reproducible package integrity path

```powershell
corepack pnpm install --frozen-lockfile
corepack pnpm build
node --test tests/packageRuntimeExports.test.js
```

Every internal package exports runtime code from `dist`. If an application reports a missing named export but `src` contains it, do not rewrite the import. Build the owning package, rerun the runtime-export test, then rerun the root graph. Root dev dependencies pin the compatible CLI-transitive versions required by Prisma and ESLint on the current Windows/pnpm layout; package build scripts themselves never run `pnpm install`.

### Provider-mode matrix

| API | Web | Meaning |
|---|---|---|
| `agora` | `agora` | `Agora Live`; eligible for manual live smoke |
| `replay` | `replay` | `Replay Demo — không phải thoại trực tiếp` |
| `agora` | `replay` | Misaligned; preflight fails unless the operator explicitly selects the visible replay fallback after a live failure |
| `replay` | `agora` | Invalid; preflight fails |

---

## 1. Why this document exists

The Call-to-Cash demo is valuable only when the end-to-end flow is both **real** and **repeatable**:

```text
Customer microphone
  → Agora RTC / Conversation AI Engine
  → agent audio response
  → customer + agent transcript appears in the browser
  → final transcript reaches the API
  → deterministic domain rules update booking / risk / payment gate
  → browser receives state through SSE
  → agreement confirmation
  → Solana Devnet payment verification
  → Trust Receipt
  → browser refresh recovers authoritative state
```

The immediate priority is not feature count. The immediate priority is to ensure that a judge can observe this flow reliably, understand what is live versus replayed, and recover safely after normal failures such as refresh, temporary network loss, microphone denial, or wallet delay.

---

## 2. Product truth and authority boundaries

The following ownership model is mandatory. Do not move business authority into the browser, prompt, or AI agent.

| Layer | Owns | Must not own |
|---|---|---|
| **Browser / web app** | microphone permission, direct RTC join, rendering current state, local reconnect UX | booking confirmation, risk decision, payment verification, receipt issuance |
| **Agora** | real-time audio, agent interaction, transcript/provider facts | availability, inventory, risk, payment, receipt, refund decisions |
| **API** | session orchestration, token issuance, transcript admission, endpoints, SSE stream | raw media relay unless explicitly required by provider architecture |
| **Domain** | deterministic booking, inventory, risk, agreement, payment gate, state transitions | voice phrasing or AI reasoning |
| **PostgreSQL** | durable truth, event/audit history, idempotency, recovery state | client-only temporary UI state |
| **Solana Devnet** | payment evidence and transaction verification | customer PII, full transcript, domain policy |
| **Voice agent prompt** | concise and natural conversational phrasing | deciding payment is verified, booking is confirmed, seats are available |

### Non-negotiable statements

- The browser must never create an authoritative payment success state.
- A final transcript turn must enter the same server-authoritative transcript/domain path used by replay mode.
- Interim transcript may be displayed for UX, but only final/provider-admitted transcript becomes durable business input.
- The agent must never claim that payment is verified, a seat is available, or a receipt exists unless the server-authoritative state says so.
- No full transcript, phone number, seed phrase, private key, wallet secret, or raw agreement payload is written on-chain.

---

## 3. Priority roadmap

### P0 — Make the runtime actually boot and stay aligned

**Goal:** all internal packages compile to current runtime artifacts, API starts successfully, and browser/API provider mode is explicit and aligned.

#### Required work

1. Rebuild internal workspace packages after pull/merge/source copy:

```powershell
corepack pnpm install --frozen-lockfile
corepack pnpm build
```

When full build is temporarily blocked, rebuild the package that owns the failed export, then resume the workspace build:

```powershell
corepack pnpm --filter @call-to-cash/shared build
corepack pnpm --filter @call-to-cash/config build
corepack pnpm --filter @call-to-cash/domain build
corepack pnpm --filter @call-to-cash/db build
corepack pnpm --filter @call-to-cash/solana build
corepack pnpm --filter @call-to-cash/agora build
corepack pnpm --filter @call-to-cash/ai build
```

2. Confirm package runtime exports come from updated `dist/` artifacts.

```powershell
Get-Content .\packages\solana\dist\index.js
Get-Content .\packages\db\dist\index.js
Get-Content .\packages\agora\dist\index.js
```

3. Confirm API and browser use compatible voice modes.

```env
# Server-only environment
VOICE_PROVIDER=agora

# Browser-safe environment only
VITE_VOICE_PROVIDER=agora
```

4. Restart processes after any `.env` change. Vite reads `VITE_*` variables at startup, preferring `apps/web/.env.local` over `apps/web/.env`, and does not reload them dynamically after the server is already running. `demo:preflight` follows the same precedence.

5. Add/keep a safe preflight check that reports only presence/status, never secret values.

#### P0 acceptance criteria

- `pnpm install --frozen-lockfile` completes.
- Required internal packages build without stale `dist` exports.
- API starts and serves `/health` and `/ready`.
- API mode and web mode are either both `agora` or both explicitly replay-compatible.
- The UI labels the active mode honestly: **Agora Live** or **Replay Demo**.
- The application never silently falls back from live Agora to replay.

---

### P1 — Prove the live voice flow end-to-end

**Goal:** demonstrate that browser mic, Agora, transcript, API, SSE, and server-authoritative booking state are all connected.

#### Expected live flow

```text
1. User presses microphone button
2. Browser requests microphone permission
3. Browser requests/receives safe live-session metadata from API
4. Browser joins Agora RTC directly
5. User voice reaches Agora / agent
6. Agent speaks an audible response
7. UI shows interim transcript only as temporary UX feedback
8. Final customer and agent transcript events reach the server path
9. API validates provider event/session/deduplication as applicable
10. API persists final transcript through the normal transcript command
11. Domain recalculates booking facts, risk, and payment gate
12. SSE publishes durable state/event update
13. Browser updates risk/booking UI from server state
```

#### P1 acceptance criteria

- Browser asks for microphone permission when the user starts a live session.
- User can hear the agent response.
- UI shows customer and agent transcript in the active conversation view.
- A final customer turn is persisted and visible after refresh.
- Risk/booking/gate changes are delivered over SSE or recovered through the documented snapshot/REST recovery path.
- The UI visibly identifies whether the session is **Agora Live** or **Replay Demo**.

---

### P2 — Make failure and recovery UX judge-safe

**Goal:** failures must be understandable, truthful, and non-destructive.

Every relevant screen must answer:

1. **What is happening?**
2. **What should the user do now?**
3. **Will my booking/payment state be lost?**

#### Required customer-facing states

| Technical state | Customer-facing wording | Primary action | State safety promise |
|---|---|---|---|
| Microphone permission pending | `Đang xin quyền dùng micro…` | Allow microphone | No booking state is changed |
| Microphone denied | `Bạn chưa cho phép dùng micro. Bạn có thể bật lại quyền micro hoặc dùng chế độ demo replay.` | Retry / Replay | Existing booking remains safe |
| Agora joining | `Đang kết nối cuộc trò chuyện…` | Wait / Cancel | Existing booking remains safe |
| Agora connected | `Đã kết nối. Bạn có thể bắt đầu nói.` | Speak | Live state active |
| Agora reconnecting | `Đang khôi phục kết nối. Thông tin đặt chỗ của bạn vẫn được giữ.` | Wait / End session | Durable booking remains safe |
| Agent unavailable | `Chưa thể kết nối trợ lý giọng nói ngay lúc này.` | Retry / Replay / End | No payment or booking confirmation is fabricated |
| SSE reconnecting | `Đang cập nhật lại trạng thái mới nhất…` | Wait | Browser must recover from server state |
| Payment pending | `Hệ thống đang kiểm tra giao dịch demo. Bạn xem trạng thái trên màn hình giúp mình nhé.` | Retry status check | No receipt issued yet |
| Solana RPC unavailable | `Chưa thể kiểm tra giao dịch ngay lúc này. Thông tin đặt chỗ của bạn vẫn được giữ.` | Retry later | No false payment success |
| Payment mismatch/manual review | `Giao dịch chưa khớp với yêu cầu thanh toán. Hãy kiểm tra lại hoặc thử lại.` | Retry / Support path | Receipt remains blocked |

#### Explicit fallback policy

When live Agora cannot start or reconnect:

```text
Live voice failure
  → Show honest failure state
  → Present three explicit choices:
      1. Retry live voice
      2. Continue in Replay Demo
      3. End session
```

The browser must **not** automatically pretend replay is live Agora.

#### P2 acceptance criteria

- No silent fallback to replay exists.
- Retry, Replay Demo, and End session are explicit UI actions where live voice fails.
- Refresh at any major flow step restores the latest authoritative state.
- SSE reconnect uses `Last-Event-ID` where available, and has REST/snapshot recovery when event continuity cannot be guaranteed.
- Double-clicks/retries do not create duplicate booking confirmation, payment verification, proof, or receipt.

---

### P3 — Optimize the voice-agent experience

**Start only after P0–P2 pass.**

**Goal:** agent speech feels natural, concise, and safe without taking authority away from server/domain rules.

#### Required prompt rules

The agent should:

- Speak Vietnamese naturally and courteously.
- Use one short question at a time.
- Keep each turn to one or two short sentences unless the user asks for detail.
- Ask for missing booking facts and clarify contradictions.
- Handle silence and interruption without sounding robotic.
- Read only a short, approved booking summary.
- Direct users to the screen for payment and verification status.

The agent must not:

- Claim availability unless the server explicitly provides that state.
- Confirm a booking itself.
- Open the payment gate itself.
- Claim payment is verified or Trust Receipt is issued without server-authoritative status.
- Ask for seed phrase, private key, wallet secret, password, OTP, or full payment credentials.
- Read wallet addresses, transaction signatures, hashes, QR payloads, or internal technical references aloud.
- Use token trading, lending, yield, prediction, or investment language.

#### Recommended versioning layout

```text
packages/agora/prompts/
├── README.md
├── call-to-cash-vi-v1.md
├── call-to-cash-vi-v2.md
└── evaluation-cases.json
```

The prompt README should record:

- prompt version;
- test date;
- linked Agora draft/published pipeline label, without secrets;
- tested scenarios;
- current limitations;
- rollback version.

---

## 4. Transcript visibility: required UI contract

### The answer to “Does the script/transcript appear on screen?”

For the live demo to count as complete, the answer must be **yes** for both sides of the conversation:

```text
Customer speaks
  → customer transcript appears in UI
Agent responds by audio
  → agent transcript appears in UI
Final turn reaches API
  → booking/risk state updates through SSE
```

A moving waveform, timer, pre-recorded line, or scripted animation is **not sufficient evidence** of live voice.

### UI behavior requirements

| Transcript type | UI handling | Business authority |
|---|---|---|
| Local interim speech | Show as temporary/interim text; may change while STT is settling | None |
| Final user turn | Mark as final; send/admit through API provider path; persist once | May become input to deterministic extractor/domain |
| Agent turn | Show text associated with agent audio | No direct business authority |
| Replay line | Clearly label session as `Replay Demo`; never present it as live transcription | Demo-only input path |

### Recommended visual cues

- **Live mode badge:** `Agora Live` with a green connected indicator.
- **Replay mode badge:** `Replay Demo` with neutral/amber styling.
- **Interim message style:** lower-emphasis text with `Đang nghe…` or a subtle live waveform.
- **Final message style:** normal transcript bubble plus final timestamp/state.
- **Recovery message:** `Đang khôi phục trạng thái mới nhất…` while SSE or REST snapshot catches up.

### Fast manual check

A live voice transcript check passes only when this exact sequence is observed:

```text
[ ] Press microphone
[ ] Browser asks for microphone permission
[ ] UI says Agora Live
[ ] User speaks a new sentence not present in demo fixtures
[ ] User transcript appears on screen
[ ] Agent audio replies
[ ] Agent transcript appears on screen
[ ] Final user turn is still visible after page refresh
[ ] Risk / booking update arrives after final turn
```

If the UI only plays a known script, advances by timeout, or always displays fixture text regardless of what the user said, it is still replay/fallback—not a verified live voice flow.

---

## 5. Test strategy

The goal is not to pretend that one automated suite can prove live microphone, Agora, Phantom, and Devnet behavior. Use layered verification.

```text
Unit tests
  → deterministic business safety
Integration/API tests
  → persistence, events, idempotency, payment state
Browser tests
  → UI recovery and no duplicate client actions
Manual provider smoke tests
  → real microphone, Agora, Phantom, and Devnet proof
```

### 5.1 Unit tests

Run against isolated code and mocks. Required coverage:

| Area | Must prove |
|---|---|
| Provider mode resolution | Agora/replay modes are explicit; invalid configuration fails safely |
| Transcript normalization | final versus interim classification is correct |
| Provider event admission | duplicate, stale, wrong-call, wrong-channel, invalid-signature events are rejected/ignored safely |
| Domain recalculation | risk/gate updates only through domain rules |
| Voice error mapping | technical errors map to safe customer-facing state and allowed actions |
| Prompt safety checks | prohibited claims/secret requests are detectable in scripted evaluation cases |
| UI state reducer/store | retry/replay/end states do not mislabel the active mode |

Suggested commands, subject to workspace scripts:

```powershell
corepack pnpm --filter @call-to-cash/agora test
corepack pnpm --filter @call-to-cash/domain test
corepack pnpm --filter @call-to-cash/web test
```

### 5.2 Database and API integration tests

Use a dedicated test database only. Never point destructive tests at the developer database.

Required coverage:

| Scenario | Expected result |
|---|---|
| Final transcript append | persisted once; correct domain recomputation |
| Duplicate provider turn | no duplicate transcript/business event |
| Stale/wrong session provider event | rejected or ignored; no mutation |
| SSE reconnect with Last-Event-ID | missing durable events are replayed where possible |
| SSE gap/restart | REST/snapshot recovery reaches latest server state |
| Confirm agreement retry | idempotent/no duplicate transition |
| Payment verification retry | idempotent; no duplicate proof/receipt |
| Payment pending | receipt is not created |
| Payment mismatch | authoritative failure/manual-review state only |
| Refresh recovery read | booking/payment/receipt state remains retrievable |

Suggested commands:

```powershell
$env:TEST_DATABASE_URL = "postgresql://call_to_cash:call_to_cash@localhost:55432/call_to_cash_test?schema=public"
corepack pnpm --filter @call-to-cash/db test
corepack pnpm --filter @call-to-cash/api test
```

### 5.3 Browser / UI tests

Use the repository’s existing browser-testing tool. Do not add another framework merely for this checklist.

Mock Agora/Phantom transport at the browser boundary when needed; live provider validation belongs to manual smoke testing.

Required coverage:

| Browser scenario | Expected result |
|---|---|
| Agora mode startup | UI identifies `Agora Live`; no replay label |
| Live voice startup failure | retry/replay/end choices are shown explicitly |
| Replay fallback selection | UI changes label to `Replay Demo` and does not claim live session |
| Microphone denied | safe explanatory message, retry/fallback action |
| SSE disconnect/reconnect | recovery state shown; latest server state rendered |
| Browser refresh during call | call/booking state rehydrates from API |
| Browser refresh during payment pending | payment drawer/status rehydrates; no duplicate payment intent required |
| Browser refresh after receipt | Trust Receipt rehydrates from server |
| Double action | duplicate confirmation/verify button actions remain idempotent |
| Secret exposure check | no server secret appears in built client config or UI |

### 5.4 Manual live Agora smoke test

This is mandatory before claiming the demo is live.

#### Preconditions

```text
[ ] PostgreSQL running
[ ] API /health and /ready pass
[ ] API uses VOICE_PROVIDER=agora
[ ] Web uses VITE_VOICE_PROVIDER=agora
[ ] browser shows Agora Live, not Replay Demo
[ ] valid Agora configuration is present server-side
[ ] microphone device is available
```

#### Test steps

| Step | Action | Pass condition | Evidence |
|---:|---|---|---|
| 1 | Start API and web | both start without provider/export failure | terminal output |
| 2 | Open a fresh browser session | page renders active provider label | screenshot |
| 3 | Press microphone | browser permission prompt appears | screenshot/video |
| 4 | Allow microphone | UI reaches connecting/connected state | short video |
| 5 | Speak a novel booking sentence | user transcript appears; not a fixture line | short video |
| 6 | Wait for agent reply | agent audio is audible | short video/audio capture |
| 7 | Observe transcript | agent transcript appears on UI | screenshot |
| 8 | Complete a fact | risk/booking/gate changes through server state | screenshot with updated state |
| 9 | Refresh page | current booking/transcript/risk recovers | before/after screenshot |
| 10 | End session | local media/SSE cleanup occurs; durable history remains | terminal/UI observation |

#### Minimum repeatability standard

Perform the full live smoke flow at least **three times** on a clean browser session. Record:

```text
Run number
Date/time
Provider mode
Mic permission outcome
Agent audio outcome
User transcript visible
Agent transcript visible
SSE/risk update visible
Refresh recovery result
Failure notes
```

A single successful run is useful but not enough to call the flow reliable.

### 5.5 Manual Solana Devnet smoke test

This is separate from live voice validation.

| Step | Action | Pass condition |
|---:|---|---|
| 1 | Complete booking facts and agreement | payment gate becomes server-authoritatively open |
| 2 | Open payment request | correct Devnet request/QR/link is shown |
| 3 | Sign with Phantom on Devnet | wallet produces a Devnet transaction |
| 4 | Return to app / poll | server discovers and verifies recipient, amount, reference, status |
| 5 | Observe result | proof and exactly one Trust Receipt are created |
| 6 | Refresh | verified payment and receipt remain visible |
| 7 | Retry verify | no duplicate receipt/proof |

Never call Devnet settlement commercial payment. Customer-facing language should say **demo payment verification** where appropriate.

---

## 6. Definition of Done

The demo reaches `Demo-ready with live voice` only when all statements below are true.

### Runtime and build

```text
[ ] Internal workspace packages are rebuilt from current source.
[ ] API starts without stale export errors.
[ ] /health passes.
[ ] /ready passes.
[ ] API and web provider modes are aligned.
[ ] Browser receives no server credential.
```

### Live voice

```text
[ ] Browser requests microphone permission.
[ ] Browser joins live Agora mode.
[ ] Agent audio is audible.
[ ] Customer transcript appears on UI.
[ ] Agent transcript appears on UI.
[ ] Final transcript reaches server-authoritative processing.
[ ] Booking/risk/gate update appears through SSE/recovery path.
[ ] UI honestly identifies Agora Live versus Replay Demo.
```

### Resilience

```text
[ ] No silent fallback to replay.
[ ] Microphone, Agora, SSE, and payment errors have clear Vietnamese UX.
[ ] Refresh recovers durable booking/payment/receipt state.
[ ] Duplicate retries do not duplicate business effects.
[ ] Live session cleanup handles end, disconnect, and expiry safely.
```

### Evidence and quality

```text
[ ] At least three successful live Agora smoke runs are recorded.
[ ] At least one manual Solana Devnet verification run is recorded.
[ ] Format, lint, typecheck, tests, and build are green or documented with an honest blocker.
[ ] Judge evidence captures voice, transcript, risk update, payment verification, Trust Receipt, and refresh recovery.
```

---

## 7. What is explicitly not the next priority

Do not start these items before the Definition of Done above is met:

- LLM extraction from transcript;
- replacing deterministic booking extraction;
- FastAPI or a second backend service;
- Redis, MinIO/S3, or raw audio retention by default;
- mainnet payment;
- token trading, lending, yield, prediction, or speculative crypto UX;
- broad rewrite of the completed backend modular architecture.

LLM extraction is not the same as speech-to-text. The correct pipeline remains:

```text
Voice
  → Agora speech/transcript facts
  → transcript shown in UI
  → deterministic extraction today
  → optional strict-schema LLM extraction later
  → domain validation and decisions
```

Even in a future LLM phase, the LLM may extract facts but must not decide availability, risk, payment eligibility, receipt issuance, or business state.

---

## 8. Recommended next commands

Run these only after reviewing uncommitted work. Never reset/revert unrelated worktree changes automatically.

```powershell
# 1. Inspect worktree safely
git status --short

# 2. Install according to lockfile
corepack pnpm install --frozen-lockfile

# 3. Build all workspace packages in dependency order
corepack pnpm build

# 4. Start API with root environment path where required
$env:DOTENV_CONFIG_PATH = (Resolve-Path .env).Path
corepack pnpm --filter @call-to-cash/api dev

# 5. In another terminal, verify readiness (adjust port if API logs a different one)
Invoke-RestMethod http://localhost:3001/health
Invoke-RestMethod http://localhost:3001/ready

# 6. Start web after API is healthy
corepack pnpm --filter @call-to-cash/web dev
```

Do not treat `pnpm` ignored-build warnings as permission to approve every native package blindly. Approve a build script only when its exact dependency and runtime need have been reviewed.

---

## 9. Evidence pack checklist for judges

Capture only redacted/safe evidence.

```text
[ ] Browser shows explicit Agora Live status
[ ] Microphone permission + connected state
[ ] Live user transcript visible
[ ] Live agent transcript visible
[ ] Risk / booking transition after final transcript
[ ] Agreement confirmation
[ ] Solana Devnet payment request
[ ] Server-verified payment result
[ ] Trust Receipt
[ ] Browser refresh recovery
[ ] Optional failure state: retry/replay/end choices
```

Never show:

```text
[ ] seed phrase / private key
[ ] server secret or App Certificate
[ ] raw full phone number
[ ] raw full transcript containing personal data
[ ] full wallet address where not needed
[ ] raw provider webhook signature or internal hash
```

---

## 10. Final execution order

```text
Build and align runtime artifacts
  → start API successfully
  → verify health/readiness
  → run Agora Live browser path
  → prove customer + agent transcript UI
  → prove final transcript updates risk/booking through SSE
  → prove payment/receipt and refresh recovery
  → harden recovery and fallback UX
  → collect judge evidence
  → only then tune voice-agent system prompt
  → only after that consider LLM extraction
```
