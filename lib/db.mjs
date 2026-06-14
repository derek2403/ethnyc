// Tiny JSON "database" for the audit flow.
//   db/audits.json  — one record per audit (status: auditing → audited)
//   db/skills.json  — registry of VERIFIED skills + which agents may use them
// Verified skill files are copied to  skills/<name>-v<N>/  on a SAFE verdict.
//
// Note: requires a writable filesystem (a VPS / self-hosted Node server).
// On a read-only host (e.g. Vercel) point DB_DIR/SKILLS_DIR at /tmp.

import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";

const ROOT = process.cwd();
const DB_DIR = join(ROOT, "db");
const SKILLS_DIR = join(ROOT, "skills");
const AUDITS = join(DB_DIR, "audits.json");
const REGISTRY = join(DB_DIR, "skills.json");
const ATTEST = join(DB_DIR, "attest.json");

const now = () => new Date().toISOString();

function readJSON(p, fallback) {
  try {
    return JSON.parse(readFileSync(p, "utf8"));
  } catch {
    return fallback;
  }
}
function writeJSON(p, data) {
  mkdirSync(DB_DIR, { recursive: true });
  writeFileSync(p, JSON.stringify(data, null, 2));
}
function sanitize(s) {
  return (
    String(s || "")
      .replace(/^@/, "")
      .replace(/[^A-Za-z0-9._-]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 80) || "skill"
  );
}
function safeRel(p) {
  // strip leading slashes and any ".." so saved paths stay inside the skill dir
  return String(p).replace(/^[/\\]+/, "").split(/[/\\]+/).filter((s) => s && s !== "..").join("/");
}

// ── status tracking ─────────────────────────────────────────────────────────
export function startAudit({ auditId, skill, agentId, model, files }) {
  const db = readJSON(AUDITS, {});
  db[auditId] = {
    audit_id: auditId,
    skill,
    agent_id: agentId || "anonymous",
    model,
    files: files || [],
    status: "auditing",
    verdict: null,
    started_at: now(),
    completed_at: null,
  };
  writeJSON(AUDITS, db);
  return db[auditId];
}

// Advance the in-flight stage: status becomes "auditing-1".."auditing-4".
export function setAuditStage(auditId, stage, stageName) {
  const db = readJSON(AUDITS, {});
  const rec = db[auditId];
  if (!rec) return;
  rec.status = `auditing-${stage}`;
  rec.stage = stage;
  rec.stage_name = stageName;
  rec.updated_at = now();
  db[auditId] = rec;
  writeJSON(AUDITS, db);
}

// Record a finished stage's real output as it completes (live per-stage detail).
export function appendEvidence(auditId, entry) {
  const db = readJSON(AUDITS, {});
  const rec = db[auditId];
  if (!rec) return;
  rec.evidence = Array.isArray(rec.evidence) ? rec.evidence : [];
  rec.evidence.push({ stage: entry.stage, description: "", summary: entry.summary || "", findings: entry.findings || [] });
  rec.updated_at = now();
  db[auditId] = rec;
  writeJSON(AUDITS, db);
}

// Most-recent audits first — for the Live Audits feed.
export function listAudits(limit = 20) {
  const db = readJSON(AUDITS, {});
  return Object.values(db)
    .sort((a, b) => String(b.started_at || "").localeCompare(String(a.started_at || "")))
    .slice(0, limit);
}

export function finishAudit(auditId, { verdict, risk, fileSha256, verified, attestation, steps, verdictFull }) {
  const db = readJSON(AUDITS, {});
  const rec = db[auditId] || { audit_id: auditId };
  rec.status = "audited";
  rec.stage = 4;
  rec.stage_name = "done";
  rec.verdict = verdict ?? null;
  rec.risk = risk ?? null;
  rec.file_sha256 = fileSha256 ?? null;
  rec.evidence = steps ?? rec.evidence ?? [];
  rec.summary = verdictFull?.summary ?? null;
  rec.capabilities = verdictFull?.capabilities ?? [];
  rec.findings = verdictFull?.findings ?? [];
  rec.recommendation = verdictFull?.recommendation ?? null;
  rec.verified_name = verified?.verified_name ?? null;
  rec.version = verified?.version ?? null;
  rec.saved_path = verified?.path ?? null;
  rec.attestation_reportData = attestation?.reportData ?? null;
  rec.attestation_mocked = attestation ? !!attestation.mocked : null;
  rec.completed_at = now();
  db[auditId] = rec;
  writeJSON(AUDITS, db);
  return rec;
}

// ── attestation store (db/attest.json) — bulky quotes kept out of /api/state ─
export function saveAttestation(auditId, attestation, extra = {}) {
  if (!attestation) return;
  const db = readJSON(ATTEST, {});
  db[auditId] = {
    audit_id: auditId,
    reportData: attestation.reportData ?? null,
    mocked: !!attestation.mocked,
    quote: attestation.quote ?? null,
    event_log: attestation.event_log ?? null,
    vm_config: attestation.vm_config ?? null,
    info: attestation.info ?? null,
    verify: attestation.verify ?? "https://proof.t16z.com/",
    attested_at: attestation.attestedAt ?? now(),
    ...extra,
  };
  writeJSON(ATTEST, db);
}

