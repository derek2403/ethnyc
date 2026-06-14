// pages/publish.tsx — AUTHOR flow: publish a PREMIUM, royalty-bearing skill.
//
//   1 · Verify you're human          (World ID — gates the whole flow)
//   2 · Connect your Arc wallet      (RainbowKit; = escrow developer = x402 royalty payee)
//        + Hedera account id          (= the on-chain CustomRoyaltyFee collector)
//   3 · Describe the skill + terms   (skill ref · audit fee · bond · royalty %)
//   4 · Fund the audit ON-CHAIN      (MarsEscrow: approve → createJob → fundFee → postBond)
//   5 · Run the real audit           (/api/hedera createTask → runAudit, 4-stage pipeline)
//   6 · Settle + publish (on SAFE)   (escrow release + VERIFIED NFT + premium license w/ royalty)
//
// On a clean verdict the skill is listed as PREMIUM: every later per-use purchase pays the
// author a royalty on BOTH rails — Arc x402 split (buyer pays the escrow developer = author)
// and a Hedera license NFT carrying a real CustomRoyaltyFee.
/* eslint-disable @typescript-eslint/no-explicit-any */
import { useCallback, useEffect, useState } from "react";
import Head from "next/head";
import { ConnectButton } from "@rainbow-me/rainbowkit";
import {
  useAccount,
  useChainId,
  usePublicClient,
  useReadContract,
  useSwitchChain,
  useWaitForTransactionReceipt,
  useWriteContract,
} from "wagmi";
import { formatUnits, parseUnits } from "viem";
import WorldIdVerification from "@/components/WorldIdVerification";
import {
  ESCROW_ABI,
  ESCROW_ADDRESS,
  GATEWAY_WALLET,
  GATEWAY_WALLET_ABI,
  STATUS_LABELS,
  USDC_ABI,
  USDC_ADDRESS,
  USDC_DECIMALS,
  arcTestnet,
  explorerAddress,
  explorerTx,
} from "@/lib/escrow";

const APP_ID = process.env.NEXT_PUBLIC_WORLD_APP_ID as `app_${string}` | undefined;
const RP_ID = process.env.NEXT_PUBLIC_RP_ID;

const API = "/api/hedera";
const short = (a?: string) => (a ? `${a.slice(0, 6)}…${a.slice(-4)}` : "—");
const fmt = (v?: bigint) => (v == null ? "—" : formatUnits(v, USDC_DECIMALS));
const hashscan = (kind: "account" | "token" | "topic", id: string) =>
  `https://hashscan.io/testnet/${kind}/${id}`;

