// Resolve a skill *reference* into its actual source files — no skills are
// stored in this repo; everything is fetched live.
//
//   resolveRemoteSkill("left-pad")            → npm package via unpkg
//   resolveRemoteSkill("@scope/tool@1.2.3")   → scoped + pinned version
//   resolveRemoteSkill("https://…/skill.js")  → raw URL
//
// Returns { name, files: [{ name, content }] }.

import { basename } from "node:path";

const MAX_FETCH = 200000; // chars per file (the auditor truncates further)

async function fetchText(url) {
  const res = await fetch(url, { redirect: "follow" });
  if (!res.ok) throw new Error(`${res.status} ${url}`);
  let t = await res.text();
  if (t.length > MAX_FETCH) t = t.slice(0, MAX_FETCH) + "\n…[truncated]";
  return t;
}

// "left-pad@1.3.0" → "left-pad"; "@scope/name@1.0.0" → "@scope/name"
function displayName(pkg) {
  const at = pkg.lastIndexOf("@");
  return at > 0 ? pkg.slice(0, at) : pkg;
}

async function resolveNpm(pkg) {
  const files = [];
  let manifest = null;

  // package.json carries the tool/skill description — where poisoning hides.
  try {
    const pj = await fetchText(`https://unpkg.com/${pkg}/package.json`);
    files.push({ name: "package.json", content: pj });
    try {
      manifest = JSON.parse(pj);
    } catch {
      /* keep raw */
    }
  } catch {
    /* no manifest reachable */
  }

  // main entry — unpkg resolves main/module/unpkg; fall back to common paths.
  const candidates = [`https://unpkg.com/${pkg}`, `https://unpkg.com/${pkg}/index.js`, `https://unpkg.com/${pkg}/dist/index.js`];
  for (const url of candidates) {
    try {
      const content = await fetchText(url);
      const nm = manifest?.main ? basename(manifest.main) : basename(new URL(url).pathname) || "index.js";
      files.push({ name: nm || "index.js", content });
      break;
    } catch {
      /* try next candidate */
    }
  }

  if (!files.length) throw new Error(`could not fetch npm package "${pkg}" from unpkg`);
  return { name: displayName(pkg), files };
}

export async function resolveRemoteSkill(skill) {
  const s = (skill || "").trim();
  if (!s) throw new Error("no skill given");

  if (/^https?:\/\//i.test(s)) {
    const content = await fetchText(s);
    const file = basename(new URL(s).pathname) || "skill.js";
    return { name: file.replace(/\.(js|ts|mjs|cjs|json)$/i, "") || "skill", files: [{ name: file, content }] };
  }

  return resolveNpm(s);
}
