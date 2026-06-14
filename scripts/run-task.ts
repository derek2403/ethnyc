// scripts/run-task.ts — run the MARS negotiation + task flow from the CLI, printing the
// SAME simulated chat the /chatroom page shows. Every line is a real HCS message on the
// one global chat room; accepting the quote spins the per-task topic (init = skill content
// + agreed terms), then the audit pipeline appends scanner→sandbox→fork→synthesizer→verdict.
//
//   npx tsx scripts/run-task.ts poisoned-pdf-skill   # the PDF poison → DANGEROUS
//   npx tsx scripts/run-task.ts safe-weather-skill   # clean → SAFE
//   npx tsx scripts/run-task.ts                      # lists the demo skills
import { config } from "dotenv";
config({ path: ".env.local" });

import { createHash } from "node:crypto";
import {
  getClient, getOperatorKey, getOperatorId, hashscan,
  createTopic, submitMessage,
  hcs16Memo, buildHCS16FloraCreated, buildHCS16Chat,
  buildTaskInit, buildAuditStep, buildAuditVerdict, buildJobPosted,
  uploadFileHCS1,
} from "../lib/hedera";
import { loadState, saveState } from "../lib/state";
import { initMars } from "../lib/agents";
import { SKILLS, getSkill, negoScript, REQUESTER, AUDITOR } from "../lib/demo-skills";
import { loadDemoSkill } from "../lib/demo-skills-loader";

// ── tiny ANSI helpers (terminal chat bubbles) ──────────────────────────────
const C = { dim: "\x1b[2m", reset: "\x1b[0m", bold: "\x1b[1m", blue: "\x1b[34m", purple: "\x1b[35m", green: "\x1b[32m", red: "\x1b[31m", amber: "\x1b[33m" };
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
    console.log(`\nUsage: npx tsx scripts/run-task.ts <skill>\n\n${C.bold}Demo skills:${C.reset}`);
    for (const s of SKILLS) console.log(`  ${s.ref.padEnd(20)} ${s.expect === "DANGEROUS" ? C.red + "DANGEROUS" + C.reset : C.green + "SAFE" + C.reset}  ${C.dim}${s.name}${C.reset}`);
    console.log();
    return;
  }
  const skill = getSkill(ref);
  if (!skill) {
    console.error(`Unknown skill "${ref}". Try one of: ${SKILLS.map((s) => s.ref).join(", ")}`);
    process.exit(1);
  }

  const client = getClient();
  try {
    // shared infra: the seeded main registry + the one global chat room
    const registryTopicId = loadState().registryTopicId ?? (await initMars(client)).registryTopicId;
    const chatRoomTopicId = await ensureChatRoom(client);
    console.log(`\n${C.amber}${C.bold}NEGOTIATION ROOM${C.reset}  ${C.dim}HCS-16${C.reset}  ${hashscan("topic", chatRoomTopicId)}`);
    console.log(`${C.dim}skill ${skill.name} · ${skill.ref} · expect ${skill.expect}${C.reset}\n`);

    // 1) the simulated negotiation — each line is a real HCS message
    for (const turn of negoScript(skill)) {
      const r = await submitMessage(client, chatRoomTopicId, buildHCS16Chat(turn.from, "mars-chatroom", turn.text));
      console.log(`  ${who(turn.from)} ${C.dim}${turn.from}${C.reset}   ${C.green}⛓ seq ${r.sequenceNumber}${C.reset}`);
      console.log(`    ${turn.text}\n`);
      await sleep(700);
    }

    // 2) accept → create the task topic; init carries skill content + agreed terms
    const loaded = loadDemoSkill(skill.ref);
    const source = loaded.source;
    const contentHash = createHash("sha256").update(source).digest("hex");
    const terms = {
      skill: skill.name, scope: skill.scope, requester: REQUESTER, auditor: AUDITOR,
      price: skill.price, bond: skill.bond, time: skill.time, version: skill.version,
      tier: skill.tier, compliance: skill.compliance, contentHash, chatRoomTopicId,
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

    // 3) audit pipeline → appends to the SAME task topic
    for (const st of skill.steps) {
      const r = await submitMessage(client, taskTopicId, buildAuditStep(skill.name, st.name, st.status, st.detail));
      const mark = st.status === "fail" ? `${C.red}✗${C.reset}` : st.status === "pass" ? `${C.green}✓${C.reset}` : `${C.amber}•${C.reset}`;
      console.log(`  ${mark} ${C.bold}${st.name.padEnd(12)}${C.reset} ${C.dim}seq ${r.sequenceNumber}${C.reset}  ${st.detail}`);
      await sleep(600);
    }
    const vSeq = (await submitMessage(client, taskTopicId, buildAuditVerdict(skill.name, skill.expect, skill.trust, contentHrl ?? "hcs://1/pending"))).sequenceNumber;
    const vColor = skill.expect === "SAFE" ? C.green : C.red;
    console.log(`\n  ${vColor}${C.bold}VERDICT: ${skill.expect}${C.reset}  trust ${skill.trust}  ${C.dim}seq ${vSeq}${C.reset}`);
    console.log(`\n${C.dim}full trail → ${hashscan("topic", taskTopicId)}${C.reset}\n`);
  } finally {
    client.close();
  }
}

main().catch((e) => {
  console.error("ERROR:", e instanceof Error ? e.message : e);
  process.exit(1);
});
