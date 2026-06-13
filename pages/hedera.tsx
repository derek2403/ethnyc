// pages/hedera.tsx — MARS · Hedera testnet console (manual tester for /api/hedera)
import { useState } from "react";
import Head from "next/head";

// ── action body templates (edit before sending) ─────────────────────────────
const TEMPLATES: Record<string, Record<string, unknown>> = {
  createAccount: { action: "createAccount", initialBalance: 5 },

  createMainRegistry: { action: "createMainRegistry" },
  registerAgent: { action: "registerAgent", registryTopicId: "0.0.x", role: "auditor", name: "Auditor-1", bio: "wallet-drain specialist" },
  startJob: { action: "startJob", registryTopicId: "0.0.x", skill: "price-checker", requester: "0.0.y", scope: "audit price-checker v1" },
  updateJob: { action: "updateJob", registryTopicId: "0.0.x", jobId: "0.0.z", status: "verified", auditor: "0.0.a", verdict: "SAFE", trustScore: 92 },
  readMainRegistry: { action: "readMainRegistry", registryTopicId: "0.0.x" },

  createTopic: { action: "createTopic", memo: "mars-topic", submitKey: true },
  submitMessage: { action: "submitMessage", topicId: "0.0.x", message: "hello mars" },
  readTopic: { action: "readTopic", topicId: "0.0.x" },

  createVerifiedCollection: { action: "createVerifiedCollection", name: "MARS Verified", symbol: "MARSV" },
  createLicenseCollection: { action: "createLicenseCollection", name: "MARS License", symbol: "MARSL" },
  mintNft: { action: "mintNft", tokenId: "0.0.x", metadata: "hcs://1/0.0.y" },
  associateToken: { action: "associateToken", tokenId: "0.0.x", accountId: "0.0.y", accountKey: "302e0201..." },
  transferNft: { action: "transferNft", tokenId: "0.0.x", serial: 1, toAccountId: "0.0.y" },

  uploadReport: { action: "uploadReport", content: { skill: "price-checker", verdict: "SAFE", trustScore: 92 }, mimeType: "application/json" },
  downloadReport: { action: "downloadReport", topicId: "0.0.x" },

  createRegistry: { action: "createRegistry" },
  registerInRegistry: { action: "registerInRegistry", registryTopicId: "0.0.x", t_id: "0.0.y", metadata: "hcs://1/0.0.z", m: "note" },
  readRegistry: { action: "readRegistry", registryTopicId: "0.0.x" },

  createSkillsRegistry: { action: "createSkillsRegistry" },
  createVersionRegistry: { action: "createVersionRegistry" },
  registerSkill: { action: "registerSkill", discoveryTopicId: "0.0.x", versionRegistryTopicId: "0.0.y", accountId: "0.0.z", metadata: { name: "Price Checker", description: "coingecko price feed", author: "me", tags: [60101] } },
  registerVersion: { action: "registerVersion", versionRegistryTopicId: "0.0.x", skillUid: 1, version: "1.0.0", manifestTopicId: "0.0.y", checksum: "sha256:...", status: "active" },
  uploadManifest: { action: "uploadManifest", name: "Price Checker", description: "coingecko price feed", version: "1.0.0", license: "MIT", author: "me", files: [{ path: "SKILL.md", hrl: "hcs://1/0.0.x", sha256: "...", mime: "text/markdown" }] },

  trustScore: { action: "trustScore", skillId: "price-checker", adapters: [{ name: "sandbox", total: 98 }, { name: "deps", total: 80 }, { name: "arena", total: 72, weight: 6 }], configVersion: 1, confidence: 0.82, topicId: "" },

  createRfqBoard: { action: "createRfqBoard" },
  rfqAnnounce: { action: "rfqAnnounce", boardTopicId: "0.0.x", petal: { account: "0.0.y", name: "Auditor-1", priority: 750 }, capabilities: { protocols: ["wallet-drain", "reentrancy"] } },
  rfqPropose: { action: "rfqPropose", boardTopicId: "0.0.x", members: [{ account: "0.0.y", priority: 500 }], config: { name: "audit job", threshold: 1, purpose: "audit skill 0.0.X v1" } },
  rfqRespond: { action: "rfqRespond", boardTopicId: "0.0.x", proposal_seq: 1, decision: "accept", reason: "quote: 5 USDC" },
  rfqComplete: { action: "rfqComplete", boardTopicId: "0.0.x", proposal_seq: 1, flora_account_id: "0.0.y", topics: { communication: "0.0.a", transaction: "0.0.b", state: "0.0.c" } },
  rfqWithdraw: { action: "rfqWithdraw", boardTopicId: "0.0.x", announce_seq: 1 },
  rfqList: { action: "rfqList", boardTopicId: "0.0.x" },

  createFlora: { action: "createFlora", floraAccountId: "0.0.x" },
  floraChat: { action: "floraChat", commsTopicId: "0.0.x", floraAccountId: "0.0.y", senderId: "0.0.z", data: "my quote is 5 USDC" },
  floraRead: { action: "floraRead", topicId: "0.0.x" },

  createProfile: { action: "createProfile", accountId: "0.0.x", displayName: "Auditor-1", bio: "wallet-drain specialist" },

  reputationDeploy: { action: "reputationDeploy", name: "MARS Reputation", tick: "marsrep", max: "1000000", lim: "1000" },
  reputationMint: { action: "reputationMint", topicId: "0.0.x", tick: "marsrep", amt: "50", to: "0.0.y" },
  reputationTransfer: { action: "reputationTransfer", topicId: "0.0.x", tick: "marsrep", amt: "10", from: "0.0.y", to: "0.0.z" },
  reputationBurn: { action: "reputationBurn", topicId: "0.0.x", tick: "marsrep", amt: "5", from: "0.0.y" },
  reputationBalance: { action: "reputationBalance", topicId: "0.0.x" },

  reputationVotingDeploy: { action: "reputationVotingDeploy", upTick: "good", downTick: "bad" },
  voteGood: { action: "voteGood", topicId: "0.0.x", target: "0.0.y" },
  voteBad: { action: "voteBad", topicId: "0.0.x", target: "0.0.y" },
  removeVote: { action: "removeVote", topicId: "0.0.x", tick: "bad", target: "0.0.y" },
  reputationScore: { action: "reputationScore", topicId: "0.0.x" },

  createReviewBoard: { action: "createReviewBoard" },
  postReview: { action: "postReview", topicId: "0.0.x", target: "price-checker", reviewer: "0.0.y", rating: 5, comment: "fast and accurate", role: "skill", licenseSerial: "1" },
  listReviews: { action: "listReviews", topicId: "0.0.x" },

  createAuditTrail: { action: "createAuditTrail", skillId: "price-checker" },
  auditStep: { action: "auditStep", topicId: "0.0.x", skillId: "price-checker", step: "network: only coingecko", status: "pass" },
  auditVerdict: { action: "auditVerdict", topicId: "0.0.x", skillId: "price-checker", verdict: "SAFE", trustScore: 92, reportHrl: "hcs://1/0.0.y" },

  scheduleReAudit: { action: "scheduleReAudit", auditTrailTopicId: "0.0.x", payload: "re-audit v2", memo: "re-audit" },
};

