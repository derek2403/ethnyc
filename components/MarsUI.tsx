import { useEffect, useState } from "react";
import { VERDICT_COLOR } from "./marsData";
import type { Audit, Auditor, Skill, User, Verdict } from "./marsData";
import { useMars } from "./marsState";

const sevColor = (s: string) => ({ critical: "var(--danger)", high: "var(--danger)", medium: "var(--warn)", low: "var(--comm)", none: "var(--ink-3)" }[String(s).toLowerCase()] || "var(--ink-3)");

// ── Shared presentational atoms (one design language) ──────────────────────

export function Eyebrow({ children, color = "var(--ink-3)" }: { children: React.ReactNode; color?: string }) {
  return <div style={{ fontSize: 9.5, fontWeight: 500, letterSpacing: ".1em", textTransform: "uppercase", color }}>{children}</div>;
}

export function Tiles({ items, cols = 3 }: { items: { value: React.ReactNode; label: string }[]; cols?: number }) {
  return (
    <div style={{ display: "grid", gridTemplateColumns: `repeat(${cols},1fr)`, gap: 1, background: "var(--hair-soft)", border: "1px solid var(--hair-soft)", borderRadius: 8, overflow: "hidden" }}>
      {items.map((t, i) => (
        <div key={i} style={{ background: "var(--inset)", padding: "12px 12px" }}>
          <div style={{ fontSize: 19, fontWeight: 600, color: "var(--ink)" }}>{t.value}</div>
          <div style={{ fontSize: 8.5, fontWeight: 500, letterSpacing: ".08em", color: "var(--ink-3)", textTransform: "uppercase", marginTop: 5, lineHeight: 1.3 }}>{t.label}</div>
        </div>
      ))}
    </div>
  );
}

export function Bar({ label, value, pct, color }: { label: string; value: string; pct: string; color: string }) {
  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", fontSize: 10.5, color: "var(--ink-2)", marginBottom: 5 }}>
        <span style={{ fontWeight: 500, textTransform: "uppercase", letterSpacing: ".08em", color: "var(--ink-3)" }}>{label}</span>
        <span style={{ color: "var(--ink)" }}>{value}</span>
      </div>
      <div style={{ height: 4, background: "var(--hair-soft)", position: "relative", borderRadius: 2, overflow: "hidden" }}>
        <div style={{ position: "absolute", left: 0, top: 0, height: 4, width: pct, background: color }} />
      </div>
    </div>
  );
}

export function Row({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", fontSize: 12, gap: 12 }}>
      <span style={{ color: "var(--ink-3)", flex: "none" }}>{label}</span>
      <span style={{ color: "var(--ink-2)", textAlign: "right" }}>{value}</span>
    </div>
  );
}

export function VerdictPill({ verdict }: { verdict: Verdict }) {
  const c = VERDICT_COLOR[verdict];
  return (
    <span style={{ fontSize: 10, fontWeight: 600, letterSpacing: ".08em", color: c, border: `1px solid ${c}`, borderRadius: 6, padding: "3px 9px", whiteSpace: "nowrap" }}>
      {verdict === "SAFE" ? "✓ SAFE" : verdict === "DANGEROUS" ? "⚠ DANGEROUS" : "● AUDITING"}
    </span>
  );
}

export function SectionTitle({ children, right }: { children: React.ReactNode; right?: React.ReactNode }) {
  return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10 }}>
      <Eyebrow>{children}</Eyebrow>
      {right}
    </div>
  );
}

const STAGE_DESC: Record<string, string> = {
  Scanner: "Description-injection scan",
  Sandbox: "Sandboxed run in TEE — declared vs actual",
  Fork: "Anvil fork + fake wallet — abuse check",
  Synthesizer: "Evidence → attested verdict",
};

