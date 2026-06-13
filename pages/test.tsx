import { useCallback, useEffect, useState } from "react";
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

const short = (a?: string) => (a ? `${a.slice(0, 6)}…${a.slice(-4)}` : "—");
const fmt = (v?: bigint) => (v == null ? "—" : formatUnits(v, USDC_DECIMALS));

const FUNCS = [
  { n: "Approve", call: "USDC.approve(escrow, amount)", does: "Let the escrow pull your USDC.", needs: "—" },
  { n: "Create job", call: "createJob(dev, auditor, fee, bond)", does: "Open a job → status Open.", needs: "—" },
  { n: "Fund fee", call: "fundFee(jobId)", does: "Developer locks the fee in escrow.", needs: "allowance ≥ fee · status Open" },
  { n: "Post bond", call: "postBond(jobId)", does: "Auditor locks the bond in escrow.", needs: "allowance ≥ bond · status Open" },
  { n: "Release", call: "release(jobId)", does: "Pay fee + bond to auditor → Settled.", needs: "status Funded" },
  { n: "Slash", call: "slash(jobId, reporter)", does: "Bond → reporter, fee → developer → Slashed.", needs: "status Funded" },
];

export default function EscrowTest() {
  // avoid SSR/hydration mismatch from wallet state
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  const { address, isConnected } = useAccount();
  const chainId = useChainId();
  const { switchChain } = useSwitchChain();
  const onArc = chainId === arcTestnet.id;

  const [jobId, setJobId] = useState(0);
  const [pendingJobId, setPendingJobId] = useState<number | null>(null);
  const [approveAmt, setApproveAmt] = useState("100");
  const [fee, setFee] = useState("1");
  const [bond, setBond] = useState("0.5");
  const [reporter, setReporter] = useState("");
  const [lastAction, setLastAction] = useState("");
  const [loggedHash, setLoggedHash] = useState<string | undefined>();
  const [log, setLog] = useState<{ action: string; hash: string; ok: boolean }[]>([]);
  const [x402, setX402] = useState<{
    busy?: boolean;
    error?: string;
    paid?: string;
    tx?: string;
    skill?: { verifiedLink?: string; skill?: { name?: string; version?: string } };
    payTo?: string;
    jobId?: number;
  }>({});
  const [payJobId, setPayJobId] = useState("");
  const [reg, setReg] = useState<{ busy?: boolean; error?: string; done?: boolean; tx?: string }>({});
  const [regAmt, setRegAmt] = useState("0.2");
  const [gwBal, setGwBal] = useState<string | null>(null);

  // ---- reads ----
  const usdcBal = useReadContract({
    address: USDC_ADDRESS, abi: USDC_ABI, functionName: "balanceOf",
    args: address ? [address] : undefined, query: { enabled: !!address },
  });
  const escrowBal = useReadContract({
    address: USDC_ADDRESS, abi: USDC_ABI, functionName: "balanceOf",
    args: [ESCROW_ADDRESS],
  });
  const allowance = useReadContract({
    address: USDC_ADDRESS, abi: USDC_ABI, functionName: "allowance",
    args: address ? [address, ESCROW_ADDRESS] : undefined, query: { enabled: !!address },
  });
  const nextJobId = useReadContract({
    address: ESCROW_ADDRESS, abi: ESCROW_ABI, functionName: "nextJobId",
  });
  const job = useReadContract({
    address: ESCROW_ADDRESS, abi: ESCROW_ABI, functionName: "getJob",
    args: jobId ? [BigInt(jobId)] : undefined, query: { enabled: jobId > 0 },
  });

  const refetchAll = () => {
    usdcBal.refetch(); escrowBal.refetch(); allowance.refetch();
    nextJobId.refetch(); if (jobId) job.refetch();
  };

  // ---- writes ----
  const { writeContract, data: hash, isPending, error: writeError } = useWriteContract();
  const publicClient = usePublicClient();
  const { writeContractAsync: writeRegister } = useWriteContract();
  const { data: receipt, isLoading: confirming, error: receiptError } =
    useWaitForTransactionReceipt({ hash });
  const succeeded = receipt?.status === "success";
  const reverted = receipt?.status === "reverted";

  useEffect(() => {
    if (receipt && hash && hash !== loggedHash) {
      setLoggedHash(hash);
      setLog((l) =>
        [{ action: lastAction, hash, ok: receipt.status === "success" }, ...l].slice(0, 30),
      );
      refetchAll();
      if (receipt.status === "success" && pendingJobId != null) {
        setJobId(pendingJobId);
        setPendingJobId(null);
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [receipt, hash]);

  const amt = (v: string) => parseUnits(v || "0", USDC_DECIMALS);
  const busy = isPending || confirming;
  const allowanceNum = Number(formatUnits((allowance.data as bigint) ?? 0n, USDC_DECIMALS));
  const errMsg =
    (writeError as { shortMessage?: string; message?: string } | null)?.shortMessage ||
    (writeError as { message?: string } | null)?.message ||
    (receiptError as { shortMessage?: string } | null)?.shortMessage ||
    (reverted ? "Transaction reverted on-chain — check the function's requirements below." : "");
  const stage = writeError
    ? "Error"
    : isPending
      ? "Awaiting wallet signature…"
      : confirming
        ? "Pending on-chain…"
        : succeeded
          ? "Confirmed ✓"
          : reverted
            ? "Reverted ✕"
            : "Idle";

  const doApprove = () => {
    setLastAction("approve");
    writeContract({ address: USDC_ADDRESS, abi: USDC_ABI, functionName: "approve", args: [ESCROW_ADDRESS, amt(approveAmt)] });
  };
  const doCreate = () => {
    if (!address) return;
    setPendingJobId(Number(nextJobId.data ?? 1n));
    setLastAction("createJob");
    writeContract({ address: ESCROW_ADDRESS, abi: ESCROW_ABI, functionName: "createJob", args: [address, address, amt(fee), amt(bond)] });
  };
  const doFund = () => { setLastAction("fundFee"); writeContract({ address: ESCROW_ADDRESS, abi: ESCROW_ABI, functionName: "fundFee", args: [BigInt(jobId)] }); };
  const doBond = () => { setLastAction("postBond"); writeContract({ address: ESCROW_ADDRESS, abi: ESCROW_ABI, functionName: "postBond", args: [BigInt(jobId)] }); };
  const doRelease = () => { setLastAction("release"); writeContract({ address: ESCROW_ADDRESS, abi: ESCROW_ABI, functionName: "release", args: [BigInt(jobId)] }); };
  const doSlash = () => {
    const r = (reporter || address) as `0x${string}`;
    setLastAction("slash");
    writeContract({ address: ESCROW_ADDRESS, abi: ESCROW_ABI, functionName: "slash", args: [BigInt(jobId), r] });
  };

  // Agent pays per-use for a verified skill via x402 nanopayment (server-side, gas-free).
  const buySkill = async () => {
    const jid = Number(payJobId || jobId);
    if (!jid) {
      setX402({ error: "enter a job # to pay its creator" });
      return;
    }
    setX402({ busy: true });
    try {
      const res = await fetch("/api/buy-skill", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ jobId: jid }),
      });
      const data = await res.json();
      if (!res.ok || !data.ok) {
        setX402({ error: data.error || "payment failed" });
        return;
      }
      setX402({ paid: data.paid, tx: data.tx, skill: data.skill, payTo: data.payTo, jobId: data.jobId });
    } catch (e) {
      setX402({ error: String(e) });
    }
  };

  // Read the connected wallet's Circle Gateway balance (proof of registration).
  const fetchGwBal = useCallback(async () => {
    if (!address) {
      setGwBal(null);
      return;
    }
    try {
      const r = await fetch(`/api/gateway-balance?address=${address}`);
      const d = await r.json();
      setGwBal(d.available ?? "0");
    } catch {
      setGwBal(null);
    }
  }, [address]);

  useEffect(() => {
    fetchGwBal();
  }, [fetchGwBal]);

  // One-time: register this wallet with Circle Gateway (approve + deposit).
  const registerGateway = async () => {
    if (!address || !publicClient) return;
    setReg({ busy: true });
    try {
      const amt = parseUnits(regAmt || "0.2", USDC_DECIMALS);
      const approveHash = await writeRegister({
        address: USDC_ADDRESS, abi: USDC_ABI, functionName: "approve", args: [GATEWAY_WALLET, amt],
      });
      await publicClient.waitForTransactionReceipt({ hash: approveHash });
      const depositHash = await writeRegister({
        address: GATEWAY_WALLET, abi: GATEWAY_WALLET_ABI, functionName: "deposit", args: [USDC_ADDRESS, amt], gas: 120000n,
      });
      await publicClient.waitForTransactionReceipt({ hash: depositHash });
      setReg({ done: true, tx: depositHash });
      fetchGwBal();
      usdcBal.refetch();
    } catch (e) {
      const err = e as { shortMessage?: string; message?: string };
      setReg({ error: err.shortMessage || err.message || "register failed" });
    }
  };

  const card = "rounded-xl border border-zinc-800 bg-zinc-950/60 p-4";
  const label = "text-xs uppercase tracking-wide text-zinc-500";
  const input = "w-28 rounded-md border border-zinc-700 bg-zinc-900 px-2 py-1.5 text-sm text-zinc-100 outline-none focus:border-indigo-500";
  const tones: Record<string, string> = {
    indigo: "bg-indigo-600 hover:bg-indigo-500",
    green: "bg-emerald-600 hover:bg-emerald-500",
    red: "bg-rose-600 hover:bg-rose-500",
    zinc: "bg-zinc-700 hover:bg-zinc-600",
  };
  const Btn = ({ onClick, children, tone = "indigo", disabled }: { onClick: () => void; children: React.ReactNode; tone?: string; disabled?: boolean }) => (
    <button onClick={onClick} disabled={disabled || busy || !isConnected || !onArc}
      className={`rounded-md px-3 py-2 text-sm font-medium text-white transition disabled:opacity-40 ${tones[tone]}`}>
      {children}
    </button>
  );

  const jobData = job.data as
    | { developer: string; auditor: string; fee: bigint; bond: bigint; feeFunded: boolean; bondPosted: boolean; status: number }
    | undefined;

  return (
    <div className="min-h-screen bg-black px-6 py-10 font-sans text-zinc-100">
      <div className="mx-auto grid max-w-6xl grid-cols-1 items-start gap-5 lg:grid-cols-2">
        <header className="flex flex-wrap items-start justify-between gap-3 lg:col-span-2">
          <div>
            <h1 className="text-2xl font-semibold">MARS Escrow — Arc Testnet</h1>
            <p className="mt-1 text-sm text-zinc-400">
              Connect the wallet holding your faucet USDC, then: approve → fund fee → post bond →
              release (clean) or slash (wrong verdict). Real USDC at{" "}
              <a className="text-indigo-400 hover:underline" href={explorerAddress(USDC_ADDRESS)} target="_blank" rel="noreferrer">{short(USDC_ADDRESS)}</a>.
            </p>
          </div>
          {mounted && <ConnectButton />}
        </header>

        {mounted && isConnected && !onArc && (
          <div className="flex items-center justify-between rounded-xl border border-amber-700/50 bg-amber-900/20 p-4 text-sm text-amber-200 lg:col-span-2">
            <span>Wrong network — switch to Arc Testnet ({arcTestnet.id}).</span>
            <button onClick={() => switchChain({ chainId: arcTestnet.id })}
              className="rounded-md bg-amber-600 px-3 py-1.5 font-medium text-white hover:bg-amber-500">
              Switch to Arc
            </button>
          </div>
        )}

        {!mounted || !isConnected ? (
          <div className={`${card} text-sm text-zinc-400 lg:col-span-2`}>
            Connect a wallet to begin. Need test USDC? Get it from{" "}
            <a className="text-indigo-400 hover:underline" href="https://faucet.circle.com" target="_blank" rel="noreferrer">faucet.circle.com</a> (Arc Testnet).
          </div>
        ) : (
          <>
            {/* balances */}
            <div className={`${card} lg:col-span-2`}>
              <div className="mb-3 flex items-center justify-between">
                <span className={label}>Balances</span>
                <button onClick={refetchAll} className="rounded-md bg-zinc-700 px-3 py-1.5 text-sm text-white hover:bg-zinc-600">Refresh</button>
              </div>
              <div className="grid grid-cols-2 gap-3 text-sm sm:grid-cols-4">
                <Stat k="Your USDC">{fmt(usdcBal.data as bigint)}</Stat>
                <Stat k="Escrow holds">{fmt(escrowBal.data as bigint)}</Stat>
                <Stat k="Allowance">{fmt(allowance.data as bigint)}</Stat>
                <Stat k="Active job">#{jobId || "—"}</Stat>
                <Stat k="You"><a className="text-indigo-400 hover:underline" href={explorerAddress(address!)} target="_blank" rel="noreferrer">{short(address)}</a></Stat>
                <Stat k="Escrow"><a className="text-indigo-400 hover:underline" href={explorerAddress(ESCROW_ADDRESS)} target="_blank" rel="noreferrer">{short(ESCROW_ADDRESS)}</a></Stat>
                <Stat k="Next job id">{Number(nextJobId.data ?? 1n)}</Stat>
              </div>
            </div>

            {/* 0 register with gateway */}
            <div className={`${card} lg:col-span-2`}>
              <p className="mb-1 text-sm font-medium text-zinc-300">0 · Register this wallet with Circle Gateway (one-time)</p>
              <p className="mb-3 text-xs text-zinc-500">
                Deposits USDC into Gateway so this address can <strong>pay</strong> and <strong>receive</strong> x402
                nanopayments. Needed once per wallet — pops 2 confirmations (approve + deposit).
              </p>
              <div className="flex flex-wrap items-center gap-3">
                <input className={input} value={regAmt} onChange={(e) => setRegAmt(e.target.value)} />
                <button
                  onClick={registerGateway}
                  disabled={reg.busy || !onArc}
                  className="rounded-md bg-sky-600 px-3 py-2 text-sm font-medium text-white transition hover:bg-sky-500 disabled:opacity-40"
                >
                  {reg.busy ? "registering…" : "Register / deposit"}
                </button>
                <span className="text-sm text-zinc-400">
                  Gateway balance: <span className="font-medium text-zinc-100">{gwBal ?? "…"}</span> USDC
                </span>
                <button onClick={fetchGwBal} className="text-xs text-indigo-400 hover:underline">refresh</button>
              </div>
              {reg.error && (
                <p className="mt-3 rounded-md border border-rose-800/50 bg-rose-900/30 p-2 text-sm text-rose-300">{reg.error}</p>
              )}
              {reg.done && (
                <p className="mt-3 text-sm text-emerald-300">
                  ✓ Registered — this wallet now has a Gateway account.{" "}
                  {reg.tx && (
                    <a className="text-indigo-400 hover:underline" href={explorerTx(reg.tx)} target="_blank" rel="noreferrer">tx ↗</a>
                  )}
                </p>
              )}
            </div>

            {/* 1 approve */}
            <div className={card}>
              <p className="mb-3 text-sm font-medium text-zinc-300">1 · Approve USDC for the escrow</p>
              <div className="flex flex-wrap items-center gap-3">
                <input className={input} value={approveAmt} onChange={(e) => setApproveAmt(e.target.value)} />
                <Btn onClick={doApprove} tone="zinc">Approve</Btn>
                <span className="text-xs text-zinc-500">lets the escrow pull your fee + bond</span>
              </div>
            </div>

            {/* 2 create */}
            <div className={card}>
              <p className="mb-3 text-sm font-medium text-zinc-300">2 · Create an audit job</p>
              <div className="flex flex-wrap items-end gap-3">
                <div className="flex flex-col gap-1"><span className={label}>Fee</span><input className={input} value={fee} onChange={(e) => setFee(e.target.value)} /></div>
                <div className="flex flex-col gap-1"><span className={label}>Bond</span><input className={input} value={bond} onChange={(e) => setBond(e.target.value)} /></div>
                <Btn onClick={doCreate}>Create job</Btn>
                <span className="text-xs text-zinc-500">developer = auditor = you (single-wallet test)</span>
              </div>
            </div>

            {/* 3 fund */}
            <div className={card}>
              <p className="mb-3 text-sm font-medium text-zinc-300">3 · Lock funds in escrow</p>
              <div className="flex flex-wrap items-center gap-3">
                <Btn onClick={doFund} disabled={!jobId}>Fund fee</Btn>
                <Btn onClick={doBond} disabled={!jobId}>Post bond</Btn>
                <span className="text-xs text-zinc-500">moves USDC into the escrow contract</span>
              </div>
              {allowanceNum <= 0 && (
                <p className="mt-2 text-xs text-amber-400">
                  Allowance is 0 — each approval is consumed when you fund. Re-approve (≥ your bond) before posting bond.
                </p>
              )}
            </div>

            {/* 4 settle */}
            <div className={card}>
              <p className="mb-3 text-sm font-medium text-zinc-300">4 · Settle the job</p>
              <div className="flex flex-wrap items-center gap-3">
                <Btn onClick={doRelease} tone="green" disabled={!jobId}>Release (clean)</Btn>
                <span className="text-xs text-zinc-500">→ fee + bond to auditor</span>
                <span className="mx-1 text-zinc-700">|</span>
                <input className={`${input} w-72`} placeholder="reporter (defaults to you)" value={reporter} onChange={(e) => setReporter(e.target.value)} />
                <Btn onClick={doSlash} tone="red" disabled={!jobId}>Slash</Btn>
                <span className="text-xs text-zinc-500">→ bond to reporter, fee back to dev</span>
              </div>
            </div>

            {/* job state */}
            {jobData && jobId > 0 && (
              <div className={card}>
                <p className="mb-3 text-sm font-medium text-zinc-300">Job #{jobId}</p>
                <div className="grid grid-cols-2 gap-3 text-sm sm:grid-cols-3">
                  <Stat k="Status"><Badge label={STATUS_LABELS[jobData.status] ?? "Unknown"} /></Stat>
                  <Stat k="Fee">{fmt(jobData.fee)}</Stat>
                  <Stat k="Bond">{fmt(jobData.bond)}</Stat>
                  <Stat k="Fee funded">{jobData.feeFunded ? "✅" : "—"}</Stat>
                  <Stat k="Bond posted">{jobData.bondPosted ? "✅" : "—"}</Stat>
                  <Stat k="Auditor">{short(jobData.auditor)}</Stat>
                </div>
              </div>
            )}

            {/* transaction detail */}
            <div className={card}>
              <p className="mb-3 text-sm font-medium text-zinc-300">Transaction detail</p>
              <div className="grid grid-cols-2 gap-3 text-sm sm:grid-cols-3">
                <Stat k="Last action">{lastAction || "—"}</Stat>
                <Stat k="Stage">
                  <span
                    className={
                      stage === "Error" || stage.startsWith("Reverted")
                        ? "text-rose-400"
                        : stage.startsWith("Confirmed")
                          ? "text-emerald-400"
                          : stage === "Idle"
                            ? "text-zinc-400"
                            : "text-indigo-300"
                    }
                  >
                    {stage}
                  </span>
                </Stat>
                <Stat k="Tx">
                  {hash ? (
                    <a className="text-indigo-400 hover:underline" href={explorerTx(hash)} target="_blank" rel="noreferrer">{short(hash)} ↗</a>
                  ) : (
                    "—"
                  )}
                </Stat>
              </div>
              {errMsg && (
                <p className="mt-3 rounded-md border border-rose-800/50 bg-rose-900/30 p-2 text-sm text-rose-300">{errMsg}</p>
              )}
            </div>

            {/* function reference */}
            <div className={`${card} lg:col-span-2`}>
              <p className="mb-3 text-sm font-medium text-zinc-300">What each function does</p>
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm">
                  <thead className="text-xs uppercase tracking-wide text-zinc-500">
                    <tr>
                      <th className="py-1 pr-3">Button</th>
                      <th className="py-1 pr-3">On-chain call</th>
                      <th className="py-1 pr-3">What it does</th>
                      <th className="py-1">Requires</th>
                    </tr>
                  </thead>
                  <tbody>
                    {FUNCS.map((f) => (
                      <tr key={f.n} className="border-t border-zinc-800/70 align-top">
                        <td className="py-1.5 pr-3 font-medium text-zinc-100">{f.n}</td>
                        <td className="py-1.5 pr-3 font-mono text-xs text-indigo-300">{f.call}</td>
                        <td className="py-1.5 pr-3 text-zinc-300">{f.does}</td>
                        <td className="py-1.5 text-zinc-400">{f.needs}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* activity */}
            <div className={card}>
              <p className="mb-2 text-sm font-medium text-zinc-300">Activity</p>
              <ul className="flex flex-col gap-1.5 text-sm">
                {log.length === 0 && <li className="text-zinc-600">no txs yet</li>}
                {log.map((l, i) => (
                  <li key={i} className="flex items-center gap-2">
                    <span className={l.ok ? "text-emerald-400" : "text-rose-400"}>{l.ok ? "✓" : "✕"}</span>
                    <span className="text-zinc-300">{l.action}</span>
                    <span className="text-xs text-zinc-500">{l.ok ? "confirmed" : "reverted"}</span>
                    <a className="text-indigo-400 hover:underline" href={explorerTx(l.hash)} target="_blank" rel="noreferrer">tx ↗</a>
                  </li>
                ))}
              </ul>
            </div>
          </>
        )}

        {/* 5 · agent pays per-use for a verified skill (x402 nanopayment) */}
        {mounted && (
          <div className="rounded-xl border border-fuchsia-900/50 bg-fuchsia-950/20 p-4 lg:col-span-2">
            <p className="mb-1 text-sm font-medium text-zinc-200">5 · Use a verified skill — pay-per-use (x402 nanopayment)</p>
            <p className="mb-3 text-xs text-zinc-500">
              Your AI <strong>agent</strong> pays 0.01 USDC <strong>gas-free</strong> via Circle Gateway (x402) to unlock the
              verified skill. This uses the agent&apos;s own wallet (server-side), not your connected wallet.
            </p>
            <button
              onClick={buySkill}
              disabled={x402.busy}
              className="rounded-md bg-fuchsia-600 px-3 py-2 text-sm font-medium text-white transition hover:bg-fuchsia-500 disabled:opacity-40"
            >
              {x402.busy ? "paying…" : "Pay 0.01 USDC & unlock (x402)"}
            </button>
            {x402.error && (
              <p className="mt-3 rounded-md border border-rose-800/50 bg-rose-900/30 p-2 text-sm text-rose-300">{x402.error}</p>
            )}
            {x402.skill && (
              <div className="mt-3 rounded-md border border-emerald-800/50 bg-emerald-900/20 p-3 text-sm">
                <p className="text-emerald-300">✓ Access granted — paid {x402.paid} USDC (gas-free)</p>
                {x402.tx && (
                  <a className="text-indigo-400 hover:underline" href={explorerTx(x402.tx)} target="_blank" rel="noreferrer">settlement tx ↗</a>
                )}
                <p className="mt-2 text-zinc-300">
                  Verified link: <span className="font-mono text-xs text-fuchsia-300">{x402.skill.verifiedLink}</span>
                </p>
              </div>
            )}
          </div>
        )}
      </div>
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
