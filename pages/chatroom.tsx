// pages/chatroom.tsx — MARS negotiation room.
// ONE global HCS-16 chat room (real on-chain messages) + a SIMULATED 3-line quote
// negotiation between two already-registered agents. Accepting the quote spins a
// per-task `mars-task` topic whose `init` carries the skill content + agreed terms;
// the audit pipeline (scanner→sandbox→fork→synthesizer→verdict) then appends to that
// same topic, so the topic is the full replayable log. Styled to match /audit.
/* eslint-disable @typescript-eslint/no-explicit-any */
import { useEffect, useRef, useState, type ReactNode } from "react";
import Head from "next/head";
import Link from "next/link";
import { Geist, Geist_Mono } from "next/font/google";
import { REQUESTER, AUDITOR, AUDITOR_REVIEW_TOPIC, AUDITOR_VOTING_TOPIC, SKILLS, requesterAsk, requesterAccept, auditorFallback, type StepStatus } from "@/lib/demo-skills";

const geistSans = Geist({ subsets: ["latin"] });
const geistMono = Geist_Mono({ subsets: ["latin"] });
const mono = geistMono.className;

const API = "/api/hedera";
const hs = (kind: "topic" | "account", id: string) => `https://hashscan.io/testnet/${kind}/${id}`;
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function call(body: Record<string, any>): Promise<any> {
  const res = await fetch(API, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
  return res.json();
}

function Spinner() {
  return <span className="inline-block h-3 w-3 shrink-0 animate-spin rounded-full border-2 border-zinc-300 border-t-zinc-600 dark:border-zinc-700 dark:border-t-zinc-300" />;
}

function MetaRow({ label, value, mono: isMono = true }: { label: string; value: ReactNode; mono?: boolean }) {
  return (
    <div className="flex items-baseline justify-between gap-4 py-2">
      <span className="shrink-0 text-zinc-500 dark:text-zinc-400">{label}</span>
      <span className={`${isMono ? mono : ""} text-right text-zinc-900 dark:text-zinc-100`}>{value}</span>
    </div>
  );
}

function TrailDot({ status }: { status: StepStatus | "init" | "verdict-safe" | "verdict-danger" }) {
  const map: Record<string, string> = {
    pass: "bg-green-500 text-white", "verdict-safe": "bg-green-500 text-white",
    fail: "bg-red-500 text-white", "verdict-danger": "bg-red-500 text-white",
    info: "bg-amber-500 text-white", init: "bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900",
  };
  const isX = status === "fail" || status === "verdict-danger";
  return (
    <span className={`flex h-6 w-6 items-center justify-center rounded-full ${map[status] ?? "bg-zinc-300"}`}>
      <svg viewBox="0 0 20 20" fill="none" className="h-3.5 w-3.5" aria-hidden>
        {isX ? <path d="M6 6l8 8M14 6l-8 8" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
             : <path d="M5 10.5l3 3 7-7" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />}
      </svg>
    </span>
  );
}

export default function ChatRoom() {
  const [room, setRoom] = useState<{ chatRoomTopicId: string; floraId: string } | null>(null);
  const [registry, setRegistry] = useState<string>("");
  const [messages, setMessages] = useState<any[]>([]); // on-chain chat (mirror node)
  const [pending, setPending] = useState<{ id: number; from: string; text: string }[]>([]);
  const [skillIdx, setSkillIdx] = useState(0);
  const [nego, setNego] = useState<"idle" | "running" | "agreed">("idle");
  const [task, setTask] = useState<{ taskTopicId: string; init: any } | null>(null);
  const [trail, setTrail] = useState<any[]>([]); // on-chain task-topic messages
  const [audit, setAudit] = useState<"idle" | "running" | "done">("idle");
  const [result, setResult] = useState<any>(null); // runAudit response (verdict, capabilities, source)
  const [decision, setDecision] = useState<"idle" | "running" | "approved" | "disapproved">("idle");
  const [rating, setRating] = useState(5);
  const [comment, setComment] = useState("");
  const [final, setFinal] = useState<any>(null); // finalizeTask response (review + mint)
  const pidRef = useRef(0);
  const didInit = useRef(false);

  const skill = SKILLS[skillIdx];
  const busy = nego === "running" || audit === "running" || decision === "running";

  // boot: ensure the seeded registry + the one global chat room, then poll the room
  useEffect(() => {
    if (didInit.current) return;
    didInit.current = true;
    (async () => {
      const [m, r] = await Promise.all([call({ action: "initMars" }), call({ action: "ensureChatRoom" })]);
      if (m?.registryTopicId) setRegistry(m.registryTopicId);
      if (r?.chatRoomTopicId) setRoom({ chatRoomTopicId: r.chatRoomTopicId, floraId: r.floraId });
    })();
  }, []);

  // poll the chat room every 4s (mirror node lags a few seconds)
  useEffect(() => {
    if (!room) return;
    let alive = true;
    const tick = async () => {
      const r = await call({ action: "floraRead", topicId: room.chatRoomTopicId });
      if (alive && r?.messages) setMessages(r.messages);
    };
    tick();
    const iv = setInterval(tick, 4000);
    return () => { alive = false; clearInterval(iv); };
  }, [room]);

  // poll the task topic once a task exists
  useEffect(() => {
    if (!task) return;
    let alive = true;
    const tick = async () => {
      const r = await call({ action: "readTopic", topicId: task.taskTopicId });
      if (alive && r?.messages) setTrail(r.messages);
    };
    tick();
    const iv = setInterval(tick, 4000);
    return () => { alive = false; clearInterval(iv); };
  }, [task]);

  const chat = messages.filter((m) => m.op === "message");
  // optimistic bubbles that haven't surfaced on the mirror node yet
  const ghosts = pending.filter((p) => !chat.some((m) => m.data === p.text && String(m.operator_id ?? "").startsWith(p.from)));

  async function postChat(from: string, text: string) {
    if (!room) return;
    const id = ++pidRef.current;
    setPending((p) => [...p, { id, from, text }]);
    await call({ action: "floraChat", commsTopicId: room.chatRoomTopicId, floraAccountId: room.floraId, senderId: from, data: text });
  }

  // The whole flow, one click: nego → (auto) create task → (auto) run the REAL audit pipeline.
  async function runFlow() {
    if (!room || busy) return;
    setNego("running"); setTask(null); setTrail([]); setAudit("idle"); setResult(null);
    setDecision("idle"); setFinal(null); setComment("");

    // 1) negotiation — requester scripted, auditor quote via OpenAI
    await postChat(REQUESTER, requesterAsk(skill));
    await sleep(1400);
    const q = await call({ action: "auditorReply", skillRef: skill.ref, ask: requesterAsk(skill) });
    const quote = (q && q.text) || auditorFallback(skill);
    await postChat(AUDITOR, quote);
    await sleep(1400);
    await postChat(REQUESTER, requesterAccept());
    setNego("agreed");

    // 2) create the task directly — no button (init carries the nego terms + the auditor's quote)
    await sleep(600);
    const t = await call({
      action: "createTask", skillRef: skill.ref, skill: skill.name, version: skill.version,
      scope: skill.scope, tier: skill.tier, compliance: skill.compliance,
      price: skill.price, bond: skill.bond, time: skill.time, quote,
      requester: REQUESTER, auditor: AUDITOR, chatRoomTopicId: room.chatRoomTopicId, registryTopicId: registry,
    });
    if (!t?.taskTopicId) return;
    setTask({ taskTopicId: t.taskTopicId, init: t.init });

    // 3) run the REAL audit — the server runs 4 OpenAI stages and records each onto the task topic;
    //    the trail poll shows them appear live, then the verdict + capabilities.
    setAudit("running");
    const r = await call({ action: "runAudit", taskTopicId: t.taskTopicId, skillRef: skill.ref, registryTopicId: registry });
    setResult(r);
    setAudit("done");
  }

  // requester approves/disapproves → review the auditor → (if approved + SAFE) mint a VERIFIED NFT
  async function finalize(approve: boolean) {
    if (!task || !result || decision === "running") return;
    setDecision("running");
    const r = await call({
      action: "finalizeTask", taskTopicId: task.taskTopicId, skill: skill.name, verdict: result.verdict,
      approve, rating, comment: comment.trim() || undefined,
      requester: REQUESTER, auditor: AUDITOR, reviewTopicId: AUDITOR_REVIEW_TOPIC, votingTopicId: AUDITOR_VOTING_TOPIC,
      registryTopicId: registry, mintToAccountId: REQUESTER,
    });
    setFinal(r);
    setDecision(approve ? "approved" : "disapproved");
  }

  const btn = "rounded-lg px-4 py-1.5 text-xs font-semibold transition-colors disabled:opacity-40";
  const senderTag = (acct: string) =>
    acct === AUDITOR ? { label: "auditor", cls: "bg-purple-100 text-purple-700 dark:bg-purple-900/40 dark:text-purple-300" }
      : acct === REQUESTER ? { label: "requester", cls: "bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300" }
        : { label: "agent", cls: "bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-300" };

  return (
    <div className={`${geistSans.className} flex min-h-screen justify-center bg-zinc-100 font-sans dark:bg-black`}>
      <Head><title>MARS · negotiation room</title></Head>
      <main className="w-full max-w-2xl px-8 py-16">
        {/* header */}
        <div className="flex items-center justify-between">
          <p className="text-xs font-semibold uppercase tracking-widest text-amber-600 dark:text-amber-500">Negotiation Room</p>
          <div className="flex items-center gap-3 text-xs">
            <Link href="/hedera" className={`${mono} text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-100`}>/hedera</Link>
            <Link href="/audit" className={`${mono} text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-100`}>/audit</Link>
            <Link href="/publish" className={`${mono} text-fuchsia-600 hover:text-fuchsia-500 dark:text-fuchsia-400`}>/publish</Link>
          </div>
        </div>
        <h1 className={`${mono} mt-2 text-3xl font-bold tracking-tight text-zinc-900 dark:text-zinc-50`}>mars-chatroom</h1>
        <p className={`${mono} mt-2 text-sm text-zinc-500 dark:text-zinc-400`}>
          HCS-16 ·{" "}
          {room ? <a className="text-blue-600 hover:underline dark:text-blue-400" target="_blank" rel="noreferrer" href={hs("topic", room.chatRoomTopicId)}>{room.chatRoomTopicId} ↗</a> : "ensuring room…"}
          {" · "}<a className="text-blue-600 hover:underline dark:text-blue-400" target="_blank" rel="noreferrer" href={hs("account", REQUESTER)}>requester</a>
          {" ↔ "}<a className="text-blue-600 hover:underline dark:text-blue-400" target="_blank" rel="noreferrer" href={hs("account", AUDITOR)}>auditor</a>
        </p>

        {/* skill picker + run nego */}
        <div className="mt-8 flex items-center gap-2">
          <select
            value={skillIdx}
            disabled={busy}
            onChange={(e) => setSkillIdx(Number(e.target.value))}
            className={`${mono} rounded-lg border border-zinc-300 bg-white px-3 py-1.5 text-xs text-zinc-700 disabled:opacity-50 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-300`}
          >
            {SKILLS.map((s, i) => <option key={s.ref} value={i}>{s.ref}{s.expect === "DANGEROUS" ? " ⚠" : ""}</option>)}
          </select>
          <button onClick={runFlow} disabled={!room || busy} className={`${btn} ml-auto flex items-center gap-2 bg-zinc-900 text-white hover:bg-zinc-700 dark:bg-zinc-50 dark:text-zinc-900 dark:hover:bg-zinc-300`}>
            {busy && <Spinner />}
            {nego === "running" ? "Negotiating…" : audit === "running" ? "Auditing…" : audit === "done" ? "Re-run" : "Negotiate + audit"}
          </button>
        </div>

        {/* chat transcript */}
        <div className="mt-4 max-h-[22rem] space-y-3 overflow-y-auto rounded-xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-950">
          {chat.length === 0 && ghosts.length === 0 && (
            <p className="text-sm text-zinc-400 dark:text-zinc-600">Empty room. Press <b>Run negotiation</b> — each line is a real HCS-16 message.</p>
          )}
          {chat.map((m, i) => {
            const acct = String(m.operator_id ?? "").split("@")[0];
            const t = senderTag(acct);
            return (
              <div key={`c${i}`} className="flex flex-col gap-1">
                <div className="flex items-center gap-2 text-[11px]">
                  <span className={`rounded px-1.5 py-0.5 font-semibold ${t.cls}`}>{t.label}</span>
                  <span className={`${mono} text-zinc-400`}>{acct}</span>
                  <span className="ml-auto text-green-600 dark:text-green-500">⛓ seq {m._seq}</span>
                </div>
                <p className="text-sm text-zinc-800 dark:text-zinc-200">{m.data}</p>
              </div>
            );
          })}
          {ghosts.map((p) => {
            const t = senderTag(p.from);
            return (
              <div key={`g${p.id}`} className="flex flex-col gap-1 opacity-60">
                <div className="flex items-center gap-2 text-[11px]">
                  <span className={`rounded px-1.5 py-0.5 font-semibold ${t.cls}`}>{t.label}</span>
                  <span className={`${mono} text-zinc-400`}>{p.from}</span>
                  <span className="ml-auto flex items-center gap-1 text-zinc-400"><Spinner /> posting…</span>
                </div>
                <p className="text-sm text-zinc-800 dark:text-zinc-200">{p.text}</p>
              </div>
            );
          })}
        </div>

        {/* agreed terms — task is created automatically once the nego is accepted */}
        {nego === "agreed" && (
          <div className="mt-8 rounded-xl border border-zinc-200 bg-white p-5 dark:border-zinc-800 dark:bg-zinc-950">
            <div className="flex items-center justify-between">
              <p className="text-xs font-semibold uppercase tracking-widest text-zinc-400 dark:text-zinc-500">Agreed terms</p>
              <span className={`flex items-center gap-1.5 text-xs font-semibold ${task ? "text-green-600 dark:text-green-500" : "text-zinc-400"}`}>
                {task ? "task created on HCS ✓" : <><Spinner /> opening task…</>}
              </span>
            </div>
            <div className="mt-2 border-t border-zinc-200 text-sm dark:border-zinc-800">
              <MetaRow label="Skill" value={`${skill.name} · ${skill.version}`} />
              <MetaRow label="Fee (Arc x402 escrow)" value={skill.price} />
              <MetaRow label="Auditor bond" value={skill.bond} />
              <MetaRow label="Scope" value={skill.scope} />
              <MetaRow label="ETA" value={skill.time} />
              <MetaRow label="Tier · compliance" value={`${skill.tier} · ${skill.compliance}`} />
            </div>
          </div>
        )}

        {/* task topic = the full audit trail (real OpenAI pipeline → recorded on HCS) */}
        {task && (
          <div className="mt-8">
            <div className="flex items-center justify-between">
              <p className="text-xs font-semibold uppercase tracking-widest text-zinc-400 dark:text-zinc-500">Task topic · audit trail</p>
              <span className={`flex items-center gap-1.5 text-xs font-semibold ${audit === "done" ? (result?.verdict === "SAFE" ? "text-green-600 dark:text-green-500" : "text-red-600 dark:text-red-500") : "text-amber-600 dark:text-amber-500"}`}>
                {audit === "running" ? <><Spinner /> running 4 stages…{result?.source === "fallback" ? "" : ""}</> : audit === "done" ? `${result?.verdict ?? ""} · ${result?.source === "openai" ? "OpenAI" : "fallback"}` : "queued"}
              </span>
            </div>
            <div className="mt-2 border-t border-zinc-200 text-sm dark:border-zinc-800">
              <MetaRow label="HCS task topic" value={<a className="text-blue-600 hover:underline dark:text-blue-400" target="_blank" rel="noreferrer" href={hs("topic", task.taskTopicId)}>{task.taskTopicId} ↗</a>} />
              <MetaRow label="Requester ↔ auditor" value={`${REQUESTER} ↔ ${AUDITOR}`} />
            </div>

            <ol className="mt-6">
              {trail.map((m, i) => {
                const last = i === trail.length - 1;
                let dot: any = "init"; let title = ""; let detail = ""; let sub = "";
                const findings: any[] = Array.isArray(m.findings) ? m.findings : [];
                const caps: string[] = Array.isArray(m.capabilities) ? m.capabilities : [];
                if (m.op === "init") {
                  dot = "init"; title = m.status === "posted" ? "Task posted · not started (awaiting negotiation)" : "Task opened · terms on HCS";
                  detail = m.description ? `“${m.description}”` : `${m.scope}`;
                  sub = `payer ${m.payer ?? m.requester} · auditor ${m.auditor} · ${m.price} escrow · bond ${m.bond} · scope ${m.scope}${Array.isArray(m.files) && m.files.length ? ` · files: ${m.files.join(", ")}` : ""}`;
                }
                else if (m.op === "stage") { dot = m.status === "fail" ? "fail" : m.status === "warn" ? "info" : "pass"; title = m.stage; detail = m.summary ?? ""; sub = `${m.finding_count ?? findings.length} finding(s)`; }
                else if (m.op === "step") { dot = m.status; title = m.step; detail = m.detail ?? ""; } // legacy
                else if (m.op === "verdict") { dot = m.verdict === "SAFE" ? "verdict-safe" : "verdict-danger"; title = `Verdict: ${m.verdict}`; detail = m.summary ?? `trust ${m.trustScore ?? "—"}`; sub = `risk ${m.risk ?? "—"} · trust ${m.trustScore ?? "—"}`; }
                else if (m.op === "decision") { dot = m.decision === "approved" ? "verdict-safe" : "verdict-danger"; title = `Requester ${m.decision}`; detail = m.note ?? ""; }
                else if (m.op === "reviewed") { dot = "init"; title = `Auditor reviewed · ${"★".repeat(Number(m.rating) || 0)}`; detail = m.comment ?? ""; sub = `→ auditor ${m.auditor}`; }
                else if (m.op === "minted") { dot = "verdict-safe"; title = "VERIFIED NFT minted (HTS)"; detail = `token ${m.token} · serial #${m.serial}`; sub = `owner ${m.owner}`; }
                else if (m.op === "escrow_funded") { dot = "init"; title = `Escrow funded · both sides locked → task started (Arc)`; detail = `developer fee ${m.fee} · auditor bond ${m.bond} USDC → ${m.status ?? "Funded"}`; sub = `${m.chain ?? "arc-testnet"} · job #${m.job_id} · escrow ${m.escrow}`; }
                else if (m.op === "escrow_resolved") { const slashed = m.outcome === "slashed"; dot = slashed ? "verdict-danger" : "verdict-safe"; title = slashed ? `Escrow slashed · bond ${m.amount} USDC → auditor (Arc)` : `Escrow settled · ${m.amount} USDC (fee+bond) → auditor (Arc)`; detail = slashed ? `fee ${m.fee_refunded} refunded → developer · ${m.status ?? "Slashed"}` : `release → ${m.status ?? "Settled"}`; sub = `${m.chain ?? "arc-testnet"} · job #${m.job_id} · paid ${m.paid_to}`; }
                else return null;
                return (
                  <li key={`t${i}`} className="flex gap-4">
                    <div className="flex flex-col items-center">
                      <TrailDot status={dot} />
                      {!last && <span className="w-px flex-1 bg-zinc-200 dark:bg-zinc-800" />}
                    </div>
                    <div className={last ? "min-w-0 pb-2" : "min-w-0 pb-6"}>
                      <div className="flex items-center gap-2">
                        <h2 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">{title}</h2>
                        {m.op === "verdict" && m.risk && <span className="rounded bg-zinc-100 px-1.5 py-0.5 text-[10px] font-semibold uppercase text-zinc-600 dark:bg-zinc-800 dark:text-zinc-300">risk {m.risk}</span>}
                        <span className="ml-auto shrink-0 text-[11px] text-green-600 dark:text-green-500">⛓ seq {m._seq}</span>
                      </div>
                      {detail && <p className={`${mono} mt-1 text-xs text-zinc-600 dark:text-zinc-400`}>{detail}</p>}
                      {sub && <p className="mt-0.5 text-[11px] text-zinc-400 dark:text-zinc-500">{sub}</p>}
                      {findings.length > 0 && (
                        <ul className="mt-1.5 space-y-1">
                          {findings.map((f, j) => (
                            <li key={j} className="text-[11px]">
                              <span className={`font-semibold uppercase ${["high", "critical"].includes(String(f.severity)) ? "text-red-600 dark:text-red-500" : f.severity === "medium" ? "text-amber-600 dark:text-amber-500" : "text-zinc-500"}`}>{f.severity}</span>{" "}
                              <span className="text-zinc-700 dark:text-zinc-300">{f.title}</span>
                              {f.detail && <span className="block pl-1 text-zinc-500 dark:text-zinc-400">↳ {f.detail}</span>}
                            </li>
                          ))}
                        </ul>
                      )}
                      {m.op === "minted" && m.token && (
                        <a className="mt-1 inline-block text-[11px] text-blue-600 hover:underline dark:text-blue-400" target="_blank" rel="noreferrer" href={`https://hashscan.io/testnet/token/${m.token}`}>view NFT on HashScan ↗</a>
                      )}
                      {/* the headline: what the skill ACTUALLY does (the dashboard's verified-skill summary) */}
                      {m.op === "verdict" && caps.length > 0 && (
                        <div className="mt-2 rounded-lg bg-zinc-50 p-2 dark:bg-zinc-900">
                          <p className="text-[10px] font-semibold uppercase tracking-wide text-zinc-400 dark:text-zinc-500">What the skill does</p>
                          <ul className="mt-1 space-y-0.5">
                            {caps.map((c, j) => <li key={j} className="text-[11px] text-zinc-700 dark:text-zinc-300">• {c}</li>)}
                          </ul>
                          {m.report && <a className="mt-1 inline-block text-[11px] text-blue-600 hover:underline dark:text-blue-400" target="_blank" rel="noreferrer" href={hs("topic", String(m.report).replace("hcs://1/", ""))}>full report (HCS-1) ↗</a>}
                        </div>
                      )}
                    </div>
                  </li>
                );
              })}
              {trail.length === 0 && <p className="text-sm text-zinc-400 dark:text-zinc-600">Reading task topic… (mirror node lags a few seconds)</p>}
            </ol>

            {/* requester decision → review the auditor → mint a VERIFIED HTS NFT (all recorded on HCS) */}
            {audit === "done" && result && (
              <div className="mt-2 rounded-xl border border-zinc-200 bg-white p-5 dark:border-zinc-800 dark:bg-zinc-950">
                <p className="text-xs font-semibold uppercase tracking-widest text-zinc-400 dark:text-zinc-500">Requester decision</p>
                {decision === "idle" && (
                  <div className="mt-3 space-y-3">
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-zinc-500 dark:text-zinc-400">Rate the auditor</span>
                      <div className="flex">
                        {[1, 2, 3, 4, 5].map((n) => (
                          <button key={n} onClick={() => setRating(n)} className={`text-lg leading-none ${n <= rating ? "text-amber-500" : "text-zinc-300 dark:text-zinc-600"}`}>★</button>
                        ))}
                      </div>
                      <span className="text-xs text-zinc-400">{rating}/5</span>
                    </div>
                    <input value={comment} onChange={(e) => setComment(e.target.value)} placeholder={result.verdict === "SAFE" ? "Thorough, accurate audit…" : "Caught the malicious behavior…"} className={`${mono} w-full rounded border border-zinc-300 px-2 py-1.5 text-xs dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-200`} />
                    <div className="flex gap-2">
                      <button onClick={() => finalize(true)} disabled={result.verdict !== "SAFE"} className={`${btn} bg-green-600 text-white hover:bg-green-700`}>Approve → review + mint NFT</button>
                      <button onClick={() => finalize(false)} className={`${btn} border border-red-300 bg-red-50 text-red-700 hover:bg-red-100 dark:border-red-900/50 dark:bg-red-950/30 dark:text-red-400`}>Disapprove · block</button>
                    </div>
                    {result.verdict !== "SAFE" && <p className="text-[11px] text-red-600 dark:text-red-500">DANGEROUS — can&apos;t mint a VERIFIED NFT. You can still block + review the auditor for the catch.</p>}
                  </div>
                )}
                {decision === "running" && <div className="mt-3 flex items-center gap-2 text-xs text-amber-600 dark:text-amber-500"><Spinner /> recording decision → review → mint on HCS…</div>}
                {(decision === "approved" || decision === "disapproved") && final && (
                  <div className="mt-3 border-t border-zinc-200 pt-3 text-sm dark:border-zinc-800">
                    <span className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-bold uppercase tracking-wider ${decision === "approved" ? "bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-400" : "bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-400"}`}>
                      {decision === "approved" ? "✓ Safe & Verified" : "⛔ Not verified — blocked"}
                    </span>
                    <MetaRow label="Auditor reviewed" value={`${"★".repeat(final.rating)} (${final.rating}/5)`} />
                    <MetaRow label="Auditor reputation" value={<a className="text-blue-600 hover:underline dark:text-blue-400" target="_blank" rel="noreferrer" href={hs("topic", AUDITOR_VOTING_TOPIC)}>+{final.rating} good ↗</a>} />
                    {final.mint ? (
                      <>
                        <MetaRow label="VERIFIED NFT (HTS)" value={<a className="text-blue-600 hover:underline dark:text-blue-400" target="_blank" rel="noreferrer" href={`https://hashscan.io/testnet/token/${final.mint.tokenId}`}>{final.mint.tokenId} #{final.mint.serial} ↗</a>} />
                        <MetaRow label="NFT owner" value={<a className="text-blue-600 hover:underline dark:text-blue-400" target="_blank" rel="noreferrer" href={hs("account", final.mint.owner)}>{final.mint.owner} ↗</a>} />
                      </>
                    ) : (
                      <MetaRow label="VERIFIED NFT" value="— not minted (DANGEROUS)" />
                    )}
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </main>
    </div>
  );
}
