import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import crypto from 'node:crypto'
import { test } from 'node:test'
import { CLOSED_LOOP_CONTRACT_PATH, CLOSED_LOOP_ROOT, PHASES, createExecutionStore, runAutonomousClosedLoop } from '../lib/ai-painter-autonomous-closed-loop-v1.mjs'

const digest = bytes => crypto.createHash('sha256').update(bytes).digest('hex')
const json = value => Buffer.from(JSON.stringify(value, null, 2) + '\n')
function fixture(t) {
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
  const store = createExecutionStore({ root, spec, packageSha256 })
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
  return { root, store, calls, run, lock, lockPath, historyRoot }
}

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
