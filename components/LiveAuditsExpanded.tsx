import { useState } from "react";
import type { Audit } from "./marsData";
import { useMars } from "./marsState";
import { AuditDetail, Eyebrow, VerdictPill } from "./MarsUI";

// Expanded Live Audits — list of audits; click one to see its trail/steps.

function AuditRow({ a, active, onClick }: { a: Audit; active: boolean; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      style={{
        textAlign: "left",
        cursor: "pointer",
        border: `1px solid ${active ? "var(--ink-3)" : "var(--hair-soft)"}`,
        background: active ? "var(--inset)" : "transparent",
        borderRadius: 8,
        padding: "9px 11px",
        display: "flex",
        flexDirection: "column",
        gap: 6,
      }}
    >
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10 }}>
        <span style={{ fontSize: 12, color: "var(--ink)", overflow: "hidden", whiteSpace: "nowrap", textOverflow: "ellipsis" }}>{a.skill}</span>
        <VerdictPill verdict={a.verdict} />
      </div>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", fontSize: 10.5, color: "var(--ink-3)" }}>
        <span>
          {a.id} · {a.auditor}
        </span>
        <span>{a.state === "ongoing" ? `${a.stageIndex + 1}/4 ${a.steps[a.stageIndex].stage}` : a.tier}</span>
      </div>
    </button>
  );
}

export default function LiveAuditsExpanded() {
  const { state } = useMars();
  const audits = state.audits;
  const ongoing = audits.filter((a) => a.state === "ongoing");
  const past = audits.filter((a) => a.state === "past");
  const [sel, setSel] = useState<string | null>(null);
  const audit = (sel ? audits.find((a) => a.id === sel) : null) ?? ongoing[0] ?? past[0] ?? null;

  return (
    <div style={{ display: "flex", height: "100%" }}>
      <div className="no-bar" style={{ width: 360, flex: "none", borderRight: "1px solid var(--hair)", overflow: "auto", padding: 18 }}>
        <Eyebrow color="var(--warn)">In flight · {ongoing.length}</Eyebrow>
        <div style={{ display: "flex", flexDirection: "column", gap: 8, marginTop: 10 }}>
          {ongoing.map((a) => (
            <AuditRow key={a.id} a={a} active={a.id === audit?.id} onClick={() => setSel(a.id)} />
          ))}
        </div>
        <div style={{ marginTop: 22 }}>
          <Eyebrow>Completed · {past.length}</Eyebrow>
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 8, marginTop: 10 }}>
          {past.map((a) => (
            <AuditRow key={a.id} a={a} active={a.id === audit?.id} onClick={() => setSel(a.id)} />
          ))}
        </div>
        {!audits.length && <div style={{ fontSize: 12, color: "var(--ink-3)", marginTop: 14 }}>No audits yet.</div>}
      </div>
      <div className="no-bar" style={{ flex: 1, minWidth: 0, overflow: "auto", padding: 28 }}>
        <div style={{ maxWidth: 560 }}>
          {audit ? <AuditDetail a={audit} /> : <div style={{ fontSize: 13, color: "var(--ink-3)" }}>Run an audit to see its trail.</div>}
        </div>
      </div>
    </div>
  );
}