const GROUPS: { label: string; actions: string[] }[] = [
  { label: "Accounts", actions: ["createAccount"] },
  { label: "★ Main registry & jobs (orchestration)", actions: ["createMainRegistry", "registerAgent", "startJob", "updateJob", "readMainRegistry"] },
  { label: "Topics (generic)", actions: ["createTopic", "submitMessage", "readTopic"] },
  { label: "HTS — VERIFIED + LICENSE NFT", actions: ["createVerifiedCollection", "createLicenseCollection", "mintNft", "associateToken", "transferNft"] },
  { label: "HCS-1 — file storage", actions: ["uploadReport", "downloadReport"] },
  { label: "HCS-2 — registry", actions: ["createRegistry", "registerInRegistry", "readRegistry"] },
  { label: "HCS-26 — skills registry", actions: ["createSkillsRegistry", "createVersionRegistry", "registerSkill", "registerVersion", "uploadManifest"] },
  { label: "HCS-25 — trust score", actions: ["trustScore"] },
  { label: "HCS-18 — RFQ board", actions: ["createRfqBoard", "rfqAnnounce", "rfqPropose", "rfqRespond", "rfqComplete", "rfqWithdraw", "rfqList"] },
  { label: "HCS-16 — Flora room", actions: ["createFlora", "floraChat", "floraRead"] },
  { label: "HCS-11 — profile", actions: ["createProfile"] },
  { label: "HCS-20 — reputation points", actions: ["reputationDeploy", "reputationMint", "reputationTransfer", "reputationBurn", "reputationBalance"] },
  { label: "HCS-20 — voting (good/bad)", actions: ["reputationVotingDeploy", "voteGood", "voteBad", "removeVote", "reputationScore"] },
  { label: "Reviews & ratings", actions: ["createReviewBoard", "postReview", "listReviews"] },
  { label: "Audit trail", actions: ["createAuditTrail", "auditStep", "auditVerdict"] },
  { label: "Schedule", actions: ["scheduleReAudit"] },
];

