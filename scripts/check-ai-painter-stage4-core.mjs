import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";

const root = process.cwd();
const node = process.execPath;
const python = process.env.AI_PAINTER_PYTHON
  ?? (process.platform === "win32"
    && fs.existsSync(path.join(root, "ml", "ai-painter", ".venv", "Scripts", "python.exe"))
    ? path.join(root, "ml", "ai-painter", ".venv", "Scripts", "python.exe")
    : process.platform === "win32" ? "python" : "python3");
const currentRegistryPath = path.join(
  root,
  ".runtime",
  "ai-painter",
  "current-execution-registry",
  "current.json",
);
const projectionArgs = fs.existsSync(currentRegistryPath) ? [] : ["--static-only"];
const currentEntrypointArgs = fs.existsSync(currentRegistryPath) ? [] : ["--static-only"];

const checks = [
  ["document-governance", node, ["scripts/check-ai-painter-document-governance.mjs"]],
  ["documentation-policy", node, ["scripts/check-documentation-policy.mjs"]],
  ["source-encoding", node, ["scripts/check-source-encoding.mjs"]],
  ["successor-model-cpu-contract", node, ["scripts/check-ai-painter-stage4-full-resolution-typed-semantic-transport-rgb-responsibility.mjs"]],
  ["successor-cpu-acceptance-regression", node, ["scripts/test-ai-painter-stage4-v2-cpu-contract-acceptance.mjs"]],
  ["successor-python-cpu-contract-regression", python, [
    "-m", "unittest",
    "ml/ai-painter/tests/test_stage4_semantic_transport_v2.py",
    "ml/ai-painter/tests/test_stage4_semantic_transport_v2_trainer_support.py",
    "ml/ai-painter/tests/test_stage4_semantic_transport_v2_readonly_gpu_qualification.py",
    "ml/ai-painter/tests/test_stage4_semantic_transport_v2_controlled_smoke_materialization.py",
  ]],
  ["program-graph-manifest-regression", node, ["scripts/tests/test-ai-painter-program-graph-manifest-v1.mjs"]],
  ["readonly-gpu-qualification-node-regression", node, ["scripts/test-ai-painter-stage4-v2-readonly-gpu-node.mjs"]],
  ["readonly-gpu-qualification-issuer-publication", node, ["scripts/tests/test-ai-painter-stage4-v2-readonly-gpu-issuer-publication.mjs"]],
  ["readonly-gpu-qualification-materialization-recovery", node, ["scripts/tests/test-ai-painter-stage4-v2-readonly-gpu-materialization-recovery.mjs"]],
  ["readonly-gpu-qualification-background-regression", node, ["scripts/test-ai-painter-stage4-v2-readonly-gpu-background-launch.mjs"]],
  ["readonly-gpu-qualification-continuation-regression", node, ["scripts/test-ai-painter-stage4-v2-qualification-continuation.mjs"]],
  ["readonly-gpu-qualification-failure-adjudication", node, ["scripts/tests/test-ai-painter-stage4-v2-readonly-gpu-qualification-failure-adjudication.mjs"]],
  ["successor-capability-lifecycle-reconciliation", node, ["scripts/tests/test-ai-painter-stage4-v2-capability-lifecycle-reconciliation.mjs"]],
  ["exactly-once-background-spawn-regression", node, ["scripts/tests/test-ai-painter-exactly-once-background-spawn.mjs"]],
  ["failure-lifecycle-routing", node, ["scripts/check-ai-painter-stage4-joint-condition-local-transport-lifecycle-routing.mjs"]],
  ["current-entrypoints", node, [
    "scripts/check-ai-painter-current-entrypoints.mjs", ...currentEntrypointArgs,
  ]],
  ["current-registry-contract", node, ["scripts/check-ai-painter-current-execution-registry.mjs"]],
  ["current-registry-atomic-regression", node, ["scripts/tests/test-ai-painter-current-execution-registry-atomic-advance.mjs"]],
  ["controlled-smoke-registry-dependencies", node, ["scripts/tests/test-ai-painter-stage4-v2-smoke-registry-dependencies.mjs"]],
  ["controlled-smoke-ticket-recovery", node, ["scripts/tests/test-ai-painter-stage4-v2-controlled-smoke-ticket-v1.mjs"]],
  ["controlled-smoke-issuer-publication", node, ["scripts/tests/test-ai-painter-stage4-v2-controlled-smoke-issuer-publication.mjs"]],
  ["controlled-smoke-planner", node, ["scripts/tests/test-ai-painter-stage4-v2-controlled-smoke-planner.mjs"]],
  ["controlled-smoke-execute-recovery", node, ["scripts/tests/test-ai-painter-stage4-v2-controlled-smoke-execute-recovery.mjs"]],
  ["controlled-smoke-trainer-process-recovery", node, ["scripts/tests/test-ai-painter-stage4-v2-controlled-smoke-trainer-process-recovery.mjs"]],
  ["controlled-smoke-evidence-telemetry", node, ["scripts/tests/test-ai-painter-stage4-v2-controlled-smoke-evidence-chain.mjs"]],
  ["controlled-smoke-phase-output-recovery", node, ["scripts/tests/test-ai-painter-stage4-v2-controlled-smoke-phase-output-recovery.mjs"]],
  ["controlled-smoke-training-manifest", node, ["scripts/tests/test-ai-painter-stage4-v2-controlled-smoke-training-manifest.mjs"]],
  ["controlled-smoke-machine-review", node, ["scripts/tests/test-ai-painter-stage4-v2-machine-review-execution-v1.mjs"]],
  ["controlled-smoke-background-supervisor", node, ["scripts/tests/test-ai-painter-stage4-v2-controlled-smoke-background-supervisor.mjs"]],
  ["controlled-smoke-host-recovery", node, ["scripts/tests/test-ai-painter-stage4-v2-controlled-smoke-host-recovery.mjs"]],
  ["controlled-smoke-lifecycle-publication", node, ["scripts/tests/test-ai-painter-stage4-v2-lifecycle-publication.mjs"]],
  ["formal-plan-registry-dependencies", node, ["scripts/tests/test-ai-painter-stage4-v2-formal-plan-registry-dependencies.mjs"]],
  ["console-current-projection", node, ["scripts/check-ai-console-current-execution-projection.mjs", ...projectionArgs]],
];

