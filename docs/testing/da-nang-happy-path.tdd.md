# Da Nang happy-path TDD evidence

> Date: 2026-06-22
> Source: user journey derived in this implementation session.

## User journey

As a demo operator, I can run a clearly labelled deterministic replay for a booking from Da Nang to Ha Noi on 28/06 at 19:00, collect the required contact and pickup point, change the passenger count from three to four, and see the server-authoritative booking/risk flow progress before a fresh confirmation.

The replay is a demo fallback. It is not presented as an Agora transcript source.

## RED

Command:

```powershell
corepack pnpm --filter @call-to-cash/api exec tsx --test src/modules/call-session/replay/replay-extractor.test.ts
```

Result: failed at `extracts the Da Nang to Ha Noi happy-path facts and its supported pickup point` because the deterministic extractor returned route, date/time, and passenger count but omitted the requested pickup point.

## GREEN

Commands:

```powershell
corepack pnpm --filter @call-to-cash/api exec tsx --test src/modules/call-session/replay/replay-extractor.test.ts
corepack pnpm --filter @call-to-cash/web test
corepack pnpm --filter @call-to-cash/web typecheck
```

Results:

- API replay extractor: 9/9 passed.
- Web test suite: 65/65 passed.
- Web typecheck/build: passed.

## Local authoritative run

After starting Docker Desktop, applying the existing migrations, and reseeding the local catalogue, the API replay boundary was exercised against PostgreSQL. The final local read model was:

```text
route: Da Nang -> Ha Noi
departureAt: 2026-06-28T12:00:00.000Z
passengerCount: 4
fareTotalVnd: 1800000
depositAmountVnd: 300000
contactPhoneMasked: 0901***567
bookingStatus: AGREEMENT_LOCKED
paymentGate: UNLOCKED
completenessScore: 100
disputeRisk: 0
paymentReadiness: 100
```

## Guarantees

| Guarantee                                                                                                                            | Evidence                                                          | Result                                 |
| ------------------------------------------------------------------------------------------------------------------------------------ | ----------------------------------------------------------------- | -------------------------------------- |
| Vietnamese date/time, route, three passengers, and the Da Nang pickup are extracted deterministically.                               | `replay-extractor.test.ts` happy-path test                        | PASS                                   |
| Updating the passenger turn from 3 to 4 uses the existing authoritative booking upsert and re-prices against the selected departure. | existing `upsertBookingFromFacts` path exercised by replay inputs | covered by existing authoritative flow |
| The customer can opt into a visibly labelled Replay happy path instead of misrepresenting an unavailable Agora transcript as live.   | web test suite and typecheck                                      | PASS                                   |

## Coverage and known gap

This workspace does not define a `test:coverage` script. The focused unit regression, full web test suite, and a PostgreSQL-backed API replay were run. Browser microphone/Agora acceptance remains a separate live-provider check; this replay path is explicitly labelled and does not claim to be Agora.
