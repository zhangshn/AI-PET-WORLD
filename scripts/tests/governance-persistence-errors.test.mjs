import assert from 'node:assert/strict'
import fs from 'node:fs'
import vm from 'node:vm'
import { DatabaseSync as RealDatabase } from 'node:sqlite'
import { test } from 'node:test'
import ts from 'typescript'

const targets = [
  ['scripts/lib/ai-painter-local-autonomy-governance-v3.mjs', 'persistPolicyBoundaryReport'],
  ['scripts/lib/ai-painter-autonomous-package-decision-core-v3.mjs', 'applyRuntimeStateTransition'],
]

// Execute the actual persistence region without loading the capability/model
// graph. Existing end-to-end fixtures exercise validation and successful writes.
function fixture(target, { phase = null, rollbackFails = false, closeFails = false, primary = new Error('storage failure') } = {}) {
  const [file, name] = target
  const sf = ts.createSourceFile(file, fs.readFileSync(file, 'utf8'), ts.ScriptTarget.Latest, true)
  const fn = sf.statements.find(n => ts.isFunctionDeclaration(n) && n.name?.text === name)
  assert(fn, name)
  const statements = [...fn.body.statements]
  const first = statements.findIndex(n => ts.isVariableStatement(n) && n.declarationList.declarations.some(d => d.name.getText(sf) === 'db'))
  const last = statements.findIndex((n, i) => i > first && ts.isTryStatement(n))
  assert(first >= 0 && last > first)
  const source = statements.slice(first, last + 1).map(n => n.getText(sf)).join('\n')
  const calls = [], cleanup = new Error('cleanup failure'), state = { currentState: 'before' }
  let closes = 0, temporaryExists = true, finalExists = false
  class DatabaseSync {
    exec(sql) {
      calls.push(sql)
      if ((phase === 'initialize' && sql.includes('CREATE TABLE')) ||
          (phase === 'begin' && sql === 'BEGIN IMMEDIATE') ||
          (phase === 'commit' && sql === 'COMMIT')) throw primary
      if (sql === 'ROLLBACK' && rollbackFails) throw cleanup
    }
    prepare() { return { run() { if (phase === 'query') throw primary } } }
    close() { closes++; if (closeFails) throw cleanup }
  }
  const context = vm.createContext({
    DatabaseSync, ledgerPath: 'fixture.sqlite', ledgerAbsolutePath: 'fixture.sqlite',
    report: {}, reportSha256: 'fixture', logicalDirectory: 'fixture',
    temporaryDirectory: 'temporary', finalDirectory: 'final',
    ticket: { targetState: 'after' }, executionState: state, consumedAt: 'fixture', ticketLedgerPath: 'fixture',
    fs: {
      renameSync() { if (phase === 'rename') throw primary; temporaryExists = false; finalExists = true },
      existsSync: () => temporaryExists,
      rmSync() { calls.push('delete temporary report'); temporaryExists = false },
    },
  })
  vm.runInContext(`globalThis.invoke = () => { ${source} };`, context, { filename: file, timeout: 1000 })
  return { invoke: context.invoke, primary, cleanup, calls, state, closes: () => closes,
    evidence: () => ({ temporaryExists, finalExists }) }
}

for (const target of targets) {
  for (const phase of ['initialize', 'begin', 'query', 'commit']) {
    for (const closeFails of [false, true]) test(`${target[1]} preserves ${phase} error with cleanup failure=${closeFails}`, () => {
      const f = fixture(target, { phase, rollbackFails: true, closeFails })
      assert.throws(f.invoke, e => e === f.primary)
      assert.equal(f.closes(), 1)
      assert.equal(f.state.currentState, 'before')
    })
  }
  test(`${target[1]} reports a close failure after otherwise successful work`, () => {
    const f = fixture(target, { closeFails: true })
    assert.throws(f.invoke, e => e === f.cleanup)
    assert.equal(f.closes(), 1)
  })
  test(`${target[1]} succeeds with original commit and close ordering`, () => {
    const f = fixture(target)
    f.invoke()
    assert.equal(f.closes(), 1)
    assert.equal(f.calls.filter(x => x === 'COMMIT').length, 1)
    assert(!f.calls.includes('ROLLBACK'))
    if (target[1] === 'applyRuntimeStateTransition') assert.equal(f.state.currentState, 'after')
  })
}

for (const phase of ['query', 'rename', 'commit']) test(`policy report keeps actual evidence after ${phase} failure`, () => {
  const f = fixture(targets[0], { phase })
  assert.throws(f.invoke, e => e === f.primary)
  assert(!f.calls.includes('delete temporary report'))
  assert.deepEqual(f.evidence(), { temporaryExists: phase !== 'commit', finalExists: phase === 'commit' })
})

for (const [label, schema, second, expectedCode] of [
  ['primary key', 'CREATE TABLE t (id TEXT PRIMARY KEY, value TEXT UNIQUE); INSERT INTO t VALUES (\'a\',\'x\')', "INSERT INTO t VALUES ('a','y')", 1555],
  ['unique output', 'CREATE TABLE t (id TEXT PRIMARY KEY, value TEXT UNIQUE); INSERT INTO t VALUES (\'a\',\'x\')', "INSERT INTO t VALUES ('b','x')", 2067],
]) test(`ticket duplicate classification uses real SQLite ${label} errors`, () => {
  const db = new RealDatabase(':memory:')
  let failure
  try {
    db.exec(schema)
    try { db.exec(second) } catch (error) { failure = error }
  } finally { db.close() }
  assert.equal(failure.errcode, expectedCode)
  const f = fixture(targets[1], { phase: 'query', primary: failure, rollbackFails: true, closeFails: true })
  assert.throws(f.invoke, e => /ticket replay or output reuse rejected/u.test(e.message) && e.cause === failure)
  assert.equal(f.state.currentState, 'before')
})

for (const code of [5, 10, 1299, 19]) test(`ticket database error ${code} is not falsely classified as replay`, () => {
  const primary = Object.assign(new Error('real storage failure'), { code: 'ERR_SQLITE_ERROR', errcode: code })
  const f = fixture(targets[1], { phase: 'query', primary })
  assert.throws(f.invoke, e => e === primary)
})
