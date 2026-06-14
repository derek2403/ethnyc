// pages/publish.tsx — AUTHOR flow: publish a PREMIUM, royalty-bearing skill.
//
// Minimal, author-friendly: the only decisions an author makes are (1) verify they're
// human, (2) pick the skill, (3) set the royalty %. One "Publish" button then runs the
// whole on-chain pipeline automatically — approve → create+fund the Arc escrow audit job →
// auditor posts bond → real audit → release escrow → mint the Hedera VERIFIED NFT + a
// premium license, and list the skill. Fee/bond/Hedera-payout/Gateway live under "Advanced".
//
// Visual language follows pages/page1.tsx (soft light theme + the --cell/--ink/--mars tokens).
/* eslint-disable @typescript-eslint/no-explicit-any */
import { useCallback, useEffect, useState } from "react";
import Head from "next/head";
import Link from "next/link";
import { ConnectButton } from "@rainbow-me/rainbowkit";
import { useAccount, useChainId, usePublicClient, useReadContract, useSwitchChain, useWriteContract } from "wagmi";
import { formatUnits, parseUnits } from "viem";
import WorldIdVerification from "@/components/WorldIdVerification";
import {
  ESCROW_ABI,
  ESCROW_ADDRESS,
  GATEWAY_WALLET,
  GATEWAY_WALLET_ABI,
  USDC_ABI,
  USDC_ADDRESS,
  USDC_DECIMALS,
  arcTestnet,
  explorerTx,
} from "@/lib/escrow";

const APP_ID = process.env.NEXT_PUBLIC_WORLD_APP_ID as `app_${string}` | undefined;
const RP_ID = process.env.NEXT_PUBLIC_RP_ID;

const API = "/api/hedera";
const short = (a?: string) => (a ? `${a.slice(0, 6)}…${a.slice(-4)}` : "—");
const hashscan = (kind: "account" | "token" | "topic", id: string) => `https://hashscan.io/testnet/${kind}/${id}`;

