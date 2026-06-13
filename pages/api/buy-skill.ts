import type { NextApiRequest, NextApiResponse } from "next";
import { GatewayClient } from "@circle-fin/x402-batching/client";
import { createPublicClient, http, parseUnits } from "viem";
import { PRICE_DISPLAY, SKILL_SELLER, getAgentKey } from "@/lib/x402";
import { ESCROW_ABI, ESCROW_ADDRESS, arcTestnet } from "@/lib/escrow";

const ZERO = "0x0000000000000000000000000000000000000000";

// The buyer is an AI AGENT paying per-use for a verified skill, gas-free, via x402.
// The recipient is the chosen JOB's creator (skill author), read from the escrow.
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ error: "POST only" });
  }

  try {
    const jobId = req.body?.jobId != null ? Number(req.body.jobId) : 0;

    // Resolve who gets paid: the job's creator (developer), read on-chain.
    let payTo = SKILL_SELLER;
    if (jobId > 0) {
      const pub = createPublicClient({ chain: arcTestnet, transport: http() });
      const job = await pub.readContract({
        address: ESCROW_ADDRESS,
        abi: ESCROW_ABI,
        functionName: "getJob",
        args: [BigInt(jobId)],
      });
      if (!job || job.developer === ZERO) {
        return res.status(400).json({ error: `Job #${jobId} not found` });
      }
      payTo = job.developer;
    }

    const client = new GatewayClient({ chain: "arcTestnet", privateKey: getAgentKey() });

    if (payTo.toLowerCase() === client.address.toLowerCase()) {
      return res.status(400).json({
        error: "Job creator is the paying agent itself (self-transfer). Create the job from a different, Gateway-registered wallet.",
      });
    }

    // Ensure the agent has a Gateway balance (one-time deposit).
    let deposited = false;
    const balances = await client.getBalances();
    if (balances.gateway.available < parseUnits(PRICE_DISPLAY, 6)) {
      await client.deposit("1");
      deposited = true;
    }

    // Pay the x402-protected skill, directing the fee to the job's creator.
    const proto = (req.headers["x-forwarded-proto"] as string) || "http";
    const url = `${proto}://${req.headers.host}/api/skill?payTo=${payTo}&jobId=${jobId}`;
    const result = await client.pay(url);

    return res.status(200).json({
      ok: true,
      agent: client.address,
      jobId,
      payTo,
      paid: result.formattedAmount,
      tx: result.transaction,
      skill: result.data,
      deposited,
    });
  } catch (err: unknown) {
    const e = err as { shortMessage?: string; message?: string };
    return res.status(500).json({ error: e.shortMessage || e.message || "payment failed" });
  }
}
