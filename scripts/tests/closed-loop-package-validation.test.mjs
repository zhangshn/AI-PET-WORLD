import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { pathToFileURL } from 'node:url';
import test from 'node:test';
import ts from 'typescript';
import * as validation from '../lib/ai-painter-autonomous-package-validation-v1.mjs';
import * as execution from '../lib/ai-painter-autonomous-closed-loop-v1.mjs';
import { materializeAutonomousClosedLoopPackage } from '../lib/ai-painter-autonomous-package-materializer-v1.mjs';

const project = path.resolve(import.meta.dirname, '../..');
const digest = bytes => crypto.createHash('sha256').update(bytes).digest('hex');
const packageDigest = spec => digest(`${JSON.stringify(spec, null, 2)}\n`);

test('entrypoint token scan permits only the original rejection declaration', () => {
  const file = 'scripts/check-ai-painter-current-entrypoints.mjs';
  const source = ts.createSourceFile(file, fs.readFileSync(file, 'utf8'), ts.ScriptTarget.Latest, true);
  const fn = source.statements.find(n => ts.isFunctionDeclaration(n) && n.name?.text === 'assertNoForbiddenCurrentTokens');
  assert(fn);
  const check = new Function('assert', 'crypto', `return (${fn.getText(source)});`)(assert, crypto);
  const validatorPath = 'scripts/lib/ai-painter-autonomous-package-validation-v1.mjs';
  const validator = fs.readFileSync(validatorPath, 'utf8').replaceAll('\r\n', '\n');
  const tokens = JSON.parse(fs.readFileSync('data/ai-painter/system-governance/ai-painter-current-entrypoint-registry-v1.json', 'utf8')).forbiddenCurrentSourceTokens;
  check(validator, validatorPath, tokens);
  check(validator.replaceAll('\n', '\r\n'), validatorPath, tokens);
  check('export const value = "normal_state";', 'scripts/private-entry.mjs', tokens);
  assert.throws(() => check(validator, 'scripts/private-entry.mjs', tokens), /forbidden token/);
  const declaration = validator.match(/^export const FORBIDDEN_OWNER_TOKENS = \[[\s\S]*?^\];/mu)[0];
  assert.throws(() => check(validator.replace(declaration, ''), validatorPath, tokens), /declaration missing/);
  assert.throws(() => check(validator + '\n' + declaration, validatorPath, tokens), /duplicated/);
  assert.throws(() => check(validator.replace('"waiting_owner_authorization"', '"allowed_incorrectly"'), validatorPath, tokens), /differs/);
  for (const token of tokens) {
    assert.throws(() => check(validator + `\nconst state = ${JSON.stringify(token)};`, validatorPath, tokens), /forbidden token/);
    assert.throws(() => check(`const state = ${JSON.stringify(token)};\n` + validator, validatorPath, tokens), /forbidden token/);
  }
});

for (const token of validation.FORBIDDEN_OWNER_TOKENS) for (const location of ['package', 'adapter'])
test(`rejection vocabulary remains enforced in ${location}: ${token}`, t => {
  const { root, spec } = fixture(t);
  if (location === 'package') spec.diagnostic = token;
  else {
    const binding = spec.phaseAdapters.preflight;
    const target = path.join(root, binding.path);
    fs.appendFileSync(target, `\nexport const prohibitedState = ${JSON.stringify(token)};\n`);
    const sha256 = digest(fs.readFileSync(target));
    for (const adapter of Object.values(spec.phaseAdapters)) if (adapter.path === binding.path) adapter.sha256 = sha256;
  }
  assert.throws(() => validation.validateClosedLoopPackage(spec, {root, packageSha256:packageDigest(spec)}), /forbidden Owner/);
  assert.equal(fs.existsSync(path.join(root, '.runtime')), false);
});

test('current entrypoint static gate accepts the extracted readonly validator', () => {
  const child = spawnSync(process.execPath, ['scripts/check-ai-painter-current-entrypoints.mjs', '--static-only'], {
    cwd:project, encoding:'utf8', windowsHide:true, timeout:30000,
  });
  assert.equal(child.error, undefined);
  assert.equal(child.status, 0, child.stderr);
});

