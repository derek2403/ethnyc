import type { NextApiRequest, NextApiResponse } from "next";
import {
  auditSkill,
  AttesterError,
  type SkillForAudit,
} from "@/lib/chainlink";

// Inference runs inside the enclave and can take a while; allow the route to
// stay open long enough to poll to a terminal state.
export const config = {
  maxDuration: 300,
};

// POST /api/chainlink/audit
//
// The MARS Chainlink step: submit a skill to the Confidential AI Attester and
// get back an ATTESTED verdict (SAFE / DANGEROUS + capability manifest). The
// per-resource digests in `resources` bind the verdict to the exact skill
// version — the references a contract verifies before the HTS VERIFIED token
// is minted and the verdict is written to Hedera HCS.
//
// Body: { name, description, source?, declaredCapabilities?,
//         evidence?, resources?, model? }
export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const { name, description, source, declaredCapabilities, evidence, resources, model } =
    req.body ?? {};
  if (!name || !description) {
    return res
      .status(400)
      .json({ error: "name and description are required" });
  }

  const skill: SkillForAudit = {
    name,
    description,
    source,
    declaredCapabilities,
    evidence,
    resources,
  };

  try {
    const attested = await auditSkill(skill, { model });
    return res.status(200).json(attested);
  } catch (error: unknown) {
    if (error instanceof AttesterError) {
      return res
        .status(error.status)
        .json({ error: error.message, code: error.code });
    }
    const message = error instanceof Error ? error.message : "Unknown error";
    return res.status(500).json({ error: message });
  }
}
