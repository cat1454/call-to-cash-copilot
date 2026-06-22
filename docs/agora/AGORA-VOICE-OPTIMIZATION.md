# Agora Voice Optimization & Demo Readiness

> **Status:** Active execution plan and verification standard
> **Scope:** Call-to-Cash Risk Copilot — Phase 9 live Agora voice, transcript visibility, transcript display-quality hardening, recovery UX, and Phase 9.2 voice-agent optimization
> **Non-goals:** This document does not introduce LLM extraction, new payment rules, a new backend architecture, or new business authority for the voice agent.

---

## 1. Purpose and current position

Call-to-Cash is valuable only when its voice-to-booking flow is real, understandable, repeatable, and server-authoritative:

```text
Customer microphone
  → Agora RTC / Conversation AI Engine
  → agent audio response
  → customer + agent transcript visible in the browser
  → admitted final customer transcript reaches API
  → deterministic booking extraction and domain rules
  → durable booking / risk / payment-gate state
  → SSE and REST recovery in the web UI
  → agreement confirmation
  → Solana Devnet payment verification
  → Trust Receipt
  → browser refresh recovers authoritative state
```

### Current position

```text
Phase 9 core scope: COMPLETE by user-approved closure.
Current P0: transcript display-quality hardening.
Phase 9.2: GO for static prompt draft work; V1 is not yet activated/fully evaluated.
Phase 10: optional LLM extraction remains NOT STARTED / P3.
```

Live browser evidence has demonstrated microphone use, agent audio, and visible customer/agent transcript. The current issue is transcript quality: spacing, punctuation, duplicated fragments, or chunk-boundary artifacts can make correct spoken content look unreadable in the UI.

That issue must be solved as a deterministic Phase 9 transcript pipeline and rendering task. It must not be solved by jumping to LLM extraction.

---

## 2. Product truth and authority boundaries

| Layer | Owns | Must not own |
|---|---|---|
| **Browser / web app** | microphone permission, direct RTC join, rendering, local reconnect UX | booking confirmation, risk decision, payment verification, receipt issuance |
| **Agora** | real-time audio, agent interaction, transcript/provider facts | availability, inventory, risk, payment, proof, receipt, refund decisions |
| **API** | session orchestration, token issuance, transcript admission, REST endpoints, SSE stream | raw-media relay by default or business decisions delegated to provider |
| **Domain** | deterministic booking, inventory, risk, agreement, payment gate, state transitions | voice phrasing or AI reasoning |
| **PostgreSQL** | durable truth, event/audit history, idempotency, recovery state | temporary browser-only UI state |
| **Solana Devnet** | payment evidence and transaction verification | customer PII, full transcript, domain policy |
| **Voice agent prompt** | concise, natural conversational phrasing | booking confirmation, payment verification, availability, receipt authority |

### Non-negotiable rules

- Browser code must never create authoritative payment success.
- Final customer transcript must reuse the same server-authoritative transcript/domain path as replay mode.
- Interim transcript can be visible for UX, but is not durable business input.
- Agent display text has no direct business authority.
- The agent must not claim availability, booking confirmation, payment verification, payment success, or receipt issuance unless the server-authoritative state explicitly supports it.
- No full transcript, raw phone number, seed phrase, private key, wallet secret, or raw agreement payload is written on-chain.
- Phase 10 LLM extraction must not be used to “fix” transcript spacing or punctuation.

---

## 3. Runtime baseline and reproducible build integrity

Every internal workspace package exports runtime code from `dist`. Source updates alone are insufficient when an app imports a workspace package through `package.json` exports.

### Required setup path

Use the pnpm version pinned by the root `packageManager` field. Do not mix arbitrary global, local, or Corepack versions.

```powershell
git status --short
corepack pnpm --version
corepack pnpm install --frozen-lockfile
corepack pnpm build
node --test tests/packageRuntimeExports.test.js
```

### When a named export appears missing

If an application reports:

```text
The requested module '@call-to-cash/<package>'
does not provide an export named '<symbol>'
```

follow this order:

```text
1. Inspect the application import.
2. Inspect packages/<package>/src/index.ts.
3. Inspect packages/<package>/package.json exports/main/types.
4. Inspect packages/<package>/dist/index.js.
5. Build the owning package or the root dependency graph.
6. Re-run the runtime export regression test.
7. Restart the application.
```

