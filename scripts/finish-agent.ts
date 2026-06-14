// scripts/finish-agent.ts — Step 2 of the /register-agent skill. Reads agent-pending.json, then POLLS
// World AgentBook every 3s until the user's scan registers the agent (auto-continues, no input needed),
// then finishes: per-agent voting/review HCS + HCS-11 profile + memo + agent_registered into the main HCS.
//   npx tsx scripts/finish-agent.ts [auditor|user]
import { config } from "dotenv";
config({ path: ".env.local" });

import { readFileSync, existsSync, unlinkSync } from "fs";
import { join } from "path";
import { getClient, hashscan } from "../lib/hedera";
import { checkAgentHuman } from "../lib/world-agentkit";
import { initMars, registerAgent } from "../lib/agents";

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
const PENDING = join(process.cwd(), "agent-pending.json");

async function main() {
  const role = (process.argv[2] === "user" ? "user" : "auditor") as "user" | "auditor";
  if (!existsSync(PENDING)) {
    console.error("No pending account — run `npx tsx scripts/new-account.ts` first.");
    process.exit(1);
  }
  const acct = JSON.parse(readFileSync(PENDING, "utf-8")) as { accountId: string; privateKey: string; evmAddress: string };

  const client = getClient();
  try {
    // poll AgentBook until the user's scan registers the agent (auto-continue)
    console.log(`→ waiting for World AgentBook registration of ${acct.evmAddress} (polling every 3s, up to 3 min)…`);
    let humanId: string | null = null;
    const deadline = Date.now() + 180_000;
    while (Date.now() < deadline) {
      try {
        humanId = await checkAgentHuman(acct.evmAddress);
      } catch {
        humanId = null;
      }
      if (humanId) break;
      await sleep(3000);
    }
    console.log(humanId ? `✓ verified — human ${humanId.slice(0, 12)}…\n` : "(not verified within 3 min — finishing unverified)\n");

    // ensure the seeded main HCS
    let registryTopicId = process.env.MARS_REGISTRY;
    if (!registryTopicId) {
      const infra = await initMars(client);
      registryTopicId = infra.registryTopicId;
      console.log(infra.seeded ? "→ using seeded main HCS registry" : "→ created main HCS registry");
    }

    // finish the agent, printing each step
    console.log(`→ registering ${role}:`);
    const a = await registerAgent(
      client,
      { registryTopicId, role, accountId: acct.accountId, accountKey: acct.privateKey, evmAddress: acct.evmAddress, worldVerified: !!humanId, humanId },
      (s) => {
        if (s.status === "done") console.log(`  ✓ ${s.label}${s.id ? ` → ${s.id}` : ""}`);
      }
    );

    console.log("\n✓ registered");
    console.log(`  account ${hashscan("account", a.account)}`);
    console.log(`  voting  ${hashscan("topic", a.votingTopicId)}`);
    console.log(`  reviews ${hashscan("topic", a.reviewTopicId)}`);
    console.log(`  profile ${hashscan("topic", a.profileTopicId)}`);
    console.log(`  world   ${a.worldVerified ? `verified (${a.humanId})` : "unverified"}`);
    try {
      unlinkSync(PENDING);
    } catch {
      /* ignore */
    }
  } finally {
    client.close();
  }
}

main().catch((e) => {
  console.error("ERROR:", e instanceof Error ? e.message : e);
  process.exit(1);
});
