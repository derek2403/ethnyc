---
name: run-task
description: Run the MARS negotiation + audit-task flow from the CLI for a demo skill. Posts the simulated 3-line quote chat to the real HCS-16 room, creates the per-task HCS topic (init = skill content + agreed terms), then appends the audit pipeline (scanner→sandbox→fork→synthesizer→verdict). Mirrors the /chatroom page in the terminal.
argument-hint: [poisoned-pdf-skill|evil-mcp.json|safe-weather-skill|price-checker.js]
arguments: [skill]
allowed-tools: Bash(npx:*)
disable-model-invocation: true
---

# Run a MARS audit task — simulated chat + on-chain task trail, in the terminal

Do this in ONE turn:

1. Run `npx tsx scripts/run-task.ts $skill` with a generous Bash timeout (120000 ms).
   - If `$skill` is empty, run `npx tsx scripts/run-task.ts` first (no arg) — it prints the
     available demo skills — then pick the one the user named (default `poisoned-pdf-skill`).

2. The script prints, and posts on-chain to Hedera testnet, in order:
   - the **negotiation** (requester ask → auditor quote → accept) as real HCS-16 messages in the
     one global chat room (the same room the `/chatroom` page shows),
   - the **task topic** it creates (`init` carries the skill content + agreed price/scope/bond/time),
   - the **audit pipeline** steps + the **verdict** (SAFE / DANGEROUS), each a message on the task topic.

3. Report back the chat-room topic, the task topic, and the verdict, with their HashScan links
   (the script prints them). The poisoned skills (`poisoned-pdf-skill`, `evil-mcp.json`) end DANGEROUS;
   the clean ones (`safe-weather-skill`, `price-checker.js`) end SAFE.

Notes: needs `HEDERA_OPERATOR_ID` / `HEDERA_OPERATOR_KEY` in `.env.local`. It reuses the seeded
registry + chat room from `mars-state.json`; each run appends a fresh task topic.
