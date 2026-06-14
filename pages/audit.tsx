import { readFileSync } from "node:fs";
import { join } from "node:path";
import { useMemo, useState } from "react";
import type { GetStaticProps } from "next";
import { Geist, Geist_Mono } from "next/font/google";

const geistSans = Geist({ subsets: ["latin"] });
const geistMono = Geist_Mono({ subsets: ["latin"] });

const mono = geistMono.className;

type StepStatus = "done" | "running" | "pending";

interface StepTemplate {
  stage: string;
  name: string;
  description: string;
  detail: string;
}

interface SkillConfig {
  id: string;
  filename: string;
  version: string;
  auditor: string;
  tier: string;
  compliance: string;
  escrow: string;
  bond: string;
  hcsTopic: string;
  steps: StepTemplate[];
}

type DemoSkill = SkillConfig & { source: string };

const SKILL_CONFIGS: SkillConfig[] = [
  {
    id: "audit-90107",
    filename: "price-checker.js",
    version: "coingecko-price-oracle@3.2.2",
    auditor: "auditor-04",
    tier: "T2",
    compliance: "FIN",
    escrow: "2,000 USDC",
    bond: "2,500 USDC",
    hcsTopic: "0.0.491813",
    steps: [
      {
        stage: "scanner",
        name: "Scanner",
        description: "Description-injection scan",
        detail:
          "Scanned tool descriptions — 0 hidden directives, 1 deprecated deps",
      },
      {
        stage: "sandbox",
        name: "Sandbox",
        description: "Sandboxed run in TEE — declared vs actual",
        detail: "Sandbox: network → api.coingecko.com only; fs scoped /tmp",
      },
      {
        stage: "fork",
        name: "Fork",
        description: "Anvil fork + fake wallet — abuse check",
        detail: "Anvil fork — replayed 837 txns · 0 reverts · no wallet drain",
      },
      {
        stage: "synthesizer",
        name: "Synthesizer",
        description: "Evidence → attested verdict",
        detail: "",
      },
    ],
  },
  {
    id: "audit-90112",
    filename: "portfolio-helper.js",
    version: "portfolio-helper@1.0.4",
    auditor: "auditor-04",
    tier: "T2",
    compliance: "FIN",
    escrow: "2,000 USDC",
    bond: "2,500 USDC",
    hcsTopic: "0.0.491820",
    steps: [
      {
        stage: "scanner",
        name: "Scanner",
        description: "Description-injection scan",
        detail:
          "Scanned tool descriptions — 3 hidden directives in comment block",
      },
      {
        stage: "sandbox",
        name: "Sandbox",
        description: "Sandboxed run in TEE — declared vs actual",
        detail:
          "Sandbox: read attempt ~/.ssh/id_rsa; outbound POST collector.evil.example",
      },
      {
        stage: "fork",
        name: "Fork",
        description: "Anvil fork + fake wallet — abuse check",
        detail:
          "Anvil fork — setApprovalForAll(0xATTACKER) · wallet drain path found",
      },
      {
        stage: "synthesizer",
        name: "Synthesizer",
        description: "Evidence → attested verdict",
        detail: "",
      },
    ],
  },
];

interface AuditFinding {
  severity: string;
  title: string;
  detail: string;
}

interface Attestation {
  verdict: {
    verdict: "SAFE" | "DANGEROUS";
    risk: string;
    summary: string;
    capabilities: string[];
    findings: AuditFinding[];
    recommendation: string;
  };
  inferenceId: string;
  model: string;
  localDigest: string;
  enclaveDigest?: string;
  digestVerified: boolean;
  usage?: { prompt_tokens: number; completion_tokens: number };
}

interface TeeAttestation {
  ok: boolean;
  mocked: boolean;
  reportData: string;
  quote: string;
  event_log?: string;
  info?: { app_id?: string; instance_id?: string } | null;
  verify?: string;
}

const STATUS_LABEL: Record<StepStatus, string> = {
  done: "DONE",
  running: "RUNNING",
  pending: "PENDING",
};

const STATUS_TEXT: Record<StepStatus, string> = {
  done: "text-green-600 dark:text-green-500",
  running: "text-amber-600 dark:text-amber-500",
  pending: "text-zinc-400 dark:text-zinc-600",
};

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

function toBase64(s: string) {
  if (typeof window === "undefined") return "";
  return window.btoa(unescape(encodeURIComponent(s)));
}

