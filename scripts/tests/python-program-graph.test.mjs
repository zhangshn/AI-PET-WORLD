import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { buildAiPainterProgramGraphManifest, validateAiPainterProgramGraphManifest } from '../lib/ai-painter-program-graph-manifest-v1.mjs'
import { bindProjectFile } from '../lib/ai-painter-stage4-v2-readonly-gpu-ticket-v1.mjs'

const scripts = 'ml/ai-painter/scripts/', sources = 'ml/ai-painter/src/'
function fixture(t, files, entry = scripts + 'entry.py') {
  const parent = fs.realpathSync(os.tmpdir()), root = fs.mkdtempSync(path.join(parent, 'python-graph-regression-'))
  t.after(() => {
    assert.equal(path.dirname(root), parent)
    assert(path.basename(root).startsWith('python-graph-regression-'))
    assert.equal(fs.realpathSync(root), root)
    assert(!fs.lstatSync(root).isSymbolicLink())
    fs.rmSync(root, { recursive: true })
  })
  const write = (name, text) => {
    const file = path.join(root, name)
    fs.mkdirSync(path.dirname(file), { recursive: true })
    fs.writeFileSync(file, text)
    return file
  }
  const helper = 'scripts/lib/ai-painter-python-import-ast-v1.py'
  write(helper, fs.readFileSync(helper))
  for (const [name, text] of Object.entries(files)) write(name, text + (name.endsWith('.py')
    ? "\nraise RuntimeError('target Python must only be parsed')\n"
    : "\nthrow new Error('target JavaScript must only be parsed');\n"))
  // This existing graph profile requires at least one declared successor.
  const options = { projectRoot: root, graphId: 'private-python-graph-v1',
    entrypoints: [{ role: 'entry', path: entry }], dynamicSuccessors: [{ role: 'declaredSuccessor', path: entry }],
    nonLiteralDynamicDispatches: [] }
  return { root, write, options, build: () => buildAiPainterProgramGraphManifest(options) }
}
const paths = graph => graph.files.map(row => row.path)

test('missing explicit relative Python modules cannot disappear from a program graph', t => {
  const f = fixture(t, {
    [sources + 'example/__init__.py']: '',
    [sources + 'example/entry.py']: 'from .missing_module import VALUE',
  }, sources + 'example/entry.py')
  assert.throws(f.build, /program graph local Python import is missing: .*entry\.py -> \.missing_module/)
})

test('missing explicit project namespace Python modules cannot be treated as external', t => {
  const f = fixture(t, { [scripts + 'entry.py']: 'import ai_painter.missing_module' })
  assert.throws(f.build, /program graph local Python import is missing: .*entry\.py -> ai_painter\.missing_module/)
})

test('unresolved external Python libraries remain declared external dependencies', t => {
  const f = fixture(t, { [scripts + 'entry.py']: 'import json\nfrom example_external_library import VALUE' })
  const graph = f.build()
  assert(graph.externalModules.includes('json'))
  assert(graph.externalModules.includes('example_external_library'))
})

test('a project namespace package without an initializer is not a missing module', t => {
  const f = fixture(t, { [scripts + 'entry.py']: 'import ai_painter.namespace' })
  f.write(sources + 'ai_painter/namespace/placeholder.txt', '')
  const graph = f.build()
  assert(!graph.externalModules.includes('ai_painter.namespace'))
  assert(!paths(graph).some(name => name.endsWith('placeholder.txt')))
})

test('importing a namespace package still binds regular parent package initializers', t => {
  const parent = sources + 'ai_painter/__init__.py'
  const f = fixture(t, { [scripts + 'entry.py']: 'import ai_painter.namespace', [parent]: 'VALUE = 1' })
  f.write(sources + 'ai_painter/namespace/placeholder.txt', '')
  assert(paths(f.build()).includes(parent))
})

test('a local namespace with an ordinary name is not classified as an external library', t => {
  const f = fixture(t, { [scripts + 'entry.py']: 'import local_namespace' })
  f.write(sources + 'local_namespace/placeholder.txt', '')
  assert(!f.build().externalModules.includes('local_namespace'))
})

