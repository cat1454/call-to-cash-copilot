# ECC Agent Workflow

> **Applies to:** coding agents working in Call-to-Cash Risk Copilot  
> **ECC source:** `https://github.com/affaan-m/ECC`  
> **Local path:** `ECC/`  
> **Pinned clone inspected:** `34faa39bd3cd496a0aece0245f2b7e38b7923abc`

## 1. Purpose

`ECC/` is a local upstream library of reusable agent workflows, skills, commands, agents, rules, hooks, and harness documentation. It helps agents choose a proven workflow without turning generic ECC guidance into product authority.

ECC is intentionally:

- outside the pnpm workspace;
- represented in the parent repository by a pinned gitlink, while its contents remain in a separate nested clone;
- maintained as its own nested git repository;
- treated as read-only during product tasks;
- loaded progressively, not copied wholesale into context.

The Call-to-Cash documentation remains the source of truth for business behavior, security, contracts, states, data, and operations.

## 2. Instruction precedence

When instructions conflict, use this order:

```text
1. System/developer/user instructions
2. Root AGENTS.md and tool-specific project instructions
3. Project documentation precedence defined in AGENTS.md
4. Selected ECC SKILL.md workflow
5. General ECC rules, commands, examples, and translated docs
```

An ECC skill may refine *how* work is performed. It may not redefine payment guards, API payloads, event names, state transitions, PII policy, or other Call-to-Cash contracts.

## 3. Progressive skill discovery

Do not read all ECC skills. Start with names and descriptions:

```powershell
rg -n "^(name|description):" ECC/.agents/skills ECC/skills -g SKILL.md
```

For a likely match:

1. Read its complete `SKILL.md`.
2. Follow only references needed for the current task.
3. Check whether required tools/MCPs exist in the current runtime.
4. Announce the selected skill in the agent progress update.
5. Add its workflow to the current plan when the task is multi-step.

If the skill requires unavailable hooks, MCPs, slash commands, or subagents, preserve the useful workflow and use available local tools. Do not claim the unavailable capability ran.

## 4. Project routing table

| Task | Start with ECC skill | Project documents that remain authoritative |
|---|---|---|
| Repository audit/onboarding | `repo-scan`, `codebase-onboarding`, or `ecc-guide` | `docs/report/CURRENT-STATE.md`, architecture docs |
| Product capability/vertical slice | `product-capability` | `BOOKING-CONTRACT.md`, `RISK-SCORING.md`, `PIPELINE.md` |
| REST/SSE contract design | `api-design`, `backend-patterns` | `API-CONTRACT.md`, `EVENT-CONTRACT.md`, `ERROR-CODES.md` |
| Shared schemas/domain rules | `coding-standards`, `tdd-workflow` | state machines, product contracts, privacy policy |
| Risk/payment/security work | `security-review`, `tdd-workflow` | privacy policy, state machines, payment/proof contracts |
| PostgreSQL/Prisma work | `postgres-patterns`, `database-migrations` | `DATA-MODEL.md`, operations docs |
| Docker/local infrastructure | `docker-patterns` | `LOCAL-SETUP.md`, `DEPLOYMENT.md` |
| React/PWA work | `frontend-patterns`, `e2e-testing` | `DESIGN.md`, `MAINTAINABILITY.md`, product contracts |
| Evaluation/regression suite | `eval-harness`, `tdd-workflow` | `RISK-SCORING.md`, pipeline evaluation phases |
| Final verification | `verification-loop` | repository commands and Definition of Done |
| Current library/API behavior | `documentation-lookup` | official upstream documentation plus project contracts |

The table is a starting point, not an instruction to activate every listed skill.

## 5. Skills versus other ECC surfaces

- `ECC/.agents/skills/`: Codex-ready core skill set.
- `ECC/skills/`: full and niche skill catalog.
- `ECC/commands/`: legacy slash-command compatibility shims; prefer the corresponding skill.
- `ECC/agents/`: role prompts; usable only when the current runtime supports/delegates agents.
- `ECC/rules/`: generic rule sets; they do not automatically apply to this project.
- `ECC/hooks/`: Claude-style automation; cloning ECC does not activate hooks in Codex.
- `ECC/.codex/config.toml`: reference config only. It is not copied into this project because it enables optional MCP processes and contains platform-specific notification settings.
- `ECC/docs/`: ECC implementation and harness documentation, not Call-to-Cash product documentation.

## 6. Runtime discovery caveat

Codex auto-discovers skills exposed by its runtime or under a supported project skill surface such as `.agents/skills/`. A nested clone at `ECC/.agents/skills/` is not guaranteed to be auto-loaded.

For this repository, `AGENTS.md` provides instruction-based discovery directly from `ECC/`. This works as a local workflow library even when a skill is not listed as a native runtime skill. Agents must be explicit about that distinction.

If automatic project-level installation is desired later, copy only the approved skill directories into `.agents/skills/` or use ECC's supported sync/install workflow. Review copied skills for project fit and path references first; do not install the entire niche catalog by default.

## 7. Updating ECC

Check the nested clone before updating:

```powershell
git -C ECC status --short
git -C ECC pull --ff-only
```

After an update:

1. record the new ECC commit when behavior changes materially;
2. review changes to skills currently referenced by project workflows;
3. verify `ECC/` remains excluded from pnpm and that the parent repository records only the intended gitlink commit;
4. do not merge ECC's generic `AGENTS.md`, `CLAUDE.md`, rules, or `.codex/config.toml` over project-specific files.

The current parent repository pins `ECC` as gitlink commit `34faa39`. The committed `.gitmodules` mapping points to the upstream ECC repository, so initialize the pinned nested clone after a fresh checkout with:

```powershell
git submodule update --init --recursive
```

## 8. Safety rules

- Do not place application secrets in ECC config or examples.
- Do not run installer/sync scripts that modify user-level agent configuration without explicit user approval.
- Do not enable MCP servers merely because ECC recommends them.
- Do not run ECC hooks against product files unless their behavior has been reviewed and approved.
- Do not modify `ECC/` during ordinary product implementation.
- Do not report an ECC command, agent, hook, or MCP as used unless it actually ran.

## 9. Quick checklist

Before work:

- [ ] Read affected Call-to-Cash docs.
- [ ] Search ECC skill metadata.
- [ ] Select the smallest relevant skill set.
- [ ] Read selected `SKILL.md` files completely.
- [ ] Confirm required tools exist.
- [ ] Announce skill usage.

Before handoff:

- [ ] Run project tests/checks appropriate to the change.
- [ ] State which ECC workflow influenced the work.
- [ ] State any unavailable ECC capability that was not run.
- [ ] Keep product documentation and contracts synchronized with code.
