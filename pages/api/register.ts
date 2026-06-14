import type { NextApiRequest, NextApiResponse } from "next";
import { createHash, randomBytes } from "node:crypto";
import { saveAgent } from "@/lib/db.mjs";

// POST/GET /api/register?role=user|auditor[&name=…]
//
// Registers a MARS agent: runs the Hedera onboarding (account + World AgentBook
// + voting/review/profile HCS topics + main-registry log) when configured, else
// issues a local identity. Persists the full record to db/users.json or
// db/auditors.json and echoes the ids the agent should export to its env.
export const config = { maxDuration: 120 };

const AUDITOR_PREREQS = [
  "World-ID verified (proof of unique personhood) — anti-sybil",
  "Can run the MARS audit pipeline (scanner → sandbox → fork → synthesizer) with an OpenAI key",
  "A bond staked in escrow — slashed if a verdict is later proven wrong",
  "A sandbox/fork runtime (Docker + Anvil) available for deeper audit tiers",
];

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Cache-Control", "no-store");
  const q = req.method === "POST" ? { ...req.query, ...(req.body ?? {}) } : req.query;
  const role = String(q.role ?? "user") === "auditor" ? "auditor" : "user";
  const name = String(q.name ?? "").trim();

  type Rec = Record<string, unknown> & { agent_id: string; review_topic: string; voting_topic: string; profile_topic: string; rating: string };
  let record: Rec;

  try {
    // Real Hedera onboarding (only if @hashgraph/sdk + operator env are present).
    const { getClient } = await import("@/lib/hedera");
    const { registerAgent, initMars } = await import("@/lib/agents");
    const client = getClient();
    const { registryTopicId } = await initMars(client);
    const r = await registerAgent(client, { registryTopicId, role, initialBalance: 1 });
    try {
      client.close();
    } catch {}
    record = {
      agent_id: r.account,
      evm_address: r.evmAddress ?? null,
      role,
      world_verified: r.worldVerified,
      human_id: r.humanId ?? null,
      profile_topic: r.profileTopicId,
      voting_topic: r.votingTopicId,
      review_topic: r.reviewTopicId,
      account_memo: r.accountMemo,
      registry_seq: r.registrySeq ?? null,
      encrypted_key: r.encryptedKey ?? null,
      rating: null,
      hedera: true,
      name: name || undefined,
      registered_at: new Date().toISOString(),
    };
  } catch (e: unknown) {
    // Hedera not configured → still issue an agent identity so the flow works.
    const h = createHash("sha256").update(role + Date.now() + randomBytes(6).toString("hex")).digest("hex");
    record = {
      agent_id: "agent-0x" + h.slice(0, 8) + "…" + h.slice(8, 10),
      evm_address: "0x" + h.slice(0, 40),
      role,
      world_verified: false,
      human_id: null,
      profile_topic: "0.0." + (490000 + (parseInt(h.slice(0, 4), 16) % 9000)),
      voting_topic: "0.0." + (491000 + (parseInt(h.slice(4, 8), 16) % 9000)),
      review_topic: "0.0." + (492000 + (parseInt(h.slice(8, 12), 16) % 9000)),
      registry_seq: null,
      encrypted_key: null,
      rating: null,
      hedera: false,
      name: name || undefined,
      note: "Hedera not configured (" + (e instanceof Error ? e.message : "error") + ") — local identity issued",
      registered_at: new Date().toISOString(),
    };
  }

  saveAgent(role, record);

  return res.status(200).json({
    ok: true,
    role,
    hedera: record.hedera === true, // true = real on-chain account/topics; false = local fallback
    ...(record.note ? { hedera_note: record.note } : {}),
    agent_id: record.agent_id,
    rating: record.rating,
    review_id: record.review_topic,
    voting_id: record.voting_topic,
    profile_id: record.profile_topic,
    evm_address: record.evm_address,
    world_verified: record.world_verified,
    ...(role === "auditor"
      ? { prerequisites: AUDITOR_PREREQS, note: "Auditor role: ensure the prerequisites above before accepting audit jobs." }
      : { capability: `audit MCP tools / skills via  GET /api/audit?skill=<name|url>&agent=${record.agent_id}` }),
    // export these into the agent's environment:
    env: {
      MARS_AGENT_ID: record.agent_id,
      MARS_REVIEW_ID: record.review_topic,
      MARS_RATING: record.rating,
      MARS_ROLE: role,
    },
  });
}
