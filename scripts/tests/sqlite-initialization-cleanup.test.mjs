import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import vm from 'node:vm'
import { test } from 'node:test'
import ts from 'typescript'

const targets = [
  ['src/server/ai-console/training-history-evidence-index.mjs', 'openIndex'],
  ...['capability-lifecycle-store', 'policy-boundary-report-store', 'review-adjudication-store',
    'runtime-release-registry-store', 'task-capsule-store', 'task-registry-store', 'training-design-store',
    'world-control-registry-store'].map(n => [`src/server/ai-console-control/${n}.ts`, 'openWritableStore']),
  ...['control-transaction-store', 'formal-evidence-index'].map(n => [`src/server/ai-console-control/${n}.ts`, 'openWritableDatabase']),
  ['src/server/ai-console-observability/training-telemetry-store.ts', 'openWritableStore'],
  ['scripts/lib/ai-painter-autonomous-closed-loop-v1.mjs', 'openDatabase'],
  ['scripts/lib/ai-painter-capability-lifecycle-v1.mjs', 'openDb'],
  ['scripts/lib/ai-painter-machine-capability-release-orchestrator-v1.mjs', 'openDb'],
  ['scripts/lib/ai-pet-world-storage-catalog.mjs', 'openStorageCatalog'],
]

// Execute each actual initializer body with controlled filesystem/database
// dependencies. No project module, real database or training entry is loaded.
function initializer([file, name], options = {}) {
  const source = ts.createSourceFile(file, fs.readFileSync(file, 'utf8'), ts.ScriptTarget.Latest, true)
  const declaration = source.statements.find(n => ts.isFunctionDeclaration(n) && n.name?.text === name)
  assert(declaration, `${file}: missing ${name}`)
  const instances = [], statements = [], failure = new Error('fixture initialization failed'), cleanup = new Error('fixture close failed')
  let fail = options.fail === true
  class DatabaseSync {
    constructor() { this.closeCalls = 0; instances.push(this) }
    exec(sql) { statements.push(sql); if (fail) throw failure }
    prepare() { return { get: () => ({ count: 1 }), all: () => [{ name: 'priority' }], run: () => ({ changes: 1 }) } }
    close() { this.closeCalls++; if (options.closeFails) throw cleanup }
  }
  const context = vm.createContext({ DatabaseSync, path, database: null, catalogPath: 'fixture.sqlite',
    HISTORY_INDEX_PATH: 'fixture.sqlite', getStorePath: () => 'fixture.sqlite', getIndexPath: () => 'fixture.sqlite',
    mkdirSync() {}, existsSync: () => true, ensureStorageRoots() {}, upsertStorageMeta() {},
    verifyDatabaseSchema() {}, verifyDatabase() {}, verifyStore() {}, insertInitialMetadata() {} })
  const code = ts.transpileModule(declaration.getText(source).replace(/^export\s+/u, '') + `\nglobalThis.invoke = ${name};`,
    { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.None } }).outputText
  vm.runInContext(code, context, { filename: file, timeout: 1000 })
  const invoke = () => context.invoke('fixture.sqlite', false)
  return { invoke, instances, statements, failure, context, allowSuccess: () => { fail = false } }
}

for (const target of targets) {
  const label = path.basename(target[0])
  test(`${label}: initialization error closes the newly opened connection`, () => {
    const f = initializer(target, { fail: true })
    assert.throws(f.invoke, e => e === f.failure)
    assert.equal(f.instances.length, 1)
    assert.equal(f.instances[0].closeCalls, 1)
  })
  test(`${label}: close failure cannot replace the initialization error`, () => {
    const f = initializer(target, { fail: true, closeFails: true })
    assert.throws(f.invoke, e => e === f.failure)
    assert.equal(f.instances[0].closeCalls, 1)
  })
  test(`${label}: successful initialization transfers an open connection to the caller`, () => {
    const f = initializer(target)
    assert.equal(f.invoke(), f.instances[0])
    assert.equal(f.instances[0].closeCalls, 0)
    assert(f.statements.length >= 1)
  })
}

test('catalog initialization failure clears the cache before a later explicit open', () => {
  const f = initializer(targets.at(-1), { fail: true })
  assert.throws(f.invoke, e => e === f.failure)
  assert.equal(f.context.database, null)
  f.allowSuccess()
  assert.equal(f.invoke(), f.instances[1])
  assert.equal(f.invoke(), f.instances[1])
  assert.equal(f.instances.length, 2)
})

test('catalog metadata failure also closes and evicts the incomplete connection', () => {
  const f = initializer(targets.at(-1))
  f.context.upsertStorageMeta = () => { throw f.failure }
  assert.throws(f.invoke, e => e === f.failure)
  assert.equal(f.instances[0].closeCalls, 1)
  assert.equal(f.context.database, null)
})
