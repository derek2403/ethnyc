import type { NextApiRequest, NextApiResponse } from "next";
import { checkAgentHuman } from "@/lib/world-agentkit";

const AGENT_BOOK_CONTRACT = "0xA23aB2712eA7BBa896930544C7d6636a96b944dA";

type Step = { step: string; status: string; detail: string };

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const { address } = req.body;

  if (!address) {
    return res.status(400).json({ error: "address is required" });
  }

  try {
    const steps: Step[] = [];

    // Step 1: Call AgentBook contract on World Chain
    steps.push({
      step: "AgentBook Lookup",
      status: "running",
      detail: `Calling lookupHuman(${address}) on World Chain contract ${AGENT_BOOK_CONTRACT.slice(0, 6)}...`,
    });

    const humanId = await checkAgentHuman(address);

    // Step 2: Evaluate the result
    if (!humanId) {
      steps[0].status = "done";
      steps[0].detail = "lookupHuman returned 0 — no human linked";
      steps.push({
        step: "Verification",
        status: "failed",
        detail:
          "Wallet not registered on AgentBook. No World ID proof tied to this agent.",
      });

      return res.status(403).json({
        verified: false,
        address,
        humanId: null,
        steps,
      });
    }

    steps[0].status = "done";
    steps[0].detail = `lookupHuman returned humanId: ${humanId}`;
    steps.push({
      step: "Verification",
      status: "passed",
      detail: `Wallet is backed by a verified human. Anonymous humanId: ${humanId}`,
    });

    return res.status(200).json({
      verified: true,
      address,
      humanId,
      steps,
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return res.status(500).json({ error: message });
  }
}