for (const [phase, closeFails, primaryKind = 'error'] of [
  ['open', true], ['write', false], ['write', true],
  ['sync', false], ['sync', true], ['close', true],
  ['write', true, 'frozen'], ['write', true, 'null'],
]) test(`package persistence preserves ${phase} failure, close=${closeFails}, primary=${primaryKind}`, t => {
  const { root, spec } = fixture(t);
  const primaryError = Object.assign(new Error(`${phase} storage failure`), { code: 'ENOSPC' });
  const primary = primaryKind === 'null' ? null : primaryKind === 'frozen' ? Object.freeze(primaryError) : primaryError;
  const closeError = Object.assign(new Error('descriptor close failure'), { code: 'EIO' });
  const candidate = {
    schemaVersion: 'ai-painter-autonomous-closed-loop-candidate-v1',
    packageIdentity: spec.packageIdentity, capabilityVersion: spec.capabilityVersion,
    ownerAuthorizationRequired: false, maxInfrastructureRecoveryAttempts: 0,
    outputRoot: spec.outputRoot, programFiles: { adapter: 'adapters.mjs' },
    inputEvidencePaths: ['input.json'], phaseAdapters: spec.phaseAdapters,
  };
  const packagePath = path.join(root, '.runtime/ai-painter/autonomous-closed-loop-packages', spec.packageIdentity, 'package.json');
  const stagedPath = `${packagePath}.staged`;
  const original = Object.fromEntries(['openSync', 'writeFileSync', 'fsyncSync', 'closeSync'].map(key => [key, fs[key]]));
  let descriptor, closes = 0, thrown = false, actual;
  try {
    fs.openSync = (file, ...args) => {
      if (file !== stagedPath) return original.openSync(file, ...args);
      if (phase === 'open') throw primary;
      descriptor = original.openSync(file, ...args);
      return descriptor;
    };
    fs.writeFileSync = (file, bytes, ...args) => {
      if (file === descriptor && phase === 'write') {
        original.writeFileSync(file, Buffer.from(bytes).subarray(0, 7));
        throw primary;
      }
      return original.writeFileSync(file, bytes, ...args);
    };
    fs.fsyncSync = file => {
      if (file === descriptor && phase === 'sync') throw primary;
      return original.fsyncSync(file);
    };
    fs.closeSync = file => {
      if (file !== descriptor) return original.closeSync(file);
      closes++;
      // Actually close the private descriptor, then simulate the reported close error.
      original.closeSync(file);
      if (closeFails) throw closeError;
    };
    try {
      materializeAutonomousClosedLoopPackage(candidate, { root, recordedAtUtc: '2026-01-01T00:00:00.000Z' });
    } catch (error) { thrown = true; actual = error; }
  } finally {
    for (const [key, value] of Object.entries(original)) fs[key] = value;
  }
  assert.equal(thrown, true);
  assert.equal(actual, phase === 'close' ? closeError : primary);
  assert.equal(closes, phase === 'open' ? 0 : 1);
  assert.equal(fs.existsSync(packagePath), false);
  assert.equal(fs.existsSync(path.join(path.dirname(packagePath), 'manifest.json')), false);
  assert.equal(fs.existsSync(stagedPath), phase !== 'open');
  if (phase === 'write') assert.equal(fs.readFileSync(stagedPath).length, 7);
  if (phase === 'sync' || phase === 'close') {
    assert.equal(JSON.parse(fs.readFileSync(stagedPath)).packageIdentity, spec.packageIdentity);
  }
});

function fixture(t) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'closed-loop-validation-'));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  const contract = path.join(root, validation.CLOSED_LOOP_CONTRACT_PATH);
  fs.mkdirSync(path.dirname(contract), { recursive: true });
  fs.copyFileSync(path.join(project, validation.CLOSED_LOOP_CONTRACT_PATH), contract);
  // Validation must inspect these bytes without executing this module.
  const adapter = 'throw new Error("adapter must not execute during validation");\n';
  fs.writeFileSync(path.join(root, 'adapters.mjs'), adapter);
  fs.writeFileSync(path.join(root, 'input.json'), '{}\n');
  const spec = {
    schemaVersion: 'ai-painter-autonomous-closed-loop-package-v1',
    packageIdentity: 'validation-fixture', capabilityVersion: 'fixture-v1',
    ownerAuthorizationRequired: false, ownerInStateMachine: false,
    maxInfrastructureRecoveryAttempts: 0,
    outputRoot: '.runtime/ai-painter/validation-fixture',
    programLineage: { adapter: digest(adapter) },
    inputEvidence: [{ path: 'input.json', sha256: digest('{}\n') }],
    phaseAdapters: Object.fromEntries(validation.PHASES.map(phase => [phase, {
      kind: 'project_module_export', path: 'adapters.mjs',
      sha256: digest(adapter), exportName: phase,
    }])),
  };
  return { root, spec };
}