Do not rewrite a valid import merely because `dist` is stale.

### Package-manager rules

- Package build scripts must not run `pnpm install` internally.
- Use the repository lockfile and canonical install/build commands.
- Do not add undocumented root dependencies merely to mask broken transitive links.
- Any local dependency/linker repair must be reproducible from the declared package-manager setup.
- The repository's canonical declared package-manager baseline is `pnpm@10.34.4`.
- That baseline matches the root `devDependencies.pnpm` pin and `tests/workspaceStructure.test.js`.
- A temporary, unreviewed `pnpm@11.1.1` `packageManager` value was reverted; this repository should not be described as having completed a pnpm 11 migration.

---

## 4. Provider-mode matrix

| API `VOICE_PROVIDER` | Web `VITE_VOICE_PROVIDER` | Meaning |
|---|---|---|
| `agora` | `agora` | **Agora Live**; eligible for live browser smoke |
| `replay` | `replay` | **Replay Demo — không phải thoại trực tiếp** |
| `agora` | `replay` | Misaligned; preflight must fail unless replay is intentionally selected after a visible live failure |
| `replay` | `agora` | Invalid; preflight must fail |

### Environment behavior

- Server-only credentials never use the `VITE_` prefix.
- Browser configuration can contain only browser-safe values.
- Vite reads `VITE_*` variables at startup. Restart the web dev server after changing `.env`, `.env.local`, or equivalent config.
- Where both exist, `apps/web/.env.local` should be treated according to the repository’s configured precedence and documented in preflight behavior.
- Safe preflight output reports presence/status only, never secret values.

---

## 5. Live/replay state contract

The UI must distinguish connection phases accurately.

```text
IDLE
MIC_PERMISSION_PENDING
RTC_CONNECTING
RTC_CONNECTED
AGENT_STARTING
AGENT_ACTIVE
TRANSCRIPT_DELAYED
RECONNECTING
AGENT_UNAVAILABLE
REPLAY_ACTIVE
ENDED
```

Important distinctions:

```text
RTC_CONNECTED ≠ AGENT_ACTIVE
AGENT_ACTIVE ≠ final customer transcript persisted
final customer transcript persisted ≠ booking/payment state confirmed
```

### Required customer-facing wording

| Technical state | Customer-facing wording | Primary action | Safety promise |
|---|---|---|---|
| Microphone permission pending | `Đang xin quyền dùng micro…` | Allow microphone | No booking state changes |
| Microphone denied | `Bạn chưa cho phép dùng micro. Bạn có thể bật lại quyền micro hoặc dùng chế độ demo replay.` | Retry / Replay | Existing booking remains safe |
| RTC joining | `Đang kết nối cuộc trò chuyện…` | Wait / Cancel | Existing booking remains safe |
| Agent starting | `Đang khởi động trợ lý giọng nói…` | Wait / Cancel | No booking/payment decision is fabricated |
| Agent active | `Đã kết nối. Bạn có thể bắt đầu nói.` | Speak | Live session active |
| Transcript delayed | `Đang chờ phụ đề hoàn tất. Thông tin vừa nói chỉ được lưu khi dòng chữ hoàn chỉnh.` | Continue / Wait | User is not asked to repeat without reason |
| Reconnecting | `Đang khôi phục kết nối. Thông tin đặt chỗ của bạn vẫn được giữ.` | Wait / End session | Durable state remains safe |
| Agent unavailable | `Chưa thể kết nối trợ lý giọng nói ngay lúc này.` | Retry / Replay / End | No false live claim |
| Replay active | `Replay Demo — không phải thoại trực tiếp` | Continue demo / End | Explicitly non-live |
| Payment pending | `Hệ thống đang kiểm tra giao dịch demo. Bạn xem trạng thái trên màn hình giúp mình nhé.` | Retry status check | No receipt issued yet |

When live Agora fails, the UI must present:

```text
1. Retry live voice
2. Continue in Replay Demo
3. End session
```

It must never silently present replay as live Agora.

---

## 6. Current P0 — Transcript display-quality hardening

### 6.1 Scope

This is the current top-priority Phase 9 quality task.

**Current status:** IN PROGRESS — deterministic normalization, assembly regression tests, and scoped transcript typography hardening have been implemented. A fresh live-browser Agora validation run is still required before this item can be marked PASS.

