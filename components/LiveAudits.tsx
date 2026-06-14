import { useState } from "react";
import Popout, { ExpandButton } from "./Popout";
import LiveAuditsExpanded from "./LiveAuditsExpanded";
import { useMars } from "./marsState";
import type { Audit } from "./marsData";

// ── Cell B · Live Audits ─────────────────────────────────────────────────
// Real audits from the DB (status auditing-1..4 → audited). No mock data.

const STAGE_NAMES = ["Scanner", "Sandbox", "Fork", "Synthesizer"];

interface CardVM {
  key: string;
  skill: string;
  sub: string;
  badge: string;
  badgeColor: string;
  stageLabel: string;
  stageColor: string;
  pct: number;
}

function cardFromAudit(a: Audit): CardVM {
  const done = a.state !== "ongoing";
  const danger = a.verdict === "DANGEROUS";
  const stage = done ? 4 : a.stageIndex + 1;
  const stageColor = danger ? "var(--danger)" : done ? "var(--safe)" : "var(--warn)";
  return {
    key: a.id,
    skill: a.skill,
    sub: a.agent_id || a.auditor,
    badge: done ? a.verdict : "AUDITING",
    badgeColor: stageColor,
    stageLabel: done ? a.verdict : `${stage}/4 ${STAGE_NAMES[a.stageIndex] || ""}`,
    stageColor,
    pct: done ? 100 : (stage / 4) * 100,
  };
}

function AuditCard({ vm }: { vm: CardVM }) {
  return (
    <div className="mars-audit-card" style={{ border: "1px solid var(--hair-soft)", borderRadius: 8, padding: "8px 11px" }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10 }}>
        <span style={{ fontFamily: "var(--mono)", fontSize: 11, color: "var(--ink)", flex: 1, minWidth: 0, overflow: "hidden", whiteSpace: "nowrap", textOverflow: "ellipsis" }}>{vm.skill}</span>
        <span style={{ fontSize: 9, color: vm.badgeColor, border: "1px solid var(--hair-soft)", padding: "1.5px 6px", borderRadius: 6, letterSpacing: ".06em", flex: "none", whiteSpace: "nowrap" }}>{vm.badge}</span>
      </div>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginTop: 6, fontFamily: "var(--mono)", fontSize: 9.5, color: "var(--ink-3)" }}>
        <span style={{ overflow: "hidden", whiteSpace: "nowrap", textOverflow: "ellipsis" }}>{vm.sub}</span>
        <span style={{ color: vm.stageColor, flex: "none", paddingLeft: 8 }}>{vm.stageLabel}</span>
      </div>
      <div style={{ height: 3, background: "var(--hair-soft)", borderRadius: 2, marginTop: 7, position: "relative", overflow: "hidden" }}>
        <div style={{ position: "absolute", left: 0, top: 0, height: 3, width: vm.pct + "%", background: vm.stageColor, transition: "width .6s ease" }} />
      </div>
    </div>
  );
}

export default function LiveAudits() {
  const { state } = useMars();
  const [open, setOpen] = useState(false);

  const audits = state.audits;
  const inFlight = audits.filter((a) => a.state === "ongoing").length;
  const cards = audits.slice(0, 10).map(cardFromAudit);

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
        <div style={{ flex: "none", display: "flex", alignItems: "center", justifyContent: "space-between", padding: "12px 14px", borderBottom: "1px solid var(--hair-soft)" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 9 }}>
            <svg width="14" height="14" viewBox="0 0 24 24" style={{ fill: "none", stroke: "var(--ink-2)", strokeWidth: 1.8, strokeLinecap: "round", strokeLinejoin: "round" }}>
              <polyline points="2 12 6 12 9 4 14 20 17 12 22 12" />
            </svg>
            <span style={{ fontSize: 11, fontWeight: 600, letterSpacing: ".12em", textTransform: "uppercase", color: "var(--ink)" }}>Live Audits</span>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <span style={{ fontSize: 10, color: "var(--ink-3)" }}>{inFlight} in flight</span>
            <ExpandButton onClick={() => setOpen(true)} />
          </div>
        </div>
        <div className="no-bar" style={{ flex: 1, minHeight: 0, overflow: "auto", padding: "6px 14px", display: "flex", flexDirection: "column", gap: 6 }}>
          {cards.length ? (
            cards.map((vm) => <AuditCard key={vm.key} vm={vm} />)
          ) : (
            <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", textAlign: "center", fontSize: 11, color: "var(--ink-3)", lineHeight: 1.6 }}>
              No audits yet.
              <br />
              Run one → <span style={{ fontFamily: "var(--code)" }}>/api/audit?skill=…</span>
            </div>
          )}
        </div>
      </div>
      {open && (
        <Popout title="Live Audits" meta="click an audit for its trail & pipeline steps" onClose={() => setOpen(false)}>
          <LiveAuditsExpanded />
        </Popout>
      )}
    </>
  );
}