async function call(body: Record<string, any>): Promise<any> {
  const res = await fetch(API, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
  return res.json();
}

const DEMO_SKILLS = [
  { ref: "safe-weather-skill", label: "Safe Weather — read-only weather lookup" },
  { ref: "price-checker.js", label: "Price Checker — token price oracle" },
  { ref: "portfolio-helper.js", label: "Portfolio Helper — portfolio summary" },
  { ref: "poisoned-pdf-skill", label: "Poisoned PDF — (unsafe, for testing the auditor)" },
];

// The publish pipeline, in the order it runs. Each becomes a row in the live checklist.
const STEPS = [
  { key: "approve", label: "Approve USDC for the escrow" },
  { key: "create", label: "Create the audit job (Arc escrow)" },
  { key: "fund", label: "Fund the audit fee" },
  { key: "bond", label: "Auditor posts its bond" },
  { key: "audit", label: "Run the security audit" },
  { key: "release", label: "Release escrow to the auditor" },
  { key: "mint", label: "Mint VERIFIED + list as premium" },
] as const;
type StepKey = (typeof STEPS)[number]["key"];
type StepState = { status: "pending" | "running" | "done" | "error"; note?: string };

export default function Publish() {
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  // identity
  const [verified, setVerified] = useState(false);
  const [humanId, setHumanId] = useState<string | null>(null);
  const [worldStatus, setWorldStatus] = useState("");
  const worldConfigured = Boolean(APP_ID && RP_ID);

  // wallet
  const { address, isConnected } = useAccount();
  const chainId = useChainId();
  const { switchChain } = useSwitchChain();
  const onArc = chainId === arcTestnet.id;
  const publicClient = usePublicClient();
  const { writeContractAsync } = useWriteContract();

  // author choices (the only things they set)
  const [skillRef, setSkillRef] = useState(DEMO_SKILLS[0].ref);
  const [royalty, setRoyalty] = useState(10);
  const price = "0.01"; // per-use price buyers pay

  // advanced (sensible defaults — hidden by default)
  const [fee, setFee] = useState("1");
  const [bond, setBond] = useState("0.5");
  const [hederaId, setHederaId] = useState("");
  const [regAmt, setRegAmt] = useState("0.2");

  // infra
  const [agent, setAgent] = useState<{ address?: string } | null>(null);
  const [agentErr, setAgentErr] = useState<string | null>(null);
  const [registryTopicId, setRegistryTopicId] = useState("");
  const [gwBal, setGwBal] = useState<string | null>(null);
  const [reg, setReg] = useState<{ busy?: boolean; error?: string; done?: boolean; tx?: string }>({});

  // run state
  const [running, setRunning] = useState(false);
  const [steps, setSteps] = useState<Record<StepKey, StepState>>(() => Object.fromEntries(STEPS.map((s) => [s.key, { status: "pending" }])) as Record<StepKey, StepState>);
  const [result, setResult] = useState<any>(null);
  const [err, setErr] = useState<string | null>(null);

  const usdcBal = useReadContract({ address: USDC_ADDRESS, abi: USDC_ABI, functionName: "balanceOf", args: address ? [address] : undefined, query: { enabled: !!address } });

  const fetchAgent = useCallback(async () => {
    try {
      const r = await fetch("/api/agent");
      const d = await r.json();
      if (d.address) { setAgent(d); setAgentErr(null); }
      else setAgentErr(d.error || "auditor agent unavailable");
    } catch (e) { setAgentErr(e instanceof Error ? e.message : "auditor agent unavailable"); }
  }, []);
  const fetchGwBal = useCallback(async () => {
    if (!address) return setGwBal(null);
    try { const r = await fetch(`/api/gateway-balance?address=${address}`); const d = await r.json(); setGwBal(d.available ?? "0"); } catch { setGwBal(null); }
  }, [address]);
  useEffect(() => { fetchAgent(); fetchGwBal(); }, [fetchAgent, fetchGwBal]);
  useEffect(() => { (async () => { const r = await call({ action: "initMars" }); if (r?.registryTopicId) setRegistryTopicId(r.registryTopicId); })(); }, []);

  const amt = (v: string) => parseUnits(v || "0", USDC_DECIMALS);
  const mark = (key: StepKey, status: StepState["status"], note?: string) => setSteps((s) => ({ ...s, [key]: { status, note } }));
  const ready = mounted && verified && isConnected && onArc && !running;

  // one-time: register the author's wallet with Circle Gateway so it can RECEIVE x402 royalties
  const registerGateway = async () => {
    if (!address || !publicClient) return;
    setReg({ busy: true });
    try {
      const a = parseUnits(regAmt || "0.2", USDC_DECIMALS);
      const approveHash = await writeContractAsync({ address: USDC_ADDRESS, abi: USDC_ABI, functionName: "approve", args: [GATEWAY_WALLET, a] });
      await publicClient.waitForTransactionReceipt({ hash: approveHash });
      const depositHash = await writeContractAsync({ address: GATEWAY_WALLET, abi: GATEWAY_WALLET_ABI, functionName: "deposit", args: [USDC_ADDRESS, a], gas: 120000n });
      await publicClient.waitForTransactionReceipt({ hash: depositHash });
      setReg({ done: true, tx: depositHash }); fetchGwBal(); usdcBal.refetch();
    } catch (e) { const x = e as { shortMessage?: string; message?: string }; setReg({ error: x.shortMessage || x.message || "register failed" }); }
  };

  // The whole publish pipeline behind one button.
  const publishAll = async () => {
    if (!address || !publicClient) return;
    setErr(null); setResult(null); setRunning(true);
    setSteps(Object.fromEntries(STEPS.map((s) => [s.key, { status: "pending" }])) as Record<StepKey, StepState>);
    const wait = (hash: `0x${string}`) => publicClient.waitForTransactionReceipt({ hash });
    try {
      const feeUnits = amt(fee);
      const bondUnits = amt(bond);
      const sel = DEMO_SKILLS.find((s) => s.ref === skillRef);
      const skill = (sel?.ref || skillRef).replace(/\.(js|json|md)$/i, "");

      // 1 · approve (only if needed)
      mark("approve", "running");
      const allow = (await publicClient.readContract({ address: USDC_ADDRESS, abi: USDC_ABI, functionName: "allowance", args: [address, ESCROW_ADDRESS] })) as bigint;
      if (allow < feeUnits) {
        const h = await writeContractAsync({ address: USDC_ADDRESS, abi: USDC_ABI, functionName: "approve", args: [ESCROW_ADDRESS, amt("1000")] });
        await wait(h);
      }
      mark("approve", "done");

      // 2 · create job (developer = you, auditor = MARS agent)
      mark("create", "running");
      if (!agent?.address) throw new Error(agentErr || "auditor agent unavailable — set ARC_PRIVATE_KEY");
      const newId = Number(await publicClient.readContract({ address: ESCROW_ADDRESS, abi: ESCROW_ABI, functionName: "nextJobId" }));
      const ch = await writeContractAsync({ address: ESCROW_ADDRESS, abi: ESCROW_ABI, functionName: "createJob", args: [address, agent.address as `0x${string}`, feeUnits, bondUnits] });
      await wait(ch);
      mark("create", "done", `job #${newId}`);

      // 3 · fund the fee
      mark("fund", "running");
      await wait(await writeContractAsync({ address: ESCROW_ADDRESS, abi: ESCROW_ABI, functionName: "fundFee", args: [BigInt(newId)] }));
      mark("fund", "done");

      // 4 · auditor posts bond (server-side, the MARS agent)
      mark("bond", "running");
      const br = await fetch("/api/agent-post-bond", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ jobId: newId }) });
      const bd = await br.json();
      if (!br.ok || !bd.ok) throw new Error(bd.error || "auditor could not post bond");
      mark("bond", "done");

      // 5 · run the real audit
      mark("audit", "running");
      const created = await call({ action: "createTask", skillRef, skill, requester: hederaId || "author", auditor: "mars-premium-auditor", price: `${price} USDC`, registryTopicId });
      if (created.error || !created.taskTopicId) throw new Error(created.error || "could not create audit task");
      const aud = await call({ action: "runAudit", taskTopicId: created.taskTopicId, skillRef, registryTopicId });
      if (aud.error) throw new Error(aud.error);
      if (aud.verdict !== "SAFE") { mark("audit", "error", `verdict ${aud.verdict}`); throw new Error(`Audit verdict is ${aud.verdict} — this skill can't be published. Try a safe skill.`); }
      mark("audit", "done", `SAFE · trust ${aud.trustScore}`);

      // 6 · release escrow to the auditor (clean audit paid)
      mark("release", "running");
      await wait(await writeContractAsync({ address: ESCROW_ADDRESS, abi: ESCROW_ABI, functionName: "release", args: [BigInt(newId)] }));
      mark("release", "done");

      // 7 · mint VERIFIED + premium license + list
      mark("mint", "running");
      const pub = await call({
        action: "publishPremiumSkill",
        taskTopicId: created.taskTopicId,
        skill: aud.skill ?? skill,
        skillRef,
        verdict: "SAFE",
        author: { hederaId: hederaId || null, evm: address, humanId },
        royaltyPct: royalty,
        price: `${price} USDC`,
        escrowJobId: newId,
        registryTopicId,
      });
      if (pub.error) throw new Error(pub.error);
      mark("mint", "done");
      setResult({ ...pub, taskTopicId: created.taskTopicId, jobId: newId });
      usdcBal.refetch();
    } catch (e) {
      const x = e as { shortMessage?: string; message?: string };
      setErr(x.shortMessage || x.message || String(e));
      setSteps((s) => Object.fromEntries(Object.entries(s).map(([k, v]) => [k, v.status === "running" ? { ...v, status: "error" } : v])) as Record<StepKey, StepState>);
    } finally { setRunning(false); }
  };

  const hint = !mounted ? "" : !verified ? "Verify you're human first." : !isConnected ? "Connect your wallet to publish." : !onArc ? "Switch to Arc Testnet." : "";
  const anyStepShown = running || result || Object.values(steps).some((v) => v.status !== "pending");

  return (
    <div className="pub-page">
      <Head><title>MARS · publish a skill</title></Head>

      <div className="pub-wrap">
        <header className="pub-header">
          <div className="flex items-center gap-3">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/logo.svg" alt="MARS" style={{ height: 28, width: "auto", display: "block" }} />
            <div>
              <h1 className="pub-h1">Publish a skill</h1>
              <p className="pub-sub">Get your skill audited, minted VERIFIED on Hedera, and earn a royalty every time an agent uses it.</p>
            </div>
          </div>
          {mounted && <ConnectButton showBalance={false} />}
        </header>

        <div className="pub-col">
          {/* 1 · verify */}
          <section className="pub-card">
            <StepHead n={1} title="Verify you're human" done={verified} />
            {verified ? (
              <p className="t-safe" style={{ fontSize: 13 }}>✓ Verified{humanId ? ` · ${short(humanId)}` : ""}.</p>
            ) : worldConfigured ? (
              <div>
                <WorldIdVerification verified={verified} setVerified={setVerified} setStatus={setWorldStatus} appId={APP_ID!} rpId={RP_ID!} onVerified={(d) => setHumanId(d?.onchain?.nullifier ?? null)} />
                {worldStatus && <p className="t-ink3 mt-2" style={{ fontSize: 12 }}>{worldStatus}</p>}
              </div>
            ) : (
              <div className="t-warn" style={{ fontSize: 13 }}>
                World ID not configured. <button onClick={() => setVerified(true)} className="pub-btn pub-btn--ghost ml-2" style={{ padding: "5px 10px", fontSize: 12 }}>Skip (dev)</button>
              </div>
            )}
          </section>

          {/* 2 · publish */}
          <section className={`pub-card ${!verified ? "pub-locked" : ""}`}>
            <StepHead n={2} title="Publish your skill" done={!!result} />

            <label className="pub-field">
              <span className="pub-label">Skill</span>
              <select className="pub-input" value={skillRef} onChange={(e) => setSkillRef(e.target.value)} disabled={running}>
                {DEMO_SKILLS.map((s) => <option key={s.ref} value={s.ref}>{s.label}</option>)}
              </select>
            </label>

            <label className="pub-field mt-3">
              <span className="pub-label">Your royalty — <span className="t-mars" style={{ fontWeight: 700 }}>{royalty}%</span> of every use</span>
              <input type="range" min={1} max={50} value={royalty} onChange={(e) => setRoyalty(Number(e.target.value))} disabled={running} className="pub-range" />
            </label>

            <button onClick={publishAll} disabled={!ready} className="pub-btn pub-btn--mars pub-publish mt-4">
              {running ? "Publishing…" : "Publish skill"}
            </button>
            {hint && <span className="t-ink3 ml-3" style={{ fontSize: 12 }}>{hint}</span>}

            {/* live progress */}
            {anyStepShown && (
              <ul className="pub-steps mt-4">
                {STEPS.map((s) => {
                  const st = steps[s.key];
                  const icon = st.status === "done" ? "✓" : st.status === "error" ? "✕" : st.status === "running" ? "spin" : "○";
                  const tone = st.status === "done" ? "t-safe" : st.status === "error" ? "t-danger" : st.status === "running" ? "t-comm" : "t-ink3";
                  return (
                    <li key={s.key} className="flex items-center gap-2">
                      {icon === "spin" ? <span className="pub-spin" /> : <span className={tone} style={{ width: 14, textAlign: "center" }}>{icon}</span>}
                      <span className={st.status === "pending" ? "t-ink3" : "t-ink2"} style={{ fontSize: 13 }}>{s.label}</span>
                      {st.note && <span className="t-ink3" style={{ fontSize: 12 }}>· {st.note}</span>}
                    </li>
                  );
                })}
              </ul>
            )}

            {err && <p className="pub-note pub-note--danger">{err}</p>}
            {agentErr && !agent?.address && <p className="t-warn mt-2" style={{ fontSize: 12 }}>Heads up: the auditor agent isn&apos;t loaded ({agentErr}). Set <code className="pub-code">ARC_PRIVATE_KEY</code> in <code className="pub-code">hardhat/.env</code> and restart.</p>}

            {/* result */}
            {result && (
              <div className="pub-note pub-note--safe mt-3 flex flex-col gap-1.5">
                <p><strong>✓ {result.skill} is live</strong> — verified & earning {result.royaltyPct}% royalty.</p>
                {result.verified?.tokenId && <p className="t-ink2">VERIFIED badge: <a className="pub-code pub-link" href={hashscan("token", result.verified.tokenId)} target="_blank" rel="noreferrer">{result.verified.tokenId}#{result.verified.serial} ↗</a></p>}
                {result.license?.tokenId && (
                  <p className="t-ink2">License token: <a className="pub-code pub-link" href={hashscan("token", result.license.tokenId)} target="_blank" rel="noreferrer">{result.license.tokenId} ↗</a>{result.license.royalty ? <span className="t-ink3"> · Hedera royalty {result.license.royalty.numerator}/{result.license.royalty.denominator}</span> : <span className="t-ink3"> · Arc royalty only</span>}</p>
                )}
                <p className="t-ink2" style={{ borderTop: "1px solid var(--hair-soft)", paddingTop: 8, marginTop: 4 }}>
                  Agents pay {price} USDC per use on the <Link className="pub-link" href="/test">marketplace</Link> (job #{result.jobId}) — {result.royaltyPct}% comes to you.
                </p>
              </div>
            )}

            {/* advanced */}
            <details className="pub-adv mt-4">
              <summary className="pub-label" style={{ cursor: "pointer" }}>Advanced settings</summary>
              <div className="flex flex-col gap-3 mt-3">
                <div className="flex flex-wrap items-end gap-4">
                  <label className="pub-field"><span className="pub-label">Audit fee (USDC)</span><input className="pub-input" style={{ width: 90 }} value={fee} onChange={(e) => setFee(e.target.value)} disabled={running} /></label>
                  <label className="pub-field"><span className="pub-label">Auditor bond (USDC)</span><input className="pub-input" style={{ width: 90 }} value={bond} onChange={(e) => setBond(e.target.value)} disabled={running} /></label>
                </div>
                <label className="pub-field">
                  <span className="pub-label">Hedera payout account <span style={{ textTransform: "none", fontWeight: 400 }} className="t-ink3">— optional, adds a native Hedera royalty</span></span>
                  <input className="pub-input" style={{ width: 200 }} placeholder="0.0.xxxxx" value={hederaId} onChange={(e) => setHederaId(e.target.value.trim())} disabled={running} />
                </label>
                <div className="flex flex-wrap items-end gap-3" style={{ borderTop: "1px solid var(--hair-soft)", paddingTop: 12 }}>
                  <label className="pub-field"><span className="pub-label">Set up payouts (one-time) · deposit USDC</span><input className="pub-input" style={{ width: 90 }} value={regAmt} onChange={(e) => setRegAmt(e.target.value)} /></label>
                  <button onClick={registerGateway} disabled={reg.busy || !onArc} className="pub-btn pub-btn--ghost">{reg.busy ? "setting up…" : "Register to receive x402"}</button>
                  <span className="t-ink3" style={{ fontSize: 12 }}>Gateway balance: {gwBal ?? "…"} USDC{usdcBal.data != null ? ` · wallet ${formatUnits(usdcBal.data as bigint, USDC_DECIMALS)}` : ""}</span>
                  {reg.done && reg.tx && <a className="pub-link" style={{ fontSize: 12 }} href={explorerTx(reg.tx)} target="_blank" rel="noreferrer">tx ↗</a>}
                </div>
                {reg.error && <p className="pub-note pub-note--danger">{reg.error}</p>}
              </div>
            </details>
          </section>

          {mounted && isConnected && !onArc && (
            <button onClick={() => switchChain({ chainId: arcTestnet.id })} className="pub-btn pub-btn--mars" style={{ alignSelf: "flex-start" }}>Switch to Arc Testnet</button>
          )}
        </div>
      </div>

      <style jsx global>{`
        :root {
          --space: #eef0f4;
          --cell: rgba(255, 255, 255, 0.78);
          --inset: #f1f3f7;
          --ink: #1b1d24;
          --ink-2: #565b66;
          --ink-3: #9498a2;
          --hair: rgba(0, 0, 0, 0.12);
          --hair-soft: rgba(0, 0, 0, 0.06);
          --mars: #c2542a;
          --safe: #1f9d63;
          --danger: #d23f2e;
          --warn: #b9780f;
          --comm: #2f6fd0;
          --sans: "Inter", system-ui, -apple-system, sans-serif;
          --code: "Geist Mono", ui-monospace, "SF Mono", monospace;
        }
        * { box-sizing: border-box; }
        html, body { margin: 0; }
        body {
          background: radial-gradient(120% 90% at 28% 12%, #ffffff 0%, var(--space) 62%);
          color: var(--ink);
          font-family: var(--sans);
          font-variant-numeric: tabular-nums;
          -webkit-font-smoothing: antialiased;
        }
        .pub-page { min-height: 100vh; }
        .pub-wrap { max-width: 600px; margin: 0 auto; padding: 28px 22px 64px; }
        .pub-header { display: flex; flex-wrap: wrap; align-items: center; justify-content: space-between; gap: 14px; padding-bottom: 18px; margin-bottom: 20px; border-bottom: 1px solid var(--hair); }
        .pub-h1 { margin: 0; font-size: 20px; font-weight: 700; letter-spacing: -0.01em; }
        .pub-sub { margin: 3px 0 0; max-width: 420px; font-size: 12.5px; line-height: 1.5; color: var(--ink-2); }
        .pub-col { display: flex; flex-direction: column; gap: 16px; }

        .pub-card { background: var(--cell); border: 1px solid var(--hair); border-radius: 16px; padding: 20px; backdrop-filter: blur(8px); }
        .pub-locked { opacity: 0.45; pointer-events: none; }
        .pub-field { display: flex; flex-direction: column; gap: 6px; }

        .pub-label { font-size: 11px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.07em; color: var(--ink-3); }
        .pub-code { font-family: var(--code); font-size: 12px; }
        .t-ink { color: var(--ink); } .t-ink2 { color: var(--ink-2); } .t-ink3 { color: var(--ink-3); }
        .t-mars { color: var(--mars); } .t-safe { color: var(--safe); } .t-danger { color: var(--danger); } .t-warn { color: var(--warn); } .t-comm { color: var(--comm); }
        .pub-link { color: var(--comm); } .pub-link:hover { text-decoration: underline; }

        .pub-input { background: #fff; border: 1px solid var(--hair); border-radius: 9px; padding: 9px 11px; font-size: 13px; color: var(--ink); font-family: var(--sans); outline: none; }
        .pub-input:focus { border-color: var(--comm); box-shadow: 0 0 0 3px rgba(47, 111, 208, 0.12); }
        .pub-range { accent-color: var(--mars); width: 100%; max-width: 320px; }

        .pub-btn { border: 1px solid transparent; border-radius: 10px; padding: 9px 16px; font-size: 13px; font-weight: 600; color: #fff; cursor: pointer; transition: filter 0.15s ease, background 0.15s ease; }
        .pub-btn:disabled { opacity: 0.4; cursor: default; }
        .pub-btn--mars { background: var(--mars); }
        .pub-btn--mars:hover:not(:disabled) { filter: brightness(1.08); }
        .pub-btn--ghost { background: #fff; color: var(--ink); border-color: var(--hair); }
        .pub-btn--ghost:hover:not(:disabled) { background: var(--inset); }
        .pub-publish { padding: 11px 22px; font-size: 14px; }

        .pub-steps { display: flex; flex-direction: column; gap: 7px; padding: 12px 14px; border-radius: 10px; background: var(--inset); }
        .pub-spin { width: 13px; height: 13px; border-radius: 999px; border: 2px solid rgba(47,111,208,0.25); border-top-color: var(--comm); animation: pubspin 0.7s linear infinite; }
        @keyframes pubspin { to { transform: rotate(360deg); } }

        .pub-note { border-radius: 10px; padding: 11px 13px; font-size: 13px; margin-top: 8px; }
        .pub-note--danger { background: rgba(210, 63, 46, 0.08); border: 1px solid rgba(210, 63, 46, 0.3); color: var(--danger); }
        .pub-note--safe { background: rgba(31, 157, 99, 0.1); border: 1px solid rgba(31, 157, 99, 0.32); color: var(--ink); }

        .pub-adv > summary { list-style: none; user-select: none; }
        .pub-adv > summary::-webkit-details-marker { display: none; }
        .pub-adv > summary::before { content: "▸ "; color: var(--ink-3); }
        .pub-adv[open] > summary::before { content: "▾ "; }

        .pub-step { display: flex; align-items: center; justify-content: center; height: 24px; width: 24px; border-radius: 999px; font-size: 12px; font-weight: 700; flex: none; }
        .pub-step--done { background: var(--safe); color: #fff; }
        .pub-step--idle { background: var(--inset); color: var(--ink-3); border: 1px solid var(--hair); }
      `}</style>
    </div>
  );
}

function StepHead({ n, title, done }: { n: number; title: string; done?: boolean }) {
  return (
    <div className="mb-3 flex items-center gap-2">
      <span className={`pub-step ${done ? "pub-step--done" : "pub-step--idle"}`}>{done ? "✓" : n}</span>
      <p className="t-ink" style={{ fontSize: 15, fontWeight: 600 }}>{title}</p>
    </div>
  );
}
