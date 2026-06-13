import type { NextApiRequest, NextApiResponse } from "next";
import { auditFile, AttesterError } from "@/lib/chainlink";

// Skill files are small, but base64 inflates ~33%; allow some headroom.
export const config = {
  api: { bodyParser: { sizeLimit: "12mb" } },
  maxDuration: 300,
};

// POST /api/chainlink/audit-file
//
// Demo of "this auditor actually audited THIS file." Upload a file (base64),
// the enclave audits it and reports the sha256 of the bytes it read; we
// recompute that sha256 locally and compare. `digestVerified: true` is the
// attestation: the confidential pipeline provably read these exact bytes and
// produced this verdict — the fact you then write to Hedera HCS.
//
// Body: { filename, content_base64, content_type?, note?, model? }
export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const { filename, content_base64, content_type, note, evidence, model } =
    req.body ?? {};
  if (!filename || !content_base64) {
    return res
      .status(400)
      .json({ error: "filename and content_base64 are required" });
  }

  let content: Buffer;
  try {
    content = Buffer.from(content_base64, "base64");
    if (content.length === 0) throw new Error("empty");
  } catch {
    return res.status(400).json({ error: "content_base64 is not valid base64" });
  }

  try {
    const result = await auditFile(
      { name: filename, content, contentType: content_type, note, evidence },
      { model }
    );
    return res.status(200).json(result);
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
