import { useEffect, useState } from "react";
import Popout from "./Popout";
import AgentRegister from "./AgentRegister";
import { useMars } from "./marsState";

// ── Cell E · Connect Agent ───────────────────────────────────────────────
// A real session: the cell shows the agent that is LOGGED IN this session, not
// the newest row in the DB.
//   Register → pick user/auditor → run the printed `register-cli` curl (creates the
//              account) → log in with that new agent id (curl or in-browser auto-login)
//   Connect  → log in with an existing agent id → /api/login loads its saved profile
// Once logged in, the agent's card is shown with a Disconnect button. The session
// (the agent id) is persisted in localStorage so a reload keeps you logged in.

type Mode = "home" | "register" | "connect";

interface ConnectedAgent {
  id: string;
  role: "user" | "auditor";
  verified: boolean;
  evm: string | null;
  humanId: string | null;
  votingTopic: string | null;
  reviewTopic: string | null;
  profileTopic: string | null;
  accountMemo: string | null;
  registrySeq: string | number | null;
  rating: number;
  registeredAt: string | null;
}

const SESSION_KEY = "mars_session_agent";
const hashscanAccount = (id: string) => `https://hashscan.io/testnet/account/${id}`;
const hashscanTopic = (id: string) => `https://hashscan.io/testnet/topic/${id}`;
const short = (s: string | null, head = 10, tail = 6) =>
  s && s.length > head + tail + 1 ? `${s.slice(0, head)}…${s.slice(-tail)}` : s || "—";

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
function fmtDate(iso: string | null) {
  if (!iso) return "—";
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso);
  return m ? `${MONTHS[+m[2] - 1]} ${+m[3]}, ${m[1]}` : iso.slice(0, 10);
}

// Build the session agent from the /api/login response (db record).
function fromLogin(rec: Record<string, unknown>): ConnectedAgent {
  const s = (v: unknown) => (v == null ? null : String(v));
  return {
    id: String(rec.agent_id ?? ""),
    role: rec.role === "auditor" ? "auditor" : "user",
    verified: !!rec.world_verified,
    evm: s(rec.evm_address),
    humanId: s(rec.human_id),
    votingTopic: s(rec.voting_topic),
    reviewTopic: s(rec.review_topic),
    profileTopic: s(rec.profile_topic),
    accountMemo: s(rec.account_memo),
    registrySeq: (rec.registry_seq as string | number | null) ?? null,
    rating: parseFloat(String(rec.rating ?? "0")) || 0,
    registeredAt: s(rec.registered_at),
  };
}

// A topic tile that links to its own HashScan topic page (voting / review / profile).
function TopicTile({ label, id }: { label: string; id: string | null }) {
  const inner = (
    <>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <span style={{ fontSize: 7.5, fontWeight: 600, letterSpacing: ".1em", textTransform: "uppercase", color: "var(--ink-3)" }}>{label}</span>
        {id && <span style={{ fontSize: 9, color: "var(--mars)" }}>↗</span>}
      </div>
      <div style={{ fontFamily: "var(--code)", fontSize: 10.5, color: "var(--ink)", marginTop: 2, overflow: "hidden", whiteSpace: "nowrap", textOverflow: "ellipsis" }}>{id ?? "—"}</div>
    </>
  );
  const style = { display: "block", background: "var(--inset)", borderRadius: 8, padding: "6px 9px", minWidth: 0, textDecoration: "none" as const };
  return id ? (
    <a href={hashscanTopic(id)} target="_blank" rel="noopener noreferrer" title={`Open topic ${id} on HashScan ↗`} className="ca-agent-card" style={style}>
      {inner}
    </a>
  ) : (
    <div style={style}>{inner}</div>
  );
}

