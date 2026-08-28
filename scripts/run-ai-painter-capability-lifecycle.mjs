import fs from "node:fs";
import path from "node:path";
import { advanceCapabilityLifecycle, createCapabilityCandidate } from "./lib/ai-painter-capability-lifecycle-v1.mjs";

const args = process.argv.slice(2);
const action = valueOf("--action");
if (action === "create") {
  const candidatePath = required("--candidate");
  const spec = readProjectJson(candidatePath);
  const created = createCapabilityCandidate(spec, { root: process.cwd() });
  process.stdout.write(`${JSON.stringify({ status: created.state.state, capabilityVersion: spec.capabilityVersion, ownerAuthorizationRequired: false }, null, 2)}\n`);
} else if (action === "advance") {
  const evidence = readProjectJson(required("--evidence"));
  const next = advanceCapabilityLifecycle({ root: process.cwd(), capabilityVersion: required("--capability-version"), targetState: required("--target-state"), evidence });
  process.stdout.write(`${JSON.stringify(next, null, 2)}\n`);
} else {
  throw new Error("--action must be create or advance");
}

function readProjectJson(relative) { if (path.isAbsolute(relative) || /^[A-Za-z]:[\\/]/.test(relative) || relative.includes("..")) throw new Error("input path must be project-relative"); const absolute = path.resolve(process.cwd(), relative); if (!absolute.startsWith(`${path.resolve(process.cwd())}${path.sep}`) || !fs.existsSync(absolute)) throw new Error("input path is invalid or missing"); return JSON.parse(fs.readFileSync(absolute, "utf8")); }
function valueOf(name) { const index = args.indexOf(name); return index >= 0 ? args[index + 1] : null; }
function required(name) { const value = valueOf(name); if (!value) throw new Error(`${name} is required`); return value; }
