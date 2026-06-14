import type { Audit } from "./marsData";
import { AuditDetail, Eyebrow, Row, SectionTitle, Tiles, VerdictPill } from "./MarsUI";

// ExplorerResult — renders a fully-detailed entity returned by /api/explorer.
// Handles all four types and surfaces everything: a skill's versions + per-version
// audit (trail + synthesizer + attestation), an auditor's rating + every comment it
// received + audits performed, a user's licensed skills + audits requested + reviews
// given, and a single audit's complete record.

/* eslint-disable @typescript-eslint/no-explicit-any */
const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);
const star = (n: number) => "★".repeat(Math.max(0, Math.min(5, Math.round(Number(n) || 0))));
const short = (s?: string | null, n = 18) => (s ? (s.length > n ? s.slice(0, n) + "…" : s) : "—");
const hs = (kind: string, id: string) => `https://hashscan.io/testnet/${kind}/${id}`;

// Map an explorer audit detail into the Audit shape AuditDetail expects (trail +
// synthesizer as the 4th stage), so we reuse the same renderer everywhere.
function toAudit(a: any): Audit {
  const steps = [
    ...(a.trail || []).map((t: any) => ({ stage: cap(t.stage) as Audit["steps"][number]["stage"], status: "done" as const, detail: t.summary || "" })),
    { stage: "Synthesizer" as const, status: "done" as const, detail: a.synthesizer?.summary || "" },
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
    topic: a.id,
    date: (a.completed_at || "").replace("T", " ").slice(0, 19) || "—",
    steps,
    risk: a.risk || null,
    summary: a.synthesizer?.summary || "",
    capabilities: a.synthesizer?.capabilities || [],
    findings: a.synthesizer?.findings || [],
    recommendation: a.synthesizer?.recommendation || "",
    attested: !!a.attestation,
    attestationMocked: !!a.attestation?.mocked,
  };
}

function Mono({ children }: { children: React.ReactNode }) {
  return <span style={{ fontFamily: "var(--code)", fontSize: 11 }}>{children}</span>;
}
function Link({ href, children }: { href?: string | null; children: React.ReactNode }) {
  if (!href) return <span style={{ color: "var(--ink-3)" }}>{children}</span>;
  return (
    <a href={href} target="_blank" rel="noopener noreferrer" style={{ color: "var(--comm)", textDecoration: "none", fontFamily: "var(--code)", fontSize: 11 }}>
      {children} ↗
    </a>
  );
}

