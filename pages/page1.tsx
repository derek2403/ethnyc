import { useEffect, useState } from "react";
import Head from "next/head";
import SystemExplorer from "@/components/SystemExplorer";
import LiveAudits from "@/components/LiveAudits";
import SkillsVerified from "@/components/SkillsVerified";
import ConnectAgent from "@/components/ConnectAgent";
import CrossChainSearch from "@/components/CrossChainSearch";

// Mars System Dashboard — bento explorer (5×4 grid).
// Header + the 5 standalone cell components, with shared design tokens
// (CSS custom properties + keyframes) declared once as global styles.

export default function Page1() {
  // Clock is filled after mount to keep SSR / first client render in sync.
  const [clock, setClock] = useState("--:--:--");
  useEffect(() => {
    const tick = () => setClock(new Date().toUTCString().slice(17, 25));
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, []);

  return (
    <>
      <Head>
        <title>Mars System Dashboard</title>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
        <link
          href="https://fonts.googleapis.com/css2?family=Geist:wght@300;400;500;600&family=Geist+Mono:wght@400;500&display=swap"
          rel="stylesheet"
        />
      </Head>

      <div
        style={{
          width: "100%",
          height: "100vh",
          display: "flex",
          flexDirection: "column",
          overflow: "hidden",
          background: "radial-gradient(120% 90% at 28% 12%, #ffffff 0%, var(--space) 62%)",
        }}
      >
        {/* ── TOP BAR ── */}
        <header
          style={{
            flex: "none",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            height: 54,
            padding: "0 22px",
            borderBottom: "1px solid var(--hair)",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 11 }}>
            <svg width="22" height="22" viewBox="0 0 22 22" style={{ fill: "none", stroke: "var(--mars)", strokeWidth: 1.3 }}>
              <circle cx="11" cy="11" r="9" />
              <ellipse cx="11" cy="11" rx="9" ry="3.4" />
              <ellipse cx="11" cy="11" rx="3.4" ry="9" />
            </svg>
            <div style={{ lineHeight: 1 }}>
              <div style={{ fontWeight: 600, fontSize: 15, letterSpacing: ".16em" }}>MARS</div>
              <div style={{ fontFamily: "var(--mono)", fontSize: 9, letterSpacing: ".18em", color: "var(--ink-3)", marginTop: 3, textTransform: "uppercase" }}>
                System Dashboard
              </div>
            </div>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <span style={{ width: 8, height: 8, borderRadius: "50%", background: "var(--safe)", animation: "onlinePulse 2.4s ease-in-out infinite", flex: "none" }} />
              <span style={{ fontFamily: "var(--mono)", fontSize: 11, color: "var(--ink-2)", letterSpacing: ".04em" }}>network online</span>
            </div>
            <div style={{ width: 1, height: 24, background: "var(--hair)" }} />
            <span style={{ fontFamily: "var(--mono)", fontSize: 12, color: "var(--ink)", letterSpacing: ".06em" }}>{clock} UTC</span>
          </div>
        </header>

        {/* ── BENTO GRID ── */}
        <div style={{ flex: 1, minHeight: 0, padding: 16 }}>
          <div style={{ height: "100%", display: "grid", gridTemplateColumns: "repeat(10,1fr)", gridTemplateRows: "repeat(4,1fr)", gap: 12 }}>
            <SystemExplorer />
            <LiveAudits />
            <SkillsVerified />
            <ConnectAgent />
            <CrossChainSearch />
          </div>
        </div>
      </div>

      <style jsx global>{`
        :root {
          /* Soft-light theme — clean analytics look (was the dark "space" theme) */
          --space: #eef0f4; /* outermost canvas */
          --space-2: #e6e9ef;
          --cell: rgba(255, 255, 255, 0.78); /* bento cell surface */
          --panel: rgba(255, 255, 255, 0.94); /* floating popover panel */
          --inset: #f1f3f7; /* recessed tiles / code / inputs */
          --scrim: rgba(248, 249, 251, 0.9); /* top fade over the explorer SVG */
          --ink: #1b1d24;
          --ink-2: #565b66;
          --ink-3: #9498a2;
          --hair: rgba(0, 0, 0, 0.12);
          --hair-soft: rgba(0, 0, 0, 0.06);
          --mars: #c2542a;
          --mars-soft: rgba(194, 84, 42, 0.5);
          --moon: #6b7180;
          --safe: #1f9d63;
          --danger: #d23f2e;
          --warn: #b9780f;
          --comm: #2f6fd0;
          --violet: #5b47d6;
          --sans: "Geist", "Geist Fallback", system-ui, sans-serif;
          --mono: "Geist Mono", ui-monospace, "SF Mono", monospace;
        }
        * {
          box-sizing: border-box;
        }
        html,
        body {
          margin: 0;
          height: 100%;
          overflow: hidden;
        }
        body {
          background: radial-gradient(120% 90% at 28% 12%, #ffffff 0%, var(--space) 62%);
          color: var(--ink);
          font-family: var(--sans);
          -webkit-font-smoothing: antialiased;
        }
        @keyframes onlinePulse {
          0%,
          100% {
            opacity: 1;
            transform: scale(1);
          }
          50% {
            opacity: 0.3;
            transform: scale(0.6);
          }
        }
        @keyframes starBreath {
          0%,
          100% {
            opacity: 0.45;
          }
          50% {
            opacity: 0.9;
          }
        }
        @keyframes float1 {
          0%,
          100% {
            transform: translateY(0);
          }
          50% {
            transform: translateY(-6px);
          }
        }
        @keyframes float2 {
          0%,
          100% {
            transform: translateY(0);
          }
          50% {
            transform: translateY(5px);
          }
        }
        /* hover affordances (translated from the design's style-hover attrs) */
        .mars-audit-card:hover {
          border-color: var(--hair);
          background: rgba(0, 0, 0, 0.03);
        }
        .body-hit-comm:hover {
          stroke: var(--comm);
          stroke-width: 1;
        }
        .body-hit-warn:hover {
          stroke: var(--warn);
          stroke-width: 1;
        }
        .star-hit:hover {
          stroke: var(--moon-accent);
          stroke-width: 1;
        }
      `}</style>
    </>
  );
}
