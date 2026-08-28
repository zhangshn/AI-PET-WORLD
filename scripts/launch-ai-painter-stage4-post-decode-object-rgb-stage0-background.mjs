import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { launchProjectCommandBackground } from "./lib/ai-painter-autonomous-background-launcher-v1.mjs";

const ROOT = process.cwd();
const args = process.argv.slice(2);
const capabilityVersion = valueOf("--capability-version");
const runId = valueOf("--run-id");
const preflightTerminalPath = valueOf("--preflight-terminal");
const preflightTerminalSha256 = valueOf("--preflight-terminal-sha256");
assert(/^[a-z0-9][a-z0-9-]{7,127}$/.test(capabilityVersion ?? ""), "capability version is invalid");
assert(/^[a-z0-9][a-z0-9-]{7,127}$/.test(runId ?? ""), "runId is invalid");
assert(/^[a-f0-9]{64}$/.test(preflightTerminalSha256 ?? ""), "preflight terminal SHA-256 is invalid");

const lifecyclePath = inside(`.runtime/ai-painter/capability-lifecycle/${capabilityVersion}/state.json`);
const lifecycle = read(lifecyclePath);
assert(lifecycle.state === "controlled_smoke_completed", "capability is not ready for formal Stage 0");
assert(lifecycle.ownerAuthorizationRequired === false && lifecycle.ownerResponseRequired === false, "capability lifecycle cannot wait for Owner");
const evidencePath = inside(`.runtime/ai-painter/capability-lifecycle/${capabilityVersion}/${lifecycle.latestEvidence.path}`);
const evidence = read(evidencePath);
assert(evidence.targetState === "controlled_smoke_completed" && evidence.status === "passed", "qualified Smoke evidence is invalid");
for (const binding of evidence.bindings) assert(sha(inside(binding.path)) === binding.sha256, `Smoke evidence changed: ${binding.path}`);

const preflightPath = inside(preflightTerminalPath);
assert(sha(preflightPath) === preflightTerminalSha256, "preflight terminal SHA-256 mismatch");
const preflight = read(preflightPath);
assert(preflight.status === "stage4_post_decode_object_rgb_stage0_preflight_passed_gpu_not_started", "formal Stage 0 preflight did not pass");
assert(preflight.capabilityVersion === capabilityVersion, "preflight capability identity mismatch");
assert(preflight.gpuStarted === false && preflight.optimizerCreated === false && preflight.backwardExecuted === false && preflight.trainingStarted === false, "preflight has forbidden training side effects");

const output = `.runtime/ai-painter/stage4-post-decode-object-rgb-formal-stage0/${runId}`;
assert(!fs.existsSync(insideNonExisting(output)), "formal Stage 0 runId or output already exists");
const launchIdentity = `post-decode-object-rgb-stage0-${runId}`;
const receipt = launchProjectCommandBackground({
  root: ROOT,
  launchIdentity,
  receiptRoot: ".runtime/ai-painter/stage4-post-decode-object-rgb-stage0-background-launches",
  runnerPath: "scripts/run-ai-painter-stage4-authoritative-semantic-carrier-stage0.mjs",
  runnerArgs: [
    "--post-decode-object-rgb",
    "--capability-version", capabilityVersion,
    "--run-id", runId,
  ],
});
process.stdout.write(`${JSON.stringify({
  ...receipt,
  capabilityVersion,
  runId,
  stage: 0,
  outputRoot: output,
  preflightTerminal: { path: normalize(preflightTerminalPath), sha256: preflightTerminalSha256 },
  lifecycle: { path: normalize(path.relative(ROOT, lifecyclePath)), sha256: sha(lifecyclePath) },
  ownerAuthorizationRequired: false,
}, null, 2)}\n`);

function valueOf(name) { const index = args.indexOf(name); return index >= 0 ? args[index + 1] : null; }
function inside(relativePath) {
  const absolute = insideNonExisting(relativePath);
  assert(fs.existsSync(absolute) && fs.statSync(absolute).isFile(), `file is missing: ${relativePath}`);
  return absolute;
}
function insideNonExisting(relativePath) {
  assert(typeof relativePath === "string" && relativePath && !path.isAbsolute(relativePath) && !/^[A-Za-z]:[\\/]/.test(relativePath), "path must be project-relative");
  const absolute = path.resolve(ROOT, relativePath);
  assert(absolute.startsWith(`${path.resolve(ROOT)}${path.sep}`), "path escapes project root");
  return absolute;
}
function read(file) { return JSON.parse(fs.readFileSync(file, "utf8")); }
function sha(file) { return crypto.createHash("sha256").update(fs.readFileSync(file)).digest("hex"); }
function normalize(value) { return value.replaceAll("\\", "/"); }
function assert(condition, message) { if (!condition) throw new Error(message); }