// A single review/comment card (used by auditor "received" and user "given").
function ReviewCard({ r, who }: { r: any; who: "reviewer" | "auditor" }) {
  const verdictColor = r.verdict === "DANGEROUS" ? "var(--danger)" : "var(--safe)";
  return (
    <div style={{ background: "var(--panel)", border: "1px solid var(--hair-soft)", borderLeft: "3px solid var(--warn)", borderRadius: 10, padding: "10px 12px" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
        <span style={{ color: "var(--warn)", fontSize: 12, letterSpacing: ".05em" }}>{star(r.rating)}</span>
        <span style={{ fontSize: 11.5, color: "var(--ink)", fontWeight: 600 }}>{r.skill}</span>
        <span style={{ fontSize: 9.5, fontWeight: 600, color: verdictColor, border: `1px solid ${verdictColor}`, borderRadius: 5, padding: "1px 6px" }}>{r.verdict}</span>
        <span style={{ marginLeft: "auto", fontSize: 10, color: "var(--ink-3)" }}>{(r.at || "").slice(0, 10)}</span>
      </div>
      <div style={{ fontSize: 12, color: "var(--ink-2)", marginTop: 6, lineHeight: 1.5 }}>“{r.comment}”</div>
      <div style={{ display: "flex", gap: 12, marginTop: 7, fontSize: 10, color: "var(--ink-3)" }}>
        <span>{who === "reviewer" ? "by" : "to"} <Mono>{who === "reviewer" ? r.reviewer : r.auditor}</Mono></span>
        {r.task_topic && <Link href={hs("topic", r.task_topic)}>task {short(r.task_topic, 12)}</Link>}
        {r.review_seq && <span>review seq {r.review_seq}</span>}
      </div>
    </div>
  );
}

function AuditRow({ a, onPick }: { a: any; onPick?: (id: string) => void }) {
  const c = a.verdict === "DANGEROUS" ? "var(--danger)" : a.verdict === "SAFE" ? "var(--safe)" : "var(--warn)";
  return (
    <button
      onClick={() => onPick?.(a.audit_id)}
      style={{ textAlign: "left", cursor: onPick ? "pointer" : "default", border: "1px solid var(--hair-soft)", background: "transparent", borderRadius: 8, padding: "8px 11px", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10 }}
    >
      <span style={{ minWidth: 0 }}>
        <span style={{ fontSize: 12, color: "var(--ink)" }}>{a.skill}</span>
        <span style={{ display: "block", fontFamily: "var(--code)", fontSize: 10, color: "var(--ink-3)", overflow: "hidden", whiteSpace: "nowrap", textOverflow: "ellipsis" }}>{a.audit_id}</span>
      </span>
      <span style={{ fontSize: 10, fontWeight: 600, color: c, border: `1px solid ${c}`, borderRadius: 5, padding: "2px 7px", flex: "none" }}>{a.verdict || a.status}</span>
    </button>
  );
}

const panel = { display: "flex", flexDirection: "column" as const, gap: 18 };

export default function ExplorerResult({ data, onPick }: { data: any; onPick?: (q: string) => void }) {
  if (!data) return null;

  // ── AUDIT ──
  if (data.type === "audit") return <AuditDetail a={toAudit(data)} />;

  // ── AUDITOR ──
  if (data.type === "auditor") {
    const s = data.stats || {};
    return (
      <div style={panel}>
        <div>
          <Eyebrow color="var(--comm)">Auditor agent</Eyebrow>
          <div style={{ fontSize: 20, fontWeight: 600, marginTop: 4 }}>{data.id}</div>
          <div style={{ display: "flex", gap: 8, marginTop: 10, flexWrap: "wrap" }}>
            {s.world_verified && <span style={{ fontSize: 10, color: "var(--safe)", border: "1px solid var(--safe)", borderRadius: 6, padding: "3px 9px" }}>✓ World ID</span>}
            <span style={{ fontSize: 10, color: "var(--warn)", border: "1px solid var(--hair)", borderRadius: 6, padding: "3px 9px" }}>{star(s.rating)} {s.rating}</span>
          </div>
        </div>
        <Tiles items={[{ value: s.audits_performed ?? 0, label: "audits done" }, { value: s.review_count ?? 0, label: "reviews" }, { value: `${s.safe ?? 0}/${s.dangerous ?? 0}`, label: "safe / dang" }]} />
        <div style={{ display: "flex", flexDirection: "column", gap: 8, background: "var(--panel)", border: "1px solid var(--hair-soft)", borderRadius: 10, padding: "12px 14px" }}>
          <Row label="Account" value={<Link href={data.links?.account}>{data.id}</Link>} />
          <Row label="Review topic" value={<Link href={data.links?.reviewTopic}>{short(data.profile?.review_topic)}</Link>} />
          <Row label="Voting topic" value={<Link href={data.links?.votingTopic}>{short(data.profile?.voting_topic)}</Link>} />
          {data.profile?.evm_address && <Row label="EVM" value={<Mono>{short(data.profile.evm_address, 22)}</Mono>} />}
        </div>
        {!!data.reviewsReceived?.length && (
          <div>
            <SectionTitle right={<span style={{ fontSize: 10, color: "var(--ink-3)" }}>{data.reviewsReceived.length}</span>}>Comments received</SectionTitle>
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {data.reviewsReceived.map((r: any, i: number) => <ReviewCard key={i} r={r} who="reviewer" />)}
            </div>
          </div>
        )}
        {!!data.auditsPerformed?.length && (
          <div>
            <SectionTitle right={<span style={{ fontSize: 10, color: "var(--ink-3)" }}>{data.auditsPerformed.length}</span>}>Audits performed</SectionTitle>
            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              {data.auditsPerformed.map((a: any) => <AuditRow key={a.audit_id} a={a} onPick={onPick} />)}
            </div>
          </div>
        )}
      </div>
    );
  }

  // ── USER ──
  if (data.type === "user") {
    const s = data.stats || {};
    return (
      <div style={panel}>
        <div>
          <Eyebrow color="var(--warn)">User agent</Eyebrow>
          <div style={{ fontSize: 20, fontWeight: 600, marginTop: 4 }}>{data.id}</div>
          <div style={{ display: "flex", gap: 8, marginTop: 10, flexWrap: "wrap" }}>
            {s.world_verified ? <span style={{ fontSize: 10, color: "var(--safe)", border: "1px solid var(--safe)", borderRadius: 6, padding: "3px 9px" }}>✓ World ID</span> : <span style={{ fontSize: 10, color: "var(--ink-3)", border: "1px solid var(--hair)", borderRadius: 6, padding: "3px 9px" }}>unverified</span>}
          </div>
        </div>
        <Tiles items={[{ value: s.skills_licensed ?? 0, label: "licensed" }, { value: s.audits_requested ?? 0, label: "audits asked" }, { value: s.reviews_given ?? 0, label: "reviews given" }]} />
        <div style={{ display: "flex", flexDirection: "column", gap: 8, background: "var(--panel)", border: "1px solid var(--hair-soft)", borderRadius: 10, padding: "12px 14px" }}>
          <Row label="Account" value={<Link href={data.links?.account}>{data.id}</Link>} />
          {data.profile?.evm_address && <Row label="EVM" value={<Mono>{short(data.profile.evm_address, 22)}</Mono>} />}
          <Row label="Profile topic" value={<Link href={data.links?.profileTopic}>{short(data.profile?.profile_topic)}</Link>} />
        </div>
        {!!data.licensedSkills?.length && (
          <div>
            <SectionTitle>Licensed skills</SectionTitle>
            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              {data.licensedSkills.map((sk: any, i: number) => (
                <button key={i} onClick={() => onPick?.(sk.skill)} style={{ textAlign: "left", cursor: onPick ? "pointer" : "default", border: "1px solid var(--hair-soft)", background: "transparent", borderRadius: 8, padding: "8px 11px", display: "flex", justifyContent: "space-between", gap: 10 }}>
                  <span style={{ fontSize: 12, color: "var(--ink)" }}>{sk.skill} <span style={{ color: "var(--ink-3)" }}>v{sk.version}</span></span>
                  <span style={{ fontFamily: "var(--code)", fontSize: 10, color: "var(--ink-3)" }}>{short(sk.audit_id, 12)}</span>
                </button>
              ))}
            </div>
          </div>
        )}
        {!!data.auditsRequested?.length && (
          <div>
            <SectionTitle>Audits requested</SectionTitle>
            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              {data.auditsRequested.map((a: any) => <AuditRow key={a.audit_id} a={a} onPick={onPick} />)}
            </div>
          </div>
        )}
        {!!data.reviewsGiven?.length && (
          <div>
            <SectionTitle right={<span style={{ fontSize: 10, color: "var(--ink-3)" }}>{data.reviewsGiven.length}</span>}>Reviews given</SectionTitle>
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {data.reviewsGiven.map((r: any, i: number) => <ReviewCard key={i} r={r} who="auditor" />)}
            </div>
          </div>
        )}
      </div>
    );
  }

  // ── SKILL ──
  if (data.type === "skill") {
    const versions = (data.versions || []).slice().reverse();
    return (
      <div style={panel}>
        <div>
          <Eyebrow color="var(--mars)">Verified skill</Eyebrow>
          <div style={{ display: "flex", alignItems: "center", gap: 12, marginTop: 4 }}>
            <span style={{ fontSize: 20, fontWeight: 600 }}>{data.name}</span>
            {data.latest_verdict && <VerdictPill verdict={data.latest_verdict} />}
          </div>
        </div>
        <Tiles items={[{ value: data.version_count ?? 0, label: "versions" }, { value: (data.licensed_agents || []).length, label: "licensed agents" }, { value: data.latest_verdict || "—", label: "latest verdict" }]} />
        {!!(data.licensed_agents || []).length && (
          <div style={{ background: "var(--panel)", border: "1px solid var(--hair-soft)", borderRadius: 10, padding: "12px 14px" }}>
            <Eyebrow>Licensed agents</Eyebrow>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginTop: 8 }}>
              {data.licensed_agents.map((ag: string) => (
                <button key={ag} onClick={() => onPick?.(ag)} style={{ cursor: onPick ? "pointer" : "default", fontFamily: "var(--code)", fontSize: 10.5, color: "var(--ink-2)", border: "1px solid var(--hair)", background: "transparent", borderRadius: 6, padding: "3px 8px" }}>{ag}</button>
              ))}
            </div>
          </div>
        )}
        <div>
          <SectionTitle right={<span style={{ fontSize: 10, color: "var(--ink-3)" }}>{versions.length} version{versions.length > 1 ? "s" : ""}</span>}>Version history · audit trail · attestation</SectionTitle>
          <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
            {versions.map((v: any) => (
              <div key={v.version} style={{ border: "1px solid var(--hair)", borderRadius: 12, padding: 16, background: "var(--cell)" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 12 }}>
                  <span style={{ fontSize: 12.5, fontWeight: 600 }}>v{v.version}</span>
                  <Link href={hs("topic", v.audit_id)}>{v.audit_id}</Link>
                </div>
                {v.audit ? <AuditDetail a={toAudit(v.audit)} /> : <div style={{ fontSize: 11, color: "var(--ink-3)" }}>audit record unavailable</div>}
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  return null;
}
