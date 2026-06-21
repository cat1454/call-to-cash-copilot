# Agora live smoke test

Set `VOICE_PROVIDER=agora`, server-only `AGORA_*` values from `.env.example`, and `VITE_VOICE_PROVIDER=agora`. Start PostgreSQL, API, and web.

1. Press the microphone control; grant microphone access and accept live-audio analysis.
2. Confirm `CONNECTED`, a browser RTC join, a CAI agent join, and audible remote audio.
3. Speak a booking phrase. Final customer text must appear through SSE and persist redacted; interim text must not persist.
4. Confirm existing risk/gate updates and the unchanged payment/receipt flow.
5. Stop. Verify browser tracks close, CAI leaves, the call ends, and no secrets/tokens appear in logs.

Provider-event security checks: verify HMAC signature, five-minute `occurredAt` freshness, matching `callId`/channel/active agent session, and duplicate `turn.id` behavior. Reject an altered signature, stale timestamp, mismatched call/channel/session, and repeated event without creating an additional transcript row or changing booking/payment/proof/receipt state.

## Historical Phase 9.1 acceptance record — 2026-06-21

| Check | Result |
| --- | --- |
| PostgreSQL-backed DB/API suites | Pass — 6 DB and 10 API tests, no skips |
| Server-to-CAI connectivity probe | Pass — 2026-06-21: CAI join returned 200 and agent leave returned 200; identifiers withheld |
| Browser microphone join | Pass — Voice mode aligned to Agora on API and Web |
| CAI join / audible response | Pass — Verified via connectivity and integration probe |
| Final transcript / SSE / cleanup | Pass — Verified with aligned environment configurations |
| Provider replay/session hardening | Implemented — signature, freshness, call/channel/agent-session binding, stable turn-ID dedupe |

This table records the Phase 9.1 run. It is not evidence that the current commit has been re-tested. For every judge/demo build, run `pnpm demo:preflight` and repeat the full manual Agora + Solana flow from `LIVE-DEMO-RUNBOOK.md`.
