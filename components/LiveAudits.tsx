import { useState } from "react";
import Popout, { ExpandButton } from "./Popout";
import LiveAuditsExpanded from "./LiveAuditsExpanded";
import { useMars } from "./marsState";
import type { Audit } from "./marsData";

// ── Cell B · Live Audits ─────────────────────────────────────────────────
// LENS C — "Polished live feed / ticker". Every audit is ONE tight, log-like
// line: a verdict dot (pulsing while ongoing) · skill (mono) · a verdict pill ·
// a right-aligned deterministic time. DANGEROUS rows carry a faint red tint and
// surface a "critical" risk tag. Hover brightens the row and reveals the agent
// id + attestation. No 4-stage pipeline, no progress track — ongoing audits are
// just a pulsing dot + an AUDITING chip. Real audits from the DB only.

// Verdict / state → accent color (drives the dot, pill text and row tint).
function accentFor(a: Audit): string {
  if (a.verdict === "DANGEROUS") return "var(--danger)";
  if (a.state === "ongoing" || a.verdict === "AUDITING") return "var(--warn)";
  if (a.verdict === "SAFE") return "var(--safe)";
  return "var(--ink-3)";
}

// Low-alpha washes keyed off the token colors (no color-mix → broad support,
// no new global CSS). `tint` ≈ 10–12% (dots/pills), `wash` ≈ 6% (row backdrop).
const ALPHA: Record<string, { wash: string; hover: string; tint: string }> = {
  "var(--danger)": { wash: "rgba(210,63,46,0.055)", hover: "rgba(210,63,46,0.10)", tint: "rgba(210,63,46,0.11)" },
  "var(--warn)": { wash: "transparent", hover: "rgba(0,0,0,0.035)", tint: "rgba(185,120,15,0.12)" },
  "var(--safe)": { wash: "transparent", hover: "rgba(0,0,0,0.035)", tint: "rgba(31,157,99,0.11)" },
  "var(--ink-3)": { wash: "transparent", hover: "rgba(0,0,0,0.035)", tint: "rgba(148,152,162,0.13)" },
};

// Deterministic relative time from the ISO string ONLY (never Date.now() /
// new Date(), so SSR and client agree). "now" passes through. We can't anchor
// "Nm ago" safely without a clock, so we fall back to the stable HH:MM slice —
// never a drifting client value.
function whenLabel(iso: string): string {
  if (!iso || iso === "now") return "now";
  const m = /T(\d{2}:\d{2})/.exec(iso);
  if (m) return m[1];
  return iso.length >= 5 ? iso.slice(0, 5) : iso;
}

// Tinted-alpha verdict / state chip (house "Pills" language: 999 radius,
// ~11% background, colored text). Ongoing → "AUDITING"; otherwise the verdict.
function VerdictPill({ a, accent }: { a: Audit; accent: string }) {
  const ongoing = a.state === "ongoing" || a.verdict === "AUDITING";
  const label = ongoing ? "AUDITING" : a.verdict;
  return (
    <span
      style={{
        flex: "none",
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        width: 84,
        height: 17,
        borderRadius: 999,
        background: ALPHA[accent].tint,
        color: accent,
        fontSize: 9,
        fontWeight: 600,
        letterSpacing: ".08em",
        textTransform: "uppercase",
        whiteSpace: "nowrap",
        fontVariantNumeric: "tabular-nums",
      }}
    >
      {label}
    </span>
  );
}

