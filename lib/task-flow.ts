// lib/task-flow.ts — the ONE shared MARS task flow, used by BOTH the CLI
// (scripts/run-task.ts) and the curl endpoint (pages/api/run-task.ts).
//
// Given an agent_id and a skill reference (local path | demo name | npm package |
// github/url), it runs the whole thing end-to-end:
//
//   STEP 1 — negotiate + create the task   (HCS-16 room → AI quote → task topic)
//   STEP 2 — run the auditing procedure     (the REAL pipeline, OpenAI per stage)
//   STEP 3 — add to db + /skills + whitelist (verify the skill, license the agent_id)
//
// Output is streamed through the caller-supplied `write(line)` sink so the CLI can
// colour it and the endpoint can pipe it straight to `curl`. The structured result
// is returned for programmatic callers.
import { existsSync } from "node:fs";
import { createHash } from "node:crypto";
import {
  getClient, getOperatorKey, getOperatorId, hashscan,
  createTopic, submitMessage,
  hcs16Memo, buildHCS16FloraCreated, buildHCS16Chat,
  buildTaskInit, buildAuditStep, buildAuditVerdict, buildJobPosted,
  uploadFileHCS1,
} from "./hedera";
import { loadState, saveState } from "./state";
import { initMars } from "./agents";
import { REQUESTER, AUDITOR, requesterAsk, requesterAccept, type DemoSkill } from "./demo-skills";
import { generateAuditorQuote } from "./auditor";
import { resolveRemoteSkill, resolveLocalDemoSkill, readLocalSkill } from "./skill-source.mjs";
import { runAuditPipeline, DEFAULT_MODEL } from "./audit-core.mjs";
import { startAudit, setAuditStage, appendEvidence, finishAudit, saveVerifiedSkill, saveAttestation } from "./db.mjs";

// ── ANSI palette (stripped to empty strings when color:false, e.g. for the endpoint) ──
const ANSI = { dim: "\x1b[2m", reset: "\x1b[0m", bold: "\x1b[1m", blue: "\x1b[34m", purple: "\x1b[35m", green: "\x1b[32m", red: "\x1b[31m", amber: "\x1b[33m", cyan: "\x1b[36m" };
const PLAIN = { dim: "", reset: "", bold: "", blue: "", purple: "", green: "", red: "", amber: "", cyan: "" };

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);
const STAGE_NUM: Record<string, number> = { scanner: 1, sandbox: 2, fork: 3 };
const TRUST: Record<string, number> = { none: 98, low: 90, medium: 58, high: 16, critical: 4 };

export interface TaskFlowOptions {
  agentId?: string;                 // requester account — whitelisted on a SAFE verdict (defaults to demo REQUESTER)
  skillRef: string;                 // local path | demo name | npm package | github/url
  model?: string;                   // OpenAI model (defaults to OPENAI_MODEL or gpt-4o-mini)
  color?: boolean;                  // ANSI colour in the streamed output (default true)
  write?: (line: string) => void;   // output sink — one line at a time (default: no-op)
}

export interface TaskFlowResult {
  skill: string;
  requester: string;
  auditId: string;
  taskTopicId: string;
  chatRoomTopicId: string;
  verdict: "SAFE" | "DANGEROUS";
  risk: string;
  trust: number;
  safe: boolean;
  licensed: boolean;
  verified: { verified_name: string; version: number; path: string } | null;
  attested: boolean;
  hashscanTask: string;
}

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

/**
 * Run the full audit-and-license flow for one package the agent wants to use.
 * Opens (and always closes) its own Hedera client. Throws if OPENAI_API_KEY is unset.
 */
