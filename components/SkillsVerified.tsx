import { useState } from "react";
import Popout, { ExpandButton } from "./Popout";
import SkillsExpanded from "./SkillsExpanded";
import { useMars } from "./marsState";

// ── Cell C · Skills Verified ─────────────────────────────────────────────
// Verified-skill count + recent verdicts, straight from the DB.

export default function SkillsVerified() {
  const { state } = useMars();
  const [open, setOpen] = useState(false);

  const verified = state.stats.skillsVerified;
  const flagged = state.stats.flagged;
  const recent = state.audits.filter((a) => a.state === "past").slice(0, 4);

  // sparkline: cumulative SAFE verdicts over time (oldest → newest)
  const chrono = [...state.audits].filter((a) => a.state === "past").reverse();
  let acc = 0;
  const hist = chrono.map((a) => (a.verdict === "SAFE" ? ++acc : acc));
  while (hist.length < 2) hist.push(acc);

  const W = 220;
  const H = 42;
  const pad = 4;
  const mn = Math.min(...hist);
  const mx = Math.max(...hist);
  const span = mx - mn || 1;
  const pts = hist.map((v, i) => {
    const x = (i / (hist.length - 1)) * W;
    const y = pad + (H - pad * 2) - ((v - mn) / span) * (H - pad * 2);
    return x.toFixed(1) + "," + y.toFixed(1);
  });
  const [dotX, dotY] = pts[pts.length - 1].split(",");
  const sparkLine = pts.join(" ");
  const sparkArea = "0," + H + " " + sparkLine + " " + W + "," + H;

  return (
    <>
      <div
        style={{
          gridColumn: "7 / 11",
          gridRow: "2 / 3",
          position: "relative",
          overflow: "hidden",
          background: "var(--cell)",
          border: "1px solid var(--hair)",
          borderRadius: 10,
          display: "flex",
          flexDirection: "column",
        }}
      >
        <div style={{ flex: "none", display: "flex", alignItems: "center", justifyContent: "space-between", padding: "12px 14px", borderBottom: "1px solid var(--hair-soft)" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 9 }}>
            <svg width="14" height="14" viewBox="0 0 24 24" style={{ fill: "none", stroke: "var(--ink-2)", strokeWidth: 1.7, strokeLinecap: "round", strokeLinejoin: "round" }}>
              <path d="M12 3 l7 3 v5 c0 4.5 -3 7.6 -7 9 c-4 -1.4 -7 -4.5 -7 -9 V6 Z" />
              <polyline points="9 12 11.2 14.2 15 9.8" />
            </svg>
            <span style={{ fontSize: 11, fontWeight: 600, letterSpacing: ".12em", textTransform: "uppercase", color: "var(--ink)" }}>Skills Verified</span>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <span style={{ fontSize: 10, color: flagged ? "var(--danger)" : "var(--ink-3)" }}>{flagged} flagged</span>
            <ExpandButton onClick={() => setOpen(true)} />
          </div>
        </div>
        <div style={{ flex: 1, minHeight: 0, display: "flex", padding: 14, gap: 16 }}>
          <div style={{ flex: 1, display: "flex", flexDirection: "column", justifyContent: "space-between" }}>
            <div>
              <div style={{ fontFamily: "var(--mono)", fontSize: 42, fontWeight: 500, color: "var(--ink)", letterSpacing: "-.02em", lineHeight: 1 }}>{verified.toLocaleString()}</div>
              <div style={{ fontSize: 9.5, fontWeight: 500, letterSpacing: ".1em", color: "var(--ink-3)", textTransform: "uppercase", marginTop: 6 }}>verified skills · all-time</div>
            </div>
            <svg viewBox="0 0 220 46" preserveAspectRatio="none" style={{ width: "100%", height: 46, overflow: "visible" }}>
              <polyline points={sparkArea} style={{ fill: "rgba(31,157,99,0.10)", stroke: "none" }} />
              <polyline points={sparkLine} style={{ fill: "none", stroke: "var(--safe)", strokeWidth: 1.5, strokeLinejoin: "round", strokeLinecap: "round" }} />
              <circle cx={dotX} cy={dotY} r="2.5" style={{ fill: "var(--safe)" }} />
            </svg>
          </div>
          <div style={{ width: 172, flex: "none", borderLeft: "1px solid var(--hair-soft)", paddingLeft: 14, display: "flex", flexDirection: "column", gap: 7 }}>
            <div style={{ fontSize: 9.5, fontWeight: 500, letterSpacing: ".1em", color: "var(--ink-3)", textTransform: "uppercase" }}>Recent verdicts</div>
            {recent.length ? (
              recent.map((r) => {
                const color = r.verdict === "DANGEROUS" ? "var(--danger)" : "var(--safe)";
                return (
                  <div key={r.id} style={{ display: "flex", alignItems: "center", gap: 8, fontFamily: "var(--mono)", fontSize: 10 }}>
                    <span style={{ width: 6, height: 6, border: "1px solid", borderRadius: 1, flex: "none", borderColor: color }} />
                    <span style={{ color: "var(--ink-2)", flex: 1, overflow: "hidden", whiteSpace: "nowrap", textOverflow: "ellipsis" }}>{r.skill}</span>
                    <span style={{ color, flex: "none", fontSize: 9 }}>{r.verdict}</span>
                  </div>
                );
              })
            ) : (
              <div style={{ fontSize: 10.5, color: "var(--ink-3)" }}>none yet</div>
            )}
          </div>
        </div>
      </div>
      {open && (
        <Popout title="Skills Verified" meta="click a skill for version & audit history" onClose={() => setOpen(false)}>
          <SkillsExpanded />
        </Popout>
      )}
    </>
  );
}
