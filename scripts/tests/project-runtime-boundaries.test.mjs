import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import {spawnSync} from 'node:child_process'
import {parse} from '@babel/parser'
import test from 'node:test'
import {loadLoopRuntime} from '../lib/world-evolution-runtime-loader.mjs'
import {loadLoopRuntime as testLoader} from './helpers/world-evolution-loop-loader.mjs'
import {inspectCapabilityScopeAdmission as shared} from '../lib/ai-painter-capability-scope-admission.mjs'
import {inspectCapabilityScopeAdmission as compatibility} from '../lib/ai-painter-autonomous-package-decision-core-v3.mjs'

const root = path.resolve(import.meta.dirname, '../..')
const pkg = JSON.parse(fs.readFileSync(path.join(root, 'package.json')))

test('world runtime loader is shared and never reuses another checkout runtime', async () => {
  assert.equal(loadLoopRuntime, testLoader)
  const runtime = await loadLoopRuntime(root)
  assert.equal(typeof runtime.store.createProductionWorldRuntimeStore, 'function')
  assert.equal(await loadLoopRuntime(root), runtime)
  const missingRoot = path.join(root, '.runtime', 'missing-loader-fixture-' + process.pid)
  assert.equal(fs.existsSync(missingRoot), false)
  await assert.rejects(loadLoopRuntime(missingRoot), /Cannot find module|ENOENT/)
  assert.equal(await loadLoopRuntime(root), runtime)
})

test('world runtime consumers do not import the test helper implementation', () => {
  for (const name of ['natural-world-evolution-loop', 'world-initialized-evolution', 'world-environment-scheduled-run']) {
    const code = fs.readFileSync(path.join(root, 'scripts/lib', name + '.mjs'), 'utf8')
    assert.doesNotMatch(code, /tests\/helpers\/world-evolution-loop-loader/)
    assert.match(code, /scripts\/lib\/world-evolution-runtime-loader\.mjs/)
  }
})

test('capability admission compatibility is the same implementation and rejects accessors', () => {
  assert.equal(shared, compatibility)
  let calls = 0
  assert.throws(() => shared({get projectRoot() {calls++; return root}}), /accessors rejected/)
  assert.equal(calls, 0)
  assert.throws(() => shared({projectRoot:root, productionAdmitted:true}), /unknown preflight option/)
})

test('weather static dependency graph is acyclic and shared admission imports only builtins', () => {
  const done = new Set(), visiting = new Set()
  function visit(file) {
    assert.ok(!visiting.has(file), `static dependency cycle: ${file}`)
    if (done.has(file)) return
    visiting.add(file)
    const imports = parse(fs.readFileSync(file, 'utf8'), {sourceType:'module'}).program.body
      .filter(n => n.type === 'ImportDeclaration' || n.type === 'ExportNamedDeclaration' && n.source)
      .map(n => n.source.value)
    if (file.endsWith('ai-painter-capability-scope-admission.mjs')) assert.ok(imports.every(s => s.startsWith('node:')))
    for (const specifier of imports) if (specifier.startsWith('.')) {
      const dependency = path.resolve(path.dirname(file), specifier)
      if (dependency.endsWith('.mjs')) visit(dependency)
    }
    visiting.delete(file); done.add(file)
  }
  visit(path.join(root, 'scripts/lib/ai-painter-autonomous-package-decision-core-v3.mjs'))
  assert.ok(done.size > 5)
})

test('historical current-named inference commands fail before invoking an old writer', () => {
  for (const name of ['run:current-world-visual-inference', 'run:current-world-bootstrap-inference', 'run:current-world-foundation-bootstrap-inference']) {
    assert.equal(pkg.scripts[name], `node scripts/reject-legacy-world-entrypoint.mjs ${name}`)
    const result = spawnSync(process.execPath, ['scripts/reject-legacy-world-entrypoint.mjs', name], {cwd:root, encoding:'utf8', timeout:5000})
    assert.equal(result.status, 2)
    const report = JSON.parse(result.stderr)
    assert.equal(report.status, 'historical_entrypoint_not_dispatchable')
    assert.equal(report.modelStarted, false)
  }
})

test('runtime parsers remain in production lockfile and default listeners stay local', () => {
  const lock = JSON.parse(fs.readFileSync(path.join(root, 'package-lock.json')))
  for (const name of ['@babel/parser','acorn']) assert.equal(pkg.dependencies[name], lock.packages[`node_modules/${name}`].version)
  for (const name of ['@babel/parser','acorn','@babel/types','@babel/helper-string-parser','@babel/helper-validator-identifier']) {
    assert.notEqual(lock.packages[`node_modules/${name}`].dev, true, `${name} omitted by production install`)
  }
  for (const name of ['dev','start']) assert.match(pkg.scripts[name], /--hostname 127\.0\.0\.1(?: |$)/)
})
