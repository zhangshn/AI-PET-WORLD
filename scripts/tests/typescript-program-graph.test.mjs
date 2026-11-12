import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import {stripTypeScriptTypes} from 'node:module'
import {buildAiPainterProgramGraphManifest, validateAiPainterProgramGraphManifest} from '../lib/ai-painter-program-graph-manifest-v1.mjs'
import {bindProjectFile} from '../lib/ai-painter-stage4-v2-readonly-gpu-ticket-v1.mjs'

function fixture(t, files) {
  const parent = fs.realpathSync(os.tmpdir()), root = fs.mkdtempSync(path.join(parent, 'typescript-program-graph-'))
  t.after(() => {
    assert.equal(path.dirname(root), parent)
    assert(path.basename(root).startsWith('typescript-program-graph-'))
    assert.equal(fs.realpathSync(root), root)
    assert(!fs.lstatSync(root).isSymbolicLink())
    fs.rmSync(root, {recursive: true})
  })
  const write = (name, text) => {
    const file = path.join(root, name)
    fs.mkdirSync(path.dirname(file), {recursive: true})
    fs.writeFileSync(file, text)
  }
  const helper = 'scripts/lib/ai-painter-python-import-ast-v1.py'
  write(helper, fs.readFileSync(helper))
  for (const [name, text] of Object.entries(files)) write(name, text + "\nthrow Error('inspected sources must not execute');\n")
  const options = {projectRoot: root, graphId: 'private-typescript-graph',
    entrypoints: [{role: 'entry', path: 'entry.ts'}], dynamicSuccessors: [{role: 'fixed', path: 'entry.ts'}], nonLiteralDynamicDispatches: []}
  return {root, options, write, build: () => buildAiPainterProgramGraphManifest(options)}
}
const files = graph => graph.files.map(item => item.path)

test('TypeScript runtime imports preserve relative source, exports, and the runtime loader ts preference', t => {
  const f = fixture(t, {'entry.ts': "import {value} from './child'; export {nested} from './other.mts'; const x: number = value;",
    'child.ts': 'export const value: number = 1;', 'child.js': 'export const value = 2;', 'other.mts': 'export const nested: boolean = true;'})
  const graph = f.build()
  assert(files(graph).includes('child.ts'))
  assert(files(graph).includes('other.mts'))
  assert(!files(graph).includes('child.js'))
  assert.equal(graph.files.find(item => item.path === 'entry.ts').language, 'typescript')
})

test('explicit type imports erase, while inline type members preserve Node runtime side effects', t => {
  const source = "import type {Gone} from './absent.ts'; export type {Gone} from './absent.ts'; import {type Kept} from './kept.ts'; export {type Kept} from './kept.ts';"
  const stripped = stripTypeScriptTypes(source)
  assert(!stripped.includes('./absent.ts'))
  assert(stripped.includes('./kept.ts'))
  const f = fixture(t, {'entry.ts': source, 'kept.ts': 'export interface Kept { x: number }'})
  assert(files(f.build()).includes('kept.ts'))
})

test('a changed TypeScript runtime dependency rejects the persisted graph', t => {
  const f = fixture(t, {'entry.ts': "import './child.ts';", 'child.ts': 'export const n: number = 1;'})
  f.write('graph.json', JSON.stringify(f.build()))
  const manifestBinding = bindProjectFile(f.root, 'graph.json')
  validateAiPainterProgramGraphManifest({...f.options, manifestBinding})
  fs.appendFileSync(path.join(f.root, 'child.ts'), '\nexport const changed = true;\n')
  assert.throws(() => validateAiPainterProgramGraphManifest({...f.options, manifestBinding}), /program graph manifest differs/)
})

test('TypeScript literal and computed imports still require exact declarations', t => {
  const f = fixture(t, {'entry.ts': "export function load() { return import('./child.ts') };", 'child.ts': ''})
  assert.throws(f.build, /literal dynamic import is not declared/)
  f.options.dynamicSuccessors.push({role: 'child', path: 'child.ts'})
  assert(files(f.build()).includes('child.ts'))
  f.write('entry.ts', 'export function load(name: string) { return import(name) };')
  assert.throws(f.build, /non-literal dynamic import is not declared/)
  f.options.nonLiteralDynamicDispatches = [{role: 'runtime', importerPath: 'entry.ts', targetPaths: ['child.ts'], siteCount: 1}]
  assert(files(f.build()).includes('child.ts'))
  f.options.nonLiteralDynamicDispatches[0].siteCount = 2
  assert.throws(f.build, /site count changed/)
})

test('TypeScript aliases of native require are bound and local assertions are skipped', t => {
  const f = fixture(t, {'entry.ts': "import {createRequire as make} from 'node:module'; const load = make(import.meta.url); const require = (ok: boolean) => { if (!ok) throw Error('bad') }; require(true); load('./child.cts');",
    'child.cts': 'export const value: number = 1;'})
  assert(files(f.build()).includes('child.cts'))
})

test('TypeScript syntax errors fail before any source evaluation', t => {
  const f = fixture(t, {'entry.ts': 'const x: = ;'})
  assert.throws(f.build, /TypeScript AST parse failed/)
})

test('unconfigured runtime aliases are rejected instead of silently treated as npm modules', t => {
  const f = fixture(t, {'entry.ts': "import {x} from '@/world/example';"})
  assert.throws(f.build, /runtime alias requires an explicit resolver/)
})

test('TypeScript import-equals retains runtime modules and skips explicit type-only imports', t => {
  const f = fixture(t, {'entry.ts': "import type Absent = require('./absent.cjs'); import Child = require('./child.cjs');", 'child.cjs': 'module.exports = 1;'})
  assert(files(f.build()).includes('child.cjs'))
})