const results = [];
for (const [identity, command, args] of checks) {
  const result = spawnSync(command, args, {
    cwd: root,
    encoding: "utf8",
    windowsHide: true,
    timeout: 240_000,
  });
  if (result.stdout) process.stdout.write(result.stdout);
  if (result.stderr) process.stderr.write(result.stderr);
  assert.equal(result.status, 0, `${identity} failed with exit code ${result.status}`);
  results.push({ identity, status: "passed" });
}

const typeScriptCli = path.join(root, "node_modules", "typescript", "bin", "tsc");
assert.ok(fs.existsSync(typeScriptCli), "local TypeScript CLI is missing; run npm ci before Stage4 core checks");
const typecheck = spawnSync(node, [typeScriptCli, "--noEmit"], {
  cwd: root,
  encoding: "utf8",
  windowsHide: true,
  timeout: 240_000,
});
if (typecheck.stdout) process.stdout.write(typecheck.stdout);
if (typecheck.stderr) process.stderr.write(typecheck.stderr);
if (typecheck.error) throw typecheck.error;
assert.equal(typecheck.status, 0, `TypeScript noEmit failed with exit code ${typecheck.status}`);
results.push({ identity: "typescript-noemit", status: "passed" });

process.stdout.write(`${JSON.stringify({
  status: "passed",
  currentProjectionMode: projectionArgs.length === 0 ? "live_immutable_evidence" : "static_contract_plus_atomic_fixture",
  checks: results,
  gpuStarted: false,
  trainingStarted: false,
}, null, 2)}\n`);
