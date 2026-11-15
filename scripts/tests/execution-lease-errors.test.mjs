import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import crypto from 'node:crypto'
import { test } from 'node:test'
import { DatabaseSync } from 'node:sqlite'
import { CLOSED_LOOP_CONTRACT_PATH, CLOSED_LOOP_ROOT, PHASES, createExecutionStore, openExecutionStore, runAutonomousClosedLoop } from '../lib/ai-painter-autonomous-closed-loop-v1.mjs'

const digest = bytes => crypto.createHash('sha256').update(bytes).digest('hex')
const json = value => Buffer.from(JSON.stringify(value, null, 2) + '\n')
function fixture(t, { initialize = true } = {}) {
  const parent = fs.realpathSync(os.tmpdir())
  const root = fs.mkdtempSync(path.join(parent, 'apw-lease-errors-'))
  t.after(() => {
    t.mock.restoreAll()
    assert.equal(path.dirname(fs.realpathSync(root)), parent)
    assert(path.basename(root).startsWith('apw-lease-errors-'))
    assert(!fs.lstatSync(root).isSymbolicLink())
    fs.rmSync(root, { recursive: true, force: false })
  })
  const put = (file, bytes) => {
    const target = path.join(root, file)
    fs.mkdirSync(path.dirname(target), { recursive: true })
    fs.writeFileSync(target, bytes)
    return { path: file, sha256: digest(bytes) }
  }
  put(CLOSED_LOOP_CONTRACT_PATH, fs.readFileSync(CLOSED_LOOP_CONTRACT_PATH))
  const binding = put('scripts/fixture.mjs', Buffer.from('export const fixture = () => ({status:"passed", fixtureOnly:true});\n'))
  const spec = {
    schemaVersion: 'ai-painter-autonomous-closed-loop-package-v1', packageIdentity: 'lease-errors-fixture-only',
    capabilityVersion: 'fixture-not-a-model', ownerAuthorizationRequired: false, ownerInStateMachine: false,
    maxInfrastructureRecoveryAttempts: 0, outputRoot: '.runtime/ai-painter/fixture-output',
    programLineage: { fixture: binding.sha256 }, inputEvidence: [binding],
    phaseAdapters: Object.fromEntries(PHASES.map(p => [p, { kind: 'project_module_export', ...binding, exportName: 'fixture' }])),
  }
  const packageSha256 = digest(json(spec)), calls = []
  const executionRoot = path.join(root, CLOSED_LOOP_ROOT, spec.packageIdentity)
  const store = initialize ? createExecutionStore({ root, spec, packageSha256 })
    : { executionRoot, sqlitePath: path.join(executionRoot, 'execution.sqlite') }
  assert.equal(store.executionRoot, path.join(root, CLOSED_LOOP_ROOT, spec.packageIdentity))
  const lockPath = path.join(store.executionRoot, 'execution-runner-lease')
  const historyRoot = path.join(store.executionRoot, 'execution-runner-lease-history')
  const adapters = Object.fromEntries(PHASES.map(p => [p, async () => { calls.push(p); return { status: 'passed', fixtureOnly: true } }]))
  const run = () => runAutonomousClosedLoop({ root, spec, packageSha256, adapters })
  function lock(pid) {
    const bytes = json({ schemaVersion: 'ai-painter-autonomous-execution-lease-v1', packageIdentity: spec.packageIdentity,
      token: 'a'.repeat(32), pid, hostname: os.hostname(), acquiredAtUtc: '2020-01-01T00:00:00Z', heartbeatAtUtc: '2020-01-01T00:00:00Z' })
    fs.mkdirSync(lockPath)
    fs.writeFileSync(path.join(lockPath, 'lease.json'), bytes)
    return bytes
  }
  return { root, store, spec, packageSha256, calls, run, lock, lockPath, historyRoot }
}

test('actual execution database preserves query and close failures without rewriting state', t => {
  const f = fixture(t), primary = new Error('private SQLite query failure'), cleanup = new Error('private SQLite close failure')
  const statePath = path.join(f.store.executionRoot, 'execution-state.json'), before = fs.readFileSync(statePath)
  const originalClose = DatabaseSync.prototype.close
  let closes = 0
  t.mock.method(DatabaseSync.prototype, 'prepare', () => { throw primary })
  t.mock.method(DatabaseSync.prototype, 'close', function () { closes++; originalClose.call(this); throw cleanup })
  assert.throws(() => openExecutionStore(f), error => error instanceof AggregateError && error.cause === primary
    && error.errors.length === 2 && error.errors[0] === primary && error.errors[1] === cleanup)
  assert.equal(closes, 1)
  assert.deepEqual(fs.readFileSync(statePath), before)
  t.mock.restoreAll()
  assert.equal(openExecutionStore(f).state.state, 'package_materialized')
  assert.deepEqual(f.calls, [])
})

