// ── Cell F · Cross-chain Search ──────────────────────────────────────────
// Standalone: a Blockscout-style search box. Chips are equal search hints
// that focus the input; the input rewrites the "go" link's href on submit.

const CHIP_LABELS = ["Address", "Domain", "Smart contract", "Transaction", "Token", "DApp", "NFT", "Block"];

export default function CrossChainSearch() {
  const onSearchInput: React.FormEventHandler<HTMLInputElement> = (e) => {
    const v = (e.currentTarget.value || "").trim();
    const a = document.getElementById("bs-go") as HTMLAnchorElement | null;
    if (a) a.href = v ? "https://eth.blockscout.com/search-results?q=" + encodeURIComponent(v) : "https://www.blockscout.com/";
  };
  const onSearchKey: React.KeyboardEventHandler<HTMLInputElement> = (e) => {
    if (e.key === "Enter") {
      const a = document.getElementById("bs-go") as HTMLAnchorElement | null;
      if (a) a.click();
    }
  };

  return (
    <div
      style={{
        gridColumn: "6 / 11",
        gridRow: "3 / 5",
        position: "relative",
        overflow: "hidden",
        background: "var(--cell)",
        border: "1px solid var(--hair)",
        borderRadius: 7,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: 22,
      }}
    >
      <div style={{ width: "100%", maxWidth: 620, display: "flex", flexDirection: "column", alignItems: "center" }}>
        <div style={{ fontFamily: "var(--mono)", fontSize: 10, letterSpacing: ".2em", color: "var(--ink-3)", textTransform: "uppercase" }}>Multichain block explorer</div>
        <div style={{ fontSize: 24, fontWeight: 600, color: "var(--mars)", letterSpacing: "-.01em", marginTop: 6 }}>Simplified cross-chain search</div>
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 16 }}>
          <span style={{ fontSize: 12, fontWeight: 500, background: "var(--mars)", color: "#fff", padding: "7px 15px", borderRadius: 20 }}>Search on chain</span>
          <a href="https://www.blockscout.com/" target="_blank" rel="noopener noreferrer" style={{ fontSize: 12, color: "var(--ink-2)", padding: "7px 12px", textDecoration: "none" }}>
            Explore dapps
          </a>
          <span style={{ display: "flex", alignItems: "center", gap: 5, fontSize: 12, color: "var(--mars)", border: "1px solid var(--mars-soft)", padding: "6px 12px", borderRadius: 20 }}>
            <svg width="12" height="12" viewBox="0 0 24 24" style={{ fill: "var(--mars)" }}>
              <path d="M12 2 l1.8 6.2 L20 10 l-6.2 1.8 L12 18 l-1.8 -6.2 L4 10 l6.2 -1.8 Z" />
            </svg>
            AI mode
          </span>
        </div>
        <div style={{ marginTop: 16, width: "100%", display: "flex", alignItems: "center", gap: 10, background: "var(--inset)", border: "1px solid var(--hair)", borderRadius: 28, padding: "6px 6px 6px 16px" }}>
          <svg width="17" height="17" viewBox="0 0 24 24" style={{ fill: "none", stroke: "var(--ink-3)", strokeWidth: 2, flex: "none" }}>
            <circle cx="11" cy="11" r="7" />
            <line x1="16.5" y1="16.5" x2="21" y2="21" strokeLinecap="round" />
          </svg>
          <input
            id="bs-search"
            type="text"
            placeholder="Search by address / transaction / token / block …"
            onInput={onSearchInput}
            onKeyDown={onSearchKey}
            style={{ flex: 1, minWidth: 0, background: "none", border: "none", outline: "none", color: "var(--ink)", fontFamily: "var(--sans)", fontSize: 14 }}
          />
          <a
            id="bs-go"
            href="https://www.blockscout.com/"
            target="_blank"
            rel="noopener noreferrer"
            style={{ flex: "none", display: "flex", alignItems: "center", justifyContent: "center", width: 38, height: 38, background: "var(--mars)", borderRadius: "50%", textDecoration: "none" }}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" style={{ fill: "none", stroke: "#fff", strokeWidth: 2, strokeLinecap: "round", strokeLinejoin: "round" }}>
              <line x1="5" y1="12" x2="18" y2="12" />
              <polyline points="12,6 19,12 12,18" />
            </svg>
          </a>
        </div>
        <div style={{ marginTop: 14, display: "flex", flexWrap: "wrap", alignItems: "center", justifyContent: "center", gap: 7 }}>
          <span style={{ fontFamily: "var(--mono)", fontSize: 10, color: "var(--ink-3)", marginRight: 2 }}>Try searching by:</span>
          {CHIP_LABELS.map((label) => (
            <button
              key={label}
              onClick={() => document.getElementById("bs-search")?.focus()}
              style={{
                fontSize: 11.5,
                cursor: "pointer",
                padding: "5px 12px",
                borderRadius: 16,
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
  );
}
