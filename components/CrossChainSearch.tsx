import { useState } from "react";
import Popout, { ExpandButton } from "./Popout";
import SearchExpanded from "./SearchExpanded";

// ── Cell F · MARS Explorer search ────────────────────────────────────────
// Standalone search box for the MARS registry. The chips are the REAL platform
// categories you can resolve (skill / audit / auditor / user / EVM / HCS topic /
// file hash). Submitting or clicking a chip opens the expanded MARS block explorer
// (SearchExpanded) pre-filled with the query — which resolves it via /api/explorer.

const CHIP_LABELS = ["Skill", "Audit id", "Auditor", "User / agent", "EVM address", "World ID", "HCS topic", "File hash"];

export default function CrossChainSearch() {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [initial, setInitial] = useState("");

  // open the expanded explorer pre-filled with `q` (chip label or typed text)
  const explore = (q: string) => {
    setInitial(q);
    setOpen(true);
  };

  return (
    <>
    <div
      style={{
        gridColumn: "6 / 11",
        gridRow: "3 / 5",
        position: "relative",
        overflow: "hidden",
        background: "var(--cell)",
        border: "1px solid var(--hair)",
        borderRadius: 10,
        display: "flex",
        flexDirection: "column",
      }}
    >
      {/* header — matches the other cells */}
      <div style={{ flex: "none", display: "flex", alignItems: "center", justifyContent: "space-between", padding: "12px 14px", borderBottom: "1px solid var(--hair-soft)" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 9 }}>
          <svg width="14" height="14" viewBox="0 0 24 24" style={{ fill: "none", stroke: "var(--ink-2)", strokeWidth: 1.8, strokeLinecap: "round", strokeLinejoin: "round" }}>
            <circle cx="11" cy="11" r="7" />
            <line x1="16.5" y1="16.5" x2="21" y2="21" />
          </svg>
          <span style={{ fontSize: 11, fontWeight: 600, letterSpacing: ".12em", textTransform: "uppercase", color: "var(--ink)" }}>Explorer</span>
        </div>
        <ExpandButton onClick={() => setOpen(true)} />
      </div>

      {/* body */}
      <div style={{ flex: 1, minHeight: 0, display: "flex", alignItems: "center", justifyContent: "center", padding: 22 }}>
        <div style={{ width: "100%", maxWidth: 620, display: "flex", flexDirection: "column", alignItems: "center" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10, fontSize: 20, fontWeight: 600, color: "var(--ink)", letterSpacing: "-.01em" }}>
            Search anything on
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/logo.svg" alt="Mars" style={{ height: 40, width: "auto", display: "block", marginTop: "-12px", marginLeft: "-12px" }} />
          </div>
          <div style={{ marginTop: 18, width: "100%", display: "flex", alignItems: "center", gap: 10, background: "var(--inset)", border: "1px solid var(--hair)", borderRadius: 8, padding: "6px 6px 6px 14px" }}>
            <svg width="17" height="17" viewBox="0 0 24 24" style={{ fill: "none", stroke: "var(--ink-3)", strokeWidth: 2, flex: "none" }}>
              <circle cx="11" cy="11" r="7" />
              <line x1="16.5" y1="16.5" x2="21" y2="21" strokeLinecap="round" />
            </svg>
            <input
              id="bs-search"
              type="text"
              placeholder="Search a skill, audit, auditor, user, EVM, topic, hash …"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && query.trim() && explore(query.trim())}
              style={{ flex: 1, minWidth: 0, background: "none", border: "none", outline: "none", color: "var(--ink)", fontFamily: "var(--sans)", fontSize: 14 }}
            />
            <button
              onClick={() => explore(query.trim())}
              aria-label="search"
              style={{ flex: "none", display: "flex", alignItems: "center", justifyContent: "center", width: 34, height: 34, background: "var(--mars)", borderRadius: 8, border: "none", cursor: "pointer" }}
            >
              <svg width="16" height="16" viewBox="0 0 24 24" style={{ fill: "none", stroke: "#fff", strokeWidth: 2, strokeLinecap: "round", strokeLinejoin: "round" }}>
                <line x1="5" y1="12" x2="18" y2="12" />
                <polyline points="12,6 19,12 12,18" />
              </svg>
            </button>
          </div>
          <div style={{ marginTop: 14, display: "flex", flexWrap: "wrap", alignItems: "center", justifyContent: "center", gap: 7 }}>
            <span style={{ fontSize: 9.5, fontWeight: 500, letterSpacing: ".1em", textTransform: "uppercase", color: "var(--ink-3)", marginRight: 2 }}>Try searching by</span>
            {CHIP_LABELS.map((label) => (
              <button
                key={label}
                onClick={() => setOpen(true)}
                style={{
                  fontSize: 11.5,
                  cursor: "pointer",
                  padding: "5px 12px",
                  borderRadius: 8,
                  border: "1px solid var(--hair)",
                  background: "transparent",
                  color: "var(--ink-2)",
                }}
              >
                {label}
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
      {open && (
        <Popout title="Explorer" meta="MARS block explorer · resolve any id" onClose={() => setOpen(false)}>
          <SearchExpanded initialQuery={initial} />
        </Popout>
      )}
    </>
  );
}
