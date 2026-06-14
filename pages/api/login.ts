import type { NextApiRequest, NextApiResponse } from "next";
import { getAgent } from "@/lib/db.mjs";

// GET/POST /api/login?agent=<agent_id> — a CLI login: loads the agent's saved
// record (account, topics, rating, role) from db/users.json|auditors.json.
export default function handler(req: NextApiRequest, res: NextApiResponse) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Cache-Control", "no-store");
  const q = req.method === "POST" ? { ...req.query, ...(req.body ?? {}) } : req.query;
  const id = String(q.agent ?? q.agent_id ?? q.id ?? "").trim();
  if (!id) return res.status(400).json({ error: "agent id required (?agent=…)" });

  const rec = getAgent(id);
  if (!rec) return res.status(404).json({ error: `agent "${id}" not found — register first` });

  return res.status(200).json({
    ok: true,
    ...rec,
    env: {
      MARS_AGENT_ID: rec.agent_id,
      MARS_REVIEW_ID: rec.review_topic,
      MARS_RATING: rec.rating,
      MARS_ROLE: rec.role,
    },
  });
}
