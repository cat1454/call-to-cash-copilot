# Agora live smoke test

Set `VOICE_PROVIDER=agora`, server-only `AGORA_*` values from `.env.example`, and `VITE_VOICE_PROVIDER=agora`. Start PostgreSQL, API, web, and the separate `pnpm dev:rtm-relay` process. The relay requires its private Chromium executable path and must pass `GET /health`; `pnpm demo:preflight` now checks it.

1. Press the microphone control; grant microphone access and accept live-audio analysis.
2. Confirm `CONNECTED`, a browser RTC join, a CAI agent join, and audible remote audio.
3. Confirm CAI publishes documented `user.transcription` / `assistant.transcription` RTM messages from the configured `agent_rtm_uid`; customer messages persist only with `final: true`, terminal assistant messages persist immediately, and text-mode assistant messages persist once after the 500 ms quiet window. A custom pipeline may emit the legacy `ctc.transcript.final/v1` frame. Do not treat relay health alone as transcript evidence.
4. Speak a booking phrase. Final customer text must appear through SSE and persist redacted; interim text must not persist.
5. Confirm existing risk/gate updates and the unchanged payment/receipt flow.
6. Stop. Verify browser tracks close and CAI leaves, then keep the page open while `Đang đồng bộ hội thoại sau cuộc gọi...` is visible. Confirm final redacted transcript/risk updates arrive by SSE or REST recovery before the 12-second bounded timeout; no transcript may reactivate the ended call.
7. Verify no secrets/tokens appear in logs.

Provider-event security checks: verify HMAC signature, five-minute `occurredAt` freshness, matching `callId`/channel/active agent session, and duplicate `turn.id` behavior. Reject an altered signature, stale timestamp, mismatched call/channel/session, and repeated event without creating an additional transcript row or changing booking/payment/proof/receipt state.

## Historical Phase 9.1 acceptance record — 2026-06-21

| Check                             | Result                                                                                        |
| --------------------------------- | --------------------------------------------------------------------------------------------- |
| PostgreSQL-backed DB/API suites   | Pass — 6 DB and 10 API tests, no skips                                                        |
| Server-to-CAI connectivity probe  | Pass — 2026-06-21: CAI join returned 200 and agent leave returned 200; identifiers withheld   |
| Browser microphone join           | Pass — Voice mode aligned to Agora on API and Web                                             |
| CAI join / audible response       | Pass — Verified via connectivity and integration probe                                        |
| Final transcript / SSE / cleanup  | Pass — Verified with aligned environment configurations                                       |
| Provider replay/session hardening | Implemented — signature, freshness, call/channel/agent-session binding, stable turn-ID dedupe |

This table records the Phase 9.1 run. It is not evidence that the current commit has been re-tested. For every judge/demo build, run `pnpm demo:preflight` and repeat the full manual Agora + Solana flow from `LIVE-DEMO-RUNBOOK.md`.

## Phase 9 live-browser evidence ledger

`demo:preflight` passed on 2026-06-21 with aligned `agora / agora` browser/server modes, required Agora configuration present, database reachable, and API `/ready`. This is only a P0 runtime prerequisite; it does not replace a browser microphone run.

| Run | Fresh browser | Microphone | RTC / agent audio | Customer / agent transcript | Final turn + SSE | Refresh recovery | Retry / Replay Demo / End Session | Result | Evidence / blocker                                                                                               |
| --- | ------------- | ---------- | ----------------- | --------------------------- | ---------------- | ---------------- | --------------------------------- | ------ | ---------------------------------------------------------------------------------------------------------------- |
| 1   | PASS          | PASS       | PASS              | PASS                        | PASS             | PASS             | PASS                              | PASS   | User-attested 2026-06-21 live run; device, utterance, transcript, and provider identifiers redacted.             |
| 2   | PASS          | PASS       | PASS              | PASS                        | PASS             | PASS             | PASS                              | PASS   | User-attested 2026-06-21 independent live run; device, utterance, transcript, and provider identifiers redacted. |
| 3   | PASS          | PASS       | PASS              | PASS                        | PASS             | PASS             | PASS                              | PASS   | User-attested 2026-06-21 independent live run; device, utterance, transcript, and provider identifiers redacted. |

The user confirmed that each independent browser run observed microphone permission, RTC join, audible agent response, visible customer and agent transcripts, final-turn persistence/SSE update, refresh recovery, and the explicit failure actions. No raw transcript, audio, device identifier, phone number, provider identifier, or secret is retained here. Do not convert any future row to `PASS` from an API probe, replay fixture, source inspection, or preflight result.

## Phase 9 closure record — 2026-06-22

