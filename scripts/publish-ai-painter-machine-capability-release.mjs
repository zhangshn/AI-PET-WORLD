import fs from "node:fs";
import path from "node:path";
import { publishMachineAdjudicatedCapability } from "./lib/ai-painter-machine-capability-release-orchestrator-v1.mjs";

const args = process.argv.slice(2);
const draftPath = required("--draft");
const revisionText = required("--expected-registry-revision");
if (!/^\d+$/.test(revisionText)) throw new Error("expected registry revision must be an integer");
if (path.isAbsolute(draftPath) || /^[A-Za-z]:[\\/]/.test(draftPath) || draftPath.includes("..")) throw new Error("draft path must be project-relative");
const absolute = path.resolve(process.cwd(), draftPath);
if (!absolute.startsWith(`${path.resolve(process.cwd())}${path.sep}`) || !fs.existsSync(absolute)) throw new Error("draft path is invalid or missing");
const draft = JSON.parse(fs.readFileSync(absolute, "utf8"));
const result = publishMachineAdjudicatedCapability(draft, { root: process.cwd(), expectedRegistryRevision: Number(revisionText) });
process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
function valueOf(name) { const index = args.indexOf(name); return index >= 0 ? args[index + 1] : null; }
function required(name) { const value = valueOf(name); if (!value) throw new Error(`${name} is required`); return value; }
