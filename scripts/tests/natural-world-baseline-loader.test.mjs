import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import os from 'node:os'
import {spawnSync} from 'node:child_process'

const loader = new URL('../lib/natural-world-baseline-ts-loader.mjs', import.meta.url).href

function runFixture(t, code, {missingBootstrap = false} = {}) {
  const parent = fs.realpathSync(os.tmpdir())
  const root = fs.mkdtempSync(path.join(parent, 'baseline-loader-root-'))
  t.after(() => {
    assert.equal(path.dirname(root), parent)
    assert(path.basename(root).startsWith('baseline-loader-root-'))
    assert.equal(fs.realpathSync(root), root)
    assert(!fs.lstatSync(root).isSymbolicLink())
    fs.rmSync(root, {recursive: true})
  })
  for (const [directory, marker] of [[root, 'original'], [path.join(root, 'foreign'), 'foreign']]) {
    fs.mkdirSync(path.join(directory, 'src/world/runtime'), {recursive: true})
    for (const file of ['natural-world-bootstrap.ts', 'world-runtime-store-adapter.ts', 'world-runtime-record-validation.ts']) {
      if (missingBootstrap && directory === root && file === 'natural-world-bootstrap.ts') continue
      fs.writeFileSync(path.join(directory, 'src/world/runtime', file), `export const marker=${JSON.stringify(marker)};\n`)
    }
  }
  const driver = `import assert from 'node:assert/strict';import fs from 'node:fs';import path from 'node:path';
    const {loadNaturalWorldBaselineRuntime:load}=await import(${JSON.stringify(loader)});
    const original=process.cwd(),foreign=path.join(original,'foreign');
    ${code}
    console.log('fixture passed');`
  const result = spawnSync(process.execPath, ['--input-type=module', '-e', driver], {cwd: root,
    encoding: 'utf8', windowsHide: true, timeout: 10000})
  assert.equal(result.status, 0, result.stderr)
}

test('a successful cached load cannot bypass validation of a later foreign root', t => {
  runFixture(t, "await load(); await assert.rejects(load(foreign), /baseline_loader_cwd/);")
})

test('an invalid first root does not poison a subsequent valid call', t => {
  runFixture(t, "await assert.rejects(load(foreign), /baseline_loader_cwd/); assert.equal((await load()).bootstrap.marker,'original');")
})

test('a pending cached load cannot bypass validation of another root', t => {
  runFixture(t, "const pending=load(); await assert.rejects(load(foreign), /baseline_loader_cwd/); assert.equal((await pending).bootstrap.marker,'original');")
})

test('equivalent physical roots share the same concurrent loaded result', t => {
  runFixture(t, "const [a,b]=await Promise.all([load(),load(original+'/src/..')]); assert.strictEqual(a,b);")
})

test('changing the working directory never returns modules cached for a different root', t => {
  runFixture(t, `const a=await load(); process.chdir(foreign); const b=await load();
    assert.equal(b.bootstrap.marker,'foreign'); assert.notStrictEqual(a,b);
    await assert.rejects(load(original), /baseline_loader_cwd/);
    process.chdir(original); assert.strictEqual(await load(),a);`)
})

test('a failed import can be retried explicitly after the missing source is restored', t => {
  runFixture(t, `await assert.rejects(load(), {code:'ERR_MODULE_NOT_FOUND'});
    const bootstrap=path.join(original,'src/world/runtime/natural-world-bootstrap.ts');
    assert.equal(fs.existsSync(bootstrap),false);
    fs.writeFileSync(bootstrap,"export const marker='restored';\\n");
    assert.equal((await load()).bootstrap.marker,'restored');`, {missingBootstrap: true})
})