export function AuditTrail({ audit }: { audit: Audit }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 0 }}>
      {audit.steps.map((s, i) => {
        const done = s.status === "done";
        const running = s.status === "running";
        const color = done ? "var(--safe)" : running ? "var(--warn)" : "var(--ink-3)";
        return (
          <div key={i} style={{ display: "flex", gap: 12, paddingBottom: i === audit.steps.length - 1 ? 0 : 16 }}>
            {/* rail */}
            <div style={{ display: "flex", flexDirection: "column", alignItems: "center", flex: "none" }}>
              <span
                style={{
                  width: 16,
                  height: 16,
                  borderRadius: "50%",
                  border: `1.5px solid ${color}`,
                  background: done ? color : "transparent",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontSize: 9,
                  color: "#fff",
                  animation: running ? "onlinePulse 1.4s ease-in-out infinite" : undefined,
                }}
              >
                {done ? "✓" : ""}
              </span>
              {i < audit.steps.length - 1 && <span style={{ width: 1.5, flex: 1, minHeight: 20, background: "var(--hair)", marginTop: 3 }} />}
            </div>
            {/* content */}
            <div style={{ paddingBottom: 4 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <span style={{ fontSize: 12.5, fontWeight: 600, color: "var(--ink)" }}>
                  {i + 1}. {s.stage}
                </span>
                <span style={{ fontSize: 9, fontWeight: 600, letterSpacing: ".06em", textTransform: "uppercase", color }}>{s.status}</span>
              </div>
              <div style={{ fontSize: 10.5, color: "var(--ink-3)", marginTop: 2 }}>{STAGE_DESC[s.stage]}</div>
              <div style={{ fontSize: 11.5, color: "var(--ink-2)", marginTop: 5, fontFamily: "var(--code)", lineHeight: 1.5 }}>{s.detail}</div>
            </div>
          </div>
        );
      })}
    </div>
  );
}

const pct = (v: number) => Math.round(v * 100) + "%";
const panel = { display: "flex", flexDirection: "column" as const, gap: 18 };

// ── Entity detail renderers (used by Search + Explorer) ─────────────────────

