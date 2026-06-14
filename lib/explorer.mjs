// lib/explorer.mjs — the MARS block explorer index.
//
// Reads ALL of db/*.json and builds one searchable index over every id on the
// platform, then resolves a query into a fully cross-linked detail object. One place
// to answer "what is this id / name?" — users, auditors, skills, audits, the audit
// trail, attestations, ratings, and every comment an auditor received.
//
// Four entity types, each cross-linked to the others:
//   user    — an agent that requests audits + gets skills licensed
//   auditor — an agent that performs audits + receives ratings/comments
//   skill   — a verified package (one or more versions, each from an audit)
//   audit   — one audit run (id == the HCS task topic that holds its trail)
//
// Indexed ids (any of these resolves): account ids (0.0.x), evm addresses (0x…),
// World human ids, HCS topic ids (profile / voting / review / task), audit ids,
// verified skill names + versioned names, and file sha256 hashes.

import { readFileSync } from "node:fs";
import { join } from "node:path";

const DB_DIR = join(process.cwd(), "db");
const read = (name) => {
  try {
    return JSON.parse(readFileSync(join(DB_DIR, name), "utf8"));
  } catch {
    return {};
  }
};

// Never expose secrets (the encrypted private key) through the explorer.
const SENSITIVE = new Set(["encrypted_key", "privateKey", "private_key"]);
function clean(obj) {
  if (!obj || typeof obj !== "object") return obj;
  const out = {};
  for (const [k, v] of Object.entries(obj)) if (!SENSITIVE.has(k)) out[k] = v;
  return out;
}

const hashscan = (kind, id) => `https://hashscan.io/testnet/${kind}/${id}`;
const lower = (s) => String(s ?? "").toLowerCase();

/** Load the raw db once per call (cheap; reflects live state). */
function load() {
  return {
    users: read("users.json"),
    auditors: read("auditors.json"),
    skills: read("skills.json"),
    audits: read("audits.json"),
    attest: read("attest.json"),
  };
}

// ── id index ────────────────────────────────────────────────────────────────
// Map every searchable token → { type, key }. `key` is the primary key of the
// entity in its db file (agent_id, skill name, or audit_id).
function buildIndex(db) {
  const index = new Map(); // token(lowercased) → { type, key, via }
  const add = (token, type, key, via) => {
    const t = lower(token);
    if (t && !index.has(t)) index.set(t, { type, key, via });
  };

  for (const [id, u] of Object.entries(db.users)) {
    add(id, "user", id, "agent_id");
    add(u.evm_address, "user", id, "evm");
    add(u.human_id, "user", id, "human_id");
    add(u.profile_topic, "user", id, "profile_topic");
    add(u.voting_topic, "user", id, "voting_topic");
    add(u.review_topic, "user", id, "review_topic");
  }
  for (const [id, a] of Object.entries(db.auditors)) {
    add(id, "auditor", id, "agent_id");
    add(a.evm_address, "auditor", id, "evm");
    add(a.human_id, "auditor", id, "human_id");
    add(a.profile_topic, "auditor", id, "profile_topic");
    add(a.voting_topic, "auditor", id, "voting_topic");
    add(a.review_topic, "auditor", id, "review_topic");
  }
  for (const [name, s] of Object.entries(db.skills)) {
    add(name, "skill", name, "name");
    for (const v of s.versions || []) {
      add(v.verified_name, "skill", name, "verified_name");
      add(v.file_sha256, "skill", name, "file_sha256");
      // a version's audit_id also resolves to the audit
      if (v.audit_id) add(v.audit_id, "audit", v.audit_id, "version_audit");
    }
  }
  for (const [id, r] of Object.entries(db.audits)) {
    add(id, "audit", id, "audit_id"); // id == HCS task topic
    add(r.file_sha256, "audit", id, "file_sha256");
    add(r.attestation_reportData, "audit", id, "attestation_reportData");
  }
  return index;
}