Observed failure patterns may include:

```text
- missing spaces between fragments;
- duplicated text after multiple interim frames;
- punctuation appearing twice or at the wrong boundary;
- stale interim text not being replaced;
- final text appended on top of a previous snapshot;
- text that is correct in data but looks broken because of CSS wrapping.
```

This work does not change:

```text
- booking extraction authority;
- domain scoring or payment gate;
- Solana verification;
- prompt authority;
- Phase 10 LLM extraction status.
```

### 6.2 Diagnostic rule: locate the faulty layer first

Use a controlled, non-PII sentence:

```text
“Dạ, em muốn đặt ba chỗ từ Đà Nẵng ra Hà Nội, chuyến bảy giờ tối.”
```

Trace the exact same turn through three layers:

| Layer | Required inspection |
|---|---|
| Raw provider frame | Text, turn identifier, sequence, speaker, snapshot/delta/final semantics |
| API normalized payload | Text after transcript adapter/normalizer and admission handling |
| Browser DOM `textContent` | Text rendered in the transcript bubble before visual/CSS interpretation |

Interpretation:

| Raw provider frame | API normalized text | DOM textContent | Likely cause |
|---|---|---|---|
| Correct | Correct | Broken | Browser renderer or CSS |
| Correct | Broken | Broken | Adapter/normalizer or fragment assembler |
| Broken | Broken | Broken | Provider STT segmentation, language setting, or source audio |
| Broken | Correct | Correct | Normalizer correctly improved deterministic presentation |

Use controlled/local/redacted diagnostics only. Do not dump unrestricted live transcripts or secrets.

### 6.3 Diagnostic result — 2026-06-22

Controlled local utterance:

```text
Dạ, em muốn đặt ba chỗ từ Đà Nẵng ra Hà Nội, chuyến bảy giờ tối.
```

| Layer | Observed result |
|---|---|
| Raw provider frame | The existing RTM relay accepts final Agora `user.transcription` and terminal/debounced `assistant.transcription` frames. Documented frames can arrive with provider whitespace/punctuation artifacts. The current live durable path does not persist interim frames. |
| API-normalized payload | `packages/agora` now applies shared deterministic display normalization. Final/interim status is preserved; non-final frames remain rejected by durable admission. |
| Browser DOM textContent | Web SSE and REST recovery projections mask PII before display normalization and then render the same display projection. Scoped bubble typography uses `white-space: pre-wrap`, break-word wrapping, `word-break: normal`, and normal tracking. |
| Root cause conclusion | The hardening target was a combination of adapter/display normalization gaps and scoped typography gaps, not a booking/risk/payment/domain defect and not an LLM problem. |

Implemented regression coverage:

- `packages/shared/src/transcript-display.test.ts` covers snapshot replacement, delta joining, duplicate final handling, stale sequence handling, speaker/turn separation, punctuation and whitespace cleanup, and time/money/phone-like preservation.
- `packages/agora/src/agora.test.ts` covers provider-event normalization while preserving final/interim authority.
- `apps/rtm-relay/src/rtm-transcript-frame.test.ts` covers provider-frame normalization before forwarding.
- `apps/api/src/modules/call-session/commands/append-transcript-turn.test.ts` covers non-final provider frames not reaching durable transcript admission.
- `apps/web/src/features/simulation/hooks/serverSimulationTranscriptDisplay.test.js` covers PII masking before normalization, email/URL/time/money safety, SSE display normalization, and REST recovery display normalization.
- `apps/web/src/features/voice/transcriptTypography.test.js` guards scoped transcript bubble typography.

No LLM extraction, semantic transcript rewriting, Phase 9.2 prompt activation, server-to-agent directives, risk threshold change, payment change, proof change, or receipt behavior change was introduced.

Additional implementation facts:

- The shared deterministic transcript display helper is the source for display normalization.
- Snapshot replacement, delta boundary joining, duplicate-final suppression, stale-frame protection, and speaker/turn isolation are implemented at the helper/test level.
- The normalizer performs whitespace cleanup and safe punctuation-boundary cleanup only.
- The normalizer does not perform automatic capitalization or automatic terminal-punctuation insertion.
- The normalizer no longer blindly inserts whitespace after `.` because that can corrupt email, URL, decimal, and abbreviation-like text.
- `TranscriptTurnCreated` SSE projection and `TRANSCRIPT_SYNCED` REST recovery projection share the same browser transcript display projection.
- The source-line guardrail refactor reduced `serverEventProjection.js` below 300 lines and moved transcript display tests into a focused test file.

