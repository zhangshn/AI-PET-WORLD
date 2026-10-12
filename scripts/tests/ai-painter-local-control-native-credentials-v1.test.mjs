import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { parseNativeAcceptanceArguments, validateNativeAcceptanceRoot, withNativeAcceptanceCredentials, nativeAcceptanceProcessIdentity } from './ai-painter-local-control-native-cpu-v1.mjs';
import { issueLocalOperatorSession, verifyLocalOperatorMutation } from '../../src/server/ai-console-control/operator-session.ts';

const parent = fs.realpathSync(path.resolve('.runtime/ai-painter/controller-parallel-20261011/migration-local-control'));
const candidate = () => path.join(parent, `native-acceptance-component-${crypto.randomUUID()}`);
test('acceptance supervisor identity matches official PID:creation-date probe without losing precision', () => {
  const creationDate = '2026-10-11T12:06:39.1234567Z';
  assert.equal(nativeAcceptanceProcessIdentity(29608, creationDate), `29608:${creationDate}`);
  const readerSource = fs.readFileSync('src/server/ai-painter-current-execution-registry.mjs', 'utf8');
  assert.ok(readerSource.includes('identity: `${processId}:${value.creationDate}`'));
  for (const [pid, date] of [[0, creationDate], [1.5, creationDate], [1, 'invalid'], [1, creationDate + ' ']]) assert.throws(() => nativeAcceptanceProcessIdentity(pid, date));
});
test('credential mode is explicit and private root must be fresh, physical and in declared parent', () => {
  const evidenceRoot = candidate();
  assert.deepEqual(parseNativeAcceptanceArguments(['--acceptance-root', evidenceRoot, '--credential-mode', 'isolated_acceptance_only']), { evidenceRoot, credentialMode: 'isolated_acceptance_only' });
  for (const args of [['--acceptance-root', evidenceRoot], ['--acceptance-root', evidenceRoot, '--credential-mode', 'production_fallback'], ['--acceptance-root', '../relative', '--credential-mode', 'isolated_acceptance_only']]) assert.throws(() => parseNativeAcceptanceArguments(args));
  assert.equal(validateNativeAcceptanceRoot(evidenceRoot), evidenceRoot);
  assert.throws(() => validateNativeAcceptanceRoot(path.join(path.dirname(parent), path.basename(evidenceRoot))));
  assert.throws(() => validateNativeAcceptanceRoot(parent));
  assert.throws(() => validateNativeAcceptanceRoot(path.join(parent, 'unexpected-root')));
});
test('isolated key uses genuine HMAC session and CSRF verifier; only memory/env, restores absent config', async () => {
  const previous = process.env.AI_PET_WORLD_OPERATOR_SESSION_SECRET; delete process.env.AI_PET_WORLD_OPERATOR_SESSION_SECRET;
  const evidenceRoot = candidate();
  try {
    await withNativeAcceptanceCredentials({ evidenceRoot, credentialMode: 'isolated_acceptance_only' }, async evidence => {
      assert.equal(evidence.isolatedTestKey, true); assert.equal(evidence.productionAuthenticationAvailable, false);
      const key = process.env.AI_PET_WORLD_OPERATOR_SESSION_SECRET; assert.ok(Buffer.byteLength(key) >= 32);
      const issued = issueLocalOperatorSession(new Request('http://localhost:3000/api/ai-console/control/operator-session', { headers: { host: 'localhost:3000' } })); assert.equal(issued.ok, true);
      const request = csrf => new Request('http://localhost:3000/api/ai-console/control/local-v1', { headers: { host: 'localhost:3000', origin: 'http://localhost:3000', cookie: issued.setCookie.split(';')[0], 'x-ai-console-csrf': csrf } });
      assert.equal(verifyLocalOperatorMutation(request(issued.session.csrfToken)).ok, true);
      assert.equal(verifyLocalOperatorMutation(request('forged')).errorCode, 'local_operator_csrf_invalid');
      assert.equal(JSON.stringify(evidence).includes(key), false);
      const child = spawnSync(process.execPath, ['-e', 'process.stdout.write(String(Buffer.byteLength(process.env.AI_PET_WORLD_OPERATOR_SESSION_SECRET || "") >= 32))'], { windowsHide: true, encoding: 'utf8', timeout: 10000 });
      assert.equal(child.status, 0); assert.equal(child.stdout, 'true'); assert.equal(child.stdout.includes(key), false);
      assert.equal(fs.existsSync(evidenceRoot), false, 'helper saves no key or fixture files');
    });
    assert.equal(process.env.AI_PET_WORLD_OPERATOR_SESSION_SECRET, undefined);
    await assert.rejects(withNativeAcceptanceCredentials({ evidenceRoot, credentialMode: 'existing_configuration' }, async () => {}), /stable operator secret/);
  } finally { if (previous === undefined) delete process.env.AI_PET_WORLD_OPERATOR_SESSION_SECRET; else process.env.AI_PET_WORLD_OPERATOR_SESSION_SECRET = previous; }
});
test('out-of-scope/reused roots reject before key mutation; exception restores original environment', async () => {
  const previous = process.env.AI_PET_WORLD_OPERATOR_SESSION_SECRET;
  await assert.rejects(withNativeAcceptanceCredentials({ evidenceRoot: path.join(path.dirname(parent), 'native-acceptance-outside-fixture'), credentialMode: 'isolated_acceptance_only' }, async () => { throw Error('should never enter'); }));
  assert.equal(process.env.AI_PET_WORLD_OPERATOR_SESSION_SECRET, previous);
  await assert.rejects(withNativeAcceptanceCredentials({ evidenceRoot: candidate(), credentialMode: 'isolated_acceptance_only' }, async () => { throw Error('private deliberate component exception'); }), /deliberate component exception/);
  assert.equal(process.env.AI_PET_WORLD_OPERATOR_SESSION_SECRET, previous);
});