test('legacy package API reexports the same validation functions and phase identity', () => {
  for (const key of ['CLOSED_LOOP_CONTRACT_PATH', 'PHASES', 'loadClosedLoopContract',
    'validateClosedLoopPackage', 'sha256File']) assert.equal(execution[key], validation[key]);
});

test('validation checks actual bound bytes and rejects altered inputs and package identity', t => {
  const { root, spec } = fixture(t);
  const options = { root, packageSha256: packageDigest(spec) };
  assert.equal(validation.validateClosedLoopPackage(spec, options), true);
  assert.equal(fs.existsSync(path.join(root, '.runtime')), false);
  assert.throws(() => validation.validateClosedLoopPackage({ ...spec, capabilityVersion: 'changed' }, options), /does not bind/);
  fs.writeFileSync(path.join(root, 'input.json'), '{"changed":true}\n');
  assert.throws(() => validation.validateClosedLoopPackage(spec, options), /evidence SHA-256 mismatch/);
  assert.equal(fs.existsSync(path.join(root, '.runtime')), false);
});

test('package materialization and validation work with execution and SQLite imports forbidden', t => {
  const { root, spec } = fixture(t);
  const moduleUrl = pathToFileURL(path.join(project, 'scripts/lib/ai-painter-autonomous-package-materializer-v1.mjs')).href;
  const source = `
    import { registerHooks } from 'node:module';
    import fs from 'node:fs';
    import assert from 'node:assert/strict';
    const loaded=[];
    registerHooks({resolve(name,context,next) {
      if(name==='node:sqlite'||/ai-painter-autonomous-closed-loop-v1|ai-painter-local-autonomy-governance/.test(name))
        throw Error('Forbidden execution dependency: '+name);
      loaded.push(name);return next(name,context);
    }});
    const {materializeAutonomousClosedLoopPackage}=await import(${JSON.stringify(moduleUrl)});
    const spec=${JSON.stringify(spec)};
    const candidate={schemaVersion:'ai-painter-autonomous-closed-loop-candidate-v1',
      packageIdentity:spec.packageIdentity,capabilityVersion:spec.capabilityVersion,
      ownerAuthorizationRequired:false,maxInfrastructureRecoveryAttempts:0,
      outputRoot:spec.outputRoot,programFiles:{adapter:'adapters.mjs'},inputEvidencePaths:['input.json'],
      phaseAdapters:spec.phaseAdapters};
    const options={root:${JSON.stringify(root)},recordedAtUtc:'2026-01-01T00:00:00.000Z'};
    const first=materializeAutonomousClosedLoopPackage(candidate,options);
    const recovered=materializeAutonomousClosedLoopPackage(candidate,{...options,recoverExistingExact:true});
    assert.deepEqual(recovered,first);
    assert.equal(JSON.parse(fs.readFileSync(options.root+'/'+first.manifestPath)).status,'materialized_not_started');
    assert.equal(fs.existsSync(options.root+'/.runtime/ai-painter/autonomous-closed-loop-executions'),false);
    assert.throws(()=>materializeAutonomousClosedLoopPackage(candidate,options),/already exists/);
    console.log(JSON.stringify({loaded:loaded.length,recovered:true}));
  `;
  const child = spawnSync(process.execPath, ['--input-type=module', '-e', source], {
    encoding: 'utf8', windowsHide: true, timeout: 15000,
  });
  assert.equal(child.error, undefined);
  assert.equal(child.status, 0, child.stderr);
  assert.equal(JSON.parse(child.stdout).recovered, true);
});
