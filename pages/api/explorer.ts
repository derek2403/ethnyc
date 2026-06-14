// pages/api/explorer.ts — the MARS block-explorer API. Indexes db/*.json and resolves
// any id/name to a fully cross-linked detail object (user · auditor · skill · audit),
// including the audit trail, attestation/TDX quote, ratings, and auditor comments.
//
//   GET /api/explorer                  → { templates, counts }            (landing)
//   GET /api/explorer?list=1           → { counts, skills, audits, … }    (browse all)
//   GET /api/explorer?q=<id|name>      → { match } exact, or { matches }   (search)
//   GET /api/explorer?q=…&exact=1      → { match } or 404                  (resolve only)
//
// Examples:
//   /api/explorer?q=index                 (skill → versions + audits + trail + attestation)
//   /api/explorer?q=0.0.9229334           (audit → trail + synthesizer + TDX quote + review)
//   /api/explorer?q=0.0.9227928           (auditor → rating + every comment + audits performed)
//   /api/explorer?q=0.0.9227937           (user → licensed skills + audits requested + reviews given)
import type { NextApiRequest, NextApiResponse } from "next";
import { resolve, search, listAll, SEARCH_TEMPLATES } from "@/lib/explorer.mjs";

export default function handler(req: NextApiRequest, res: NextApiResponse) {
  res.setHeader("Cache-Control", "no-store");
  const q = String(req.query.q ?? "").trim();
  const exact = req.query.exact === "1" || req.query.exact === "true";

  // browse-all index
  if (req.query.list === "1" || req.query.list === "true") {
    return res.status(200).json(listAll());
  }

  // landing: templates + counts (no query)
  if (!q) {
    return res.status(200).json({ templates: SEARCH_TEMPLATES, ...listAll() });
  }

  // resolve the exact entity (an id or a skill name)
  const match = resolve(q);

  if (exact) {
    if (!match) return res.status(404).json({ error: `nothing resolves "${q}"`, templates: SEARCH_TEMPLATES });
    return res.status(200).json({ query: q, match });
  }

  // default: return the resolved entity AND the list of partial matches (so the UI
  // can show both "here's the best hit" and "did you mean…").
  const matches = search(q);
  return res.status(200).json({ query: q, match: match ?? null, matches });
}
