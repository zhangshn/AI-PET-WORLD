import fs from "node:fs";
import path from "node:path";
import { persistPolicyBoundaryReport } from "./lib/ai-painter-local-autonomy-governance-v3.mjs";

const root = process.cwd();
const inputArgument = valueOf("--input");
if (!inputArgument) throw new Error("--input <project-relative-json-path> is required");
if (path.isAbsolute(inputArgument) || /^[a-zA-Z]:[\\/]/.test(inputArgument) || inputArgument.split(/[\\/]/).includes("..")) {
  throw new Error("--input must be a project-relative path without traversal");
}
const inputPath = path.resolve(root, inputArgument);
if (!inputPath.startsWith(`${path.resolve(root)}${path.sep}`)) throw new Error("input path escapes project root");
const input = JSON.parse(fs.readFileSync(inputPath, "utf8"));
const result = persistPolicyBoundaryReport(input, { root });
process.stdout.write(`${JSON.stringify({
  ok: true,
  status: "policy_boundary_report_persisted_without_owner_wait",
  report: result,
}, null, 2)}\n`);

function valueOf(name) {
  const index = process.argv.indexOf(name);
  return index >= 0 ? process.argv[index + 1] : null;
}