// ── detail builders (each cross-links to the others) ─────────────────────────

function auditSummary(r) {
  return {
    audit_id: r.audit_id,
    skill: r.skill,
    verdict: r.verdict,
    risk: r.risk ?? null,
    requester: r.agent_id,
    auditor: r.auditor ?? null,
    model: r.model ?? null,
    status: r.status,
    date: r.completed_at || r.started_at || null,
    attested: !!r.attestation_reportData,
    task_topic: r.audit_id,
    hashscan: hashscan("topic", r.audit_id),
  };
}

function userDetail(db, id) {
  const u = clean(db.users[id]) || { agent_id: id, role: "user", note: "unregistered (seen via audits)" };
  const auditsRequested = Object.values(db.audits).filter((r) => r.agent_id === id).map(auditSummary);
  const licensedSkills = [];
  for (const [name, s] of Object.entries(db.skills)) {
    for (const v of s.versions || []) {
      if ((v.licensed_agents || []).includes(id))
        licensedSkills.push({ skill: name, version: v.version, verified_name: v.verified_name, audit_id: v.audit_id, path: v.path, verified_at: v.verified_at });
    }
  }
  // reviews the user wrote (prefer the record's own list, else derive from auditors)
  let reviewsGiven = Array.isArray(db.users[id]?.reviews_given) ? db.users[id].reviews_given : [];
  if (!reviewsGiven.length) {
    for (const [aid, a] of Object.entries(db.auditors))
      for (const rv of a.reviews || []) if (rv.reviewer === id) reviewsGiven.push({ auditor: aid, ...rv });
  }
  return {
    type: "user",
    id,
    profile: u,
    links: {
      account: hashscan("account", id),
      evm: u.evm_address ? hashscan("account", u.evm_address) : null,
      profileTopic: u.profile_topic ? hashscan("topic", u.profile_topic) : null,
      votingTopic: u.voting_topic ? hashscan("topic", u.voting_topic) : null,
      reviewTopic: u.review_topic ? hashscan("topic", u.review_topic) : null,
    },
    stats: { audits_requested: auditsRequested.length, skills_licensed: licensedSkills.length, reviews_given: reviewsGiven.length, world_verified: !!u.world_verified },
    auditsRequested,
    licensedSkills,
    reviewsGiven,
  };
}

function auditorDetail(db, id) {
  const a = clean(db.auditors[id]) || { agent_id: id, role: "auditor" };
  const auditsPerformed = Object.values(db.audits).filter((r) => r.auditor === id).map(auditSummary);
  const reviewsReceived = Array.isArray(a.reviews) ? a.reviews : [];
  const ratings = reviewsReceived.map((r) => Number(r.rating) || 0);
  const avg = ratings.length ? (ratings.reduce((s, n) => s + n, 0) / ratings.length).toFixed(1) : a.rating ?? "—";
  return {
    type: "auditor",
    id,
    profile: a,
    links: {
      account: hashscan("account", id),
      evm: a.evm_address ? hashscan("account", a.evm_address) : null,
      reviewTopic: a.review_topic ? hashscan("topic", a.review_topic) : null,
      votingTopic: a.voting_topic ? hashscan("topic", a.voting_topic) : null,
      profileTopic: a.profile_topic ? hashscan("topic", a.profile_topic) : null,
    },
    stats: {
      rating: avg,
      review_count: reviewsReceived.length,
      audits_performed: auditsPerformed.length,
      safe: auditsPerformed.filter((x) => x.verdict === "SAFE").length,
      dangerous: auditsPerformed.filter((x) => x.verdict === "DANGEROUS").length,
      world_verified: !!a.world_verified,
    },
    reviewsReceived, // every comment + rating this auditor got (with reviewer, skill, verdict, seqs)
    auditsPerformed,
  };
}

