import { useEffect, useRef, useState } from "react";
import Popout from "./Popout";
import AgentRegister from "./AgentRegister";
import { useMars } from "./marsState";

// ── Cell E · Connect Agent ───────────────────────────────────────────────
// Agents register / log in by curling the API. The cell hands out the commands.
//   Register → User (audit & license skills from OpenClaw / Hermes / any agent)
//            → Auditor (run the audit pipeline; prerequisites apply)
//   Connect  → CLI login that loads the agent's saved profile from the DB.
//
// The home view shows a live roster of connected agents, polled from the DB via
// useMars(). When a `curl …/api/register-cli` finishes it persists the agent, so
// it pops in here within ~1s — flagged "just connected" for a few seconds.

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

// Hedera account explorer — same link the curl flow prints (lib/hedera.hashscan).
const hashscanAccount = (id: string) => `https://hashscan.io/testnet/account/${id}`;
// Middle-ellipsis for long hashes (evm address, human id) — full value in title.
const short = (s: string | null, head = 10, tail = 6) =>
  s && s.length > head + tail + 1 ? `${s.slice(0, head)}…${s.slice(-tail)}` : s || "—";

function Field({ label, value, title }: { label: string; value: string; title?: string }) {
  return (
    <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", gap: 12 }}>
      <span style={{ fontSize: 9, letterSpacing: ".06em", textTransform: "uppercase", color: "var(--ink-3)", flex: "none" }}>{label}</span>
      <span title={title ?? value} style={{ fontFamily: "var(--code)", fontSize: 10, color: "var(--ink-2)", minWidth: 0, overflow: "hidden", whiteSpace: "nowrap", textOverflow: "ellipsis", textAlign: "right" }}>{value}</span>
    </div>
  );
}

