import type { NextApiRequest, NextApiResponse } from "next";
import { listModels, AttesterError } from "@/lib/chainlink";

// GET /api/chainlink/models — proxy to the attester's /v1/models so the
// browser never sees the API key.
export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== "GET") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const models = await listModels();
    return res.status(200).json({ models });
  } catch (error: unknown) {
    if (error instanceof AttesterError) {
      return res.status(error.status).json({ error: error.message });
    }
    const message = error instanceof Error ? error.message : "Unknown error";
    return res.status(500).json({ error: message });
  }
}