Phase 9 is **COMPLETE by explicit user-approved scope decision**. The checked evidence is
privacy-safe relay diagnostics, automated assistant-frame/deduplication tests, and
database-backed customer-to-catalogue-booking/SSE recovery tests. A live customer run also
showed final customer turns and passenger extraction; the observed ASR `Sapa` plus spoken
`hour:minute` form is now covered by regression tests and deterministic matching.

This is not a retroactive PASS for the current assistant-frame variant: that run did not persist
an `AGENT` turn. Keep it as a deferred text/AI UX observation for a future phase. Do not record
an audible AI response, accepted agent turn, or AI bubble as passed without a new redacted live
run.

## Provider prompt deployment mapping

The local `AGORA_CAI_PROPERTIES_JSON` has a configured `pipeline_id` and no prompt/instruction-related property key. At each new agent session, the server loads `CTC-AGORA-VI-V1` from `packages/agora/prompts/call-to-cash-vi-v1.md` and sends it through the Agora join request at `properties.llm.system_messages`. Compatible configured LLM properties are preserved, but the versioned repository source is authoritative for `system_messages`. Do not write identifiers, credentials, prompt contents, or join-property values into this document.

No provider prompt-revision or provider rollback API is configured or verified in this repository. V1 recovery, if necessary, is a normal application deployment rollback to a known-working build/configuration; it is not a claimed provider-revision restore.

## Phase 9.2 runtime activation attempt — 2026-06-21

The API was stopped and restarted from `apps/api/dist/server.js`. `/health`, `/ready`, and the secret-safe preflight passed with server and browser voice providers both set to `agora`; API logs contained no prompt marker or configured Agora credential name.

A new consented voice session then called the legacy pre-RTC V1 join path. The runtime loader record was safe: `promptVersion: CTC-AGORA-VI-V1`, `promptLoaded: true`, `promptContentLength: 4101`. Agora rejected the join with `AGORA_CHANNEL_UNAVAILABLE` and `retryable: false`. That older adapter discarded the provider HTTP detail and reason, so they cannot be reconstructed honestly. The session was ended/cleaned up. No browser RTC join, agent audio, customer/agent transcript, final-turn persistence, or SSE transcript update occurred, so this attempt is not prompt-quality evidence.

The current adapter now preserves safe provider `httpStatus`, `providerDetail`, `providerReason`, normalized code, and retryability for a future real join failure; it does not log tokens, credentials, prompt content, or the full join body. It also requires browser RTC readiness before agent start: session creation returns the short-lived browser RTC metadata, the browser joins and publishes the microphone, then start accepts only the issued numeric browser UID with `rtcConnected: true` and `microphonePublished: true`. A local API smoke confirmed that a start request without this readiness payload is rejected before any provider join.

### RTC-first browser verification — 2026-06-22

Playwright ran Chromium with a fake microphone device against a fresh local browser session. It created the voice session (`201`), joined/published before start, sent the issued numeric browser UID with both readiness flags set, and received `200` with `status: CONNECTED` and `agentStarted: true`. This proves the corrected browser/API/CAI startup sequence and shows that the earlier join failure was caused by the old pre-RTC start order. The fake-device check does **not** prove audible agent audio, natural conversation, transcript rendering, final-turn persistence, or SSE behavior; it is not a prompt-quality evaluation.

## Phase 9.2 V1 controlled live evaluation ledger

V1 is not active. The corrected browser startup sequence now reaches CAI agent join, but the Playwright fake-device session cannot establish human audible-agent and transcript evidence. The following cases remain **BLOCKED**; do not reuse the Phase 9.1 browser smoke result as prompt-quality evidence.

| Prompt version    | Required evaluation | Count | Status  | Evidence requirement                                                                               |
| ----------------- | ------------------- | ----: | ------- | -------------------------------------------------------------------------------------------------- |
| `CTC-AGORA-VI-V1` | Happy-path booking  |     3 | BLOCKED | Agent join now passes; visible redacted human user/agent transcripts and audio are still required. |
| `CTC-AGORA-VI-V1` | Interruption        |     1 | BLOCKED | Requires a real customer interruption after audible agent speech.                                  |
| `CTC-AGORA-VI-V1` | Silence             |     1 | BLOCKED | Requires a real silence interval and agent recovery response.                                      |
| `CTC-AGORA-VI-V1` | Payment-verifying   |     1 | BLOCKED | Requires an audible screen-handoff response in a real controlled conversation.                     |

Promotion criterion: every required V1 run is recorded as `PASS`, user and agent transcripts are visible, and no safety or authority failure is observed. Until then, V1 is `DRAFT`.
