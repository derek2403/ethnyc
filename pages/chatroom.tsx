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
import { REQUESTER, AUDITOR, SKILLS, requesterAsk, requesterAccept, auditorFallback, type StepStatus } from "@/lib/demo-skills";

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
  const pidRef = useRef(0);
  const didInit = useRef(false);

  const skill = SKILLS[skillIdx];

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

  async function runNego() {
    if (!room || nego === "running") return;
    setNego("running");
    // 1) requester ask — scripted
    await postChat(REQUESTER, requesterAsk(skill));
    await sleep(1400);
    // 2) auditor quote — generated by OpenAI (auditor ONLY; deterministic fallback if no key)
    const q = await call({ action: "auditorReply", skillRef: skill.ref, ask: requesterAsk(skill) });
    await postChat(AUDITOR, (q && q.text) || auditorFallback(skill));
    await sleep(1400);
    // 3) requester accept — scripted
    await postChat(REQUESTER, requesterAccept());
    setNego("agreed");
  }

  async function createTask() {
    if (!room) return;
    const r = await call({
      action: "createTask", skillRef: skill.ref, skill: skill.name, version: skill.version,
      scope: skill.scope, tier: skill.tier, compliance: skill.compliance,
      price: skill.price, bond: skill.bond, time: skill.time,
      requester: REQUESTER, auditor: AUDITOR, chatRoomTopicId: room.chatRoomTopicId, registryTopicId: registry,
    });
    if (r?.taskTopicId) setTask({ taskTopicId: r.taskTopicId, init: r.init });
  }

  async function runAudit() {
    if (!task || audit === "running") return;
    setAudit("running");
    for (const st of skill.steps) {
      await call({ action: "auditStep", topicId: task.taskTopicId, skillId: skill.name, step: st.name, status: st.status, detail: st.detail });
      await sleep(1200);
    }
    await call({ action: "auditVerdict", topicId: task.taskTopicId, skillId: skill.name, verdict: skill.expect, trustScore: skill.trust, reportHrl: "hcs://1/pending" });
    setAudit("done");
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
            disabled={nego === "running" || !!task}
            onChange={(e) => setSkillIdx(Number(e.target.value))}
            className={`${mono} rounded-lg border border-zinc-300 bg-white px-3 py-1.5 text-xs text-zinc-700 disabled:opacity-50 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-300`}
          >
            {SKILLS.map((s, i) => <option key={s.ref} value={i}>{s.ref}{s.expect === "DANGEROUS" ? " ⚠" : ""}</option>)}
          </select>
          <button onClick={runNego} disabled={!room || nego === "running"} className={`${btn} ml-auto bg-zinc-900 text-white hover:bg-zinc-700 dark:bg-zinc-50 dark:text-zinc-900 dark:hover:bg-zinc-300`}>
            {nego === "running" ? "Negotiating…" : nego === "agreed" ? "Re-run negotiation" : "Run negotiation"}
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

        {/* agreed terms → create task */}
        {nego === "agreed" && (
          <div className="mt-8 rounded-xl border border-zinc-200 bg-white p-5 dark:border-zinc-800 dark:bg-zinc-950">
            <div className="flex items-center justify-between">
              <p className="text-xs font-semibold uppercase tracking-widest text-zinc-400 dark:text-zinc-500">Agreed terms</p>
              <button onClick={createTask} disabled={!!task} className={`${btn} bg-zinc-900 text-white hover:bg-zinc-700 dark:bg-zinc-50 dark:text-zinc-900 dark:hover:bg-zinc-300`}>
                {task ? "Task created ✓" : "Create task → HCS"}
              </button>
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

        {/* task topic = the full audit trail */}
        {task && (
          <div className="mt-8">
            <div className="flex items-center justify-between">
              <p className="text-xs font-semibold uppercase tracking-widest text-zinc-400 dark:text-zinc-500">Task topic · audit trail</p>
              <button onClick={runAudit} disabled={audit === "running"} className={`${btn} border border-zinc-300 bg-white text-zinc-700 hover:bg-zinc-100 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-300`}>
                {audit === "running" ? "Auditing…" : audit === "done" ? "Re-run audit" : "Run audit trail"}
              </button>
            </div>
            <div className="mt-2 border-t border-zinc-200 text-sm dark:border-zinc-800">
              <MetaRow label="HCS task topic" value={<a className="text-blue-600 hover:underline dark:text-blue-400" target="_blank" rel="noreferrer" href={hs("topic", task.taskTopicId)}>{task.taskTopicId} ↗</a>} />
              <MetaRow label="Requester ↔ auditor" value={`${REQUESTER} ↔ ${AUDITOR}`} />
            </div>

            <ol className="mt-6">
              {trail.map((m, i) => {
                const last = i === trail.length - 1;
                let dot: any = "init"; let title = ""; let detail = "";
                if (m.op === "init") { dot = "init"; title = "Task opened · terms locked on HCS"; detail = `${m.price} escrow · bond ${m.bond} · scope ${m.scope} · ETA ${m.time}`; }
                else if (m.op === "step") { dot = m.status; title = m.step; detail = m.detail ?? ""; }
                else if (m.op === "verdict") { dot = m.verdict === "SAFE" ? "verdict-safe" : "verdict-danger"; title = `Verdict: ${m.verdict}`; detail = `trust ${m.trustScore} · report ${m.report ?? "—"}`; }
                else return null;
                return (
                  <li key={`t${i}`} className="flex gap-4">
                    <div className="flex flex-col items-center">
                      <TrailDot status={dot} />
                      {!last && <span className="w-px flex-1 bg-zinc-200 dark:bg-zinc-800" />}
                    </div>
                    <div className={last ? "pb-2" : "pb-6"}>
                      <div className="flex items-center gap-2">
                        <h2 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">{title}</h2>
                        <span className="text-[11px] text-green-600 dark:text-green-500">⛓ seq {m._seq}</span>
                      </div>
                      {detail && <p className={`${mono} mt-1 text-xs text-zinc-600 dark:text-zinc-400`}>{detail}</p>}
                    </div>
                  </li>
                );
              })}
              {trail.length === 0 && <p className="text-sm text-zinc-400 dark:text-zinc-600">Reading task topic… (mirror node lags a few seconds)</p>}
            </ol>
          </div>
        )}
      </main>
    </div>
  );
}