function StepIndicator({ status }: { status: StepStatus }) {
  if (status === "done") {
    return (
      <span className="flex h-7 w-7 items-center justify-center rounded-full bg-green-500 text-white">
        <svg viewBox="0 0 20 20" fill="none" className="h-4 w-4" aria-hidden>
          <path
            d="M5 10.5l3 3 7-7"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </span>
    );
  }
  const ring =
    status === "running"
      ? "border-amber-500"
      : "border-zinc-300 dark:border-zinc-700";
  return (
    <span
      className={`flex h-7 w-7 items-center justify-center rounded-full border-2 bg-white dark:bg-black ${ring}`}
    />
  );
}

function MetaRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-baseline justify-between py-2">
      <span className="text-zinc-500 dark:text-zinc-400">{label}</span>
      <span className={`${mono} text-zinc-900 dark:text-zinc-100`}>{value}</span>
    </div>
  );
}

export default function Audit({ skills }: { skills: DemoSkill[] }) {
  const [skillIndex, setSkillIndex] = useState(0);
  const [statuses, setStatuses] = useState<StepStatus[]>([
    "pending",
    "pending",
    "pending",
    "pending",
  ]);
  const [running, setRunning] = useState(false);
  const [attestation, setAttestation] = useState<Attestation | null>(null);
  const [tee, setTee] = useState<TeeAttestation | null>(null);
  const [teeError, setTeeError] = useState<string | null>(null);
  const [recorded, setRecorded] = useState("—");
  const [error, setError] = useState<string | null>(null);

  const skill = skills[skillIndex];

  const headerStatus = useMemo(() => {
    if (running) return { label: "AUDITING", color: "amber" as const };
    if (attestation?.verdict.verdict === "SAFE")
      return { label: "VERIFIED", color: "green" as const };
    if (attestation?.verdict.verdict === "DANGEROUS")
      return { label: "DANGEROUS", color: "red" as const };
    return { label: "IDLE", color: "zinc" as const };
  }, [running, attestation]);

  function reset() {
    setStatuses(["pending", "pending", "pending", "pending"]);
    setAttestation(null);
    setTee(null);
    setTeeError(null);
    setError(null);
    setRecorded("—");
  }

  async function runAudit() {
    if (running) return;
    reset();
    setRunning(true);

    const set = (i: number, s: StepStatus) =>
      setStatuses((prev) => prev.map((v, idx) => (idx === i ? s : v)));

    // Local pipeline stages (scanner → sandbox → fork) produce the evidence.
    for (let i = 0; i < 3; i++) {
      set(i, "running");
      await sleep(900);
      set(i, "done");
    }

    // Synthesizer stage: hand the evidence to the Chainlink attester.
    set(3, "running");
    const evidence = {
      steps: skill.steps.slice(0, 3).map((s) => ({
        stage: s.stage,
        description: s.description,
        detail: s.detail,
      })),
    };

    try {
      const res = await fetch("/api/chainlink/audit-file", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          filename: skill.filename,
          content_base64: toBase64(skill.source),
          evidence,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? `Audit failed (${res.status})`);
      const att = data as Attestation;
      setAttestation(att);

      // Final step: seal the whole audit record into a genuine Phala TDX quote.
      // (Non-fatal — the verdict still stands if the CVM isn't reachable.)
      try {
        const bundle = {
          audit_id: skill.id,
          skill: skill.version,
          file: skill.filename,
          file_sha256: att.localDigest,
          verdict: att.verdict.verdict,
          risk: att.verdict.risk,
          chainlink_inference: att.inferenceId,
          evidence,
          audited_at: new Date().toISOString(),
        };
        const tRes = await fetch("/api/tee/attest", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify(bundle),
        });
        const tData = await tRes.json();
        if (!tRes.ok) throw new Error(tData.error ?? `TEE attestation failed (${tRes.status})`);
        setTee(tData as TeeAttestation);
      } catch (te: unknown) {
        setTeeError(te instanceof Error ? te.message : "TEE attestation failed");
      }

      setRecorded("now");
      set(3, "done");
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Audit failed");
      set(3, "pending");
    } finally {
      setRunning(false);
    }
  }

  const pill = {
    amber:
      "border-amber-500/40 text-amber-600 dark:text-amber-500 [&>span]:bg-amber-500",
    green:
      "border-green-500/40 text-green-600 dark:text-green-500 [&>span]:bg-green-500",
    red: "border-red-500/40 text-red-600 dark:text-red-500 [&>span]:bg-red-500",
    zinc: "border-zinc-400/40 text-zinc-500 [&>span]:bg-zinc-400",
  }[headerStatus.color];

  return (
    <div
      className={`${geistSans.className} flex min-h-screen justify-center bg-zinc-100 font-sans dark:bg-black`}
    >
      <main className="w-full max-w-2xl px-8 py-16">
        <div className="flex items-center justify-between">
          <p className="text-xs font-semibold uppercase tracking-widest text-amber-600 dark:text-amber-500">
            {attestation ? "Audit Result" : "Ongoing Audit"}
          </p>
          <div className="flex items-center gap-2">
            <select
              value={skillIndex}
              disabled={running}
              onChange={(e) => {
                setSkillIndex(Number(e.target.value));
                reset();
              }}
              className={`${mono} rounded-lg border border-zinc-300 bg-white px-3 py-1.5 text-xs text-zinc-700 disabled:opacity-50 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-300`}
            >
              {skills.map((s, i) => (
                <option key={s.id} value={i}>
                  {s.filename}
                </option>
              ))}
            </select>
            <button
              onClick={runAudit}
              disabled={running}
              className="rounded-lg bg-zinc-900 px-4 py-1.5 text-xs font-semibold text-white transition-colors hover:bg-zinc-700 disabled:opacity-50 dark:bg-zinc-50 dark:text-zinc-900 dark:hover:bg-zinc-300"
            >
              {running ? "Auditing…" : "Run audit"}
            </button>
          </div>
        </div>

        <div className="mt-2 flex items-center gap-3">
          <h1
            className={`${mono} text-3xl font-bold tracking-tight text-zinc-900 dark:text-zinc-50`}
          >
            {skill.id}
          </h1>
          <span
            className={`inline-flex items-center gap-2 rounded-full border px-3 py-1 text-xs font-semibold uppercase tracking-wider ${pill}`}
          >
            <span className="h-1.5 w-1.5 rounded-full" />
            {headerStatus.label}
          </span>
        </div>

        <p className={`${mono} mt-2 text-sm text-zinc-500 dark:text-zinc-400`}>
          {skill.version} · {skill.auditor} · {skill.tier} · {skill.compliance}
        </p>

        <div className="mt-8 border-t border-zinc-200 text-sm dark:border-zinc-800">
          <MetaRow label="Escrow (Arc x402)" value={skill.escrow} />
          <MetaRow label="Auditor bond" value={skill.bond} />
          <MetaRow label="HCS audit-trail topic" value={skill.hcsTopic} />
          <MetaRow
            label="TEE attestation (Phala TDX)"
            value={tee ? (tee.mocked ? "mock (no CVM)" : "attested ✓") : teeError ? "unavailable" : "—"}
          />
          <MetaRow label="Recorded" value={recorded} />
        </div>

        <p className="mt-10 text-xs font-semibold uppercase tracking-widest text-zinc-400 dark:text-zinc-500">
          Audit Trail · Pipeline
        </p>

        <ol className="mt-6">
          {skill.steps.map((step, i) => {
            const last = i === skill.steps.length - 1;
            const status = statuses[i];
            const isSynth = i === 3;
            const detail =
              isSynth && attestation
                ? `Verdict ${attestation.verdict.verdict} · risk ${attestation.verdict.risk} · Chainlink attestation 0x${(attestation.enclaveDigest ?? "").slice(0, 6)}${tee ? ` · TEE quote ${tee.reportData.slice(0, 10)}…` : ""}`
                : step.detail;
            return (
              <li key={step.stage} className="flex gap-4">
                <div className="flex flex-col items-center">
                  <StepIndicator status={status} />
                  {!last && (
                    <span className="w-px flex-1 bg-zinc-200 dark:bg-zinc-800" />
                  )}
                </div>
                <div className={last ? "pb-2" : "pb-8"}>
                  <div className="flex items-center gap-3">
                    <h2 className="text-base font-semibold text-zinc-900 dark:text-zinc-100">
                      {i + 1}. {step.name}
                    </h2>
                    <span
                      className={`text-xs font-semibold uppercase tracking-wider ${STATUS_TEXT[status]}`}
                    >
                      {STATUS_LABEL[status]}
                    </span>
                  </div>
                  <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
                    {step.description}
                  </p>
                  {detail && (
                    <p
                      className={`${mono} mt-2 text-sm text-zinc-700 dark:text-zinc-300`}
                    >
                      {detail}
                    </p>
                  )}
                  {isSynth && attestation && (
                    <p
                      className={`mt-2 text-sm ${attestation.digestVerified ? "text-green-600 dark:text-green-500" : "text-red-600 dark:text-red-500"}`}
                    >
                      {attestation.digestVerified
                        ? "✓ digest verified — enclave audited exactly this file"
                        : "✗ digest mismatch"}
                    </p>
                  )}
                </div>
              </li>
            );
          })}
        </ol>

        {error && (
          <p className="mt-6 rounded-lg border border-red-300 bg-red-50 p-3 text-sm text-red-700 dark:border-red-900/50 dark:bg-red-950/30 dark:text-red-400">
            {error}
          </p>
        )}

        {(tee || teeError) && (
          <div className="mt-10">
            <div className="flex items-center gap-3">
              <p className="text-xs font-semibold uppercase tracking-widest text-zinc-400 dark:text-zinc-500">
                TEE Attestation · Phala TDX
              </p>
              {tee && (
                <span
                  className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider ${
                    tee.mocked
                      ? "border-amber-500/40 text-amber-600 dark:text-amber-500"
                      : "border-green-500/40 text-green-600 dark:text-green-500"
                  }`}
                >
                  {tee.mocked ? "MOCK · no CVM" : "Attested ✓"}
                </span>
              )}
            </div>

            {teeError && !tee && (
              <p className="mt-3 rounded-lg border border-amber-300 bg-amber-50 p-3 text-sm text-amber-700 dark:border-amber-900/50 dark:bg-amber-950/30 dark:text-amber-400">
                {teeError} — deploy <code>tee/</code> and set <code>PHALA_ATTESTOR_URL</code>.
              </p>
            )}

            {tee && (
              <div className="mt-4 rounded-xl border border-zinc-200 bg-white p-4 text-sm dark:border-zinc-800 dark:bg-zinc-950">
                <div className="flex items-baseline justify-between py-1">
                  <span className="text-zinc-500 dark:text-zinc-400">reportData (sha256 of audit record)</span>
                  <span className={`${mono} text-zinc-900 dark:text-zinc-100`}>0x{tee.reportData.slice(0, 24)}…</span>
                </div>
                {tee.info?.app_id && (
                  <div className="flex items-baseline justify-between py-1">
                    <span className="text-zinc-500 dark:text-zinc-400">enclave app id</span>
                    <span className={`${mono} text-zinc-900 dark:text-zinc-100`}>{tee.info.app_id}</span>
                  </div>
                )}
                <p className="mt-3 text-xs font-semibold uppercase tracking-widest text-zinc-400 dark:text-zinc-500">
                  TDX quote
                </p>
                <pre className={`${mono} mt-2 max-h-40 overflow-auto rounded-lg border border-zinc-200 bg-zinc-50 p-3 text-[11px] leading-relaxed text-zinc-700 dark:border-zinc-800 dark:bg-black dark:text-zinc-300`}>
                  {tee.quote}
                </pre>
                <a
                  href={tee.verify ?? "https://proof.t16z.com/"}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="mt-3 inline-block text-xs font-semibold text-amber-600 hover:underline dark:text-amber-500"
                >
                  Verify this quote ↗
                </a>
              </div>
            )}
          </div>
        )}

        {attestation && (
          <div className="mt-10">
            <p className="text-xs font-semibold uppercase tracking-widest text-zinc-400 dark:text-zinc-500">
              Attestation · JSON
            </p>
            <pre
              className={`${mono} mt-4 overflow-x-auto rounded-xl border border-zinc-200 bg-white p-4 text-xs leading-relaxed text-zinc-700 dark:border-zinc-800 dark:bg-zinc-950 dark:text-zinc-300`}
            >
              {JSON.stringify(attestation, null, 2)}
            </pre>
          </div>
        )}
      </main>
    </div>
  );
}

export const getStaticProps: GetStaticProps<{ skills: DemoSkill[] }> = async () => {
  const skills = SKILL_CONFIGS.map((config) => ({
    ...config,
    source: readFileSync(
      join(process.cwd(), "demo/skills", config.filename),
      "utf8"
    ),
  }));
  return { props: { skills } };
};
