import { useEffect, useState } from "react";
import Popout from "./Popout";
import AgentRegister from "./AgentRegister";

// ── Cell E · Connect Agent ───────────────────────────────────────────────
// Agents register / log in by curling the API. The cell hands out the commands.
//   Register → User (audit & license skills from OpenClaw / Hermes / any agent)
//            → Auditor (run the audit pipeline; prerequisites apply)
//   Connect  → CLI login that loads the agent's saved profile from the DB.

type Mode = "home" | "register" | "connect";

function Cmd({ cmd }: { cmd: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <div style={{ border: "1px solid var(--hair)", borderRadius: 8, background: "var(--inset)", overflow: "hidden" }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "5px 9px", borderBottom: "1px solid var(--hair-soft)" }}>
        <span style={{ fontSize: 8, fontWeight: 500, letterSpacing: ".12em", color: "var(--ink-3)", textTransform: "uppercase" }}>shell</span>
        <button
          onClick={() => {
            try {
              navigator.clipboard?.writeText(cmd);
            } catch {
              /* clipboard unavailable */
            }
            setCopied(true);
            setTimeout(() => setCopied(false), 1200);
          }}
          style={{ background: "none", border: "none", cursor: "pointer", fontSize: 9, color: copied ? "var(--safe)" : "var(--ink-3)" }}
        >
          {copied ? "copied ✓" : "copy"}
        </button>
      </div>
      <pre style={{ margin: 0, padding: "8px 9px", fontFamily: "var(--code)", fontSize: 9.5, lineHeight: 1.5, color: "var(--ink-2)", whiteSpace: "pre-wrap", wordBreak: "break-all" }}>{cmd}</pre>
    </div>
  );
}

function BackBtn({ onClick }: { onClick: () => void }) {
  return (
    <button onClick={onClick} style={{ alignSelf: "flex-start", display: "flex", alignItems: "center", gap: 6, background: "none", border: "1px solid var(--hair)", color: "var(--ink-2)", fontSize: 10, padding: "3px 8px", cursor: "pointer", borderRadius: 6 }}>
      ← back
    </button>
  );
}

const AUDITOR_PREREQS = ["World-ID verified", "can run the audit pipeline (OpenAI key)", "bond staked (slashed on a wrong verdict)", "sandbox/fork runtime for deeper tiers"];

