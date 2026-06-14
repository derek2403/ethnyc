import type { NextApiRequest, NextApiResponse } from "next";
import { runAuditPipeline, DEFAULT_MODEL } from "@/lib/audit-core.mjs";
import { resolveRemoteSkill } from "@/lib/skill-source.mjs";

// MARS audit endpoint — run the real OpenAI pipeline over a REAL skill via curl.
// Skills are fetched live (npm or URL); nothing is stored in this repo.
//
//   curl "https://mars.derek2403.win/api/audit?skill=left-pad"
//   curl "https://mars.derek2403.win/api/audit?skill=@scope/tool@1.2.3&stream=1"
//   curl "https://mars.derek2403.win/api/audit?skill=https://example.com/skill.js"
//   curl -X POST https://mars.derek2403.win/api/audit \
//        -H 'content-type: application/json' \
//        -d '{"name":"my-skill","source":"<the skill code>"}'
//
// Env (set on the deployment): OPENAI_API_KEY  (required),
//   OPENAI_MODEL (default gpt-4.1-nano), PHALA_ATTESTOR_URL (optional TDX seal).
export const config = {
  api: { bodyParser: { sizeLimit: "4mb" } },
  maxDuration: 300,
};

type Q = Record<string, unknown>;

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "content-type");
  if (req.method === "OPTIONS") return res.status(204).end();
  if (req.method !== "GET" && req.method !== "POST") {
    return res.status(405).json({ error: "Use GET ?skill=<name> or POST {source}" });
  }

  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) return res.status(500).json({ error: "OPENAI_API_KEY is not configured on this deployment" });

  const q: Q = req.method === "GET" ? req.query : { ...req.query, ...(req.body ?? {}) };
  const skillName = String(q.skill ?? q.name ?? "").trim();
  const source = typeof q.source === "string" ? q.source : "";
  const model = String(q.model ?? process.env.OPENAI_MODEL ?? DEFAULT_MODEL);
  const stream = q.stream === "1" || q.stream === true || q.stream === "true";

  // Resolve the skill into files: pasted source, or fetched live (npm / URL).
  let name: string;
  let files: { name: string; content: string }[];
  if (source) {
    name = skillName || "pasted-skill";
    files = [{ name: name.endsWith(".js") ? name : name + ".js", content: source }];
  } else if (skillName) {
    try {
      ({ name, files } = await resolveRemoteSkill(skillName));
    } catch (e: unknown) {
      return res.status(400).json({ error: e instanceof Error ? e.message : `could not resolve skill "${skillName}"` });
    }
  } else {
    return res.status(400).json({ error: "provide ?skill=<npm-name|url> (GET) or {source} (POST)" });
  }

  const opts = { name, files, apiKey, model, attestorUrl: process.env.PHALA_ATTESTOR_URL };

  // Streaming mode → NDJSON, one event per line as the pipeline progresses.
  if (stream) {
    res.setHeader("Content-Type", "application/x-ndjson; charset=utf-8");
    res.setHeader("Cache-Control", "no-cache, no-transform");
    const write = (e: unknown) => {
      res.write(JSON.stringify(e) + "\n");
    };
    try {
      await runAuditPipeline({ ...opts, onEvent: write });
    } catch (e: unknown) {
      write({ type: "error", error: e instanceof Error ? e.message : "audit failed" });
    }
    return res.end();
  }

  // Default → single JSON result.
  try {
    const result = await runAuditPipeline(opts);
    return res.status(200).json(result);
  } catch (e: unknown) {
    return res.status(500).json({ error: e instanceof Error ? e.message : "audit failed" });
  }
}