function skillDetail(db, name) {
  const s = db.skills[name] || { skill: name, versions: [] };
  const versions = (s.versions || []).map((v) => {
    const audit = db.audits[v.audit_id];
    return {
      version: v.version,
      verified_name: v.verified_name,
      path: v.path,
      file_sha256: v.file_sha256,
      verified_at: v.verified_at,
      licensed_agents: v.licensed_agents || [],
      audit_id: v.audit_id,
      audit: audit ? auditDetail(db, v.audit_id) : null, // full audit incl. trail + attestation
    };
  });
  const latest = versions[versions.length - 1] || null;
  const licensed = new Set();
  for (const v of versions) for (const ag of v.licensed_agents) licensed.add(ag);
  // any audits of this skill name that didn't get verified (e.g. DANGEROUS)
  const allAudits = Object.values(db.audits).filter((r) => r.skill === name).map(auditSummary);
  return {
    type: "skill",
    id: name,
    name,
    latest_verdict: latest ? (latest.audit?.verdict ?? "SAFE") : null,
    version_count: versions.length,
    licensed_agents: [...licensed],
    versions,
    audits: allAudits, // every audit run against this skill name (verified or not)
  };
}

function auditDetail(db, id) {
  const r = db.audits[id];
  if (!r) return { type: "audit", id, error: "audit not found" };
  // attestation: prefer the embedded one, else the attest.json store (full TDX quote + TCB)
  const att = r.attestation || db.attest[id] || null;
  // the verified skill version this audit produced (if any)
  let producedVersion = null;
  for (const [name, s] of Object.entries(db.skills))
    for (const v of s.versions || []) if (v.audit_id === id) producedVersion = { skill: name, version: v.version, verified_name: v.verified_name, path: v.path, licensed_agents: v.licensed_agents || [] };
  // the review this task generated (auditor's review whose task_topic == this audit/task id)
  let review = null;
  if (r.auditor && db.auditors[r.auditor])
    review = (db.auditors[r.auditor].reviews || []).find((rv) => rv.task_topic === id) || null;
  return {
    type: "audit",
    id,
    skill: r.skill,
    verdict: r.verdict,
    risk: r.risk ?? null,
    status: r.status,
    model: r.model ?? null,
    files: r.files || [],
    requester: r.agent_id,
    auditor: r.auditor ?? null,
    file_sha256: r.file_sha256 ?? null,
    started_at: r.started_at ?? null,
    completed_at: r.completed_at ?? null,
    // the synthesizer's verdict
    synthesizer: { summary: r.summary ?? null, capabilities: r.capabilities || [], findings: r.findings || [], recommendation: r.recommendation ?? null },
    // the on-chain audit trail (each pipeline stage's real evidence)
    trail: (r.evidence || []).map((e) => ({ stage: e.stage, summary: e.summary, findings: e.findings || [] })),
    // the TEE attestation (incl. the full TDX quote + TCB measurements)
    attestation: att
      ? {
          reportData: att.reportData ?? null,
          mocked: !!att.mocked,
          verify: att.verify ?? "https://proof.t16z.com/",
          app_id: att.info?.app_id ?? null,
          instance_id: att.info?.instance_id ?? null,
          tcb: att.info?.tcb_info ? { mrtd: att.info.tcb_info.mrtd, rtmr0: att.info.tcb_info.rtmr0, os_image_hash: att.info.tcb_info.os_image_hash, compose_hash: att.info.tcb_info.compose_hash } : null,
          quote: att.quote ?? null, // full hex TDX quote (paste into the explorer)
        }
      : null,
    producedVersion,
    review, // the rating + comment the requester left for the auditor on this task
    links: { task_topic: hashscan("topic", id), requester: hashscan("account", r.agent_id), auditor: r.auditor ? hashscan("account", r.auditor) : null },
  };
}

// ── public API ───────────────────────────────────────────────────────────────

const BUILDERS = { user: userDetail, auditor: auditorDetail, skill: skillDetail, audit: auditDetail };

