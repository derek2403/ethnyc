import { useCallback, useEffect, useRef, useState } from "react";
import { Eyebrow } from "./MarsUI";
import ExplorerResult from "./ExplorerResult";

// Expanded MARS block explorer. Resolves ANY platform id against the live DB via
// /api/explorer — a skill name, audit/task id, auditor id, user/agent id, EVM
// address, World human id, HCS topic, or file hash — and renders the full detail
// (audit trail, synthesizer verdict, attestation, ratings, and every comment).

/* eslint-disable @typescript-eslint/no-explicit-any */

// The real categories you can search by (chips). Each carries a sample, filled in
// from whatever is actually in the DB so the examples always resolve.
const CATEGORIES: { label: string; pick: (db: any) => string | undefined }[] = [
  { label: "Skill", pick: (db) => db.skills?.[0] },
  { label: "Audit / task id", pick: (db) => db.audits?.[0]?.id },
  { label: "Auditor", pick: (db) => db.auditors?.[0] },
  { label: "User / agent", pick: (db) => db.users?.[0] },
  { label: "EVM address", pick: (db) => db._sampleEvm },
  { label: "HCS topic", pick: (db) => db._sampleTopic },
];

export default function SearchExpanded({ initialQuery = "" }: { initialQuery?: string }) {
  const [query, setQuery] = useState(initialQuery);
  const [submitted, setSubmitted] = useState(initialQuery);
  const [match, setMatch] = useState<any>(null);
  const [matches, setMatches] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [landing, setLanding] = useState<any>(null);
  const reqId = useRef(0);

  // landing: templates + sample ids (so the chips show real, resolvable examples)
  useEffect(() => {
    fetch("/api/explorer")
      .then((r) => r.json())
      .then((d) => setLanding(d))
      .catch(() => {});
  }, []);

  const run = useCallback((q: string) => {
    const term = q.trim();
    setQuery(term);
    setSubmitted(term);
    if (!term) {
      setMatch(null);
      setMatches([]);
      return;
    }
    const id = ++reqId.current;
    setLoading(true);
    fetch(`/api/explorer?q=${encodeURIComponent(term)}`)
      .then((r) => r.json())
      .then((d) => {
        if (id !== reqId.current) return; // ignore stale
        setMatch(d.match ?? null);
        setMatches(d.matches ?? []);
        setLoading(false);
      })
      .catch(() => id === reqId.current && setLoading(false));
  }, []);

  // run an initial query if one was passed in (e.g. from the search-cell chips)
  useEffect(() => {
    if (initialQuery) run(initialQuery);
  }, [initialQuery, run]);

  const chips = CATEGORIES.map((c) => ({ label: c.label, sample: landing ? c.pick(landing) : undefined })).filter((c) => c.sample);

  return (
    <div style={{ height: "100%", display: "flex", flexDirection: "column", padding: 28, alignItems: "center", overflow: "auto" }} className="no-bar">
      <div style={{ width: "100%", maxWidth: 720, display: "flex", flexDirection: "column" }}>
        <Eyebrow color="var(--mars)">MARS block explorer</Eyebrow>
        <div style={{ fontSize: 22, fontWeight: 600, marginTop: 6 }}>Search anything on the platform</div>
        <div style={{ fontSize: 12, color: "var(--ink-3)", marginTop: 4 }}>
          Resolve a skill, audit/task id, auditor, user, EVM address, World id, HCS topic, or file hash — against the live registry.
        </div>

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
            onKeyDown={(e) => e.key === "Enter" && run(query)}
            placeholder="e.g. index · 0.0.9229334 · 0.0.9227928 · 0x705e… · sha256…"
            style={{ flex: 1, minWidth: 0, background: "none", border: "none", outline: "none", color: "var(--ink)", fontFamily: "var(--sans)", fontSize: 14 }}
          />
          <button
            onClick={() => run(query)}
            style={{ flex: "none", display: "flex", alignItems: "center", justifyContent: "center", width: 38, height: 38, background: "var(--mars)", borderRadius: 8, border: "none", cursor: "pointer" }}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" style={{ fill: "none", stroke: "#fff", strokeWidth: 2, strokeLinecap: "round", strokeLinejoin: "round" }}>
              <line x1="5" y1="12" x2="18" y2="12" />
              <polyline points="12,6 19,12 12,18" />
            </svg>
          </button>
        </div>

        {/* real-category chips, each with a live example from the DB */}
        <div style={{ marginTop: 14, display: "flex", flexWrap: "wrap", alignItems: "center", gap: 7 }}>
          <span style={{ fontSize: 9.5, fontWeight: 500, letterSpacing: ".1em", textTransform: "uppercase", color: "var(--ink-3)", marginRight: 2 }}>Search by</span>
          {chips.map((ex) => (
            <button
              key={ex.label}
              onClick={() => run(ex.sample as string)}
              title={`example: ${ex.sample}`}
              style={{ fontSize: 11.5, cursor: "pointer", padding: "5px 12px", borderRadius: 8, border: "1px solid var(--hair)", background: "transparent", color: "var(--ink-2)" }}
            >
              {ex.label}
            </button>
          ))}
        </div>

        {/* result */}
        <div style={{ marginTop: 24 }}>
          {!submitted && <Hint />}
          {submitted && loading && <div style={{ textAlign: "center", color: "var(--ink-3)", fontSize: 12.5, padding: "40px 0" }}>resolving…</div>}
          {submitted && !loading && !match && <NoMatch query={submitted} matches={matches} onPick={run} />}
          {match && (
            <>
              <div style={{ border: "1px solid var(--hair)", borderRadius: 12, padding: 22, background: "var(--cell)" }}>
                <ExplorerResult data={match} onPick={run} />
              </div>
              {matches.length > 1 && <DidYouMean matches={matches.filter((m) => m.id !== match.id)} onPick={run} />}
            </>
          )}
        </div>
      </div>
    </div>
  );
}

