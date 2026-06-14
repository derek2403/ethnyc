// scripts/register-agent.ts — the "register agent" skill (official AgentKit flow).
//   create Hedera account → register its EVM address in World AgentBook (renders the World App
//   verify link as a QR IN THE TERMINAL) → poll until registered → finish (voting/review/profile/…).
// No name — the account id is the identity.
//   npx tsx scripts/register-agent.ts [auditor|user]
//   MARS_REGISTRY=0.0.x npx tsx scripts/register-agent.ts user   # reuse a registry
import { config } from "dotenv";
config({ path: ".env.local" });

import { getClient, hashscan, createAgentAccount } from "../lib/hedera";
import { initMars, registerAgent } from "../lib/agents";
import { checkAgentHuman } from "../lib/world-agentkit";
import { getAgentBookVerifyLink, pollAgentBook } from "../lib/agentbook";

/** Register the agent's EVM address in World AgentBook, showing the verify link as a QR in the terminal. */
async function registerInAgentBook(evmAddress: string): Promise<{ worldVerified: boolean; humanId: string | null }> {
  if (!process.env.NEXT_PUBLIC_WORLD_APP_ID) {
    console.log("(World ID not configured — registering unverified)\n");
    return { worldVerified: false, humanId: null };
  }
  const existing = await checkAgentHuman(evmAddress).catch(() => null);
  if (existing) {
    console.log(`✓ ${evmAddress} already in AgentBook (human ${existing.slice(0, 12)}…)\n`);
    return { worldVerified: true, humanId: existing };
  }

  console.log(`→ npx @worldcoin/agentkit-cli register ${evmAddress}\n`);
  const link = await getAgentBookVerifyLink(evmAddress, { echo: true });
  if (!link) {
    console.log("(no verify link from agentkit-cli — proceeding unverified)\n");
    return { worldVerified: false, humanId: null };
  }

  const QRCode = (await import("qrcode")).default;
  console.log("\n📱  …or scan this QR with the World App:\n");
  console.log(await QRCode.toString(link, { type: "terminal", small: true }));
  console.log("…waiting for AgentBook registration to confirm (Ctrl-C to skip)\n");

  const humanId = await pollAgentBook(evmAddress, { timeoutMs: 180_000 });
  if (humanId) {
    console.log(`✓ agent registered in AgentBook — human ${humanId.slice(0, 12)}…\n`);
    return { worldVerified: true, humanId };
  }
  console.log("(not confirmed within 3 min — proceeding unverified)\n");
  return { worldVerified: false, humanId: null };
}

async function main() {
  const role = (process.argv[2] === "user" ? "user" : "auditor") as "user" | "auditor";
  const client = getClient();
  try {
    // 1) create the Hedera account (we need its EVM address to register in AgentBook)
    console.log("→ creating Hedera account…");
    const acct = await createAgentAccount(client, 5);
    console.log(`  account ${hashscan("account", acct.accountId)}\n  evm     ${acct.evmAddress}\n`);

    // 2) register the EVM address in World AgentBook (terminal QR)
    const world = await registerInAgentBook(acct.evmAddress);

    // 3) ensure the seeded main HCS
    let registryTopicId = process.env.MARS_REGISTRY;
    if (!registryTopicId) {
      const infra = await initMars(client);
      registryTopicId = infra.registryTopicId;
      console.log(infra.seeded ? "→ using seeded main HCS registry (mars-state.json)" : "→ created main HCS registry");
      console.log(`  registry ${hashscan("topic", infra.registryTopicId)}`);
    } else {
      console.log(`→ using MARS_REGISTRY override ${registryTopicId}`);
    }

    // 4) finish registering the agent (printing each on-chain step)
    console.log(`\n→ registering ${role}:`);
    const a = await registerAgent(
      client,
      { registryTopicId, role, accountId: acct.accountId, accountKey: acct.privateKey, evmAddress: acct.evmAddress, worldVerified: world.worldVerified, humanId: world.humanId },
      (s) => {
        if (s.status === "done") console.log(`  ✓ ${s.label}${s.id ? ` → ${s.id}` : ""}`);
      }
    );

    console.log("\n✓ registered");
    console.log(`  account  ${hashscan("account", a.account)}`);
    console.log(`  voting   ${hashscan("topic", a.votingTopicId)}`);
    console.log(`  reviews  ${hashscan("topic", a.reviewTopicId)}`);
    console.log(`  profile  ${hashscan("topic", a.profileTopicId)}`);
    console.log(`  world    ${a.worldVerified ? `verified (${a.humanId})` : "unverified"}`);
    console.log(`  key      ${a.encryptedKey?.slice(0, 28)}… (AES-256-GCM, encrypted)`);
  } finally {
    client.close();
  }
}

main().catch((e) => {
  console.error("ERROR:", e instanceof Error ? e.message : e);
  process.exit(1);
});
