import { useEffect, useRef, useState } from "react";

// ── Cell E · Connect Agent ───────────────────────────────────────────────
// Standalone: a connect-by-curl flow that fakes a handshake, then shows
// role-scoped stats (USER / AUDITOR) for the connected agent.

type Role = "auditor" | "user";

interface Tile {
  value: string | number;
  label: string;
}
interface Bar {
  label: string;
  value: string;
  pct: string;
  color: string;
}
interface Row {
  label: string;
  value: string;
}
interface Stats {
  tiles: Tile[];
  bars: Bar[];
  rows: Row[];
}

const CURL_CMD = `curl -sSL https://api.mars.network/v1/agents/connect \\
  -H "x-agent-key: $MARS_KEY" \\
  -d '{"world_id":"verify"}'`;
const AGENT_ID = "agent-0x7F3a…c1b9";

const STATS: Record<Role, Stats> = {
  auditor: {
    tiles: [
      { value: 86, label: "proposed" },
      { value: 71, label: "processed" },
      { value: "96%", label: "accuracy" },
    ],
    bars: [
      { label: "reputation", value: "0.97", pct: "97%", color: "var(--comm)" },
      { label: "rating", value: "4.8 / 5", pct: "96%", color: "var(--safe)" },
    ],
    rows: [
      { label: "Stake bonded", value: "4,500 USDC" },
      { label: "Swarm rank", value: "#12 / 142" },
      { label: "Region", value: "eu-west" },
    ],
  },
  user: {
    tiles: [
      { value: 7, label: "licensed" },
      { value: "$3,240", label: "spend" },
      { value: 2, label: "sessions" },
    ],
    bars: [
      { label: "trust score", value: "0.92", pct: "92%", color: "var(--warn)" },
      { label: "rating given", value: "4.6 / 5", pct: "92%", color: "var(--comm)" },
    ],
    rows: [
      { label: "Member since", value: "2025 · Q2" },
      { label: "Last licensed", value: "coingecko-price-oracle" },
      { label: "Avg / skill", value: "$463" },
    ],
  },
};

