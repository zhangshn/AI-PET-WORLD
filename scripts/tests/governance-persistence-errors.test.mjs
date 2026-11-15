import assert from 'node:assert/strict'
import fs from 'node:fs'
import vm from 'node:vm'
import { DatabaseSync as RealDatabase } from 'node:sqlite'
import { test } from 'node:test'
import ts from 'typescript'
import { persistPolicyBoundaryReport, LOCAL_GOVERNANCE_CONTRACT_PATH, POLICY_BOUNDARY_ROOT } from '../lib/ai-painter-local-autonomy-governance-v3.mjs'

const targets = [
  ['scripts/lib/ai-painter-local-autonomy-governance-v3.mjs', 'persistPolicyBoundaryReport'],
  ['scripts/lib/ai-painter-autonomous-package-decision-core-v3.mjs', 'applyRuntimeStateTransition'],
]

// Execute the actual persistence region without loading the capability/model
// graph. Existing end-to-end fixtures exercise validation and successful writes.
function fixture(target, options = {}) {
  const { phase = null, rollbackFails = false, closeFails = false } = options
  const primary = Object.hasOwn(options, 'primary') ? options.primary : new Error('storage failure')
  const [file, name] = target
  const sf = ts.createSourceFile(file, fs.readFileSync(file, 'utf8'), ts.ScriptTarget.Latest, true)
  const fn = sf.statements.find(n => ts.isFunctionDeclaration(n) && n.name?.text === name)
  assert(fn, name)
  const statements = [...fn.body.statements]
  const first = statements.findIndex(n => ts.isVariableStatement(n) && n.declarationList.declarations.some(d => d.name.getText(sf) === 'db'))
  const last = statements.findIndex((n, i) => i > first && ts.isTryStatement(n))
  assert(first >= 0 && last > first)
  const source = statements.slice(first, last + 1).map(n => n.getText(sf)).join('\n')
  const calls = [], cleanup = new Error('cleanup failure'), rollback = new Error('rollback failure'), state = { currentState: 'before' }
  let closes = 0, temporaryExists = true, finalExists = false
  class DatabaseSync {
    exec(sql) {
      calls.push(sql)
      if ((phase === 'initialize' && sql.includes('CREATE TABLE')) ||
          (phase === 'begin' && sql === 'BEGIN IMMEDIATE') ||
          (phase === 'commit' && sql === 'COMMIT')) throw primary
      if (sql === 'ROLLBACK' && rollbackFails) throw rollback
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
  const helper = sf.statements.find(n => ts.isFunctionDeclaration(n) && n.name?.text === 'closeCapabilityDatabase')?.getText(sf) ?? ''
  vm.runInContext(`${helper}\nglobalThis.invoke = () => { ${source} };`, context, { filename: file, timeout: 1000 })
  return { invoke: context.invoke, primary, cleanup, rollback, calls, state, closes: () => closes,
    evidence: () => ({ temporaryExists, finalExists }) }
}

for (const target of targets) {
  for (const phase of ['initialize', 'begin', 'query', 'commit']) {
    for (const closeFails of [false, true]) test(`${target[1]} preserves ${phase} error with cleanup failure=${closeFails}`, () => {
      const f = fixture(target, { phase, rollbackFails: true, closeFails })
      const expected = [f.primary, ...(['query', 'commit'].includes(phase) ? [f.rollback] : []), ...(closeFails ? [f.cleanup] : [])]
      assert.throws(f.invoke, e => expected.length === 1 ? e === f.primary
        : e?.name === 'AggregateError' && e.cause === f.primary && e.errors.length === expected.length
          && expected.every((value, index) => value === e.errors[index]))
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

for (const phase of ['success', 'commit', 'close']) test(`policy persistence private SQLite preserves actual state at ${phase}`, t => {
  const root = fs.realpathSync.native(fs.mkdtempSync(path.join(os.tmpdir(), 'policy-persistence-')))
  t.after(() => {
    assert.equal(path.dirname(root), fs.realpathSync.native(os.tmpdir()))
    assert(path.basename(root).startsWith('policy-persistence-'))
    fs.rmSync(root, { recursive: true, force: true })
  })
  const contractPath = path.join(root, LOCAL_GOVERNANCE_CONTRACT_PATH)
  fs.mkdirSync(path.dirname(contractPath), { recursive: true })
  fs.writeFileSync(contractPath, fs.readFileSync(LOCAL_GOVERNANCE_CONTRACT_PATH), { flag: 'wx' })
  fs.writeFileSync(path.join(root, 'source.json'), '{"private":true}', { flag: 'wx' })
  const input = { schemaVersion: 'ai-painter-policy-boundary-report-input-v1', reportId: `private-policy-${phase}`,
    boundaryClass: 'audit_truthfulness_conflict', summaryZh: '私有测试失败证据', failureCode: 'private_test',
    evidencePaths: ['source.json'], safeAlternative: null }
  const exec = RealDatabase.prototype.exec, close = RealDatabase.prototype.close
  const primary = new Error('private commit failure'), rollback = new Error('private rollback failure'), cleanup = new Error('private close failure')
  let closed = 0, caught, threw = false, result
  try {
    RealDatabase.prototype.exec = function (sql) {
      if (phase === 'commit' && sql === 'COMMIT') throw primary
      const value = exec.call(this, sql)
      if (phase === 'commit' && sql === 'ROLLBACK') throw rollback
      return value
    }
    RealDatabase.prototype.close = function () {
      close.call(this); closed++; if (phase !== 'success') throw cleanup
    }
    try { result = persistPolicyBoundaryReport(input, { root }) } catch (error) { threw = true; caught = error }
  } finally { RealDatabase.prototype.exec = exec; RealDatabase.prototype.close = close }
  assert.equal(closed, 1); assert.equal(threw, phase !== 'success')
  if (phase === 'commit') { assert.equal(caught.cause, primary); assert.deepEqual(caught.errors, [primary, rollback, cleanup]) }
  if (phase === 'close') assert.equal(caught, cleanup)
  if (phase === 'success') assert.equal(result.report.status, 'blocked_policy_boundary')
  const report = JSON.parse(fs.readFileSync(path.join(root, POLICY_BOUNDARY_ROOT, input.reportId, 'report.json')))
  assert.equal(report.failureCode, 'private_test'); assert.equal(report.ownerResponseRequired, false)
  const db = new RealDatabase(path.join(root, POLICY_BOUNDARY_ROOT, 'index.sqlite'), { readOnly: true })
  try { assert.equal(db.prepare('SELECT COUNT(*) AS n FROM policy_boundary_reports').get().n, phase === 'commit' ? 0 : 1) }
  finally { db.close() }
})

for (const phase of ['query', 'rename', 'commit']) test(`policy report keeps actual evidence after ${phase} failure`, () => {
  const f = fixture(targets[0], { phase })
  assert.throws(f.invoke, e => e === f.primary)
  assert(!f.calls.includes('delete temporary report'))
  assert.deepEqual(f.evidence(), { temporaryExists: phase !== 'commit', finalExists: phase === 'commit' })
})

for (const target of targets) {
  for (const [label, primary] of [['undefined', undefined], ['null', null], ['false', false], ['frozen Error', Object.freeze(new Error('frozen storage failure'))]]) {
    for (const phase of ['initialize', 'begin', 'query', 'commit']) test(`persistence chain ${target[1]} retains ${label} at ${phase}`, () => {
      const f = fixture(target, { primary, phase, rollbackFails: true, closeFails: true })
      let caught, threw = false
      try { f.invoke() } catch (error) { caught = error; threw = true }
      const expected = [primary, ...(['query', 'commit'].includes(phase) ? [f.rollback] : []), f.cleanup]
      assert.equal(threw, true); assert.equal(caught?.name, 'AggregateError'); assert.equal(caught.cause, primary)
      assert.deepEqual([...caught.errors], expected); assert.equal(f.closes(), 1); assert.equal(f.state.currentState, 'before')
    })
    test(`persistence chain ${target[1]} keeps lone ${label} unchanged`, () => {
      const f = fixture(target, { primary, phase: 'query' })
      let caught, threw = false
      try { f.invoke() } catch (error) { caught = error; threw = true }
      assert.equal(threw, true); assert.equal(caught, primary); assert.equal(f.closes(), 1)
    })
  }
}

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
  assert.throws(f.invoke, e => e?.name === 'AggregateError' && /ticket replay or output reuse rejected/u.test(e.message)
    && e.cause === e.errors[0] && e.errors[0].cause === failure && e.errors[1] === f.rollback && e.errors[2] === f.cleanup
    && e.errors.length === 3)
  assert.equal(f.state.currentState, 'before')
})

for (const code of [5, 10, 1299, 19]) test(`ticket database error ${code} is not falsely classified as replay`, () => {
  const primary = Object.assign(new Error('real storage failure'), { code: 'ERR_SQLITE_ERROR', errcode: code })
  const f = fixture(targets[1], { phase: 'query', primary })
  assert.throws(f.invoke, e => e === primary)
})

// Simulate descriptor-number reuse after close reports an error. A retry must
// never close the unrelated owner now using that number.
const descriptorTargets = [
  ['src/server/ai-painter-local-task-run-store.mjs', 'writeJsonAtomic', false],
  ['src/server/ai-painter-local-task-run-store.mjs', 'acquireTaskLock', true],
  ['scripts/lib/ai-painter-capability-lifecycle-v1.mjs', 'writeTextAtomic', false],
]
function descriptorFixture([file, name, lock], phase) {
  const sf = ts.createSourceFile(file, fs.readFileSync(file, 'utf8'), ts.ScriptTarget.Latest, true)
  const fn = sf.statements.find(n => ts.isFunctionDeclaration(n) && n.name?.text === name)
  assert(fn, name)
  const primary = new Error(`private ${phase} failure`)
  const fd = phase === 'descriptor-zero' ? 0 : 41
  let owner = null, closes = 0, published = false, temporary = false, directorySynced = false
  const events = []
  function failAt(value) { if (phase === value) throw primary }
  const mockFs = {
    mkdirSync() {},
    openSync() { failAt('open'); owner = 'writer'; temporary = true; return fd },
    writeFileSync(actual) { assert.equal(actual, fd); events.push('write'); failAt('write') },
    fsyncSync(actual) { assert.equal(actual, fd); events.push('sync'); failAt('sync') },
    fstatSync(actual) { assert.equal(actual, fd); failAt('stat'); return { ino: 1, dev: 1 } },
    closeSync(actual) {
      assert.equal(actual, fd); closes++; events.push('close')
      if (phase === 'close-before-release' && closes === 1) throw primary
      owner = null
      if (phase === 'close-after-reuse' && closes === 1) { owner = 'unrelated-file'; throw primary }
    },
    renameSync() { events.push('rename'); published = true; temporary = false },
    existsSync() { return temporary },
    unlinkSync() { temporary = false },
  }
  const context = vm.createContext({
    fs: mockFs, path: { resolve: x => x, dirname: () => 'private', basename: x => x, join: (...xs) => xs.join('/') },
    crypto: { randomUUID: () => 'private-uuid' }, process: { pid: 123 },
    LocalTaskRunStoreError: Error,
    syncDirectoryBestEffort() { directorySynced = true },
  })
  vm.runInContext(fn.getText(sf).replace(/^export /u, '') + `;globalThis.invoke = () => ${name}('target', ${lock ? "'private-task', new Date(0)" : "'private-value'"});`, context, { filename: file, timeout: 1000 })
  return { invoke: context.invoke, primary, state: () => ({ owner, closes, published, temporary, directorySynced, events }) }
}
for (const target of descriptorTargets) {
  for (const phase of ['success', 'descriptor-zero', 'open', 'write', 'sync', 'close-before-release', 'close-after-reuse', ...(target[2] ? ['stat'] : [])]) {
    test(`${target[1]} owns and closes its descriptor once: ${phase}`, () => {
      const f = descriptorFixture(target, phase)
      const success = phase === 'success' || phase === 'descriptor-zero'
      if (success) f.invoke()
      else assert.throws(f.invoke, error => error === f.primary)
      const s = f.state()
      assert.equal(s.closes, phase === 'open' ? 0 : 1)
      assert.equal(s.owner, phase === 'close-after-reuse' ? 'unrelated-file' : phase === 'close-before-release' ? 'writer' : null)
      assert.equal(s.published, success && !target[2])
      // Failed locks remain as evidence; temporary atomic-write files are cleaned.
      assert.equal(s.temporary, target[2] && phase !== 'open')
      if (success && !target[2]) assert(s.events.indexOf('close') < s.events.indexOf('rename'))
      if (target[1] === 'writeTextAtomic') assert.equal(s.directorySynced, success)
    })
  }
}

const atomicCleanupTargets = [
  ['src/server/ai-painter-local-task-run-store.mjs', 'writeJsonAtomic', false],
  ['scripts/lib/ai-painter-capability-lifecycle-v1.mjs', 'writeTextAtomic', false],
  ['scripts/lib/ai-painter-capability-lifecycle-v1.mjs', 'writeExclusive', true],
]
function atomicCleanupFixture([file, name, exclusive], mode) {
  const sf = ts.createSourceFile(file, fs.readFileSync(file, 'utf8'), ts.ScriptTarget.Latest, true)
  const fn = sf.statements.find(n => ts.isFunctionDeclaration(n) && n.name?.text === name)
  assert(fn, name)
  const primary = Object.assign(new Error(`private ${mode}`), { code: mode === 'open-collision' ? 'EEXIST' : 'EIO' })
  const closeError = Object.assign(new Error('private close failure'), { code: 'EIO' })
  const unlinkError = Object.assign(new Error('private unlink failure'), { code: 'EACCES' })
  let temporary = mode === 'open-collision' ? 'foreign-file' : null
  let target = 'previous-good', closes = 0, unlinks = 0, renamed = false, directorySynced = false
  const writeFails = mode.startsWith('write') || mode === 'missing-temp-after-failure'
  const syncFails = mode.startsWith('sync')
  const renameFails = mode.startsWith('rename')
  const closeFails = mode.includes('close')
  const unlinkFails = mode.includes('unlink')
  const errors = []
  if (mode.startsWith('open') || writeFails || syncFails || renameFails) errors.push(primary)
  if (closeFails) errors.push(closeError)
  if (unlinkFails) errors.push(unlinkError)
  const mockFs = {
    mkdirSync() {},
    openSync() { if (mode.startsWith('open')) throw primary; if (exclusive) target = 'partial'; else temporary = 'owned'; return 0 },
    writeFileSync(fd) { assert.equal(fd, 0); if (writeFails) throw primary },
    fsyncSync(fd) { assert.equal(fd, 0); if (syncFails) throw primary },
    closeSync(fd) { assert.equal(fd, 0); closes++; if (closeFails) throw closeError },
    renameSync() { if (renameFails) throw primary; renamed = true; target = 'new-good'; temporary = null },
    existsSync() { return temporary !== null },
    unlinkSync() {
      unlinks++
      if (unlinkFails) throw unlinkError
      temporary = null
      if (mode === 'missing-temp-after-failure') throw Object.assign(new Error('already gone'), { code: 'ENOENT' })
    },
  }
  const context = vm.createContext({
    fs: mockFs, path: { resolve: x => x, dirname: () => 'private', basename: x => x, join: (...xs) => xs.join('/') },
    crypto: { randomUUID: () => 'private-fixed-collision' }, process: { pid: 1 },
    syncDirectoryBestEffort() { directorySynced = true },
  })
  vm.runInContext(fn.getText(sf).replace(/^export /u, '') + `;globalThis.invoke = () => ${name}('target', 'private-value');`, context, { filename: file, timeout: 1000 })
  return { invoke: context.invoke, errors, state: () => ({ temporary, target, closes, unlinks, renamed, directorySynced }) }
}
for (const target of atomicCleanupTargets) {
  for (const mode of ['success', 'open-failure', 'open-collision', 'write-failure', 'sync-failure', 'close-failure', 'write-close-failure', 'sync-close-failure',
    ...(!target[2] ? ['rename-failure', 'write-unlink-failure', 'write-close-unlink-failure', 'close-unlink-failure', 'rename-unlink-failure', 'missing-temp-after-failure'] : [])]) {
    test(`${target[1]} preserves write and cleanup evidence: ${mode}`, () => {
      const f = atomicCleanupFixture(target, mode)
      if (!f.errors.length) f.invoke()
      else assert.throws(f.invoke, error => {
        if (f.errors.length === 1) return error === f.errors[0]
        assert.equal(error.name, 'AggregateError')
        assert.deepEqual(Array.from(error.errors), f.errors)
        assert.equal(error.cause, f.errors[0])
        return true
      })
      const s = f.state(), opened = !mode.startsWith('open'), success = mode === 'success', exclusive = target[2]
      assert.equal(s.closes, opened ? 1 : 0)
      assert.equal(s.unlinks, opened && !success && !exclusive ? 1 : 0)
      assert.equal(s.renamed, success && !exclusive)
      assert.equal(s.target, exclusive ? opened ? 'partial' : 'previous-good' : success ? 'new-good' : 'previous-good')
      assert.equal(s.temporary, mode === 'open-collision' ? 'foreign-file' : mode.includes('unlink') ? 'owned' : null)
      if (target[1] !== 'writeJsonAtomic') assert.equal(s.directorySynced, success)
    })
  }
}

import os from 'node:os'
import path from 'node:path'
import { createHash } from 'node:crypto'

function loadBackupFileOperations(bindings) {
  const file='scripts/lib/local-backup/backup-adapter.mjs'
  const tree=ts.createSourceFile(file,fs.readFileSync(file,'utf8'),ts.ScriptTarget.Latest,true)
  const execute=tree.statements.find(n=>ts.isFunctionDeclaration(n)&&n.name?.text==='executeBackup')
  assert(execute)
  const functions=execute.body.statements.filter(n=>ts.isFunctionDeclaration(n)&&['openOutput','digest','copy'].includes(n.name?.text))
  assert.equal(functions.length,3)
  const helper=tree.statements.find(n=>ts.isFunctionDeclaration(n)&&n.name?.text==='finishBackupDescriptors')
  const source=[...(helper?[helper]:[]),...functions].map(n=>n.getText(tree)).join('\n')
  return new Function(...Object.keys(bindings),source+';return {openOutput,digest,copy};')(...Object.values(bindings))
}
for(const kind of ['openOutput','digest','copy']) {
  const scenarios=kind==='openOutput'?['success','stat','stat-close','boundary','boundary-close']:
    ['success','read','read-null','read-undefined','read-close','close','hash-init',...(kind==='copy'?['read-both-close','both-close','write','write-both-close','output-stat','output-stat-close']:[])]
  for(const scenario of scenarios)test(`backup file handles ${kind}/${scenario}`,async t=>{
    const root=fs.mkdtempSync(path.join(os.tmpdir(),'backup-handle-errors-')),input=path.join(root,'input'),output=path.join(root,'output')
    fs.writeFileSync(input,'private copy fixture bytes',{flag:'wx'})
    const primary=scenario==='read-null'?null:scenario==='read-undefined'?undefined:new Error('private '+scenario)
    const closeSource=new Error('source close failed'),closeOutput=new Error('output close failed'),opens=[],closed=[]
    const failures=[]
    let returned,caught=false,error
    const sourceCloseFails=scenario==='close'||scenario==='both-close'||scenario.endsWith('-close')&&kind!=='openOutput'&&!scenario.startsWith('output-stat')
    const outputCloseFails=kind==='openOutput'?scenario.endsWith('-close'):scenario.includes('both-close')||scenario==='output-stat-close'
    const primaryFails=scenario.startsWith('read')||scenario.startsWith('write')||scenario.startsWith('stat')||scenario.startsWith('boundary')||scenario.startsWith('output-stat')||scenario==='hash-init'
    if(primaryFails)failures.push(primary)
    if(kind!=='openOutput'&&sourceCloseFails)failures.push(closeSource)
    if(outputCloseFails)failures.push(closeOutput)
    const io={...fs,
      openSync(file,...args){const fd=fs.openSync(file,...args);opens.push({fd,file});return fd},
      fstatSync(fd,...args){const file=opens.find(x=>x.fd===fd)?.file;if(file===output&&(scenario.startsWith('stat')||scenario.startsWith('output-stat')))throw primary;const stat=fs.fstatSync(fd,...args);if(file===output&&scenario.startsWith('boundary'))stat.nlink=2;return stat},
      readSync(...args){if(scenario.startsWith('read'))throw primary;return fs.readSync(...args)},
      writeSync(...args){if(scenario.startsWith('write'))throw primary;return fs.writeSync(...args)},
      closeSync(fd){const file=opens.find(x=>x.fd===fd)?.file;closed.push(fd);fs.closeSync(fd);if(file===input&&sourceCloseFails)throw closeSource;if(file===output&&outputCloseFails)throw closeOutput},
    }
    const run=loadBackupFileOperations({fs:io,path,Buffer,guard(){},space(){},need(ok){if(!ok)throw primary},signature:stat=>[stat.dev,stat.ino,stat.size,stat.mtimeMs,stat.ctimeMs,stat.nlink].join(':'),limits:{maxFileBytes:1024,chunkBytes:8},containsProtectedContent:()=>false,yieldBatch:async()=>{},createHash(...args){if(scenario==='hash-init')throw primary;return createHash(...args)}})
    try{
      try{if(kind==='openOutput'){returned=run.openOutput(output);io.closeSync(returned)}else if(kind==='digest')returned=await run.digest(input);else returned=await run.copy(input,output)}catch(failure){caught=true;error=failure}
      assert.equal(caught,failures.length>0)
      if(failures.length===1)assert.equal(error,failures[0],'single error identity must be preserved')
      if(failures.length>1){assert(error instanceof AggregateError);assert.deepEqual(error.errors,failures);assert.equal(error.cause,failures[0])}
      for(const {fd}of opens)assert.equal(closed.filter(x=>x===fd).length,1,'every acquired handle must close exactly once')
      if(scenario==='hash-init')assert.equal(opens.length,0,'allocate hashing resources before acquiring files')
      assert.equal(fs.readFileSync(input,'utf8'),'private copy fixture bytes')
      if(kind==='copy'&&scenario==='success'){assert.equal(returned.bytes,26);assert.deepEqual(fs.readFileSync(output),fs.readFileSync(input))}
      if(kind==='digest'&&scenario==='success')assert.equal(returned.sha256,createHash('sha256').update(fs.readFileSync(input)).digest('hex'))
      if(opens.some(x=>x.file===output))assert(fs.existsSync(output),'failed output evidence remains')
    }finally{
      // The old implementation can leak; close only this fixture's unreleased handles.
      for(const {fd}of opens)if(!closed.includes(fd))fs.closeSync(fd)
      t.diagnostic('retained private fixture: '+root)
    }
  })
}
