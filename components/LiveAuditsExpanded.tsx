import { useState } from "react";
import type { Audit } from "./marsData";
import { useMars } from "./marsState";
import { AuditDetail, Eyebrow, VerdictPill } from "./MarsUI";

// Expanded Live Audits — list of audits; click one to see its trail/steps.

function AuditRow({ a, active, onClick }: { a: Audit; active: boolean; onClick: () => void }) {
  const ongoing = a.state === "ongoing";
  const dot = ongoing ? "var(--warn)" : a.verdict === "DANGEROUS" ? "var(--danger)" : "var(--safe)";
  return (
    <button
      onClick={onClick}
      style={{
        textAlign: "left",
        cursor: "pointer",
        border: `1px solid ${active ? "var(--ink-3)" : "var(--hair-soft)"}`,
        background: active ? "var(--panel)" : "transparent",
        boxShadow: active ? "0 1px 3px rgba(0,0,0,0.06)" : "none",
        borderRadius: 9,
        padding: "10px 12px",
        display: "flex",
        flexDirection: "column",
        gap: 7,
        transition: "border-color .12s ease, background .12s ease",
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 9 }}>
        <span style={{ width: 7, height: 7, borderRadius: "50%", flex: "none", background: dot, animation: ongoing ? "onlinePulse 1.4s ease-in-out infinite" : undefined }} />
        <span style={{ flex: 1, minWidth: 0, fontSize: 12.5, fontWeight: 600, color: "var(--ink)", overflow: "hidden", whiteSpace: "nowrap", textOverflow: "ellipsis" }}>{a.skill}</span>
        <VerdictPill verdict={a.verdict} />
      </div>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, fontFamily: "var(--code)", fontSize: 10.5, color: "var(--ink-2)" }}>
        <span style={{ minWidth: 0, overflow: "hidden", whiteSpace: "nowrap", textOverflow: "ellipsis" }}>
          {a.id} · {a.auditor}
        </span>
        <span style={{ flex: "none", color: "var(--ink-3)" }}>{ongoing ? `${a.stageIndex + 1}/4 ${a.steps[a.stageIndex]?.stage ?? ""}` : a.tier}</span>
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
      <div className="no-bar" style={{ flex: 1, minWidth: 0, overflow: "auto", padding: "26px 30px" }}>
        <div style={{ maxWidth: 640 }}>
          {audit ? <AuditDetail a={audit} /> : <div style={{ fontSize: 13, color: "var(--ink-3)" }}>Run an audit to see its trail.</div>}
        </div>
      </div>
    </div>
  );
}
