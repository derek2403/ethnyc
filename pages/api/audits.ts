import type { NextApiRequest, NextApiResponse } from "next";
import { listAudits } from "@/lib/db.mjs";

// GET /api/audits?limit=20 — recent audit records for the Live Audits feed.
// Each record carries status "auditing-1".."auditing-4" → "audited"/"failed".
export default function handler(req: NextApiRequest, res: NextApiResponse) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Cache-Control", "no-store");
  const limit = Math.min(Number(req.query.limit) || 20, 100);
  return res.status(200).json({ audits: listAudits(limit) });
}