for (const phase of ['initialize', 'query', 'commit']) test(`actual SQLite ${phase} failure preserves cleanup errors and does not publish state`, t => {
  const f = fixture(t, { initialize: false })
  const primary = Object.freeze(new Error('private original ' + phase)), rollback = new Error('private rollback failure'), cleanup = new Error('private close failure')
  const originalExec = DatabaseSync.prototype.exec, originalPrepare = DatabaseSync.prototype.prepare, originalClose = DatabaseSync.prototype.close
  const calls = []
  t.mock.method(DatabaseSync.prototype, 'exec', function (sql) {
    if (sql.includes('CREATE TABLE')) {
      calls.push('initialize')
      if (phase === 'initialize') throw primary
    } else calls.push(sql)
    if (sql === 'COMMIT' && phase === 'commit') throw primary
    if (sql === 'ROLLBACK') throw rollback
    return originalExec.call(this, sql)
  })
  t.mock.method(DatabaseSync.prototype, 'prepare', function (sql) {
    if (phase === 'query') throw primary
    return originalPrepare.call(this, sql)
  })
  t.mock.method(DatabaseSync.prototype, 'close', function () { calls.push('close'); originalClose.call(this); throw cleanup })
  const expected = phase === 'initialize' ? [primary, cleanup] : [primary, rollback, cleanup]
  assert.throws(() => createExecutionStore(f), error => error instanceof AggregateError && error.cause === primary
    && error.errors.length === expected.length && expected.every((value, i) => error.errors[i] === value))
  assert.equal(calls.filter(call => call === 'close').length, 1)
  assert.equal(calls.filter(call => call === 'ROLLBACK').length, phase === 'initialize' ? 0 : 1)
  for (const name of ['execution-state.json', 'progress.json', 'task-capsule.json']) assert.equal(fs.existsSync(path.join(f.store.executionRoot, name)), false)
  t.mock.restoreAll()
  const db = new DatabaseSync(f.store.sqlitePath)
  try {
    assert.equal(db.prepare('SELECT 1 AS value').get().value, 1)
    if (phase !== 'initialize') assert.equal(db.prepare('SELECT COUNT(*) AS count FROM executions').get().count, 0)
  } finally { db.close() }
})

for (const code of ['EIO', 'EINVAL']) test(`unknown process query ${code} preserves the lock and original error`, async t => {
  const f = fixture(t), bytes = f.lock(123456), error = Object.assign(new Error('fixture query failed'), { code })
  t.mock.method(process, 'kill', () => { throw error })
  await assert.rejects(f.run, e => e === error)
  assert.deepEqual(f.calls, [])
  assert.deepEqual(fs.readFileSync(path.join(f.lockPath, 'lease.json')), bytes)
  assert.deepEqual(fs.readdirSync(f.historyRoot), [])
})

test('EPERM cannot authorize stale-lock takeover', async t => {
  const f = fixture(t), bytes = f.lock(123456)
  t.mock.method(process, 'kill', () => { throw Object.assign(new Error('denied'), { code: 'EPERM' }) })
  await assert.rejects(f.run, /active runner/)
  assert.deepEqual(f.calls, [])
  assert.deepEqual(fs.readFileSync(path.join(f.lockPath, 'lease.json')), bytes)
})

for (const pid of [0, -1, 1.5, 2147483648, Number.MAX_SAFE_INTEGER + 1]) test(`invalid PID ${pid} is rejected without querying or moving the lock`, async t => {
  const f = fixture(t), bytes = f.lock(pid)
  const query = t.mock.method(process, 'kill', () => { throw Object.assign(new Error('invalid fixture'), { code: 'ESRCH' }) })
  await assert.rejects(f.run, /PID is invalid/)
  assert.equal(query.mock.callCount(), 0)
  assert.deepEqual(f.calls, [])
  assert.deepEqual(fs.readFileSync(path.join(f.lockPath, 'lease.json')), bytes)
})