Expected safe handling examples, pending complete verification:

```text
person@example.com must not become person@example. com
https://example.com/path must not be split
19:00 must remain readable
20h00 must not become 20h 00
300.000 đ must remain readable
```

Display-formatting boundary:

```text
Transcript display formatting preserves readable provider/ASR text.
It does not interpret or canonicalize a user's spoken time.
```

Booking extraction is separate final-turn/domain behavior. For supported input forms, booking extraction may normalize time to catalogue-compatible `HH:mm` values, for example `20h00` to `20:00` or `7h00` to `07:00`. Unsupported, ambiguous, or unavailable times must not be invented.

### 6.4 Current verification evidence

| Area | Status | Evidence / note |
|---|---|---|
| `git diff --check` | **PASS** | Passed in the latest verification report. |
| Frozen install under temporary pnpm 11.1.1 | **PASS, historical/local** | Completed before the package-manager baseline correction. This is not a pnpm 11 migration claim. |
| Runtime package export regression | **PASS** | 7/7 package checks passed. |
| Prisma schema validation | **PASS** | Schema validation passed. |
| Typecheck | **PASS** | Turbo typecheck passed with 17/17 tasks. |
| API suite before display-expectation reconciliation | **PARTIAL PASS** | Reached 25/26 passing before the legacy display expectation was identified. |
| API suite after expectation reconciliation | **PASS, focused** | Confirmed the display-preserving contract; DB-backed cases may still depend on local test DB configuration. |
| API authority invariants | **PASS in focused coverage** | Interim provider frames do not enter durable transcript admission; only customer turns propose booking facts; final agent turns do not mutate customer booking; Solana payment verification coverage remained passing. |
| Source-line guardrail | **PASS** | Passed after extraction refactor. |

Not yet verified to completion after the latest PII/projection refactor:

- web test suite;
- Prettier/format gate;
- lint;
- root test suite after package-manager baseline correction;
- full build;
- API and web runtime smoke after a clean dependency restore;
- fresh real-browser Agora Live validation after transcript formatting changes.

### 6.5 Active local verification blocker

After restoring the repository package-manager baseline to `pnpm@10.34.4`, the current local dependency graph became incomplete or inconsistent during verification. The focused web test could not resolve workspace/runtime dependencies, including `@call-to-cash/shared` and `react`.

This is currently a local dependency-resolution/toolchain blocker, not evidence that the transcript source fix is incorrect. Do not claim that all `node_modules` problems are solved.

### 6.6 P0 PASS exit gate

Transcript display-quality hardening may move from `IN PROGRESS` to `PASS` only when all conditions below are met:

```text
[ ] A clean dependency restore using the declared pnpm@10.34.4 baseline passes.
[ ] Shared, Agora, RTM relay, API, and web focused test suites pass.
[ ] format:check, db:validate, lint, typecheck, root test, and build pass.
[ ] API /health, /ready, and demo:preflight pass in the intended local demo configuration.
[ ] A fresh real-browser Agora Live test confirms:
    - customer transcript is readable;
    - agent transcript is readable;
    - no accidental merged words;
    - no repeated snapshot text;
    - time, money, URL, and PII-like formatting remains safe;
    - booking/risk updates after the final customer turn;
    - Ctrl+R recovery restores authoritative transcript and booking state;
    - UI truthfully indicates Agora Live rather than Replay Demo.
[ ] No LLM semantic rewrite was introduced.
```

Standard browser sentence for live validation:

```text
Dạ, em muốn đặt 3 chỗ từ Đà Nẵng ra Hà Nội lúc 19:00 ngày 25 tháng 6, điểm đón ở bến xe trung tâm.
```

Additional format checks:

```text
- "em đi lúc 7h00"
- "em đi lúc 20h00"
- an email/phone masking scenario without using real personal data
```

---

## 7. Transcript frame contract

### 7.1 Required frame model

The adapter and web state must preserve frame semantics rather than treating all incoming text as append-only strings.

```ts
type TranscriptFrame = {
  providerTurnId: string;
  speaker: "CUSTOMER" | "AGENT";
  sequence: number;
  delivery: "SNAPSHOT" | "DELTA";
  final: boolean;
  rawText: string;
};
```

