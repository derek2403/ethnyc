// pages/api/register-agent-stream.ts — streams the full register flow over SSE:
//   create Hedera account → register its EVM in World AgentBook (emits a `scan` event with the
//   verify link for the UI to render a QR) → poll AgentBook → finish (voting/review/profile/memo/log).
import type { NextApiRequest, NextApiResponse } from "next";
import { getClient, createAgentAccount } from "@/lib/hedera";
import { checkAgentHuman } from "@/lib/world-agentkit";
import { getAgentBookVerifyLink, pollAgentBook } from "@/lib/agentbook";
import { registerAgent } from "@/lib/agents";

export const config = { api: { responseLimit: false }, maxDuration: 300 };

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }
  res.writeHead(200, {
    "Content-Type": "text/event-stream",
    "Cache-Control": "no-store, no-transform",
    Connection: "keep-alive",
    "X-Accel-Buffering": "no",
  });
  const send = (obj: unknown) => res.write(`data: ${JSON.stringify(obj)}\n\n`);

  const client = getClient();
  try {
    const b = req.body ?? {};

    // 1) create the Hedera account → EVM address
    send({ type: "step", step: "account", status: "running", label: "create Hedera account" });
    const acct = await createAgentAccount(client, 5);
    send({ type: "step", step: "account", status: "done", label: "account", id: acct.accountId });

    // 2) register the EVM address in World AgentBook (the UI renders the scan link as a QR)
    let world: { worldVerified: boolean; humanId: string | null } = { worldVerified: false, humanId: null };
    if (process.env.NEXT_PUBLIC_WORLD_APP_ID) {
      send({ type: "step", step: "agentbook", status: "running", label: `register ${acct.evmAddress} in World AgentBook` });
      const existing = await checkAgentHuman(acct.evmAddress).catch(() => null);
      if (existing) {
        world = { worldVerified: true, humanId: existing };
      } else {
        const link = await getAgentBookVerifyLink(acct.evmAddress);
        if (link) {
          send({ type: "scan", link, address: acct.evmAddress });
          const h = await pollAgentBook(acct.evmAddress, { timeoutMs: 180_000 });
          if (h) world = { worldVerified: true, humanId: h };
        }
      }
      send({ type: "step", step: "agentbook", status: "done", label: world.worldVerified ? "registered in AgentBook" : "AgentBook unverified", id: world.humanId ?? undefined });
    }

    // 3) finish the Hedera registration (voting/review/profile/memo/main-HCS log) — streams each step
    const result = await registerAgent(
      client,
      {
        registryTopicId: b.registryTopicId,
        role: b.role,
        accountId: acct.accountId,
        accountKey: acct.privateKey,
        evmAddress: acct.evmAddress,
        worldVerified: world.worldVerified,
        humanId: world.humanId,
      },
      (s) => send({ type: "step", ...s })
    );
    send({ type: "done", result });
  } catch (error: unknown) {
    send({ type: "error", error: error instanceof Error ? error.message : "Unknown error" });
  } finally {
    client.close();
    res.end();
  }
}