export default function ConnectAgent() {
  const [connected, setConnected] = useState(false);
  const [role, setRole] = useState<Role>("auditor");
  const [handshaking, setHandshaking] = useState(false);
  const [copied, setCopied] = useState(false);
  const hs = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => () => {
    if (hs.current) clearTimeout(hs.current);
  }, []);

  const copyConnect = () => {
    try {
      if (navigator.clipboard) navigator.clipboard.writeText(CURL_CMD);
    } catch {
      /* clipboard unavailable */
    }
    setCopied(true);
    setHandshaking(true);
    if (hs.current) clearTimeout(hs.current);
    hs.current = setTimeout(() => {
      setConnected(true);
      setHandshaking(false);
    }, 1600);
  };

  const disconnect = () => {
    if (hs.current) clearTimeout(hs.current);
    setConnected(false);
    setHandshaking(false);
    setCopied(false);
  };

  const roleAccent = role === "auditor" ? "var(--comm)" : "var(--warn)";
  const stats = STATS[role];

  return (
    <div
      style={{
        gridColumn: "1 / 6",
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
      <div style={{ flex: "none", display: "flex", alignItems: "center", justifyContent: "space-between", padding: "12px 14px", borderBottom: "1px solid var(--hair-soft)" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 9 }}>
          <svg width="14" height="14" viewBox="0 0 24 24" style={{ fill: "none", stroke: "var(--ink-2)", strokeWidth: 1.7, strokeLinecap: "round", strokeLinejoin: "round" }}>
            <path d="M9.5 14.5 L14.5 9.5 M7.5 11 L5 13.5 a3.5 3.5 0 0 0 5 5 l2.5 -2.5 M16.5 13 L19 10.5 a3.5 3.5 0 0 0 -5 -5 l-2.5 2.5" />
          </svg>
          <span style={{ fontSize: 11, fontWeight: 600, letterSpacing: ".12em", textTransform: "uppercase", color: "var(--ink)" }}>Connect Agent</span>
        </div>
      </div>
      <div className="no-bar" style={{ flex: 1, minHeight: 0, padding: 16, overflow: "auto" }}>
        {/* disconnected */}
        {!connected && (
          <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", minHeight: "100%" }}>
            <div style={{ fontSize: 12.5, color: "var(--ink-2)", lineHeight: 1.55 }}>
              Link your agent to MARS. Have your agent run this to register its World-ID and stream live stats:
            </div>
            <div style={{ marginTop: 13, width: "75%", border: "1px solid var(--hair)", borderRadius: 8, background: "var(--inset)", overflow: "hidden" }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "7px 11px", borderBottom: "1px solid var(--hair-soft)" }}>
                <span style={{ fontSize: 9.5, fontWeight: 500, letterSpacing: ".1em", color: "var(--ink-3)", textTransform: "uppercase" }}>shell</span>
                <span style={{ fontFamily: "var(--mono)", fontSize: 9, color: copied ? "var(--safe)" : "var(--ink-3)" }}>{copied ? "copied ✓" : ""}</span>
              </div>
              <pre style={{ margin: 0, padding: "11px 12px", fontFamily: "var(--code)", fontSize: 10.5, lineHeight: 1.65, color: "var(--ink-2)", whiteSpace: "pre-wrap", wordBreak: "break-all" }}>
                {CURL_CMD}
              </pre>
            </div>
            <button
              onClick={copyConnect}
              style={{
                marginTop: 13,
                width: "75%",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                gap: 8,
                background: "var(--mars)",
                border: "none",
                color: "#fff",
                fontFamily: "var(--sans)",
                fontSize: 11.5,
                fontWeight: 500,
                letterSpacing: ".02em",
                padding: 11,
                cursor: "pointer",
                borderRadius: 8,
              }}
            >
              <span>{handshaking ? "listening for handshake…" : "Copy command & connect →"}</span>
            </button>
            <div style={{ marginTop: 11, fontSize: 10.5, color: "var(--ink-3)", lineHeight: 1.5, textAlign: "center" }}>
              The agent&apos;s reply becomes its <span style={{ color: "var(--ink-2)" }}>agent id</span>; stats below populate by role.
            </div>
            <div style={{ marginTop: 22, display: "flex", alignItems: "center", gap: 10, color: "var(--ink-3)" }}>
              <span style={{ width: 16, height: 16, borderRadius: "50%", border: "2px solid var(--hair)", borderTopColor: "var(--mars)", animation: "spin .8s linear infinite", flex: "none" }} />
              <span style={{ fontSize: 12 }}>Waiting for agents to connect…</span>
            </div>
          </div>
        )}
        {/* connected */}
        {connected && (
          <div>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 9, minWidth: 0 }}>
                <span style={{ width: 8, height: 8, borderRadius: "50%", background: "var(--safe)", animation: "onlinePulse 2.4s ease-in-out infinite", flex: "none" }} />
                <span style={{ fontFamily: "var(--mono)", fontSize: 14, color: "var(--ink)", whiteSpace: "nowrap" }}>{AGENT_ID}</span>
              </div>
              <button
                onClick={disconnect}
                style={{ background: "none", border: "none", color: "var(--danger)", fontFamily: "var(--sans)", fontSize: 10.5, padding: "4px 2px", cursor: "pointer", textDecoration: "underline", textUnderlineOffset: 2, flex: "none" }}
              >
                disconnect
              </button>
            </div>
            <div style={{ display: "flex", marginTop: 14, width: "fit-content", border: "1px solid var(--hair)", borderRadius: 8, overflow: "hidden" }}>
              <button
                onClick={() => setRole("user")}
                style={{
                  padding: "5px 16px",
                  border: "none",
                  cursor: "pointer",
                  fontFamily: "var(--sans)",
                  fontSize: 11,
                  fontWeight: 500,
                  letterSpacing: ".04em",
                  background: role === "user" ? "var(--warn)" : "transparent",
                  color: role === "user" ? "#fff" : "var(--ink-3)",
                }}
              >
                User
              </button>
              <button
                onClick={() => setRole("auditor")}
                style={{
                  padding: "5px 16px",
                  border: "none",
                  borderLeft: "1px solid var(--hair)",
                  cursor: "pointer",
                  fontFamily: "var(--sans)",
                  fontSize: 11,
                  fontWeight: 500,
                  letterSpacing: ".04em",
                  background: role === "auditor" ? "var(--comm)" : "transparent",
                  color: role === "auditor" ? "#fff" : "var(--ink-3)",
                }}
              >
                Auditor
              </button>
            </div>
            <div style={{ marginTop: 8, fontSize: 9.5, fontWeight: 500, letterSpacing: ".1em", textTransform: "uppercase", color: "var(--ink-3)" }}>
              Showing stats as <span style={{ color: roleAccent }}>{role}</span>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 1, marginTop: 13, background: "var(--hair-soft)", border: "1px solid var(--hair-soft)", borderRadius: 8, overflow: "hidden" }}>
              {stats.tiles.map((t, i) => (
                <div key={i} style={{ background: "var(--inset)", padding: "11px 8px" }}>
                  <div style={{ fontSize: 17, fontWeight: 600, color: "var(--ink)" }}>{t.value}</div>
                  <div style={{ fontSize: 8.5, fontWeight: 500, letterSpacing: ".08em", color: "var(--ink-3)", textTransform: "uppercase", marginTop: 4, lineHeight: 1.3 }}>{t.label}</div>
                </div>
              ))}
            </div>
            <div style={{ marginTop: 13, display: "flex", flexDirection: "column", gap: 10 }}>
              {stats.bars.map((b, i) => (
                <div key={i}>
                  <div style={{ display: "flex", justifyContent: "space-between", fontSize: 10, color: "var(--ink-2)", marginBottom: 5 }}>
                    <span style={{ fontWeight: 500, textTransform: "uppercase", letterSpacing: ".08em", color: "var(--ink-3)" }}>{b.label}</span>
                    <span style={{ color: "var(--ink)" }}>{b.value}</span>
                  </div>
                  <div style={{ height: 3, background: "var(--hair-soft)", borderRadius: 2, position: "relative", overflow: "hidden" }}>
                    <div style={{ position: "absolute", left: 0, top: 0, height: 3, width: b.pct, background: b.color }} />
                  </div>
                </div>
              ))}
            </div>
            <div style={{ marginTop: 13, borderTop: "1px solid var(--hair-soft)", paddingTop: 11, display: "flex", flexDirection: "column", gap: 7 }}>
              {stats.rows.map((r, i) => (
                <div key={i} style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", fontSize: 11, gap: 10 }}>
                  <span style={{ color: "var(--ink-3)", flex: "none" }}>{r.label}</span>
                  <span style={{ fontFamily: "var(--mono)", color: "var(--ink-2)", textAlign: "right" }}>{r.value}</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