test('only ESRCH permits stale takeover and preserves the original lease bytes', async t => {
  const f = fixture(t), bytes = f.lock(123456)
  t.mock.method(process, 'kill', () => { throw Object.assign(new Error('absent'), { code: 'ESRCH' }) })
  assert.equal((await f.run()).state, 'completed')
  assert.deepEqual(f.calls, PHASES)
  const archives = fs.readdirSync(f.historyRoot)
  assert.equal(archives.length, 1)
  assert.deepEqual(fs.readFileSync(path.join(f.historyRoot, archives[0], 'lease.json')), bytes)
  assert(!fs.existsSync(f.lockPath))
  assert.equal((await f.run()).state, 'completed')
  assert.deepEqual(f.calls, PHASES)
})

test('lease publication IO failure is not retried or disguised as contention', async t => {
  const f = fixture(t), error = Object.assign(new Error('fixture rename failed'), { code: 'EIO' })
  const rename = fs.renameSync.bind(fs)
  let attempts = 0
  t.mock.method(fs, 'renameSync', (from, to) => {
    if (to === f.lockPath) { attempts++; throw error }
    return rename(from, to)
  })
  await assert.rejects(f.run, e => e === error)
  assert.equal(attempts, 1)
  assert.deepEqual(f.calls, [])
  assert(!fs.existsSync(f.lockPath))
})

test('post-publication audit IO error retains the published lease and original failure', async t => {
  const f = fixture(t), error = Object.assign(new Error('fixture history failed'), { code: 'EIO' })
  const append = fs.appendFileSync.bind(fs)
  t.mock.method(fs, 'appendFileSync', (file, ...args) => {
    if (path.basename(file) === 'execution-lease-history.jsonl') throw error
    return append(file, ...args)
  })
  await assert.rejects(f.run, e => e === error)
  assert.equal(JSON.parse(fs.readFileSync(path.join(f.lockPath, 'lease.json'))).pid, process.pid)
  assert.deepEqual(f.calls, [])
})

test('normal exclusive execution completes and does not rerun completed phases', async t => {
  const f = fixture(t)
  assert.equal((await f.run()).state, 'completed')
  assert(!fs.existsSync(f.lockPath))
  assert.equal((await f.run()).state, 'completed')
  assert.deepEqual(f.calls, PHASES)
})