export function getAttestation(auditId) {
  return readJSON(ATTEST, {})[auditId] || null;
}

// ── derived dashboard state (the single source of truth for the frontend) ───
const STAGE_NAMES = ["Scanner", "Sandbox", "Fork", "Synthesizer"];

export function deriveState() {
  const auditsDb = readJSON(AUDITS, {});
  const reg = readJSON(REGISTRY, {});
  const recs = Object.values(auditsDb).sort((a, b) => String(b.started_at || "").localeCompare(String(a.started_at || "")));

  const audits = recs.map((r) => {
    const ongoing = String(r.status || "").startsWith("auditing");
    const stageIndex = Math.max(0, Math.min(3, (r.stage || 1) - 1));
    const ev = Array.isArray(r.evidence) ? r.evidence : [];
    const steps = STAGE_NAMES.map((stage, i) => ({
      stage,
      status: !ongoing ? "done" : i < stageIndex ? "done" : i === stageIndex ? "running" : "pending",
      detail: ev[i]?.summary || (i === 3 && r.summary) || "",
    }));
    return {
      id: r.audit_id,
      skill: r.skill + (r.version ? `@v${r.version}` : ""),
      auditor: r.agent_id || "mars-auditor",
      agent_id: r.agent_id || "anonymous",
      tier: "T1 · STD",
      state: ongoing ? "ongoing" : "past",
      verdict: r.verdict || "AUDITING",
      stageIndex,
      escrow: "—",
      bond: "—",
      topic: r.attestation_reportData ? "0x" + String(r.attestation_reportData).slice(0, 10) : "—",
      date: r.completed_at || "now",
      steps,
      // final synthesizer output
      risk: r.risk || null,
      summary: r.summary || "",
      capabilities: r.capabilities || [],
      findings: r.findings || [],
      recommendation: r.recommendation || "",
      // attestation pointers (full quote lives in db/attest.json → /api/attest)
      attested: !!r.attestation_reportData,
      attestationMocked: !!r.attestation_mocked,
    };
  });

  const skills = Object.values(reg).map((entry) => {
    const versions = (entry.versions || []).slice().reverse();
    const latest = versions[0] || {};
    const verName = (v) => (v.verified_name || "").replace(entry.skill + "-", "") || "v1";
    return {
      id: entry.skill,
      version: verName(latest),
      verdict: "SAFE",
      trust: 0.9,
      category: "—",
      author: (latest.licensed_agents && latest.licensed_agents[0]) || "—",
      licenses: (latest.licensed_agents || []).length,
      usagePerDay: 0,
      royalty: "—",
      reviews: { rating: 0, count: 0 },
      versions: versions.map((v) => ({ version: verName(v), verdict: "SAFE", date: v.verified_at || "—", auditId: v.audit_id || "—" })),
    };
  });

  const agentIds = [...new Set(recs.map((r) => r.agent_id).filter(Boolean))];
  const users = agentIds.map((id) => ({
    id,
    worldId: "—",
    skills: Object.values(reg).filter((e) => (e.versions || []).some((v) => (v.licensed_agents || []).includes(id))).length,
    spend: 0,
    since: "—",
    rating: 0,
    sessions: recs.filter((r) => r.agent_id === id).length,
    last: recs.find((r) => r.agent_id === id)?.skill || "—",
    active: recs.some((r) => r.agent_id === id && String(r.status).startsWith("auditing")),
  }));

  const stats = {
    auditsInFlight: recs.filter((r) => String(r.status).startsWith("auditing")).length,
    skillsVerified: skills.length,
    flagged: recs.filter((r) => r.verdict === "DANGEROUS").length,
    agents: agentIds.length,
    users: users.length,
    auditors: 0,
  };

  return { stats, audits, skills, auditors: [], users };
}

export function failAudit(auditId, error) {
  const db = readJSON(AUDITS, {});
  const rec = db[auditId] || { audit_id: auditId };
  rec.status = "failed";
  rec.error = String(error);
  rec.completed_at = now();
  db[auditId] = rec;
  writeJSON(AUDITS, db);
  return rec;
}

// ── verified skill store + access grant ─────────────────────────────────────
// Saves files to skills/<name>-v<N> and registers that agentId may use it
// (they paid for the audit). Returns { verified_name, version, path }.
export function saveVerifiedSkill({ skill, files, agentId, auditId, fileSha256 }) {
  const base = sanitize(skill);
  const reg = readJSON(REGISTRY, {});
  const entry = reg[base] || { skill: base, versions: [] };
  const version = entry.versions.length + 1;
  const verifiedName = `${base}-v${version}`;
  const dir = join(SKILLS_DIR, verifiedName);

  for (const f of files) {
    const fp = join(dir, safeRel(f.name));
    mkdirSync(dirname(fp), { recursive: true });
    writeFileSync(fp, f.content);
  }

  entry.versions.push({
    version,
    verified_name: verifiedName,
    path: `skills/${verifiedName}`,
    audit_id: auditId,
    file_sha256: fileSha256,
    licensed_agents: agentId ? [agentId] : [],
    verified_at: now(),
  });
  reg[base] = entry;
  writeJSON(REGISTRY, reg);
  return { verified_name: verifiedName, version, path: `skills/${verifiedName}` };
}
