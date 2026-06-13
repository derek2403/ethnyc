import { useEffect, useState } from "react";
import Popout, { ExpandButton } from "./Popout";
import LiveAuditsExpanded from "./LiveAuditsExpanded";

// ── Cell B · Live Audits ─────────────────────────────────────────────────
// Standalone: simulates a handful of in-flight audits advancing through
// 4 stages (Scanner → Sandbox → Fork → Synthesizer).

interface Audit {
  id: string;
  skill: string;
  auditor: string;
  tier: number;
  escrow: string;
  stage: number;
}

const SKILL_NAMES = [
  "stripe-payments-v2",
  "coingecko-price-oracle",
  "twilio-sms-send",
  "uniswap-v3-swap",
  "openai-embed-batch",
  "pdf-extract-tables",
  "plaid-balance-fetch",
  "sendgrid-mailer",
];
const TIERS = ["T1 · STD", "T2 · FIN", "T3 · CRIT"];
const TIER_COLORS = ["var(--ink-3)", "var(--warn)", "var(--danger)"];
const STAGE_NAMES = ["Scanner", "Sandbox", "Fork", "Synthesizer"];

const newAudit = (): Audit => {
  const i = Math.floor(Math.random() * SKILL_NAMES.length);
  return {
    id: "a" + Math.random().toString(36).slice(2, 7),
    skill: SKILL_NAMES[i] + "@" + (1 + Math.floor(Math.random() * 4)) + "." + Math.floor(Math.random() * 9) + "." + Math.floor(Math.random() * 5),
    auditor: "auditor-" + String(1 + Math.floor(Math.random() * 16)).padStart(2, "0"),
    tier: Math.floor(Math.random() * 3),
    escrow: (1500 + Math.floor(Math.random() * 12) * 500).toLocaleString() + " USDC",
    stage: Math.floor(Math.random() * 2),
  };
};

// Deterministic seed so server / first client render match.
const seedAudit = (i: number): Audit => {
  const skill = SKILL_NAMES[i % SKILL_NAMES.length];
  return {
    id: "seed" + i,
    skill: skill + "@" + (1 + (i % 4)) + "." + (i % 9) + "." + (i % 5),
    auditor: "auditor-" + String(1 + (i % 16)).padStart(2, "0"),
    tier: i % 3,
    escrow: (1500 + (i % 12) * 500).toLocaleString() + " USDC",
    stage: i % 2,
  };
};

export default function LiveAudits() {
  const [audits, setAudits] = useState<Audit[]>(() => [0, 1, 2, 3].map(seedAudit));
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const id = setInterval(() => {
      setAudits((prev) => {
        const la = prev.map((a) => ({ ...a }));
        const i = Math.floor(Math.random() * la.length);
        la[i].stage += 1;
        if (la[i].stage > 3) la[i] = newAudit();
        return la;
      });
    }, 2200);
    return () => clearInterval(id);
  }, []);

  return (
    <>
    <div
      style={{
        gridColumn: "7 / 11",
        gridRow: "1 / 2",
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
          <svg width="14" height="14" viewBox="0 0 24 24" style={{ fill: "none", stroke: "var(--ink-2)", strokeWidth: 1.8, strokeLinecap: "round", strokeLinejoin: "round" }}>
            <polyline points="2 12 6 12 9 4 14 20 17 12 22 12" />
          </svg>
          <span style={{ fontSize: 11, fontWeight: 600, letterSpacing: ".12em", textTransform: "uppercase", color: "var(--ink)" }}>Live Audits</span>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <span style={{ fontSize: 10, color: "var(--ink-3)" }}>{audits.length} in flight</span>
          <ExpandButton onClick={() => setOpen(true)} />
        </div>
      </div>
      <div style={{ flex: 1, minHeight: 0, overflow: "hidden", padding: "6px 14px", display: "flex", flexDirection: "column", gap: 6 }}>
        {audits.map((a) => {
          const st = Math.min(a.stage, 3);
          const stageColor = st === 3 ? "var(--safe)" : "var(--warn)";
          return (
            <div key={a.id} className="mars-audit-card" style={{ border: "1px solid var(--hair-soft)", borderRadius: 8, padding: "8px 11px" }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10 }}>
                <span style={{ fontFamily: "var(--mono)", fontSize: 11, color: "var(--ink)", flex: 1, minWidth: 0, overflow: "hidden", whiteSpace: "nowrap", textOverflow: "ellipsis" }}>
                  {a.skill}
                </span>
                <span
                  style={{
                    fontSize: 9,
                    color: TIER_COLORS[a.tier],
                    border: "1px solid var(--hair-soft)",
                    padding: "1.5px 6px",
                    borderRadius: 6,
                    letterSpacing: ".06em",
                    flex: "none",
                    whiteSpace: "nowrap",
                  }}
                >
                  {TIERS[a.tier]}
                </span>
              </div>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginTop: 6, fontFamily: "var(--mono)", fontSize: 9.5, color: "var(--ink-3)" }}>
                <span>
                  {a.auditor} · {a.escrow}
                </span>
                <span style={{ color: stageColor }}>
                  {st + 1}/4 {STAGE_NAMES[st]}
                </span>
              </div>
              <div style={{ height: 3, background: "var(--hair-soft)", borderRadius: 2, marginTop: 7, position: "relative", overflow: "hidden" }}>
                <div style={{ position: "absolute", left: 0, top: 0, height: 3, width: ((st + 1) / 4) * 100 + "%", background: stageColor, transition: "width .6s ease" }} />
              </div>
            </div>
          );
        })}
      </div>
    </div>
      {open && (
        <Popout title="Live Audits" meta="click an audit for its trail & pipeline steps" onClose={() => setOpen(false)}>
          <LiveAuditsExpanded />
        </Popout>
      )}
    </>
  );
}
