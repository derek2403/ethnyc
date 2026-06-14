import { useEffect, useState } from "react";
import type { Audit } from "./marsData";
import { AuditDetail, SectionTitle } from "./MarsUI";

// SkillAuditHistory — for a verified skill, fetches the full explorer detail
// (/api/explorer?q=<name>) and renders, per version, the complete audit:
// the 4-stage trail, the synthesizer verdict (summary · capabilities · findings ·
// recommendation), and the TEE attestation (reportData + TDX quote + verify link).
// Reuses MarsUI's AuditDetail so the styling matches the search/explorer views.

interface ExpFinding {
  severity: string;
  title: string;
  detail: string;
}
interface ExpAudit {
  id: string;
  skill: string;
  verdict: "SAFE" | "DANGEROUS";
  risk?: string | null;
  auditor?: string | null;
  completed_at?: string | null;
  synthesizer: { summary?: string | null; capabilities: string[]; findings: ExpFinding[]; recommendation?: string | null };
  trail: { stage: string; summary?: string; findings: ExpFinding[] }[];
}
interface ExpVersion {
  version: number;
  verified_name: string;
  verified_at?: string;
  audit_id: string;
  licensed_agents: string[];
  audit: ExpAudit | null;
}
interface ExpSkill {
  type: "skill";
  id: string;
  versions: ExpVersion[];
}

const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

// Map an explorer audit into the Audit shape AuditDetail expects. The 4-stage
// pipeline = the 3 trail stages (scanner/sandbox/fork) + the synthesizer.
function toAudit(v: ExpVersion): Audit {
  const a = v.audit as ExpAudit;
  const steps = [
    ...a.trail.map((t) => ({ stage: cap(t.stage) as Audit["steps"][number]["stage"], status: "done" as const, detail: t.summary || "" })),
    { stage: "Synthesizer" as const, status: "done" as const, detail: a.synthesizer.summary || "" },
  ];
  return {
    id: a.id,
    skill: a.skill,
    auditor: a.auditor || "—",
    tier: "T1 · STD",
    state: "past",
    verdict: a.verdict,
    stageIndex: 3,
    escrow: "—",
    bond: "—",
    topic: a.id, // the HCS task topic = the audit trail
    date: (a.completed_at || "").replace("T", " ").slice(0, 19) || "—",
    steps,
    risk: a.risk || null,
    summary: a.synthesizer.summary || "",
    capabilities: a.synthesizer.capabilities || [],
    findings: a.synthesizer.findings || [],
    recommendation: a.synthesizer.recommendation || "",
    attested: false,
    attestationMocked: false,
  };
}

export default function SkillAuditHistory({ skillId }: { skillId: string }) {
  const [skill, setSkill] = useState<ExpSkill | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let alive = true;
    setLoading(true);
    fetch(`/api/explorer?q=${encodeURIComponent(skillId)}&exact=1`)
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (!alive) return;
        setSkill(d?.match?.type === "skill" ? (d.match as ExpSkill) : null);
        setLoading(false);
      })
      .catch(() => alive && setLoading(false));
    return () => {
      alive = false;
    };
  }, [skillId]);

  if (loading) return <div style={{ fontSize: 12, color: "var(--ink-3)", marginTop: 22 }}>loading audit trail & attestation…</div>;
  const versions = (skill?.versions || []).filter((v) => v.audit).slice().reverse(); // newest first
  if (!versions.length) return null;

  return (
    <div style={{ marginTop: 28, display: "flex", flexDirection: "column", gap: 20 }}>
      <SectionTitle right={<span style={{ fontSize: 10, color: "var(--ink-3)" }}>{versions.length} audit{versions.length > 1 ? "s" : ""}</span>}>
        Audit trail · synthesizer · attestation
      </SectionTitle>
      {versions.map((v) => (
        <div key={v.version} style={{ border: "1px solid var(--hair)", borderRadius: 12, padding: 18, background: "var(--cell)" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 14 }}>
            <span style={{ fontSize: 12.5, fontWeight: 600, color: "var(--ink)" }}>v{v.version}</span>
            <a
              href={`https://hashscan.io/testnet/topic/${v.audit_id}`}
              target="_blank"
              rel="noopener noreferrer"
              style={{ fontSize: 10.5, color: "var(--ink-3)", fontFamily: "var(--code)", textDecoration: "none" }}
            >
              {v.audit_id} ↗
            </a>
          </div>
          <AuditDetail a={toAudit(v)} />
        </div>
      ))}
    </div>
  );
}
