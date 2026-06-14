// pages/api/register-cli.ts — the register-agent flow as a streaming, curl-able
// endpoint. Renders the World-ID verify QR as terminal ASCII, waits for the
// scan, finishes the Hedera registration, and saves to the DB. Use `curl -N`.
//
//   curl -N "http://localhost:3000/api/register-cli?role=auditor"
//   curl -N "http://localhost:3000/api/register-cli?role=user"
import type { NextApiRequest, NextApiResponse } from "next";
import { getClient, hashscan, createAgentAccount } from "@/lib/hedera";
import { checkAgentHuman } from "@/lib/world-agentkit";
import { getAgentBookVerifyLink, pollAgentBook } from "@/lib/agentbook";
import { initMars, registerAgent } from "@/lib/agents";
import { saveAgent } from "@/lib/db.mjs";

export const config = { api: { responseLimit: false }, maxDuration: 300 };

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const q = req.method === "POST" ? { ...req.query, ...(req.body ?? {}) } : req.query;
  const role = String(q.role ?? "user") === "auditor" ? "auditor" : "user";

  res.writeHead(200, {
    "Content-Type": "text/plain; charset=utf-8",
    "Cache-Control": "no-store, no-transform",
    "X-Accel-Buffering": "no",
  });
  const w = (s = "") => res.write(s + "\n");

  let client: ReturnType<typeof getClient> | undefined;
  try {
    client = getClient();
    w(`\n  MARS · register ${role}\n`);

    // 1) Hedera account
    w("→ creating Hedera account…");
    const acct = await createAgentAccount(client, 1);
    w(`  account ${hashscan("account", acct.accountId)}`);
    w(`  evm     ${acct.evmAddress}\n`);

    // 2) World AgentBook — render the verify link as a terminal QR, wait for the scan
    let world: { worldVerified: boolean; humanId: string | null } = { worldVerified: false, humanId: null };
    if (process.env.NEXT_PUBLIC_WORLD_APP_ID) {
      const existing = await checkAgentHuman(acct.evmAddress).catch(() => null);
      if (existing) {
        world = { worldVerified: true, humanId: existing };
        w(`✓ ${acct.evmAddress} already verified (human ${existing.slice(0, 12)}…)\n`);
      } else {
        w("→ registering EVM in World AgentBook…");
        const link = await getAgentBookVerifyLink(acct.evmAddress);
        if (link) {
          w("\n📱  HUMAN ACTION: scan this QR in the World App (or open the link below):\n");
          try {
            const QRCode = (await import("qrcode")).default;
            w(await QRCode.toString(link, { type: "terminal", small: true }));
          } catch {
            /* qr render failed — link still printed */
          }
          w(link);
          w("\n…waiting for verification (polling every 3s, up to 3 min)…");
          const h = await pollAgentBook(acct.evmAddress, { timeoutMs: 180_000 });
          if (h) {
            world = { worldVerified: true, humanId: h };
            w(`✓ verified — human ${h.slice(0, 12)}…\n`);
          } else {
            w("(not verified within 3 min — finishing unverified)\n");
          }
        } else {
          w("(no verify link from agentkit-cli — finishing unverified)\n");
        }
      }
    } else {
      w("(World ID not configured — finishing unverified)\n");
    }

    // 3) main registry
    let registryTopicId = String(q.registry ?? process.env.MARS_REGISTRY ?? "");
    if (!registryTopicId) {
      const m = await initMars(client);
      registryTopicId = m.registryTopicId;
    }

    // 4) finish (voting/review/profile/memo/registry) + persist
    w(`→ registering ${role}:`);
    const a = await registerAgent(
      client,
      { registryTopicId, role, accountId: acct.accountId, accountKey: acct.privateKey, evmAddress: acct.evmAddress, worldVerified: world.worldVerified, humanId: world.humanId },
      (s) => {
        if (s.status === "done") w(`  ✓ ${s.label}${s.id ? ` → ${s.id}` : ""}`);
      }
    );

    saveAgent(role, {
      agent_id: a.account,
      evm_address: a.evmAddress ?? null,
      role,
      world_verified: a.worldVerified,
      human_id: a.humanId ?? null,
      profile_topic: a.profileTopicId,
      voting_topic: a.votingTopicId,
      review_topic: a.reviewTopicId,
      account_memo: a.accountMemo,
      registry_seq: a.registrySeq ?? null,
      encrypted_key: a.encryptedKey ?? null,
      rating: "5.0",
      hedera: true,
      registered_at: new Date().toISOString(),
    });

    w("\n✓ registered");
    w(`  account ${a.account}`);
    w(`  voting  ${a.votingTopicId}`);
    w(`  review  ${a.reviewTopicId}`);
    w(`  profile ${a.profileTopicId}`);
    w(`  world   ${a.worldVerified ? `verified (${a.humanId})` : "unverified"}`);
    w(`\n  export MARS_AGENT_ID=${a.account} MARS_REVIEW_ID=${a.reviewTopicId} MARS_RATING=5.0 MARS_ROLE=${role}\n`);
  } catch (e: unknown) {
    w(`\nERROR: ${e instanceof Error ? e.message : "registration failed"}`);
  } finally {
    try {
      client?.close();
    } catch {}
    res.end();
  }
}
