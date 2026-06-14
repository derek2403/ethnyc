// scripts/new-account.ts — create a Hedera agent account, save it to agent-pending.json, and print
// its EVM + the ready-to-run AgentBook command. Fast, non-interactive. Step 1 of the /register-agent skill.
import { config } from "dotenv";
config({ path: ".env.local" });

import { writeFileSync } from "fs";
import { join } from "path";
import { getClient, hashscan, createAgentAccount } from "../lib/hedera";

async function main() {
  const client = getClient();
  try {
    const a = await createAgentAccount(client, 5);
    writeFileSync(join(process.cwd(), "agent-pending.json"), JSON.stringify({ accountId: a.accountId, privateKey: a.privateKey, evmAddress: a.evmAddress }, null, 2));
    console.log(`ACCOUNT=${a.accountId}`);
    console.log(`EVM=${a.evmAddress}`);
    console.log(`HASHSCAN=${hashscan("account", a.accountId)}`);
    console.log(`COMMAND=npx @worldcoin/agentkit-cli register ${a.evmAddress}`);
  } finally {
    client.close();
  }
}

main().catch((e) => {
  console.error("ERROR:", e instanceof Error ? e.message : e);
  process.exit(1);
});
