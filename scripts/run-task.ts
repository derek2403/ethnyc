// scripts/run-task.ts — the full MARS flow for ONE package the requester wants to use:
//   1) negotiation on the global HCS-16 chat room (requester ask → AI auditor quote → accept)
//   2) a per-task HCS topic (init = skill content + agreed terms)
//   3) the REAL audit pipeline (lib/audit-core.mjs, OpenAI per stage) — every stage + the verdict
//      are posted to the task topic AND mirrored to the dashboard DB (db/audits.json)
//   4) on SAFE → the skill is verified and the requester's account is added to its licensed_agents
//
//   npx tsx scripts/run-task.ts poisoned-pdf-skill                 # local demo → DANGEROUS
//   npx tsx scripts/run-task.ts left-pad 0.0.9227937              # an npm package, licensed to that account
//   npx tsx scripts/run-task.ts https://unpkg.com/is-odd/index.js 0.0.9228428
import { config } from "dotenv";
config({ path: ".env.local" });
config();

import { existsSync } from "node:fs";
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
import { REQUESTER, AUDITOR, requesterAsk, requesterAccept, type DemoSkill } from "../lib/demo-skills";
import { generateAuditorQuote } from "../lib/auditor";
// the same resolver + real pipeline the standalone audit CLI uses
import { resolveRemoteSkill, resolveLocalDemoSkill, readLocalSkill } from "../lib/skill-source.mjs";
import { runAuditPipeline, DEFAULT_MODEL } from "../lib/audit-core.mjs";
import { startAudit, setAuditStage, appendEvidence, finishAudit, saveVerifiedSkill, saveAttestation } from "../lib/db.mjs";

const C = { dim: "\x1b[2m", reset: "\x1b[0m", bold: "\x1b[1m", blue: "\x1b[34m", purple: "\x1b[35m", green: "\x1b[32m", red: "\x1b[31m", amber: "\x1b[33m", cyan: "\x1b[36m" };
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);
const STAGE_NUM: Record<string, number> = { scanner: 1, sandbox: 2, fork: 3 };
const TRUST: Record<string, number> = { none: 98, low: 90, medium: 58, high: 16, critical: 4 };

/** Resolve any package into { name, files } — local file/dir, demo skill, npm package, or URL. */
async function resolveSkill(arg: string): Promise<{ name: string; files: { name: string; content: string }[] }> {
  if (existsSync(arg)) return readLocalSkill(arg);
  const demo = resolveLocalDemoSkill(arg);
  if (demo) return demo;
  return resolveRemoteSkill(arg);
}