const QUICK = ["createAccount", "createMainRegistry", "createVerifiedCollection", "createLicenseCollection", "createSkillsRegistry", "createVersionRegistry", "createRfqBoard", "createRegistry", "reputationVotingDeploy", "createReviewBoard"];

// ── HashScan link extraction from a response ─────────────────────────────────
type Link = { label: string; href: string; id: string };
function collectLinks(obj: unknown, key = "", out: Link[] = []): Link[] {
  if (typeof obj === "string") {
    if (/^0\.0\.\d+$/.test(obj)) {
      const k = key.toLowerCase();
      let kind = "";
      if (/token/.test(k)) kind = "token";
      else if (/account/.test(k) && !/scheduled/.test(k)) kind = "account";
      else if (/schedule/.test(k)) kind = "schedule";
      else if (/topic|registry|board|trail|comm|transaction|state|flora|profile|discovery|version|t_id|uid/.test(k)) kind = "topic";
      if (kind) out.push({ label: `${key}: ${obj}`, href: `https://hashscan.io/testnet/${kind}/${obj}`, id: obj });
    }
  } else if (Array.isArray(obj)) {
    obj.forEach((v) => collectLinks(v, key, out));
  } else if (obj && typeof obj === "object") {
    for (const [k, v] of Object.entries(obj)) collectLinks(v, k, out);
  }
  return out;
}

type Entry = { action: string; ok: boolean; ms: number; status: number };

