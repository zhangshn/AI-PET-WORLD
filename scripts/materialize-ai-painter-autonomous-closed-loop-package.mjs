import fs from "node:fs";
import path from "node:path";
import { materializeAutonomousClosedLoopPackage } from "./lib/ai-painter-autonomous-package-materializer-v1.mjs";

const args = process.argv.slice(2);
const candidatePath = valueOf("--candidate");
if (!candidatePath) throw new Error("--candidate is required");
if (path.isAbsolute(candidatePath) || /^[A-Za-z]:[\\/]/.test(candidatePath) || candidatePath.includes("..")) throw new Error("candidate path must be project-relative");
const absolute = path.resolve(process.cwd(), candidatePath);
if (!absolute.startsWith(`${path.resolve(process.cwd())}${path.sep}`) || !fs.existsSync(absolute)) throw new Error("candidate path is invalid or missing");
const candidate = JSON.parse(fs.readFileSync(absolute, "utf8"));
const result = materializeAutonomousClosedLoopPackage(candidate, { root: process.cwd() });
process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);

function valueOf(name) { const index = args.indexOf(name); return index >= 0 ? args[index + 1] : null; }