test('a relative namespace cannot escape the project even when the outside directory exists', t => {
  const f = fixture(t, {
    [sources + 'example/entry.py']: 'from ...... import VALUE',
  }, sources + 'example/entry.py')
  assert.throws(f.build, /program graph Python namespace escapes project root/)
})

test('a stalled Python AST helper times out with diagnostics and can be retried explicitly', t => {
  const f = fixture(t, { [scripts + 'entry.py']: 'VALUE = 1' })
  const helper = 'scripts/lib/ai-painter-python-import-ast-v1.py'
  const original = fs.readFileSync(helper)
  f.write(helper, `import sys,time\nfrom pathlib import Path\nprint('partial AST diagnostic',file=sys.stderr,flush=True)\ntime.sleep(16.5)\nPath(__file__).with_suffix('.finished').write_text('unexpected completion')\nsys.exit(23)\n`)
  assert.throws(f.build, error => {
    assert.match(error.message, /program graph Python AST parse failed/)
    assert.match(error.message, /ETIMEDOUT/)
    assert.match(error.message, /partial AST diagnostic/)
    return true
  })
  assert.equal(fs.existsSync(path.join(f.root, helper.replace(/\.py$/u, '.finished'))), false)
  f.write(helper, original)
  assert(paths(f.build()).includes(scripts + 'entry.py'))
})

test('program graph ignores a local require assertion but keeps a real aliased loader', t => {
  const f = fixture(t, {
    'entry.mjs': "import {createRequire as factory} from 'node:module'; const load = factory(import.meta.url); const require = (ok, why) => { if (!ok) throw Error(why) }; require(true, 'ok'); load('./child.cjs');",
    'child.cjs': 'module.exports = 1;',
  }, 'entry.mjs')
  const graph = f.build()
  assert(paths(graph).includes('child.cjs'))
  assert.equal(graph.nonLiteralDynamicDispatches.length, 0)
})

test('program graph retains plain require and directly invoked native factories', t => {
  const f = fixture(t, {
    'entry.mjs': "import * as module from 'node:module'; require('./one.cjs'); module.createRequire(import.meta.url)('./two.cjs');",
    'one.cjs': '', 'two.cjs': '',
  }, 'entry.mjs')
  const graph = f.build()
  assert(paths(graph).includes('one.cjs'))
  assert(paths(graph).includes('two.cjs'))
})

test('program graph rejects unregistered computed aliased loader calls', t => {
  const f = fixture(t, {
    'entry.mjs': "import {createRequire} from 'node:module'; const load = createRequire(import.meta.url); load(process.argv[2]);",
  }, 'entry.mjs')
  assert.throws(f.build, /non-literal dynamic import is not declared: entry.mjs/)
})

test('program graph requires a declaration for a loader with an unknown relative base', t => {
  const f = fixture(t, {
    'entry.mjs': "import {createRequire} from 'node:module'; const load = createRequire(process.argv[2]); load('./child.cjs');",
    'child.cjs': '',
  }, 'entry.mjs')
  assert.throws(f.build, /non-literal dynamic import is not declared: entry.mjs/)
})

test('a declared computed loader binds exact targets and detects a changed target', t => {
  const f = fixture(t, {
    'entry.mjs': "import {createRequire} from 'node:module'; const load = createRequire(import.meta.url); load(process.argv[2]);",
    'child.cjs': 'module.exports = 1;',
  }, 'entry.mjs')
  f.options.nonLiteralDynamicDispatches = [{ role: 'privateDispatch', importerPath: 'entry.mjs', targetPaths: ['child.cjs'], siteCount: 1 }]
  f.write('evidence/graph.json', JSON.stringify(f.build()))
  const manifestBinding = bindProjectFile(f.root, 'evidence/graph.json')
  validateAiPainterProgramGraphManifest({ ...f.options, manifestBinding })
  fs.appendFileSync(path.join(f.root, 'child.cjs'), '\nmodule.exports = 2;\n')
  assert.throws(() => validateAiPainterProgramGraphManifest({ ...f.options, manifestBinding }), /program graph manifest differs/)
})

