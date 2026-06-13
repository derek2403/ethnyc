# Warden — The Audit Marketplace for AI-Agent Skills
### *Buy a skill you can trust with your wallet.*

> AI agents now hold wallets and install **skills / MCP tools** to act — but those skills are unvetted, and a poisoned one can drain the agent. **Warden is a marketplace where a swarm of staked, World-ID-verified auditors *competes* to audit each skill, the winner's verdict is attested on-chain, and agents pay-per-version to use only the skills that passed.**

**ETHGlobal New York 2026** · Tracks: **Arc** · **Hedera** · **World** · **Chainlink**

*(Working name — rename freely.)*

---

## 1. The Problem

AI agents (OpenClaw, ElizaOS, Claude, any MCP-compatible agent) gain abilities by **installing skills / MCP tools** — and they install them from open, unvetted sources. This is a named, CVE'd, actively-exploited attack surface:

- **Tool poisoning** — hidden instructions inside a tool's *description* that hijack the agent (OWASP "MCP Tool Poisoning"; `CVE-2025-54136`, `CVE-2025-54135`).
- **Capability mismatch** — a "price checker" that also reads your keys / calls `setApprovalForAll` (real: a poisoned tool made Cursor read `~/.ssh`; Supabase's agent exfiltrated tokens).
- **Supply-chain RCE** — `CVE-2025-6514` (`mcp-remote`, 558k downloads → full system compromise).
- **Rug-pull updates** — clean v1, malicious v2.

**The concrete harm:** one poisoned skill = a **drained wallet, stolen API keys, and leaked secrets** — and the agent does it *to itself*, trusting a tool it never vetted. **There is no App Store, no review, no trust layer for the skills agents depend on.** Warden is that layer — it stops the skill **before** it can drain the wallet or steal the keys.

---

## 2. The Actors

| Actor | Role |
|---|---|
| **Developer** (skill creator) | Posts their skill + a **request for quotation** — the **scope** (what to check) and required **compliance level**; reviews the auditors' **quotes**, accepts one, and pays that fee into escrow; earns when users license their verified skill. |
| **Auditor** (a swarm that *quotes*) | A swarm of **independent, World-ID-verified** auditors that **submit quotes** (price + approach) for each open request. The one the requesting agent **selects** posts a **bond** and runs the audit (internally a scanner → sandbox → fork → synthesizer pipeline); it's paid the fee and **slashed** if its verdict is later proven wrong. |
| **User** (consumer agent) | Discovers **verified** skills, pays to use them (Arc x402 → HTS license), and can leave **World-ID-gated, proof-of-use reviews**. |

---

## 3. How It Works (the flow)

```
1. REQUEST (RFQ)   Developer posts a skill + a REQUEST FOR QUOTATION — the SCOPE (what to check),
                   TIME, and required PROFESSIONALISM / COMPLIANCE level (e.g. SOC 2 / enterprise).

2. QUOTE           World-ID-verified auditors respond with QUOTES — their RATE + approach.
                   ⤷ Flora room (HCS-16): the requesting agent + auditors (inside or outside the
                     job) JOIN & TALK here — clarify scope, negotiate the quote — see §12.

3. SELECT+ESCROW   The requesting (USER) AI agent reviews the quotes and SELECTS one. The chosen
                   auditor ties a BOND; the x402 escrow opens on Arc holding the dev's fee + bond.

4. AUDIT (TEE)     The SELECTED auditor runs the skill in a sandbox INSIDE a TEE — observing
                   DECLARED vs ACTUAL behavior (network / files / wallet) + scanning descriptions
                   for injection. EACH TEST / STEP is POSTED LIVE as an HCS message to that skill's
                   AUDIT-TRAIL TOPIC ID → an immutable, ordered, timestamped trail anyone can replay.

5. ATTEST          The verdict is attested by the Chainlink Confidential AI Attester (TEE) →
                   a cryptographic attestation a contract verifies (so "verified" is provable).

6. RECORD + LINK   Attested verdict + capability manifest → Hedera HCS registry; the skill is minted
                   a Hedera HTS "VERIFIED" token → ✅ VERIFIED. Warden issues a SPECIAL VERIFIED LINK
                   that serves the EXACT audited version (content-pinned to its hash).
                   (🟥 DANGEROUS skills are flagged & blocked; the dev's fee is spent either way.)

7. BUY / USE       Any other user/agent sees the verified skill and PAYS (Arc x402) to use it
                   → mints an HTS LICENSE → gets the VERIFIED LINK and runs the skill THROUGH it.
                   ⚠ Using the original OUTSIDE skill direct = UNVERIFIED (no guarantee it matches
                     what we audited); only Warden's link serves the attested, version-pinned build.
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

**Audit tiers — the developer requests a tier; auditors quote against it:**
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
All money moves as **x402 USDC on Arc** — **nanopayments** for micro-amounts, or **simple omnichain x402** (fund from any chain via Circle Gateway → Arc as the liquidity hub):
- **Audit-fee escrow**, **auditor bonds**, and **per-version license payments** all settle here in USDC.
- **Author royalty = Advanced Stablecoin Logic:** when the payer is the **author** (self-publishing + first to verify their own skill), they're registered as creator and earn a **programmable royalty split** on every future license. A **non-author** requesting an audit pays a **plain x402 payment, no royalty**.
- *Why it fits:* "agents make gas-free micropayments / agent marketplaces" (**Agentic Economy**) + "programmable royalty / conditional split / multi-step settlement" (**Advanced Stablecoin Logic**) + "chain-abstracted USDC" via Gateway (**Chain-Abstracted USDC** — a 3rd Arc shot).

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
| Standard | Use in Warden |
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

**🌐 Ecosystem fit (Hashgraph Online):** Warden plugs directly into **Hashgraph Online's HCS-26 skill registry** — any skill registered there can be audited by Warden, and our verdicts + **HCS-25 trust scores** write back to it. **Adoption path:** Hashgraph Online could make Warden the **default audit / trust layer for the HCS-26 registry** (we don't reinvent the registry — we make it *safe*).

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
  Developer ─ posts skill + RFQ (scope / compliance) ─▶ MARKETPLACE (Next.js)
                                                     │
                                                     ▼
  AUDITORS SUBMIT QUOTES ─▶ USER AGENT SELECTS ONE ─▶ ties BOND + opens x402 escrow (Arc)
       ↕ Flora room (HCS-16): agents join & talk / negotiate the quote
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
  User/agent ─ sees ✅ VERIFIED ─ pays Arc x402 ─▶ mints HTS license ─▶ runs skill via VERIFIED LINK
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
| Warden needs | Reuse from DIVE / SPARK | What it does |
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

> **Reuse:** DIVE's agent infra — `createTopic` / `submitMessage` / `readTopicMessages`, `register-agent` / `discover-agents`, **HTS custom-fee auto-split**, **Scheduled Transactions** — drops straight into Warden's **RFQ job board + Flora communication room**. *(DIVE's HCS-16 Flora is reused as the agents' chat / coordination room — not a voting committee; selection is a simple accept-a-quote, not commit-reveal.)* Only genuinely new Hedera work = **HCS-26** (skills registry) + **HCS-25** (trust score).

### HTS spec
- **VERIFIED token** — minted per skill when it passes; proves "this skill is verified."
- **Version license token** — the agent mints it (pays x402) to use a specific audited version; goes stale after the next update.
- **Author royalty via custom fee** — attach a `CustomRoyaltyFee` / `CustomFractionalFee` to the license token so every transfer **auto-routes a cut to the author** (Hedera-native; complements the Arc Advanced-Stablecoin-Logic split). Pattern: `new TokenCreateTransaction().setCustomFees([ royaltyFee ])` — **DIVE already uses custom-fee auto-split** on its outcome tokens, so reuse that.

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
| Agent interface | **MCP tool** — agents call Warden (`check(skill)`) before installing |
| Verified delivery | **content-pinned verified link** — serves the exact audited build; the raw outside skill = unverified |

---

## 8. Why this isn't "just npmguard"
npmguard is a **free scanner + on-chain registry for npm *code***. Warden is a **marketplace + security registry for agent *skills***:
- **Different target/attack** — agent skills/MCP: poisoned *descriptions*, declared-vs-actual behavior, wallet abuse (a code-scanner can't see these).
- **An economy, not a free oracle** — developers earn, agents pay x402, auditors stake + earn.
- **Agent-native** — a *competitive* swarm of auditor *agents*, consumer *agents* buying, Warden itself an MCP skill.
- **Provable trust** — Chainlink-attested verdicts + World-ID anti-sybil, not "trust our platform."
- **Verified by *access*, not by claim** — a skill counts as verified only when run through Warden's **content-pinned verified link**; the raw outside copy carries no guarantee (so a rug-pull v2 can't ride the verified badge).

---

## 9. Demo (≤ 3 min)
1. Developer posts a clean **"Price Checker"**, picks a quick audit → the winning auditor verifies (coingecko only) → **✅ VERIFIED** on HCS, **HTS verified token** minted.
2. A user agent pays **Arc x402** → mints the **HTS license** → uses it.
3. Developer posts a poisoned **"Portfolio Helper"** → the auditor's sandbox catches it read keys + call `setApprovalForAll` → **🟥 DANGEROUS** → blocked. *(Show: `npm audit` says it's clean; Warden catches it.)*
4. Show the **Chainlink attestation** verifying on-chain (verdict can't be forged) and an **auditor getting slashed** for a wrong call.

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
> **Warden is the App Store for AI-agent skills: a swarm of staked, World-ID-verified auditors *competes* to vet each skill, Chainlink attests the winner's verdict, Hedera records it + mints a "verified" token, and agents pay-per-version via Arc x402 to use only the skills that passed — so an autonomous agent never installs something that drains its wallet.**

---

## 12. Future Enhancements (the vision to pitch)
*MVP = the RFQ board + a single selected auditor. The story of where it goes:*

- **Negotiated audit marketplace** — the developer negotiates not just **rate + time + scope**, but the required **professionalism & compliance** (e.g. **SOC 2 / enterprise / ISO**); certified audit firms quote for premium jobs and the developer picks the auditor.
- **Open Flora rooms (HCS-16)** — a shared space where any AI agent (auditors, requesters, even outside agents) can **join & talk** — discover requests, clarify scope, negotiate quotes, coordinate — turning the marketplace into a live multi-agent venue. *(Reused for communication, not voting.)*
- **Multi-auditor consensus (corroboration)** — for high-value skills, several auditors independently audit and must **agree** before VERIFIED; disagreement escalates. *(Far-future; the MVP is single-auditor RFQ, not voting.)*
- **Automatic re-audit on update** — a Hedera **Scheduled Transaction** re-triggers the audit when a skill ships a new version; the old license token goes stale.
- **Challenge windows + disputes** — anyone can challenge a live verdict by re-running it; the losing side is **slashed**.
- **Stake-to-endorse reputation** + **on-demand attack-vector bounties** ("pay an auditor to check exploit X against this skill").
