// ── Shared MARS dataset ──────────────────────────────────────────────────
// One deterministic source of truth for the whole dashboard so the expanded
// views and the block-explorer search all resolve the same entities.
// (No Math.random / Date at module load — SSR-safe.)

export type Verdict = "SAFE" | "DANGEROUS" | "AUDITING";
export type Tier = "T1 · STD" | "T2 · FIN" | "T3 · CRIT";

export interface Skill {
  id: string; // "stripe-payments-v2"
  version: string; // current verified version
  verdict: Verdict;
  trust: number; // 0..1 (HCS-25 trust score)
  category: string;
  author: string; // author agent id
  licenses: number; // active HTS licenses
  usagePerDay: number;
  royalty: string;
  reviews: { rating: number; count: number };
  versions: { version: string; verdict: Verdict; date: string; auditId: string }[];
}

export interface Auditor {
  id: string; // "auditor-01"
  worldId: string;
  status: "auditing" | "active" | "idle";
  rep: number;
  rating: number;
  proposed: number;
  processed: number;
  accuracy: number;
  stake: number;
  region: string;
  spec: string;
  last: string;
}

export interface User {
  id: string; // "0x…"
  worldId: string;
  skills: number;
  spend: number;
  since: string;
  rating: number;
  sessions: number;
  last: string;
  active: boolean;
}

export interface AuditStep {
  stage: "Scanner" | "Sandbox" | "Fork" | "Synthesizer";
  status: "done" | "running" | "pending";
  detail: string;
}

export interface Audit {
  id: string; // "audit-88412"
  skill: string; // "stripe-payments-v2@3.1.0"
  auditor: string; // "auditor-07"
  tier: Tier;
  state: "ongoing" | "past";
  verdict: Verdict;
  stageIndex: number; // 0..3 current/last stage
  escrow: string;
  bond: string;
  topic: string; // HCS audit-trail topic id
  date: string;
  steps: AuditStep[];
}

export const SKILL_NAMES = [
  "stripe-payments-v2",
  "coingecko-price-oracle",
  "twilio-sms-send",
  "uniswap-v3-swap",
  "openai-embed-batch",
  "pdf-extract-tables",
  "plaid-balance-fetch",
  "sendgrid-mailer",
];
const CATEGORIES = ["Payments", "DeFi / oracles", "Messaging", "DeFi", "LLM tools", "Data / PII", "Banking", "Messaging"];
const REGIONS = ["eu-west", "us-east", "ap-south", "sa-east", "af-north", "us-west", "eu-north", "ap-east"];
const SPECS = ["DeFi / oracles", "Payments", "LLM tools", "Data / PII", "Web3 infra", "Messaging", "Contracts", "Identity"];
const A_STATUS: Auditor["status"][] = ["auditing", "active", "idle"];
const TIERS: Tier[] = ["T1 · STD", "T2 · FIN", "T3 · CRIT"];
const STAGES: AuditStep["stage"][] = ["Scanner", "Sandbox", "Fork", "Synthesizer"];

const HEX = "0123456789abcdef";
const hexId = (i: number, n: number) => {
  let s = "";
  for (let k = 0; k < n; k++) s += HEX[(i * (7 + k) + k * 3) % 16];
  return s;
};

const ver = (i: number) => 1 + (i % 4) + "." + (i % 9) + "." + (i % 5);

// ── Auditors ──────────────────────────────────────────────────────────────
export const AUDITORS: Auditor[] = Array.from({ length: 16 }, (_, i) => {
  const proposed = 42 + (i * 17) % 140;
  return {
    id: "auditor-" + String(i + 1).padStart(2, "0"),
    worldId: "wld_" + hexId(i + 3, 10),
    status: A_STATUS[i % 3],
    rep: 0.9 + ((i * 7) % 10) / 100,
    rating: 4.2 + ((i * 3) % 9) / 10,
    proposed,
    processed: Math.floor(proposed * (0.58 + (i % 5) * 0.07)),
    accuracy: 94 + ((i * 5) % 6),
    stake: 1500 + (i % 6) * 750,
    region: REGIONS[i % REGIONS.length],
    spec: SPECS[i % SPECS.length],
    last: i % 3 === 2 ? i * 2 + 3 + "m ago" : i + 1 + "s ago",
  };
});

// ── Users ─────────────────────────────────────────────────────────────────
export const USERS: User[] = Array.from({ length: 20 }, (_, i) => ({
  id: "0x" + hexId(i + 1, 4) + "…" + hexId(i + 9, 2),
  worldId: "wld_" + hexId(i + 5, 10),
  skills: 1 + (i * 5) % 9,
  spend: 200 + (i * 137) % 4400,
  since: ["2024", "2025", "2026"][i % 3] + " · Q" + (1 + (i % 4)),
  rating: 3.8 + ((i * 4) % 12) / 10,
  sessions: i % 5,
  last: SKILL_NAMES[i % SKILL_NAMES.length] + "@" + ver(i),
  active: i % 4 === 0,
}));

