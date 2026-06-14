import type { NextApiRequest, NextApiResponse } from "next";
import { deriveState } from "@/lib/db.mjs";

// GET /api/state — the single source of truth for the dashboard, derived from
// the JSON DB (db/audits.json + db/skills.json). The frontend polls this.
export default function handler(_req: NextApiRequest, res: NextApiResponse) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Cache-Control", "no-store");
  return res.status(200).json(deriveState());
}