for (const scenario of ['success', 'existing', 'partial', 'frozen', 'null', 'undefined', 'zero', 'false', 'rename', 'retry-success', 'retry-exhausted', 'already-published', 'recheck', 'hash', 'deadline'])
test(`current registry publication preserves failure evidence: ${scenario}`, async () => {
  const ts = await import('typescript')
  const filename = 'src/server/ai-painter-current-execution-registry.mjs'
  const tree = ts.createSourceFile(filename, fs.readFileSync(filename, 'utf8'), ts.ScriptTarget.Latest, true, ts.ScriptKind.JS)
  const fn = tree.statements.find(n => ts.isFunctionDeclaration(n) && n.name?.text === 'publishCurrentBytes')
  assert(fn)
  const target = 'private-current.json', temp = `${target}.tmp-${process.pid}-fixture`
  const original = Buffer.from('original'), bytes = Buffer.from('candidate'), foreign = Buffer.from('foreign')
  const files = new Map([[target, original]]), calls = [], waits = []
  const failure = Object.assign(new Error(`publication ${scenario}`), { code: scenario === 'existing' ? 'EEXIST' : scenario.startsWith('retry-') ? 'EBUSY' : 'EIO' })
  const primary = scenario === 'frozen' ? Object.freeze(failure) : scenario === 'null' ? null : scenario === 'undefined' ? undefined : scenario === 'zero' ? 0 : scenario === 'false' ? false : failure
  if (scenario === 'existing') files.set(temp, foreign)
  let attempts = 0
  const requireValue = (ok, message) => { if (!ok) throw new Error(message) }
  const names = ['CURRENT_EXECUTION_REGISTRY_PATH','resolveProjectPath','randomUUID','writeFile','fsyncFile','readFile','rename','unlink','sha256Bytes','requireValue','requireRegistryDeadline','setTimeout']
  const run = new Function(...names, `"use strict";${fn.getText(tree)};return publishCurrentBytes;`)(
    target, (_root, file) => file, () => 'fixture',
    async (file, value, options) => {
      assert.deepEqual(options, { flag: 'wx' }); calls.push('write')
      if (scenario === 'existing') throw primary
      if (['partial','frozen','null','undefined','zero','false'].includes(scenario)) { files.set(file, Buffer.from('partial')); throw primary }
      files.set(file, value)
    },
    file => { calls.push(`sync:${file}`) },
    async file => scenario === 'hash' ? Buffer.from('corrupt') : files.get(file),
    async (from, to) => {
      attempts++
      if (scenario === 'rename' || scenario === 'retry-exhausted' || (scenario === 'retry-success' && attempts < 3)) throw primary
      files.set(to, files.get(from)); files.delete(from)
    },
    async file => { calls.push('unlink'); files.delete(file) },
    digest, requireValue, () => { if (scenario === 'deadline') throw primary },
    (callback, delay) => { waits.push(delay); callback() },
  )
  const operation = run('private-root', bytes, { transactionId: 'private-transaction', deadlineUnixMs: null,
    recheckPublication: async () => { if (scenario === 'recheck') throw primary; return scenario === 'already-published' } })
  if (['success','retry-success','already-published'].includes(scenario)) {
    const result = await operation
    assert.equal(result.status, scenario === 'already-published' ? 'already_published' : 'published')
    assert.deepEqual(files.get(target), scenario === 'already-published' ? original : bytes)
    assert.equal(files.has(temp), false)
  } else {
    await assert.rejects(operation, error => {
      assert.equal(error.publicationDiagnostics.status, 'failed_closed')
      if (scenario === 'hash') assert.match(error.message, /temporary_hash_changed/)
      else if (['frozen','null','undefined','zero','false'].includes(scenario)) {
        assert.equal(error.cause, primary)
        assert.equal(error.message, String(primary?.message ?? primary))
        if (scenario === 'frozen') assert.equal(error.code, 'EIO')
      } else assert.equal(error, primary)
      return true
    })
    assert.deepEqual(files.get(target), original)
    if (scenario === 'existing') assert.deepEqual(files.get(temp), foreign)
    if (['partial','frozen','null','undefined','zero','false'].includes(scenario)) assert.deepEqual(files.get(temp), Buffer.from('partial'))
  }
  assert.equal(attempts, scenario.startsWith('retry-') ? 3 : ['success','rename'].includes(scenario) ? 1 : 0)
  assert.deepEqual(waits, scenario.startsWith('retry-') ? [25,50] : [])
})


for (const phase of ['success','open','close','sync','sync-close']) for (const primary of (phase.startsWith('sync') ? [new Error('sync failed'),Object.freeze(new Error('frozen sync failed')),null,undefined,0,false] : [new Error('file failed')]))
test(`current registry durable sync preserves errors: ${phase}/${String(primary)}`, async () => {
  const ts = await import('typescript')
  const filename = 'src/server/ai-painter-current-execution-registry.mjs'
  const tree = ts.createSourceFile(filename, fs.readFileSync(filename, 'utf8'), ts.ScriptTarget.Latest, true, ts.ScriptKind.JS)
  const fn = tree.statements.find(n => ts.isFunctionDeclaration(n) && n.name?.text === 'fsyncFile')
  assert(fn)
  const calls = [], closing = new Error('close failed')
  let owner = 'registry'
  const run = new Function('openSync','fsyncSync','closeSync',`"use strict";${fn.getText(tree)};return fsyncFile;`)(
    (file, mode) => { assert.equal(file,'private-registry');assert.equal(mode,'r+');calls.push('open');if(phase==='open')throw primary;return 0 },
    fd => { assert.equal(fd,0);calls.push('sync');if(phase.startsWith('sync'))throw primary },
    fd => { assert.equal(fd,0);assert.equal(owner,'registry');calls.push('close');owner='other-file';if(phase.includes('close'))throw closing },
  )
  if(phase==='success') assert.equal(run('private-registry'),undefined)
  else assert.throws(()=>run('private-registry'),error=>{
    if(phase==='sync-close'){
      assert(error instanceof AggregateError);assert.deepEqual(error.errors,[primary,closing]);assert.equal(error.cause,primary)
      assert(error.message.includes(String(primary?.message??primary)));assert(error.message.includes(closing.message))
    } else assert.equal(error,phase==='close'?closing:primary)
    return true
  })
  assert.deepEqual(calls,phase==='open'?['open']:['open','sync','close'])
  assert.equal(owner,phase==='open'?'registry':'other-file')
})
