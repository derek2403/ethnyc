import type { NextApiRequest, NextApiResponse } from "next";
import { getAttestation } from "@/lib/db.mjs";

// GET /api/attest?id=<auditId> — the full TDX attestation (quote + details) for
// one audit. Bulky, so it's fetched on click rather than polled via /api/state.
export default function handler(req: NextApiRequest, res: NextApiResponse) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Cache-Control", "no-store");
  const id = String(req.query.id ?? "").trim();
  if (!id) return res.status(400).json({ error: "id required" });
  const att = getAttestation(id);
  if (!att) return res.status(404).json({ error: "no attestation for " + id });
  return res.status(200).json(att);
}
