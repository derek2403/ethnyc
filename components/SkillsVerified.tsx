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
  // With the sparkline gone, the verdicts column has room for a few more rows.
  const recent = state.audits.filter((a) => a.state === "past").slice(0, 6);

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
        <div style={{ flex: 1, minHeight: 0, display: "flex", padding: 16, gap: 18 }}>
          <div style={{ flex: "none", width: 150, display: "flex", flexDirection: "column", justifyContent: "center" }}>
            <div style={{ fontFamily: "var(--mono)", fontSize: 56, fontWeight: 500, color: "var(--ink)", letterSpacing: "-.03em", lineHeight: 0.95 }}>{verified.toLocaleString()}</div>
            <div style={{ fontSize: 10, fontWeight: 500, letterSpacing: ".1em", color: "var(--ink-3)", textTransform: "uppercase", marginTop: 9, lineHeight: 1.4 }}>verified skills · all-time</div>
          </div>
          <div style={{ flex: 1, minWidth: 0, borderLeft: "1px solid var(--hair-soft)", paddingLeft: 16, display: "flex", flexDirection: "column", gap: 8, overflow: "hidden" }}>
            <div style={{ flex: "none", fontSize: 9.5, fontWeight: 500, letterSpacing: ".1em", color: "var(--ink-3)", textTransform: "uppercase" }}>Recent verdicts</div>
            {recent.length ? (
              <div style={{ flex: 1, minHeight: 0, display: "flex", flexDirection: "column", justifyContent: "space-between" }}>
                {recent.map((r) => {
                  const color = r.verdict === "DANGEROUS" ? "var(--danger)" : "var(--safe)";
                  return (
                    <div key={r.id} style={{ display: "flex", alignItems: "center", gap: 9, fontFamily: "var(--mono)", fontSize: 10.5 }}>
                      <span style={{ width: 6, height: 6, border: "1px solid", borderRadius: 1, flex: "none", borderColor: color }} />
                      <span style={{ color: "var(--ink-2)", flex: 1, overflow: "hidden", whiteSpace: "nowrap", textOverflow: "ellipsis" }}>{r.skill}</span>
                      <span style={{ color, flex: "none", fontSize: 9 }}>{r.verdict}</span>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div style={{ flex: 1, display: "flex", alignItems: "center", fontSize: 10.5, color: "var(--ink-3)" }}>none yet</div>
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