// One connected agent. The whole card is a link to its HashScan account page.
function AgentCard({ a, fresh }: { a: ConnectedAgent; fresh: boolean }) {
  const roleColor = a.role === "auditor" ? "var(--comm)" : "var(--warn)";
  return (
    <a
      className="ca-agent-card"
      href={hashscanAccount(a.id)}
      target="_blank"
      rel="noopener noreferrer"
      title={`Open ${a.id} on HashScan ↗`}
      style={
        fresh
          ? { display: "block", textDecoration: "none", borderRadius: 9, padding: "10px 12px", border: "1px solid var(--safe)", background: "rgba(31,157,99,0.08)" }
          : { display: "block", textDecoration: "none", borderRadius: 9, padding: "10px 12px" }
      }
    >
      <div style={{ display: "flex", alignItems: "center", gap: 9 }}>
        <span
          style={{
            width: 7,
            height: 7,
            borderRadius: "50%",
            flex: "none",
            background: a.verified ? "var(--safe)" : "var(--ink-3)",
            animation: fresh ? "onlinePulse 1.4s ease-in-out infinite" : "none",
          }}
        />
        <span style={{ fontFamily: "var(--code)", fontSize: 11.5, fontWeight: 500, color: "var(--ink)", flex: 1, minWidth: 0, overflow: "hidden", whiteSpace: "nowrap", textOverflow: "ellipsis" }}>{a.id}</span>
        {fresh && <span style={{ fontSize: 8.5, color: "var(--safe)", letterSpacing: ".08em", textTransform: "uppercase", flex: "none" }}>just connected</span>}
        <span style={{ fontSize: 9, color: roleColor, border: "1px solid var(--hair-soft)", padding: "1px 6px", borderRadius: 6, textTransform: "uppercase", letterSpacing: ".06em", flex: "none" }}>{a.role}</span>
        <span style={{ fontSize: 9.5, color: "var(--ink-3)", flex: "none" }}>↗ explorer</span>
      </div>
      <div style={{ marginTop: 9, paddingTop: 9, borderTop: "1px solid var(--hair-soft)", display: "flex", flexDirection: "column", gap: 5 }}>
        <Field label="evm" value={short(a.evm)} title={a.evm ?? undefined} />
        <Field label="world id" value={a.verified ? `✓ ${short(a.humanId)}` : "unverified"} title={a.humanId ?? undefined} />
        <Field label="voting" value={a.votingTopic ?? "—"} />
        <Field label="review" value={a.reviewTopic ?? "—"} />
        <Field label="profile" value={a.profileTopic ?? "—"} />
        <Field label="memo" value={a.accountMemo ?? "—"} />
        <Field label="registry" value={a.registrySeq != null ? `#${a.registrySeq}` : "—"} />
        <Field label="rating" value={`${a.rating.toFixed(1)} / 5`} />
        <Field label="registered" value={(a.registeredAt ?? "").slice(0, 10) || "—"} title={a.registeredAt ?? undefined} />
      </div>
    </a>
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

const AUDITOR_PREREQS = ["World-ID verified", "can run the audit pipeline (OpenAI key)", "bond staked (slashed on a wrong verdict)", "sandbox/fork runtime for deeper tiers"];

export default function ConnectAgent() {
  const { state, ready } = useMars();
  const [mode, setMode] = useState<Mode>("home");
  const [reg, setReg] = useState<"user" | "auditor" | null>(null);
  const [base, setBase] = useState("https://mars.derek2403.win");
  useEffect(() => {
    if (typeof window !== "undefined") setBase(window.location.origin);
  }, []);

  // Live roster of connected agents (registered users + auditors), polled from
  // the DB. worldId is "—" when unverified (see deriveState in lib/db.mjs).
  const toAgent = (a: (typeof state.users)[number] | (typeof state.auditors)[number], role: "user" | "auditor"): ConnectedAgent => ({
    id: a.id,
    role,
    verified: a.worldVerified ?? a.worldId !== "—",
    evm: a.evm ?? null,
    humanId: a.humanId ?? (a.worldId !== "—" ? a.worldId : null),
    votingTopic: a.votingTopic ?? null,
    reviewTopic: a.reviewTopic ?? null,
    profileTopic: a.profileTopic ?? null,
    accountMemo: a.accountMemo ?? null,
    registrySeq: a.registrySeq ?? null,
    rating: a.rating ?? 0,
    registeredAt: a.registeredAt ?? null,
  });
  const agents: ConnectedAgent[] = [
    ...state.users.map((u) => toAgent(u, "user")),
    ...state.auditors.map((a) => toAgent(a, "auditor")),
  ];
  const idsKey = agents.map((a) => a.id).join(",");

  // Flash agents that appear after the first load (i.e. a curl just finished).
  // Existing agents present on first poll are seeded silently — they don't flash.
  const seenRef = useRef<Set<string>>(new Set());
  const initRef = useRef(false);
  const timersRef = useRef<ReturnType<typeof setTimeout>[]>([]);
  const [fresh, setFresh] = useState<Set<string>>(new Set());
  useEffect(() => () => timersRef.current.forEach(clearTimeout), []);
  useEffect(() => {
    if (!ready) return;
    const ids = agents.map((a) => a.id);
    if (!initRef.current) {
      ids.forEach((id) => seenRef.current.add(id));
      initRef.current = true;
      return;
    }
    const incoming = ids.filter((id) => !seenRef.current.has(id));
    if (!incoming.length) return;
    incoming.forEach((id) => seenRef.current.add(id));
    setFresh((prev) => new Set([...prev, ...incoming]));
    // Per-batch timer (not cancelled on re-run, so back-to-back registrations
    // each clear on their own 6s schedule); all torn down on unmount above.
    timersRef.current.push(
      setTimeout(() => {
        setFresh((prev) => {
          const next = new Set(prev);
          incoming.forEach((id) => next.delete(id));
          return next;
        });
      }, 6000)
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready, idsKey]);

  // Freshly-connected float to the top; the rest keep newest-first order.
  const roster = [...agents].reverse().sort((a, b) => Number(fresh.has(b.id)) - Number(fresh.has(a.id)));

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
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          {mode !== "home" && <span style={{ fontSize: 9.5, letterSpacing: ".1em", textTransform: "uppercase", color: "var(--ink-3)" }}>{mode}</span>}
          <span style={{ display: "flex", alignItems: "center", gap: 5, fontSize: 10, color: agents.length ? "var(--safe)" : "var(--ink-3)" }}>
            <span style={{ width: 6, height: 6, borderRadius: "50%", background: agents.length ? "var(--safe)" : "var(--ink-3)" }} />
            {agents.length} connected
          </span>
        </div>
      </div>

      <div className="no-bar" style={{ flex: 1, minHeight: 0, padding: 16, overflow: "auto", display: "flex", flexDirection: "column" }}>
        {/* Once any agent is connected, the cell becomes its roster + profiles.
            Before that, it shows the onboarding intro + register/connect. */}
        {mode === "home" && roster.length === 0 && (
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

        {mode === "home" && roster.length > 0 && (
          <div style={{ flex: 1, minHeight: 0, display: "flex", flexDirection: "column", gap: 10 }}>
            <div style={{ flex: "none", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
              <span style={{ fontSize: 9.5, fontWeight: 500, letterSpacing: ".1em", color: "var(--ink-3)", textTransform: "uppercase" }}>Connected agents</span>
              <span style={{ fontSize: 9.5, color: "var(--ink-3)" }}>{state.stats.users} users · {state.stats.auditors} auditors · tap → explorer</span>
            </div>
            <div className="no-bar" style={{ flex: 1, minHeight: 0, overflow: "auto", display: "flex", flexDirection: "column", gap: 8 }}>
              {roster.map((a) => (
                <AgentCard key={a.id} a={a} fresh={fresh.has(a.id)} />
              ))}
            </div>
            <div style={{ flex: "none", display: "flex", alignItems: "center", gap: 8 }}>
              <button
                onClick={() => setMode("register")}
                style={{ background: "none", border: "1px solid var(--mars-soft)", color: "var(--mars)", fontSize: 10.5, fontWeight: 500, padding: "6px 12px", cursor: "pointer", borderRadius: 7 }}
              >
                + register another
              </button>
              <button
                onClick={() => setMode("connect")}
                style={{ background: "none", border: "1px solid var(--hair)", color: "var(--ink-2)", fontSize: 10.5, fontWeight: 500, padding: "6px 12px", cursor: "pointer", borderRadius: 7 }}
              >
                connect existing
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