// ── Audit step trails ──────────────────────────────────────────────────────
function buildSteps(i: number, verdict: Verdict, stageIndex: number): AuditStep[] {
  const dangerous = verdict === "DANGEROUS";
  const details: Record<AuditStep["stage"], string> = {
    Scanner: "Scanned tool descriptions — 0 hidden directives, " + (i % 3) + " deprecated deps",
    Sandbox: dangerous
      ? "Sandbox: fs read ~/.ssh + call to setApprovalForAll — DENIED"
      : "Sandbox: network → api." + SKILL_NAMES[i % SKILL_NAMES.length].split("-")[0] + ".com only; fs scoped /tmp",
    Fork: "Anvil fork — replayed " + (800 + i * 37) + " txns · 0 reverts · no wallet drain",
    Synthesizer: dangerous
      ? "Verdict DANGEROUS · confidence 0.95 · bond slashed"
      : "Verdict SAFE · confidence 0.9" + (i % 9) + " · Chainlink attestation 0x" + hexId(i + 2, 6),
  };
  return STAGES.map((stage, s) => ({
    stage,
    detail: details[stage],
    status: s < stageIndex ? "done" : s === stageIndex ? (verdict === "AUDITING" ? "running" : "done") : "pending",
  }));
}

// ── Audits (ongoing + past) ─────────────────────────────────────────────────
export const AUDITS: Audit[] = [];
// 5 ongoing
for (let i = 0; i < 5; i++) {
  const stageIndex = i % 4;
  AUDITS.push({
    id: "audit-" + (90100 + i * 7),
    skill: SKILL_NAMES[i % SKILL_NAMES.length] + "@" + ver(i + 1),
    auditor: AUDITORS[(i * 3) % AUDITORS.length].id,
    tier: TIERS[i % 3],
    state: "ongoing",
    verdict: "AUDITING",
    stageIndex,
    escrow: (1500 + (i % 12) * 500).toLocaleString() + " USDC",
    bond: (2000 + (i % 5) * 500).toLocaleString() + " USDC",
    topic: "0.0." + (491800 + i * 13),
    date: "now",
    steps: buildSteps(i, "AUDITING", stageIndex),
  });
}
// 12 past
for (let i = 0; i < 12; i++) {
  const verdict: Verdict = i % 7 === 3 ? "DANGEROUS" : "SAFE";
  AUDITS.push({
    id: "audit-" + (88200 + i * 17),
    skill: SKILL_NAMES[i % SKILL_NAMES.length] + "@" + ver(i),
    auditor: AUDITORS[(i * 5) % AUDITORS.length].id,
    tier: TIERS[i % 3],
    state: "past",
    verdict,
    stageIndex: 3,
    escrow: (1500 + (i % 12) * 500).toLocaleString() + " USDC",
    bond: (2000 + (i % 5) * 500).toLocaleString() + " USDC",
    topic: "0.0." + (490200 + i * 19),
    date: ["2026 · Q2", "2026 · Q1", "2025 · Q4"][i % 3],
    steps: buildSteps(i, verdict, 3),
  });
}

// ── Skills ──────────────────────────────────────────────────────────────---
export const SKILLS: Skill[] = SKILL_NAMES.map((name, i) => {
  const past = AUDITS.filter((a) => a.state === "past" && a.skill.startsWith(name + "@"));
  const versions = (past.length ? past : [AUDITS[i % AUDITS.length]]).slice(0, 3).map((a) => ({
    version: a.skill.split("@")[1],
    verdict: a.verdict,
    date: a.date,
    auditId: a.id,
  }));
  return {
    id: name,
    version: versions[0]?.version ?? ver(i),
    verdict: (i % 7 === 3 ? "DANGEROUS" : "SAFE") as Verdict,
    trust: 0.82 + ((i * 5) % 16) / 100,
    category: CATEGORIES[i % CATEGORIES.length],
    author: "0x" + hexId(i + 2, 4) + "…" + hexId(i + 6, 2),
    licenses: 40 + (i * 53) % 320,
    usagePerDay: 12 + (i * 17) % 90,
    royalty: 3 + (i % 4) + "%",
    reviews: { rating: 4.1 + ((i * 3) % 9) / 10, count: 18 + (i * 7) % 60 },
    versions,
  };
});

// ── Universal lookup (the block explorer) ───────────────────────────────────
export type LookupResult =
  | { type: "skill"; data: Skill }
  | { type: "auditor"; data: Auditor }
  | { type: "user"; data: User }
  | { type: "audit"; data: Audit };

export function lookup(raw: string): LookupResult | null {
  const q = raw.trim().toLowerCase();
  if (!q) return null;
  const skill = SKILLS.find((s) => s.id.toLowerCase() === q || q.startsWith(s.id.toLowerCase()) || s.id.toLowerCase().includes(q));
  const auditor = AUDITORS.find((a) => a.id.toLowerCase() === q || a.id.toLowerCase().includes(q) || a.worldId.toLowerCase() === q);
  const user = USERS.find((u) => u.id.toLowerCase() === q || u.id.toLowerCase().includes(q) || u.worldId.toLowerCase() === q);
  const audit = AUDITS.find((a) => a.id.toLowerCase() === q || a.id.toLowerCase().includes(q) || a.topic.toLowerCase() === q);
  // priority: exact-ish audit / auditor / user (specific ids) before fuzzy skill
  if (audit && (q.startsWith("audit") || q.startsWith("0.0."))) return { type: "audit", data: audit };
  if (auditor && q.startsWith("auditor")) return { type: "auditor", data: auditor };
  if (user && q.startsWith("0x")) return { type: "user", data: user };
  if (skill) return { type: "skill", data: skill };
  if (audit) return { type: "audit", data: audit };
  if (auditor) return { type: "auditor", data: auditor };
  if (user) return { type: "user", data: user };
  return null;
}

export const VERDICT_COLOR: Record<Verdict, string> = {
  SAFE: "var(--safe)",
  DANGEROUS: "var(--danger)",
  AUDITING: "var(--warn)",
};
