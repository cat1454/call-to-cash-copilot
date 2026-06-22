# Live Demo Runbook

## Purpose

Demonstrate one honest path from Vietnamese voice input to server-authoritative risk, a locked agreement, Solana Devnet verification, a Trust Receipt, and refresh recovery. Keep replay ready as the deterministic fallback.

## Prerequisites

- Node.js and pnpm versions from the repository.
- Docker/PostgreSQL, Chrome or Edge, a working microphone, and Phantom configured for Devnet.
- Server credentials configured locally; never place them in `apps/web/.env`.
- Environment names listed in `DEMO-READINESS-AUDIT.md`.

## Startup order

```powershell
corepack pnpm install --frozen-lockfile
corepack pnpm build
node --test tests/packageRuntimeExports.test.js
docker compose up -d postgres
pnpm db:migrate:deploy
pnpm db:seed
pnpm dev:api
# second terminal
pnpm dev:web
# third terminal
pnpm demo:preflight
```

All preflight checks must pass before opening the judge flow. The command reports presence/status only and never prints secret values.

If a runtime import says an internal package does not export a symbol that exists in `src`, rebuild the owning package and rerun `tests/packageRuntimeExports.test.js`. Do not alter valid API imports to compensate for stale `dist`.

## Live voice and payment

1. Confirm the UI says `Live voice · Agora`.
2. Press the microphone, accept the analysis consent, and grant browser microphone permission.
3. Confirm `pnpm demo:preflight` reports the private `Agora RTM relay` reachable, then wait for `Agora đã kết nối` and speak the booking scenario.
4. Confirm customer and agent final transcript turns appear from the RTM relay and risk/booking state updates through SSE. Relay health alone is not a transcript pass.
5. Confirm the current agreement only after the required facts, policy, hold, and server gate are valid.
6. Open the Solana Devnet payment request in Phantom, verify Devnet, and sign manually.
7. Wait for server verification. Do not treat the wallet return as confirmation.
8. When ending a live call, keep the page open while it shows `Đang đồng bộ hội thoại sau cuộc gọi...`; the client retains SSE and polls the redacted transcript endpoint for up to 12 seconds so signed post-session Agora history can reconcile. Then show the recovered transcript/risk state.
9. Show the Trust Receipt, refresh the page, and show recovered booking/payment/receipt state.

## Historical Phase 9 live validation record

Phase 9 was closed by explicit user-approved scope decision on 2026-06-22. Preserve the same
recording discipline for any future text/AI UX work: record `PASS`, `BLOCKED`, or `NOT TESTED`
for microphone permission, published user audio, audible agent response, novel customer
transcript, agent transcript, final-turn persistence, SSE risk/booking update, and refresh
recovery. Source inspection, API readiness, or an Agora agent creation response does not count
as a live pass.

## Replay fallback

If live voice fails, use the visible `Dùng bản phát lại` action. Confirm the badge changes to `Demo · Replay`; then continue through the same server-authoritative domain/payment path. Never call replay an Agora connection.

## Safe shutdown

1. End the voice session in the UI.
2. Confirm microphone activity stops and the UI leaves `CONNECTED`.
3. Stop web/API processes.
4. Run `docker compose stop postgres` when the local database is no longer needed. Do not delete volumes during routine demo cleanup.

## Troubleshooting

| Symptom                           | Safe action                                                                                                                                                                         |
| --------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Preflight reports voice mismatch  | Align root `VOICE_PROVIDER` and the effective browser value (`apps/web/.env.local` when present, otherwise `apps/web/.env`) for `VITE_VOICE_PROVIDER`, then restart both processes. |
| Microphone denied/missing         | Fix browser permission/device, retry, or choose replay.                                                                                                                             |
| Agora or RTM relay cannot connect | Retry once; then use explicit replay fallback. Existing durable state remains; do not start live CAI without the relay.                                                             |
| SSE reconnecting                  | Keep the page open; the client uses Last-Event-ID and authoritative REST recovery.                                                                                                  |
| Phantom opens wrong network       | Switch to Devnet before signing.                                                                                                                                                    |
| Payment remains pending           | Keep the drawer open and retry verification; do not create a second booking.                                                                                                        |
| API/DB unavailable                | Restore PostgreSQL/API and rerun preflight. Do not continue the live payment story.                                                                                                 |

## Phase 9 closure evidence

Phase 9 is closed as the user-approved customer booking/realtime-summary slice. The closure
does not assert a passing live assistant frame. Before any future text/AI UX phase is started,
start a new Agora call and confirm `http://127.0.0.1:3011/health` reports an accepted agent
turn, the left transcript renders one AI bubble within two seconds of the final assistant frame,
and a customer statement for a scheduled catalogue departure updates Booking Summary within two
seconds. Record only redacted screenshots/counts; never record transcript payloads, tokens, or
signatures.
