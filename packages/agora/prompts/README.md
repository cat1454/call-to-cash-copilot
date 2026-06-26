# Agora voice-agent prompts

## Current baseline

| Field | Value |
| --- | --- |
| Prompt identifier | `CTC-AGORA-VI-V1` |
| Repository source | [`call-to-cash-vi-v1.md`](./call-to-cash-vi-v1.md) |
| Created | 2026-06-21 |
| Status | **DRAFT** |
| Evaluation matrix | [`evaluation-cases.json`](./evaluation-cases.json) |
| Constraint test | [`prompt-constraints.test.ts`](./prompt-constraints.test.ts) |

The prompt is a static conversational baseline only. It does not replace deterministic extraction or decide booking, inventory, risk, payment, proof, or receipt state.

## Provider mapping

| Mapping field | Recorded value |
| --- | --- |
| Safe pipeline identifier | `agora-cai:pipeline:sha256:6f637e567d52d50f` |
| Provider path | Agora Conversation AI Engine `join` request |
| Repository-to-provider mapping | `call-to-cash-vi-v1.md` is loaded server-side and sent as `properties.llm.system_messages[0]` with `role: system` |
| Prompt revision field | No provider revision field is used or inferred by this repository |

At session start, `AGORA_CAI_PROPERTIES_JSON` supplies the server-only `pipeline_id` and any compatible non-prompt properties. `AgoraConversationAgentClient` preserves those properties, then replaces `properties.llm.system_messages` with the complete V1 source. The browser never receives this value.

The resulting join shape is:

```json
{
  "pipeline_id": "<server-only configured pipeline id>",
  "properties": {
    "llm": {
      "system_messages": [
        { "role": "system", "content": "<contents of CTC-AGORA-VI-V1>" }
      ]
    }
  }
}
```

## Deployment procedure

1. Run the prompt constraint test and repository verification gates.
2. Deploy the application build containing this prompt source; do not copy prompt text into a browser variable or an unmanaged provider field.
3. Start a new controlled Agora agent session. The server-side join request supplies V1 through `properties.llm.system_messages`.
4. Record the six controlled live evaluations in `docs/operations/AGORA-LIVE-SMOKE-TEST.md`: three happy paths, interruption, silence, and payment-verifying. Preserve only redacted transcript evidence.
5. Keep V1 **DRAFT** unless every required evaluation passes with no unsupported authority claim.

## Recovery boundary

No Agora provider prompt-revision or provider rollback API is configured or verified here. Do not invent one. If V1 causes a regression, stop controlled evaluation and roll back the application deployment to the prior known-working build/configuration using the normal deployment procedure; then record a redacted recovery smoke result. This is an application-deployment rollback, not a claimed provider prompt-revision rollback.

## Activation checklist

- [ ] Prompt constraints and evaluation matrix tests pass.
- [ ] The deployed server creates the documented join payload; no browser configuration contains prompt content.
- [ ] Three happy-path, interruption, silence, and payment-verifying live evaluations pass.
- [ ] User and agent transcripts are visible and final provider turns reach the API/SSE path.
- [ ] No unsupported booking, payment, receipt, inventory, refund, or risk claim was observed.

## Static prompt versus future runtime directives

Phase 9.3 is documented but not implemented here:

> Domain/API decides **WHAT** business step is valid. The voice agent decides **HOW** to say it naturally.

Possible directives such as `ASK_ROUTE`, `PAYMENT_VERIFYING`, or `PAYMENT_GATE_OPEN` must be supplied by an authoritative server mechanism in that later workstream. The V1 static prompt must not imitate them or infer their business truth.

## Known limitations

- V1 is not `VALIDATED` or `ACTIVE` until the activation checklist is complete.
- The join payload is covered by automated tests, but this code has not yet been deployed/restarted for a controlled V1 live evaluation.
- Phase 10 optional LLM extraction remains out of scope.
