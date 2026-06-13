import { useState } from "react";
import { AUDITORS, AUDITS, SKILLS, USERS } from "./marsData";
import { AuditDetail, AuditorDetail, Eyebrow, UserDetail } from "./MarsUI";

// Expanded Network Explorer — a live system map.
//  · hover the map → everything pauses, audit dots get labelled & clickable
//  · click an audit dot → its live audit trail on the right
//  · click Phobos → the auditor swarm · click Deimos → the user base

type Mode = "network" | "auditors" | "users";

const ONGOING = AUDITS.filter((a) => a.state === "ongoing");
// The audit dots travel one continuous loop: Mars → Phobos → Deimos → Mars.
const LOOP = "M300,300 L680,150 L720,450 Z";

function ListRow({ left, right, onClick }: { left: React.ReactNode; right?: React.ReactNode; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      style={{ textAlign: "left", cursor: "pointer", border: "1px solid var(--hair-soft)", background: "transparent", borderRadius: 8, padding: "9px 11px", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10 }}
    >
      <span style={{ fontSize: 12, color: "var(--ink)" }}>{left}</span>
      <span style={{ fontSize: 10.5, color: "var(--ink-3)" }}>{right}</span>
    </button>
  );
}

export default function ExplorerExpanded() {
  const [mode, setMode] = useState<Mode>("network");
  const [auditId, setAuditId] = useState<string | null>(null);
  const [auditorId, setAuditorId] = useState<string | null>(null);
  const [userId, setUserId] = useState<string | null>(null);
  const [paused, setPaused] = useState(false);

  const reset = (m: Mode) => {
    setMode(m);
    setAuditId(null);
    setAuditorId(null);
    setUserId(null);
  };

  const selAudit = auditId ? AUDITS.find((a) => a.id === auditId) ?? null : null;
  const selAuditor = auditorId ? AUDITORS.find((a) => a.id === auditorId) ?? null : null;
  const selUser = userId ? USERS.find((u) => u.id === userId) ?? null : null;
  const hasSel = !!(selAudit || selAuditor || selUser);
  const showBack = hasSel || mode !== "network";

  const back = () => {
    if (hasSel) {
      setAuditId(null);
      setAuditorId(null);
      setUserId(null);
    } else {
      setMode("network");
    }
  };

  return (
    <div style={{ display: "flex", height: "100%" }}>
      {/* ── map ── */}
      <div
        onMouseEnter={() => setPaused(true)}
        onMouseLeave={() => setPaused(false)}
        style={{ flex: 1, minWidth: 0, position: "relative", background: "radial-gradient(120% 90% at 30% 20%, #ffffff 0%, var(--space) 70%)" }}
      >
        <div style={{ position: "absolute", top: 16, left: 18, zIndex: 2, pointerEvents: "none" }}>
          <Eyebrow>Network map</Eyebrow>
          <div style={{ fontSize: 11, color: "var(--ink-3)", marginTop: 4 }}>
            {paused ? "paused · click a dot or a moon" : "hover to pause · dots are live audits"}
          </div>
        </div>

        <svg viewBox="0 0 900 560" preserveAspectRatio="xMidYMid meet" className={paused ? "map-paused" : ""} style={{ position: "absolute", inset: 0, width: "100%", height: "100%" }}>
          <defs>
            <radialGradient id="exMarsGlow" cx="50%" cy="50%" r="50%">
              <stop offset="86%" stopColor="rgba(194,84,42,0)" />
              <stop offset="100%" stopColor="rgba(194,84,42,0.14)" />
            </radialGradient>
          </defs>

          {/* orbit rings */}
          <g transform="rotate(-10 300 300)" style={{ fill: "none", stroke: "var(--hair)", strokeWidth: 1, strokeDasharray: "2 8" }}>
            <ellipse cx="300" cy="300" rx="330" ry="180" />
            <ellipse cx="300" cy="300" rx="450" ry="250" />
          </g>

          {/* connection lines */}
          <g style={{ fill: "none", strokeWidth: 1.1, strokeDasharray: "2 7" }}>
            <path d="M300,300 L680,150" style={{ stroke: "var(--comm)", opacity: 0.4 }} />
            <path d="M300,300 L720,450" style={{ stroke: "#e8a15c", opacity: 0.4 }} />
            <path d="M680,150 L720,450" style={{ stroke: "var(--safe)", opacity: 0.3 }} />
          </g>

          {/* Mars core */}
          <g style={{ cursor: "pointer" }} onClick={() => reset("network")}>
            <circle cx="300" cy="300" r="162" fill="url(#exMarsGlow)" />
            <image href="/mars.svg" x="150" y="150" width="300" height="300" preserveAspectRatio="xMidYMid meet" />
            <text x="300" y="502" textAnchor="middle" style={{ fontSize: 13, fontWeight: 600, letterSpacing: ".18em", fill: "var(--mars)" }}>
              MARS
            </text>
            <text x="300" y="518" textAnchor="middle" style={{ marginTop: "2px", fontSize: 9.5, letterSpacing: ".14em", fill: "var(--ink-3)" }}>
              NETWORK CORE
            </text>
          </g>

          {/* Phobos · auditors */}
          <g style={{ cursor: "pointer", animation: "float1 9s ease-in-out infinite" }} onClick={() => reset("auditors")}>
            <circle cx="680" cy="150" r="64" fill="transparent" />
            <image href="/phobos.svg" x="624" y="94" width="112" height="112" preserveAspectRatio="xMidYMid meet" />
            <text x="680" y="220" textAnchor="middle" style={{ fontSize: 13, fontWeight: 600, letterSpacing: ".18em", fill: "var(--comm)" }}>
              PHOBOS
            </text>
            <text x="680" y="236" textAnchor="middle" style={{ fontSize: 9.5, letterSpacing: ".14em", fill: "var(--ink-3)" }}>
              AUDITORS
            </text>
          </g>

          {/* Deimos · users */}
          <g style={{ cursor: "pointer", animation: "float2 11s ease-in-out infinite" }} onClick={() => reset("users")}>
            <circle cx="720" cy="450" r="50" fill="transparent" />
            <image href="/deimos.svg" x="678" y="408" width="84" height="84" preserveAspectRatio="xMidYMid meet" />
            <text x="720" y="516" textAnchor="middle" style={{ fontSize: 13, fontWeight: 600, letterSpacing: ".18em", fill: "#e8a15c" }}>
              DEIMOS
            </text>
            <text x="720" y="532" textAnchor="middle" style={{ fontSize: 9.5, letterSpacing: ".14em", fill: "var(--ink-3)" }}>
              USERS
            </text>
          </g>

          {/* live-audit dots — each travels along a connection line via CSS
              motion-path, so they sit ON the line and freeze on hover (the
              .map-paused rule pauses the CSS animation). */}
          {ONGOING.map((a, i) => {
            const active = a.id === auditId;
            // same duration, evenly-spaced start offsets → dots distributed
            // around the loop, all flowing Mars → Phobos → Deimos → Mars.
            const dur = 16;
            const delay = -((i * dur) / ONGOING.length);
            return (
              <g
                key={a.id}
                onClick={() => {
                  reset("network");
                  setAuditId(a.id);
                }}
                style={{
                  cursor: "pointer",
                  offsetPath: `path('${LOOP}')`,
                  offsetRotate: "0deg",
                  animation: `exMove ${dur}s linear ${delay}s infinite`,
                }}
              >
                <circle r="12" fill="transparent" />
                {active && <circle r="11" fill="none" style={{ stroke: "var(--warn)", strokeWidth: 1.2, opacity: 0.6 }} />}
                <circle r={active ? 7 : 5} style={{ fill: "var(--warn)" }} />
                <text x="0" y="-13" textAnchor="middle" style={{ fontSize: 9.5, fontFamily: "var(--code)", fill: "var(--ink-2)", opacity: paused || active ? 1 : 0, transition: "opacity .15s" }}>
                  {a.id}
                </text>
              </g>
            );
          })}
        </svg>
      </div>

      {/* ── side panel ── */}
      <div className="no-bar" style={{ width: 380, flex: "none", borderLeft: "1px solid var(--hair)", overflow: "auto", padding: 22, display: "flex", flexDirection: "column" }}>
        {showBack && (
          <button
            onClick={back}
            style={{ alignSelf: "flex-start", marginBottom: 16, display: "flex", alignItems: "center", gap: 6, background: "none", border: "1px solid var(--hair)", color: "var(--ink-2)", fontSize: 11, padding: "5px 10px", cursor: "pointer", borderRadius: 8 }}
          >
            ← back
          </button>
        )}

        {selAudit ? (
          <AuditDetail a={selAudit} />
        ) : selAuditor ? (
          <AuditorDetail a={selAuditor} />
        ) : selUser ? (
          <UserDetail u={selUser} />
        ) : mode === "auditors" ? (
          <div>
            <Eyebrow color="var(--comm)">Auditor swarm · {AUDITORS.length}</Eyebrow>
            <div style={{ fontSize: 11, color: "var(--ink-3)", margin: "6px 0 14px" }}>World-ID-verified auditors staked on MARS.</div>
            <div style={{ display: "flex", flexDirection: "column", gap: 7 }}>
              {AUDITORS.map((a) => (
                <ListRow key={a.id} left={a.id} right={`${a.spec} · ${a.status}`} onClick={() => setAuditorId(a.id)} />
              ))}
            </div>
          </div>
        ) : mode === "users" ? (
          <div>
            <Eyebrow color="var(--warn)">User base · {USERS.length}</Eyebrow>
            <div style={{ fontSize: 11, color: "var(--ink-3)", margin: "6px 0 14px" }}>Agents licensing verified skills.</div>
            <div style={{ display: "flex", flexDirection: "column", gap: 7 }}>
              {USERS.map((u) => (
                <ListRow key={u.id} left={u.id} right={`${u.skills} licensed${u.active ? " · live" : ""}`} onClick={() => setUserId(u.id)} />
              ))}
            </div>
          </div>
        ) : (
          <NetworkSummary onAudit={(id) => setAuditId(id)} />
        )}
      </div>
    </div>
  );
}