export default function HederaConsole() {
  const [action, setAction] = useState("createAccount");
  const [body, setBody] = useState(JSON.stringify(TEMPLATES.createAccount, null, 2));
  const [resp, setResp] = useState<unknown>(null);
  const [status, setStatus] = useState<number | null>(null);
  const [ms, setMs] = useState<number | null>(null);
  const [busy, setBusy] = useState(false);
  const [history, setHistory] = useState<Entry[]>([]);
  const [captured, setCaptured] = useState<{ label: string; id: string }[]>([]);

  function pick(a: string) {
    setAction(a);
    setBody(JSON.stringify(TEMPLATES[a] ?? { action: a }, null, 2));
  }

  // click a captured id → fill the next 0.0.x / 0.0.y placeholder in the body
  function fillPlaceholder(id: string) {
    setBody((b) => (/0\.0\.[a-z]\b/.test(b) ? b.replace(/0\.0\.[a-z]\b/, id) : b));
  }

  async function run(payload: Record<string, unknown>) {
    setBusy(true);
    setResp(null);
    setStatus(null);
    const started = performance.now();
    try {
      const res = await fetch("/api/hedera", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(payload),
      });
      const json = await res.json();
      const took = Math.round(performance.now() - started);
      setResp(json);
      setStatus(res.status);
      setMs(took);
      setHistory((h) => [{ action: String(payload.action ?? "?"), ok: res.ok, ms: took, status: res.status }, ...h].slice(0, 8));
      const found = collectLinks(json);
      setCaptured((c) => {
        const seen = new Set(c.map((x) => x.id));
        const add = found.filter((x) => !seen.has(x.id)).map((x) => ({ label: x.label, id: x.id }));
        return [...add, ...c].slice(0, 24);
      });
    } catch (e) {
      setResp({ error: e instanceof Error ? e.message : "request failed" });
      setStatus(0);
      setMs(Math.round(performance.now() - started));
    } finally {
      setBusy(false);
    }
  }

  function send() {
    let parsed: Record<string, unknown>;
    try {
      parsed = JSON.parse(body);
    } catch (e) {
      setResp({ error: `Invalid JSON in body: ${e instanceof Error ? e.message : e}` });
      setStatus(0);
      return;
    }
    run(parsed);
  }

  const links = resp ? collectLinks(resp) : [];

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900">
      <Head>
        <title>MARS · Hedera console</title>
      </Head>

      <header className="border-b border-slate-200 bg-white px-6 py-4">
        <h1 className="text-lg font-semibold">
          MARS <span className="text-slate-400">·</span> Hedera testnet console
        </h1>
        <p className="text-sm text-slate-500">
          Manual tester for <code className="rounded bg-slate-100 px-1">POST /api/hedera</code>. Needs{" "}
          <code className="rounded bg-slate-100 px-1">HEDERA_OPERATOR_ID</code> /{" "}
          <code className="rounded bg-slate-100 px-1">HEDERA_OPERATOR_KEY</code> in <code className="rounded bg-slate-100 px-1">.env.local</code>.
        </p>
      </header>

      <main className="mx-auto grid max-w-6xl gap-6 p-6 lg:grid-cols-2">
        {/* ── REQUEST ── */}
        <section className="space-y-3">
          <div>
            <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">Quick actions (one click)</div>
            <div className="flex flex-wrap gap-2">
              {QUICK.map((a) => (
                <button
                  key={a}
                  onClick={() => run(TEMPLATES[a])}
                  disabled={busy}
                  className="rounded-md border border-slate-300 bg-white px-2.5 py-1 text-xs font-medium hover:bg-slate-100 disabled:opacity-40"
                >
                  {a}
                </button>
              ))}
            </div>
          </div>

          <label className="block">
            <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">Action</span>
            <select
              value={action}
              onChange={(e) => pick(e.target.value)}
              className="mt-1 w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm"
            >
              {GROUPS.map((g) => (
                <optgroup key={g.label} label={g.label}>
                  {g.actions.map((a) => (
                    <option key={a} value={a}>
                      {a}
                    </option>
                  ))}
                </optgroup>
              ))}
            </select>
          </label>

          <label className="block">
            <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">Request body (JSON — edit me)</span>
            <textarea
              value={body}
              onChange={(e) => setBody(e.target.value)}
              spellCheck={false}
              rows={16}
              className="mt-1 w-full rounded-md border border-slate-300 bg-white p-3 font-mono text-xs leading-relaxed"
            />
          </label>

          {captured.length > 0 && (
            <div>
              <div className="mb-1 text-xs font-semibold uppercase tracking-wide text-slate-500">
                Captured ids — click to fill the next 0.0.x placeholder
              </div>
              <div className="flex flex-wrap gap-1.5">
                {captured.map((c) => (
                  <button
                    key={c.id}
                    onClick={() => fillPlaceholder(c.id)}
                    title={c.label}
                    className="rounded border border-slate-300 bg-white px-2 py-0.5 font-mono text-[11px] hover:bg-slate-100"
                  >
                    {c.id}
                  </button>
                ))}
              </div>
            </div>
          )}

          <button
            onClick={send}
            disabled={busy}
            className="rounded-md bg-slate-900 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-700 disabled:opacity-40"
          >
            {busy ? "Sending…" : "Send →"}
          </button>
        </section>

        {/* ── RESPONSE ── */}
        <section className="space-y-3">
          <div className="flex items-center gap-3">
            <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">Response</span>
            {status !== null && (
              <span className={`rounded px-1.5 py-0.5 text-xs font-semibold ${status >= 200 && status < 300 ? "bg-green-100 text-green-700" : "bg-red-100 text-red-700"}`}>
                {status || "ERR"} {ms != null ? `· ${ms}ms` : ""}
              </span>
            )}
          </div>

          {links.length > 0 && (
            <div className="rounded-md border border-slate-200 bg-white p-3">
              <div className="mb-1 text-xs font-semibold text-slate-500">HashScan</div>
              <ul className="space-y-0.5 text-xs">
                {links.map((l, i) => (
                  <li key={i}>
                    <a href={l.href} target="_blank" rel="noreferrer" className="font-mono text-blue-600 hover:underline">
                      {l.label} ↗
                    </a>
                  </li>
                ))}
              </ul>
            </div>
          )}

          <pre className="max-h-[28rem] overflow-auto rounded-md border border-slate-200 bg-white p-3 font-mono text-xs leading-relaxed text-slate-800">
            {resp ? JSON.stringify(resp, null, 2) : "— no response yet —"}
          </pre>

          {history.length > 0 && (
            <div>
              <div className="mb-1 text-xs font-semibold uppercase tracking-wide text-slate-500">Recent</div>
              <ul className="space-y-0.5 text-xs">
                {history.map((h, i) => (
                  <li key={i} className="flex gap-2 font-mono">
                    <span className={h.ok ? "text-green-600" : "text-red-600"}>{h.ok ? "✓" : "✗"}</span>
                    <span className="text-slate-700">{h.action}</span>
                    <span className="text-slate-400">
                      {h.status} · {h.ms}ms
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </section>
      </main>
    </div>
  );
}
