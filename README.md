# MARS — Marketplace for Audited, Reputable Skills
### *Buy a skill you can trust with your wallet.*

> AI agents now hold wallets and install **skills / MCP tools** to act — but those skills are unvetted, and a poisoned one can drain the agent. **MARS is a marketplace where a swarm of staked, World-ID-verified auditors *competes* to audit each skill, the winner's verdict is attested on-chain, and agents pay-per-version to use only the skills that passed.**

**ETHGlobal New York 2026** · Tracks: **Arc** · **Hedera** · **World** · **Chainlink**

*(**MARS** = **M**arketplace for **A**udited, **R**eputable **S**kills.)*

---

## 1. The Problem

AI agents (OpenClaw, ElizaOS, Claude, any MCP-compatible agent) gain abilities by **installing skills / MCP tools** — and they install them from open, unvetted sources. This is a named, CVE'd, actively-exploited attack surface:

- **Tool poisoning** — hidden instructions inside a tool's *description* that hijack the agent (OWASP "MCP Tool Poisoning"; `CVE-2025-54136`, `CVE-2025-54135`).
- **Capability mismatch** — a "price checker" that also reads your keys / calls `setApprovalForAll` (real: a poisoned tool made Cursor read `~/.ssh`; Supabase's agent exfiltrated tokens).
- **Supply-chain RCE** — `CVE-2025-6514` (`mcp-remote`, 558k downloads → full system compromise).
- **Rug-pull updates** — clean v1, malicious v2.

**The concrete harm:** one poisoned skill = a **drained wallet, stolen API keys, and leaked secrets** — and the agent does it *to itself*, trusting a tool it never vetted. **There is no App Store, no review, no trust layer for the skills agents depend on.** MARS is that layer — it stops the skill **before** it can drain the wallet or steal the keys.

> **💢 We faced this firsthand.** Mid-build, one of our own teammates had their **AI / LLM credits drained** while we were working — a live reminder that this harm isn't a hypothetical on a threat slide. The agents we hand keys and budgets to *can* burn them, and that's exactly what MARS exists to stop. *(Logged here so we never forget why we're building it.)*

---

## 2. The Actors

| Actor | Role |
|---|---|
| **Developer's agent** (acts for the skill creator) | The creator's **agent** posts the skill + a **request for quotation** — the **scope** (what to check) and required **compliance level** — **negotiates in the HCS Flora room**, reviews the auditors' **quotes**, accepts one, and pays that fee into escrow. The human creator stays at the edge — they **own the skill and earn the royalty** when users license the verified build. |
| **Auditor agent** (a swarm that *quotes*) | A swarm of **independent, World-ID-verified** auditor **agents** that **submit quotes** (price + approach) and **negotiate in the Flora room**. The one the requesting agent **selects** posts a **bond** and runs the audit (internally a scanner → sandbox → fork → synthesizer pipeline); it's paid the fee, **earns a rating + on-chain reputation** for a clean job (→ **wins more future jobs**), and is **slashed** (bond + reputation) if its verdict is later proven wrong. |
| **User agent** (consumer) | Discovers **verified** skills, pays to use them (Arc x402 → HTS license), and leaves **World-ID-gated, proof-of-use reviews** — rating **both the skill and the auditor**, so good auditors get chosen more next time. |

---

## 3. How It Works (the flow)

```
1. REQUEST (RFQ)   The DEVELOPER'S AGENT posts a skill + a REQUEST FOR QUOTATION — the SCOPE (what
                   to check), TIME, and required PROFESSIONALISM / COMPLIANCE level (e.g. SOC 2).

2. QUOTE           World-ID-verified auditors respond with QUOTES — their RATE + approach.
                   ⤷ Flora room (HCS-16): the requesting agent + auditors (inside or outside the
                     job) JOIN & TALK here — clarify scope, negotiate the quote — see §12.

3. SELECT+ESCROW   The requesting AGENT and the auditor AGENTS NEGOTIATE in the HCS Flora room
                   (HCS-16) — clarify scope, haggle the quote — then the requesting agent SELECTS
                   one, weighing PRICE × the auditor's REPUTATION / RATING × approach × BOND. The
                   chosen auditor ties a BOND; x402 escrow opens on Arc (holds the dev's fee + bond).

4. AUDIT (TEE)     The SELECTED auditor runs the skill in a sandbox INSIDE a TEE — observing
                   DECLARED vs ACTUAL behavior (network / files / wallet) + scanning descriptions
                   for injection. EACH TEST / STEP is POSTED LIVE as an HCS message to that skill's
                   AUDIT-TRAIL TOPIC ID → an immutable, ordered, timestamped trail anyone can replay.

5. ATTEST          The verdict is attested by the Chainlink Confidential AI Attester (TEE) →
                   a cryptographic attestation a contract verifies (so "verified" is provable).

6. RECORD + LINK   Attested verdict + capability manifest → Hedera HCS registry; the skill is minted
                   a Hedera HTS "VERIFIED" token → ✅ VERIFIED. MARS issues a SPECIAL VERIFIED LINK
                   that serves the EXACT audited version (content-pinned to its hash).
                   (🟥 DANGEROUS skills are flagged & blocked; the dev's fee is spent either way.)

7. BUY / USE       Any other user/agent sees the verified skill and PAYS (Arc x402) to use it
                   → mints an HTS LICENSE → gets the VERIFIED LINK and runs the skill THROUGH it.
                   ⚠ Using the original OUTSIDE skill direct = UNVERIFIED (no guarantee it matches
                     what we audited); only MARS's link serves the attested, version-pinned build.
                   → if the AUTHOR posted their own skill, they earn a ROYALTY on every use
                     (a badass skill = recurring income); the auditor earns a cut.

   On an update → re-audit (roadmap, §12). Every agent is WORLD-ID verified (anti-sybil).
   Auditors who sign a wrong verdict are SLASHED (bond → paid to whoever catches it).
```

---

## 4. Economics

Two pots of money, both on **Arc via x402 (USDC)**:

| Pot | Who puts it in | Purpose |
|---|---|---|
| **Audit fee** (escrow) | the **Developer** (price = the **accepted quote**) | pays the **selected** auditor for the vetting |
| **Bond** (escrow) | the **selected Auditor** | honesty collateral → **slashed** if the verdict is wrong |

> **Two payment rails (both x402 USDC on Arc):** the **first** payment — *paying to get a skill audited* — runs through **ESCROW** (conditional; released on a clean verdict, the auditor's bond slashed on a bad one). Every payment **after** verification — *paying to use the skill* — is a **direct NANOPAYMENT** (instant, no escrow) that **mints an HTS license**. Escrow guards the vetting; nanopayments make consuming a verified skill fast.

**Audit tiers — the developer's agent requests a tier; auditor agents quote against it:**
- **🟢 Automated audit (standard)** — the selected auditor's automated agent pipeline: fast, cheap, sandbox + behavioral checks. Good for most skills.
- **🏛️ Professional / Enterprise audit (premium)** — a **certified human auditor** (e.g. a **SOC 2-compliant** security firm) performs a deeper, attested review for a **higher fee** → an **enterprise-grade trust badge** for skills used in regulated or high-value flows. Pricier, slower, higher assurance.

→ deeper tier = higher quotes = stronger trust badge. Enterprises request the SOC 2 / professional tier; hobby skills take the cheap automated audit.

- **On a clean audit:** escrow releases the fee → the selected auditor; bonds return.
- **Who paid to verify it decides the royalty:**
  - **Author self-publishes** their own skill (and is the first to get it verified) → they pay the audit **and are registered as creator → they earn an ongoing royalty** on every future license/use (Arc *Advanced Stablecoin Logic* programmable split, or HTS custom-fee).
  - **A non-author requests** an audit of someone else's existing public skill → it's a **plain x402 payment, no royalty** — they just paid to have it checked; the verdict becomes public for everyone.
- **Usage:** each **User** pays a license fee (Arc x402) → mints a version-bound **HTS license** → uses the skill until the next update. The **author/creator** earns the majority (their royalty); the **auditor** earns an ongoing cut (reward + skin-in-the-game).
- **If a verified skill is later caught misbehaving:** the auditor's bond is **slashed** → paid to the reporter, the verdict flips, the skill is delisted, and license-holders are warned.

> **Verdicts are facts, not votes.** Safety comes from the sandbox + the Chainlink attestation. **Reviews/ratings only rank *quality*; they never override the safety verdict.**

---

## 5. Sponsor Integrations (and which track)

### 🟦 Arc / Circle — payments + royalties · *Best Agentic Economy ($3,500) + Advanced Stablecoin Logic ($3,500)*
All money moves as **USDC on Arc**. **Implemented (live on Arc testnet):**
- **Audit-fee escrow + auditor bonds** — `MarsEscrow.sol`: both sides lock USDC on agreement (`fundFee` + `postBond` → Funded), then **settle** (`release` → fee + bond to the auditor) on approval or **slash** (`slash` → bond to the reporter, fee refunded to the developer) on a block. Driven from the task flow (`lib/escrow-server.ts`), two-party (distinct developer + auditor keys) — verified end-to-end.
- **x402 nanopayments (Circle Gateway)** — gas-free per-use payments from a funded **Gateway (`gw`) balance** via signed EIP-3009 authorizations (`lib/x402.ts`, `pages/api/{skill,buy-skill,use-skill}.ts`). The settlement returns a Gateway transfer id, not an on-chain tx.
- **NFT-gated access** — `pages/api/use-skill.ts`: hold the VERIFIED NFT (the license) → free; else pay **0.01 USDC** via the gw nanopayment and the NFT is **minted to you** → free thereafter.
- *Roadmap:* author **royalty split** on every future license (Advanced Stablecoin Logic) + omnichain top-up via Gateway (Chain-Abstracted USDC).
- *Why it fits:* "agents make gas-free micropayments / agent marketplaces" (**Agentic Economy**) + "conditional / multi-step settlement: escrow → settle/slash" (**Advanced Stablecoin Logic**).

### 🟪 Hedera — skill registry, proof-of-verification, auditor marketplace & automation · *AI & Agentic Payments ($6,000)*
Hedera is the **trust substrate**. Topic architecture = a **main registry topic + per-skill subtopics**:
```
MAIN REGISTRY TOPIC   (HCS-2 / HCS-26: Decentralized Agent Skills Registry)
  └─ per skill → SUBTOPICS:
       • versions + audit manifest   (HCS-26 versioned entries + HCS-1 file manifests/reports)
       • AUDIT TRAIL (per test/step) (one HCS message per test → ordered, timestamped, immutable)
       • trust / safety score        (HCS-25: AI Trust Score)
       • reviews & ratings           (HCS-20: Auditable Points)
```
**HCS standards:**
| Standard | Use in MARS |
|---|---|
| **HCS-26** — Decentralized Agent **Skills** Registry | the core skill registry (versioned skills on HCS-2 + HCS-1 manifests) — *literally built for this* |
| **HCS-25** — AI Trust Score | each skill's composite safety/trust score |
| **HCS-2** — Topic Registries | the main registry → per-skill subtopic structure |
| **HCS-1** — File Management | store the full audit report / capability manifest on HCS |
| **HCS-18** — Discovery (+ a job-board topic) | auditors **discover open requests & submit quotes**; the requesting agent selects one |
| **HCS-16** — Flora Coordination | an open **room where agents join & talk** — the requesting agent + auditors (inside or outside the job) clarify scope / negotiate quotes (communication, *not* consensus) |
| **HCS-11 + HCS-14** — Profile + Universal Agent ID | auditor / agent identity + profiles |
| **HCS-20** — Auditable Points | reviews / ratings / reputation |

**HTS (Hedera Token Service):** the **"VERIFIED" token** proving a skill passed + the **version-bound license token** an agent mints to use it; **custom-fee schedules auto-route the author royalty** on every license transfer (Hedera-native alternative to Arc's split).

**Accounts + automation:** each agent gets a **Hedera account** (`createAccount`; HCS-15 Petal accounts for multi-instance); **Scheduled Transactions** trigger a **re-audit on every skill update** — no off-chain keeper.

> **♻️ Reuse advantage (your repos already ship this):** `cannes2026` (DIVE) + SPARK already have `create-account / create-topic / create-token / submit-message / schedule-transaction`, **HCS-2 / 11 / 20**, **HTS custom-fee auto-split**, agent register/discover, and **HCS-16 Flora** (reused here as the agents' **communication room**, not voting). Drop it straight in; the only new pieces are **HCS-26** (skills registry) + **HCS-25** (trust score).

**🌐 Ecosystem fit (Hashgraph Online):** MARS plugs directly into **Hashgraph Online's HCS-26 skill registry** — any skill registered there can be audited by MARS, and our verdicts + **HCS-25 trust scores** write back to it. **Adoption path:** Hashgraph Online could make MARS the **default audit / trust layer for the HCS-26 registry** (we don't reinvent the registry — we make it *safe*).

*Why it fits:* "agents discover services + x402 pay-per-request + verifiable HCS audit trails + HCS-14 agent identity." *(The HTS mint is the Hedera-Testnet operation that qualifies the track even though USDC settles on Arc.)*

### 🟩 World — anti-sybil & anti-manipulation trust layer · *Track B — World ID ($2,500)*
**Every agent is verified by World ID (proof of unique personhood).** Without it, the entire trust + payment layer is gameable. World ID guarantees three things:

1. **No sybil attacks** — one human = one identity, so no one can spin up a swarm of fake agents to flood the system (fake auditors, fake reviewers, fake licenses).
2. **No manipulated reviews / ratings** — reviewers are **one-human-one-rating + proof-of-use** (you must have licensed the skill to review it), so a scammer can't sybil-farm fake 5-stars on their own malware or bury competitors. *(Reviews rank quality; they never override the safety verdict.)*
3. **Only *paid* agents can actually use a verified skill** — the **HTS license** (proof of payment) *grants* access, and **World ID binds that license to one verified human-backed agent**, so a single paid license **can't be copied or shared across a swarm of freeloading bot agents** riding one purchase. Payment unlocks it; World ID stops sybil-sharing of that unlock.

| Actor | What World ID binds | What it stops |
|---|---|---|
| **Auditors** | one human = one auditor identity | sybil swarm of fake "SAFE" stamps |
| **Reviewers** | one human + proof-of-use = one rating | sybil / fake-review farms |
| **Users** | one human-backed agent per license | freeloading sybil swarm sharing one paid license |

*Why it fits:* "sybil-resistant voting / reputation and trust systems gated by personhood." Proof validation happens in the backend/contract.

### 🟧 Chainlink — verifiable verdicts · *Best Confidential AI Attester ($4,000)*
- The audit's verdict is produced/attested inside a **TEE via Chainlink's Confidential AI Attester** → a **cryptographic attestation** a smart contract **verifies and consumes** before the skill is marked VERIFIED + the HTS token is minted.
- This makes **"verified" trustless** — a developer (or a lazy auditor) **cannot forge a SAFE verdict**; the attestation proves it came from the real audit pipeline on that exact skill version.
- *(Optional: a **Chainlink CRE** workflow orchestrates the audit pipeline and triggers re-audits.)*

---

## 6. Architecture

```
  Developer's AGENT ─ posts skill + RFQ (scope / compliance) ─▶ MARKETPLACE (Next.js)
                                                     │
                                                     ▼
  AUDITOR AGENTS QUOTE ─▶ REQUESTING AGENT SELECTS (price × reputation × approach × bond) ─▶ BOND + x402 escrow (Arc)
       ↕ Flora room (HCS-16): requesting agent + auditor agents JOIN & NEGOTIATE the quote
                                                     ▼
  SELECTED AUDITOR — internal multi-agent pipeline (World-ID-verified):
    • Agent A — scans tool descriptions for injection
    • Agent B — runs the sandbox, watches network / files
    • Agent C — Foundry/Anvil fork + fake wallet → wallet-abuse check
    • Agent D — synthesizes evidence → verdict   (each test → HCS audit-trail topic, live)
                                                     │
                                                     ▼
  CHAINLINK Confidential AI Attester (TEE) ─ attests ─▶ verdict {SAFE/DANGEROUS, manifest}
                                                     │ contract verifies attestation
                                                     ▼
  HEDERA  ── HCS: verdict + audit trail (registry)  ── HTS: VERIFIED token + version license
                                                     │
                                                     ▼
  User AGENT ─ sees ✅ VERIFIED ─ pays Arc x402 (direct nanopayment) ─▶ mints HTS license ─▶ runs via VERIFIED LINK
                                  (dev + auditor earn)        │
                                                     ┌─────────┘
  WORLD ID gates every agent (auditors + reviewers)  ▼
  Scheduled Tx re-audits on update · bond slashed if a verdict is wrong
```

---

## ⚙️ Hedera Topic Map & Reuse Reference (built from DIVE + SPARK)

### Topic architecture (concrete)
```
MAIN REGISTRY TOPIC      memo "hcs-2:0:300"  (indexed, submit-key gated)     ← HCS-2 / HCS-26
  │  each verified skill = a `register` message → pointer to its ENTRY subtopic
  ▼
PER-SKILL ENTRY TOPIC    skill versions + verdict + HCS-1 manifest ref + HCS-25 trust score
PER-SKILL REVIEWS TOPIC  ratings / reputation as HCS-20 points (mint / burn)
RFQ / JOB BOARD          an HCS topic where each open REQUEST is posted; auditors submit QUOTES
                         → the USER AGENT SELECTS one → it bonds → audits
PER-AUDIT TRAIL TOPIC    every TEST / STEP the auditor runs = one HCS message to this topic id
                         → ordered, timestamped, immutable audit trail (replayable via Mirror Node)
FLORA ROOM (HCS-16)      a shared topic where the requesting agent + auditors join & TALK /
                         negotiate the quote (communication, NOT consensus)
AGENT IDENTITY           HCS-11 profile + HCS-14 universal agent id, per auditor
```

### Reuse map — code you already shipped (DIVE = `cannes2026`, + SPARK)
| MARS needs | Reuse from DIVE / SPARK | What it does |
|---|---|---|
| create a topic | `lib/hcs-standards.ts → createTopic(client, memo, submitKey)` | `TopicCreateTransaction().setTopicMemo().setSubmitKey()` |
| write to a topic | `submitMessage(client, topicId, msg)` | `TopicMessageSubmitTransaction` |
| read registry / verdicts | `readTopicMessages(topicId)` | Mirror Node `…/topics/{id}/messages`, base64-decode JSON |
| skill registry (main + sub) | `pages/api/hcs/hcs2.ts` + `buildHCS2Register/Update` | `register(registryTopicId, entryTopicId, memo)` → adds a skill |
| RFQ board + Flora comms | DIVE `register-agent` / `discover-agents` + `hcs16.ts` (as a chat room) + the topic helpers above | post requests, auditors quote, user agent selects one; agents talk in the Flora room |
| ratings / reputation | `pages/api/hcs/hcs20.ts` + `buildHCS20Mint/Burn` | auditable points per skill |
| verified token + license | `pages/api/hedera/create-token.ts` (`TokenCreateTransaction`) | mint HTS tokens |
| agent accounts | `pages/api/hedera/create-account.ts` | one Hedera account per agent |
| re-audit on update | `pages/api/hedera/schedule-transaction.ts` (+ SPARK `HederaScheduleService.sol`) | Scheduled Transactions — no keeper |

> **Reuse:** DIVE's agent infra — `createTopic` / `submitMessage` / `readTopicMessages`, `register-agent` / `discover-agents`, **HTS custom-fee auto-split**, **Scheduled Transactions** — drops straight into MARS's **RFQ job board + Flora communication room**. *(DIVE's HCS-16 Flora is reused as the agents' chat / coordination room — not a voting committee; selection is a simple accept-a-quote, not commit-reveal.)* Only genuinely new Hedera work = **HCS-26** (skills registry) + **HCS-25** (trust score).

### HTS spec
- **VERIFIED token** — minted per skill when it passes; proves "this skill is verified."
- **Version license token** — the agent mints it (pays x402) to use a specific audited version; goes stale after the next update.
- **Author royalty via custom fee** — attach a `CustomRoyaltyFee` / `CustomFractionalFee` to the license token so every transfer **auto-routes a cut to the author** (Hedera-native; complements the Arc Advanced-Stablecoin-Logic split). Pattern: `new TokenCreateTransaction().setCustomFees([ royaltyFee ])` — **DIVE already uses custom-fee auto-split** on its outcome tokens, so reuse that.

---

## ✅ Implemented (this build) — Hedera module + agent-registration flow

A working Hedera-testnet implementation lives in `lib/`, `pages/api/`, `pages/hedera.tsx`, and `scripts/`. Hand-rolled JSON envelopes + Mirror Node reads (DIVE/SPARK style), `@hashgraph/sdk` only.

### The headline flow — register an agent
1. **Create a Hedera account** → take its **EVM address**.
2. **Register that EVM in World AgentBook** via the official `npx @worldcoin/agentkit-cli register <evm>` → scan the QR with the World App → poll AgentBook (`checkAgentHuman`) until it resolves to a human.
3. **Finish the agent** → it gets its **own** voting HCS + review HCS + HCS-11 profile; the profile is bound to the account memo (`hcs-11:hcs://1/<topic>`); the key is stored **AES-256-GCM encrypted**; and an `agent_registered` entry (with `world_verified` + `human_id`) is logged into the **seeded main HCS registry**.

Topic structure: **one seeded main HCS** (the append-only history of `agent_registered`) → **per agent: account + profile + voting + review topics**.

### Run it
- **Web:** `npm run dev` → `/hedera` → **⚡ Generate** an agent → the AgentBook QR renders on the page → scan → it finishes; then **👍/👎 vote** + **review** any agent (each on that agent's own HCS).
- **CLI / Claude Code skill:** `npx tsx scripts/register-agent.ts auditor` (or `/register-agent auditor`) → renders the verify QR in the terminal, polls every 3s, finishes.

### Where it lives
| File | What |
|---|---|
| `lib/hedera.ts` | client · account · HTS NFTs · HCS-1/2/11/14/16/18/20/25/26 builders · reputation/voting/reviews + main-registry replay · audit trail · scheduled re-audit |
| `lib/agents.ts` | `registerAgent` (the flow above) + `initMars` (seeded main registry) |
| `lib/agentbook.ts` | World AgentBook registration via `@worldcoin/agentkit-cli` + poll |
| `lib/encrypt.ts` · `lib/state.ts` | AES-256-GCM agent-key encryption · seeds the main registry to `mars-state.json` |
| `pages/api/hedera.ts` | one `POST { action, … }` route exposing every capability |
| `pages/api/register-agent-stream.ts` | SSE stream: account → AgentBook (scan) → finish, step by step |
| `pages/hedera.tsx` | the demo UI |
| `scripts/` + `.claude/skills/register-agent` | the register-agent CLI (`new-account` + `finish-agent`) + Claude Code skill |

### Env (`.env.local`)
`HEDERA_OPERATOR_ID`, `HEDERA_OPERATOR_KEY` (always); `NEXT_PUBLIC_WORLD_APP_ID`, `NEXT_PUBLIC_RP_ID`, `RP_SIGNING_KEY` for the World AgentBook scan.

---

## ✅ Implemented (this build) — negotiation room + audited-skill flow

The second half of the loop lives in `/chatroom` (web), `scripts/run-task.ts` (CLI / `/run-task` skill), and new `/api/hedera` actions. An autonomous **requester agent** hires the **auditor agent**, the skill is vetted by a **real LLM audit pipeline**, and the whole lifecycle is written to HCS — ending in a **VERIFIED HTS NFT** for a clean skill.

### The headline flow — post → negotiate → escrow → audit → settle/slash
1. **Post the task (Hedera first).** A per-task HCS topic is opened immediately with an `init` manifest (status **`posted`** = created, *not started*) carrying the skill content (inline, or offloaded to **HCS-1** when >1 KB), payer/auditor, scope, and asking terms — so the task is visible on-chain before any talk. Registry `job_posted("open")`.
2. **Negotiate (HCS-16 chat room).** The requester posts an ask; the **auditor's quote is generated by OpenAI** (auditor only — `lib/auditor.ts`, default `gpt-5.4-nano-2026-03-17`, constrained, pinned to a **1 USDC** fee); the requester accepts. Every line is a real HCS-16 message in one global room.
3. **Lock the escrow on Arc (x402 / Circle USDC).** Both sides fund **MarsEscrow** on Arc — developer locks the **fee**, auditor posts the **bond** (`0.1 / 0.1` demo, `createJob → fundFee → postBond → Funded`). *Only once the money is in* does the Hedera task advance: an `escrow_funded` receipt + registry `job_updated("funded")` = **task started**. Fail-soft if Arc isn't configured.
4. **Audit (real, 4 OpenAI stages).** `lib/audit-core.mjs` runs **Scanner → Sandbox → Fork → Synthesizer** over the actual source. Each stage → the task topic (summary + findings + severity histogram); the verdict carries `risk`, a 0–100 trust score, **`capabilities` ("what the skill actually does")**, and a recommendation; the full report → **HCS-1**. *(No `OPENAI_API_KEY` → deterministic fallback so the demo never breaks.)*
5. **Decide → review → mint.** The requester **approves** (SAFE) or **blocks** (DANGEROUS); rates + reviews the auditor (auditor's own **review** + **HCS-20 voting** topics → reputation); an approved SAFE skill mints a **VERIFIED HTS NFT** to the requester.
6. **Settle or slash the escrow.** Approve → **settle** (`release` → fee + bond → auditor). Block → **slash** (`slash` → bond → the auditor that caught it, fee refunded → developer). Recorded as `escrow_resolved` on the task topic + registry `job_updated(verified/rejected)`.

The task topic is the full replayable record: `init(posted) → escrow_funded → 3 stages → verdict → decision → reviewed → minted → escrow_resolved`.

### Use a verified skill — NFT-gated x402 nanopayment (`/api/use-skill`)
The **VERIFIED NFT is the license.** To use a skill, `pages/api/use-skill.ts` checks whether the account holds the NFT for it: **holds it → free**; **doesn't → `402`**, pay **0.01 USDC** via an x402 **Circle Gateway nanopayment** (gas-free, from the `gw` balance) and a fresh VERIFIED NFT is **minted to the buyer** — so pay once, own the license, free forever after. (License on Hedera, payment on Arc.)
```
curl ".../api/use-skill?skill=safe-weather-skill&account=0.0.9227937"        # holder → granted, free
curl ".../api/use-skill?skill=safe-weather-skill&account=0.0.9227928&pay=1"  # non-holder → pay (gw) → mint NFT → granted
```

### Run it
- **Web:** `npm run dev` → `/chatroom` → pick a skill → **Negotiate + audit** (one click: nego → auto-create task → real audit) → rate the auditor → **Approve** (SAFE → mints the NFT) / **Disapprove** (blocks).
- **CLI / Claude Code skill:** `npx tsx scripts/run-task.ts poisoned-pdf-skill` (or `/run-task <skill>`) — prints the nego, the live audit stages, the verdict + capabilities, and the review + minted NFT, all with HashScan links.

### Demo skills (`demo/skills/`)
`safe-weather-skill` + `price-checker.js` (clean → **SAFE**) · `poisoned-pdf-skill` (description-injection + credential exfil) + `evil-mcp.json` (tool-poisoning + `setApprovalForAll`) (→ **DANGEROUS**, blocked, no NFT).

### Where it lives
| File | What |
|---|---|
| `pages/chatroom.tsx` | the negotiation room + audit-trail + decision/review/mint UI |
| `lib/auditor.ts` | the auditor's OpenAI quote (auditor only; 1 USDC; fallback-safe) |
| `lib/audit-core.mjs` · `lib/skill-source.mjs` | the real 4-stage audit pipeline + skill-source resolver |
| `lib/audit-task.ts` | `auditTaskToHcs` (run audit → record on HCS + HCS-1 + registry) · `finalizeTaskToHcs` (decision → review → mint NFT) |
| `lib/task-flow.ts` | the **one** shared flow (CLI + curl): post → negotiate → escrow → audit → decide → settle/slash |
| `hardhat/contracts/MarsEscrow.sol` · `lib/escrow.ts` · `lib/escrow-server.ts` | the **Arc x402 escrow** — `createJob`/`fundFee`/`postBond`/`release`/`slash`; `openAndFundEscrow` + `resolveEscrow`/`slashEscrow` (two keys: `ARC_PRIVATE_KEY` dev, `SELLER_PRIVATE_KEY` auditor) |
| `lib/x402.ts` · `pages/api/{skill,buy-skill}.ts` | Circle Gateway / x402 nanopayment (the gas-free `gw`-balance pay-per-use leg) |
| `pages/api/use-skill.ts` | **NFT-gated** use: holds the VERIFIED NFT → free; else `402` → pay 0.01 USDC (gw nanopayment) → mint the NFT to the buyer |
| `lib/demo-skills.ts` · `lib/demo-skills-loader.ts` | shared demo data (fixed personas, skills, nego helpers) + file/folder skill loader |
| `pages/api/hedera.ts` · `pages/api/run-task.ts` | the `POST{action}` route · the streaming `curl -N` task-flow endpoint |
| `pages/test.tsx` | manual Arc escrow + x402 playground (create draft → fund fee → post bond → release/slash) |
| `scripts/{run-task,test-escrow,test-draft,test-x402}.ts` | the flow + Arc escrow / x402 test scripts (`tsx scripts/test-escrow.ts check` = read-only key/balance diagnostic) |

### Env (additions)
`OPENAI_API_KEY` (the OpenAI auditor + audit pipeline; absent → deterministic fallback). Optional: `OPENAI_MODEL` (auditor quote, default `gpt-5.4-nano-2026-03-17`), `AUDIT_MODEL` (audit pipeline, default `gpt-4o-mini`), `PHALA_ATTESTOR_URL` (seal the audit in a TDX quote).
**Arc payments (x402 escrow + nanopayments):** `ARC_PRIVATE_KEY` (developer/requester — funds the fee + the x402 buyer), `SELLER_PRIVATE_KEY` (auditor/seller — posts the bond + receives the settle payout; omit → single-key fallback), optional `ARC_DEVELOPER_KEY`, `ESCROW_FEE_USDC`/`ESCROW_BOND_USDC` (override the 0.1/0.1 demo amounts). Fund both Arc accounts with testnet USDC at **faucet.circle.com** (USDC is also Arc's native gas token). Absent → the Arc leg is skipped (audit + NFT still run).

---

## 7. Tech Stack

| Layer | Tools |
|---|---|
| Marketplace / dashboard | Next.js + viem/wagmi |
| Auditor (compete; winner runs it) | internal multi-agent pipeline (TS) · Docker sandbox · Foundry/Anvil fork · description-injection scanner |
| Verifiable verdict | **Chainlink Confidential AI Attester (TEE)** (+ optional CRE workflow) |
| Registry + proof | **Hedera** — HCS-26 (skills registry) · HCS-25 (trust score) · HCS-2 (main+subtopics) · HCS-1 (reports) · HCS-18 (RFQ board / discovery) · HCS-16 (Flora comms room) · HCS-11/14 (agent id) · HCS-20 (ratings) · **HTS** (verified token + license + royalty custom-fee) · **Scheduled Transactions** (re-audit) · `createAccount` |
| Payments | **Arc / Circle x402** (USDC) — escrow, bonds, licenses · Circle Gateway (any-chain funding) |
| Identity / anti-sybil | **World ID** (auditors + reviewers, validated in backend) |
| Agent interface | **MCP tool** — agents call MARS (`check(skill)`) before installing |
| Verified delivery | **content-pinned verified link** — serves the exact audited build; the raw outside skill = unverified |

---

## 8. Why this isn't "just npmguard"
npmguard is a **free scanner + on-chain registry for npm *code***. MARS is a **marketplace + security registry for agent *skills***:
- **Different target/attack** — agent skills/MCP: poisoned *descriptions*, declared-vs-actual behavior, wallet abuse (a code-scanner can't see these).
- **An economy, not a free oracle** — developers earn, agents pay x402, auditors stake + earn.
- **Agent-native** — a *competitive* swarm of auditor *agents*, consumer *agents* buying, MARS itself an MCP skill.
- **Provable trust** — Chainlink-attested verdicts + World-ID anti-sybil, not "trust our platform."
- **Verified by *access*, not by claim** — a skill counts as verified only when run through MARS's **content-pinned verified link**; the raw outside copy carries no guarantee (so a rug-pull v2 can't ride the verified badge).

---

## 9. Demo (≤ 3 min)

> **🎤 Pitch reminder — lead with the AUTONOMY, not the plumbing.** MARS is an **agent-to-agent economy**: a consumer agent, *on its own*, hires from a **competing swarm of auditor agents**, negotiates in a Flora room, pays per-use via x402, and trusts only an attested verdict — **no human in the loop on the standard path**. Pitch the *decisions agents make* (who to hire · what to pay · what to trust), frame every actor as an **autonomous agent**, and keep humans at the edges (premium SOC-2 only). Open the demo out loud with: *"Everything you're about to see is agents transacting with agents — MARS is the App Store agents run themselves."* Narrate each step from the **agent's** POV ("an agent needs a price feed →…"), not the developer's.

1. A **developer's agent** posts a clean **"Price Checker"** + RFQ → **auditor agents quote**, negotiate in the Flora room → the dev's agent **picks one** (price × reputation) → the winner verifies (coingecko only) → **✅ VERIFIED** on HCS, **HTS verified token** minted.
2. A **consumer agent** needs a price feed → sees **✅ VERIFIED** → pays **Arc x402 (direct nanopayment)** → mints the **HTS license** → runs it through the verified link.
3. A **developer's agent** posts a poisoned **"Portfolio Helper"** → the **auditor agent's** sandbox catches it read keys + call `setApprovalForAll` → **🟥 DANGEROUS** → blocked. *(Show: `npm audit` says it's clean; MARS catches it.)*
4. Show the **Chainlink attestation** verifying on-chain (verdict can't be forged), the **auditor's rating rise** for the clean call, and an **auditor getting slashed** (bond + reputation) for a wrong one.

---

## 10. Build Plan (36h, 4 people) — protect the core
**Core loop = post → audit (sandbox) → attested verdict on HCS → mint HTS → pay x402 to license.** Ship that first.
- **Dev A** — the RFQ board (post → quote → select) + Flora comms room + the selected auditor's pipeline (sandbox + scanners + fork) → verdict + per-test HCS audit trail.
- **Dev B** — Hedera HCS registry + HTS verified-token/license + the agent-side MCP `check()` client.
- **Dev C** — Arc x402 escrow + bonds + license payments + revenue split.
- **Dev D** — World ID (auditor + reviewer verification) + Chainlink attestation hookup + marketplace UI + demo.

**Roadmap (pitch verbally, don't build in 36h):** see **§12 — Future Enhancements** (negotiated compliance tiers, multi-auditor consensus, re-audit on update, challenge windows, stake-to-endorse, bounties).

---

## 11. One-liner
> **MARS is the App Store for AI-agent skills: a swarm of staked, World-ID-verified auditors *competes* to vet each skill, Chainlink attests the winner's verdict, Hedera records it + mints a "verified" token, and agents pay-per-version via Arc x402 to use only the skills that passed — so an autonomous agent never installs something that drains its wallet.**

---

## 12. Future Enhancements (the vision to pitch)
*MVP = the RFQ board + a single selected auditor. The story of where it goes:*

- **Negotiated audit marketplace** — the developer's agent negotiates not just **rate + time + scope**, but the required **professionalism & compliance** (e.g. **SOC 2 / enterprise / ISO**); certified audit firms quote for premium jobs and the agent picks the auditor.
- **Open Flora rooms (HCS-16)** — a shared space where any AI agent (auditors, requesters, even outside agents) can **join & talk** — discover requests, clarify scope, negotiate quotes, coordinate — turning the marketplace into a live multi-agent venue. *(Reused for communication, not voting.)*
- **Multi-auditor consensus (corroboration)** — for high-value skills, several auditors independently audit and must **agree** before VERIFIED; disagreement escalates. *(Far-future; the MVP is single-auditor RFQ, not voting.)*
- **Automatic re-audit on update** — a Hedera **Scheduled Transaction** re-triggers the audit when a skill ships a new version; the old license token goes stale.
- **Challenge windows + disputes** — anyone can challenge a live verdict by re-running it; the losing side is **slashed**.
- **Stake-to-endorse reputation** + **on-demand attack-vector bounties** ("pay an auditor to check exploit X against this skill").