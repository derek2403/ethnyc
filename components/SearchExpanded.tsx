import { useState } from "react";
import { lookup } from "./marsData";
import { useMars } from "./marsState";
import { AuditDetail, AuditorDetail, Eyebrow, SkillDetail, UserDetail } from "./MarsUI";

// Expanded Cross-chain Search — a MARS block explorer. Resolve any platform
// id: skill, agent (user) id, audit id, or HCS topic — against the live DB.

export default function SearchExpanded() {
  const { state } = useMars();
  const [query, setQuery] = useState("");
  const [submitted, setSubmitted] = useState("");
  const result = submitted ? lookup(state, submitted) : null;

  // example chips drawn from whatever is actually in the DB
  const EXAMPLES = [
    state.skills[0] && { label: "Skill", sample: state.skills[0].id },
    state.audits[0] && { label: "Audit id", sample: state.audits[0].id },
    state.users[0] && { label: "Agent id", sample: state.users[0].id },
  ].filter(Boolean) as { label: string; sample: string }[];

  const run = (q: string) => {
    setQuery(q);
    setSubmitted(q);
  };

  return (
    <div style={{ height: "100%", display: "flex", flexDirection: "column", padding: 28, alignItems: "center" }}>
      <div style={{ width: "100%", maxWidth: 720, display: "flex", flexDirection: "column" }}>
        <Eyebrow color="var(--mars)">MARS block explorer</Eyebrow>
        <div style={{ fontSize: 22, fontWeight: 600, marginTop: 6 }}>Search anything on the platform</div>
        <div style={{ fontSize: 12, color: "var(--ink-3)", marginTop: 4 }}>Resolve a skill, agent id, auditor id, audit id, or HCS topic.</div>

        {/* search bar */}
        <div style={{ marginTop: 16, display: "flex", alignItems: "center", gap: 10, background: "var(--inset)", border: "1px solid var(--hair)", borderRadius: 10, padding: "8px 8px 8px 16px" }}>
          <svg width="18" height="18" viewBox="0 0 24 24" style={{ fill: "none", stroke: "var(--ink-3)", strokeWidth: 2, flex: "none" }}>
            <circle cx="11" cy="11" r="7" />
            <line x1="16.5" y1="16.5" x2="21" y2="21" strokeLinecap="round" />
          </svg>
          <input
            autoFocus
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") setSubmitted(query);
            }}
            placeholder="e.g. stripe-payments-v2 · auditor-07 · audit-90100 · 0x…"
            style={{ flex: 1, minWidth: 0, background: "none", border: "none", outline: "none", color: "var(--ink)", fontFamily: "var(--sans)", fontSize: 14 }}
          />
          <button
            onClick={() => setSubmitted(query)}
            style={{ flex: "none", display: "flex", alignItems: "center", justifyContent: "center", width: 38, height: 38, background: "var(--mars)", borderRadius: 8, border: "none", cursor: "pointer" }}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" style={{ fill: "none", stroke: "#fff", strokeWidth: 2, strokeLinecap: "round", strokeLinejoin: "round" }}>
              <line x1="5" y1="12" x2="18" y2="12" />
              <polyline points="12,6 19,12 12,18" />
            </svg>
          </button>
        </div>

        {/* example chips */}
        <div style={{ marginTop: 14, display: "flex", flexWrap: "wrap", alignItems: "center", gap: 7 }}>
          <span style={{ fontSize: 9.5, fontWeight: 500, letterSpacing: ".1em", textTransform: "uppercase", color: "var(--ink-3)", marginRight: 2 }}>Try</span>
          {EXAMPLES.map((ex) => (
            <button
              key={ex.label}
              onClick={() => run(ex.sample)}
              style={{ fontSize: 11.5, cursor: "pointer", padding: "5px 12px", borderRadius: 8, border: "1px solid var(--hair)", background: "transparent", color: "var(--ink-2)" }}
            >
              {ex.label} <span style={{ color: "var(--ink-3)", fontFamily: "var(--code)", fontSize: 10.5 }}>{ex.sample}</span>
            </button>
          ))}
        </div>

        {/* result */}
        <div style={{ marginTop: 24 }}>
          {!submitted && <Empty />}
          {submitted && !result && <NoMatch query={submitted} />}
          {result && (
            <div style={{ border: "1px solid var(--hair)", borderRadius: 12, padding: 22, background: "var(--cell)" }}>
              {result.type === "skill" && <SkillDetail s={result.data} />}
              {result.type === "auditor" && <AuditorDetail a={result.data} />}
              {result.type === "user" && <UserDetail u={result.data} />}
              {result.type === "audit" && <AuditDetail a={result.data} />}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function Empty() {
  return (
    <div style={{ textAlign: "center", color: "var(--ink-3)", fontSize: 12.5, padding: "40px 0", border: "1px dashed var(--hair)", borderRadius: 12 }}>
      Enter an id above, or pick an example, to resolve it on the MARS registry.
    </div>
  );
}

function NoMatch({ query }: { query: string }) {
  return (
    <div style={{ textAlign: "center", color: "var(--ink-3)", fontSize: 12.5, padding: "40px 0", border: "1px dashed var(--hair)", borderRadius: 12 }}>
      No entity found for <span style={{ color: "var(--ink-2)", fontFamily: "var(--code)" }}>{query}</span>. Try a skill name, auditor-NN, audit-NNNNN, or 0x… agent id.
    </div>
  );
}