/** The one global HCS-16 chat room (same as the /api/hedera ensureChatRoom action). */
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
  // The requester = the agent that wants the skill and gets licensed on a SAFE verdict.
  // Prefer the agent's own account from env (the Hermes agent exports MARS_AGENT_ID after
  // registering); allow a CLI override; fall back to the demo REQUESTER so the demo never breaks.
  const envAgent = process.env.MARS_AGENT_ID || process.env.AGENT_ID || process.env.AGENTS_ID || process.env.HERMES_AGENT_ID;
  const requester = process.argv[3] || envAgent || REQUESTER;
  const requesterSource = process.argv[3] ? "cli arg" : envAgent ? "env (MARS_AGENT_ID)" : "fallback (demo REQUESTER)";
  if (!ref) {
    console.log(`\nUsage: npx tsx scripts/run-task.ts <skill> [requester-account]\n  <skill> = local path | demo name | npm package | url`);
    return;
  }
  if (!process.env.OPENAI_API_KEY) {
    console.error("Set OPENAI_API_KEY — the auditor runs the real pipeline.");
    process.exit(1);
  }

  const { name, files } = await resolveSkill(ref);
  // a lightweight descriptor purely for the negotiation lines (scope is what we're about to find out)
  const desc: DemoSkill = {
    ref, name, version: "—", scope: "declared vs actual behaviour (network · files · wallet · secrets)",
    tier: "automated", compliance: "FIN", price: "1 USDC", bond: "2,500 USDC", time: "~10m",
    expect: "SAFE", trust: 0, steps: [],
  };

  const client = getClient();
  try {
    const registryTopicId = loadState().registryTopicId ?? (await initMars(client)).registryTopicId;
    const chatRoomTopicId = await ensureChatRoom(client);
    console.log(`\n${C.amber}${C.bold}NEGOTIATION ROOM${C.reset}  ${C.dim}HCS-16${C.reset}  ${hashscan("topic", chatRoomTopicId)}`);
    console.log(`${C.dim}skill ${name} · requester ${requester} (${requesterSource})${C.reset}\n`);

    // ── 1) negotiation — real HCS messages; only the auditor's quote is AI ──
    const postTurn = async (from: string, text: string, tag = "") => {
      const r = await submitMessage(client, chatRoomTopicId, buildHCS16Chat(from, "mars-chatroom", text));
      const role = from === AUDITOR ? `${C.purple}auditor${C.reset}` : `${C.blue}requester${C.reset}`;
      console.log(`  ${role} ${C.dim}${from}${C.reset}   ${C.green}⛓ seq ${r.sequenceNumber}${C.reset}${tag}`);
      console.log(`    ${text}\n`);
      await sleep(600);
    };
    await postTurn(requester, requesterAsk(desc));
    const quote = await generateAuditorQuote(desc, requesterAsk(desc));
    await postTurn(AUDITOR, quote.text, `  ${C.dim}(${quote.source})${C.reset}`);
    await postTurn(requester, requesterAccept());

    // ── 2) accept → task topic; init carries the real skill content + agreed terms ──
    const source = files.map((f) => `=== ${f.name} ===\n${f.content}`).join("\n").slice(0, 8000);
    const contentHash = createHash("sha256").update(source).digest("hex");
    const terms = {
      skill: name, scope: desc.scope, requester, auditor: AUDITOR,
      price: desc.price, bond: desc.bond, time: desc.time, version: desc.version,
      tier: desc.tier, compliance: desc.compliance, contentHash, chatRoomTopicId,
    };
    let content = source;
    let contentHrl: string | undefined;
    if (Buffer.byteLength(buildTaskInit({ ...terms, content: source }), "utf-8") > 1000) {
      const file = await uploadFileHCS1(client, source, "application/octet-stream");
      content = file.hrl;
      contentHrl = file.hrl;
    }
    const taskTopicId = await createTopic(client, `mars-task:${name}`, getOperatorKey().publicKey);
    const initSeq = (await submitMessage(client, taskTopicId, buildTaskInit({ ...terms, content, contentHrl }))).sequenceNumber;
    await submitMessage(client, registryTopicId, buildJobPosted({ jobId: taskTopicId, skill: name, requester, scope: desc.scope, auditTrailTopicId: taskTopicId, status: "agreed" }));
    console.log(`${C.bold}TASK TOPIC${C.reset}  ${hashscan("topic", taskTopicId)}`);
    console.log(`  ${C.green}⛓ seq ${initSeq}${C.reset}  init · ${desc.price} escrow · bond ${desc.bond}${contentHrl ? ` · content ${contentHrl}` : ""}\n`);

    // ── 3) the REAL audit pipeline (OpenAI per stage) — live progress + DB mirror ──
    const auditId = "audit-" + createHash("sha256").update(name + Date.now()).digest("hex").slice(0, 6);
    const model = process.env.OPENAI_MODEL || DEFAULT_MODEL;
    startAudit({ auditId, skill: name, agentId: requester, model, files: files.map((f) => f.name) });
    console.log(`${C.cyan}${C.bold}AUDIT${C.reset}  ${C.dim}${auditId} · model ${model}${C.reset}`);

    const result = await runAuditPipeline({
      name, files, auditId, model,
      apiKey: process.env.OPENAI_API_KEY,
      attestorUrl: process.env.PHALA_ATTESTOR_URL,
      onEvent: (e: { type?: string; stage?: string; name?: string; status?: string; summary?: string; findings?: { severity: string }[] }) => {
        if (e.type === "stage" && e.status === "running") {
          if (STAGE_NUM[e.stage ?? ""]) setAuditStage(auditId, STAGE_NUM[e.stage ?? ""], e.name);
          console.log(`  ${C.cyan}▶ ${e.name}${C.reset} ${C.dim}…${C.reset}`);
        } else if (e.type === "stage" && e.status === "done") {
          appendEvidence(auditId, { stage: e.stage, summary: e.summary, findings: e.findings });
          console.log(`  ${C.green}✓${C.reset} ${e.summary || ""}`);
        } else if (e.type === "synth" && e.status === "running") {
          setAuditStage(auditId, 4, "Synthesizer");
          console.log(`  ${C.cyan}▶ Synthesizer${C.reset} ${C.dim}…${C.reset}`);
        }
      },
    });

    const verdict = result.verdict;
    const fileSha256 = result.record.file_sha256;
    const trust = TRUST[String(verdict.risk).toLowerCase()] ?? (result.safe ? 90 : 6);

    // ── post each REAL stage + the verdict to the task topic (the on-chain audit trail) ──
    console.log(`\n  ${C.dim}posting audit trail → task topic${C.reset}`);
    for (const ev of result.record.evidence as { stage: string; summary?: string; findings?: { severity: string }[] }[]) {
      const status = ev.findings?.some((f) => ["high", "critical"].includes(String(f.severity).toLowerCase())) ? "fail" : "pass";
      const r = await submitMessage(client, taskTopicId, buildAuditStep(name, cap(ev.stage), status, ev.summary || ""));
      const mark = status === "fail" ? `${C.red}✗${C.reset}` : `${C.green}✓${C.reset}`;
      console.log(`  ${mark} ${C.bold}${cap(ev.stage).padEnd(12)}${C.reset} ${C.dim}seq ${r.sequenceNumber}${C.reset}  ${ev.summary || ""}`);
    }
    const vSeq = (await submitMessage(client, taskTopicId, buildAuditVerdict(name, verdict.verdict, trust, contentHrl ?? "hcs://1/pending"))).sequenceNumber;

    // ── 4) persist + license: verified skill → add the requester to licensed_agents ──
    let verified: { verified_name: string; version: number; path: string } | null = null;
    if (result.safe) {
      verified = saveVerifiedSkill({ skill: name, files, agentId: requester, auditId, fileSha256 });
    }
    finishAudit(auditId, { verdict: verdict.verdict, risk: verdict.risk, fileSha256, verified, attestation: result.attestation, steps: result.record.evidence, verdictFull: verdict });
    if (result.attestation) saveAttestation(auditId, result.attestation, { skill: name, verdict: verdict.verdict, agent_id: requester });
    await submitMessage(client, registryTopicId, buildJobPosted({ jobId: taskTopicId, skill: name, requester, scope: desc.scope, auditTrailTopicId: taskTopicId, status: result.safe ? "verified" : "dangerous" }));

    // ── summary ──
    const vColor = result.safe ? C.green : C.red;
    console.log(`\n  ${vColor}${C.bold}VERDICT: ${verdict.verdict}${C.reset}  trust ${trust}  ${C.dim}risk ${verdict.risk} · seq ${vSeq}${C.reset}`);
    if (verdict.summary) console.log(`  ${verdict.summary}`);
    if (result.safe && verified) {
      console.log(`\n  ${C.green}✓ verified${C.reset}  ${verified.verified_name}  →  ${C.bold}licensed to ${requester}${C.reset}`);
      console.log(`  ${C.dim}saved → ${verified.path} · db/skills.json licensed_agents += ${requester}${C.reset}`);
    } else {
      console.log(`\n  ${C.red}✗ flagged DANGEROUS${C.reset}  — not verified, not licensed`);
    }
    if (result.attestation && !result.attestation.mocked) console.log(`  ${C.green}TEE-attested${C.reset}  reportData 0x${String(result.attestation.reportData).slice(0, 18)}…`);
    console.log(`\n${C.dim}full trail → ${hashscan("topic", taskTopicId)}${C.reset}\n`);
  } finally {
    client.close();
  }
}

main().catch((e) => {
  console.error("ERROR:", e instanceof Error ? e.message : e);
  process.exit(1);
});
