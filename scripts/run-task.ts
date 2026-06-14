// scripts/run-task.ts — thin CLI over the shared MARS task flow (lib/task-flow.ts).
// Resolves the requester account, then runs: negotiate+create task → real audit →
// add to db + /skills + whitelist the agent. The flow itself lives in lib/task-flow.ts
// so the curl endpoint (pages/api/run-task.ts) runs the exact same code.
//
//   npx tsx scripts/run-task.ts poisoned-pdf-skill                 # local demo → DANGEROUS
//   npx tsx scripts/run-task.ts left-pad 0.0.9227937              # an npm package, licensed to that account
//   npx tsx scripts/run-task.ts https://unpkg.com/is-odd/index.js 0.0.9228428
import { config } from "dotenv";
config({ path: ".env.local" });
config();

import { runTaskFlow } from "../lib/task-flow";
import { REQUESTER } from "../lib/demo-skills";

async function main() {
  const ref = process.argv[2];
  if (!ref) {
    console.log(`\nUsage: npx tsx scripts/run-task.ts <skill> [requester-account]\n  <skill> = local path | demo name | npm package | url`);
    return;
  }

  // The requester = the agent that wants the skill and gets licensed on a SAFE verdict.
  // Prefer the agent's own account from env (the Hermes agent exports MARS_AGENT_ID after
  // registering); allow a CLI override; fall back to the demo REQUESTER so the demo never breaks.
  const envAgent = process.env.MARS_AGENT_ID || process.env.AGENT_ID || process.env.AGENTS_ID || process.env.HERMES_AGENT_ID;
  const agentId = process.argv[3] || envAgent || REQUESTER;
  const source = process.argv[3] ? "cli arg" : envAgent ? "env (MARS_AGENT_ID)" : "fallback (demo REQUESTER)";
  console.log(`\x1b[2magent ${agentId} (${source})\x1b[0m`);

  await runTaskFlow({ agentId, skillRef: ref, color: true, write: (l) => console.log(l) });
}

main().catch((e) => {
  console.error("ERROR:", e instanceof Error ? e.message : e);
  process.exit(1);
});