export function AuditorDetail({ a }: { a: Auditor }) {
  const { state } = useMars();
  const track = state.audits.filter((x) => x.auditor === a.id);
  const sc = a.status === "auditing" ? "var(--warn)" : a.status === "active" ? "var(--safe)" : "var(--ink-3)";
  return (
    <div style={panel}>
      <div>
        <Eyebrow color="var(--comm)">Auditor agent</Eyebrow>
        <div style={{ fontSize: 22, fontWeight: 600, marginTop: 4 }}>{a.id}</div>
        <div style={{ display: "flex", gap: 8, marginTop: 10 }}>
          <span style={{ fontSize: 10, color: "var(--safe)", border: "1px solid var(--safe)", borderRadius: 6, padding: "3px 9px" }}>✓ World ID · {a.worldId}</span>
          <span style={{ fontSize: 10, color: sc, border: "1px solid var(--hair)", borderRadius: 6, padding: "3px 9px", textTransform: "uppercase", letterSpacing: ".06em" }}>{a.status}</span>
        </div>
      </div>
      <Tiles items={[{ value: a.proposed, label: "proposed" }, { value: a.processed, label: "processed" }, { value: a.accuracy + "%", label: "accuracy" }]} />
      <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        <Bar label="reputation" value={a.rep.toFixed(2)} pct={pct(a.rep)} color="var(--comm)" />
        <Bar label="rating" value={a.rating.toFixed(1) + " / 5"} pct={pct(a.rating / 5)} color="var(--safe)" />
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 9 }}>
        <Row label="Stake bonded" value={a.stake.toLocaleString() + " USDC"} />
        <Row label="Specialty" value={a.spec} />
        <Row label="Region" value={a.region} />
        <Row label="Last active" value={a.last} />
      </div>
      <div>
        <SectionTitle right={<span style={{ fontSize: 10, color: "var(--ink-3)" }}>{track.length} audits</span>}>Track record</SectionTitle>
        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          {track.slice(0, 6).map((t) => (
            <div key={t.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", fontSize: 11.5, padding: "7px 10px", border: "1px solid var(--hair-soft)", borderRadius: 8 }}>
              <span style={{ color: "var(--ink-2)" }}>{t.skill}</span>
              <VerdictPill verdict={t.verdict} />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

export function UserDetail({ u }: { u: User }) {
  return (
    <div style={panel}>
      <div>
        <Eyebrow color="var(--warn)">User agent</Eyebrow>
        <div style={{ fontSize: 22, fontWeight: 600, marginTop: 4 }}>{u.id}</div>
        <div style={{ display: "flex", gap: 8, marginTop: 10 }}>
          <span style={{ fontSize: 10, color: "var(--safe)", border: "1px solid var(--safe)", borderRadius: 6, padding: "3px 9px" }}>✓ World ID · {u.worldId}</span>
          <span style={{ fontSize: 10, color: u.active ? "var(--safe)" : "var(--ink-3)", border: "1px solid var(--hair)", borderRadius: 6, padding: "3px 9px" }}>{u.active ? "licensing now" : "idle"}</span>
        </div>
      </div>
      <Tiles items={[{ value: u.skills, label: "licensed" }, { value: "$" + u.spend.toLocaleString(), label: "spend" }, { value: u.sessions, label: "sessions" }]} />
      <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        <Bar label="rating given" value={u.rating.toFixed(1) + " / 5"} pct={pct(u.rating / 5)} color="var(--warn)" />
        <Bar label="trust score" value={pct(0.6 + u.rating / 12)} pct={pct(0.6 + u.rating / 12)} color="var(--comm)" />
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 9 }}>
        <Row label="Member since" value={u.since} />
        <Row label="Last licensed" value={u.last} />
        <Row label="Avg / skill" value={"$" + Math.round(u.spend / u.skills).toLocaleString()} />
        <Row label="Verified payer" value="yes" />
      </div>
    </div>
  );
}

export function SkillDetail({ s }: { s: Skill }) {
  return (
    <div style={panel}>
      <div>
        <Eyebrow color="var(--mars)">Verified skill</Eyebrow>
        <div style={{ display: "flex", alignItems: "center", gap: 12, marginTop: 4 }}>
          <span style={{ fontSize: 22, fontWeight: 600 }}>{s.id}</span>
          <VerdictPill verdict={s.verdict} />
        </div>
        <div style={{ fontSize: 11, color: "var(--ink-3)", marginTop: 5 }}>
          {s.category} · v{s.version} · author {s.author}
        </div>
      </div>
      <Tiles
        items={[
          { value: s.licenses.toLocaleString(), label: "active licenses" },
          { value: s.usagePerDay + "/d", label: "usage rate" },
          { value: s.reviews.rating.toFixed(1), label: `rating · ${s.reviews.count}` },
        ]}
      />
      <Bar label="trust score · HCS-25" value={s.trust.toFixed(2)} pct={pct(s.trust)} color="var(--safe)" />
      <div style={{ display: "flex", flexDirection: "column", gap: 9 }}>
        <Row label="Author royalty" value={s.royalty + " / license"} />
        <Row label="Verified token" value="HTS · minted" />
      </div>
      <div>
        <SectionTitle>Version & audit history</SectionTitle>
        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          {s.versions.map((v) => (
            <div key={v.version} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", fontSize: 11.5, padding: "8px 10px", border: "1px solid var(--hair-soft)", borderRadius: 8 }}>
              <span style={{ color: "var(--ink)", fontWeight: 500 }}>v{v.version}</span>
              <span style={{ color: "var(--ink-3)", fontSize: 10.5 }}>{v.date}</span>
              <span style={{ color: "var(--ink-3)", fontSize: 10.5, fontFamily: "var(--code)" }}>{v.auditId}</span>
              <VerdictPill verdict={v.verdict} />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

interface AttRec {
  reportData?: string;
  quote?: string;
  mocked?: boolean;
  verify?: string;
  info?: { app_id?: string } | null;
}

function AttestationView({ id }: { id: string }) {
  const [att, setAtt] = useState<AttRec | null>(null);
  const [loading, setLoading] = useState(true);
  const [show, setShow] = useState(false);
  useEffect(() => {
    let alive = true;
    fetch(`/api/attest?id=${encodeURIComponent(id)}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (alive) {
          setAtt(d);
          setLoading(false);
        }
      })
      .catch(() => alive && setLoading(false));
    return () => {
      alive = false;
    };
  }, [id]);

  if (loading) return <div style={{ fontSize: 11, color: "var(--ink-3)" }}>loading attestation…</div>;
  if (!att || !att.reportData) return <div style={{ fontSize: 11, color: "var(--ink-3)" }}>No attestation recorded yet.</div>;
  const ok = !att.mocked;
  return (
    <div style={{ border: "1px solid var(--hair)", borderRadius: 8, padding: 14, display: "flex", flexDirection: "column", gap: 9 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
        <span style={{ fontSize: 10, fontWeight: 600, letterSpacing: ".06em", color: ok ? "var(--safe)" : "var(--warn)", border: `1px solid ${ok ? "var(--safe)" : "var(--warn)"}`, borderRadius: 6, padding: "2px 8px" }}>{ok ? "TEE-ATTESTED ✓" : "MOCK"}</span>
        <span style={{ fontSize: 10.5, color: "var(--ink-3)" }}>Phala TDX</span>
      </div>
      <Row label="reportData" value={"0x" + (att.reportData || "").slice(0, 26) + "…"} />
      {att.info?.app_id && <Row label="enclave app id" value={att.info.app_id} />}
      <button onClick={() => setShow((s) => !s)} style={{ alignSelf: "flex-start", fontSize: 10.5, color: "var(--ink-2)", background: "none", border: "1px solid var(--hair)", borderRadius: 6, padding: "3px 9px", cursor: "pointer" }}>
        {show ? "hide quote" : "show TDX quote"}
      </button>
      {show && (
        <pre style={{ margin: 0, maxHeight: 170, overflow: "auto", fontFamily: "var(--code)", fontSize: 10.5, lineHeight: 1.5, color: "var(--ink-2)", background: "var(--inset)", borderRadius: 6, padding: 10, whiteSpace: "pre-wrap", wordBreak: "break-all" }}>{att.quote}</pre>
      )}
      <a href={att.verify || "https://proof.t16z.com/"} target="_blank" rel="noopener noreferrer" style={{ fontSize: 10.5, color: "var(--mars)", textDecoration: "none" }}>
        Verify this quote ↗
      </a>
    </div>
  );
}

export function AuditDetail({ a }: { a: Audit }) {
  const hasOutput = !!(a.summary || a.findings?.length || a.recommendation || a.capabilities?.length);
  return (
    <div style={panel}>
      <div>
        <Eyebrow color={VERDICT_COLOR[a.verdict]}>{a.state === "ongoing" ? "Ongoing audit" : "Completed audit"}</Eyebrow>
        <div style={{ display: "flex", alignItems: "center", gap: 12, marginTop: 4 }}>
          <span style={{ fontSize: 20, fontWeight: 600 }}>{a.id}</span>
          <VerdictPill verdict={a.verdict} />
        </div>
        <div style={{ fontSize: 11.5, color: "var(--ink-3)", marginTop: 5 }}>
          {a.skill} · {a.auditor} · {a.tier}
        </div>
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 9 }}>
        <Row label="HCS audit-trail topic" value={a.topic} />
        <Row label="Recorded" value={a.date} />
      </div>
      <div>
        <SectionTitle>Audit trail · pipeline</SectionTitle>
        <AuditTrail audit={a} />
      </div>

      {hasOutput && (
        <div>
          <SectionTitle right={a.risk ? <span style={{ fontSize: 10, color: "var(--ink-3)" }}>risk {a.risk}</span> : undefined}>Verdict · final output</SectionTitle>
          {a.summary && <div style={{ fontSize: 12, color: "var(--ink-2)", lineHeight: 1.55 }}>{a.summary}</div>}
          {!!a.capabilities?.length && (
            <div style={{ marginTop: 10 }}>
              <Eyebrow>Capabilities (observed)</Eyebrow>
              <div style={{ display: "flex", flexDirection: "column", gap: 3, marginTop: 6 }}>
                {a.capabilities.map((c, i) => (
                  <div key={i} style={{ fontSize: 11.5, color: "var(--ink-2)" }}>• {c}</div>
                ))}
              </div>
            </div>
          )}
          {!!a.findings?.length && (
            <div style={{ marginTop: 10, display: "flex", flexDirection: "column", gap: 6 }}>
              {a.findings.map((f, i) => (
                <div key={i} style={{ border: "1px solid var(--hair-soft)", borderRadius: 8, padding: "8px 10px" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <span style={{ fontSize: 9, fontWeight: 600, color: sevColor(f.severity), letterSpacing: ".04em" }}>[{String(f.severity).toUpperCase()}]</span>
                    <span style={{ fontSize: 12, color: "var(--ink)" }}>{f.title}</span>
                  </div>
                  {f.detail && <div style={{ fontSize: 11, color: "var(--ink-3)", marginTop: 3 }}>{f.detail}</div>}
                </div>
              ))}
            </div>
          )}
          {a.recommendation && <div style={{ marginTop: 10, fontSize: 11.5, color: "var(--ink-2)" }}><span style={{ fontWeight: 600 }}>Recommendation: </span>{a.recommendation}</div>}
        </div>
      )}

      <div>
        <SectionTitle>TEE attestation</SectionTitle>
        <AttestationView id={a.id} />
      </div>
    </div>
  );
}
