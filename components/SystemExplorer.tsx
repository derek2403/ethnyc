import { useMemo, useState } from "react";
import Popout, { ExpandButton } from "./Popout";
import ExplorerExpanded from "./ExplorerExpanded";
import { useMars } from "./marsState";

// ── Cell A · System Explorer ─────────────────────────────────────────────
// Standalone: holds its own view / selection / Mars-panel state and runs its
// own audit-trail + KPI simulation. Translated from the original DCLogic class.

type View = "system" | "phobos" | "deimos";
type EntityType = "auditor" | "user";

interface Auditor {
  id: string;
  status: string;
  rep: number;
  rating: number;
  proposed: number;
  processed: number;
  accuracy: number;
  stake: number;
  region: string;
  spec: string;
  last: string;
  worldId?: string;
  worldVerified?: boolean;
  registeredAt?: string | null;
  x: number;
  y: number;
}

interface User {
  id: string;
  skills: number;
  spend: number;
  since: string;
  rating: number;
  sessions: number;
  last: string;
  active: boolean;
  worldId?: string;
  worldVerified?: boolean;
  registeredAt?: string | null;
  x: number;
  y: number;
}

interface Star {
  id: string;
  x: number;
  y: number;
  r: number;
  color: string;
  sparkle: string;
  tw: string;
  twFrom: string;
  selected: boolean;
  label: string;
  labelY: string;
  onClick: () => void;
}

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
interface Selection {
  kind: string;
  title: string;
  accent: string;
  verified: boolean;
  status: string;
  statusColor: string;
  tiles: Tile[];
  bars: Bar[];
  rows: Row[];
}

const joined = (e: { registeredAt?: string | null; since?: string; last?: string }) =>
  (e.registeredAt || e.since || e.last || "").slice(0, 10) || "—";
interface TrailRow {
  id: string;
  time: string;
  text: string;
  color: string;
}

const pct = (v: number) => Math.round(v * 100) + "%";

// Golden-angle sunflower layout — deterministic positions for the moon stars.
const GA = Math.PI * (3 - Math.sqrt(5));
function layout(n: number, minR: number, maxR: number) {
  const o: { x: number; y: number }[] = [];
  for (let i = 0; i < n; i++) {
    const a = i * GA;
    const r = minR + (maxR - minR) * Math.sqrt((i + 0.5) / n);
    o.push({ x: Math.round(290 + r * Math.cos(a)), y: Math.round(205 + r * Math.sin(a)) });
  }
  return o;
}

