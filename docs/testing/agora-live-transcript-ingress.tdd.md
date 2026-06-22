# Agora live transcript ingress — TDD evidence

## Source and user journey

No plan file was supplied. The journey was derived from the reported failure:

> As a caller, I want completed customer and AI speech turns to appear in the authoritative transcript, so the scripted booking flow can continue during an Agora conversation.

## RED evidence

Command:

```text
corepack pnpm --filter @call-to-cash/agora test
corepack pnpm --filter @call-to-cash/rtm-relay test
```

Observed before the implementation change:

- the join request omitted `agent_rtm_uid`;
- Agora's documented event `103` payload failed schema validation;
- documented `user.transcription` and `assistant.transcription` RTM messages were rejected as malformed.

The failing targets reported 2 failed Agora tests and 2 failed relay tests.

## GREEN evidence

| Guarantee | Test target | Type | Result |
| --- | --- | --- | --- |
| Join binds the RTM publisher UID and preserves the server-side V1 prompt | `packages/agora/src/agora.test.ts` | unit | PASS |
| Official product `17`, event `103`, and `payload.contents` parse safely | `packages/agora/src/agora.test.ts` | contract | PASS |
| Final customer RTM transcription maps to a canonical customer turn | `apps/rtm-relay/src/rtm-transcript-frame.test.ts` | unit | PASS |
| Terminal assistant RTM transcription maps to a canonical agent turn | `apps/rtm-relay/src/rtm-transcript-frame.test.ts` | unit | PASS |
| Wrong publishers and mismatched sessions remain rejected | `apps/rtm-relay/src/rtm-transcript-frame.test.ts` | security/unit | PASS |

Final verification:

```text
corepack pnpm lint       # PASS — 10/10 workspace tasks
corepack pnpm typecheck  # PASS — 17/17 workspace tasks
corepack pnpm test       # PASS — 17/17 workspace tasks
corepack pnpm build      # PASS — 11/11 workspace tasks
corepack pnpm demo:preflight # PASS — API, RTM relay, database, Agora/Solana config ready
```

## Coverage and known gaps

The workspace has no configured coverage command/threshold, so no percentage is claimed. Database-backed suites were discovered but skipped because `TEST_DATABASE_URL` was not configured. A real browser microphone/Agora run is still required to prove provider delivery, audible agent output, SSE rendering, and post-call event `103` reconciliation in the deployed environment.

No TDD checkpoint commits were created because the branch already contained a large unrelated/in-progress dirty worktree and the user did not request commits; creating partial commits would have risked capturing their work.
