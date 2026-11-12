import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { collectNaturalWorldPythonStaticSources } from '../lib/natural-world-model-input.mjs'

const prefix = 'ml/ai-painter/src/ai_painter/'
const seeds = ['natural_world_input_v1.py', 'native_stage_geometry_v1.py', 'object_instance_supervision_cpu.py',
  'dataset.py', 'object_ecology_regime_input_cpu.py', 'object_appearance_regime_input_cpu.py']
  .map(name => prefix + 'complete_world/' + name)
function fixture(t, source, files = {}) {
  const parent = fs.realpathSync(os.tmpdir()), root = fs.mkdtempSync(path.join(parent, 'natural-input-dependencies-'))
  t.after(() => {
    assert.equal(path.dirname(root), parent)
    assert(path.basename(root).startsWith('natural-input-dependencies-'))
    assert.equal(fs.realpathSync(root), root)
    assert(!fs.lstatSync(root).isSymbolicLink())
    fs.rmSync(root, { recursive: true })
  })
  function write(name, contents) {
    const target = path.join(root, name)
    fs.mkdirSync(path.dirname(target), { recursive: true })
    fs.writeFileSync(target, contents)
  }
  const helper = 'scripts/lib/ai-painter-python-import-ast-v1.py'
  write(helper, fs.readFileSync(helper))
  for (const seed of seeds) write(seed, "raise RuntimeError('input sources must never execute')\n")
  for (const [name, contents] of Object.entries({
    [prefix + '__init__.py']: '', [prefix + 'complete_world/__init__.py']: '',
    [seeds[0]]: source, ...files,
  })) write(name, contents + "\nraise RuntimeError('imported sources must never execute')\n")
  return { root, write, collect: () => collectNaturalWorldPythonStaticSources(root) }
}

for (const [name, source] of [
  ['ordinary import', 'import ai_painter.child'],
  ['indented import', 'if True:\n    from ai_painter.child import VALUE'],
  ['from-import submodule', 'from ai_painter import child'],
  ['explicit from-import', 'from ai_painter.child import VALUE'],
  ['relative import', 'from .. import child'],
]) test(`natural input binds ${name} without executing target code`, t => {
  const child = prefix + 'child.py'
  const f = fixture(t, source, { [child]: 'VALUE = 1' })
  const paths = f.collect()
  assert.deepEqual(paths, [...seeds, child, prefix + '__init__.py', prefix + 'complete_world/__init__.py'].sort())
})

test('natural input includes transitive imports from parent package initializers', t => {
  const f = fixture(t, '', {
    [prefix + '__init__.py']: 'from . import parent_dependency',
    [prefix + 'parent_dependency.py']: 'VALUE = 1',
  })
  assert(f.collect().includes(prefix + 'parent_dependency.py'))
})

test('natural input handles namespace children without inventing initializer files', t => {
  const f = fixture(t, 'from ai_painter.namespace import child', { [prefix + 'namespace/child.py']: 'VALUE = 1' })
  const paths = f.collect()
  assert(paths.includes(prefix + 'namespace/child.py'))
  assert(paths.includes(prefix + '__init__.py'))
  assert(!paths.includes(prefix + 'namespace/__init__.py'))
})

test('natural input rejects missing explicit project imports', t => {
  const f = fixture(t, 'import ai_painter.missing_module')
  assert.throws(f.collect, /local Python import is missing/)
})

test('natural input rejects missing fixed seeds', t => {
  const f = fixture(t, '')
  fs.unlinkSync(path.join(f.root, seeds[5]))
  assert.throws(f.collect, /program graph path is missing/)
})

test('natural input rejects relative namespaces outside the project', t => {
  const f = fixture(t, 'from ....... import VALUE')
  assert.throws(f.collect, /Python namespace escapes project root/)
})

test('natural input treats this inventory as static only and does not execute dynamic imports', t => {
  const f = fixture(t, 'import json\nimport importlib\nimportlib.import_module("ai_painter.dynamic_child")', {
    [prefix + 'dynamic_child.py']: 'VALUE = 1',
  })
  assert(!f.collect().includes(prefix + 'dynamic_child.py'))
})