export default function SystemExplorer() {
  const { state } = useMars();
  const aPos = useMemo(() => layout(Math.max(state.auditors.length, 1), 128, 172), [state.auditors.length]);
  const uPos = useMemo(() => layout(Math.max(state.users.length, 1), 124, 176), [state.users.length]);
  const auditors: Auditor[] = state.auditors.map((a, i) => ({ ...a, x: aPos[i % aPos.length].x, y: aPos[i % aPos.length].y }));
  const users: User[] = state.users.map((u, i) => ({ ...u, x: uPos[i % uPos.length].x, y: uPos[i % uPos.length].y }));

  const [view, setView] = useState<View>("system");
  const [marsOpen, setMarsOpen] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [selectedType, setSelectedType] = useState<EntityType | null>(null);
  const [open, setOpen] = useState(false);

  // audit-trail feed, sequence and KPIs — all from the DB
  const trail: TrailRow[] = state.audits.slice(0, 9).map((a) => ({
    id: a.id,
    time: a.date && a.date !== "now" ? a.date.slice(11, 19) : "now",
    text: `${a.skill} · ${a.verdict}`,
    color: a.verdict === "DANGEROUS" ? "var(--danger)" : a.verdict === "SAFE" ? "var(--safe)" : "var(--warn)",
  }));
  const seq = String(state.audits.length);

  const goSystem = () => {
    setView("system");
    setMarsOpen(false);
    setSelectedId(null);
    setSelectedType(null);
  };
  const goPhobos = () => {
    setView("phobos");
    setMarsOpen(false);
    setSelectedId(null);
    setSelectedType("auditor");
  };
  const goDeimos = () => {
    setView("deimos");
    setMarsOpen(false);
    setSelectedId(null);
    setSelectedType("user");
  };
  const openMars = () => {
    setMarsOpen(true);
    setSelectedId(null);
  };
  const closeMars = () => setMarsOpen(false);
  const selectStar = (type: EntityType, id: string) => {
    setSelectedType(type);
    setSelectedId(id);
  };
  const clearSel = () => setSelectedId(null);

  const isSystem = view === "system";
  const isMoon = !isSystem;
  const isA = view === "phobos";
  const moonAccent = isA ? "var(--comm)" : "var(--warn)";

  const stars: Star[] = (isA ? auditors : users).map((e, i) => {
    const selected = e.id === selectedId;
    const base = isA ? (e as Auditor).rep : (e as User).rating / 5;
    return {
      id: e.id,
      x: e.x,
      y: e.y,
      r: selected ? 3.2 : 1.5 + base * 1.5,
      color: moonAccent,
      sparkle: selected ? "0.9" : "0",
      tw: (3 + (i % 5) * 0.7).toFixed(1),
      twFrom: (0.35 + (i % 4) * 0.12).toFixed(2),
      selected,
      label: selected ? e.id : "",
      labelY: selected ? "-20" : "0",
      onClick: () => selectStar(isA ? "auditor" : "user", e.id),
    };
  });

  const buildSelection = (): Selection | null => {
    if (!selectedId) return null;
    if (selectedType === "auditor") {
      const a = auditors.find((x) => x.id === selectedId);
      if (!a) return null;
      const sc = a.status === "auditing" ? "var(--warn)" : a.status === "active" ? "var(--safe)" : "var(--ink-3)";
      return {
        kind: "Auditor agent",
        title: a.id,
        accent: "var(--comm)",
        verified: !!a.worldVerified,
        status: a.status,
        statusColor: sc,
        // proposed = audits this auditor ran; rating = avg from requester reviews
        tiles: [
          { value: a.proposed, label: "audits" },
          { value: a.rating.toFixed(1), label: "rating" },
          { value: a.rep.toFixed(2), label: "reputation" },
        ],
        bars: [{ label: "rating", value: a.rating.toFixed(1) + " / 5", pct: pct(a.rating / 5), color: "var(--safe)" }],
        rows: [
          { label: "Date joined", value: joined(a) },
          { label: "World ID", value: a.worldVerified ? "verified" : "not verified" },
          { label: "Status", value: a.status },
        ],
      };
    }
    const u = users.find((x) => x.id === selectedId);
    if (!u) return null;
    return {
      kind: "User agent",
      title: u.id,
      accent: "var(--warn)",
      verified: !!u.worldVerified,
      status: u.active ? "licensing now" : "idle",
      statusColor: u.active ? "var(--safe)" : "var(--ink-3)",
      // skills = verified skills licensed; sessions = audits this agent requested
      tiles: [
        { value: u.skills, label: "licensed" },
        { value: u.sessions, label: "audits" },
        { value: u.rating.toFixed(1), label: "rating" },
      ],
      bars: [{ label: "rating given", value: u.rating.toFixed(1) + " / 5", pct: pct(u.rating / 5), color: "var(--warn)" }],
      rows: [
        { label: "Date joined", value: joined(u) },
        { label: "World ID", value: u.worldVerified ? "verified" : "not verified" },
        { label: "Last audit", value: u.last },
      ],
    };
  };

  const sel = buildSelection();
  const hasSelection = !!selectedId && isMoon && !!sel;
  const moonAtmoBig = isA ? "atmoC2" : "atmoW2";

  const marsStats = [
    { value: String(state.stats.auditsInFlight), label: "audits in progress", color: "var(--warn)" },
    { value: String(state.stats.skillsVerified), label: "skills verified", color: "var(--safe)" },
    { value: String(state.stats.flagged), label: "flagged dangerous", color: "var(--danger)" },
    { value: String(state.stats.agents), label: "agents", color: "var(--ink)" },
  ];

  return (
    <>
    <div
      style={{
        gridColumn: "1 / 7",
        gridRow: "1 / 3",
        overflow: "hidden",
        background: "var(--cell)",
        border: "1px solid var(--hair)",
        borderRadius: 10,
        display: "flex",
        flexDirection: "column",
      }}
    >
      {/* cell header — matches the other four cells */}
      <div style={{ flex: "none", display: "flex", alignItems: "center", justifyContent: "space-between", padding: "12px 14px", borderBottom: "1px solid var(--hair-soft)" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 9 }}>
          <svg width="15" height="15" viewBox="0 0 22 22" style={{ fill: "none", stroke: "var(--ink-2)", strokeWidth: 1.4 }}>
            <circle cx="11" cy="11" r="8.2" />
            <ellipse cx="11" cy="11" rx="8.2" ry="3.1" />
            <ellipse cx="11" cy="11" rx="3.1" ry="8.2" />
          </svg>
          <span style={{ fontSize: 11, fontWeight: 600, letterSpacing: ".12em", textTransform: "uppercase", color: "var(--ink)" }}>Network Explorer</span>
          {isMoon && (
            <button
              onClick={goSystem}
              style={{ display: "flex", alignItems: "center", gap: 6, background: "none", border: "1px solid var(--hair)", color: "var(--ink-2)", fontSize: 10, letterSpacing: ".04em", padding: "3px 8px", cursor: "pointer", borderRadius: 6, marginLeft: 4 }}
            >
              ← system
            </button>
          )}
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <span style={{ fontSize: 9.5, color: "var(--ink-3)", letterSpacing: ".04em" }}>
            {isSystem ? "click a body to explore" : "click a star"}
          </span>
          <ExpandButton onClick={() => setOpen(true)} />
        </div>
      </div>

      {/* body */}
      <div style={{ flex: 1, minHeight: 0, position: "relative", overflow: "hidden" }}>

      {/* ── SYSTEM VIEW ── */}
      {isSystem && (
        <svg viewBox="0 0 840 408" preserveAspectRatio="xMidYMid slice" style={{ position: "absolute", inset: 0, width: "100%", height: "100%" }}>
          <defs>
            <clipPath id="marsClip">
              <circle cx="260" cy="205" r="112" />
            </clipPath>
            <radialGradient id="marsGlow" cx="50%" cy="50%" r="50%">
              <stop offset="84%" stopColor="rgba(194,84,42,0)" />
              <stop offset="100%" stopColor="rgba(194,84,42,0.14)" />
            </radialGradient>
            <pattern id="rockTex" width="46" height="46" patternUnits="userSpaceOnUse">
              <animateTransform attributeName="patternTransform" type="translate" from="0 0" to="46 0" dur="16s" repeatCount="indefinite" />
              <ellipse cx="12" cy="14" rx="6" ry="4" fill="rgba(38,40,48,0.5)" />
              <ellipse cx="33" cy="31" rx="8" ry="5" fill="rgba(38,40,48,0.42)" />
              <circle cx="38" cy="9" r="2" fill="rgba(214,218,226,0.4)" />
              <circle cx="20" cy="37" r="1.5" fill="rgba(214,218,226,0.35)" />
            </pattern>
            <radialGradient id="sphereShade" cx="34%" cy="29%" r="74%">
              <stop offset="0%" stopColor="rgba(255,255,255,0.42)" />
              <stop offset="30%" stopColor="rgba(255,255,255,0)" />
              <stop offset="66%" stopColor="rgba(0,0,0,0.12)" />
              <stop offset="100%" stopColor="rgba(0,0,0,0.72)" />
            </radialGradient>
            <radialGradient id="spec" cx="50%" cy="50%" r="50%">
              <stop offset="0%" stopColor="rgba(255,255,255,0.55)" />
              <stop offset="100%" stopColor="rgba(255,255,255,0)" />
            </radialGradient>
            <radialGradient id="atmoComm" cx="50%" cy="50%" r="50%">
              <stop offset="70%" style={{ stopColor: "var(--comm)", stopOpacity: 0 }} />
              <stop offset="84%" style={{ stopColor: "var(--comm)", stopOpacity: 0.42 }} />
              <stop offset="100%" style={{ stopColor: "var(--comm)", stopOpacity: 0 }} />
            </radialGradient>
            <radialGradient id="atmoWarn" cx="50%" cy="50%" r="50%">
              <stop offset="70%" style={{ stopColor: "var(--warn)", stopOpacity: 0 }} />
              <stop offset="84%" style={{ stopColor: "var(--warn)", stopOpacity: 0.42 }} />
              <stop offset="100%" style={{ stopColor: "var(--warn)", stopOpacity: 0 }} />
            </radialGradient>
          </defs>

          {/* orbit rings */}
          <g transform="rotate(-12 260 205)" style={{ fill: "none", stroke: "var(--hair)", strokeWidth: 1, strokeDasharray: "2 7" }}>
            <ellipse cx="260" cy="205" rx="240" ry="126" />
            <ellipse cx="260" cy="205" rx="345" ry="180" />
          </g>

          {/* connections — drawn center-to-center; the planets render on top
              and cover the inner ends, so the lines read as connected */}
          <g style={{ fill: "none", strokeWidth: 1.1 }}>
            <path d="M260,205 L580,115" style={{ stroke: "var(--comm)", strokeDasharray: "2 6", opacity: 0.5 }} />
            <circle r="2.4" style={{ fill: "var(--comm)" }}>
              <animateMotion dur="3s" repeatCount="indefinite" path="M260,205 L580,115" />
            </circle>
            <circle r="1.8" style={{ fill: "var(--comm)", opacity: 0.6 }}>
              <animateMotion dur="3s" begin="1.5s" repeatCount="indefinite" path="M580,115 L260,205" />
            </circle>
            <path d="M260,205 L665,310" style={{ stroke: "var(--warn)", strokeDasharray: "2 6", opacity: 0.5 }} />
            <circle r="2.4" style={{ fill: "var(--warn)" }}>
              <animateMotion dur="3.4s" repeatCount="indefinite" path="M260,205 L665,310" />
            </circle>
            <circle r="1.8" style={{ fill: "var(--warn)", opacity: 0.6 }}>
              <animateMotion dur="3.4s" begin="1.7s" repeatCount="indefinite" path="M665,310 L260,205" />
            </circle>
            <path d="M580,115 L665,310" style={{ stroke: "var(--safe)", strokeDasharray: "2 6", opacity: 0.4 }} />
            <circle r="2.2" style={{ fill: "var(--safe)" }}>
              <animateMotion dur="4s" repeatCount="indefinite" path="M580,115 L665,310" />
            </circle>
          </g>

          {/* MARS planet (clickable) — swap /public/mars.svg to change it */}
          <g style={{ cursor: "pointer" }} onClick={openMars}>
            <circle cx="260" cy="205" r="124" fill="url(#marsGlow)" />
            <image href="/mars.svg" x="148" y="93" width="224" height="224" preserveAspectRatio="xMidYMid meet" />
          </g>

          {/* PHOBOS · planet image (auditors) */}
          <g style={{ cursor: "pointer", animation: "float1 9s ease-in-out infinite" }} onClick={goPhobos}>
            <circle cx="580" cy="115" r="50" fill="transparent" />
            <image href="/phobos.svg" x="544" y="79" width="72" height="72" preserveAspectRatio="xMidYMid meet" />
          </g>

          {/* DEIMOS · planet image (users) */}
          <g style={{ cursor: "pointer", animation: "float2 11s ease-in-out infinite" }} onClick={goDeimos}>
            <circle cx="665" cy="310" r="42" fill="transparent" />
            <image href="/deimos.svg" x="637" y="282" width="56" height="56" preserveAspectRatio="xMidYMid meet" />
          </g>
        </svg>
      )}

      {/* ── MOON VIEW ── */}
      {isMoon && (
        <>
          <svg
            viewBox="0 0 840 408"
            preserveAspectRatio="xMidYMid slice"
            style={{ position: "absolute", inset: 0, width: "100%", height: "100%", ["--moon-accent" as string]: moonAccent } as React.CSSProperties}
          >
            <defs>
              <pattern id="rockTex2" width="46" height="46" patternUnits="userSpaceOnUse">
                <animateTransform attributeName="patternTransform" type="translate" from="0 0" to="46 0" dur="22s" repeatCount="indefinite" />
                <ellipse cx="12" cy="14" rx="6" ry="4" fill="rgba(38,40,48,0.5)" />
                <ellipse cx="33" cy="31" rx="8" ry="5" fill="rgba(38,40,48,0.42)" />
                <circle cx="38" cy="9" r="2" fill="rgba(214,218,226,0.4)" />
                <circle cx="20" cy="37" r="1.5" fill="rgba(214,218,226,0.35)" />
              </pattern>
              <radialGradient id="sphereShade2" cx="34%" cy="29%" r="74%">
                <stop offset="0%" stopColor="rgba(255,255,255,0.42)" />
                <stop offset="30%" stopColor="rgba(255,255,255,0)" />
                <stop offset="66%" stopColor="rgba(0,0,0,0.12)" />
                <stop offset="100%" stopColor="rgba(0,0,0,0.72)" />
              </radialGradient>
              <radialGradient id="spec2" cx="50%" cy="50%" r="50%">
                <stop offset="0%" stopColor="rgba(255,255,255,0.55)" />
                <stop offset="100%" stopColor="rgba(255,255,255,0)" />
              </radialGradient>
              <radialGradient id="atmoC2" cx="50%" cy="50%" r="50%">
                <stop offset="70%" style={{ stopColor: "var(--comm)", stopOpacity: 0 }} />
                <stop offset="85%" style={{ stopColor: "var(--comm)", stopOpacity: 0.4 }} />
                <stop offset="100%" style={{ stopColor: "var(--comm)", stopOpacity: 0 }} />
              </radialGradient>
              <radialGradient id="atmoW2" cx="50%" cy="50%" r="50%">
                <stop offset="70%" style={{ stopColor: "var(--warn)", stopOpacity: 0 }} />
                <stop offset="85%" style={{ stopColor: "var(--warn)", stopOpacity: 0.4 }} />
                <stop offset="100%" style={{ stopColor: "var(--warn)", stopOpacity: 0 }} />
              </radialGradient>
            </defs>

            {/* connection lines moon → stars */}
            <g style={{ fill: "none", strokeWidth: 0.8, opacity: 0.3 }}>
              {stars.map((s) => (
                <line key={s.id} x1="290" y1="205" x2={s.x} y2={s.y} style={{ stroke: moonAccent, strokeDasharray: "2 6" }} />
              ))}
            </g>

            {/* 3D moon */}
            <g style={{ animation: "float1 13s ease-in-out infinite" }}>
              <circle cx="290" cy="205" r="132" fill={`url(#${moonAtmoBig})`} />
              <image href={isA ? "/phobos.svg" : "/deimos.svg"} x="178" y="93" width="224" height="224" preserveAspectRatio="xMidYMid meet" />
            </g>

            {/* stars */}
            <g>
              {stars.map((s) => (
                <g key={s.id} transform={`translate(${s.x} ${s.y})`} style={{ cursor: "pointer" }} onClick={s.onClick}>
                  <circle className="star-hit" r="15" fill="transparent" />
                  <circle r={s.r} style={{ fill: s.color }}>
                    <animate attributeName="opacity" values={`${s.twFrom};1;${s.twFrom}`} dur={`${s.tw}s`} repeatCount="indefinite" />
                  </circle>
                  <path d="M0,-8 L1.3,-1.3 L8,0 L1.3,1.3 L0,8 L-1.3,1.3 L-8,0 L-1.3,-1.3 Z" style={{ fill: s.color, opacity: Number(s.sparkle) }} />
                  {s.selected && (
                    <>
                      <circle r="13" style={{ fill: "none", stroke: moonAccent, strokeWidth: 1.4 }} />
                      <circle r="19" style={{ fill: "none", stroke: moonAccent, strokeWidth: 0.7, opacity: 0.5 }} />
                    </>
                  )}
                  <text x="0" y={s.labelY} textAnchor="middle" style={{ fontFamily: "var(--mono)", fontSize: 9, letterSpacing: ".05em", fill: moonAccent }}>
                    {s.label}
                  </text>
                </g>
              ))}
            </g>
          </svg>

          {/* moon intro */}
          <div style={{ position: "absolute", left: 14, top: 14, maxWidth: 230, zIndex: 4 }}>
            <div style={{ fontSize: 17, fontWeight: 500, letterSpacing: "-.01em" }}>{isA ? "Auditors" : "Users"}</div>
          </div>
        </>
      )}

      {/* ENTITY STAT CARD */}
      {hasSelection && sel && (
        <div
          className="no-bar"
          style={{
            position: "absolute",
            right: 12,
            top: 12,
            bottom: 12,
            width: 286,
            background: "var(--panel)",
            border: "1px solid var(--hair)",
            backdropFilter: "blur(10px)",
            borderRadius: 10,
            padding: 16,
            zIndex: 8,
            overflow: "auto",
          }}
        >
          <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between" }}>
            <div style={{ minWidth: 0, flex: 1 }}>
              <div style={{ fontSize: 9.5, fontWeight: 500, letterSpacing: ".1em", color: sel.accent, textTransform: "uppercase", whiteSpace: "nowrap" }}>
                {sel.kind}
              </div>
              <div style={{ fontSize: 16, fontWeight: 600, color: "var(--ink)", marginTop: 5, whiteSpace: "nowrap" }}>{sel.title}</div>
            </div>
            <button
              onClick={clearSel}
              style={{
                background: "none",
                border: "1px solid var(--hair)",
                color: "var(--ink-3)",
                width: 24,
                height: 24,
                cursor: "pointer",
                fontSize: 13,
                lineHeight: 1,
                flex: "none",
                borderRadius: 8,
              }}
            >
              ×
            </button>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 7, marginTop: 11 }}>
            <span style={{ fontFamily: "var(--mono)", fontSize: 9.5, color: sel.verified ? "var(--safe)" : "var(--ink-3)", border: `1px solid ${sel.verified ? "rgba(70,177,127,0.4)" : "var(--hair)"}`, padding: "3px 7px", whiteSpace: "nowrap", borderRadius: 6 }}>
              {sel.verified ? "✓ World ID" : "World ID · unverified"}
            </span>
            <span style={{ fontFamily: "var(--mono)", fontSize: 9.5, color: sel.statusColor, border: "1px solid var(--hair)", padding: "3px 7px", whiteSpace: "nowrap", borderRadius: 6 }}>
              {sel.status}
            </span>
          </div>
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "1fr 1fr 1fr",
              gap: 1,
              marginTop: 15,
              background: "var(--hair-soft)",
              border: "1px solid var(--hair-soft)",
              borderRadius: 8,
              overflow: "hidden",
            }}
          >
            {sel.tiles.map((t, i) => (
              <div key={i} style={{ background: "var(--inset)", padding: "11px 8px" }}>
                <div style={{ fontSize: 17, fontWeight: 600, color: "var(--ink)" }}>{t.value}</div>
                <div style={{ fontSize: 8.5, fontWeight: 500, letterSpacing: ".08em", color: "var(--ink-3)", textTransform: "uppercase", marginTop: 4, lineHeight: 1.3 }}>{t.label}</div>
              </div>
            ))}
          </div>
          <div style={{ marginTop: 15, display: "flex", flexDirection: "column", gap: 11 }}>
            {sel.bars.map((b, i) => (
              <div key={i}>
                <div style={{ display: "flex", justifyContent: "space-between", fontSize: 10, color: "var(--ink-2)", marginBottom: 5 }}>
                  <span style={{ fontWeight: 500, textTransform: "uppercase", letterSpacing: ".08em", color: "var(--ink-3)" }}>{b.label}</span>
                  <span style={{ color: "var(--ink)" }}>{b.value}</span>
                </div>
                <div style={{ height: 3, background: "var(--hair-soft)", position: "relative", borderRadius: 2, overflow: "hidden" }}>
                  <div style={{ position: "absolute", left: 0, top: 0, height: 3, width: b.pct, background: b.color }} />
                </div>
              </div>
            ))}
          </div>
          <div style={{ marginTop: 15, borderTop: "1px solid var(--hair-soft)", paddingTop: 13, display: "flex", flexDirection: "column", gap: 8 }}>
            {sel.rows.map((r, i) => (
              <div key={i} style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", fontSize: 11, gap: 12 }}>
                <span style={{ color: "var(--ink-3)", letterSpacing: ".04em", flex: "none" }}>{r.label}</span>
                <span style={{ fontFamily: "var(--mono)", color: "var(--ink-2)", textAlign: "right" }}>{r.value}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* MARS STATUS PANEL */}
      {marsOpen && isSystem && (
        <div
          style={{
            position: "absolute",
            right: 12,
            top: 12,
            bottom: 12,
            width: 316,
            background: "var(--panel)",
            border: "1px solid var(--hair)",
            backdropFilter: "blur(10px)",
            borderRadius: 10,
            padding: 16,
            zIndex: 8,
            display: "flex",
            flexDirection: "column",
          }}
        >
          <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", flex: "none" }}>
            <div>
              <div style={{ fontSize: 9.5, fontWeight: 500, letterSpacing: ".1em", color: "var(--mars)", textTransform: "uppercase" }}>Network Core</div>
              <div style={{ fontSize: 16, fontWeight: 600, marginTop: 4 }}>MARS · Live Status</div>
            </div>
            <button
              onClick={closeMars}
              style={{
                background: "none",
                border: "1px solid var(--hair)",
                color: "var(--ink-3)",
                width: 24,
                height: 24,
                cursor: "pointer",
                fontSize: 13,
                lineHeight: 1,
                flex: "none",
                borderRadius: 8,
              }}
            >
              ×
            </button>
          </div>
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "1fr 1fr",
              gap: 1,
              marginTop: 14,
              background: "var(--hair-soft)",
              border: "1px solid var(--hair-soft)",
              borderRadius: 8,
              overflow: "hidden",
              flex: "none",
            }}
          >
            {marsStats.map((m, i) => (
              <div key={i} style={{ background: "var(--inset)", padding: "11px 12px" }}>
                <div style={{ fontSize: 17, fontWeight: 600, color: m.color }}>{m.value}</div>
                <div style={{ fontSize: 8.5, fontWeight: 500, letterSpacing: ".08em", color: "var(--ink-3)", textTransform: "uppercase", marginTop: 4 }}>{m.label}</div>
              </div>
            ))}
          </div>
          <div style={{ marginTop: 15, display: "flex", alignItems: "center", justifyContent: "space-between", flex: "none" }}>
            <span style={{ fontSize: 9.5, fontWeight: 500, letterSpacing: ".1em", color: "var(--ink-3)", textTransform: "uppercase" }}>Audit Trail</span>
            <span style={{ fontFamily: "var(--mono)", fontSize: 9, color: "var(--ink-3)" }}>seq {seq}</span>
          </div>
          <div style={{ marginTop: 7, borderTop: "1px solid var(--hair-soft)", paddingTop: 7, flex: 1, minHeight: 0, overflow: "hidden" }}>
            {trail.map((ev) => (
              <div key={ev.id} style={{ display: "flex", gap: 8, alignItems: "baseline", padding: "2.5px 0", fontFamily: "var(--mono)", fontSize: 10, lineHeight: 1.4 }}>
                <span style={{ color: "var(--ink-3)", flex: "none" }}>{ev.time}</span>
                <span style={{ width: 6, height: 6, border: "1px solid", borderRadius: 1, flex: "none", transform: "translateY(1px)", borderColor: ev.color }} />
                <span style={{ color: "var(--ink-2)" }}>{ev.text}</span>
              </div>
            ))}
          </div>
        </div>
      )}
      </div>
    </div>
      {open && (
        <Popout title="Network Explorer" meta="hover to pause · click a dot or a moon" onClose={() => setOpen(false)}>
          <ExplorerExpanded />
        </Popout>
      )}
    </>
  );
}
