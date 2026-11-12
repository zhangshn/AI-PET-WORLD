import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import crypto from 'node:crypto'
import {spawnSync} from 'node:child_process'
import {pythonExecutionImportAst} from '../lib/python-execution-imports.mjs'
import {collectActualExecutionSources as collectGeneral} from '../lib/ai-painter-execution-source-closure-v1.mjs'
import {collectActualExecutionSources as collectDecode} from '../lib/ai-painter-decode1-entry-weight-quality-source-closure-v1.mjs'

const python = path.resolve('ml/ai-painter/.venv/Scripts/python.exe')
function parse(source, deferredSurface = {}) {
  const run = spawnSync(python, ['-I', '-B', '-X', 'utf8', '-c', pythonExecutionImportAst], {
    input: JSON.stringify([{path: 'private.py', source: source + "\nraise RuntimeError('must not execute')\n", deferredSurface}]),
    encoding: 'utf8', windowsHide: true, timeout: 10000,
  })
  assert.equal(run.status, 0, run.stderr)
  return JSON.parse(run.stdout)[0]
}
const modules = rows => rows.map(row => row.module).sort()

test('excluded function body does not exclude decorators or positional/keyword defaults', () => {
  const r = parse("@importlib.import_module('decorator').wrap\ndef closed(x=importlib.import_module('positional'), *, y=importlib.import_module('keyword')):\n import body_only\n", {excludeScopes: ['closed']})
  assert.deepEqual(modules(r.imports), ['decorator', 'keyword', 'positional'])
  assert(r.imports.every(row => row.scope === ''))
  assert.deepEqual(modules(r.excludedLateImports), ['body_only'])
})

test('includeScopes preserves eager definitions for unselected asynchronous functions', () => {
  const r = parse("async def closed(x=importlib.import_module('eager')):\n import disabled\ndef selected():\n import kept\n", {includeScopes: ['selected']})
  assert.deepEqual(modules(r.imports), ['eager', 'kept'])
  assert.deepEqual(modules(r.excludedLateImports), ['disabled'])
})

test('decorators and defaults nested inside an excluded body remain excluded', () => {
  const r = parse("def closed():\n @importlib.import_module('nested_decorator').wrap\n def nested(x=importlib.import_module('nested_default')):\n  import nested_body\n", {excludeScopes: ['closed']})
  assert.deepEqual(r.imports, [])
  assert.deepEqual(modules(r.excludedLateImports), ['nested_body', 'nested_decorator', 'nested_default'])
  assert.equal(r.excludedLateImports.find(row => row.module === 'nested_default').scope, 'closed')
})

test('nested definitions in a selected body preserve containing and body scopes', () => {
  const r = parse("def outer():\n def inner(x=importlib.import_module('default')):\n  import inner_body\n", {includeScopes: ['outer']})
  assert.equal(r.imports.find(row => row.module === 'default').scope, 'outer')
  assert.equal(r.imports.find(row => row.module === 'inner_body').scope, 'outer.inner')
  assert.deepEqual(r.excludedLateImports, [])
})

test('class definition dependencies retain outer scope and class-body identity', () => {
  const r = parse("@importlib.import_module('class_decorator').wrap\nclass C(importlib.import_module('base').Base, metaclass=importlib.import_module('meta').Meta):\n import class_body\n def method(self, x=importlib.import_module('method_default')):\n  import method_body\n")
  for (const name of ['class_decorator', 'base', 'meta']) assert.equal(r.imports.find(row => row.module === name).scope, '')
  assert.equal(r.imports.find(row => row.module === 'method_default').scope, 'C')
  assert.equal(r.imports.find(row => row.module === 'class_body').scope, 'C')
  assert.equal(r.imports.find(row => row.module === 'method_body').scope, 'C.method')
})

test('precise frozen import exclusions still apply only to the declared body import', () => {
  const r = parse("def live(x=importlib.import_module('eager')):\n from package import omitted\n from package import kept\n", {excludeImports: [{scope: 'live', module: 'package', level: 0, names: ['omitted']}]})
  assert.deepEqual(r.excludedLateImports.map(row => row.names), [['omitted']])
  assert(r.imports.some(row => row.module === 'eager'))
  assert(r.imports.some(row => row.names.includes('kept')))
})

test('without frozen exclusions all deferred imports are retained conservatively', () => {
  const r = parse('import direct\ndef later():\n import inside\n')
  assert.deepEqual(modules(r.imports), ['direct', 'inside'])
  assert.deepEqual(r.excludedLateImports, [])
})

for (const [name, collect] of [['general', collectGeneral], ['decode', collectDecode]]) {
  test(`${name} collector includes eager and deferred sources without evaluating them`, t => {
    const parent = fs.realpathSync(os.tmpdir()), root = fs.mkdtempSync(path.join(parent, 'eager-import-closure-'))
    t.after(() => {
      assert.equal(path.dirname(root), parent)
      assert(path.basename(root).startsWith('eager-import-closure-'))
      assert.equal(fs.realpathSync(root), root)
      assert(!fs.lstatSync(root).isSymbolicLink())
      fs.rmSync(root, {recursive: true})
    })
    const prefix = 'ml/ai-painter/scripts/'
    for (const [file, source] of Object.entries({'entry.py': "def fn(x=importlib.import_module('eager')):\n import later\n", 'eager.py': '', 'later.py': ''})) {
      const target = path.join(root, prefix + file)
      fs.mkdirSync(path.dirname(target), {recursive: true})
      fs.writeFileSync(target, source + "\nraise RuntimeError('target must not execute')\n")
    }
    const bind = file => ({path: file, sha256: crypto.createHash('sha256').update(fs.readFileSync(path.join(root, file))).digest('hex')})
    const result = collect({root, python, required: {entry: prefix + 'entry.py'}, bind})
    assert.deepEqual(Object.values(result).map(row => row.path).sort(), ['eager.py', 'entry.py', 'later.py'].map(file => prefix + file))
  })
}
