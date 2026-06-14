import type { NextApiRequest, NextApiResponse } from "next";
import { createHash } from "node:crypto";
import { runAuditPipeline, DEFAULT_MODEL } from "@/lib/audit-core.mjs";
import { resolveRemoteSkill, resolveLocalDemoSkill } from "@/lib/skill-source.mjs";
import { startAudit, finishAudit, failAudit, saveVerifiedSkill, setAuditStage, appendEvidence, saveAttestation } from "@/lib/db.mjs";
import { AUDITOR } from "@/lib/demo-skills";

// MARS audit endpoint — run the real OpenAI pipeline over a skill via curl.
// Resolves: planted demo (demo/skills) → live npm package → raw URL → POST source.
// Persists: writes db/audits.json ("auditing" → "audited"); on a SAFE verdict
// copies the skill to skills/<name>-v<N>/ and grants the agent access (db/skills.json).
//
//   curl "https://mars.derek2403.win/api/audit?skill=@modelcontextprotocol/server-filesystem&agent=agent-0x7F3a"
//   curl "https://mars.derek2403.win/api/audit?skill=poisoned-pdf-skill&stream=1"
//   curl -X POST .../api/audit -H 'content-type: application/json' -d '{"name":"x","source":"...","agent":"agent-0x7F3a"}'
//
// Env: OPENAI_API_KEY (required), OPENAI_MODEL (default gpt-4.1-nano), PHALA_ATTESTOR_URL (optional TDX seal).
export const config = {
  api: { bodyParser: { sizeLimit: "4mb" } },
  maxDuration: 300,
};

type Q = Record<string, unknown>;

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "content-type");
  if (req.method === "OPTIONS") return res.status(204).end();
  if (req.method !== "GET" && req.method !== "POST") {
    return res.status(405).json({ error: "Use GET ?skill=<name> or POST {source}" });
  }

  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) return res.status(500).json({ error: "OPENAI_API_KEY is not configured on this deployment" });

  const q: Q = req.method === "GET" ? req.query : { ...req.query, ...(req.body ?? {}) };
  const skillName = String(q.skill ?? q.name ?? "").trim();
  const source = typeof q.source === "string" ? q.source : "";
  const model = String(q.model ?? process.env.OPENAI_MODEL ?? DEFAULT_MODEL);
  const agentId = String(q.agent ?? q.agent_id ?? q.agentId ?? "anonymous").trim() || "anonymous";
  const stream = q.stream === "1" || q.stream === true || q.stream === "true";

  // Resolve the skill into files: pasted source, planted demo, live npm, or URL.
  let name: string;
  let files: { name: string; content: string }[];
  if (source) {
    name = skillName || "pasted-skill";
    files = [{ name: name.endsWith(".js") ? name : name + ".js", content: source }];
  } else if (skillName) {
    try {
      const local = /^https?:\/\//i.test(skillName) ? null : resolveLocalDemoSkill(skillName);
      ({ name, files } = local ?? (await resolveRemoteSkill(skillName)));
    } catch (e: unknown) {
      return res.status(400).json({ error: e instanceof Error ? e.message : `could not resolve skill "${skillName}"` });
    }
  } else {
    return res.status(400).json({ error: "provide ?skill=<npm-name|url> (GET) or {source} (POST)" });
  }

  const auditId = "audit-" + createHash("sha256").update(name + Date.now()).digest("hex").slice(0, 6);

  // mark "auditing" the moment it starts (best-effort: read-only FS won't persist)
  try {
    startAudit({ auditId, skill: name, agentId, auditor: AUDITOR, model, files: files.map((f) => f.name) });
  } catch {}

  const opts = { name, files, apiKey, model, attestorUrl: process.env.PHALA_ATTESTOR_URL, auditId };

  // Map pipeline progress → db status "auditing-1".."auditing-4".
  const STAGE_NUM: Record<string, number> = { scanner: 1, sandbox: 2, fork: 3 };
  const onProgress = (e: { type?: string; stage?: string; status?: string; name?: string; summary?: string; findings?: unknown[] }) => {
    try {
      if (e.type === "stage" && e.status === "running" && STAGE_NUM[e.stage ?? ""]) {
        setAuditStage(auditId, STAGE_NUM[e.stage ?? ""], e.name);
      } else if (e.type === "stage" && e.status === "done") {
        appendEvidence(auditId, { stage: e.stage, summary: e.summary, findings: e.findings });
      } else if (e.type === "synth" && e.status === "running") {
        setAuditStage(auditId, 4, "Synthesizer");
      }
    } catch {}
  };

  // On completion: save the verified skill (if SAFE) and flip status to "audited".
  const finalize = (result: {
    safe: boolean;
    verdict: { verdict?: string; risk?: string };
    record: { file_sha256: string; evidence?: unknown };
    attestation: unknown;
  }) => {
    let verified = null;
    try {
      if (result.safe) {
        verified = saveVerifiedSkill({ skill: name, files, agentId, auditId, fileSha256: result.record.file_sha256 });
      }
      finishAudit(auditId, {
        verdict: result.verdict?.verdict,
        risk: result.verdict?.risk,
        fileSha256: result.record.file_sha256,
        verified,
        attestation: result.attestation,
        steps: result.record.evidence,
        verdictFull: result.verdict,
      });
      if (result.attestation) {
        saveAttestation(auditId, result.attestation, { skill: name, verdict: result.verdict?.verdict, agent_id: agentId });
      }
    } catch {}
    return verified;
  };

  // Streaming mode → NDJSON, one event per line.
  if (stream) {
    res.setHeader("Content-Type", "application/x-ndjson; charset=utf-8");
    res.setHeader("Cache-Control", "no-cache, no-transform");
    const write = (e: unknown) => {
      onProgress(e as { type?: string });
      res.write(JSON.stringify(e) + "\n");
    };
    write({ type: "audit", status: "auditing", audit_id: auditId, agent_id: agentId, skill: name });
    try {
      const result = await runAuditPipeline({ ...opts, onEvent: write });
      const verified = finalize(result);
      write({ type: "audit", status: "audited", audit_id: auditId, verdict: result.verdict?.verdict, verified });
    } catch (e: unknown) {
      try {
        failAudit(auditId, e instanceof Error ? e.message : "audit failed");
      } catch {}
      write({ type: "error", error: e instanceof Error ? e.message : "audit failed" });
    }
    return res.end();
  }

  // Default → single JSON result (still advances db status as it runs).
  try {
    const result = await runAuditPipeline({ ...opts, onEvent: onProgress });
    const verified = finalize(result);
    return res.status(200).json({ ...result, audit_id: auditId, agent_id: agentId, verified });
  } catch (e: unknown) {
    try {
      failAudit(auditId, e instanceof Error ? e.message : "audit failed");
    } catch {}
    return res.status(500).json({ error: e instanceof Error ? e.message : "audit failed" });
  }
}
