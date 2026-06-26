# AI and risk engine

Phase 10 owns provider-neutral, advisory booking extraction. `AI_PROVIDER=deterministic`
remains the default. The approved optional provider is `AI_PROVIDER=openai`, using the
server-only `OPENAI_MODEL=gpt-5-mini` configuration and strict JSON-schema responses.
The OpenAI path is independent from any Agora voice-agent model request.

## Boundary

- Extractors may propose only booking field candidates with confidence and source-turn evidence.
- All output is validated by shared strict Zod schemas before use.
- Invalid, unavailable, timed-out, rate-limited, or cross-turn output falls back safely.
- The package never writes to Prisma, calls payment/Solana services, sets a booking state, opens a
  payment gate, or exposes raw prompt/model output.

## Phase 10 first slice

`CTC-BOOKING-EXTRACTION-V1` treats the final customer transcript as untrusted data and only
permits the approved candidate schema. The API preserves deterministic booking validation and
domain authority; persisted provenance contains safe schema/provider/model/prompt/status metadata,
not raw provider responses or unmasked contact data. `OPENAI_API_KEY` is required only when
`AI_PROVIDER=openai` is selected and must never use a `VITE_` prefix.