Implementation names may differ, but the behavior must be equivalent.

### 7.2 Required behavior

```text
Interim snapshot
→ replace the current live bubble for the same provider turn.

Interim delta
→ append only the new fragment using a boundary-aware join.

Final frame
→ normalize and freeze exactly one final bubble.
→ final CUSTOMER frame may enter canonical transcript ingress.
→ final AGENT frame remains conversational display unless a separately approved
  canonical AGENT contract exists.
→ do not append further text to that finalized bubble.

Duplicate frame
→ ignore or deduplicate safely.

Older/out-of-order frame
→ ignore when its sequence is behind the current turn state.
```

### 7.3 Anti-patterns

Never implement live transcript assembly like this:

```ts
displayText += incomingFrame.text;
```

That breaks snapshot-based providers.

Example provider behavior:

```text
snapshot 1: “Dạ, em muốn”
snapshot 2: “Dạ, em muốn đặt ba chỗ”
final:      “Dạ, em muốn đặt ba chỗ.”
```

Blind appending produces duplicated/damaged text:

```text
Dạ, em muốnDạ, em muốn đặt ba chỗDạ, em muốn đặt ba chỗ.
```

---

## 8. Text representation and deterministic normalization

Do not use one transcript string for every purpose.

```ts
type TranscriptTurn = {
  rawText: string;       // provider content retained under applicable privacy/debug policy
  displayText: string;   // deterministic UI-safe formatting
  final: boolean;
  speaker: "CUSTOMER" | "AGENT";
  providerTurnId: string;
  sequence: number;
};
```

Business extraction receives only the appropriate admitted final customer text through the canonical API/domain path.

### Allowed deterministic normalization

```text
- normalize Unicode consistently;
- trim leading and trailing whitespace;
- collapse repeated whitespace;
- remove spaces before punctuation: , . ! ? : ;
- preserve a required boundary between adjacent word/number fragments;
- suppress exact duplicate snapshots;
- ignore stale sequence frames;
- finalize a bubble once.
- preserve email, URL, time, money, and PII-like masked formatting.
```

### Disallowed “fixes”

```text
- semantic rewriting of a customer statement;
- automatic capitalization;
- automatic terminal-punctuation insertion;
- blind whitespace insertion after `.`;
- guessing Vietnamese word boundaries with aggressive regex;
- turning spoken text into booking facts inside the display normalizer;
- using an LLM to beautify text in Phase 9;
- modifying raw audit/provider content without a defined policy.
```

Examples:

```text
Allowed:
“Dạ,   em muốn   đặt”
→ “Dạ, em muốn đặt”

Allowed:
“Dạ, em muốn”
+ “, ba chỗ.”
→ “Dạ, em muốn, ba chỗ.”

Not allowed as a formatting rule:
“emmuondi”
→ “em muốn đi”
```

The last example may indicate provider segmentation or a future semantic-correction problem. It is not safe to solve with generic display regex.

---

## 9. Browser typography and CSS checks

If raw/API/DOM text is correct but the screen still looks broken, inspect transcript CSS before changing backend behavior.

Recommended baseline:

```css
.transcriptText {
  white-space: pre-wrap;
  overflow-wrap: break-word;
  word-break: normal;
  line-height: 1.5;
  letter-spacing: normal;
}
```

Avoid or justify carefully:

```css
word-break: break-all;
hyphens: auto;
excessive letter-spacing;
fixed-height clipping;
overflow hidden that removes trailing punctuation;
```

Check both desktop and mobile widths. Vietnamese text should wrap at natural opportunities; it must not visually split every glyph or compress words into unreadable clusters.

---

## 10. Test plan for transcript quality

### 10.1 Unit tests

Required cases:

```text
1. Delta boundary
   “Dạ, em muốn” + “đặt ba chỗ.”
   → “Dạ, em muốn đặt ba chỗ.”

2. Snapshot replacement
   “Dạ, em muốn”
   → “Dạ, em muốn đặt ba chỗ”
   → no duplication.

3. Punctuation boundary
   “Dạ, em muốn”
   + “, ba chỗ.”
   → “Dạ, em muốn, ba chỗ.”

4. Repeated whitespace
   “Dạ,   em muốn   đặt”
   → “Dạ, em muốn đặt”

5. Duplicate final frame
   → one final bubble and one authoritative persistence attempt.

6. Out-of-order sequence
   → older frame has no visible or durable effect.

7. Interim frame
   → no booking fact and no durable business mutation.

8. Final customer frame
   → canonical transcript command is invoked once.

9. Format preservation
   → valid values such as `19:00`, `300.000 đ`, and masked phone formatting
     are not damaged.
```