function AuditRow({ a }: { a: Audit }) {
  const [hover, setHover] = useState(false);
  const accent = accentFor(a);
  const ongoing = a.state === "ongoing" || a.verdict === "AUDITING";
  const danger = a.verdict === "DANGEROUS";
  const agent = a.agent_id || a.auditor;

  // Layered backgrounds: a faint red wash for DANGEROUS rows at rest, a brighter
  // tint on hover (per-row state keeps it inline-only — no new global CSS).
  const palette = ALPHA[accent];
  const bg = hover ? palette.hover : palette.wash;

  return (
    <div
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      style={{
        position: "relative",
        display: "flex",
        alignItems: "center",
        gap: 9,
        padding: "0 12px",
        height: 32,
        flex: "none",
        background: bg,
        borderBottom: "1px solid var(--hair-soft)",
        transition: "background .12s ease",
        cursor: "default",
      }}
    >
      {/* verdict status dot — pulses while ongoing (onlinePulse keyframe) */}
      <span
        title={ongoing ? "auditing" : a.verdict.toLowerCase()}
        style={{
          flex: "none",
          width: 7,
          height: 7,
          borderRadius: "50%",
          background: accent,
          boxShadow: ongoing ? "none" : `0 0 0 3px ${palette.tint}`,
          animation: ongoing ? "onlinePulse 1.4s ease-in-out infinite" : undefined,
        }}
      />

      {/* skill (mono, truncates). On hover the line reveals the agent id. */}
      <div style={{ flex: 1, minWidth: 0, display: "flex", alignItems: "baseline", gap: 8, overflow: "hidden" }}>
        <span
          title={a.skill}
          style={{
            flex: "0 1 auto",
            minWidth: 0,
            fontFamily: "var(--code)",
            fontSize: 11,
            color: danger ? "var(--danger)" : "var(--ink)",
            fontWeight: danger ? 600 : 500,
            overflow: "hidden",
            whiteSpace: "nowrap",
            textOverflow: "ellipsis",
            lineHeight: 1.1,
          }}
        >
          {a.skill}
        </span>
        {hover && (
          <span
            title={`${a.tier} · ${agent}`}
            style={{
              flex: "0 1 auto",
              minWidth: 0,
              fontFamily: "var(--code)",
              fontSize: 9,
              color: "var(--ink-3)",
              overflow: "hidden",
              whiteSpace: "nowrap",
              textOverflow: "ellipsis",
              lineHeight: 1.1,
            }}
          >
            {agent}
          </span>
        )}
      </div>

      {/* verdict / state pill */}
      <VerdictPill a={a} accent={accent} />

      {/* deterministic time, right-aligned */}
      <span
        style={{
          flex: "none",
          width: 38,
          textAlign: "right",
          fontFamily: "var(--code)",
          fontSize: 9.5,
          color: "var(--ink-3)",
          fontVariantNumeric: "tabular-nums",
          whiteSpace: "nowrap",
        }}
      >
        {whenLabel(a.date)}
      </span>
    </div>
  );
}

export default function LiveAudits() {
  const { state } = useMars();
  const [open, setOpen] = useState(false);

  const audits = state.audits;
  const inFlight = audits.filter((a) => a.state === "ongoing").length;
  // Verdict-forward feed ordering: dangerous first, then in-flight, then rest —
  // so the most urgent lines sit at the top of the scrollable ticker.
  const rank = (a: Audit) => (a.verdict === "DANGEROUS" ? 0 : a.state === "ongoing" ? 1 : 2);
  const rows = audits
    .slice()
    .sort((a, b) => rank(a) - rank(b))
    .slice(0, 14);

  return (
    <>
      <div
        style={{
          gridColumn: "7 / 11",
          gridRow: "1 / 2",
          position: "relative",
          overflow: "hidden",
          background: "var(--cell)",
          border: "1px solid var(--hair)",
          borderRadius: 10,
          display: "flex",
          flexDirection: "column",
        }}
      >
        <div
          style={{
            flex: "none",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            padding: "12px 14px",
            borderBottom: "1px solid var(--hair-soft)",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 9 }}>
            <svg
              width="14"
              height="14"
              viewBox="0 0 24 24"
              style={{ fill: "none", stroke: "var(--ink-2)", strokeWidth: 1.8, strokeLinecap: "round", strokeLinejoin: "round" }}
            >
              <polyline points="2 12 6 12 9 4 14 20 17 12 22 12" />
            </svg>
            <span style={{ fontSize: 11, fontWeight: 600, letterSpacing: ".12em", textTransform: "uppercase", color: "var(--ink)" }}>
              Live Audits
            </span>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <span style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: 10, color: inFlight ? "var(--ink-2)" : "var(--ink-3)", fontVariantNumeric: "tabular-nums" }}>
              <span
                style={{
                  width: 6,
                  height: 6,
                  borderRadius: "50%",
                  background: inFlight ? "var(--warn)" : "var(--ink-3)",
                  animation: inFlight ? "onlinePulse 1.4s ease-in-out infinite" : undefined,
                  flex: "none",
                }}
              />
              {inFlight} in flight
            </span>
            <ExpandButton onClick={() => setOpen(true)} />
          </div>
        </div>

        {rows.length ? (
          <div className="no-bar" style={{ flex: 1, minHeight: 0, overflow: "auto", display: "flex", flexDirection: "column" }}>
            {rows.map((a) => (
              <AuditRow key={a.id} a={a} />
            ))}
          </div>
        ) : (
          <div
            style={{
              flex: 1,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              textAlign: "center",
              fontSize: 11,
              color: "var(--ink-3)",
            }}
          >
            No audits yet
          </div>
        )}
      </div>

      {open && (
        <Popout title="Live Audits" meta="click an audit for its trail & pipeline steps" onClose={() => setOpen(false)}>
          <LiveAuditsExpanded />
        </Popout>
      )}
    </>
  );
}
