#!/usr/bin/env node
// MARS audit — CLI front-end over the shared pipeline (lib/audit-core.mjs).
// Real OpenAI calls per stage; optional Phala TDX seal at the end.
//
// Usage:
//   OPENAI_API_KEY=sk-... node scripts/run-audit.mjs <skill>
//     <skill> = demo skill name (demo/skills/<name>.js) | file path | directory
//
// Optional env: OPENAI_MODEL (default gpt-4o-mini), PHALA_ATTESTOR_URL
// Exit code: 0 = SAFE, 2 = DANGEROUS, 1 = error.

import { existsSync } from "node:fs";
import dotenv from "dotenv";
import { runAuditPipeline, DEFAULT_MODEL } from "../lib/audit-core.mjs";
import { resolveRemoteSkill, resolveLocalDemoSkill, readLocalSkill } from "../lib/skill-source.mjs";

dotenv.config({ path: ".env.local" });
dotenv.config();

const a = (n) => (s) => `\x1b[${n}m${s}\x1b[0m`;
const dim = a("2"), bold = a("1"), green = a("32"), red = a("31"), yellow = a("33"), cyan = a("36"), gray = a("90");
const sevColor = (s) => ({ critical: red, high: red, medium: yellow, low: cyan, none: gray }[String(s).toLowerCase()] || gray);

function die(msg) {
  console.error(red("✗ " + msg));
  process.exit(1);
}

async function resolveSkill(arg) {
  if (!arg) die("No skill given.\n  usage: node scripts/run-audit.mjs <npm-name | url | file | dir>");
  if (existsSync(arg)) return readLocalSkill(arg); // any local file/folder (Claude Skill dir)
  const demo = resolveLocalDemoSkill(arg); // demo/skills/<name>
  if (demo) return demo;
  return resolveRemoteSkill(arg); // npm package or URL
}

function printFindings(findings) {
  if (!findings?.length) return console.log("  " + gray("· no findings"));
  for (const f of findings) {
    console.log(`  ${sevColor(f.severity)(`[${String(f.severity).toUpperCase()}]`)} ${f.title}`);
    if (f.detail) console.log("    " + dim(f.detail));
  }
}

function onEvent(e) {
  if (e.type === "start") {
    console.log(bold(`\n  MARS audit · ${e.name}`));
    console.log(gray(`  ${e.auditId} · model ${e.model}`));
    console.log(gray(`  files: ${e.files.join(", ")}\n`));
  } else if (e.type === "stage" && e.status === "running") {
    console.log(cyan(`  ▶ ${e.name}`) + dim(` — ${e.desc} …`));
  } else if (e.type === "stage" && e.status === "done") {
    console.log("  " + green("✓") + " " + (e.summary || "(no summary)"));
    printFindings(e.findings);
    console.log("");
  } else if (e.type === "synth" && e.status === "running") {
    console.log(cyan("  ▶ Synthesizer") + dim(" — evidence → attested verdict …"));
  } else if (e.type === "synth" && e.status === "done") {
    console.log("  " + green("✓") + " verdict produced\n");
  } else if (e.type === "attest" && e.status === "running") {
    console.log(cyan("  ▶ TEE attestation") + dim(" — sealing record in Phala enclave …"));
  } else if (e.type === "attest" && e.status === "done") {
    const badge = e.attestation.mocked ? yellow("MOCK (no CVM)") : green("attested ✓");
    console.log("  " + green("✓") + ` ${badge}  reportData 0x${e.attestation.reportData.slice(0, 20)}…`);
    console.log("    " + dim("verify: " + (e.attestation.verify || "https://proof.t16z.com/")) + "\n");
  } else if (e.type === "attest" && e.status === "error") {
    console.log("  " + yellow("! TEE attestation skipped: " + e.error) + "\n");
  }
}

async function main() {
  if (!process.env.OPENAI_API_KEY) die("Set OPENAI_API_KEY.");
  const skill = await resolveSkill(process.argv[2]);

  const { verdict } = await runAuditPipeline({
    name: skill.name,
    files: skill.files,
    apiKey: process.env.OPENAI_API_KEY,
    model: process.env.OPENAI_MODEL || DEFAULT_MODEL,
    attestorUrl: process.env.PHALA_ATTESTOR_URL,
    onEvent,
  });

  if (!process.env.PHALA_ATTESTOR_URL) console.log(gray("  (set PHALA_ATTESTOR_URL to seal this audit in a TDX quote)\n"));

  const safe = verdict.verdict === "SAFE";
  console.log("  " + "─".repeat(50));
  console.log(`  Verdict: ${safe ? green(bold(" SAFE ")) : red(bold(" DANGEROUS "))}  ${dim("risk " + verdict.risk)}`);
  console.log("  " + (verdict.summary || ""));
  if (verdict.capabilities?.length) {
    console.log("\n  " + bold("Capabilities (observed):"));
    for (const c of verdict.capabilities) console.log("    • " + c);
  }
  if (verdict.findings?.length) {
    console.log("\n  " + bold("Findings:"));
    printFindings(verdict.findings);
  }
  if (verdict.recommendation) console.log("\n  " + bold("Recommendation: ") + verdict.recommendation);
  console.log("");

  process.exit(safe ? 0 : 2);
}

main().catch((e) => die(e.message));
