import assert from "node:assert/strict";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { pathToFileURL } from "node:url";
import { parseArgs } from "node:util";

export const PORTABLE_CPU_SCOPE = "repository_portable_cpu";
const CHECKS = Object.freeze([
  ["document-governance", "scripts/check-ai-painter-document-governance.mjs"],
  ["documentation-policy", "scripts/check-documentation-policy.mjs"],
  ["source-encoding", "scripts/check-source-encoding.mjs"],
  ["program-graph-manifest-regression", "scripts/tests/test-ai-painter-program-graph-manifest-v1.mjs"],
  ["controlled-smoke-failure-adjudication-intent", "scripts/tests/test-ai-painter-stage4-v2-controlled-smoke-failure-adjudication-intent.mjs"],
  ["formal-plan-registry-dependencies", "scripts/tests/test-ai-painter-stage4-v2-formal-plan-registry-dependencies.mjs"],
  ["historical-exposure-evidence-regression", "scripts/tests/test-ai-painter-stage4-historical-exposure.mjs"],
  ["measurement-derived-hydrology-projection", "scripts/tests/test-measurement-derived-hydrology-projection.mjs"],
].map(entry => Object.freeze(entry)));
export const PORTABLE_CPU_CHECK_IDENTITIES = Object.freeze(CHECKS.map(([identity]) => identity));
export const PORTABLE_CPU_NOT_VERIFIED = Object.freeze([
  "real_source_assets", "fixed_historical_run_evidence", "production_background_execution",
  "full_model", "visual_quality", "release", "complete_local_stage4_core",
]);

// Structural validation only: this summary can never grant qualification.
export function validatePortableCpuSummary(summary) {
  assert.equal(summary?.schemaVersion, "ai-painter-stage4-portable-cpu-summary-v1");
  assert.equal(summary.scope, PORTABLE_CPU_SCOPE);
  assert.equal(summary.qualificationGranted, false);
  assert.equal(summary.realAssetAudit, "not_run");
  assert.equal(summary.gpuStarted, false);
  assert.equal(summary.trainingStarted, false);
  assert.deepEqual(summary.notVerified, PORTABLE_CPU_NOT_VERIFIED);
  assert.equal(summary.status, "passed", "portable_cpu_checks_not_passed");
  assert.deepEqual(summary.failures, []);
  assert.ok(Array.isArray(summary.checks));
  assert.deepEqual(summary.checks.map(check => check?.identity), PORTABLE_CPU_CHECK_IDENTITIES,
    "portable_cpu_inventory_incomplete_duplicate_or_changed");
  for (const check of summary.checks) {
    assert.equal(check.status, "passed");
    assert.equal(check.exitCode, 0);
    assert.equal(check.signal, null);
    assert.equal(check.error, null);
    assert.equal(check.timedOut, false);
    assert.ok(Number.isSafeInteger(check.elapsedMs) && check.elapsedMs >= 0);
  }
  return true;
}

export function runPortableCpuChecks() {
  const checks = [];
  for (const [identity, file] of CHECKS) {
    const started = performance.now();
    process.stderr.write(`[portable-cpu] ${new Date().toISOString()} start ${identity}\n`);
    const result = spawnSync(process.execPath,
      ["--max-old-space-size=512", "--test", "--test-concurrency=1", file], {
        cwd: process.cwd(), encoding: "utf8", windowsHide: true,
        timeout: 240_000, maxBuffer: 8 * 1024 * 1024,
        env: { ...process.env, NODE_OPTIONS: "--max-old-space-size=512",
          CUDA_VISIBLE_DEVICES: "", NVIDIA_VISIBLE_DEVICES: "none",
          OMP_NUM_THREADS: "2", MKL_NUM_THREADS: "2", OPENBLAS_NUM_THREADS: "2",
          PYTHONDONTWRITEBYTECODE: "1" },
      });
    if (result.stdout) process.stderr.write(result.stdout);
    if (result.stderr) process.stderr.write(result.stderr);
    const check = { identity,
      status: result.status === 0 && !result.error && !result.signal ? "passed" : "failed",
      exitCode: result.status, signal: result.signal ?? null,
      error: result.error ? `${result.error.code ?? result.error.name}: ${result.error.message}` : null,
      timedOut: result.error?.code === "ETIMEDOUT", elapsedMs: Math.ceil(performance.now() - started) };
    checks.push(check);
    process.stderr.write(`[portable-cpu] ${new Date().toISOString()} ${check.status} ${identity}\n`);
  }
  const failures = checks.filter(check => check.status !== "passed");
  const summary = { schemaVersion: "ai-painter-stage4-portable-cpu-summary-v1",
    scope: PORTABLE_CPU_SCOPE, status: failures.length ? "failed" : "passed",
    qualificationGranted: false, realAssetAudit: "not_run", gpuStarted: false, trainingStarted: false,
    notVerified: [...PORTABLE_CPU_NOT_VERIFIED], checks, failures };
  if (!failures.length) validatePortableCpuSummary(summary);
  return summary;
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  const { values } = parseArgs({ options: { scope: { type: "string", default: PORTABLE_CPU_SCOPE } } });
  assert.equal(values.scope, PORTABLE_CPU_SCOPE, "unsupported portable CPU scope");
  const summary = runPortableCpuChecks();
  process.stdout.write(`${JSON.stringify(summary, null, 2)}\n`);
  if (summary.status !== "passed") process.exitCode = 1;
}