/** Resolve an exact-ish query → a fully detailed entity, or null. */
export function resolve(query) {
  const db = load();
  const index = buildIndex(db);
  const q = lower(String(query || "").trim());
  if (!q) return null;
  let hit = index.get(q); // exact
  if (!hit) {
    // prefix / substring fallback (first match wins; search() returns all)
    for (const [token, v] of index) if (token.startsWith(q) || token.includes(q)) { hit = v; break; }
  }
  if (!hit) return null;
  return BUILDERS[hit.type](db, hit.key);
}

/** Partial search → a ranked list of lightweight matches (for autocomplete / chips). */
export function search(query, limit = 25) {
  const db = load();
  const q = lower(String(query || "").trim());
  const out = [];
  const seen = new Set();
  const push = (type, id, label, subtitle) => {
    const k = `${type}:${id}`;
    if (seen.has(k)) return;
    seen.add(k);
    out.push({ type, id, label, subtitle });
  };
  const match = (s) => !q || lower(s).includes(q);

  for (const [name, s] of Object.entries(db.skills)) if (match(name)) push("skill", name, name, `${(s.versions || []).length} version(s)`);
  for (const [id, r] of Object.entries(db.audits)) if (match(id) || match(r.skill)) push("audit", id, id, `${r.skill} · ${r.verdict || r.status}`);
  for (const [id, a] of Object.entries(db.auditors)) if (match(id) || match(a.evm_address) || match(a.human_id)) push("auditor", id, id, `auditor · ★${a.rating ?? "—"} · ${(a.reviews || []).length} review(s)`);
  for (const [id, u] of Object.entries(db.users)) if (match(id) || match(u.evm_address) || match(u.human_id)) push("user", id, id, `user${u.world_verified ? " · World✓" : ""}`);

  return out.slice(0, limit);
}

/** Everything, grouped by type — for a "browse all" view + sample ids for chips. */
export function listAll() {
  const db = load();
  const agents = [...Object.values(db.auditors), ...Object.values(db.users)];
  const sampleEvm = agents.find((a) => a.evm_address)?.evm_address || null;
  const sampleTopic = agents.find((a) => a.profile_topic)?.profile_topic || null;
  return {
    counts: { users: Object.keys(db.users).length, auditors: Object.keys(db.auditors).length, skills: Object.keys(db.skills).length, audits: Object.keys(db.audits).length },
    skills: Object.keys(db.skills),
    audits: Object.entries(db.audits).map(([id, r]) => ({ id, skill: r.skill, verdict: r.verdict || r.status })),
    auditors: Object.keys(db.auditors),
    users: Object.keys(db.users),
    _sampleEvm: sampleEvm,
    _sampleTopic: sampleTopic,
  };
}

// ── search templates (documented query shapes the explorer understands) ───────
export const SEARCH_TEMPLATES = [
  { label: "Skill name", type: "skill", example: "index", hint: "all versions, each version's audit + trail + attestation + licensed agents" },
  { label: "Verified name", type: "skill", example: "index-v1", hint: "a specific verified skill version" },
  { label: "Audit / task id", type: "audit", example: "0.0.9229334", hint: "full audit: 4-stage trail, synthesizer verdict, TDX quote, requester review" },
  { label: "Auditor id", type: "auditor", example: "0.0.9227928", hint: "rating, every comment received, and all audits performed" },
  { label: "User / agent id", type: "user", example: "0.0.9227937", hint: "licensed skills, audits requested, reviews given" },
  { label: "EVM address", type: "user|auditor", example: "0x705e…", hint: "resolves the owning agent" },
  { label: "World human id", type: "user|auditor", example: "0xd0ef…", hint: "the World-ID verified human behind an agent" },
  { label: "HCS topic", type: "user|auditor", example: "0.0.9228436", hint: "profile / voting / review topic → its owning agent" },
  { label: "File sha256", type: "skill|audit", example: "ad80b2b9…", hint: "the audited bytes → the skill version / audit" },
];
