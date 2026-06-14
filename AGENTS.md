<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

<!-- BEGIN:mars-project -->
# MARS — project map (this repo)

MARS is a marketplace where staked, World-ID-verified **auditor agents** vet AI-agent **skills**; verdicts are recorded on **Hedera HCS** and a passing skill gets a **VERIFIED HTS NFT**. Full pitch in `README.md`. Hedera **testnet**; single-operator ("operator pays") model; hand-rolled JSON envelopes + Mirror Node reads, `@hashgraph/sdk` only.

## Two demo flows
- **Register an agent** — `/hedera` (web) · `scripts/register-agent.ts` / `/register-agent` (CLI): Hedera account → World AgentBook QR → the agent gets profile/voting/review HCS + is logged into the main registry.
- **Audit a skill** — `/chatroom` (web) · `scripts/run-task.ts` / `/run-task <skill>` (CLI): negotiate (OpenAI auditor quote) → auto-create a task topic → real 4-stage OpenAI audit → approve/review/mint a VERIFIED NFT. Everything is recorded on HCS.

## HCS topic map (ids seeded to `mars-state.json`)
- **main registry** (HCS-2) — every `agent_registered` + `job_posted`/`job_updated`; `computeRegistry` replays it (the index the dashboard reads).
- **chat room** (HCS-16) — one global negotiation room.
- **per-task topic** — `init → audit stages → verdict → decision → reviewed → minted` (the per-skill audit trail).
- **HCS-1 files** — skill source + the full audit report (content-addressed, brotli).
- **per-agent** — profile (HCS-11) + voting (HCS-20 good/bad) + review topics.
- **HTS** — the VERIFIED NFT collection (`verifiedTokenId`).

## Key files
- `lib/hedera.ts` — all Hedera primitives + every message builder + Mirror Node replay.
- `lib/agents.ts` — agent onboarding + `initMars`.
- `lib/auditor.ts` — the OpenAI auditor quote (auditor only; pinned to 1 USDC; fallback-safe).
- `lib/audit-core.mjs` + `lib/skill-source.mjs` — the real audit pipeline (4 OpenAI stages) + skill loader.
- `lib/audit-task.ts` — `auditTaskToHcs` + `finalizeTaskToHcs` (record the audit + lifecycle on HCS).
- `lib/demo-skills.ts` / `lib/demo-skills-loader.ts` — fixed demo personas (requester/auditor), demo skills, nego helpers + the file/folder skill loader.
- `pages/api/hedera.ts` — **one** `POST { action, … }` route exposing every capability.
- `pages/{hedera,chatroom,audit}.tsx` — the demo UIs.

## Env (`.env.local`, gitignored)
`HEDERA_OPERATOR_ID`, `HEDERA_OPERATOR_KEY` (always). World: `NEXT_PUBLIC_WORLD_APP_ID`, `NEXT_PUBLIC_RP_ID`, `RP_SIGNING_KEY`. OpenAI: `OPENAI_API_KEY` (+ optional `OPENAI_MODEL`, `AUDIT_MODEL`, `PHALA_ATTESTOR_URL`). Chainlink: `CHAINLINK_ATTESTER_API_KEY`. `mars-state.json` (seeded topic/token ids) is also gitignored.

## Conventions
- A new capability = a new `case` in `pages/api/hedera.ts` + a builder in `lib/hedera.ts`. The web UIs and the CLI scripts both go through the same `lib/`.
- Each HCS message must be ≤1 KB (a single message); larger payloads go to HCS-1 (`uploadFileHCS1`) and are referenced by an `hcs://1/<id>` HRL.
- The two audit-demo agents are **fixed, already-registered** accounts (World ✓) in `lib/demo-skills.ts` — the audit demo never registers an auditor live.
- OpenAI calls fail soft: no `OPENAI_API_KEY` (or an API error) → a deterministic fallback, so the demo always runs.
<!-- END:mars-project -->