### 10.2 Integration tests

Required flow:

```text
provider frame
  → adapter
  → normalization / dedupe / admission
  → canonical persistence where applicable
  → durable event / SSE
  → web projection
```

Test wrong-call, stale-session, duplicate, invalid-signature/HMAC, and outdated-frame cases according to existing provider-event security contracts.

### 10.3 Browser tests

Required browser behavior:

```text
- interim bubble changes in place;
- final bubble becomes stable;
- no silent conversion from live to replay;
- refresh recovers final transcript and authoritative booking summary;
- readable transcript layout on target screen sizes;
- no server secret appears in browser configuration or UI.
```

### 10.4 Manual live proof after fix

Record at least one fresh readable live run before moving Phase 9.2 forward:

```text
[ ] UI visibly says Agora Live
[ ] User speaks a sentence not contained in fixtures
[ ] Customer transcript is readable and correctly spaced
[ ] Agent audio is audible
[ ] Agent transcript is readable
[ ] Final customer turn updates authoritative booking/risk state
[ ] Refresh recovers expected state
[ ] Retry / Replay Demo / End session remains correct if failure is induced
```

---

## 11. P1 — End-to-end live-flow proof

The live flow is considered demonstrated when the following sequence is observed:

```text
1. User presses microphone button.
2. Browser requests microphone permission.
3. Browser requests safe live-session metadata from API.
4. Browser joins Agora RTC directly.
5. User voice reaches Agora / agent.
6. Agent produces audible response.
7. Customer and agent transcript appear in the active conversation view.
8. Final customer turn reaches API.
9. API validates/adopts final provider fact under existing session and dedupe rules.
10. Domain recalculates booking facts, risk, and payment gate.
11. SSE or snapshot recovery updates the web UI.
12. Browser refresh recovers authoritative state.
```

A waveform, a timer, a fixture line, or a scripted animation alone is not evidence of live voice.

---

## 12. P2 — Failure and recovery UX

Every relevant screen must answer:

1. What is happening?
2. What should the user do now?
3. Will booking or payment state be lost?

Required resilience behavior:

```text
- microphone denial provides retry/replay guidance;
- RTC/agent failure provides Retry / Replay Demo / End session;
- SSE reconnect announces recovery and restores state from server;
- payment verification pending never creates a receipt;
- refresh does not duplicate confirmation, payment verification, proof, or receipt;
- session end cleans up local tracks/timers/subscriptions without deleting durable history.
```

Use plain Vietnamese customer copy. Do not expose technical terms such as `HMAC`, `RPC`, `SSE cursor`, or provider error code in customer-facing UI.

---

## 13. Phase 9.2 — Conversation Quality Optimization

### 13.1 Scope

Phase 9.2 begins after transcript presentation is stable enough for controlled conversation evaluation.

It creates and evaluates a versioned static system prompt for the Agora voice agent.

It does not:

```text
- introduce LLM extraction;
- replace deterministic extraction;
- change business thresholds, policy, or state machines;
- give agent prompt authority over booking/payment/receipt state;
- implement Phase 9.3 server-to-agent directives.
```

### 13.2 Prompt source of truth

Preferred repository structure:

```text
packages/agora/prompts/
├── README.md
├── call-to-cash-vi-v1.md
├── evaluation-cases.json
└── prompt-constraints.test.ts
```

The repository must document the real server-to-Agora mapping. Do not assume a Git file automatically updates a deployed Agora pipeline.

The prompt should remain server-side. Browser configuration must not contain the prompt, provider tokens, certificates, customer secrets, or private session metadata.

### 13.3 V1 behavior goals

The agent should:

- speak natural, concise Vietnamese;
- ask one meaningful question at a time;
- use one or two short sentences for normal turns;
- clarify ambiguous or conflicting information;
- handle silence and interruption naturally;
- avoid repeating facts already provided;
- direct payment and verification users to the screen;
- avoid reading technical/wallet information aloud.