export async function runTaskFlow(opts: TaskFlowOptions): Promise<TaskFlowResult> {
  const C = opts.color === false ? PLAIN : ANSI;
  const w = opts.write ?? (() => {});
  const requester = opts.agentId || REQUESTER; // the agent that gets licensed on SAFE
  const model = opts.model || process.env.OPENAI_MODEL || DEFAULT_MODEL;

  if (!process.env.OPENAI_API_KEY) throw new Error("OPENAI_API_KEY is required — the auditor runs the real pipeline.");

  const { name, files } = await resolveSkill(opts.skillRef);
  // a lightweight descriptor purely for the negotiation lines (scope is what we're about to find out)
  const desc: DemoSkill = {
    ref: opts.skillRef, name, version: "—", scope: "declared vs actual behaviour (network · files · wallet · secrets)",
    tier: "automated", compliance: "FIN", price: "1 USDC", bond: "2,500 USDC", time: "~10m",
    expect: "SAFE", trust: 0, steps: [],
  };

  const client = getClient();
  try {
    const registryTopicId = loadState().registryTopicId ?? (await initMars(client)).registryTopicId;

    // ════════════════════════════════════════════════════════════════════════
    // STEP 1 — NEGOTIATE + CREATE THE TASK
    // ════════════════════════════════════════════════════════════════════════
    const chatRoomTopicId = await ensureChatRoom(client);
    w(`\n${C.amber}${C.bold}NEGOTIATION ROOM${C.reset}  ${C.dim}HCS-16${C.reset}  ${hashscan("topic", chatRoomTopicId)}`);
    w(`${C.dim}skill ${name} · requester ${requester}${C.reset}\n`);

    // ── negotiation — real HCS messages; only the auditor's quote is AI-generated ──
    const postTurn = async (from: string, text: string, tag = "") => {
      const r = await submitMessage(client, chatRoomTopicId, buildHCS16Chat(from, "mars-chatroom", text));
      const role = from === AUDITOR ? `${C.purple}auditor${C.reset}` : `${C.blue}requester${C.reset}`;
      w(`  ${role} ${C.dim}${from}${C.reset}   ${C.green}⛓ seq ${r.sequenceNumber}${C.reset}${tag}`);
      w(`    ${text}\n`);
      await sleep(600);
    };
    await postTurn(requester, requesterAsk(desc));
    const quote = await generateAuditorQuote(desc, requesterAsk(desc));
    await postTurn(AUDITOR, quote.text, `  ${C.dim}(${quote.source})${C.reset}`);
    await postTurn(requester, requesterAccept());

    // ── accept → per-task HCS topic; init carries the real skill content + agreed terms ──
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
    w(`${C.bold}TASK TOPIC${C.reset}  ${hashscan("topic", taskTopicId)}`);
    w(`  ${C.green}⛓ seq ${initSeq}${C.reset}  init · ${desc.price} escrow · bond ${desc.bond}${contentHrl ? ` · content ${contentHrl}` : ""}\n`);

    // ════════════════════════════════════════════════════════════════════════
    // STEP 2 — RUN THE AUDITING PROCEDURE (the REAL pipeline, OpenAI per stage)
    // ════════════════════════════════════════════════════════════════════════
    const auditId = "audit-" + createHash("sha256").update(name + Date.now()).digest("hex").slice(0, 6);
    startAudit({ auditId, skill: name, agentId: requester, model, files: files.map((f) => f.name) });
    w(`${C.cyan}${C.bold}AUDIT${C.reset}  ${C.dim}${auditId} · model ${model}${C.reset}`);

    const result = await runAuditPipeline({
      name, files, auditId, model,
      apiKey: process.env.OPENAI_API_KEY,
      attestorUrl: process.env.PHALA_ATTESTOR_URL,
      onEvent: (e: { type?: string; stage?: string; name?: string; status?: string; summary?: string; findings?: { severity: string }[] }) => {
        if (e.type === "stage" && e.status === "running") {
          if (STAGE_NUM[e.stage ?? ""]) setAuditStage(auditId, STAGE_NUM[e.stage ?? ""], e.name);
          w(`  ${C.cyan}▶ ${e.name}${C.reset} ${C.dim}…${C.reset}`);
        } else if (e.type === "stage" && e.status === "done") {
          appendEvidence(auditId, { stage: e.stage, summary: e.summary, findings: e.findings });
          w(`  ${C.green}✓${C.reset} ${e.summary || ""}`);
        } else if (e.type === "synth" && e.status === "running") {
          setAuditStage(auditId, 4, "Synthesizer");
          w(`  ${C.cyan}▶ Synthesizer${C.reset} ${C.dim}…${C.reset}`);
        }
      },
    });

    const verdict = result.verdict;
    const fileSha256 = result.record.file_sha256;
    const trust = TRUST[String(verdict.risk).toLowerCase()] ?? (result.safe ? 90 : 6);

    // ── post each REAL stage + the verdict to the task topic (the on-chain audit trail) ──
    w(`\n  ${C.dim}posting audit trail → task topic${C.reset}`);
    for (const ev of result.record.evidence as { stage: string; summary?: string; findings?: { severity: string }[] }[]) {
      const status = ev.findings?.some((f) => ["high", "critical"].includes(String(f.severity).toLowerCase())) ? "fail" : "pass";
      const r = await submitMessage(client, taskTopicId, buildAuditStep(name, cap(ev.stage), status, ev.summary || ""));
      const mark = status === "fail" ? `${C.red}✗${C.reset}` : `${C.green}✓${C.reset}`;
      w(`  ${mark} ${C.bold}${cap(ev.stage).padEnd(12)}${C.reset} ${C.dim}seq ${r.sequenceNumber}${C.reset}  ${ev.summary || ""}`);
    }
    const vSeq = (await submitMessage(client, taskTopicId, buildAuditVerdict(name, verdict.verdict, trust, contentHrl ?? "hcs://1/pending"))).sequenceNumber;

    // ════════════════════════════════════════════════════════════════════════
    // STEP 3 — ADD TO DB + /skills + WHITELIST the agent_id
    // ════════════════════════════════════════════════════════════════════════
    // On SAFE: write the versioned skill to /skills, register it in db/skills.json,
    // and add the requester to that skill's licensed_agents (the whitelist).
    let verified: { verified_name: string; version: number; path: string } | null = null;
    if (result.safe) {
      verified = saveVerifiedSkill({ skill: name, files, agentId: requester, auditId, fileSha256 });
    }
    finishAudit(auditId, { verdict: verdict.verdict, risk: verdict.risk, fileSha256, verified, attestation: result.attestation, steps: result.record.evidence, verdictFull: verdict });
    if (result.attestation) saveAttestation(auditId, result.attestation, { skill: name, verdict: verdict.verdict, agent_id: requester });
    await submitMessage(client, registryTopicId, buildJobPosted({ jobId: taskTopicId, skill: name, requester, scope: desc.scope, auditTrailTopicId: taskTopicId, status: result.safe ? "verified" : "dangerous" }));

    // ── summary ──
    const vColor = result.safe ? C.green : C.red;
    w(`\n  ${vColor}${C.bold}VERDICT: ${verdict.verdict}${C.reset}  trust ${trust}  ${C.dim}risk ${verdict.risk} · seq ${vSeq}${C.reset}`);
    if (verdict.summary) w(`  ${verdict.summary}`);
    if (result.safe && verified) {
      w(`\n  ${C.green}✓ verified${C.reset}  ${verified.verified_name}  →  ${C.bold}licensed to ${requester}${C.reset}`);
      w(`  ${C.dim}saved → ${verified.path} · db/skills.json licensed_agents += ${requester}${C.reset}`);
    } else {
      w(`\n  ${C.red}✗ flagged DANGEROUS${C.reset}  — not verified, not licensed`);
    }
    const attested = !!(result.attestation && !result.attestation.error);
    if (attested && !result.attestation.mocked) w(`  ${C.green}TEE-attested${C.reset}  reportData 0x${String(result.attestation.reportData).slice(0, 18)}…`);
    w(`\n${C.dim}full trail → ${hashscan("topic", taskTopicId)}${C.reset}\n`);

    return {
      skill: name, requester, auditId, taskTopicId, chatRoomTopicId,
      verdict: verdict.verdict, risk: verdict.risk, trust, safe: result.safe,
      licensed: !!(result.safe && verified), verified, attested,
      hashscanTask: hashscan("topic", taskTopicId),
    };
  } finally {
    client.close();
  }
}
