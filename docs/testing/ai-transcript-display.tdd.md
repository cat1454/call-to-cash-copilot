# AI transcript display — TDD evidence

## Journey

As a caller, I want both passenger and AI speech turns shown in the conversation, so the transcript is complete and understandable.

## RED

`corepack pnpm --filter @call-to-cash/rtm-relay test` reproduced the issue: Agora text-mode `assistant.transcription` without `words` or `turn_status` was rejected, while customer messages passed.

## GREEN

| Guarantee                                                                 | Test                                                                           | Result |
| ------------------------------------------------------------------------- | ------------------------------------------------------------------------------ | ------ |
| Text-mode assistant transcripts map to final `AGENT` turns                | `apps/rtm-relay/src/rtm-transcript-frame.test.ts`                              | PASS   |
| `AGENT` events render as an AI turn on the left-side conversation surface | `apps/web/src/features/simulation/hooks/serverPostCallTranscriptState.test.js` | PASS   |
| Post-call recovery waits for both customer and AI turns                   | `apps/web/src/features/simulation/hooks/serverPostCallTranscriptState.test.js` | PASS   |

Workspace gates:

```text
corepack pnpm lint       # PASS — 10/10 tasks
corepack pnpm typecheck  # PASS — 17/17 tasks
corepack pnpm test       # PASS — 17/17 tasks
corepack pnpm build      # PASS — 11/11 tasks
```

## Known gap

The local API and web service both returned HTTP 200. Visual DOM verification could not run because the in-app browser runtime failed during connection setup. A real Agora microphone call remains the final proof that provider text-mode AI messages arrive in the deployed environment.

No checkpoint commits were created because the existing worktree contains unrelated in-progress changes and the user did not request commits.

## Pending-reply UX follow-up

Runtime inspection found that the active and most recent ended live calls contained only `CUSTOMER` turns. The running relay process predated the parser fix, so API and relay were restarted from the current build and `corepack pnpm demo:preflight` passed. A new live call is required because an existing call cannot recover the relay's in-memory session binding after restart.

RED: the web test failed because `shouldShowAgentReplyPending` did not exist.

GREEN: the UI now shows a left-aligned AI processing indicator in the transcript and a matching status in the customer phone view after a customer turn. It disappears when an AI turn arrives or the call is no longer active; no synthetic AI transcript text is created.

```text
corepack pnpm --filter @call-to-cash/web test  # PASS — 60 tests
```

## Phase 9 closure follow-up — 2026-06-22

RED tests covered assistant text-mode debounce/deduplication, privacy-safe relay counters, Vietnamese word-based date/time extraction, catalogue route direction, customer-only booking extraction, and the eight-second subtitle-delay state.

GREEN verification passed:

```text
TEST_DATABASE_URL=... corepack pnpm --filter @call-to-cash/api test  # PASS — 21 tests
corepack pnpm --filter @call-to-cash/web test                        # PASS — 61 tests
corepack pnpm --filter @call-to-cash/rtm-relay test                  # PASS — 10 tests
```

This is not live acceptance evidence for the current assistant-frame variant. Phase 9 is
**COMPLETE by explicit user-approved scope decision**; the missing accepted `AGENT` turn is
recorded as deferred text/AI UX work and is not represented as a passing live test.

## Live evidence diagnosis follow-up

A live test recorded assistant-classified relay frames but zero accepted `AGENT` turns. The relay now categorizes only the assistant text representation and accepts a validated alternate text carrier without recording the payload or transcript text. A new live call is required after relay restart to identify the category and prove persisted agent delivery.

## Booking follow-up â€” 2026-06-22

RED tests covered a Vietnamese phone number spoken digit by digit and a passenger count that
arrives after the exact departure selection. GREEN verification confirms the phone is masked and
the server recalculates `fareTotalVnd` from the already-selected departure. The existing booking
snapshot route and departure fields remain available immediately after the first route/departure
turn; the web SSE recovery then renders that authoritative snapshot.

```text
TEST_DATABASE_URL=... corepack pnpm --filter @call-to-cash/api test  # PASS â€” 25 tests
```

Live ASR follow-up: the observed form `Hà Nội Sapa, hai mươi hai:ba mươi phút` initially did
not select a departure, so the summary stayed blank by design. A RED unit test and a
database-backed API test now cover joined place words plus spoken `hour:minute`; both pass after
the deterministic matcher normalizes those display-preserving variants.