test('from package imports bind child modules, aliases and transitive imports', t => {
  const f = fixture(t, {
    [scripts + 'entry.py']: 'from example import child as renamed, CONSTANT',
    [sources + 'example/__init__.py']: 'CONSTANT = 1',
    [sources + 'example/child.py']: 'from . import helper',
    [sources + 'example/helper.py']: 'VALUE = 2',
  })
  const graph = f.build()
  for (const item of ['example/__init__.py', 'example/child.py', 'example/helper.py']) assert(paths(graph).includes(sources + item), item)
  assert(!graph.externalModules.some(name => name.includes('CONSTANT')))
})

test('changing a from-imported submodule invalidates the persisted program graph', t => {
  const child = sources + 'example/child.py'
  const f = fixture(t, {
    [scripts + 'entry.py']: 'from example import child',
    [sources + 'example/__init__.py']: '', [child]: 'VALUE = 1',
  })
  f.write('evidence/graph.json', JSON.stringify(f.build()))
  const manifestBinding = bindProjectFile(f.root, 'evidence/graph.json')
  validateAiPainterProgramGraphManifest({ ...f.options, manifestBinding })
  fs.appendFileSync(path.join(f.root, child), '\nVALUE = 2\n')
  assert.throws(() => validateAiPainterProgramGraphManifest({ ...f.options, manifestBinding }), /program graph manifest differs/)
})

test('relative package members bind both initializers and the member source', t => {
  const f = fixture(t, {
    [sources + 'example/entry.py']: 'from .parts import leaf\nfrom . import helper',
    [sources + 'example/__init__.py']: '', [sources + 'example/helper.py']: '',
    [sources + 'example/parts/__init__.py']: '', [sources + 'example/parts/leaf.py']: '',
  }, sources + 'example/entry.py')
  const actual = paths(f.build())
  for (const item of ['example/__init__.py', 'example/helper.py', 'example/parts/__init__.py', 'example/parts/leaf.py']) assert(actual.includes(sources + item), item)
})

test('namespace packages without an initializer still bind imported members', t => {
  const f = fixture(t, { [scripts + 'entry.py']: 'from space import child', [sources + 'space/child.py']: 'VALUE = 1' })
  assert(paths(f.build()).includes(sources + 'space/child.py'))
})

test('from-imported child packages retain their initializer dependencies', t => {
  const f = fixture(t, {
    [scripts + 'entry.py']: 'from example import nested', [sources + 'example/__init__.py']: '',
    [sources + 'example/nested/__init__.py']: 'from . import leaf', [sources + 'example/nested/leaf.py']: '',
  })
  const actual = paths(f.build())
  assert(actual.includes(sources + 'example/nested/__init__.py'))
  assert(actual.includes(sources + 'example/nested/leaf.py'))
})

test('dotted imports in the scripts search root retain package initializer code', t => {
  const f = fixture(t, {
    [scripts + 'entry.py']: 'import example.child', [scripts + 'example/__init__.py']: 'import helper',
    [scripts + 'example/child.py']: '', [scripts + 'helper.py']: '',
  })
  const actual = paths(f.build())
  assert(actual.includes(scripts + 'example/__init__.py'))
  assert(actual.includes(scripts + 'helper.py'))
})

test('a regular package takes precedence over a same-named module file', t => {
  const f = fixture(t, {
    [scripts + 'entry.py']: 'import example', [sources + 'example.py']: '',
    [sources + 'example/__init__.py']: '',
  })
  const actual = paths(f.build())
  assert(actual.includes(sources + 'example/__init__.py'))
  assert(!actual.includes(sources + 'example.py'))
})

test('ordinary module attributes remain attributes, not fabricated source dependencies', t => {
  const f = fixture(t, { [scripts + 'entry.py']: 'from values import CONSTANT', [sources + 'values.py']: 'CONSTANT = 1' })
  const graph = f.build()
  assert(paths(graph).includes(sources + 'values.py'))
  assert(!graph.externalModules.some(name => name.includes('CONSTANT')))
})
