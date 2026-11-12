import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import os from 'node:os'
import {spawnSync} from 'node:child_process'

const entry = new URL('../lib/natural-world-model-input.mjs', import.meta.url).href

function runFixture(t, code, {missingAdapter = false} = {}) {
  const parent = fs.realpathSync(os.tmpdir())
  const root = fs.mkdtempSync(path.join(parent, 'model-input-loader-'))
  t.after(() => {
    assert.equal(path.dirname(root), parent)
    assert(path.basename(root).startsWith('model-input-loader-'))
    assert.equal(fs.realpathSync(root), root)
    assert(!fs.lstatSync(root).isSymbolicLink())
    fs.rmSync(root, {recursive: true})
  })
  for (const [directory, marker] of [[root, 'original'], [path.join(root, 'foreign'), 'foreign']]) {
    fs.mkdirSync(path.join(directory, 'src/world/runtime'), {recursive: true})
    fs.mkdirSync(path.join(directory, '.runtime'))
    fs.writeFileSync(path.join(directory, 'record.json'), '{}')
    if (!missingAdapter || directory !== root) {
      fs.writeFileSync(path.join(directory, 'src/world/runtime/world-runtime-store-adapter.ts'), 'export {};\n')
    }
    // Stop at decoding: these fixtures never construct or mutate a real world.
    fs.writeFileSync(path.join(directory, 'src/world/runtime/world-runtime-record-validation.ts'),
      `export function decodeNaturalWorldRuntimeRecord(){throw Error('fixture_${marker}')};\n`)
  }
  const driver = `import assert from 'node:assert/strict';import fs from 'node:fs';import path from 'node:path';import {createHash} from 'node:crypto';
    const {buildNaturalWorldModelInputDescriptor:build}=await import(${JSON.stringify(entry)});
    const original=process.cwd(),foreign=path.join(original,'foreign');
    const request={schemaVersion:'natural-world-model-input-request-v1',scope:'natural_world_runtime_v1',
      identity:Object.fromEntries(['ownerId','playerId','worldId','worldSeed','worldProfileId','regionId'].map(k=>[k,k])),
      tick:0,stateVersion:0,factHash:'a'.repeat(64),sourceFactRelease:null,taskManifest:null,taskPackage:null,conditionManifest:null,conditionPackage:null,
      runtimeSave:{path:'record.json',sha256:createHash('sha256').update('{}').digest('hex')}};
    const load=()=>build({request});
    ${code}
    console.log('fixture passed');`
  const result = spawnSync(process.execPath, ['--input-type=module', '-e', driver], {cwd: root,
    encoding: 'utf8', windowsHide: true, timeout: 10000})
  assert.equal(result.status, 0, result.stderr)
}

test('model input uses the runtime from the current physical project directory', t => {
  runFixture(t, `await assert.rejects(load(), /fixture_original/);
    process.chdir(foreign); await assert.rejects(load(), /fixture_foreign/);
    process.chdir(original); await assert.rejects(load(), /fixture_original/);`)
})

test('model input can retry a missing runtime module after explicit restoration', t => {
  runFixture(t, `await assert.rejects(load(), {code:'ERR_MODULE_NOT_FOUND'});
    fs.writeFileSync(path.join(original,'src/world/runtime/world-runtime-store-adapter.ts'), 'export {};\\n');
    await assert.rejects(load(), /fixture_original/);`, {missingAdapter: true})
})

test('model input preserves its successful module cache and rejects a foreign root', t => {
  runFixture(t, `await assert.rejects(load(), /fixture_original/);
    fs.writeFileSync(path.join(original,'src/world/runtime/world-runtime-record-validation.ts'),
      "export function decodeNaturalWorldRuntimeRecord(){throw Error('replaced')};\\n");
    await assert.rejects(load(), /fixture_original/);
    await assert.rejects(build({request,root:foreign}), /project cwd mismatch/);`)
})
