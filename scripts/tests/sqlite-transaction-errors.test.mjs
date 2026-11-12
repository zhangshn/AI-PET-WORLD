import assert from 'node:assert/strict'
import fs from 'node:fs'
import vm from 'node:vm'
import { test } from 'node:test'
import ts from 'typescript'

const targets = [
  ...['createExecutionStore', 'registerPassedArtifact', 'transition'].map(name => ['scripts/lib/ai-painter-autonomous-closed-loop-v1.mjs', name]),
  ...['createCapabilityCandidate', 'reconcileLifecycleDatabase'].map(name => ['scripts/lib/ai-painter-capability-lifecycle-v1.mjs', name]),
  ...['initializeCurrentExecutionRegistry', 'ensurePreparedDatabaseRows', 'commitPreparedDatabaseRows'].map(name => ['src/server/ai-painter-current-execution-registry.mjs', name]),
]

// Run the actual transaction region, with injected database failures. Upstream
// validation and downstream publication remain covered by the existing suites.
function transactionRegion([file, name], phase, closeFails) {
  const sf = ts.createSourceFile(file, fs.readFileSync(file, 'utf8'), ts.ScriptTarget.Latest, true)
  const fn = sf.statements.find(n => ts.isFunctionDeclaration(n) && n.name?.text === name)
  assert(fn, `${file}: ${name}`)
  const statements = [...fn.body.statements]
  const start = statements.findIndex(n => ts.isVariableStatement(n) && n.declarationList.declarations.some(d =>
    ['db', 'database'].includes(d.name.getText(sf)) && d.initializer &&
    (ts.isNewExpression(d.initializer) || ts.isCallExpression(d.initializer))))
  assert(start >= 0, `${name}: database acquisition missing`)
  const end = statements.findIndex((n, i) => i > start && ts.isTryStatement(n))
  assert(end > start, `${name}: transaction protection missing`)
  const extraClose = statements[end + 1]?.getText(sf).match(/^(?:db|database)\.close\(\);?$/u) ? 1 : 0
  const code = statements.slice(start, end + 1 + extraClose).map(n => n.getText(sf)).join('\n')
  const failure = new Error('fixture primary failure'), cleanup = new Error('fixture cleanup failure'), instances = [], operations = []
  class DatabaseSync {
    constructor() { this.closeCalls = 0; instances.push(this) }
    exec(sql) {
      operations.push(sql)
      if (phase === 'begin' && sql === 'BEGIN IMMEDIATE') throw failure
      if (sql === 'ROLLBACK') throw cleanup
    }
    prepare() { throw failure }
    close() { this.closeCalls++; if (closeFails) throw cleanup }
  }
  const context = vm.createContext({ DatabaseSync, openDatabase: () => new DatabaseSync(), openDb: () => new DatabaseSync(),
    initializeDatabase: () => { if (phase === 'initialize') throw failure },
    resolveProjectPath: () => 'fixture.sqlite', projectRoot: 'fixture', databasePath: 'fixture.sqlite',
    sqlitePath: 'fixture.sqlite', store: { sqlitePath: 'fixture.sqlite' }, CURRENT_EXECUTION_REGISTRY_ROOT: '.runtime/fixture',
    testHooks: null, invokeTransactionHook() {}, pending: {}, current: {}, spec: {} })
  const js = ts.transpileModule(`globalThis.invoke = async () => { ${code} };`,
    { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.None } }).outputText
  vm.runInContext(js, context, { filename: file, timeout: 1000 })
  return { invoke: context.invoke, failure, instances, operations }
}

for (const target of targets) {
  for (const phase of ['begin', 'query']) test(`${target[1]} preserves ${phase} failure when rollback also fails`, async () => {
    const f = transactionRegion(target, phase, false)
    await assert.rejects(f.invoke, e => e === f.failure)
    assert.equal(f.instances.length, 1)
    assert.equal(f.instances[0].closeCalls, 1)
  })
  test(`${target[1]} preserves the primary error when close also fails`, async () => {
    const f = transactionRegion(target, 'query', true)
    await assert.rejects(f.invoke, e => e === f.failure)
    assert.equal(f.instances[0].closeCalls, 1)
  })
}

for (const target of targets.filter(([file]) => file.startsWith('src/'))) test(`${target[1]} closes a connection when schema initialization fails`, async () => {
  const f = transactionRegion(target, 'initialize', false)
  await assert.rejects(f.invoke, e => e === f.failure)
  assert.equal(f.instances[0].closeCalls, 1)
})
