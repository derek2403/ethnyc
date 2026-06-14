<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

<!-- BEGIN:mars-project -->
# MARS — project map (this repo)

MARS is a marketplace where staked, World-ID-verified **auditor agents** vet AI-agent **skills**; verdicts are recorded on **Hedera HCS** and a passing skill gets a **VERIFIED HTS NFT**. Full pitch in `README.md`. Hedera **testnet**; single-operator ("operator pays") model; hand-rolled JSON envelopes + Mirror Node reads, `@hashgraph/sdk` only.

## Two demo flows
- **Register an agent** — `/hedera` (web) · `scripts/register-agent.ts` / `/register-agent` (CLI): Hedera account → World AgentBook QR → the agent gets profile/voting/review HCS + is logged into the main registry.
- **Audit a skill** — `/chatroom` (web) · `scripts/run-task.ts` / `/run-task <skill>` (CLI): **post the task** (Hedera task topic, status `posted` = not started) → **negotiate** (OpenAI auditor quote) → **lock the Arc x402 escrow** (developer fee + auditor bond, 0.1/0.1 → task advances to `funded`/started) → real 4-stage OpenAI audit → approve/review/mint a VERIFIED NFT → **settle** (approve → fee+bond to auditor) or **slash** (block → bond to the auditor that caught it, fee refunded to developer). Everything is recorded on HCS; the money moves on Arc (`lib/escrow-server.ts`, `MarsEscrow.sol`).

## HCS topic map (ids seeded to `mars-state.json`)
- **main registry** (HCS-2) — every `agent_registered` + `job_posted`/`job_updated`; `computeRegistry` replays it (the index the dashboard reads).
- **chat room** (HCS-16) — one global negotiation room.
- **per-task topic** — `init(posted) → escrow_funded → audit stages → verdict → decision → reviewed → minted → escrow_resolved` (the per-skill audit + payment trail).
- **HCS-1 files** — skill source + the full audit report (content-addressed, brotli).
- **per-agent** — profile (HCS-11) + voting (HCS-20 good/bad) + review topics.
- **HTS** — the VERIFIED NFT collection (`verifiedTokenId`).

## Key files
- `lib/hedera.ts` — all Hedera primitives + every message builder + Mirror Node replay.
- `lib/agents.ts` — agent onboarding + `initMars`.
- `lib/auditor.ts` — the OpenAI auditor quote (auditor only; pinned to 1 USDC; fallback-safe).
- `lib/audit-core.mjs` + `lib/skill-source.mjs` — the real audit pipeline (4 OpenAI stages) + skill loader.
- `lib/audit-task.ts` — `auditTaskToHcs` + `finalizeTaskToHcs` (record the audit + lifecycle on HCS).
- `lib/escrow.ts` (client-safe addrs/ABI) + `lib/escrow-server.ts` (server-only) — the **Arc x402 escrow**: `openAndFundEscrow` (both sides lock) → `resolveEscrow` (settle) / `slashEscrow` (slash). Two keys: developer = `ARC_PRIVATE_KEY`, auditor = `SELLER_PRIVATE_KEY` (single-key fallback). Contract = `hardhat/contracts/MarsEscrow.sol`.
- `lib/x402.ts` — Circle Gateway / x402 nanopayment config (the `gw`-balance, gas-free pay-per-use leg; `pages/api/{skill,buy-skill}.ts`).
- `lib/demo-skills.ts` / `lib/demo-skills-loader.ts` — fixed demo personas (requester/auditor), demo skills, nego helpers + the file/folder skill loader.
- `pages/api/hedera.ts` — **one** `POST { action, … }` route exposing every capability.
- `pages/api/use-skill.ts` — **NFT-gated x402 access**: `?skill=&account=` → holds the VERIFIED HTS NFT (the license) → free; else `402` + pay 0.01 USDC via x402 nanopayment (`&pay=1` to pay + unlock). The license lives on Hedera, the payment on Arc.
- `pages/{hedera,chatroom,audit,test}.tsx` — the demo UIs (`/test` = the manual Arc escrow + x402 playground).
- `scripts/{run-task,test-escrow,test-draft,test-x402}.ts` — the flow + Arc escrow / x402 test scripts (`tsx scripts/test-escrow.ts check` = read-only key/balance diagnostic).

## Env (`.env.local`, gitignored)
`HEDERA_OPERATOR_ID`, `HEDERA_OPERATOR_KEY` (always). World: `NEXT_PUBLIC_WORLD_APP_ID`, `NEXT_PUBLIC_RP_ID`, `RP_SIGNING_KEY`. OpenAI: `OPENAI_API_KEY` (+ optional `OPENAI_MODEL`, `AUDIT_MODEL`, `PHALA_ATTESTOR_URL`). Chainlink: `CHAINLINK_ATTESTER_API_KEY`. **Arc payments (x402 escrow):** `ARC_PRIVATE_KEY` (the developer/requester that funds the fee — also the x402 buyer), `SELLER_PRIVATE_KEY` (the auditor/seller that posts the bond + receives the settle payout; omit → single-key fallback, one account plays both roles), optional `ARC_DEVELOPER_KEY` (a distinct developer key), `ESCROW_FEE_USDC`/`ESCROW_BOND_USDC` (override the 0.1/0.1 demo amounts). All Arc accounts need a little testnet USDC (faucet.circle.com — USDC is Arc's native gas token too). `mars-state.json` (seeded topic/token ids) is also gitignored.

## Conventions
- A new capability = a new `case` in `pages/api/hedera.ts` + a builder in `lib/hedera.ts`. The web UIs and the CLI scripts both go through the same `lib/`.
- Each HCS message must be ≤1 KB (a single message); larger payloads go to HCS-1 (`uploadFileHCS1`) and are referenced by an `hcs://1/<id>` HRL.
- The two audit-demo agents are **fixed, already-registered** accounts (World ✓) in `lib/demo-skills.ts` — the audit demo never registers an auditor live.
- OpenAI calls fail soft: no `OPENAI_API_KEY` (or an API error) → a deterministic fallback, so the demo always runs.
<!-- END:mars-project -->
