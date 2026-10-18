import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { test } from "node:test";
import { PORTABLE_CPU_SCOPE, PORTABLE_CPU_CHECK_IDENTITIES, PORTABLE_CPU_NOT_VERIFIED,
  validatePortableCpuSummary } from "../check-ai-painter-stage4-portable-cpu.mjs";
import { validateStage4CoreQualificationSummary } from "../check-ai-painter-stage4-core.mjs";

function summary() {
  return { schemaVersion: "ai-painter-stage4-portable-cpu-summary-v1", scope: PORTABLE_CPU_SCOPE,
    status: "passed", failures: [], qualificationGranted: false, realAssetAudit: "not_run",
    gpuStarted: false, trainingStarted: false, notVerified: [...PORTABLE_CPU_NOT_VERIFIED],
    checks: PORTABLE_CPU_CHECK_IDENTITIES.map(identity => ({ identity, status: "passed",
      exitCode: 0, signal: null, error: null, timedOut: false, elapsedMs: 1 })) };
}
test("portable results remain structurally separate from complete local qualification", () => {
  assert.equal(validatePortableCpuSummary(summary()), true);
  assert.throws(() => validateStage4CoreQualificationSummary(summary()), /cpu_core_check_inventory/);
});
for (const [name, mutate] of [
  ["missing check", s => s.checks.pop()],
  ["duplicate check", s => { s.checks[1] = { ...s.checks[0] }; }],
  ["fabricated pass exit", s => { s.checks[0].exitCode = 1; }],
  ["failed check", s => { s.checks[0].status = "failed"; }],
  ["timeout", s => { s.checks[0].timedOut = true; }],
  ["process error", s => { s.checks[0].error = "ENOENT"; }],
  ["signal", s => { s.checks[0].signal = "SIGTERM"; }],
  ["failure list", s => s.failures.push(s.checks[0])],
  ["failed summary", s => { s.status = "failed"; }],
  ["scope", s => { s.scope = "complete_local_stage4_core"; }],
  ["qualification", s => { s.qualificationGranted = true; }],
  ["real asset claim", s => { s.realAssetAudit = "passed"; }],
  ["GPU claim", s => { s.gpuStarted = true; }],
  ["training claim", s => { s.trainingStarted = true; }],
  ["omitted limitation", s => s.notVerified.pop()],
]) test(`portable validator rejects ${name}`, () => {
  const value = summary(); mutate(value);
  assert.throws(() => validatePortableCpuSummary(value));
});

test("importing the runner performs no checks, writes, output or exit-status mutation", () => {
  const temp = fs.realpathSync(os.tmpdir());
  const root = fs.mkdtempSync(path.join(temp, "stage4-portable-import-"));
  try {
    const url = new URL("../check-ai-painter-stage4-portable-cpu.mjs", import.meta.url).href;
    const result = spawnSync(process.execPath, ["--max-old-space-size=512", "--input-type=module", "-e",
      `process.exitCode = 7; await import(${JSON.stringify(url)});`], {
      cwd: root, encoding: "utf8", windowsHide: true, timeout: 10_000 });
    assert.equal(result.error, undefined);
    assert.equal(result.status, 7);
    assert.equal(result.stdout, ""); assert.equal(result.stderr, "");
    assert.deepEqual(fs.readdirSync(root), []);
  } finally {
    assert.equal(path.dirname(fs.realpathSync(root)), temp);
    assert.match(path.basename(root), /^stage4-portable-import-/);
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test("runner records process errors and timeouts even with a fabricated zero exit", () => {
  const url = new URL("../check-ai-painter-stage4-portable-cpu.mjs", import.meta.url).href;
  const result = spawnSync(process.execPath, ["--max-old-space-size=512", "--input-type=module", "-e",
    `import assert from 'node:assert/strict';
     import childProcess from 'node:child_process';
     import { syncBuiltinESMExports } from 'node:module';
     let calls = 0;
     childProcess.spawnSync = (_command, args, options) => {
       assert.equal(options.timeout, 240000);
       assert.equal(options.env.CUDA_VISIBLE_DEVICES, '');
       assert.equal(options.env.OMP_NUM_THREADS, '2');
       assert.ok(args.includes('--max-old-space-size=512'));
       calls++;
       return { status: 0, signal: null, error: Object.assign(new Error('fixture timeout'), { code: 'ETIMEDOUT' }) };
     };
     syncBuiltinESMExports();
     const runner = await import(${JSON.stringify(url)});
     const summary = runner.runPortableCpuChecks();
     assert.equal(calls, runner.PORTABLE_CPU_CHECK_IDENTITIES.length);
     assert.equal(summary.status, 'failed');
     assert.equal(summary.failures.length, calls);
     assert.ok(summary.checks.every(c => c.status === 'failed' && c.timedOut && c.error));
     assert.throws(() => runner.validatePortableCpuSummary(summary));`], {
    encoding: "utf8", windowsHide: true, timeout: 10_000 });
  assert.equal(result.error, undefined);
  assert.equal(result.status, 0, result.stderr);
});

test("missing portable check files produce a failed CLI summary without initializing runtime", () => {
  const temp = fs.realpathSync(os.tmpdir());
  const root = fs.mkdtempSync(path.join(temp, "stage4-portable-missing-"));
  try {
    const file = new URL("../check-ai-painter-stage4-portable-cpu.mjs", import.meta.url);
    const result = spawnSync(process.execPath, ["--max-old-space-size=512",
      fileURLToPath(file), "--scope", PORTABLE_CPU_SCOPE], {
      cwd: root, encoding: "utf8", windowsHide: true, timeout: 10_000 });
    assert.equal(result.error, undefined);
    assert.equal(result.status, 1);
    const value = JSON.parse(result.stdout);
    assert.equal(value.status, "failed");
    assert.deepEqual(value.checks.map(check => check.identity), PORTABLE_CPU_CHECK_IDENTITIES);
    assert.equal(value.failures.length, PORTABLE_CPU_CHECK_IDENTITIES.length);
    assert.ok(value.checks.every(check => check.status === "failed" && check.exitCode !== 0));
    assert.equal(value.qualificationGranted, false);
    assert.equal(value.realAssetAudit, "not_run");
    assert.deepEqual(fs.readdirSync(root), []);
  } finally {
    assert.equal(path.dirname(fs.realpathSync(root)), temp);
    assert.match(path.basename(root), /^stage4-portable-missing-/);
    fs.rmSync(root, { recursive: true, force: true });
  }
});
