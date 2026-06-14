---
name: register-agent
description: Register a MARS agent. Creates the Hedera account, hands the user the one-line World AgentBook command to scan, then AUTO-WAITS (polls AgentBook every 3s) and finishes the agent on its own — no further input needed.
argument-hint: [auditor|user]
arguments: [role]
allowed-tools: Bash(npx:*)
disable-model-invocation: true
---

# Register a MARS agent — user scans, the skill waits & finishes automatically

Do all of this in ONE turn, in order:

1. Run `npx tsx scripts/new-account.ts`. It creates the Hedera account and prints `EVM=…` and `COMMAND=…`.

2. Show the user the `COMMAND=` line as a single copy-paste block and tell them to run it in their own terminal and scan the QR, e.g.:
   ```bash
   npx @worldcoin/agentkit-cli register 0x<evm-from-output>
   ```
   Tell them: "Scan the QR — I'll wait and finish automatically, no need to tell me to continue."

3. **Immediately** run `npx tsx scripts/finish-agent.ts $role` **with a long Bash timeout (240000 ms)**. This polls World AgentBook every 3 seconds until the user's scan registers the agent, then finishes it (its own voting + review HCS + profile + memo + `agent_registered` into the main HCS). It auto-continues — do NOT wait for the user to say "go".

4. When step 3 finishes, report the account + voting/review/profile topic ids and the World verified/unverified status.

Notes: do NOT run the `agentkit-cli register` command yourself (the user scans it). `MARS_REGISTRY=0.0.x` reuses an existing registry.