// One connected agent — each id/topic is its OWN HashScan link (no outer <a>).
function AgentCard({ a }: { a: ConnectedAgent }) {
  const isAuditor = a.role === "auditor";
  const roleColor = isAuditor ? "var(--comm)" : "var(--warn)";
  const roleTint = isAuditor ? "rgba(47,111,208,0.1)" : "rgba(185,120,15,0.12)";
  const idLink = { fontFamily: "var(--code)", textDecoration: "none" as const };
  return (
    <div style={{ display: "block", padding: "11px 4px" }}>
      {/* header: status · id(link) · role · verified · rating · explorer(link) */}
      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
        <span style={{ width: 7, height: 7, borderRadius: "50%", flex: "none", background: a.verified ? "var(--safe)" : "var(--ink-3)" }} />
        <a href={hashscanAccount(a.id)} target="_blank" rel="noopener noreferrer" title={`Open ${a.id} on HashScan ↗`} style={{ ...idLink, fontSize: 12.5, fontWeight: 600, color: "var(--ink)", minWidth: 0, overflow: "hidden", whiteSpace: "nowrap", textOverflow: "ellipsis" }}>{a.id}</a>
        <span style={{ fontSize: 8.5, fontWeight: 600, color: roleColor, background: roleTint, padding: "2px 7px", borderRadius: 999, textTransform: "uppercase", letterSpacing: ".07em", flex: "none" }}>{a.role}</span>
        {a.verified && <span title={a.humanId ?? "World ID verified"} style={{ fontSize: 8.5, fontWeight: 600, color: "var(--safe)", background: "rgba(31,157,99,0.1)", padding: "2px 7px", borderRadius: 999, letterSpacing: ".04em", flex: "none" }}>✓ World</span>}
        <span style={{ flex: 1 }} />
        <span style={{ fontSize: 10.5, fontWeight: 600, color: "var(--ink-2)", flex: "none" }}>★ {a.rating.toFixed(1)}</span>
        <a href={hashscanAccount(a.id)} target="_blank" rel="noopener noreferrer" style={{ fontSize: 9.5, fontWeight: 500, color: "var(--mars)", flex: "none", textDecoration: "none" }}>explorer ↗</a>
      </div>

      {/* evm — links to the account (HashScan resolves evm) */}
      <a href={a.evm ? hashscanAccount(a.evm) : undefined} target="_blank" rel="noopener noreferrer" title={a.evm ?? undefined} style={{ display: "block", fontFamily: "var(--code)", fontSize: 10, color: "var(--ink-3)", marginTop: 3, marginLeft: 15, overflow: "hidden", whiteSpace: "nowrap", textOverflow: "ellipsis", textDecoration: "none" }}>{short(a.evm)}</a>

      {/* topic tiles — each its own HashScan topic link */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 6, marginTop: 10 }}>
        <TopicTile label="voting" id={a.votingTopic} />
        <TopicTile label="review" id={a.reviewTopic} />
        <TopicTile label="profile" id={a.profileTopic} />
      </div>

      {/* meta footer */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, marginTop: 9 }}>
        <span title={a.accountMemo ?? undefined} style={{ fontFamily: "var(--code)", fontSize: 9.5, color: "var(--ink-3)", minWidth: 0, overflow: "hidden", whiteSpace: "nowrap", textOverflow: "ellipsis" }}>{a.accountMemo ?? "—"}</span>
        <span style={{ fontSize: 9.5, color: "var(--ink-3)", flex: "none", whiteSpace: "nowrap" }}>registry #{a.registrySeq ?? "—"} · {fmtDate(a.registeredAt)}</span>
      </div>
    </div>
  );
}

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

// The login input — enter an agent id, hit Log in → /api/login → set the session.
function LoginBox({ label, value, onChange, onSubmit, loading, error }: { label: string; value: string; onChange: (v: string) => void; onSubmit: () => void; loading: boolean; error: string | null }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 7 }}>
      <div style={{ fontSize: 10.5, color: "var(--ink-2)", lineHeight: 1.5 }}>{label}</div>
      <div style={{ display: "flex", gap: 7 }}>
        <input
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && value.trim() && onSubmit()}
          placeholder="0.0.xxxxxxx  (your MARS_AGENT_ID)"
          style={{ flex: 1, minWidth: 0, background: "var(--inset)", border: "1px solid var(--hair)", borderRadius: 7, padding: "7px 10px", outline: "none", color: "var(--ink)", fontFamily: "var(--code)", fontSize: 11.5 }}
        />
        <button
          onClick={onSubmit}
          disabled={loading || !value.trim()}
          style={{ flex: "none", background: "var(--mars)", border: "none", color: "#fff", fontSize: 11, fontWeight: 500, padding: "7px 16px", cursor: loading || !value.trim() ? "default" : "pointer", borderRadius: 7, opacity: loading || !value.trim() ? 0.5 : 1 }}
        >
          {loading ? "logging in…" : "Log in"}
        </button>
      </div>
      {error && <div style={{ fontSize: 10, color: "var(--danger)" }}>{error}</div>}
    </div>
  );
}