The agent must not:

- claim seats are available;
- confirm a booking;
- claim payment is complete or verified;
- claim a Trust Receipt has been issued;
- promise refund eligibility;
- ask for a seed phrase, private key, password, OTP, or wallet secret;
- read wallet addresses, QR payloads, transaction signatures, hashes, or internal identifiers aloud;
- use trading, token promotion, yield, lending, speculation, or prediction language.

### 13.4 V1 evaluation gate

V1 remains **DRAFT** until the team records controlled live evaluation:

```text
3 happy-path runs
1 interruption scenario
1 silence scenario
1 payment-verifying scenario
```

Each evaluation should record:

```text
prompt version
scenario ID
user utterance/event
agent response
audible agent result
customer/agent transcript visibility
final customer persistence result
SSE result
authority-safety result
pass / fail / blocked
```

### 13.5 Phase 9.3 remains future work

Future principle:

```text
Domain/API decides WHAT the next business step is.
The voice agent decides HOW to say it naturally.
```

Possible future directive categories include asking for missing route/time/passengers/pickup, reading approved agreement summary, and explaining server-provided payment state. No directive implementation is included in this document’s current P0 work.

---

## 14. Phase 10 — Optional LLM extraction

Phase 10 remains deferred.

Future optional architecture:

```text
final customer transcript
  → strict-schema LLM extraction
  → deterministic validation
  → domain rules
```

The LLM may extract facts only. It must not determine:

```text
availability
inventory
risk
booking confirmation
payment gate
payment verification
proof
Trust Receipt
```

Do not use Phase 10 as a workaround for a display/frame/CSS problem.

---

## 15. Operational commands

Run only after reviewing uncommitted work.

```powershell
# Inspect current worktree
git status --short

# Install from declared lockfile
corepack pnpm install --frozen-lockfile

# Build workspace runtime artifacts
corepack pnpm build

# Validate runtime package exports
node --test tests/packageRuntimeExports.test.js

# Start API with the repository environment convention
$env:DOTENV_CONFIG_PATH = (Resolve-Path .env).Path
corepack pnpm --filter @call-to-cash/api dev

# In another terminal, verify readiness (adjust port if needed)
Invoke-RestMethod http://localhost:3001/health
Invoke-RestMethod http://localhost:3001/ready

# Start web after API readiness succeeds
corepack pnpm --filter @call-to-cash/web dev
```

Use the repository’s existing test commands and isolated test database setup. Do not treat skipped destructive DB/API tests as a full pass.

---

## 16. Definition of done

### Runtime and authority

```text
[ ] Workspace packages resolve current runtime exports.
[ ] API starts without stale-export failures.
[ ] /health and /ready pass with correct provider mode.
[ ] Browser receives no server secrets.
[ ] API and web provider modes are aligned.
[ ] Live and replay modes are visibly distinct.
```

### Transcript quality

```text
[ ] Raw-frame/API/DOM trace identifies the source of the formatting issue.
[ ] Snapshot/delta/final frame behavior is correct.
[ ] Deterministic normalization is covered by tests.
[ ] CSS does not visually corrupt Vietnamese text.
[ ] Fresh live transcript evidence is readable.
[ ] Final customer transcript still drives authoritative booking/risk updates.
```

### Resilience

```text
[ ] No silent replay fallback exists.
[ ] Microphone, agent, SSE, and payment errors have clear user-safe copy.
[ ] Refresh recovers authoritative booking/payment/receipt state.
[ ] Duplicate retries do not duplicate business effects.
[ ] Session cleanup is safe.
```

### Conversation quality

```text
[ ] V1 prompt artifacts are versioned and server-side.
[ ] Prompt safety constraints are tested.
[ ] V1 remains DRAFT until controlled live evaluations pass.
[ ] Phase 9.3 and Phase 10 remain out of scope.
```

---

## 17. Final execution order

```text
Preserve Phase 9 closure boundary
  → trace transcript raw frame → API text → DOM text
  → fix snapshot/delta/final assembly
  → apply deterministic display normalization
  → verify CSS and typography
  → add regression tests
  → record fresh readable live evidence
  → evaluate Phase 9.2 V1 static prompt
  → consider Phase 9.3 directives later
  → keep Phase 10 LLM extraction deferred as P3
```
