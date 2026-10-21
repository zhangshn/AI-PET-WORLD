// Invocation-local CPU audit. Reuses the existing owner; not a service or scheduler.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { pathToFileURL } from 'node:url';

const root = 'F:/ai-pet-world';
const policyPath = 'data/ai-painter/system-governance/ai-painter-saved-gradient-algebra-cpu-policy-v2.json';
const base = '.runtime/ai-painter/controller-repair-reviews/fix-a69-20261014';
const audit = base + '/parameter48-review-20261018';
const evidence = audit + '/host-attempt-001';
const output = path.join(root, audit, 'attempt-001');
const sha = bytes => crypto.createHash('sha256').update(bytes).digest('hex');
const absolute = logical => {
  assert.equal(typeof logical, 'string');
  assert.ok(!path.isAbsolute(logical) && !logical.includes('\\') && !logical.split('/').some(p => !p || p === '.' || p === '..'));
  return path.join(root, logical);
};
const read = (binding, maximum = 2 * 1024 ** 2) => {
  const location = absolute(binding.path), stat = fs.lstatSync(location);
  assert.ok(stat.isFile() && !stat.isSymbolicLink() && stat.size <= maximum);
  const raw = fs.readFileSync(location);
  assert.equal(sha(raw), binding.sha256, 'binding differs: ' + binding.path);
  return raw;
};
assert.equal(process.argv.length, 3, 'provide the reviewed policy SHA only');
const policySha = process.argv[2];
assert.match(policySha, /^[a-f0-9]{64}$/u);
const started = Date.now(), deadline = started + 120000;
const policyBinding = { path: policyPath, sha256: policySha };
const policy = JSON.parse(read(policyBinding));
assert.equal(policy.schemaVersion, 'ai-painter-saved-gradient-algebra-cpu-policy-v2');
assert.equal(policy.scope, 'saved_gradient_algebra_only');
assert.equal(policy.resources.maxWallSecondsIncludingStartup, 120);
assert.equal(policy.resources.cpuThreads, 2);
assert.equal(policy.resources.attempts, 1);
assert.equal(policy.resources.automaticRetries, 0);
assert.equal(policy.resources.maxOutputMiB, 8);
assert.equal(policy.formalSpecification.version, 'AI-PAINTER-SPEC-1.87');
read(policy.formalSpecification);
assert.equal(policy.executionHost.path, 'scripts/check-ai-painter-saved-gradient-algebra-cpu-v2.mjs');
read(policy.executionHost);
assert.equal(policy.outputRoot, audit + '/attempt-001');
const inventory = JSON.parse(read(policy.registrationInputs));
for (const binding of Object.values(policy.programBindings)) read(binding);
for (const binding of Object.values(inventory.minimalSourceBindings)) read(binding);
for (const binding of Object.values(policy.containmentProgramBindings)) read(binding);
assert.equal(policy.interpreter.absolutePath, root + '/ml/ai-painter/.venv/Scripts/python.exe');
assert.equal(sha(fs.readFileSync(policy.interpreter.absolutePath)), policy.interpreter.sha256);
const registryPath = absolute('.runtime/ai-painter/current-execution-registry/current.json');
const registryBefore = fs.readFileSync(registryPath);
assert.equal(JSON.parse(registryBefore).activeExecution, null, 'active execution present; do not compete');
assert.ok(!fs.existsSync(absolute('.runtime/ai-painter/owned-worker-guards/active.json')), 'existing guard retained');
assert.ok(!fs.existsSync(output), 'original audit attempt is never repeated');
assert.ok(Date.now() < deadline, 'preparation deadline exceeded');
fs.mkdirSync(absolute(evidence)); // Exclusive durable consumption: no automatic retry.
const put = (name, value) => {
  const raw = Buffer.from(JSON.stringify(value, null, 2) + '\n');
  assert.ok(raw.length <= 2 * 1024 ** 2);
  const fd = fs.openSync(path.join(absolute(evidence), name), 'wx');
  try { fs.writeFileSync(fd, raw); fs.fsyncSync(fd); } finally { fs.closeSync(fd); }
  return { path: evidence + '/' + name, sha256: sha(raw), bytes: raw.length };
};
put('claim.json', { policy: policyBinding, recordedAtUtc: new Date().toISOString(),
  deadlineUnixMs: deadline, registrySha256: sha(registryBefore), attempts: 1, automaticRetries: 0 });