export default function ConnectAgent() {
  const [mode, setMode] = useState<Mode>("home");
  const [reg, setReg] = useState<"user" | "auditor" | null>(null);
  const [base, setBase] = useState("https://mars.derek2403.win");
  useEffect(() => {
    if (typeof window !== "undefined") setBase(window.location.origin);
  }, []);

  // Streaming curl: creates the account, prints the World-ID verify QR in your
  // terminal, polls AgentBook, then finishes (voting/review/profile/registry).
  // `-N` keeps it unbuffered so the QR shows while it waits for your scan.
  const userCmd = `curl -N "${base}/api/register-cli?role=user"`;
  const auditorCmd = `curl -N "${base}/api/register-cli?role=auditor"`;
  const loginCmd = `curl -sSL "${base}/api/login?agent=$MARS_AGENT_ID"`;

  return (
    <>
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
        {mode !== "home" && <span style={{ fontSize: 9.5, letterSpacing: ".1em", textTransform: "uppercase", color: "var(--ink-3)" }}>{mode}</span>}
      </div>

      <div className="no-bar" style={{ flex: 1, minHeight: 0, padding: 16, overflow: "auto", display: "flex", flexDirection: "column" }}>
        {mode === "home" && (
          <div style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 14 }}>
            <div style={{ fontSize: 12.5, color: "var(--ink-2)", textAlign: "center", maxWidth: 360, lineHeight: 1.5 }}>
              Onboard your agent to MARS — register a new identity, or log back into an existing one.
            </div>
            <div style={{ display: "flex", gap: 12 }}>
              <button
                onClick={() => setMode("register")}
                style={{ background: "var(--mars)", border: "none", color: "#fff", fontFamily: "var(--sans)", fontSize: 12, fontWeight: 500, padding: "9px 22px", cursor: "pointer", borderRadius: 8 }}
              >
                Register →
              </button>
              <button
                onClick={() => setMode("connect")}
                style={{ background: "none", border: "1px solid var(--hair)", color: "var(--ink-2)", fontFamily: "var(--sans)", fontSize: 12, fontWeight: 500, padding: "9px 22px", cursor: "pointer", borderRadius: 8 }}
              >
                Connect
              </button>
            </div>
          </div>
        )}

        {mode === "register" && (
          <div style={{ display: "flex", flexDirection: "column", gap: 12, height: "100%" }}>
            <BackBtn onClick={() => setMode("home")} />
            <div style={{ display: "flex", gap: 12, flex: 1, minHeight: 0 }}>
              {/* USER */}
              <div style={{ flex: 1, minWidth: 0, border: "1px solid var(--hair-soft)", borderRadius: 8, padding: 12, display: "flex", flexDirection: "column", gap: 9 }}>
                <div style={{ fontSize: 11, fontWeight: 600, letterSpacing: ".1em", textTransform: "uppercase", color: "var(--warn)" }}>Register as User</div>
                <div style={{ fontSize: 10.5, color: "var(--ink-3)", lineHeight: 1.5 }}>
                  Onboard your agent (OpenClaw, Hermes, any MCP agent) to <span style={{ color: "var(--ink-2)" }}>audit & license skills</span>. Run it — scan the World-ID QR in your terminal.
                </div>
                <Cmd cmd={userCmd} />
                <button onClick={() => setReg("user")} style={{ background: "none", border: "1px solid var(--mars-soft)", color: "var(--mars)", fontSize: 10.5, fontWeight: 500, padding: "6px 10px", cursor: "pointer", borderRadius: 6 }}>
                  …or register in-browser →
                </button>
                <div style={{ fontSize: 9.5, color: "var(--ink-3)", lineHeight: 1.5 }}>then audit: <span style={{ fontFamily: "var(--code)", color: "var(--ink-2)" }}>/api/audit?skill=…&amp;agent=$MARS_AGENT_ID</span></div>
              </div>
              {/* AUDITOR */}
              <div style={{ flex: 1, minWidth: 0, border: "1px solid var(--hair-soft)", borderRadius: 8, padding: 12, display: "flex", flexDirection: "column", gap: 9 }}>
                <div style={{ fontSize: 11, fontWeight: 600, letterSpacing: ".1em", textTransform: "uppercase", color: "var(--comm)" }}>Register as Auditor</div>
                <div style={{ fontSize: 10.5, color: "var(--ink-3)", lineHeight: 1.5 }}>Run the audit pipeline and earn. Prerequisites:</div>
                <ul style={{ margin: 0, paddingLeft: 14, display: "flex", flexDirection: "column", gap: 2 }}>
                  {AUDITOR_PREREQS.map((p) => (
                    <li key={p} style={{ fontSize: 9.5, color: "var(--ink-3)", lineHeight: 1.4 }}>{p}</li>
                  ))}
                </ul>
                <Cmd cmd={auditorCmd} />
                <button onClick={() => setReg("auditor")} style={{ background: "none", border: "1px solid var(--mars-soft)", color: "var(--mars)", fontSize: 10.5, fontWeight: 500, padding: "6px 10px", cursor: "pointer", borderRadius: 6 }}>
                  …or register in-browser →
                </button>
              </div>
            </div>
            <div style={{ fontSize: 9.5, color: "var(--ink-3)" }}>Prints <span style={{ fontFamily: "var(--code)", color: "var(--ink-2)" }}>account · voting · review · profile</span> topics — set <span style={{ fontFamily: "var(--code)", color: "var(--ink-2)" }}>MARS_AGENT_ID</span> to the account id. Or register in-browser ↓</div>
          </div>
        )}

        {mode === "connect" && (
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            <BackBtn onClick={() => setMode("home")} />
            <div style={{ fontSize: 12, color: "var(--ink-2)", lineHeight: 1.5 }}>Log back in — loads your saved profile, rating, and topic ids from the registry:</div>
            <Cmd cmd={loginCmd} />
            <div style={{ fontSize: 10, color: "var(--ink-3)", lineHeight: 1.5 }}>
              Set <span style={{ fontFamily: "var(--code)", color: "var(--ink-2)" }}>$MARS_AGENT_ID</span> from your registration (or pass the id directly). Returns your role, review/voting/profile topics, and World-ID status.
            </div>
          </div>
        )}
      </div>
    </div>
      {reg && (
        <Popout title="Register agent" meta="scan World ID · Hedera onboarding" onClose={() => setReg(null)}>
          <AgentRegister role={reg} />
        </Popout>
      )}
    </>
  );
}