function NetworkSummary({ onAudit }: { onAudit: (id: string) => void }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
      <div>
        <Eyebrow color="var(--mars)">Live network</Eyebrow>
        <div style={{ fontSize: 20, fontWeight: 600, marginTop: 4 }}>MARS system</div>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 1, background: "var(--hair-soft)", border: "1px solid var(--hair-soft)", borderRadius: 8, overflow: "hidden" }}>
        {[
          { v: ONGOING.length, l: "audits in flight", c: "var(--warn)" },
          { v: SKILLS.filter((s) => s.verdict === "SAFE").length, l: "skills verified", c: "var(--safe)" },
          { v: AUDITORS.length, l: "auditors", c: "var(--comm)" },
          { v: USERS.length, l: "users", c: "#e8a15c" },
        ].map((t, i) => (
          <div key={i} style={{ background: "var(--inset)", padding: "13px 14px" }}>
            <div style={{ fontSize: 22, fontWeight: 600, color: t.c }}>{t.v}</div>
            <div style={{ fontSize: 8.5, fontWeight: 500, letterSpacing: ".08em", color: "var(--ink-3)", textTransform: "uppercase", marginTop: 5 }}>{t.l}</div>
          </div>
        ))}
      </div>
      <div>
        <Eyebrow>In flight</Eyebrow>
        <div style={{ display: "flex", flexDirection: "column", gap: 7, marginTop: 10 }}>
          {ONGOING.map((a) => (
            <ListRow key={a.id} left={a.id} right={a.skill} onClick={() => onAudit(a.id)} />
          ))}
        </div>
      </div>
      <div style={{ fontSize: 11, color: "var(--ink-3)", lineHeight: 1.6, borderTop: "1px solid var(--hair-soft)", paddingTop: 14 }}>
        Hover the map to pause the animation, then click a glowing dot to open its live audit trail — or click <span style={{ color: "var(--comm)" }}>Phobos</span> /{" "}
        <span style={{ color: "#e8a15c" }}>Deimos</span> for the auditors and users.
      </div>
    </div>
  );
}
