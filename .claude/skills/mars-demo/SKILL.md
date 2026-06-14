---
name: mars-demo
description: Run the FULL MARS task flow end-to-end as a narrated, on-camera simulation — two AI agents (a requester + a staked auditor) do a real deal: post the task to Hedera, negotiate, both lock USDC into the Arc escrow, run the real 4-stage OpenAI audit, mint a VERIFIED NFT (or block + slash the bond), then settle/slash on Arc. Everything is genuinely on-chain (Hedera HCS + Arc USDC); only the two agents are simulated. Built for recording a demo video — Claude hosts and narrates each phase while the real flow streams.
argument-hint: [poisoned-pdf-skill|evil-mcp.json|safe-weather-skill|price-checker.js]
arguments: [skill]
allowed-tools: Bash(npx:*)
disable-model-invocation: true
---

# MARS — live agent-to-agent audit, on camera

You are the **host of a live demo video**. Two autonomous AI agents are about to do a real deal
with real money and a real on-chain trail, and **no human in the loop**. Your job is to set the
scene, run the real flow, and narrate each phase as it streams so a viewer understands what's
happening. The negotiation agents are *simulated*; everything they touch — **Hedera HCS topics,
Arc testnet USDC, the HTS NFT** — is **genuinely on-chain**. That contrast ("simulated agents,
real infrastructure") is the whole point — say it out loud.

The cast:
- **Requester `0.0.9227937`** — a World-ID-verified agent that wants to install a skill, but won't
  run unaudited code.
- **Auditor `0.0.9227928`** — a World-ID-verified, **staked** auditor agent. It posts a bond; if it
  clears malware it loses that bond. Skin in the game.

## Do this in ONE turn

### 1 · Cold open (before running anything)
In 2–3 lines, set up the stakes for the camera: an AI agent is about to install a third-party
skill; 36% of agent skills carry prompt-injection / tool-poisoning; MARS makes a **staked auditor
agent** vet it first, and records the whole verdict + the money on-chain. Then say which skill
we're about to put on trial (see the skill table below) and what it *claims* vs what it might
*actually* do.

### 2 · Run the real flow
Run the actual on-chain task flow with a **generous Bash timeout (300000 ms)** — the audit is a real
4-stage OpenAI pipeline plus live HCS submits, so it takes a minute or two:

```
npx tsx scripts/run-task.ts $skill
```

- If `$skill` is empty, **default to `evil-mcp.json`** — the "get token price" MCP that secretly
  drains the wallet. It's the most cinematic (the auditor catches it → the bond gets slashed).
- Run it **once, in the foreground**, and let its colored output stream into the transcript.

### 3 · Narrate the 8 phases as they stream
The script prints each phase. As each one lands, narrate it in one plain-English beat for the
viewer (don't just dump the log). The phases, in order:

| # | On-screen | Say roughly |
|---|-----------|-------------|
| 1 | `TASK POSTED` (status: posted) | The requester opens a per-task **Hedera HCS topic** and posts the skill for audit — visible on-chain, *not started yet*. |
| 2 | `NEGOTIATION ROOM` (HCS-16) | The two agents negotiate in a shared on-chain room — the auditor's quote is **AI-generated live**; the requester accepts. |
| 3 | `ARC ESCROW` (fee + bond locked) | **Money moves.** Both sides lock **real Arc USDC** into `MarsEscrow` — the developer funds the fee, the **auditor posts its bond**. Only now does the Hedera task flip `posted → funded` (= started). |
| 4 | `AUDIT` (Scanner→Sandbox→Fork→Synthesizer) | The **real 4-stage audit** runs — each stage is a live OpenAI call, sealed with a **Phala TDX attestation**, and every stage is written to the HCS task topic. This is where it catches the poisoning. |
| 5 | `verified / flagged` | SAFE → the versioned skill is saved + the requester whitelisted; DANGEROUS → nothing gets installed. |
| 6 | `APPROVED / BLOCKED` + `VERIFIED NFT` | The requester's decision is recorded; on SAFE a **VERIFIED HTS NFT** (the license) is minted to the requester. |
| 7 | auditor `★★★★★` + comment | The auditor is rated + commented on its own HCS review/voting topics (AI-written comment). |
| 8 | `ESCROW SETTLED / SLASHED` | **The payoff.** SAFE → **settle**: fee + bond → the auditor (it did honest work). DANGEROUS → **slash**: the bond → the auditor that *caught it*, and the fee is **refunded to the developer**. |

### 4 · Close
Read back the proof, with the HashScan + Arc explorer links the script printed:
- the **task topic** (the full replayable trail), the **negotiation room**, the **verdict**
  (SAFE / DANGEROUS) + trust score,
- the **Arc escrow** outcome (settled or slashed, with the tx link),
- the **VERIFIED NFT** (HashScan link) if one was minted.

End on the line: *the verdict, the audit trail, and the money are all on-chain — anyone can replay it.*

## The skills you can put on trial

| arg | claims to | actually does | ends |
|-----|-----------|---------------|------|
| `evil-mcp.json` | "get token price" (CoinGecko MCP) | hidden `setApprovalForAll(0x…dEaD)` → **drains the wallet** + uploads the Solana keypair | **DANGEROUS → slash** |
| `poisoned-pdf-skill` | "extract text from PDFs" | reads `~/.ssh/id_rsa` + `~/.aws/credentials` → POSTs them to `collector.evil.example`, parses 0 pages | **DANGEROUS → slash** |
| `price-checker.js` | "token price from CoinGecko" | exactly that — read-only, no secrets, no wallet | **SAFE → settle + NFT** |
| `safe-weather-skill` | "weather + forecast" | read-only HTTPS to Open-Meteo, nothing else | **SAFE → settle + NFT** |

## For the strongest video (recommended)
Run **two** back-to-back so the audience sees both money outcomes:
1. `evil-mcp.json` → the auditor **catches** the wallet-drainer → **BLOCKED**, bond **slashed** to the auditor, dev refunded.
2. `price-checker.js` → a clean skill → **APPROVED**, **VERIFIED NFT** minted, escrow **settled** to the auditor.

Do them as two separate runs (two `npx tsx scripts/run-task.ts …` calls), narrating each. The
contrast — *a slash and a settle* — is the money shot.

## Notes
- Needs `.env.local`: `OPENAI_API_KEY` (the audit is real — it throws without it), `HEDERA_OPERATOR_ID`/`KEY`.
- The Arc escrow leg is **fail-soft**: with `ARC_PRIVATE_KEY` (developer) + `SELLER_PRIVATE_KEY` (auditor)
  funded with a little testnet USDC, you get a real settle/slash on-camera; without them the flow still
  runs and just skips the money leg (narrate it as "payment leg not configured").
- It reuses the seeded registry + chat room from `mars-state.json`; each run appends a fresh task topic, so you can record as many takes as you want.
- Don't run the audit on a random GitHub URL on camera unless you mean to — the demo skills are curated to tell the story cleanly and don't burn extra OpenAI budget.
