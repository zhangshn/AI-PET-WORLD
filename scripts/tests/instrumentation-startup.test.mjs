import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import os from 'node:os'
import {pathToFileURL} from 'node:url'
import {spawnSync} from 'node:child_process'
import ts from 'typescript'

const source = fs.readFileSync(new URL('../../src/instrumentation.ts', import.meta.url), 'utf8')
const compiled = ts.transpileModule(source, {compilerOptions: {target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext}}).outputText

function runFixture(t, {runtime = 'nodejs', workThrows = false, readyRejects = false} = {}) {
  const parent = fs.realpathSync(os.tmpdir())
  const root = fs.mkdtempSync(path.join(parent, 'instrumentation-startup-#% 地图-'))
  t.after(() => {
    assert.equal(path.dirname(root), parent)
    assert(path.basename(root).startsWith('instrumentation-startup-#% 地图-'))
    assert.equal(fs.realpathSync(root), root)
    assert(!fs.lstatSync(root).isSymbolicLink())
    fs.rmSync(root, {recursive: true})
  })
  const entry = path.join(root, 'entry.mjs')
  fs.writeFileSync(entry, compiled)
  if (runtime === 'nodejs') {
    const work = path.join(root, 'src/server/local-backup/work-observer.mjs')
    const history = path.join(root, 'src/server/ai-console/training-history-evidence-index.mjs')
    fs.mkdirSync(path.dirname(work), {recursive: true})
    fs.mkdirSync(path.dirname(history), {recursive: true})
    fs.writeFileSync(work, `export function startWorkObserver() {
      globalThis.observed.work++;
      ${workThrows ? "throw Error('fixture work failure');" : `return {ready: ${readyRejects ? "Promise.reject(Error('fixture readiness failure'))" : 'Promise.resolve()'}};`}
    }`)
    fs.writeFileSync(history, 'export async function scanHistoryEvidence() { globalThis.observed.scans++; }')
  }
  const driver = `globalThis.observed = {work: 0, scans: 0, errors: []};
    console.error = (...args) => globalThis.observed.errors.push(String(args[0]));
    const {register} = await import(${JSON.stringify(pathToFileURL(entry).href)});
    await register(); await register(); await Promise.resolve();
    console.log(JSON.stringify(globalThis.observed));`
  const result = spawnSync(process.execPath, ['--input-type=module', '-e', driver], {
    cwd: root, env: {...process.env, NEXT_RUNTIME: runtime}, encoding: 'utf8', windowsHide: true, timeout: 10000,
  })
  assert.equal(result.status, 0, result.stderr)
  return JSON.parse(result.stdout)
}

test('Node startup loads observer sources from a directory containing URL delimiters and Unicode', t => {
  assert.deepEqual(runFixture(t), {work: 2, scans: 1, errors: []})
})

test('a failing work observer does not suppress the independent singleton history indexer', t => {
  assert.deepEqual(runFixture(t, {workThrows: true}), {work: 2, scans: 1,
    errors: ['local_work_recording_startup_unavailable', 'local_work_recording_startup_unavailable']})
})

test('asynchronous observer readiness failures remain visible without blocking history startup', t => {
  assert.deepEqual(runFixture(t, {readyRejects: true}), {work: 2, scans: 1,
    errors: ['local_work_recording_startup_failed', 'local_work_recording_startup_failed']})
})

test('Edge registration returns without loading any Node observer source', t => {
  assert.deepEqual(runFixture(t, {runtime: 'edge'}), {work: 0, scans: 0, errors: []})
})