async function call(body: Record<string, any>): Promise<any> {
  const res = await fetch(API, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
  return res.json();
}

const DEMO_SKILLS = [
  { ref: "safe-weather-skill", label: "safe-weather-skill (SAFE · read-only weather)" },
  { ref: "price-checker.js", label: "price-checker.js (SAFE · price oracle)" },
  { ref: "portfolio-helper.js", label: "portfolio-helper.js (SAFE · portfolio)" },
  { ref: "poisoned-pdf-skill", label: "poisoned-pdf-skill (DANGEROUS · for testing)" },
];

type Stage = { stage: string; status: string; summary: string };
type AuditResult = {
  verdict: "SAFE" | "DANGEROUS";
  risk: string;
  trustScore: number;
  summary: string;
  capabilities: string[];
  recommendation: string;
  stages: Stage[];
  taskTopicId: string;
  skillRef: string;
  skill: string;
};

export default function Publish() {
  // avoid SSR/hydration mismatch from wallet state
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  // ── step 1 · World ID ──────────────────────────────────────────────
  const [verified, setVerified] = useState(false);
  const [humanId, setHumanId] = useState<string | null>(null);
  const [worldStatus, setWorldStatus] = useState("");
  const worldConfigured = Boolean(APP_ID && RP_ID);

  // ── step 2 · wallet + identity ─────────────────────────────────────
  const { address, isConnected } = useAccount();
  const chainId = useChainId();
  const { switchChain } = useSwitchChain();
  const onArc = chainId === arcTestnet.id;
  const publicClient = usePublicClient();
  const [hederaId, setHederaId] = useState("");
  const [agent, setAgent] = useState<{ address?: string } | null>(null);
  const [agentErr, setAgentErr] = useState<string | null>(null);
  const [gwBal, setGwBal] = useState<string | null>(null);
  const [reg, setReg] = useState<{ busy?: boolean; error?: string; done?: boolean; tx?: string }>({});
  const [regAmt, setRegAmt] = useState("0.2");

  // ── step 3 · terms ─────────────────────────────────────────────────
  const [skillRef, setSkillRef] = useState(DEMO_SKILLS[0].ref);
  const [fee, setFee] = useState("1");
  const [bond, setBond] = useState("0.5");
  const [royalty, setRoyalty] = useState(10); // author royalty %
  const [price] = useState("0.01"); // per-use price (USDC) — what buyers pay

  // ── step 4 · escrow ────────────────────────────────────────────────
  const [jobId, setJobId] = useState(0);
  const [pendingJobId, setPendingJobId] = useState<number | null>(null);
  const [lastAction, setLastAction] = useState("");
  const [loggedHash, setLoggedHash] = useState<string | undefined>();
  const [bondBusy, setBondBusy] = useState(false);
  const [flowMsg, setFlowMsg] = useState<string | null>(null);
  const [log, setLog] = useState<{ action: string; hash: string; ok: boolean }[]>([]);

  // ── step 5/6 · audit + publish ─────────────────────────────────────
  const [registryTopicId, setRegistryTopicId] = useState("");
  const [audit, setAudit] = useState<AuditResult | null>(null);
  const [auditing, setAuditing] = useState(false);
  const [published, setPublished] = useState<any>(null);
  const [publishing, setPublishing] = useState(false);

  // ── reads ──────────────────────────────────────────────────────────
  const usdcBal = useReadContract({ address: USDC_ADDRESS, abi: USDC_ABI, functionName: "balanceOf", args: address ? [address] : undefined, query: { enabled: !!address } });
  const escrowBal = useReadContract({ address: USDC_ADDRESS, abi: USDC_ABI, functionName: "balanceOf", args: [ESCROW_ADDRESS] });
  const allowance = useReadContract({ address: USDC_ADDRESS, abi: USDC_ABI, functionName: "allowance", args: address ? [address, ESCROW_ADDRESS] : undefined, query: { enabled: !!address } });
  const nextJobId = useReadContract({ address: ESCROW_ADDRESS, abi: ESCROW_ABI, functionName: "nextJobId" });
  const job = useReadContract({ address: ESCROW_ADDRESS, abi: ESCROW_ABI, functionName: "getJob", args: jobId ? [BigInt(jobId)] : undefined, query: { enabled: jobId > 0 } });
  const jobData = job.data as { developer: string; auditor: string; fee: bigint; bond: bigint; feeFunded: boolean; bondPosted: boolean; status: number } | undefined;

  const refetchAll = () => { usdcBal.refetch(); escrowBal.refetch(); allowance.refetch(); nextJobId.refetch(); if (jobId) job.refetch(); };

  // ── writes ─────────────────────────────────────────────────────────
  const { writeContract, data: hash, isPending, error: writeError } = useWriteContract();
  const { writeContractAsync } = useWriteContract();
  const { data: receipt, isLoading: confirming, error: receiptError } = useWaitForTransactionReceipt({ hash });
  const busy = isPending || confirming;

  useEffect(() => {
    if (receipt && hash && hash !== loggedHash) {
      setLoggedHash(hash);
      setLog((l) => [{ action: lastAction, hash, ok: receipt.status === "success" }, ...l].slice(0, 30));
      refetchAll();
      if (receipt.status === "success" && pendingJobId != null) {
        setJobId(pendingJobId);
        setPendingJobId(null);
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [receipt, hash]);

  const amt = (v: string) => parseUnits(v || "0", USDC_DECIMALS);
  const allowanceNum = Number(formatUnits((allowance.data as bigint) ?? 0n, USDC_DECIMALS));
  const errMsg =
    (writeError as { shortMessage?: string } | null)?.shortMessage ||
    (receiptError as { shortMessage?: string } | null)?.shortMessage || "";

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

  // ensure the seeded main HCS registry (idempotent) so jobs index into it
  useEffect(() => {
    (async () => { const r = await call({ action: "initMars" }); if (r?.registryTopicId) setRegistryTopicId(r.registryTopicId); })();
  }, []);

  // ── escrow actions (mirror /test) ──────────────────────────────────
  const doApprove = () => { setLastAction("approve"); setFlowMsg(null); writeContract({ address: USDC_ADDRESS, abi: USDC_ABI, functionName: "approve", args: [ESCROW_ADDRESS, amt("1000")] }); };
  const doCreate = () => {
    if (!address) return;
    if (!agent?.address) { setFlowMsg(`auditor agent unavailable — ${agentErr ?? "set ARC_PRIVATE_KEY in hardhat/.env or .env.local, then restart"}`); return; }
    setFlowMsg(null);
    setPendingJobId(Number(nextJobId.data ?? 1n));
    setLastAction("createJob");
    // developer = you (author) · auditor = the MARS agent
    writeContract({ address: ESCROW_ADDRESS, abi: ESCROW_ABI, functionName: "createJob", args: [address, agent.address as `0x${string}`, amt(fee), amt(bond)] });
  };
  const doFund = () => { setFlowMsg(null); setLastAction("fundFee"); writeContract({ address: ESCROW_ADDRESS, abi: ESCROW_ABI, functionName: "fundFee", args: [BigInt(jobId)] }); };
  const doBond = async () => {
    if (!jobId) return;
    setBondBusy(true); setFlowMsg(null);
    try {
      const r = await fetch("/api/agent-post-bond", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ jobId }) });
      const d = await r.json();
      if (!r.ok || !d.ok) { setFlowMsg(d.error || "post bond failed"); return; }
      setLog((l) => [{ action: "postBond (agent)", hash: d.tx, ok: true }, ...l].slice(0, 30));
      refetchAll();
    } catch (e) { setFlowMsg(String(e)); } finally { setBondBusy(false); }
  };

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
    } catch (e) { const err = e as { shortMessage?: string; message?: string }; setReg({ error: err.shortMessage || err.message || "register failed" }); }
  };

  // ── step 5 · run the real audit (Hedera) ───────────────────────────
  const runAudit = async () => {
    setAuditing(true); setAudit(null); setFlowMsg(null);
    try {
      const sel = DEMO_SKILLS.find((s) => s.ref === skillRef);
      const skill = (sel?.ref || skillRef).replace(/\.(js|json|md)$/i, "");
      const created = await call({ action: "createTask", skillRef, skill, requester: hederaId || "author", auditor: "mars-premium-auditor", price: `${price} USDC`, registryTopicId });
      if (created.error || !created.taskTopicId) { setFlowMsg(created.error || "createTask failed"); return; }
      const result = await call({ action: "runAudit", taskTopicId: created.taskTopicId, skillRef, registryTopicId });
      if (result.error) { setFlowMsg(result.error); return; }
      setAudit({
        verdict: result.verdict, risk: result.risk, trustScore: result.trustScore,
        summary: result.summary, capabilities: result.capabilities || [], recommendation: result.recommendation,
        stages: result.stages || [], taskTopicId: created.taskTopicId, skillRef, skill,
      });
    } catch (e) { setFlowMsg(String(e)); } finally { setAuditing(false); }
  };

  // ── step 6 · settle escrow on-chain + publish premium (Hedera) ─────
  const publish = async () => {
    if (!audit || audit.verdict !== "SAFE" || !jobId) return;
    setPublishing(true); setFlowMsg(null);
    try {
      // 6a · release the escrow on-chain (fee + bond → auditor) — "clean audit paid"
      if (jobData?.status === 2 /* Funded */) {
        const releaseHash = await writeContractAsync({ address: ESCROW_ADDRESS, abi: ESCROW_ABI, functionName: "release", args: [BigInt(jobId)] });
        await publicClient!.waitForTransactionReceipt({ hash: releaseHash });
        setLog((l) => [{ action: "release", hash: releaseHash, ok: true }, ...l].slice(0, 30));
        refetchAll();
      }
      // 6b · mint VERIFIED NFT + premium license (CustomRoyaltyFee) + register premium skill
      const r = await call({
        action: "publishPremiumSkill",
        taskTopicId: audit.taskTopicId,
        skill: audit.skill,
        skillRef: audit.skillRef,
        verdict: "SAFE",
        author: { hederaId, evm: address, humanId },
        royaltyPct: royalty,
        price: `${price} USDC`,
        escrowJobId: jobId,
        registryTopicId,
      });
      if (r.error) { setFlowMsg(r.error); return; }
      setPublished(r);
    } catch (e) { const err = e as { shortMessage?: string; message?: string }; setFlowMsg(err.shortMessage || err.message || String(e)); } finally { setPublishing(false); }
  };

  // ── gating ─────────────────────────────────────────────────────────
  const step1Done = verified;
  const step2Done = step1Done && isConnected && onArc && /^0\.0\.\d+$/.test(hederaId);
  const funded = jobData?.status === 2 || jobData?.status === 3;
  const settled = jobData?.status === 3;

  // ── styles ─────────────────────────────────────────────────────────
  const card = "rounded-xl border border-zinc-800 bg-zinc-950/60 p-4";
  const label = "text-xs uppercase tracking-wide text-zinc-500";
  const input = "rounded-md border border-zinc-700 bg-zinc-900 px-2 py-1.5 text-sm text-zinc-100 outline-none focus:border-indigo-500";

  return (
    <div className="min-h-screen bg-black px-6 py-10 font-sans text-zinc-100">
      <Head><title>MARS · publish a premium skill</title></Head>
      <div className="mx-auto grid max-w-6xl grid-cols-1 gap-5 lg:grid-cols-3">
        <header className="flex flex-wrap items-start justify-between gap-3 lg:col-span-3">
          <div>
            <h1 className="text-2xl font-semibold">Publish a Premium Skill</h1>
            <p className="mt-1 max-w-2xl text-sm text-zinc-400">
              Verify you&apos;re human, fund the audit on-chain (Arc escrow), and on a clean verdict your skill is
              minted VERIFIED on Hedera with a real author <strong>royalty</strong> — every later use pays you a cut
              on both rails (Arc x402 split + Hedera CustomRoyaltyFee).
            </p>
          </div>
          {mounted && <ConnectButton />}
        </header>

        {mounted && isConnected && !onArc && (
          <div className="flex items-center justify-between rounded-xl border border-amber-700/50 bg-amber-900/20 p-4 text-sm text-amber-200 lg:col-span-3">
            <span>Wrong network — switch to Arc Testnet ({arcTestnet.id}).</span>
            <button onClick={() => switchChain({ chainId: arcTestnet.id })} className="rounded-md bg-amber-600 px-3 py-1.5 font-medium text-white hover:bg-amber-500">Switch to Arc</button>
          </div>
        )}

        {/* LEFT — the flow */}
        <main className="flex flex-col gap-5 lg:col-span-2">
          {/* 1 · World ID */}
          <div className={card}>
            <StepHead n={1} title="Verify you're human (World ID)" done={step1Done} />
            {verified ? (
              <p className="text-sm text-emerald-300">✓ Verified as a unique human{humanId ? ` · ${short(humanId)}` : ""}.</p>
            ) : worldConfigured ? (
              <div className="[&_*]:!text-zinc-200">
                <WorldIdVerification
                  verified={verified}
                  setVerified={setVerified}
                  setStatus={setWorldStatus}
                  appId={APP_ID!}
                  rpId={RP_ID!}
                  onVerified={(d) => setHumanId(d?.onchain?.nullifier ?? null)}
                />
                {worldStatus && <p className="mt-2 text-xs text-zinc-400">{worldStatus}</p>}
              </div>
            ) : (
              <div className="text-sm text-amber-300">
                World ID not configured (set <code>NEXT_PUBLIC_WORLD_APP_ID</code> / <code>NEXT_PUBLIC_RP_ID</code>).
                <button onClick={() => setVerified(true)} className="ml-3 rounded-md bg-zinc-700 px-3 py-1.5 text-xs text-white hover:bg-zinc-600">Skip (dev)</button>
              </div>
            )}
          </div>

          {/* 2 · wallet + hedera id */}
          <div className={`${card} ${!step1Done ? "pointer-events-none opacity-40" : ""}`}>
            <StepHead n={2} title="Connect your wallet + payout identity" done={step2Done} />
            {!isConnected ? (
              <p className="text-sm text-zinc-400">Connect a wallet (top-right). Need test USDC? <a className="text-indigo-400 hover:underline" href="https://faucet.circle.com" target="_blank" rel="noreferrer">faucet.circle.com</a> (Arc Testnet).</p>
            ) : (
              <div className="flex flex-col gap-3">
                <div className="text-xs text-zinc-500">Arc wallet (escrow developer · x402 royalty payee): <span className="font-mono text-zinc-300">{short(address)}</span></div>
                <div className="flex flex-wrap items-center gap-2">
                  <span className={label}>Hedera account id</span>
                  <input className={`${input} w-44`} placeholder="0.0.xxxxx" value={hederaId} onChange={(e) => setHederaId(e.target.value.trim())} />
                  <span className="text-xs text-zinc-500">= the on-chain CustomRoyaltyFee collector</span>
                </div>
                <div className="flex flex-wrap items-center gap-3 border-t border-zinc-800 pt-3">
                  <span className={label}>Gateway (to receive x402)</span>
                  <input className={`${input} w-20`} value={regAmt} onChange={(e) => setRegAmt(e.target.value)} />
                  <button onClick={registerGateway} disabled={reg.busy || !onArc} className="rounded-md bg-sky-600 px-3 py-2 text-sm font-medium text-white transition hover:bg-sky-500 disabled:opacity-40">{reg.busy ? "registering…" : "Register / deposit"}</button>
                  <span className="text-sm text-zinc-400">balance: <span className="text-zinc-100">{gwBal ?? "…"}</span> USDC</span>
                  {reg.done && reg.tx && <a className="text-xs text-indigo-400 hover:underline" href={explorerTx(reg.tx)} target="_blank" rel="noreferrer">tx ↗</a>}
                </div>
                {reg.error && <p className="rounded-md border border-rose-800/50 bg-rose-900/30 p-2 text-xs text-rose-300">{reg.error}</p>}
              </div>
            )}
          </div>

          {/* 3 · terms */}
          <div className={`${card} ${!step2Done ? "pointer-events-none opacity-40" : ""}`}>
            <StepHead n={3} title="Describe the skill + premium terms" done={!!jobId} />
            <div className="flex flex-col gap-3">
              <div className="flex flex-col gap-1">
                <span className={label}>Skill</span>
                <select className={`${input} w-full`} value={skillRef} onChange={(e) => setSkillRef(e.target.value)}>
                  {DEMO_SKILLS.map((s) => <option key={s.ref} value={s.ref}>{s.label}</option>)}
                </select>
              </div>
              <div className="flex flex-wrap items-end gap-4">
                <div className="flex flex-col gap-1"><span className={label}>Audit fee (USDC)</span><input className={`${input} w-24`} value={fee} onChange={(e) => setFee(e.target.value)} /></div>
                <div className="flex flex-col gap-1"><span className={label}>Auditor bond (USDC)</span><input className={`${input} w-24`} value={bond} onChange={(e) => setBond(e.target.value)} /></div>
                <div className="flex min-w-[14rem] flex-col gap-1">
                  <span className={label}>Author royalty <span className="text-fuchsia-300">{royalty}%</span> per use</span>
                  <input type="range" min={1} max={50} value={royalty} onChange={(e) => setRoyalty(Number(e.target.value))} className="accent-fuchsia-500" />
                </div>
              </div>
            </div>
          </div>

          {/* 4 · on-chain escrow */}
          <div className={`${card} ${!step2Done ? "pointer-events-none opacity-40" : ""}`}>
            <StepHead n={4} title="Fund the audit on-chain (MarsEscrow · Arc)" done={!!funded} />
            <div className="flex flex-wrap items-center gap-3">
              <Btn onClick={doApprove} tone="zinc" disabled={busy || !onArc}>Approve USDC</Btn>
              <Btn onClick={doCreate} disabled={busy || !onArc || allowanceNum <= 0}>Create job</Btn>
              <Btn onClick={doFund} disabled={busy || !jobId || !onArc}>Fund fee (you)</Btn>
              <button onClick={doBond} disabled={!jobId || bondBusy} className="rounded-md bg-indigo-600 px-3 py-2 text-sm font-medium text-white transition hover:bg-indigo-500 disabled:opacity-40">{bondBusy ? "agent posting…" : "Post bond (agent)"}</button>
            </div>
            <p className="mt-2 text-xs text-zinc-500">developer = you · auditor = MARS agent {agent?.address ? short(agent.address) : agentErr ? <span className="text-amber-400">unavailable</span> : "…"} · fee + bond lock in escrow, released to the auditor on a clean verdict.</p>
            {agentErr && !agent?.address && <p className="mt-1 text-xs text-amber-400">Auditor agent wallet not loaded: {agentErr} — set <code>ARC_PRIVATE_KEY</code> in <code>hardhat/.env</code> or <code>.env.local</code>, then restart the dev server.</p>}
            {jobData && jobId > 0 && (
              <div className="mt-3 grid grid-cols-2 gap-3 text-sm sm:grid-cols-4">
                <Stat k="Job">#{jobId}</Stat>
                <Stat k="Status"><Badge label={STATUS_LABELS[jobData.status] ?? "Unknown"} /></Stat>
                <Stat k="Fee funded">{jobData.feeFunded ? "✅" : "—"}</Stat>
                <Stat k="Bond posted">{jobData.bondPosted ? "✅" : "—"}</Stat>
              </div>
            )}
            {allowanceNum <= 0 && jobId === 0 && <p className="mt-2 text-xs text-amber-400">Approve USDC first so the escrow can pull your fee.</p>}
            {flowMsg && <p className="mt-2 rounded-md border border-rose-800/50 bg-rose-900/30 p-2 text-xs text-rose-300">{flowMsg}</p>}
            {errMsg && <p className="mt-2 rounded-md border border-rose-800/50 bg-rose-900/30 p-2 text-xs text-rose-300">{errMsg}</p>}
          </div>

          {/* 5 · run audit */}
          <div className={`${card} ${!funded ? "pointer-events-none opacity-40" : ""}`}>
            <StepHead n={5} title="Run the audit (real 4-stage pipeline · Hedera HCS)" done={!!audit} />
            <Btn onClick={runAudit} tone="indigo" disabled={auditing || !funded}>{auditing ? "auditing…" : "Run audit"}</Btn>
            {audit && (
              <div className="mt-3 flex flex-col gap-2">
                <ul className="flex flex-col gap-1 text-sm">
                  {audit.stages.map((s, i) => (
                    <li key={i} className="flex items-start gap-2">
                      <span className={s.status === "fail" ? "text-rose-400" : s.status === "warn" ? "text-amber-400" : "text-emerald-400"}>{s.status === "fail" ? "✗" : s.status === "warn" ? "!" : "✓"}</span>
                      <span className="text-zinc-300"><span className="font-medium text-zinc-100">{s.stage}</span> — {s.summary}</span>
                    </li>
                  ))}
                </ul>
                <div className={`rounded-md border p-2 text-sm ${audit.verdict === "SAFE" ? "border-emerald-800/50 bg-emerald-900/20 text-emerald-300" : "border-rose-800/50 bg-rose-900/30 text-rose-300"}`}>
                  Verdict: <strong>{audit.verdict}</strong> · risk {audit.risk} · trust {audit.trustScore}
                  {audit.summary && <p className="mt-1 text-zinc-300">{audit.summary}</p>}
                </div>
                <a className="text-xs text-indigo-400 hover:underline" href={hashscan("topic", audit.taskTopicId)} target="_blank" rel="noreferrer">audit trail on Hashscan ↗</a>
              </div>
            )}
          </div>

          {/* 6 · settle + publish */}
          <div className={`${card} ${!audit || audit.verdict !== "SAFE" ? "pointer-events-none opacity-40" : ""}`}>
            <StepHead n={6} title="Settle escrow + publish premium (on SAFE)" done={!!published} />
            {!published ? (
              <>
                <Btn onClick={publish} tone="fuchsia" disabled={publishing || !audit || audit.verdict !== "SAFE"}>{publishing ? "publishing…" : `Release escrow + publish (royalty ${royalty}%)`}</Btn>
                <p className="mt-2 text-xs text-zinc-500">Releases fee + bond to the auditor{settled ? " (already released)" : ""}, mints the Hedera VERIFIED NFT, and creates a premium license NFT carrying your CustomRoyaltyFee.</p>
              </>
            ) : (
              <div className="flex flex-col gap-2 rounded-md border border-emerald-800/50 bg-emerald-900/20 p-3 text-sm">
                <p className="text-emerald-300">✓ Published <strong>{published.skill}</strong> as a premium skill — royalty {published.royaltyPct}% to {short(hederaId)}.</p>
                {published.verified?.tokenId && <p className="text-zinc-300">VERIFIED NFT: <a className="font-mono text-indigo-400 hover:underline" href={hashscan("token", published.verified.tokenId)} target="_blank" rel="noreferrer">{published.verified.tokenId}#{published.verified.serial} ↗</a></p>}
                {published.license?.tokenId && (
                  <p className="text-zinc-300">Premium license (royalty): <a className="font-mono text-fuchsia-400 hover:underline" href={hashscan("token", published.license.tokenId)} target="_blank" rel="noreferrer">{published.license.tokenId} ↗</a>
                    {published.license.royalty && <span className="text-zinc-500"> · {published.license.royalty.numerator}/{published.license.royalty.denominator} → {short(published.license.royalty.collector)}</span>}
                  </p>
                )}
                <p className="border-t border-zinc-800 pt-2 text-zinc-400">
                  Buyers pay <span className="text-zinc-200">{price} USDC</span> per use on the <a className="text-indigo-400 hover:underline" href={`/test`}>marketplace</a> (job #{jobId}); {royalty}% routes to you as royalty (x402 split + Hedera custom-fee).
                </p>
              </div>
            )}
          </div>
        </main>

        {/* RIGHT — live sidebar */}
        <aside className="lg:col-span-1">
          <div className="flex flex-col gap-5 lg:sticky lg:top-6">
            <div className={card}>
              <div className="mb-3 flex items-center justify-between">
                <span className={label}>Live · balances</span>
                <button onClick={() => { refetchAll(); fetchGwBal(); }} className="rounded-md bg-zinc-700 px-3 py-1.5 text-xs text-white hover:bg-zinc-600">Refresh</button>
              </div>
              <div className="grid grid-cols-2 gap-3 text-sm">
                <Stat k="Your USDC">{fmt(usdcBal.data as bigint)}</Stat>
                <Stat k="Gateway">{gwBal ?? "…"}</Stat>
                <Stat k="Allowance">{fmt(allowance.data as bigint)}</Stat>
                <Stat k="Escrow holds">{fmt(escrowBal.data as bigint)}</Stat>
                <Stat k="Active job">#{jobId || "—"}</Stat>
                <Stat k="Next id">{Number(nextJobId.data ?? 1n)}</Stat>
              </div>
              {isConnected && address && <p className="mt-3 text-xs text-zinc-500">You: <a className="text-indigo-400 hover:underline" href={explorerAddress(address)} target="_blank" rel="noreferrer">{short(address)}</a></p>}
            </div>

            <div className={card}>
              <p className="mb-2 text-sm font-medium text-zinc-300">Progress</p>
              <ul className="flex flex-col gap-1.5 text-sm">
                <Track done={step1Done}>Human verified</Track>
                <Track done={step2Done}>Wallet + Hedera id</Track>
                <Track done={!!jobId}>Escrow job created</Track>
                <Track done={!!funded}>Fee + bond funded</Track>
                <Track done={!!audit}>Audit run{audit ? ` (${audit.verdict})` : ""}</Track>
                <Track done={!!published}>Published premium</Track>
              </ul>
            </div>

            <div className={card}>
              <p className="mb-2 text-sm font-medium text-zinc-300">Activity</p>
              <ul className="flex flex-col gap-1.5 text-sm">
                {log.length === 0 && <li className="text-zinc-600">no txs yet</li>}
                {log.map((l, i) => (
                  <li key={i} className="flex items-center gap-2">
                    <span className={l.ok ? "text-emerald-400" : "text-rose-400"}>{l.ok ? "✓" : "✕"}</span>
                    <span className="text-zinc-300">{l.action}</span>
                    {l.hash && <a className="text-indigo-400 hover:underline" href={explorerTx(l.hash)} target="_blank" rel="noreferrer">tx ↗</a>}
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </aside>
      </div>
    </div>
  );
}

const BTN_TONES: Record<string, string> = {
  indigo: "bg-indigo-600 hover:bg-indigo-500",
  green: "bg-emerald-600 hover:bg-emerald-500",
  zinc: "bg-zinc-700 hover:bg-zinc-600",
  fuchsia: "bg-fuchsia-600 hover:bg-fuchsia-500",
};
function Btn({ onClick, children, tone = "indigo", disabled }: { onClick: () => void; children: React.ReactNode; tone?: string; disabled?: boolean }) {
  return (
    <button onClick={onClick} disabled={disabled} className={`rounded-md px-3 py-2 text-sm font-medium text-white transition disabled:opacity-40 ${BTN_TONES[tone]}`}>
      {children}
    </button>
  );
}

function StepHead({ n, title, done }: { n: number; title: string; done?: boolean }) {
  return (
    <div className="mb-3 flex items-center gap-2">
      <span className={`flex h-6 w-6 items-center justify-center rounded-full text-xs font-bold ${done ? "bg-emerald-600 text-white" : "bg-zinc-800 text-zinc-400"}`}>{done ? "✓" : n}</span>
      <p className="text-sm font-medium text-zinc-200">{title}</p>
    </div>
  );
}

function Stat({ k, children }: { k: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-0.5">
      <span className="text-xs uppercase tracking-wide text-zinc-500">{k}</span>
      <span className="font-medium text-zinc-100">{children}</span>
    </div>
  );
}

function Track({ done, children }: { done?: boolean; children: React.ReactNode }) {
  return (
    <li className="flex items-center gap-2">
      <span className={done ? "text-emerald-400" : "text-zinc-600"}>{done ? "✓" : "○"}</span>
      <span className={done ? "text-zinc-200" : "text-zinc-500"}>{children}</span>
    </li>
  );
}

function Badge({ label }: { label: string }) {
  const map: Record<string, string> = {
    Open: "bg-amber-500/20 text-amber-300",
    Funded: "bg-indigo-500/20 text-indigo-300",
    Settled: "bg-emerald-500/20 text-emerald-300",
    Slashed: "bg-rose-500/20 text-rose-300",
    None: "bg-zinc-700/40 text-zinc-400",
  };
  return <span className={`rounded px-2 py-0.5 text-xs font-semibold ${map[label] ?? map.None}`}>{label}</span>;
}
