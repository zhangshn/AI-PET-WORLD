import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import crypto from 'node:crypto';
import {spawnSync} from 'node:child_process';
import {requiredProgramRoles as supportRoles} from '../lib/ai-painter-execution-source-closure-v1.mjs';
import {requiredProgramRoles as decodeRoles} from '../lib/ai-painter-decode1-entry-weight-quality-source-closure-v1.mjs';
import {collectActualExecutionSources, sourceCollectionReport} from '../lib/ai-painter-decode1-entry-weight-quality-source-closure-v1.mjs';

const localPython = path.resolve(process.platform === 'win32'
  ? 'ml/ai-painter/.venv/Scripts/python.exe' : 'ml/ai-painter/.venv/bin/python');
function pythonExecutable() {
  if (fs.existsSync(localPython)) return localPython;
  const result = spawnSync(process.env.PYTHON ?? (process.platform === 'win32' ? 'python' : 'python3'),
    ['-I', '-c', 'import sys; print(sys.executable)'], {windowsHide: true, encoding: 'utf8', timeout: 10000});
  assert.equal(result.status, 0, result.stderr ?? result.error?.message);
  return result.stdout.trim();
}
const python = pythonExecutable();
const capturePath = 'ml/ai-painter/src/ai_painter/complete_world/object_support_structure_failure_capture_v1.py';
const sameCallCapability = 'stage4_mvp256_dry_decode1_entry_weight_quality24_same_call_v1';
const digest = raw => crypto.createHash('sha256').update(raw).digest('hex');

test('current capture import placement retains the reviewed exclusion and actual source identity', () => {
  const root = process.cwd();
  const bind = name => ({path: name, sha256: digest(fs.readFileSync(path.join(root, name)))});
  const sources = collectActualExecutionSources({root, required: {capture: capturePath}, python, bind,
    capabilityVersion: sameCallCapability});
  assert.deepEqual(sources.capture, bind(capturePath));
  const report = sourceCollectionReport();
  const row = report.deferredImportEvidence.find(item => item.path === capturePath);
  assert.deepEqual(row.registration.excludeScopes, ['_joint_program_limit']);
  assert.equal(row.registration.sha256, sources.capture.sha256);
});

test('capture import review rejects even a one-byte unreviewed source change', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'capture-source-identity-'));
  try {
    fs.mkdirSync(path.dirname(path.join(root, capturePath)), {recursive: true});
    fs.writeFileSync(path.join(root, capturePath), Buffer.concat([fs.readFileSync(capturePath), Buffer.from('\n')]));
    const bind = name => ({path: name, sha256: digest(fs.readFileSync(path.join(root, name)))});
    assert.throws(() => collectActualExecutionSources({root, required: {capture: capturePath}, python, bind,
      capabilityVersion: sameCallCapability}), /reviewed late import source changed/u);
  } finally {
    assert.equal(path.dirname(fs.realpathSync(root)), fs.realpathSync(os.tmpdir()));
    assert.match(path.basename(root), /^capture-source-identity-/u);
    fs.rmSync(root, {recursive: true});
  }
});

for (const [name, query, moduleName] of [
  ['support', supportRoles, 'object_support_structure_quality_auth_v1'],
  ['decode', decodeRoles, 'decode1_entry_weight_quality_auth_v1'],
]) {
  test(`${name} role query binds the source actually queried, before and after cache use`, () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'role-source-identity-'));
    const authPath = `ml/ai-painter/scripts/${moduleName}.py`;
    try {
      fs.mkdirSync(path.dirname(path.join(root, authPath)), {recursive: true});
      fs.writeFileSync(path.join(root, authPath), 'def required_program_roles(capability):\n return {"fixtureRole": "fixture/entry.py"}\n');
      // Different bytes/path must not be used as proof for the fixed Python module.
      fs.writeFileSync(path.join(root, 'unrelated.py'), '# not the module that returns roles\n');
      const input = {root, python, capabilityVersion: 'isolated_fixture', authPath};
      assert.throws(() => query({...input, authPath: 'unrelated.py'}), /role query auth path differs from executed module/u);
      assert.deepEqual(query(input), {fixtureRole: 'fixture/entry.py'});
      assert.deepEqual(query(input), {fixtureRole: 'fixture/entry.py'});
      fs.copyFileSync(path.join(root, authPath), path.join(root, 'same-bytes.py'));
      assert.throws(() => query({...input, authPath: 'same-bytes.py'}), /role query auth path differs from executed module/u);
    } finally {
      assert.equal(path.dirname(fs.realpathSync(root)), fs.realpathSync(os.tmpdir()));
      assert.match(path.basename(root), /^role-source-identity-/u);
      fs.rmSync(root, {recursive: true});
    }
  });
}
