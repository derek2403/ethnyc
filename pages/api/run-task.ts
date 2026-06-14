// pages/api/run-task.ts — the MARS task flow as a streaming, curl-able endpoint.
// An agent passes its account id + the skill/MCP it wants to use; the endpoint
// negotiates, runs the REAL audit, persists everything, and (on SAFE) whitelists
// the agent. Streams live progress — use `curl -N`.
//
//   curl -N "http://localhost:3000/api/run-task?agent_id=0.0.9227937&skill=poisoned-pdf-skill"
//   curl -N "http://localhost:3000/api/run-task?agent_id=0.0.9228428&skill=https://github.com/user/repo/blob/main/SKILL.md"
//   curl -N "http://localhost:3000/api/run-task?agent_id=0.0.9228428&skill=left-pad"
//
// Params:
//   agent_id  — the requester account; whitelisted into the skill's licensed_agents on SAFE
//   skill     — local path | demo name | npm package | github/url (the MCP/skill to audit)
import type { NextApiRequest, NextApiResponse } from "next";
import { runTaskFlow } from "@/lib/task-flow";

// The real audit + Hedera round-trips take a while — keep the connection open.
export const config = { api: { responseLimit: false }, maxDuration: 300 };

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const q = req.method === "POST" ? { ...req.query, ...(req.body ?? {}) } : req.query;
  const agentId = String(q.agent_id ?? q.agentId ?? "").trim();
  const skillRef = String(q.skill ?? q.ref ?? q.package ?? "").trim();

  res.writeHead(200, {
    "Content-Type": "text/plain; charset=utf-8",
    "Cache-Control": "no-store, no-transform",
    "X-Accel-Buffering": "no",
  });
  const w = (s = "") => res.write(s + "\n");

  if (!skillRef) {
    w("ERROR: pass ?skill=<local path | demo name | npm package | github/url>");
    return void res.end();
  }

  try {
    w(`\n  MARS · audit + license`);
    w(`  agent ${agentId || "(none — using demo requester)"}`);
    w(`  skill ${skillRef}`);

    // The shared flow does everything: negotiate+task → real audit → db/skills + whitelist.
    // color:false → plain text for curl (no ANSI escapes). Progress streams through `w`.
    const result = await runTaskFlow({ agentId, skillRef, color: false, write: w });

    // Compact machine-readable summary line at the end (easy for agents to parse).
    w(`RESULT ${JSON.stringify({
      skill: result.skill,
      verdict: result.verdict,
      trust: result.trust,
      licensed: result.licensed,
      requester: result.requester,
      audit_id: result.auditId,
      task_topic: result.taskTopicId,
      attested: result.attested,
      decision: result.decision,
      nft: result.mint ? `${result.mint.tokenId}#${result.mint.serial}` : null,
    })}`);
  } catch (e: unknown) {
    w(`\nERROR: ${e instanceof Error ? e.message : "task flow failed"}`);
  } finally {
    res.end();
  }
}
