# Da Nang happy-path TDD evidence

> Date: 2026-06-22
> Source: user journey derived in this implementation session.

## User journey

As a caller, I can speak the eight agreed Vietnamese phrases as separate final Agora turns and see the authoritative booking summary accumulate the route, date/time, passenger count, masked contact, and pickup point before changing the passenger count from three to four.

## RED

Command:

```powershell
corepack pnpm --filter @call-to-cash/api exec tsx --test src/modules/call-session/replay/agora-spoken-happy-path.test.ts src/modules/booking/commands/upsert-booking-from-facts.test.ts
```

Results: the spoken phone phrase failed because the filler word `là` stopped digit collection, and the split-turn booking test failed because no helper reused the persisted route for a later date/time turn.

## GREEN

Commands:

```powershell
corepack pnpm --filter @call-to-cash/api exec tsx --test src/modules/call-session/replay/agora-spoken-happy-path.test.ts src/modules/call-session/replay/replay-extractor.test.ts src/modules/booking/commands/upsert-booking-from-facts.test.ts
corepack pnpm --filter @call-to-cash/api typecheck
corepack pnpm --filter @call-to-cash/web test
corepack pnpm --filter @call-to-cash/web typecheck
```

Results:

- Focused API parser/upsert regression: 12/12 passed.
- API typecheck: passed.
- Web test suite: 65/65 passed.
- Web typecheck/build: passed.

## Local authoritative run

The eight exact phrases were submitted as eight separate final customer turns through the authoritative API command path against PostgreSQL. This proves the same parser/upsert command used after trusted Agora event admission. It does not claim a fresh browser/provider acceptance run. The read model progressed from route-only to the following final summary:

```text
route: Da Nang -> Ha Noi
departureAt: 2026-06-28T12:00:00.000Z
passengerCount: 4
fareTotalVnd: 1800000
depositAmountVnd: 300000
contactPhoneMasked: 0901***567
completenessScore: 100
disputeRisk: 0
paymentReadiness: 20
paymentGate: LOCKED
```

## Guarantees

| Guarantee                                                                                               | Evidence                                           | Result |
| ------------------------------------------------------------------------------------------------------- | -------------------------------------------------- | ------ |
| All eight Vietnamese phrases extract their intended draft facts when received as separate final turns.  | `agora-spoken-happy-path.test.ts`                  | PASS   |
| A later date/time turn reuses the previously persisted Da Nang to Ha Noi route.                         | `upsert-booking-from-facts.test.ts`                | PASS   |
| `từ ba người thành bốn người` selects four and re-prices the authoritative draft to 1,800,000 VND.      | focused parser test plus PostgreSQL-backed API run | PASS   |
| Full phone and transcript content remain outside the browser summary; the contact read model is masked. | PostgreSQL-backed API run                          | PASS   |

## Coverage and known gap

This workspace does not define a `test:coverage` script. Browser microphone, provider transcription, trusted relay admission, and SSE rendering still require a fresh manual Agora smoke run. Spoken confirmation is intentionally not converted directly into payment authority by this parser; the agreement confirmation command remains a separate guarded action.