function Hint() {
  return (
    <div style={{ textAlign: "center", color: "var(--ink-3)", fontSize: 12.5, padding: "40px 0", border: "1px dashed var(--hair)", borderRadius: 12 }}>
      Enter an id or name above, or pick a category, to resolve it on the MARS registry.
    </div>
  );
}

function NoMatch({ query, matches, onPick }: { query: string; matches: any[]; onPick: (q: string) => void }) {
  return (
    <div style={{ textAlign: "center", color: "var(--ink-3)", fontSize: 12.5, padding: "28px 0" }}>
      <div style={{ border: "1px dashed var(--hair)", borderRadius: 12, padding: "26px 0" }}>
        No entity resolves <span style={{ color: "var(--ink-2)", fontFamily: "var(--code)" }}>{query}</span>.
      </div>
      {!!matches.length && <DidYouMean matches={matches} onPick={onPick} />}
    </div>
  );
}

function DidYouMean({ matches, onPick }: { matches: any[]; onPick: (q: string) => void }) {
  const color: Record<string, string> = { skill: "var(--mars)", audit: "var(--warn)", auditor: "var(--comm)", user: "#e8a15c" };
  return (
    <div style={{ marginTop: 16 }}>
      <Eyebrow>Related results · {matches.length}</Eyebrow>
      <div style={{ display: "flex", flexDirection: "column", gap: 6, marginTop: 10 }}>
        {matches.slice(0, 12).map((m) => (
          <button
            key={`${m.type}:${m.id}`}
            onClick={() => onPick(m.id)}
            style={{ textAlign: "left", cursor: "pointer", border: "1px solid var(--hair-soft)", background: "transparent", borderRadius: 8, padding: "8px 11px", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10 }}
          >
            <span style={{ display: "flex", alignItems: "center", gap: 9, minWidth: 0 }}>
              <span style={{ fontSize: 8.5, fontWeight: 700, letterSpacing: ".06em", textTransform: "uppercase", color: color[m.type] || "var(--ink-3)", border: `1px solid ${color[m.type] || "var(--hair)"}`, borderRadius: 5, padding: "2px 6px", flex: "none" }}>{m.type}</span>
              <span style={{ fontFamily: "var(--code)", fontSize: 11.5, color: "var(--ink)", overflow: "hidden", whiteSpace: "nowrap", textOverflow: "ellipsis" }}>{m.label}</span>
            </span>
            <span style={{ fontSize: 10.5, color: "var(--ink-3)", flex: "none" }}>{m.subtitle}</span>
          </button>
        ))}
      </div>
    </div>
  );
}
