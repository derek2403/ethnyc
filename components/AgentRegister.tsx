import { useEffect, useRef, useState } from "react";
import { QRCodeSVG } from "qrcode.react";

// Runs the streamed World-ID + Hedera registration (/api/register-agent-stream)
// and renders the World verify QR + live step progress + the final agent id.

type Step = { step: string; status: "running" | "done"; label: string; id?: string };
type Result = {
  account: string;
  evmAddress?: string;
  role: string;
  profileTopicId?: string;
  votingTopicId?: string;
  reviewTopicId?: string;
  worldVerified?: boolean;
  humanId?: string | null;
};

export default function AgentRegister({ role }: { role: "user" | "auditor" }) {
  const [steps, setSteps] = useState<Step[]>([]);
  const [scan, setScan] = useState<string | null>(null);
  const [result, setResult] = useState<Result | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const started = useRef(false);

  useEffect(() => {
    if (started.current) return;
    started.current = true;
    (async () => {
      try {
        const res = await fetch("/api/register-agent-stream", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ role }),
        });
        const reader = res.body?.getReader();
        if (!reader) throw new Error("no stream");
        const dec = new TextDecoder();
        let buf = "";
        for (;;) {
          const { done, value } = await reader.read();
          if (done) break;
          buf += dec.decode(value, { stream: true });
          const parts = buf.split("\n\n");
          buf = parts.pop() || "";
          for (const p of parts) {
            const line = p.split("\n").find((l) => l.startsWith("data: "));
            if (!line) continue;
            const evt = JSON.parse(line.slice(6));
            if (evt.type === "step") {
              setSteps((s) => {
                const i = s.findIndex((x) => x.step === evt.step);
                const e: Step = { step: evt.step, status: evt.status, label: evt.label, id: evt.id };
                if (i >= 0) {
                  const n = [...s];
                  n[i] = e;
                  return n;
                }
                return [...s, e];
              });
            } else if (evt.type === "scan") setScan(evt.link);
            else if (evt.type === "done") {
              setResult(evt.result);
              setScan(null);
            } else if (evt.type === "error") setErr(evt.error);
          }
        }
      } catch (e) {
        setErr(e instanceof Error ? e.message : "stream failed");
      }
    })();
  }, [role]);

  const accent = role === "auditor" ? "var(--comm)" : "var(--warn)";

  return (
    <div style={{ display: "flex", height: "100%" }}>
      {/* steps */}
      <div className="no-bar" style={{ width: 360, flex: "none", borderRight: "1px solid var(--hair)", overflow: "auto", padding: 22 }}>
        <div style={{ fontSize: 9.5, fontWeight: 500, letterSpacing: ".1em", textTransform: "uppercase", color: accent }}>Registering · {role}</div>
        <div style={{ fontSize: 20, fontWeight: 600, marginTop: 4 }}>New {role} agent</div>
        <div style={{ display: "flex", flexDirection: "column", gap: 0, marginTop: 18 }}>
          {steps.map((s, i) => {
            const done = s.status === "done";
            const color = done ? "var(--safe)" : "var(--warn)";
            return (
              <div key={s.step} style={{ display: "flex", gap: 12, paddingBottom: i === steps.length - 1 ? 0 : 14 }}>
                <div style={{ display: "flex", flexDirection: "column", alignItems: "center", flex: "none" }}>
                  <span style={{ width: 15, height: 15, borderRadius: "50%", border: `1.5px solid ${color}`, background: done ? color : "transparent", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 8, color: "#fff", animation: done ? undefined : "onlinePulse 1.4s ease-in-out infinite" }}>{done ? "✓" : ""}</span>
                  {i < steps.length - 1 && <span style={{ width: 1.5, flex: 1, minHeight: 14, background: "var(--hair)", marginTop: 3 }} />}
                </div>
                <div style={{ paddingBottom: 2 }}>
                  <div style={{ fontSize: 12, color: "var(--ink)" }}>{s.label}</div>
                  {s.id && <div style={{ fontSize: 10.5, color: "var(--ink-3)", fontFamily: "var(--code)", marginTop: 1 }}>{s.id}</div>}
                </div>
              </div>
            );
          })}
          {!steps.length && !err && <div style={{ fontSize: 12, color: "var(--ink-3)" }}>starting…</div>}
        </div>
        {err && <div style={{ marginTop: 14, fontSize: 12, color: "var(--danger)" }}>{err}</div>}
      </div>

      {/* QR / result */}
      <div className="no-bar" style={{ flex: 1, minWidth: 0, overflow: "auto", padding: 28, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 14 }}>
        {scan && !result && (
          <>
            <div style={{ fontSize: 9.5, fontWeight: 500, letterSpacing: ".1em", textTransform: "uppercase", color: "var(--ink-3)" }}>Scan with World App</div>
            <div style={{ background: "#fff", padding: 14, borderRadius: 12, border: "1px solid var(--hair)" }}>
              <QRCodeSVG value={scan} size={208} />
            </div>
            <div style={{ fontSize: 11.5, color: "var(--ink-3)", textAlign: "center", maxWidth: 280, lineHeight: 1.5 }}>
              Verify proof-of-personhood — I&apos;ll detect the scan and finish automatically.
            </div>
            <a href={scan} target="_blank" rel="noopener noreferrer" style={{ fontSize: 10.5, color: "var(--mars)", textDecoration: "none" }}>
              open verify link ↗
            </a>
          </>
        )}

        {!scan && !result && !err && <div style={{ fontSize: 12, color: "var(--ink-3)" }}>creating account…</div>}

        {result && (
          <div style={{ width: "100%", maxWidth: 380, display: "flex", flexDirection: "column", gap: 10 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <span style={{ fontSize: 22, fontWeight: 600 }}>{result.account}</span>
              <span style={{ fontSize: 10, fontWeight: 600, color: result.worldVerified ? "var(--safe)" : "var(--ink-3)", border: `1px solid ${result.worldVerified ? "var(--safe)" : "var(--hair)"}`, borderRadius: 6, padding: "2px 8px" }}>{result.worldVerified ? "World ✓" : "unverified"}</span>
            </div>
            <div style={{ fontSize: 11, color: "var(--ink-3)" }}>{result.role} agent · {result.evmAddress}</div>
            <div style={{ display: "flex", flexDirection: "column", gap: 7, marginTop: 4 }}>
              {[
                ["profile (HCS-11)", result.profileTopicId],
                ["voting (HCS-20)", result.votingTopicId],
                ["review", result.reviewTopicId],
              ].map(([l, id]) => (
                <div key={l} style={{ display: "flex", justifyContent: "space-between", fontSize: 11.5 }}>
                  <span style={{ color: "var(--ink-3)" }}>{l}</span>
                  <a href={`https://hashscan.io/testnet/topic/${id}`} target="_blank" rel="noopener noreferrer" style={{ color: "var(--ink-2)", fontFamily: "var(--code)", textDecoration: "none" }}>{id} ↗</a>
                </div>
              ))}
            </div>
            <div style={{ marginTop: 8, fontSize: 11, color: "var(--ink-3)", lineHeight: 1.5 }}>
              Export to your agent: <span style={{ fontFamily: "var(--code)", color: "var(--ink-2)" }}>MARS_AGENT_ID={result.account}</span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
