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
                background: s.id === skill?.id ? "var(--inset)" : "transparent",
                borderRadius: 8,
                padding: "10px 11px",
                display: "flex",
                flexDirection: "column",
                gap: 6,
              }}
            >
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10 }}>
                <span style={{ fontSize: 12.5, color: "var(--ink)", fontWeight: 500, overflow: "hidden", whiteSpace: "nowrap", textOverflow: "ellipsis" }}>{s.id}</span>
                <VerdictPill verdict={s.verdict} />
              </div>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", fontSize: 10.5, color: "var(--ink-3)" }}>
                <span>
                  v{s.version} · {s.category}
                </span>
                <span>{s.licenses.toLocaleString()} licenses</span>
              </div>
            </button>
          ))}
        </div>
      </div>
      <div className="no-bar" style={{ flex: 1, minWidth: 0, overflow: "auto", padding: 28 }}>
        <div style={{ maxWidth: 560 }}>
          {skill ? <SkillDetail s={skill} /> : <div style={{ fontSize: 13, color: "var(--ink-3)" }}>No verified skills yet.</div>}
        </div>
      </div>
    </div>
  );
}
