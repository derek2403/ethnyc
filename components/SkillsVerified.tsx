import { useEffect, useState } from "react";

// ── Cell C · Skills Verified ─────────────────────────────────────────────
// Standalone: a big all-time counter, a sparkline of recent history, and a
// rolling list of recent verdicts. The verdict feed nudges the counter.

interface Verdict {
  skill: string;
  verdict: string;
  color: string;
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

const INITIAL_VERDICTS: Verdict[] = [
  { skill: "uniswap-v3-swap@3.1.0", verdict: "SAFE", color: "var(--safe)" },
  { skill: "twilio-sms-send@0.3.1", verdict: "DANGER", color: "var(--danger)" },
  { skill: "plaid-balance-fetch@1.0", verdict: "SAFE", color: "var(--safe)" },
];

const randomSkill = () =>
  SKILL_NAMES[Math.floor(Math.random() * SKILL_NAMES.length)] +
  "@" +
  (1 + Math.floor(Math.random() * 4)) +
  "." +
  Math.floor(Math.random() * 9) +
  "." +
  Math.floor(Math.random() * 5);

export default function SkillsVerified() {
  const [verified, setVerified] = useState(1284);
  const [hist, setHist] = useState<number[]>(() => Array.from({ length: 24 }, (_, i) => 1268 + i));
  const [recent, setRecent] = useState<Verdict[]>(INITIAL_VERDICTS);

  useEffect(() => {
    const id = setInterval(() => {
      const isSafe = Math.random() >= 0.13;
      const verdict = isSafe ? "SAFE" : "DANGER";
      const entry: Verdict = { skill: randomSkill(), verdict, color: isSafe ? "var(--safe)" : "var(--danger)" };
      setVerified((v) => v + (isSafe ? 1 : 0));
      setRecent((r) => [entry, ...r].slice(0, 4));
      setHist((h) => [...h.slice(1), verified + (isSafe ? 1 : 0)]);
    }, 2200);
    return () => clearInterval(id);
  }, [verified]);

  // sparkline geometry
  const W = 220;
  const H = 42;
  const pad = 4;
  const mn = Math.min(...hist);
  const mx = Math.max(...hist);
  const span = mx - mn || 1;
  const pts = hist.map((v, i) => {
    const x = (i / (hist.length - 1)) * W;
    const y = pad + (H - pad * 2) - ((v - mn) / span) * (H - pad * 2);
    return x.toFixed(1) + "," + y.toFixed(1);
  });
  const [dotX, dotY] = pts[pts.length - 1].split(",");
  const sparkLine = pts.join(" ");
  const sparkArea = "0," + H + " " + sparkLine + " " + W + "," + H;
  const delta = "+" + (hist[hist.length - 1] - hist[0]) + " / hr";

  return (
    <div
      style={{
        gridColumn: "7 / 11",
        gridRow: "2 / 3",
        position: "relative",
        overflow: "hidden",
        background: "var(--cell)",
        border: "1px solid var(--hair)",
        borderRadius: 7,
        display: "flex",
        flexDirection: "column",
      }}
    >
      <div style={{ flex: "none", display: "flex", alignItems: "center", justifyContent: "space-between", padding: "12px 14px", borderBottom: "1px solid var(--hair-soft)" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 9 }}>
          <span style={{ width: 7, height: 7, borderRadius: "50%", background: "var(--safe)" }} />
          <span style={{ fontFamily: "var(--mono)", fontSize: 11, letterSpacing: ".14em", textTransform: "uppercase", color: "var(--ink)" }}>Skills Verified</span>
        </div>
        <span style={{ fontFamily: "var(--mono)", fontSize: 10, color: "var(--safe)" }}>{delta}</span>
      </div>
      <div style={{ flex: 1, minHeight: 0, display: "flex", padding: 14, gap: 16 }}>
        {/* big number + sparkline */}
        <div style={{ flex: 1, display: "flex", flexDirection: "column", justifyContent: "space-between" }}>
          <div>
            <div style={{ fontFamily: "var(--mono)", fontSize: 42, fontWeight: 500, color: "var(--ink)", letterSpacing: "-.02em", lineHeight: 1 }}>
              {verified.toLocaleString()}
            </div>
            <div style={{ fontSize: 10, letterSpacing: ".1em", color: "var(--ink-3)", textTransform: "uppercase", marginTop: 6 }}>verified skills · all-time</div>
          </div>
          <svg viewBox="0 0 220 46" preserveAspectRatio="none" style={{ width: "100%", height: 46, overflow: "visible" }}>
            <polyline points={sparkArea} style={{ fill: "rgba(70,177,127,0.10)", stroke: "none" }} />
            <polyline points={sparkLine} style={{ fill: "none", stroke: "var(--safe)", strokeWidth: 1.5, strokeLinejoin: "round", strokeLinecap: "round" }} />
            <circle cx={dotX} cy={dotY} r="2.5" style={{ fill: "var(--safe)" }} />
          </svg>
        </div>
        {/* recent verdicts */}
        <div style={{ width: 172, flex: "none", borderLeft: "1px solid var(--hair-soft)", paddingLeft: 14, display: "flex", flexDirection: "column", gap: 7 }}>
          <div style={{ fontSize: 9, letterSpacing: ".12em", color: "var(--ink-3)", textTransform: "uppercase" }}>Recent verdicts</div>
          {recent.map((r, i) => (
            <div key={i} style={{ display: "flex", alignItems: "center", gap: 8, fontFamily: "var(--mono)", fontSize: 10 }}>
              <span style={{ width: 6, height: 6, border: "1px solid", borderRadius: 1, flex: "none", borderColor: r.color }} />
              <span style={{ color: "var(--ink-2)", flex: 1, overflow: "hidden", whiteSpace: "nowrap", textOverflow: "ellipsis" }}>{r.skill}</span>
              <span style={{ color: r.color, flex: "none", fontSize: 9 }}>{r.verdict}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
