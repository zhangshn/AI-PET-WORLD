import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { pathToFileURL } from "node:url";
import { parseArgs } from "node:util";

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
  ["successor-lifecycle-state-semantics", node, ["--test", "scripts/tests/test-ai-painter-stage4-lifecycle-state-semantics.mjs"]],
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
  ["controlled-smoke-planner", node,
    ["scripts/tests/test-ai-painter-stage4-v2-controlled-smoke-planner.mjs"], 360_000],
  ["controlled-smoke-execute-recovery", node, ["scripts/tests/test-ai-painter-stage4-v2-controlled-smoke-execute-recovery.mjs"]],
  ["controlled-smoke-trainer-process-recovery", node, ["scripts/tests/test-ai-painter-stage4-v2-controlled-smoke-trainer-process-recovery.mjs"]],
  ["controlled-smoke-evidence-telemetry", node, ["scripts/tests/test-ai-painter-stage4-v2-controlled-smoke-evidence-chain.mjs"]],
  ["controlled-smoke-phase-output-recovery", node, ["scripts/tests/test-ai-painter-stage4-v2-controlled-smoke-phase-output-recovery.mjs"]],
  ["controlled-smoke-training-manifest", node, ["scripts/tests/test-ai-painter-stage4-v2-controlled-smoke-training-manifest.mjs"]],
  ["controlled-smoke-machine-review", node, ["scripts/tests/test-ai-painter-stage4-v2-machine-review-execution-v1.mjs"]],
  ["controlled-smoke-background-supervisor", node, ["scripts/tests/test-ai-painter-stage4-v2-controlled-smoke-background-supervisor.mjs"]],
  ["controlled-smoke-host-recovery", node, ["scripts/tests/test-ai-painter-stage4-v2-controlled-smoke-host-recovery.mjs"]],
  ["controlled-smoke-lifecycle-publication", node, ["scripts/tests/test-ai-painter-stage4-v2-lifecycle-publication.mjs"]],
  ["controlled-smoke-failure-adjudication-intent", node, ["scripts/tests/test-ai-painter-stage4-v2-controlled-smoke-failure-adjudication-intent.mjs"]],
  ["formal-plan-registry-dependencies", node, ["scripts/tests/test-ai-painter-stage4-v2-formal-plan-registry-dependencies.mjs"]],
  ["formal-stage0-to-stage2-executor", node, ["scripts/tests/test-ai-painter-stage4-v2-formal-stage0-to-stage2-executor.mjs"]],
  ["split-successor-cpu-regression", python, ["-m", "unittest",
    "ml/ai-painter/tests/test_stage4_split_release.py",
    "ml/ai-painter/tests/test_stage4_split_training.py",
  ]],
  ["split-successor-real-parent-check", python, ["ml/ai-painter/scripts/materialize_stage4_v2_split_release.py"]],
  ["split-risk-audit-regression", node, ["--test", "scripts/tests/test-ai-painter-stage4-dataset-audit.mjs"]],
  ["historical-exposure-evidence-regression", node, ["--test", "scripts/tests/test-ai-painter-stage4-historical-exposure.mjs"]],
  ["split-data-adjudication-regression", node, ["--test", "scripts/tests/test-ai-painter-stage4-split-data-adjudication.mjs"]],
  ["split-smoke-preflight-regression", node, ["--test", "scripts/tests/test-ai-painter-stage4-split-smoke-preflight.mjs"]],
  ["composition-review-status-independence", node, ["--test", "scripts/tests/test-ai-painter-stage4-composition-replacement-replay.mjs"]],
  ["smoke-non-train-source-policy", node, ["--test", "scripts/tests/test-ai-painter-stage4-smoke-split-policy.mjs"]],
  ["smoke-python-entry-split-policy", python, ["-m", "unittest", "ml/ai-painter/tests/test_stage4_smoke_split_policy.py"]],
  ["split-smoke-real-trainer-cpu-integration", python, ["-m", "unittest", "ml/ai-painter/tests/test_stage4_split_smoke.py"]],
  ["split-formal-full-epoch-cpu-integration", python, ["-B", "-m", "unittest", "ml/ai-painter/tests/test_stage4_split_formal_training.py"]],
  ["console-current-projection", node, ["scripts/check-ai-console-current-execution-projection.mjs", ...projectionArgs]],
  ["historical-registry-receipt-regression", node, ["--test", "scripts/tests/test-ai-painter-historical-registry-receipt.mjs"]],
  ["current-entrypoint-command-regression", node, ["--test", "scripts/tests/test-ai-painter-current-entrypoint-command.mjs"]],
  ["console-review-availability-regression", node, ["--test", "scripts/tests/test-ai-console-current-projection-availability.mjs"]],
];

export function stage4CoreArgsForComponent(binding, hasSuccessorGraph) {
  if (!hasSuccessorGraph) return ["scripts/check-ai-painter-stage4-core.mjs"];
  assert.ok(typeof binding?.path === "string" && binding.path.length > 0, "explicit CPU component path required");
  assert.match(binding.sha256 ?? "", /^[a-f0-9]{64}$/u, "explicit CPU component hash required");
  return ["scripts/check-ai-painter-stage4-core.mjs", "--component", binding.path, "--sha256", binding.sha256];
}

