import { useEffect, useState } from "react";
import Head from "next/head";
import SystemExplorer from "@/components/SystemExplorer";
import LiveAudits from "@/components/LiveAudits";
import SkillsVerified from "@/components/SkillsVerified";
import ConnectAgent from "@/components/ConnectAgent";
import CrossChainSearch from "@/components/CrossChainSearch";
import { MarsProvider } from "@/components/marsState";

// Mars System Dashboard — bento explorer (5×4 grid).
// Header + the 5 standalone cell components, with shared design tokens
// (CSS custom properties + keyframes) declared once as global styles.

export default function Page1() {
  // Clock is filled after mount to keep SSR / first client render in sync.
  const [clock, setClock] = useState("--:--:--");
  useEffect(() => {
    const tick = () => setClock(new Date().toLocaleTimeString("en-US", { timeZone: "America/New_York", hour12: false }));
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
          href="https://fonts.googleapis.com/css2?family=Geist+Mono:wght@400;500&family=Inter:wght@400;500;600;700&display=swap"
          rel="stylesheet"
        />
      </Head>

      <MarsProvider>
      <div
        style={{
          // Uniform ~10% up-scale so all text/UI reads a little larger while
          // still fitting the viewport exactly (no scroll). The modal escapes
          // this via a portal so it stays at true viewport size.
          width: "calc(100% / 1.1)",
          height: "calc(100vh / 1.1)",
          transform: "scale(1.1)",
          transformOrigin: "top left",
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
          {/* Replace /public/logo.svg with your logo (SVG preferred; or a transparent PNG — see note). */}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/logo.svg" alt="MARS" style={{ height: 34, width: "auto", display: "block" }} />
          <span style={{ fontFamily: "var(--mono)", fontSize: 12, color: "var(--ink)", letterSpacing: ".06em" }}>{clock} NYC</span>
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
      </MarsProvider>

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
          /* Professional sans throughout; --mono is now also Inter (kept as a
             token so existing references work) — true monospace lives in --code. */
          --sans: "Inter", system-ui, -apple-system, sans-serif;
          --mono: "Inter", system-ui, -apple-system, sans-serif;
          --code: "Geist Mono", ui-monospace, "SF Mono", monospace;
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
          font-variant-numeric: tabular-nums;
          -webkit-font-smoothing: antialiased;
        }
        @keyframes popFade {
          from {
            opacity: 0;
          }
          to {
            opacity: 1;
          }
        }
        @keyframes popIn {
          from {
            opacity: 0;
            transform: scale(0.97);
          }
          to {
            opacity: 1;
            transform: scale(1);
          }
        }
        /* hover-to-pause: freeze all SVG animation in the expanded map */
        .map-paused * {
          animation-play-state: paused !important;
        }
        /* hide scrollbars on panels that occasionally overflow */
        .no-bar {
          scrollbar-width: none;
          -ms-overflow-style: none;
        }
        .no-bar::-webkit-scrollbar {
          display: none;
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
        @keyframes spin {
          to {
            transform: rotate(360deg);
          }
        }
        /* audit dots travelling along the connection lines (motion-path) */
        @keyframes exMove {
          from {
            offset-distance: 0%;
          }
          to {
            offset-distance: 100%;
          }
        }
        /* hover affordances (translated from the design's style-hover attrs) */
        .mars-audit-card:hover {
          border-color: var(--hair);
          background: rgba(0, 0, 0, 0.03);
        }
        /* Connect Agent · connected-agent rows (full-width, link to HashScan) */
        .ca-agent-card {
          display: block;
          border-radius: 8px;
          transition: background 0.15s ease;
        }
        .ca-agent-card:hover {
          background: rgba(0, 0, 0, 0.025);
        }
        /* hairline divider between consecutive rows */
        .ca-agent-card + .ca-agent-card {
          border-top: 1px solid var(--hair-soft);
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
