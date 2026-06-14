// ── MARS types + lookup ─────────────────────────────────────────────────
// No data lives here anymore — the JSON DB (db/*.json) is the single source of
// truth, served by /api/state and polled via the MarsProvider (marsState.tsx).

export type Verdict = "SAFE" | "DANGEROUS" | "AUDITING";
export type Tier = string;

export interface Skill {
  id: string;
  version: string;
  verdict: Verdict;
  trust: number;
  category: string;
  author: string;
  licenses: number;
  usagePerDay: number;
  royalty: string;
  reviews: { rating: number; count: number };
  versions: { version: string; verdict: Verdict; date: string; auditId: string }[];
}

// On-chain identity fields a registered agent carries (from db/users.json +
// db/auditors.json via deriveState). Optional — older/derived rows may lack them.
export interface AgentIdentity {
  evm?: string | null;
  role?: "user" | "auditor" | string | null;
  worldVerified?: boolean;
  humanId?: string | null;
  profileTopic?: string | null;
  votingTopic?: string | null;
  reviewTopic?: string | null;
  accountMemo?: string | null;
  registrySeq?: string | number | null;
  registeredAt?: string | null;
}

export interface Auditor extends AgentIdentity {
  id: string;
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

export interface User extends AgentIdentity {
  id: string;
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
  id: string;
  skill: string;
  auditor: string;
  agent_id?: string;
  tier: Tier;
  state: "ongoing" | "past";
  verdict: Verdict;
  stageIndex: number;
  escrow: string;
  bond: string;
  topic: string;
  date: string;
  steps: AuditStep[];
  // final synthesizer output (optional — present once audited)
  risk?: string | null;
  summary?: string;
  capabilities?: string[];
  findings?: { severity: string; title: string; detail: string }[];
  recommendation?: string;
  attested?: boolean;
  attestationMocked?: boolean;
}

export interface Stats {
  auditsInFlight: number;
  skillsVerified: number;
  flagged: number;
  agents: number;
  users: number;
  auditors: number;
}

export interface MarsState {
  stats: Stats;
  audits: Audit[];
  skills: Skill[];
  auditors: Auditor[];
  users: User[];
}

export const EMPTY_STATE: MarsState = {
  stats: { auditsInFlight: 0, skillsVerified: 0, flagged: 0, agents: 0, users: 0, auditors: 0 },
  audits: [],
  skills: [],
  auditors: [],
  users: [],
};

export const VERDICT_COLOR: Record<Verdict, string> = {
  SAFE: "var(--safe)",
  DANGEROUS: "var(--danger)",
  AUDITING: "var(--warn)",
};

export type LookupResult =
  | { type: "skill"; data: Skill }
  | { type: "auditor"; data: Auditor }
  | { type: "user"; data: User }
  | { type: "audit"; data: Audit };

// Resolve any id against the live state.
export function lookup(state: MarsState, raw: string): LookupResult | null {
  const q = raw.trim().toLowerCase();
  if (!q) return null;
  const skill = state.skills.find((s) => s.id.toLowerCase() === q || s.id.toLowerCase().includes(q));
  const auditor = state.auditors.find((a) => a.id.toLowerCase() === q || a.id.toLowerCase().includes(q));
  const user = state.users.find((u) => u.id.toLowerCase() === q || u.id.toLowerCase().includes(q));
  const audit = state.audits.find((a) => a.id.toLowerCase() === q || a.id.toLowerCase().includes(q) || (a.topic || "").toLowerCase() === q);
  if (audit && (q.startsWith("audit") || q.startsWith("0x"))) return { type: "audit", data: audit };
  if (auditor && q.startsWith("auditor")) return { type: "auditor", data: auditor };
  if (user && q.startsWith("0x")) return { type: "user", data: user };
  if (skill) return { type: "skill", data: skill };
  if (audit) return { type: "audit", data: audit };
  if (auditor) return { type: "auditor", data: auditor };
  if (user) return { type: "user", data: user };
  return null;
}
