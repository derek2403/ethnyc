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
import { createHash } from "node:crypto";
import {
  getClient, getOperatorKey, getOperatorId, hashscan,
  createTopic, submitMessage,
  hcs16Memo, buildHCS16FloraCreated, buildHCS16Chat,
  buildTaskInit, buildJobPosted,
  uploadFileHCS1,
} from "../lib/hedera";
import { loadState, saveState } from "../lib/state";
import { initMars } from "../lib/agents";
import { SKILLS, getSkill, requesterAsk, requesterAccept, REQUESTER, AUDITOR, AUDITOR_REVIEW_TOPIC, AUDITOR_VOTING_TOPIC } from "../lib/demo-skills";
import { loadDemoSkill } from "../lib/demo-skills-loader";
import { generateAuditorQuote } from "../lib/auditor";
import { auditTaskToHcs, finalizeTaskToHcs } from "../lib/audit-task";

// ── tiny ANSI helpers (terminal chat bubbles) ──────────────────────────────
const C = { dim: "\x1b[2m", reset: "\x1b[0m", bold: "\x1b[1m", blue: "\x1b[34m", purple: "\x1b[35m", green: "\x1b[32m", red: "\x1b[31m", amber: "\x1b[33m", cyan: "\x1b[36m" };
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
const who = (acct: string) =>
  acct === AUDITOR ? `${C.purple}auditor${C.reset}` : acct === REQUESTER ? `${C.blue}requester${C.reset}` : `${C.dim}agent${C.reset}`;

/** Ensure the one global HCS-16 chat room (same as the /api/hedera ensureChatRoom action). */
async function ensureChatRoom(client: ReturnType<typeof getClient>): Promise<string> {
  const st = loadState();
  if (st.chatRoomTopicId) return st.chatRoomTopicId;
  const floraId = "mars-chatroom";
  const communication = await createTopic(client, hcs16Memo(floraId, 0), getOperatorKey().publicKey);
  await submitMessage(client, communication, buildHCS16FloraCreated(getOperatorId(), communication, communication, communication, "MARS negotiation room"));
  saveState({ chatRoomTopicId: communication, chatFloraId: floraId });
  return communication;
}

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
    // 1) the negotiation — each line is a real HCS message; only the auditor's quote is AI
    const postTurn = async (from: string, text: string, tag = "") => {
      const r = await submitMessage(client, chatRoomTopicId, buildHCS16Chat(from, "mars-chatroom", text));
      console.log(`  ${who(from)} ${C.dim}${from}${C.reset}   ${C.green}⛓ seq ${r.sequenceNumber}${C.reset}${tag}`);
      console.log(`    ${text}\n`);
      await sleep(700);
    };
    await postTurn(REQUESTER, requesterAsk(skill)); // scripted ask
    const quote = await generateAuditorQuote(skill, requesterAsk(skill)); // OpenAI (auditor only)
    await postTurn(AUDITOR, quote.text, `  ${C.dim}(${quote.source})${C.reset}`);
    await postTurn(REQUESTER, requesterAccept()); // scripted accept

    // 2) accept → create the task topic; init carries skill content + agreed terms
    const loaded = loadDemoSkill(skill.ref);
    const source = loaded.source;
    const contentHash = createHash("sha256").update(source).digest("hex");
    const terms = {
      skill: skill.name, scope: skill.scope, requester: REQUESTER, auditor: AUDITOR,
      price: skill.price, bond: skill.bond, time: skill.time, version: skill.version,
      tier: skill.tier, compliance: skill.compliance, contentHash, chatRoomTopicId,
      m: quote.text, // the auditor's quote → nego record on the task topic
    };
    let content = source;
    let contentHrl: string | undefined;
    if (Buffer.byteLength(buildTaskInit({ ...terms, content: source }), "utf-8") > 1000) {
      const file = await uploadFileHCS1(client, source, "application/octet-stream");
      content = file.hrl;
      contentHrl = file.hrl;
    }
    const taskTopicId = await createTopic(client, `mars-task:${skill.name}`, getOperatorKey().publicKey);
    const initSeq = (await submitMessage(client, taskTopicId, buildTaskInit({ ...terms, content, contentHrl }))).sequenceNumber;
    await submitMessage(client, registryTopicId, buildJobPosted({ jobId: taskTopicId, skill: skill.name, requester: REQUESTER, scope: skill.scope, auditTrailTopicId: taskTopicId, status: "agreed" }));
    console.log(`${C.bold}TASK TOPIC${C.reset}  ${hashscan("topic", taskTopicId)}`);
    console.log(`  ${C.green}⛓ seq ${initSeq}${C.reset}  init · ${skill.price} escrow · bond ${skill.bond} · scope ${skill.scope}${contentHrl ? ` · content ${contentHrl}` : ""}\n`);

    // 3) REAL audit pipeline (derek's runAuditPipeline) → each stage + verdict recorded onto the task topic
    console.log(`${C.cyan}${C.bold}AUDIT${C.reset}  ${C.dim}4 OpenAI stages → recorded on HCS${C.reset}`);
    const res = await auditTaskToHcs(client, {
      taskTopicId,
      skillRef: skill.ref,
      registryTopicId,
      onStage: (s) => {
        const mark = s.status === "fail" ? `${C.red}✗${C.reset}` : s.status === "warn" ? `${C.amber}•${C.reset}` : `${C.green}✓${C.reset}`;
        console.log(`  ${mark} ${C.bold}${s.stage.padEnd(12)}${C.reset} ${s.summary}`);
        for (const f of s.findings.slice(0, 3)) console.log(`      ${C.dim}[${String(f.severity).toUpperCase()}] ${f.title}${C.reset}`);
      },
    });
    const vColor = res.verdict === "SAFE" ? C.green : C.red;
    console.log(`\n  ${vColor}${C.bold}VERDICT: ${res.verdict}${C.reset}  ${C.dim}risk ${res.risk} · trust ${res.trustScore} · (${res.source})${C.reset}`);
    if (res.capabilities.length) {
      console.log(`  ${C.bold}What the skill does:${C.reset}`);
      for (const c of res.capabilities) console.log(`    • ${c}`);
    }
    console.log(`\n${C.dim}report → ${res.reportHrl} · full trail → ${hashscan("topic", taskTopicId)}${C.reset}\n`);

    // 4) requester decision → review the auditor → mint VERIFIED NFT (SAFE → approve+mint; DANGEROUS → block)
    const approve = res.verdict === "SAFE";
    const fin = await finalizeTaskToHcs(client, {
      taskTopicId, skill: skill.name, verdict: res.verdict, approve,
      requester: REQUESTER, auditor: AUDITOR, reviewTopicId: AUDITOR_REVIEW_TOPIC, votingTopicId: AUDITOR_VOTING_TOPIC,
      registryTopicId, mintToAccountId: REQUESTER,
    });
    console.log(`${C.bold}${approve ? C.green + "APPROVED" : C.red + "BLOCKED"}${C.reset}  ${C.dim}requester ${fin.decision}${C.reset}`);
    console.log(`  auditor reviewed ${C.amber}${"★".repeat(fin.rating)}${C.reset} ${C.dim}(+${fin.rating} rep → ${AUDITOR})${C.reset}`);
    if (fin.mint) console.log(`  ${C.green}✓ VERIFIED NFT${C.reset}  ${hashscan("token", fin.mint.tokenId)} ${C.dim}#${fin.mint.serial} → ${fin.mint.owner}${C.reset}`);
    console.log();
  } finally {
    client.close();
  }
}

main().catch((e) => {
  console.error("ERROR:", e instanceof Error ? e.message : e);
  process.exit(1);
});
