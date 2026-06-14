import { useState } from "react";
import { useMars } from "./marsState";
import { Eyebrow, SkillDetail, VerdictPill } from "./MarsUI";

// Expanded Skills Verified — list of verified skills; click to see audit
// history, version history and usage.

export default function SkillsExpanded() {
  const { state } = useMars();
  const SKILLS = state.skills;
  const [sel, setSel] = useState<string | null>(null);
  const skill = (sel ? SKILLS.find((s) => s.id === sel) : null) ?? SKILLS[0] ?? null;

  return (
    <div style={{ display: "flex", height: "100%" }}>
      <div className="no-bar" style={{ width: 360, flex: "none", borderRight: "1px solid var(--hair)", overflow: "auto", padding: 18 }}>
        <Eyebrow color="var(--safe)">Verified skills · {SKILLS.length}</Eyebrow>
        {!SKILLS.length && <div style={{ fontSize: 12, color: "var(--ink-3)", marginTop: 14 }}>No verified skills yet.</div>}
        <div style={{ display: "flex", flexDirection: "column", gap: 8, marginTop: 10 }}>
          {SKILLS.map((s) => (
            <button
              key={s.id}
              onClick={() => setSel(s.id)}
              style={{
                textAlign: "left",
                cursor: "pointer",
                border: `1px solid ${s.id === skill?.id ? "var(--ink-3)" : "var(--hair-soft)"}`,
                background: s.id === skill?.id ? "var(--panel)" : "transparent",
                boxShadow: s.id === skill?.id ? "0 1px 3px rgba(0,0,0,0.06)" : "none",
                borderRadius: 9,
                padding: "10px 12px",
                display: "flex",
                flexDirection: "column",
                gap: 7,
                transition: "border-color .12s ease, background .12s ease",
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: 9 }}>
                <span style={{ width: 7, height: 7, borderRadius: "50%", flex: "none", background: s.verdict === "DANGEROUS" ? "var(--danger)" : s.verdict === "AUDITING" ? "var(--warn)" : "var(--safe)" }} />
                <span style={{ flex: 1, minWidth: 0, fontSize: 12.5, color: "var(--ink)", fontWeight: 600, overflow: "hidden", whiteSpace: "nowrap", textOverflow: "ellipsis" }}>{s.id}</span>
                <VerdictPill verdict={s.verdict} />
              </div>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, fontFamily: "var(--code)", fontSize: 10.5, color: "var(--ink-2)" }}>
                <span style={{ minWidth: 0, overflow: "hidden", whiteSpace: "nowrap", textOverflow: "ellipsis" }}>
                  v{s.version} · {s.category}
                </span>
                <span style={{ flex: "none", color: "var(--ink-3)" }}>{s.licenses.toLocaleString()} licenses</span>
              </div>
            </button>
          ))}
        </div>
      </div>
      <div className="no-bar" style={{ flex: 1, minWidth: 0, overflow: "auto", padding: "26px 30px" }}>
        <div style={{ maxWidth: 640 }}>
          {skill ? <SkillDetail s={skill} /> : <div style={{ fontSize: 13, color: "var(--ink-3)" }}>No verified skills yet.</div>}
        </div>
      </div>
    </div>
  );
}
