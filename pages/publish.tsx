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
//
// Visual language follows pages/page1.tsx: soft light "analytics" theme, Inter type, the
// shared design tokens (--cell / --ink / --hair / --mars / --safe …) declared once below.
/* eslint-disable @typescript-eslint/no-explicit-any */
import { useCallback, useEffect, useState } from "react";
import Head from "next/head";
import Link from "next/link";
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

  return (
    <div className="pub-page">
      <Head>
        <title>MARS · publish a premium skill</title>
      </Head>

      <div className="pub-wrap">
        <header className="pub-header">
          <div className="flex items-center gap-3">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/logo.svg" alt="MARS" style={{ height: 30, width: "auto", display: "block" }} />
            <div>
              <h1 className="pub-h1">Publish a Premium Skill</h1>
              <p className="pub-sub">
                Verify you&apos;re human, fund the audit on-chain (Arc escrow), and on a clean verdict your skill is minted
                VERIFIED on Hedera with a real author <strong style={{ color: "var(--mars)" }}>royalty</strong> — every later
                use pays you a cut on both rails (Arc x402 split + Hedera CustomRoyaltyFee).
              </p>
            </div>
          </div>
          {mounted && <ConnectButton />}
        </header>

        {mounted && isConnected && !onArc && (
          <div className="pub-banner pub-banner--warn">
            <span>Wrong network — switch to Arc Testnet ({arcTestnet.id}).</span>
            <button onClick={() => switchChain({ chainId: arcTestnet.id })} className="pub-btn pub-btn--mars">Switch to Arc</button>
          </div>
        )}

        <div className="pub-grid">
          {/* LEFT — the flow */}
          <main className="flex flex-col gap-4">
            {/* 1 · World ID */}
            <section className="pub-card">
              <StepHead n={1} title="Verify you're human (World ID)" done={step1Done} />
              {verified ? (
                <p className="t-safe" style={{ fontSize: 13 }}>✓ Verified as a unique human{humanId ? ` · ${short(humanId)}` : ""}.</p>
              ) : worldConfigured ? (
                <div>
                  <WorldIdVerification
                    verified={verified}
                    setVerified={setVerified}
                    setStatus={setWorldStatus}
                    appId={APP_ID!}
                    rpId={RP_ID!}
                    onVerified={(d) => setHumanId(d?.onchain?.nullifier ?? null)}
                  />
                  {worldStatus && <p className="t-ink3 mt-2" style={{ fontSize: 12 }}>{worldStatus}</p>}
                </div>
              ) : (
                <div className="t-warn" style={{ fontSize: 13 }}>
                  World ID not configured (set <code className="pub-code">NEXT_PUBLIC_WORLD_APP_ID</code> / <code className="pub-code">NEXT_PUBLIC_RP_ID</code>).
                  <button onClick={() => setVerified(true)} className="pub-btn pub-btn--ghost ml-3" style={{ padding: "5px 10px", fontSize: 12 }}>Skip (dev)</button>
                </div>
              )}
            </section>

            {/* 2 · wallet + hedera id */}
            <section className={`pub-card ${!step1Done ? "pub-locked" : ""}`}>
              <StepHead n={2} title="Connect your wallet + payout identity" done={step2Done} />
              {!isConnected ? (
                <p className="t-ink2" style={{ fontSize: 13 }}>Connect a wallet (top-right). Need test USDC? <a className="pub-link" href="https://faucet.circle.com" target="_blank" rel="noreferrer">faucet.circle.com</a> (Arc Testnet).</p>
              ) : (
                <div className="flex flex-col gap-3">
                  <div className="t-ink3" style={{ fontSize: 12 }}>Arc wallet (escrow developer · x402 royalty payee): <span className="pub-code t-ink">{short(address)}</span></div>
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="pub-label">Hedera account id</span>
                    <input className="pub-input" style={{ width: 176 }} placeholder="0.0.xxxxx" value={hederaId} onChange={(e) => setHederaId(e.target.value.trim())} />
                    <span className="t-ink3" style={{ fontSize: 12 }}>= the on-chain CustomRoyaltyFee collector</span>
                  </div>
                  <div className="flex flex-wrap items-center gap-3" style={{ borderTop: "1px solid var(--hair-soft)", paddingTop: 12 }}>
                    <span className="pub-label">Gateway (to receive x402)</span>
                    <input className="pub-input" style={{ width: 80 }} value={regAmt} onChange={(e) => setRegAmt(e.target.value)} />
                    <button onClick={registerGateway} disabled={reg.busy || !onArc} className="pub-btn pub-btn--comm">{reg.busy ? "registering…" : "Register / deposit"}</button>
                    <span className="t-ink2" style={{ fontSize: 13 }}>balance: <span className="t-ink">{gwBal ?? "…"}</span> USDC</span>
                    {reg.done && reg.tx && <a className="pub-link" style={{ fontSize: 12 }} href={explorerTx(reg.tx)} target="_blank" rel="noreferrer">tx ↗</a>}
                  </div>
                  {reg.error && <p className="pub-note pub-note--danger">{reg.error}</p>}
                </div>
              )}
            </section>

            {/* 3 · terms */}
            <section className={`pub-card ${!step2Done ? "pub-locked" : ""}`}>
              <StepHead n={3} title="Describe the skill + premium terms" done={!!jobId} />
              <div className="flex flex-col gap-3">
                <div className="flex flex-col gap-1">
                  <span className="pub-label">Skill</span>
                  <select className="pub-input" style={{ width: "100%" }} value={skillRef} onChange={(e) => setSkillRef(e.target.value)}>
                    {DEMO_SKILLS.map((s) => <option key={s.ref} value={s.ref}>{s.label}</option>)}
                  </select>
                </div>
                <div className="flex flex-wrap items-end gap-4">
                  <div className="flex flex-col gap-1"><span className="pub-label">Audit fee (USDC)</span><input className="pub-input" style={{ width: 96 }} value={fee} onChange={(e) => setFee(e.target.value)} /></div>
                  <div className="flex flex-col gap-1"><span className="pub-label">Auditor bond (USDC)</span><input className="pub-input" style={{ width: 96 }} value={bond} onChange={(e) => setBond(e.target.value)} /></div>
                  <div className="flex min-w-[14rem] flex-col gap-1">
                    <span className="pub-label">Author royalty <span className="t-mars" style={{ fontWeight: 700 }}>{royalty}%</span> per use</span>
                    <input type="range" min={1} max={50} value={royalty} onChange={(e) => setRoyalty(Number(e.target.value))} className="pub-range" />
                  </div>
                </div>
              </div>
            </section>

            {/* 4 · on-chain escrow */}
            <section className={`pub-card ${!step2Done ? "pub-locked" : ""}`}>
              <StepHead n={4} title="Fund the audit on-chain (MarsEscrow · Arc)" done={!!funded} />
              <div className="flex flex-wrap items-center gap-2">
                <Btn onClick={doApprove} tone="ghost" disabled={busy || !onArc}>Approve USDC</Btn>
                <Btn onClick={doCreate} tone="ink" disabled={busy || !onArc || allowanceNum <= 0}>Create job</Btn>
                <Btn onClick={doFund} tone="ink" disabled={busy || !jobId || !onArc}>Fund fee (you)</Btn>
                <button onClick={doBond} disabled={!jobId || bondBusy} className="pub-btn pub-btn--comm">{bondBusy ? "agent posting…" : "Post bond (agent)"}</button>
              </div>
              <p className="t-ink3 mt-2" style={{ fontSize: 12 }}>developer = you · auditor = MARS agent {agent?.address ? short(agent.address) : agentErr ? <span className="t-warn">unavailable</span> : "…"} · fee + bond lock in escrow, released to the auditor on a clean verdict.</p>
              {agentErr && !agent?.address && <p className="t-warn mt-1" style={{ fontSize: 12 }}>Auditor agent wallet not loaded: {agentErr} — set <code className="pub-code">ARC_PRIVATE_KEY</code> in <code className="pub-code">hardhat/.env</code> or <code className="pub-code">.env.local</code>, then restart the dev server.</p>}
              {jobData && jobId > 0 && (
                <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-4">
                  <Stat k="Job">#{jobId}</Stat>
                  <Stat k="Status"><Badge label={STATUS_LABELS[jobData.status] ?? "Unknown"} /></Stat>
                  <Stat k="Fee funded">{jobData.feeFunded ? "✅" : "—"}</Stat>
                  <Stat k="Bond posted">{jobData.bondPosted ? "✅" : "—"}</Stat>
                </div>
              )}
              {allowanceNum <= 0 && jobId === 0 && <p className="t-warn mt-2" style={{ fontSize: 12 }}>Approve USDC first so the escrow can pull your fee.</p>}
              {flowMsg && <p className="pub-note pub-note--danger">{flowMsg}</p>}
              {errMsg && <p className="pub-note pub-note--danger">{errMsg}</p>}
            </section>

            {/* 5 · run audit */}
            <section className={`pub-card ${!funded ? "pub-locked" : ""}`}>
              <StepHead n={5} title="Run the audit (real 4-stage pipeline · Hedera HCS)" done={!!audit} />
              <Btn onClick={runAudit} tone="ink" disabled={auditing || !funded}>{auditing ? "auditing…" : "Run audit"}</Btn>
              {audit && (
                <div className="mt-3 flex flex-col gap-2">
                  <ul className="flex flex-col gap-1" style={{ fontSize: 13 }}>
                    {audit.stages.map((s, i) => (
                      <li key={i} className="flex items-start gap-2">
                        <span className={s.status === "fail" ? "t-danger" : s.status === "warn" ? "t-warn" : "t-safe"}>{s.status === "fail" ? "✗" : s.status === "warn" ? "!" : "✓"}</span>
                        <span className="t-ink2"><span className="t-ink" style={{ fontWeight: 600 }}>{s.stage}</span> — {s.summary}</span>
                      </li>
                    ))}
                  </ul>
                  <div className={`pub-note ${audit.verdict === "SAFE" ? "pub-note--safe" : "pub-note--danger"}`}>
                    Verdict: <strong>{audit.verdict}</strong> · risk {audit.risk} · trust {audit.trustScore}
                    {audit.summary && <span className="block mt-1" style={{ opacity: 0.85 }}>{audit.summary}</span>}
                  </div>
                  <a className="pub-link" style={{ fontSize: 12 }} href={hashscan("topic", audit.taskTopicId)} target="_blank" rel="noreferrer">audit trail on Hashscan ↗</a>
                </div>
              )}
            </section>

            {/* 6 · settle + publish */}
            <section className={`pub-card ${!audit || audit.verdict !== "SAFE" ? "pub-locked" : ""}`}>
              <StepHead n={6} title="Settle escrow + publish premium (on SAFE)" done={!!published} />
              {!published ? (
                <>
                  <Btn onClick={publish} tone="mars" disabled={publishing || !audit || audit.verdict !== "SAFE"}>{publishing ? "publishing…" : `Release escrow + publish (royalty ${royalty}%)`}</Btn>
                  <p className="t-ink3 mt-2" style={{ fontSize: 12 }}>Releases fee + bond to the auditor{settled ? " (already released)" : ""}, mints the Hedera VERIFIED NFT, and creates a premium license NFT carrying your CustomRoyaltyFee.</p>
                </>
              ) : (
                <div className="pub-note pub-note--safe flex flex-col gap-2">
                  <p><strong>✓ Published {published.skill}</strong> as a premium skill — royalty {published.royaltyPct}% to {short(hederaId)}.</p>
                  {published.verified?.tokenId && <p className="t-ink2">VERIFIED NFT: <a className="pub-code pub-link" href={hashscan("token", published.verified.tokenId)} target="_blank" rel="noreferrer">{published.verified.tokenId}#{published.verified.serial} ↗</a></p>}
                  {published.license?.tokenId && (
                    <p className="t-ink2">Premium license (royalty): <a className="pub-code pub-link" href={hashscan("token", published.license.tokenId)} target="_blank" rel="noreferrer">{published.license.tokenId} ↗</a>
                      {published.license.royalty && <span className="t-ink3"> · {published.license.royalty.numerator}/{published.license.royalty.denominator} → {short(published.license.royalty.collector)}</span>}
                    </p>
                  )}
                  <p className="t-ink2" style={{ borderTop: "1px solid var(--hair-soft)", paddingTop: 8 }}>
                    Buyers pay <span className="t-ink">{price} USDC</span> per use on the <Link className="pub-link" href="/test">marketplace</Link> (job #{jobId}); {royalty}% routes to you as royalty (x402 split + Hedera custom-fee).
                  </p>
                </div>
              )}
            </section>
          </main>

          {/* RIGHT — live sidebar */}
          <aside>
            <div className="flex flex-col gap-4 lg:sticky lg:top-6">
              <section className="pub-card">
                <div className="mb-3 flex items-center justify-between">
                  <span className="pub-label">Live · balances</span>
                  <button onClick={() => { refetchAll(); fetchGwBal(); }} className="pub-btn pub-btn--ghost" style={{ padding: "5px 10px", fontSize: 12 }}>Refresh</button>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <Stat k="Your USDC">{fmt(usdcBal.data as bigint)}</Stat>
                  <Stat k="Gateway">{gwBal ?? "…"}</Stat>
                  <Stat k="Allowance">{fmt(allowance.data as bigint)}</Stat>
                  <Stat k="Escrow holds">{fmt(escrowBal.data as bigint)}</Stat>
                  <Stat k="Active job">#{jobId || "—"}</Stat>
                  <Stat k="Next id">{Number(nextJobId.data ?? 1n)}</Stat>
                </div>
                {isConnected && address && <p className="t-ink3 mt-3" style={{ fontSize: 12 }}>You: <a className="pub-link" href={explorerAddress(address)} target="_blank" rel="noreferrer">{short(address)}</a></p>}
              </section>

              <section className="pub-card">
                <p className="pub-label mb-2">Progress</p>
                <ul className="flex flex-col gap-1.5" style={{ fontSize: 13 }}>
                  <Track done={step1Done}>Human verified</Track>
                  <Track done={step2Done}>Wallet + Hedera id</Track>
                  <Track done={!!jobId}>Escrow job created</Track>
                  <Track done={!!funded}>Fee + bond funded</Track>
                  <Track done={!!audit}>Audit run{audit ? ` (${audit.verdict})` : ""}</Track>
                  <Track done={!!published}>Published premium</Track>
                </ul>
              </section>

              <section className="pub-card">
                <p className="pub-label mb-2">Activity</p>
                <ul className="flex flex-col gap-1.5" style={{ fontSize: 13 }}>
                  {log.length === 0 && <li className="t-ink3">no txs yet</li>}
                  {log.map((l, i) => (
                    <li key={i} className="flex items-center gap-2">
                      <span className={l.ok ? "t-safe" : "t-danger"}>{l.ok ? "✓" : "✕"}</span>
                      <span className="t-ink2">{l.action}</span>
                      {l.hash && <a className="pub-link" href={explorerTx(l.hash)} target="_blank" rel="noreferrer">tx ↗</a>}
                    </li>
                  ))}
                </ul>
              </section>
            </div>
          </aside>
        </div>
      </div>

      <style jsx global>{`
        :root {
          --space: #eef0f4;
          --space-2: #e6e9ef;
          --cell: rgba(255, 255, 255, 0.78);
          --panel: rgba(255, 255, 255, 0.94);
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
          --violet: #5b47d6;
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
        .pub-wrap { max-width: 1120px; margin: 0 auto; padding: 22px 22px 56px; }
        .pub-header {
          display: flex; flex-wrap: wrap; align-items: center; justify-content: space-between;
          gap: 14px; padding-bottom: 16px; margin-bottom: 18px;
          border-bottom: 1px solid var(--hair);
        }
        .pub-h1 { margin: 0; font-size: 20px; font-weight: 700; letter-spacing: -0.01em; color: var(--ink); }
        .pub-sub { margin: 3px 0 0; max-width: 640px; font-size: 12.5px; line-height: 1.5; color: var(--ink-2); }
        .pub-grid { display: grid; grid-template-columns: 1fr; gap: 16px; }
        @media (min-width: 1024px) { .pub-grid { grid-template-columns: 2fr 1fr; } }

        .pub-card {
          background: var(--cell);
          border: 1px solid var(--hair);
          border-radius: 14px;
          padding: 18px;
          backdrop-filter: blur(8px);
        }
        .pub-locked { opacity: 0.45; pointer-events: none; }

        .pub-label { font-size: 11px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.07em; color: var(--ink-3); }
        .pub-code { font-family: var(--code); font-size: 12px; }
        .t-ink { color: var(--ink); }
        .t-ink2 { color: var(--ink-2); }
        .t-ink3 { color: var(--ink-3); }
        .t-mars { color: var(--mars); }
        .t-safe { color: var(--safe); }
        .t-danger { color: var(--danger); }
        .t-warn { color: var(--warn); }
        .t-comm { color: var(--comm); }
        .pub-link { color: var(--comm); }
        .pub-link:hover { text-decoration: underline; }

        .pub-input {
          background: #fff;
          border: 1px solid var(--hair);
          border-radius: 8px;
          padding: 7px 10px;
          font-size: 13px;
          color: var(--ink);
          font-family: var(--sans);
          outline: none;
        }
        .pub-input:focus { border-color: var(--comm); box-shadow: 0 0 0 3px rgba(47, 111, 208, 0.12); }
        .pub-range { accent-color: var(--mars); }

        .pub-btn {
          border: 1px solid transparent;
          border-radius: 9px;
          padding: 8px 14px;
          font-size: 13px;
          font-weight: 600;
          color: #fff;
          cursor: pointer;
          transition: filter 0.15s ease, background 0.15s ease;
        }
        .pub-btn:disabled { opacity: 0.4; cursor: default; }
        .pub-btn--ink { background: var(--ink); }
        .pub-btn--ink:hover:not(:disabled) { filter: brightness(1.35); }
        .pub-btn--mars { background: var(--mars); }
        .pub-btn--mars:hover:not(:disabled) { filter: brightness(1.08); }
        .pub-btn--safe { background: var(--safe); }
        .pub-btn--safe:hover:not(:disabled) { filter: brightness(1.08); }
        .pub-btn--comm { background: var(--comm); }
        .pub-btn--comm:hover:not(:disabled) { filter: brightness(1.08); }
        .pub-btn--ghost { background: #fff; color: var(--ink); border-color: var(--hair); }
        .pub-btn--ghost:hover:not(:disabled) { background: var(--inset); }

        .pub-banner {
          display: flex; align-items: center; justify-content: space-between; gap: 12px;
          border-radius: 12px; padding: 12px 16px; font-size: 13px; margin-bottom: 16px;
        }
        .pub-banner--warn { background: rgba(185, 120, 15, 0.1); border: 1px solid rgba(185, 120, 15, 0.35); color: var(--warn); }

        .pub-note { border-radius: 9px; padding: 9px 11px; font-size: 13px; margin-top: 8px; }
        .pub-note--danger { background: rgba(210, 63, 46, 0.08); border: 1px solid rgba(210, 63, 46, 0.3); color: var(--danger); }
        .pub-note--safe { background: rgba(31, 157, 99, 0.1); border: 1px solid rgba(31, 157, 99, 0.32); color: var(--safe); }

        .pub-step {
          display: flex; align-items: center; justify-content: center;
          height: 24px; width: 24px; border-radius: 999px; font-size: 12px; font-weight: 700; flex: none;
        }
        .pub-step--done { background: var(--safe); color: #fff; }
        .pub-step--idle { background: var(--inset); color: var(--ink-3); border: 1px solid var(--hair); }
      `}</style>
    </div>
  );
}

const BTN_TONES: Record<string, string> = {
  ink: "pub-btn--ink",
  mars: "pub-btn--mars",
  safe: "pub-btn--safe",
  comm: "pub-btn--comm",
  ghost: "pub-btn--ghost",
};
function Btn({ onClick, children, tone = "ink", disabled }: { onClick: () => void; children: React.ReactNode; tone?: string; disabled?: boolean }) {
  return (
    <button onClick={onClick} disabled={disabled} className={`pub-btn ${BTN_TONES[tone] ?? BTN_TONES.ink}`}>
      {children}
    </button>
  );
}

function StepHead({ n, title, done }: { n: number; title: string; done?: boolean }) {
  return (
    <div className="mb-3 flex items-center gap-2">
      <span className={`pub-step ${done ? "pub-step--done" : "pub-step--idle"}`}>{done ? "✓" : n}</span>
      <p className="t-ink" style={{ fontSize: 14, fontWeight: 600 }}>{title}</p>
    </div>
  );
}

function Stat({ k, children }: { k: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-0.5">
      <span className="pub-label">{k}</span>
      <span className="t-ink" style={{ fontSize: 13, fontWeight: 600 }}>{children}</span>
    </div>
  );
}

function Track({ done, children }: { done?: boolean; children: React.ReactNode }) {
  return (
    <li className="flex items-center gap-2">
      <span className={done ? "t-safe" : "t-ink3"}>{done ? "✓" : "○"}</span>
      <span className={done ? "t-ink" : "t-ink3"}>{children}</span>
    </li>
  );
}

const BADGE_TONES: Record<string, string> = {
  Open: "rgba(185,120,15,0.16);color:var(--warn)",
  Funded: "rgba(47,111,208,0.16);color:var(--comm)",
  Settled: "rgba(31,157,99,0.16);color:var(--safe)",
  Slashed: "rgba(210,63,46,0.16);color:var(--danger)",
  None: "rgba(0,0,0,0.06);color:var(--ink-3)",
};
function Badge({ label }: { label: string }) {
  const [bg, color] = (BADGE_TONES[label] ?? BADGE_TONES.None).split(";color:");
  return (
    <span style={{ background: bg, color, borderRadius: 6, padding: "2px 8px", fontSize: 12, fontWeight: 600 }}>{label}</span>
  );
}
