// pages/api/session.ts — the active PORTAL session bridge.
//   GET             → { agent_id } of the agent most recently logged in via the API
//   GET ?clear=1    → clears the session (used by the portal's Disconnect)
// A CLI `curl /api/login?agent=…` (or register-cli) records the agent here, and the
// browser ConnectAgent cell polls this endpoint and adopts it — so logging in from
// the terminal also logs you into the browser portal.
import type { NextApiRequest, NextApiResponse } from "next";
import { getSession, clearSession } from "@/lib/db.mjs";

export default function handler(req: NextApiRequest, res: NextApiResponse) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Cache-Control", "no-store");
  if (req.query.clear === "1" || req.query.clear === "true" || req.method === "DELETE") {
    clearSession();
    return res.status(200).json({ ok: true, agent_id: null });
  }
  return res.status(200).json(getSession());
}