let result = null;
try {
  const { runOwnedWorker } = await import(pathToFileURL(absolute('scripts/lib/ai-painter-owned-worker-v1.mjs')));
  const args = ['-B', absolute(policy.programBindings.driver.path), '--project', root,
    '--policy', policyPath, '--policy-sha256', policySha, '--output', output,
    '--deadline-unix-ms', String(deadline)];
  result = await runOwnedWorker(policy.interpreter.absolutePath, args, {
    cwd: root, timeout: Math.max(1, deadline - Date.now()), maxBuffer: 8 * 1024 ** 2,
    abortReason: () => Date.now() >= deadline ? 'CPU audit total deadline exceeded' : null,
    env: { ...process.env, CUDA_VISIBLE_DEVICES: '', OMP_NUM_THREADS: '2', MKL_NUM_THREADS: '2',
      PYTHONDONTWRITEBYTECODE: '1', PYTHONNOUSERSITE: '1', PYTHONPATH: '' },
  });
  assert.equal(result.ownedReceipt.cleanupConfirmed, true);
  assert.equal(result.ownedReceipt.guardReleaseConfirmed, true);
  assert.equal(result.ownedReceipt.ownerClosed, true);
  assert.ok(Date.now() <= deadline, 'CPU total deadline exceeded');
  assert.ok(Buffer.byteLength(result.stdout) <= 65536 && Buffer.byteLength(result.stderr) <= 65536);
  const summary = JSON.parse(result.stdout);
  assert.equal(path.normalize(summary.result), path.join(output, 'real-cpu-algebra-result-v2.json'));
  const resultBinding = { path: policy.outputRoot + '/real-cpu-algebra-result-v2.json', sha256: summary.sha256 };
  const report = JSON.parse(read(resultBinding));
  assert.equal(report.status, 'saved_gradient_algebra_review_completed');
  assert.equal(report.modelForwards + report.autogradCalls + report.optimizerSteps, 0);
  assert.equal(report.cudaInitialized, false);
  assert.equal(report.modelStatesInstalled, false);
  assert.equal(report.qualificationGranted, false);
  assert.equal(report.rootCauseProven, false);
  assert.ok(report.resourceObservation.sampledPeakRssBytes <= 1536 * 1024 ** 2);
  assert.ok(report.resourceObservation.cpuAffinity.length <= 2);
  read(policyBinding);
  for (const binding of Object.values(policy.programBindings)) read(binding);
  for (const binding of Object.values(inventory.minimalSourceBindings)) read(binding);
  assert.equal(sha(fs.readFileSync(registryPath)), sha(registryBefore), 'production registry changed');
  const receipt = put('owned-receipt.json', result.ownedReceipt);
  const acceptance = put('report.json', { status: 'cpu_audit_completed_not_root_cause_or_training_qualification',
    recordedAtUtc: new Date().toISOString(), policy: policyBinding, result: resultBinding, receipt,
    elapsedMsIncludingPreparation: Date.now() - started, productionRegistryUnchanged: true,
    originalFailureComparison: report.recordedFailureComparison, rootCauseProven: false,
    trainingAllowed: false, gpuAllowed: false, automaticRetries: 0 });
  console.log(JSON.stringify({ ...summary, acceptance }));
} catch (error) {
  const failure = put('failure.json', { status: 'failed_closed', recordedAtUtc: new Date().toISOString(),
    policy: policyBinding, error: String(error.stack ?? error).slice(0, 8192), code: error.code ?? null,
    stdout: String(error.stdout ?? result?.stdout ?? '').slice(0, 16384),
    stderr: String(error.stderr ?? result?.stderr ?? '').slice(0, 16384),
    ownedReceipt: error.ownedReceipt ?? result?.ownedReceipt ?? null,
    productionRegistryUnchanged: sha(fs.readFileSync(registryPath)) === sha(registryBefore),
    automaticRetries: 0, cleanupAssumed: false });
  console.error(JSON.stringify({ status: 'failed_closed', failure }));
  process.exitCode = 1;
}