// The runner and its evidence consumer share ONE inventory. Exporting this
// immutable list must not launch tests or mutate the caller's exit status.
export const STAGE4_CORE_CHECK_IDENTITIES = Object.freeze([
  ...checks.map(([identity]) => identity), "typescript-noemit",
]);

// Both the CPU evidence writer and its consumer use this validator. A passed
// subset or a static-only projection is not full current-candidate evidence.
export function validateStage4CoreQualificationSummary(summary) {
  assert.equal(summary?.status, "passed", "cpu_core_not_passed");
  assert.deepEqual(summary.failures, [], "cpu_core_failures_present");
  assert.ok(Array.isArray(summary.checks)
    && summary.checks.every(check => check && check.status === "passed"
      && typeof check.identity === "string" && check.identity.length > 0
      && !Object.hasOwn(check, "failure")), "cpu_checks_not_passed");
  assert.equal(new Set(summary.checks.map(check => check.identity)).size,
    summary.checks.length, "cpu_checks_duplicate");
  assert.deepEqual(summary.checks.map(check => check.identity), STAGE4_CORE_CHECK_IDENTITIES,
    "cpu_core_check_inventory_incomplete_or_changed");
  assert.equal(summary.currentProjectionMode, "live_immutable_evidence", "cpu_core_live_projection_required");
  for (const key of ["gpuStarted", "trainingStarted"])
    assert.equal(summary[key], false, "cpu_core_execution_scope_conflict");
}

function runStage4Core() {
  const { values } = parseArgs({ options: { component: { type: "string" }, sha256: { type: "string" } } });
  const componentContract = values.component || values.sha256 ? { path: values.component, sha256: values.sha256 } : null;
  if (componentContract) stage4CoreArgsForComponent(componentContract, true);
  const activeChecks = checks.map(check => componentContract && check[0] === "successor-model-cpu-contract"
    ? [check[0], node, ["scripts/check-ai-painter-split-successor-cpu-contract.mjs", "--component", componentContract.path, "--sha256", componentContract.sha256]] : check);
  const results = [];
  const failures = [];
  for (const [identity, command, args, timeout = 240_000] of activeChecks) {
    const started = performance.now();
    process.stderr.write(`[stage4-core] ${new Date().toISOString()} start ${identity}\n`);
    const result = spawnSync(command, args, {
      cwd: root,
      encoding: "utf8",
      windowsHide: true,
      timeout,
    });
    if (result.stdout) process.stdout.write(result.stdout);
    if (result.stderr) process.stderr.write(result.stderr);
    const status = result.status === 0 ? "passed" : "failed";
    const failure = result.error
      ? `${result.error.name}: ${result.error.message}`
      : status === "failed" ? `exit code ${result.status}` : null;
    results.push({ identity, status, ...(failure ? { failure } : {}) });
    if (failure) failures.push({ identity, failure });
    process.stderr.write(`[stage4-core] ${new Date().toISOString()} ${status} ${identity} elapsedMs=${Math.ceil(performance.now() - started)}\n`);
  }

  const typeScriptCli = path.join(root, "node_modules", "typescript", "bin", "tsc");
  if (!fs.existsSync(typeScriptCli)) {
    const failure = "local TypeScript CLI is missing; run npm ci before Stage4 core checks";
    results.push({ identity: "typescript-noemit", status: "failed", failure });
    failures.push({ identity: "typescript-noemit", failure });
  } else {
    const started = performance.now();
    process.stderr.write(`[stage4-core] ${new Date().toISOString()} start typescript-noemit\n`);
    const typecheck = spawnSync(node, [typeScriptCli, "--noEmit"], {
      cwd: root,
      encoding: "utf8",
      windowsHide: true,
      timeout: 240_000,
    });
    if (typecheck.stdout) process.stdout.write(typecheck.stdout);
    if (typecheck.stderr) process.stderr.write(typecheck.stderr);
    const status = typecheck.status === 0 ? "passed" : "failed";
    const failure = typecheck.error
      ? `${typecheck.error.name}: ${typecheck.error.message}`
      : status === "failed" ? `exit code ${typecheck.status}` : null;
    results.push({ identity: "typescript-noemit", status, ...(failure ? { failure } : {}) });
    if (failure) failures.push({ identity: "typescript-noemit", failure });
    process.stderr.write(`[stage4-core] ${new Date().toISOString()} ${status} typescript-noemit elapsedMs=${Math.ceil(performance.now() - started)}\n`);
  }

  const summary = {
    status: failures.length === 0 ? "passed" : "failed",
    ...(componentContract ? { componentContract, inheritedParentQualification: false } : {}),
    currentProjectionMode: projectionArgs.length === 0 ? "live_immutable_evidence" : "static_contract_plus_atomic_fixture",
    checks: results,
    failures,
    gpuStarted: false,
    trainingStarted: false,
  };
  process.stdout.write(`${JSON.stringify(summary, null, 2)}\n`);
  if (failures.length > 0) process.exitCode = 1;
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  runStage4Core();
}