const AUDITOR_PREREQS = ["World-ID verified", "can run the audit pipeline (OpenAI key)", "bond staked (slashed on a wrong verdict)", "sandbox/fork runtime for deeper tiers"];

export default function ConnectAgent() {
  const { state } = useMars();
  const [mode, setMode] = useState<Mode>("home");
  const [reg, setReg] = useState<"user" | "auditor" | null>(null);
  const [base, setBase] = useState("https://mars.derek2403.win");
  const [session, setSession] = useState<ConnectedAgent | null>(null);
  const [agentInput, setAgentInput] = useState("");
  const [loggingIn, setLoggingIn] = useState(false);
  const [loginErr, setLoginErr] = useState<string | null>(null);

  useEffect(() => {
    if (typeof window !== "undefined") setBase(window.location.origin);
  }, []);

  // restore the session on load (re-fetch the profile so it reflects latest rating)
  useEffect(() => {
    const saved = typeof window !== "undefined" ? localStorage.getItem(SESSION_KEY) : null;
    if (!saved) return;
    fetch(`/api/login?agent=${encodeURIComponent(saved)}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => d?.ok && setSession(fromLogin(d)))
      .catch(() => {});
  }, []);

  // Run the login endpoint for an explicit agent id → set the session (the logged-in
  // agent). Used by both Connect (existing id) and Register (the new id).
  const login = async (id: string) => {
    const aid = id.trim();
    if (!aid) return;
    setLoggingIn(true);
    setLoginErr(null);
    try {
      const r = await fetch(`/api/login?agent=${encodeURIComponent(aid)}`);
      const d = await r.json();
      if (!r.ok || !d.ok) throw new Error(d.error || "login failed");
      setSession(fromLogin(d));
      if (typeof window !== "undefined") localStorage.setItem(SESSION_KEY, d.agent_id);
      setMode("home");
      setAgentInput("");
      setReg(null);
    } catch (e) {
      setLoginErr(e instanceof Error ? e.message : "login failed");
    } finally {
      setLoggingIn(false);
    }
  };

  const disconnect = () => {
    setSession(null);
    setAgentInput("");
    setLoginErr(null);
    if (typeof window !== "undefined") localStorage.removeItem(SESSION_KEY);
    setMode("home");
  };

  const connected = state.users.length + state.auditors.length;

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
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            {mode !== "home" && <span style={{ fontSize: 9.5, letterSpacing: ".1em", textTransform: "uppercase", color: "var(--ink-3)" }}>{mode}</span>}
            <span style={{ display: "flex", alignItems: "center", gap: 5, fontSize: 10, color: session ? "var(--safe)" : "var(--ink-3)" }}>
              <span style={{ width: 6, height: 6, borderRadius: "50%", background: session ? "var(--safe)" : "var(--ink-3)" }} />
              {session ? "logged in" : `${connected} on network`}
            </span>
          </div>
        </div>

        <div className="no-bar" style={{ flex: 1, minHeight: 0, padding: 16, overflow: "auto", display: "flex", flexDirection: "column" }}>
          {/* HOME · not logged in → onboarding choice */}
          {mode === "home" && !session && (
            <div style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 14 }}>
              <div style={{ fontSize: 12.5, color: "var(--ink-2)", textAlign: "center", maxWidth: 360, lineHeight: 1.5 }}>
                Onboard your agent to MARS — register a new identity, or log back into an existing one.
              </div>
              <div style={{ display: "flex", gap: 12 }}>
                <button onClick={() => setMode("register")} style={{ background: "var(--mars)", border: "none", color: "#fff", fontFamily: "var(--sans)", fontSize: 12, fontWeight: 500, padding: "9px 22px", cursor: "pointer", borderRadius: 8 }}>
                  Register →
                </button>
                <button onClick={() => setMode("connect")} style={{ background: "none", border: "1px solid var(--hair)", color: "var(--ink-2)", fontFamily: "var(--sans)", fontSize: 12, fontWeight: 500, padding: "9px 22px", cursor: "pointer", borderRadius: 8 }}>
                  Connect
                </button>
              </div>
            </div>
          )}

          {/* HOME · logged in → the session agent + Disconnect */}
          {mode === "home" && session && (
            <div style={{ flex: 1, minHeight: 0, display: "flex", flexDirection: "column", gap: 10 }}>
              <div style={{ flex: "none", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                <span style={{ fontSize: 9.5, fontWeight: 500, letterSpacing: ".1em", color: "var(--ink-3)", textTransform: "uppercase" }}>Logged-in agent</span>
                <span style={{ fontSize: 9.5, color: "var(--ink-3)" }}>tap a topic → HashScan ↗</span>
              </div>
              <div className="no-bar" style={{ flex: 1, minHeight: 0, overflow: "auto", display: "flex", flexDirection: "column" }}>
                <AgentCard a={session} />
              </div>
              <div style={{ flex: "none", display: "flex", alignItems: "center", gap: 8 }}>
                <button onClick={disconnect} style={{ background: "none", border: "1px solid var(--hair)", color: "var(--ink-2)", fontSize: 10.5, fontWeight: 500, padding: "6px 14px", cursor: "pointer", borderRadius: 7 }}>
                  Disconnect
                </button>
              </div>
            </div>
          )}

          {/* REGISTER · create the account (curl) then log in with the new id */}
          {mode === "register" && (
            <div style={{ display: "flex", flexDirection: "column", gap: 12, height: "100%" }}>
              <BackBtn onClick={() => setMode("home")} />
              <div style={{ display: "flex", gap: 12, flex: "none" }}>
                {/* USER */}
                <div style={{ flex: 1, minWidth: 0, border: "1px solid var(--hair-soft)", borderRadius: 8, padding: 12, display: "flex", flexDirection: "column", gap: 9 }}>
                  <div style={{ fontSize: 11, fontWeight: 600, letterSpacing: ".1em", textTransform: "uppercase", color: "var(--warn)" }}>Register as User</div>
                  <div style={{ fontSize: 10.5, color: "var(--ink-3)", lineHeight: 1.5 }}>
                    Onboard your agent to <span style={{ color: "var(--ink-2)" }}>audit & license skills</span>. Run it — scan the World-ID QR in your terminal.
                  </div>
                  <Cmd cmd={userCmd} />
                  <button onClick={() => setReg("user")} style={{ background: "none", border: "1px solid var(--mars-soft)", color: "var(--mars)", fontSize: 10.5, fontWeight: 500, padding: "6px 10px", cursor: "pointer", borderRadius: 6 }}>
                    …or register in-browser →
                  </button>
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
              {/* once the curl created the account, log in with its printed id */}
              <div style={{ borderTop: "1px solid var(--hair-soft)", paddingTop: 12 }}>
                <LoginBox
                  label="Created your account? The curl prints MARS_AGENT_ID — log in with it:"
                  value={agentInput}
                  onChange={setAgentInput}
                  onSubmit={() => login(agentInput)}
                  loading={loggingIn}
                  error={loginErr}
                />
              </div>
            </div>
          )}

          {/* CONNECT · log in with an existing agent id */}
          {mode === "connect" && (
            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              <BackBtn onClick={() => setMode("home")} />
              <LoginBox
                label="Log in with your agent id — loads your saved profile, rating, and topics:"
                value={agentInput}
                onChange={setAgentInput}
                onSubmit={() => login(agentInput)}
                loading={loggingIn}
                error={loginErr}
              />
              <div style={{ fontSize: 10, color: "var(--ink-3)", lineHeight: 1.5 }}>…or from the CLI:</div>
              <Cmd cmd={loginCmd} />
            </div>
          )}
        </div>
      </div>
      {reg && (
        <Popout title="Register agent" meta="scan World ID · Hedera onboarding" onClose={() => setReg(null)}>
          {/* on completion the new account auto-logs-in (sets the session) */}
          <AgentRegister role={reg} onRegistered={(id) => login(id)} />
        </Popout>
      )}
    </>
  );
}
