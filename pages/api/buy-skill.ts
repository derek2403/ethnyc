import type { NextApiRequest, NextApiResponse } from "next";
import { GatewayClient } from "@circle-fin/x402-batching/client";
import { parseUnits } from "viem";
import { PRICE_DISPLAY, getAgentKey } from "@/lib/x402";

// The buyer is an AI AGENT with its own EOA + Circle Gateway balance.
// It pays per-use for a verified skill, gas-free, via x402 nanopayments.
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ error: "POST only" });
  }

  try {
    const client = new GatewayClient({ chain: "arcTestnet", privateKey: getAgentKey() });

    // Ensure the agent has a Gateway balance (one-time onchain deposit).
    let deposited = false;
    const balances = await client.getBalances();
    if (balances.gateway.available < parseUnits(PRICE_DISPLAY, 6)) {
      await client.deposit("1"); // fund the agent's Gateway balance
      deposited = true;
    }

    // Pay the x402-protected skill resource (gas-free). pay() runs the full
    // 402 -> sign EIP-3009 -> retry flow against our own /api/skill seller.
    const proto = (req.headers["x-forwarded-proto"] as string) || "http";
    const url = `${proto}://${req.headers.host}/api/skill`;
    const result = await client.pay(url);

    return res.status(200).json({
      ok: true,
      agent: client.address,
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
