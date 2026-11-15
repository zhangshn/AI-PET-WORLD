import assert from 'node:assert/strict'
import fs from 'node:fs'
import vm from 'node:vm'
import path from 'node:path'
import { test } from 'node:test'
import ts from 'typescript'

function releaseTransaction(phase, primary, { closeFails = true, rollbackFails = true, restoreFails = false, demoteFails = false } = {}) {
  const file = 'scripts/lib/ai-painter-machine-capability-release-orchestrator-v1.mjs'
  const sf = ts.createSourceFile(file, fs.readFileSync(file, 'utf8'), ts.ScriptTarget.Latest, true)
  const fn = sf.statements.find(n => ts.isFunctionDeclaration(n) && n.name?.text === 'publishMachineAdjudicatedCapability')
  const statements = [...fn.body.statements]
  const start = statements.findIndex(n => ts.isVariableStatement(n) && n.declarationList.declarations.some(d => d.name.getText(sf) === 'db'))
  const end = statements.findIndex((n, i) => i > start && ts.isTryStatement(n))
  assert(start >= 0 && end > start)
  const helper = sf.statements.find(n => ts.isFunctionDeclaration(n) && n.name?.text === 'closeReleaseDatabase')?.getText(sf) ?? ''
  const operations = [], close = new Error('release close'), rollback = new Error('release rollback'), restore = new Error('release restore'), demote = new Error('release demote')
  let closed = 0
  const db = {
    exec(sql) {
      operations.push(sql)
      if (phase === 'begin' && sql === 'BEGIN IMMEDIATE' || phase === 'commit' && sql === 'COMMIT') throw primary
      if (sql === 'ROLLBACK' && rollbackFails) throw rollback
    },
    prepare() {
      if (phase === 'query') throw primary
      return { get: () => ({ revision: null }), run() {} }
    },
    close() { closed++; if (closeFails) throw close },
  }
  const fakeFs = {
    readFileSync() { operations.push('read'); if (phase === 'read') throw primary; return 'old registry' },
    writeFileSync(file) { operations.push(`write:${file}`); if (phase === 'journal' && file.endsWith('publish-journal.json')) throw primary },
    renameSync(from, to) {
      operations.push(`rename:${from}:${to}`)
      if (from.endsWith('.restore') && restoreFails) throw restore
      if (from === 'release' && to === 'staging' && demoteFails) throw demote
    },
    existsSync() { return false },
    rmSync() { throw new Error('failed evidence must not be deleted') },
  }
  const context = vm.createContext({ openDb: () => db, fs: fakeFs, path, process: { pid: 123 }, assert,
    ledgerPath: 'ledger', registryPath: 'registry', staging: 'staging', releaseAbsoluteRoot: 'release',
    expectedRegistryRevision: 0, nextRevision: 1, releaseRelativePath: 'release/release.json', releaseSha256: 'sha',
    recordedAtUtc: 'fixture', draft: { capabilityReleaseIdentity: 'fixture' }, bytesOf: JSON.stringify, nextRegistry: {} })
  vm.runInContext(`${helper}\nglobalThis.invoke = () => { ${statements.slice(start, end + 1).map(n => n.getText(sf)).join('\n')} };`, context)
  return { invoke: context.invoke, operations, close, rollback, restore, demote, closed: () => closed }
}

for (const [label, primary] of [['undefined', undefined], ['null', null], ['false', false], ['frozen Error', Object.freeze(new Error('release primary'))]]) {
  for (const phase of ['read', 'journal', 'begin', 'query', 'commit']) test(`release transaction retains ${label} plus cleanup at ${phase}`, () => {
    const f = releaseTransaction(phase, primary)
    let caught, threw = false
    try { f.invoke() } catch (error) { caught = error; threw = true }
    const expected = [primary, ...(['query', 'commit'].includes(phase) ? [f.rollback] : []), f.close]
    assert.equal(threw, true); assert.equal(caught?.name, 'AggregateError'); assert.equal(caught.cause, primary)
    assert.deepEqual([...caught.errors], expected); assert.equal(f.closed(), 1)
    assert.equal(f.operations.includes('ROLLBACK'), ['query', 'commit'].includes(phase))
  })
}
for (const [label, options] of [['restore', { restoreFails: true }], ['demote', { demoteFails: true }]]) {
  test(`release transaction records ${label} failure and still closes`, () => {
    const primary = new Error('commit failed'), f = releaseTransaction('commit', primary, options)
    assert.throws(f.invoke, e => e.cause === primary && e.errors.length === 4
      && e.errors[0] === primary && e.errors[1] === f.rollback && e.errors[2] === f[label] && e.errors[3] === f.close)
    assert.equal(f.closed(), 1)
    assert(f.operations.includes('rename:release:staging'))
  })
}
test('release transaction retains lone original failure after successful recovery', () => {
  const primary = new Error('commit failed'), f = releaseTransaction('commit', primary, { closeFails: false, rollbackFails: false })
  assert.throws(f.invoke, e => e === primary); assert.equal(f.closed(), 1)
  assert(f.operations.includes('rename:release:staging'))
})
test('release transaction succeeds without recovery and closes exactly once', () => {
  const f = releaseTransaction('success', null, { closeFails: false })
  f.invoke(); assert.equal(f.closed(), 1); assert(f.operations.includes('COMMIT')); assert(!f.operations.includes('ROLLBACK'))
})
test('release transaction reports post-commit close failure without reverting the commit', () => {
  const f = releaseTransaction('success', null)
  assert.throws(f.invoke, e => e === f.close); assert.equal(f.closed(), 1)
  assert(f.operations.includes('COMMIT')); assert(!f.operations.includes('ROLLBACK')); assert(!f.operations.includes('rename:release:staging'))
})

const targets = [
  ...['createExecutionStore', 'registerPassedArtifact', 'transition'].map(name => ['scripts/lib/ai-painter-autonomous-closed-loop-v1.mjs', name]),
  ...['createCapabilityCandidate', 'reconcileLifecycleDatabase'].map(name => ['scripts/lib/ai-painter-capability-lifecycle-v1.mjs', name]),
  ...['initializeCurrentExecutionRegistry', 'ensurePreparedDatabaseRows', 'commitPreparedDatabaseRows'].map(name => ['src/server/ai-painter-current-execution-registry.mjs', name]),
]

// Run the actual transaction region, with injected database failures. Upstream
// validation and downstream publication remain covered by the existing suites.
function transactionRegion([file, name], phase, closeFails, options = {}) {
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
  const failure = Object.hasOwn(options, 'primary') ? options.primary : new Error('fixture primary failure')
  const rollback = new Error('fixture rollback failure'), cleanup = new Error('fixture cleanup failure'), instances = [], operations = []
  class DatabaseSync {
    constructor() { this.closeCalls = 0; instances.push(this) }
    exec(sql) {
      operations.push(sql)
      if (phase === 'begin' && sql === 'BEGIN IMMEDIATE') throw failure
      if (sql === 'ROLLBACK' && options.rollbackFails !== false) throw rollback
    }
    prepare() { throw failure }
    close() { this.closeCalls++; if (closeFails) throw cleanup }
  }
  const context = vm.createContext({ DatabaseSync, openDatabase: () => new DatabaseSync(), openDb: () => new DatabaseSync(),
    initializeDatabase: () => { if (phase === 'initialize') throw failure },
    resolveProjectPath: () => 'fixture.sqlite', projectRoot: 'fixture', databasePath: 'fixture.sqlite',
    sqlitePath: 'fixture.sqlite', store: { sqlitePath: 'fixture.sqlite' }, CURRENT_EXECUTION_REGISTRY_ROOT: '.runtime/fixture',
    testHooks: null, invokeTransactionHook() {}, pending: {}, current: {}, spec: {} })
  const helper = sf.statements.find(n => ts.isFunctionDeclaration(n) &&
    ['closeExecutionDatabase', 'closeLifecycleDatabase', 'closeRegistryDatabase'].includes(n.name?.text))?.getText(sf) ?? ''
  const js = ts.transpileModule(`${helper}\nglobalThis.invoke = async () => { ${code} };`,
    { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.None } }).outputText
  vm.runInContext(js, context, { filename: file, timeout: 1000 })
  return { invoke: context.invoke, failure, rollback, cleanup, instances, operations }
}

function transactionFailureMatches(fixture, error, closeFails) {
  const expected = [fixture.failure, ...(fixture.operations.includes('ROLLBACK') ? [fixture.rollback] : []),
    ...(closeFails ? [fixture.cleanup] : [])]
  if (expected.length === 1) return error === fixture.failure
  return error?.name === 'AggregateError' && error.cause === fixture.failure
    && error.errors?.length === expected.length && expected.every((value, i) => error.errors[i] === value)
}

for (const target of targets) {
  for (const phase of ['begin', 'query']) test(`${target[1]} preserves ${phase} failure when rollback also fails`, async () => {
    const f = transactionRegion(target, phase, false)
    await assert.rejects(f.invoke, e => transactionFailureMatches(f, e, false))
    assert.equal(f.instances.length, 1)
    assert.equal(f.instances[0].closeCalls, 1)
  })
  test(`${target[1]} preserves the primary error when close also fails`, async () => {
    const f = transactionRegion(target, 'query', true)
    await assert.rejects(f.invoke, e => transactionFailureMatches(f, e, true))
    assert.equal(f.instances[0].closeCalls, 1)
  })
}

for (const target of targets.filter(([file]) => file.startsWith('src/'))) test(`${target[1]} closes a connection when schema initialization fails`, async () => {
  const f = transactionRegion(target, 'initialize', false, { rollbackFails: false })
  await assert.rejects(f.invoke, e => e === f.failure)
  assert.equal(f.instances[0].closeCalls, 1)
})

for (const target of targets) {
  for (const [label, primary] of [['undefined', undefined], ['null', null], ['false', false], ['frozen Error', Object.freeze(new Error('frozen primary'))]]) {
    test(`${target[1]} records rollback and close after ${label} without mutating the primary`, async () => {
      const f = transactionRegion(target, 'query', true, { primary })
      await assert.rejects(f.invoke, error => transactionFailureMatches(f, error, true))
      assert.deepEqual(f.operations, ['BEGIN IMMEDIATE', 'ROLLBACK'])
      assert.equal(f.instances[0].closeCalls, 1)
    })
  }
  test(`${target[1]} keeps a lone original failure unchanged when cleanup succeeds`, async () => {
    const f = transactionRegion(target, 'query', false, { rollbackFails: false })
    await assert.rejects(f.invoke, error => error === f.failure)
    assert.equal(f.instances[0].closeCalls, 1)
  })
}

for (const target of targets.filter(([file]) => file.startsWith('src/'))) {
  test(`${target[1]} retains initialization and cleanup failures without changing rollback rules`, async () => {
    const f = transactionRegion(target, 'initialize', true)
    await assert.rejects(f.invoke, error => transactionFailureMatches(f, error, true))
    assert.deepEqual(f.operations, target[1] === 'ensurePreparedDatabaseRows' ? [] : ['ROLLBACK'])
    assert.equal(f.instances[0].closeCalls, 1)
  })
}

// These non-transaction operations must retain both the original operation
// failure and a later close failure, including non-Error thrown values.
function executionDatabaseRegion(name, primary, queryFails, closeFails) {
  const file = 'scripts/lib/ai-painter-autonomous-closed-loop-v1.mjs'
  const sf = ts.createSourceFile(file, fs.readFileSync(file, 'utf8'), ts.ScriptTarget.Latest, true)
  const declaration = key => sf.statements.find(n => ts.isFunctionDeclaration(n) && n.name?.text === key)
  const fn = declaration(name)
  assert(fn, name)
  const statements = [...fn.body.statements]
  const start = statements.findIndex(n => ts.isVariableStatement(n) && n.declarationList.declarations.some(d => d.name.getText(sf) === 'db'))
  const end = statements.findIndex((n, i) => i > start && ts.isTryStatement(n))
  assert(start >= 0 && end > start, name)
  const helper = declaration('closeExecutionDatabase')?.getText(sf) ?? ''
  const cleanup = new Error('fixture connection close failed'), calls = []
  const db = {
    prepare() {
      calls.push('query')
      if (queryFails) throw primary
      return { get: () => ({ package_sha256: 'sha', capability_version: 'fixture', owner_response_required: 0 }), all: () => [], run() {} }
    },
    close() { calls.push('close'); if (closeFails) throw cleanup },
  }
  const context = vm.createContext({ AggregateError, openDatabase: () => db, assert, path: { join: () => 'private-state.json' },
    store: { sqlitePath: 'private.sqlite', executionRoot: 'private' }, sqlitePath: 'private.sqlite',
    spec: { packageIdentity: 'fixture', capabilityVersion: 'fixture' }, packageSha256: 'sha',
    state: {}, evidence: {}, phase: 'fixture', attempt: 1, recordedAtUtc: 'fixture', reviewState: 'review_pending',
    evidenceSha256: 'fixture', writeJsonAtomic() { calls.push('write') } })
  vm.runInContext(`${helper}\nglobalThis.invoke = () => { ${statements.slice(start, end + 1).map(n => n.getText(sf)).join('\n')} };`, context, { timeout: 1000 })
  return { invoke: context.invoke, cleanup, calls }
}

function registryReadRegion(name, primary, queryFails, closeFails) {
  const file = 'src/server/ai-painter-current-execution-registry.mjs'
  const sf = ts.createSourceFile(file, fs.readFileSync(file, 'utf8'), ts.ScriptTarget.Latest, true)
  const declaration = key => sf.statements.find(n => ts.isFunctionDeclaration(n) && n.name?.text === key)
  const fn = declaration(name), statements = [...fn.body.statements]
  const start = statements.findIndex(n => ts.isVariableStatement(n) && n.declarationList.declarations.some(d =>
    ['database', 'catalog'].includes(d.name.getText(sf))))
  const end = statements.findIndex((n, i) => i > start && ts.isTryStatement(n))
  assert(start >= 0 && end > start)
  const calls = [], cleanup = new Error('fixture readonly close failed')
  const db = {
    prepare(sql) {
      calls.push('query')
      if (queryFails) throw primary
      return { get: () => sql.includes('SELECT r.registry_revision') ? undefined
        : { event_sequence: 1, transaction_id: 'fixture', current_sha256: 'sha', status: 'committed',
          event_json: JSON.stringify({ id: 'event' }), sha256: 'sha' } }
    },
    close() { calls.push('close'); if (closeFails) throw cleanup },
  }
  const context = vm.createContext({ AggregateError, Error, path: { join: () => 'private.sqlite' },
    DatabaseSync: class { constructor() { return db } },
    resolveProjectPath: () => 'private.sqlite', resolveTrustedCatalogDatabasePath: () => 'private.sqlite',
    databasePath: 'private.sqlite', projectRoot: 'fixture', CURRENT_EXECUTION_REGISTRY_ROOT: '.runtime/private',
    registry: { registryRevision: 1, eventSequence: 1, transactionId: 'fixture' }, currentSha256: 'sha',
    pending: { registryRevision: 1, eventSequence: 1, transactionId: 'fixture', currentSha256: 'sha' },
    manifest: { programEvent: { eventId: 'event', catalogDatabasePath: 'private.sqlite' },
      catalogArtifacts: [{ logicalPath: 'artifact', sha256: 'sha' }] }, expectedEvent: { id: 'event' },
    requireValue(value, message) { assert(value, message) },
  })
  vm.runInContext(`${declaration('closeRegistryDatabase').getText(sf)}\nglobalThis.invoke = () => {
    ${statements.slice(start, end + 1).map(n => n.getText(sf)).join('\n')} };`, context, { timeout: 1000 })
  return { invoke: context.invoke, calls, cleanup }
}

for (const name of ['verifySqliteCommit', 'verifyPreparedDatabaseRows', 'verifyDependencyManifest']) {
  for (const [label, primary] of [['frozen Error', Object.freeze(new Error('fixture readonly query failed'))],
    ['undefined', undefined], ['null', null], ['false', false]]) {
    test(`registry readonly ${name}: retains ${label} and close failures`, () => {
      const f = registryReadRegion(name, primary, true, true)
      assert.throws(f.invoke, error => error instanceof AggregateError && error.cause === primary &&
        error.errors.length === 2 && error.errors[0] === primary && error.errors[1] === f.cleanup)
      assert.deepEqual(f.calls, ['query', 'close'])
    })
  }
  test(`registry readonly ${name}: preserves a single failure`, () => {
    const primary = new Error('fixture readonly primary'), f = registryReadRegion(name, primary, true, false)
    assert.throws(f.invoke, error => error === primary)
    assert.deepEqual(f.calls, ['query', 'close'])
  })
  test(`registry readonly ${name}: reports close-only failure`, () => {
    const f = registryReadRegion(name, null, false, true)
    assert.throws(f.invoke, error => error === f.cleanup)
    assert.equal(f.calls.filter(call => call === 'close').length, 1)
  })
  test(`registry readonly ${name}: succeeds without write operations`, () => {
    const f = registryReadRegion(name, null, false, false)
    f.invoke()
    assert.equal(f.calls.at(-1), 'close')
    assert.equal(f.calls.filter(call => call === 'close').length, 1)
  })
}

function registryOuterCleanup(primary, { abortFails = false, releaseFails = false,
  durablePrepared = false, hasRoot = true } = {}) {
  const file = 'src/server/ai-painter-current-execution-registry.mjs'
  const sf = ts.createSourceFile(file, fs.readFileSync(file, 'utf8'), ts.ScriptTarget.Latest, true)
  const fn = sf.statements.find(n => ts.isFunctionDeclaration(n) && n.name?.text === 'prepareCurrentExecutionRegistryAdvance')
  const boundary = fn.body.statements.find(n => ts.isTryStatement(n) && n.catchClause)
  assert(boundary)
  const calls = [], aborted = new Error('fixture abort record failed'), released = new Error('fixture claim release failed')
  const context = vm.createContext({ AggregateError, Error, error: primary, projectRoot: 'fixture',
    transactionRoot: hasRoot ? 'private-transaction' : null, transactionId: 'fixture', durablePrepared,
    async writeAbortedPrepareRecord(_root, _transactionRoot, _id, original) {
      calls.push('abort'); assert.equal(original, primary); if (abortFails) throw aborted
    },
    async releaseWriterClaim() { calls.push('release'); if (releaseFails) throw released },
  })
  vm.runInContext(`globalThis.invoke = async () => ${boundary.catchClause.block.getText(sf)};`, context, { timeout: 1000 })
  return { invoke: context.invoke, calls, aborted, released }
}

for (const [label, primary] of [['frozen Error', Object.freeze(new Error('fixture prepare failed'))],
  ['undefined', undefined], ['null', null], ['false', false]]) {
  test(`registry outer cleanup: retains ${label} and both cleanup errors`, async () => {
    const f = registryOuterCleanup(primary, { abortFails: true, releaseFails: true })
    await assert.rejects(f.invoke, error => error instanceof AggregateError && error.cause === primary &&
      error.errors.length === 3 && error.errors[0] === primary && error.errors[1] === f.aborted && error.errors[2] === f.released)
    assert.deepEqual(f.calls, ['abort', 'release'])
  })
}
for (const options of [{}, { abortFails: true }, { releaseFails: true },
  { hasRoot: false, releaseFails: true }, { durablePrepared: true, abortFails: true, releaseFails: true }]) {
  test(`registry outer cleanup: preserves existing cleanup conditions ${JSON.stringify(options)}`, async () => {
    const primary = new Error('fixture prepare failed'), f = registryOuterCleanup(primary, options)
    const expected = [primary, ...(!options.durablePrepared && options.hasRoot !== false && options.abortFails ? [f.aborted] : []),
      ...(!options.durablePrepared && options.releaseFails ? [f.released] : [])]
    await assert.rejects(f.invoke, error => expected.length === 1 ? error === primary
      : error instanceof AggregateError && error.cause === primary && error.errors.length === expected.length &&
        expected.every((value, i) => error.errors[i] === value))
    assert.deepEqual(f.calls, options.durablePrepared ? [] : options.hasRoot === false ? ['release'] : ['abort', 'release'])
  })
}

for (const name of ['readExistingExecutionStore', 'auditExecutionContinuity', 'updateEvidence', 'recordRecovery', 'recordReviewState']) {
  for (const [label, primary] of [['Error', new Error('fixture query failed')], ['undefined', undefined], ['null', null], ['false', false]]) {
    test(`${name} preserves ${label} operation failure together with close failure`, () => {
      const f = executionDatabaseRegion(name, primary, true, true)
      assert.throws(f.invoke, error => error instanceof AggregateError && error.cause === primary
        && error.errors.length === 2 && error.errors[0] === primary && error.errors[1] === f.cleanup)
      assert.deepEqual(f.calls, ['query', 'close'])
    })
  }
  test(`${name} preserves a single operation failure exactly`, () => {
    const primary = new Error('fixture original error'), f = executionDatabaseRegion(name, primary, true, false)
    assert.throws(f.invoke, error => error === primary)
    assert.deepEqual(f.calls, ['query', 'close'])
  })
  test(`${name} reports a close-only failure exactly`, () => {
    const f = executionDatabaseRegion(name, null, false, true)
    assert.throws(f.invoke, error => error === f.cleanup)
    assert.equal(f.calls.filter(call => call === 'close').length, 1)
  })
}

import os from 'node:os'
import { DatabaseSync as TicketDatabase } from 'node:sqlite'
import * as qualificationTickets from '../lib/ai-painter-stage4-v2-readonly-gpu-ticket-v1.mjs'


function privateQualificationTicket(stage) {
  const root=fs.mkdtempSync(path.join(os.tmpdir(),'qualification-ledger-errors-'))
  const write=(name,value)=>{const file=path.join(root,name);fs.mkdirSync(path.dirname(file),{recursive:true});fs.writeFileSync(file,JSON.stringify(value,null,2)+'\n',{flag:'wx'});return qualificationTickets.bindProjectFile(root,name)}
  const issuer=qualificationTickets.ensureStage4V2MachineTicketIssuer({projectRoot:root,keyProtector:{scheme:'fixture_copy_protector_v1',protect:bytes=>Buffer.from(bytes),unprotect:bytes=>Buffer.from(bytes)}})
  const inputEvidence=[write('input.json',{privateFixture:true})],programLineage={nodeAdapter:write('program.mjs',{neverExecuted:true})}
  const payload={schemaVersion:'ai-painter-stage4-v2-readonly-gpu-package-payload-v1',packageId:'private-package',runId:'private-run',outputDirectory:'.runtime/ai-painter/private-output',ledgerPath:qualificationTickets.DEFAULT_STAGE4_V2_QUALIFICATION_LEDGER_PATH,ticketIssuer:issuer.issuerBinding,inputEvidence,programLineage}
  const packagePayloadBinding=write('payload.json',payload),ticket=qualificationTickets.buildStage4V2PreReleaseQualificationTicket({packageId:payload.packageId,runId:payload.runId,packagePayload:payload,packagePayloadBinding,issuer:issuer.issuer,privateKey:issuer.privateKey,inputEvidence,programLineage,outputDirectory:payload.outputDirectory,issuedAtUtc:'2026-09-01T00:00:00.000Z',expiresAtUtc:'2030-09-01T00:00:00.000Z',nonce:'private-fixture-nonce'})
  const ticketBinding=write('ticket.json',ticket),args={projectRoot:root,ticket,ticketBinding,packagePayload:payload,packagePayloadBinding,consumptionPath:'.runtime/ai-painter/private-consumption.json',consumedAtUtc:'2026-09-01T00:01:00.000Z'}
  qualificationTickets.initializeStage4V2QualificationReplayLedger({projectRoot:root})
  if(stage!=='register')qualificationTickets.registerStage4V2QualificationTicket(args)
  if(stage==='prepare-read')assert.throws(()=>qualificationTickets.consumeStage4V2QualificationTicket({...args,_testHooks:{afterConsumptionPrepareCommit(){throw new Error('private_prepare_pause')}}}),/private_prepare_pause/)
  return {root,ticket,args,closureArgs:{...args,closurePath:'.runtime/ai-painter/private-closure.json',reasonCode:'private-fixture',closedAtUtc:'2026-09-01T00:02:00.000Z'}}
}

for(const stage of ['initialize','register','prepare-read','prepare-write','finalize','unconsumed-close'])for(const mode of ['error-and-close','undefined-and-close','null-and-close','false-and-close','operation-only','close-only'])test(`qualification ledger cleanup ${stage}/${mode}`,t=>{
  const f=privateQualificationTicket(stage),a=f.args
  const primary=mode.startsWith('undefined')?undefined:mode.startsWith('null')?null:mode.startsWith('false')?false:Object.freeze(Object.assign(new Error('private_sqlite_io_failure'),{code:'ERR_SQLITE_ERROR',errcode:10}))
  const rollback=Object.freeze(new Error('private_rollback_failure')),close=Object.freeze(new Error('private_close_failure'))
  const failsOperation=mode!=='close-only',failsClose=mode!=='operation-only',transaction=['register','prepare-write','finalize','unconsumed-close'].includes(stage),failsRollback=failsOperation&&failsClose&&transaction
  const original={exec:TicketDatabase.prototype.exec,prepare:TicketDatabase.prototype.prepare,close:TicketDatabase.prototype.close},selected=new WeakSet()
  let begins=0,closes=0,rollbacks=0,threw=false,caught
  const invoke=()=>stage==='initialize'?qualificationTickets.initializeStage4V2QualificationReplayLedger({projectRoot:f.root}):stage==='register'?qualificationTickets.registerStage4V2QualificationTicket(a):stage==='prepare-read'?qualificationTickets.recoverStage4V2QualificationTicketConsumption(a):stage==='unconsumed-close'?qualificationTickets.closeStage4V2UnconsumedQualificationTicket(f.closureArgs):qualificationTickets.consumeStage4V2QualificationTicket(a)
  const mocks=[t.mock.method(TicketDatabase.prototype,'exec',function(sql,...args){
    if(stage==='initialize'&&sql.trimStart().startsWith('PRAGMA busy_timeout')){selected.add(this);if(failsOperation)throw primary}
    if(sql==='BEGIN IMMEDIATE'&&transaction&&++begins===(stage==='finalize'?2:1))selected.add(this)
    const result=original.exec.call(this,sql,...args);if(sql==='ROLLBACK'&&selected.has(this)){rollbacks++;if(failsRollback)throw rollback}return result
  }),t.mock.method(TicketDatabase.prototype,'prepare',function(sql,...args){
    if(stage==='prepare-read'&&/FROM\s+stage4_v2_qualification_consumption_prepares\s+WHERE\s+ticket_id/.test(sql))selected.add(this)
    if(selected.has(this)&&failsOperation&&stage!=='initialize')throw primary
    return original.prepare.call(this,sql,...args)
  }),t.mock.method(TicketDatabase.prototype,'close',function(...args){const result=original.close.apply(this,args);if(selected.has(this)){closes++;if(failsClose)throw close}return result})]
  try{try{invoke()}catch(error){caught=error;threw=true}}finally{for(const mock of mocks.reverse())mock.mock.restore()}
  const expected=[...(failsOperation?[primary]:[]),...(failsRollback?[rollback]:[]),...(failsClose?[close]:[])]
  assert(threw);assert.equal(closes,1);assert.equal(rollbacks,failsOperation&&transaction?1:0)
  if(stage==='finalize'&&failsOperation){
    const wrapper=expected.length>1?caught.cause:caught
    assert(wrapper instanceof Error);assert.equal(wrapper.message,'qualification consumption commit failed: '+(primary instanceof Error?primary.message:String(primary)));assert.equal(wrapper.cause,primary)
    expected[0]=wrapper
  }
  if(expected.length===1)assert.equal(caught,expected[0]);else{assert(caught instanceof AggregateError);assert.equal(caught.cause,expected[0]);assert.deepEqual(caught.errors,expected)}
  const db=new TicketDatabase(path.join(f.root,f.ticket.ledgerPath),{readOnly:true});let row,prepared,closed
  try{row=db.prepare('SELECT status FROM stage4_v2_qualification_tickets WHERE ticket_id=?').get(f.ticket.ticketId);prepared=db.prepare('SELECT status FROM stage4_v2_qualification_consumption_prepares WHERE ticket_id=?').get(f.ticket.ticketId);closed=db.prepare('SELECT ticket_id FROM stage4_v2_qualification_ticket_closures WHERE ticket_id=?').get(f.ticket.ticketId)}finally{db.close()}
  assert.equal(row?.status,stage==='register'&&failsOperation?undefined:stage==='finalize'&&!failsOperation?'consumed_once':'issued_not_consumed')
  assert.equal(prepared?.status,stage==='prepare-read'?'prepared':stage==='finalize'?(failsOperation?'prepared':'committed'):stage==='prepare-write'&&!failsOperation?'prepared':undefined)
  assert.equal(Boolean(closed),stage==='unconsumed-close'&&!failsOperation)
  if(stage==='register')assert.equal(qualificationTickets.registerStage4V2QualificationTicket(a).status,'issued_not_consumed_persisted')
  else if(stage==='initialize')qualificationTickets.initializeStage4V2QualificationReplayLedger({projectRoot:f.root})
  else if(stage==='unconsumed-close'){
    assert.equal(qualificationTickets.closeStage4V2UnconsumedQualificationTicket(f.closureArgs).closure.status,'closed_unconsumed')
    assert.equal(qualificationTickets.closeStage4V2UnconsumedQualificationTicket(f.closureArgs).closure.status,'closed_unconsumed')
    assert.throws(()=>qualificationTickets.consumeStage4V2QualificationTicket(a),/closed unconsumed/)
  }else{
    const recovered=prepared?qualificationTickets.recoverStage4V2QualificationTicketConsumption(a):qualificationTickets.consumeStage4V2QualificationTicket(a)
    assert.equal(recovered.consumption.ticketId,f.ticket.ticketId)
    assert.equal(qualificationTickets.recoverStage4V2QualificationTicketConsumption(a).recoveryStatus,'already_committed_verified')
  }
  assert.equal(fs.existsSync(path.join(f.root,f.ticket.outputDirectory)),false);t.diagnostic('retained private fixture: '+f.root)
})

test('qualification ledger cleanup keeps real identity conflicts distinct from storage faults',t=>{
  const f=privateQualificationTicket('identity')
  assert.equal(qualificationTickets.registerStage4V2QualificationTicket(f.args).registrationStatus,'registered_exact_unconsumed_recovery')
  assert.throws(()=>qualificationTickets.registerStage4V2QualificationTicket({...f.args,ticket:{...f.ticket,ticketId:'conflicting-ticket'}}),error=>error.code==='ERR_ASSERTION'&&/exact re-registration bytes changed/.test(error.message))
  qualificationTickets.consumeStage4V2QualificationTicket(f.args)
  assert.throws(()=>qualificationTickets.registerStage4V2QualificationTicket(f.args),/exact re-registration bytes changed/)
  assert.throws(()=>qualificationTickets.consumeStage4V2QualificationTicket(f.args),/evidence reuse/)
  t.diagnostic('retained private fixture: '+f.root)
})

import {BASELINE_IDENTITY,baselineNeed} from '../lib/natural-world-baseline-proof.mjs'

function scheduledLedgerReadFixture({missingTable=false}={}) {
  const root=fs.realpathSync.native(fs.mkdtempSync(path.join(os.tmpdir(),'scheduled-ledger-read-')))
  const file='scripts/lib/natural-world-scheduled-head.mjs',sf=ts.createSourceFile(file,fs.readFileSync(file,'utf8'),ts.ScriptTarget.Latest,true)
  const fn=sf.statements.find(n=>ts.isFunctionDeclaration(n)&&n.name?.text==='ledgerSnapshot')
  const service=sf.statements.find(n=>ts.isVariableStatement(n)&&n.declarationList.declarations.some(d=>d.name.getText(sf)==='service'))
  assert(fn&&service)
  const context=vm.createContext({fs,path,DatabaseSync:TicketDatabase,BASELINE_IDENTITY,need:baselineNeed,Error,AggregateError})
  vm.runInContext(`${service.getText(sf)};globalThis.servicePath=service;${fn.getText(sf)};globalThis.read=ledgerSnapshot`,context)
  const dbPath=path.join(root,context.servicePath,'accounting','accounting.sqlite');fs.mkdirSync(path.dirname(dbPath),{recursive:true})
  const db=new TicketDatabase(dbPath)
  try{
    db.exec('BEGIN')
    db.exec('CREATE TABLE service(id INTEGER,value TEXT);CREATE TABLE slots(target_tick INTEGER);CREATE TABLE batches(seq INTEGER);INSERT INTO service VALUES(1,\'private-fixture\')')
    for(let i=1;i<=32;i++)db.prepare('INSERT INTO slots VALUES(?)').run(i)
    for(let i=1;i<=20;i++)db.prepare('INSERT INTO batches VALUES(?)').run(i)
    if(missingTable)db.exec('DROP TABLE batches')
    db.exec('COMMIT')
  }finally{db.close()}
  return {read:()=>context.read(root),dbPath,before:fs.readFileSync(dbPath)}
}
const scheduledReadCases=[
  ...['begin','service','slots','batches'].map(phase=>({phase,mode:'error-cleanup'})),
  ...['undefined','null','false'].map(value=>({phase:'service',mode:value+'-cleanup'})),
  {phase:'service',mode:'primary-only'}, {phase:'success',mode:'close-only'},
  {phase:'success',mode:'success'}, {phase:'real-sqlite',mode:'error-cleanup'},
]
for(const {phase,mode} of scheduledReadCases)test(`scheduled ledger read cleanup ${phase} ${mode}`,t=>{
  const f=scheduledLedgerReadFixture({missingTable:phase==='real-sqlite'})
  const primary=mode.startsWith('undefined')?undefined:mode.startsWith('null')?null:mode.startsWith('false')?false:Object.freeze(new Error('scheduled query failed'))
  const cleanup=Object.freeze(new Error('scheduled close failed')),closeFails=mode!=='primary-only'&&mode!=='success'
  const exec=TicketDatabase.prototype.exec,prepare=TicketDatabase.prototype.prepare,closeDb=TicketDatabase.prototype.close
  let closes=0,result,caught,threw=false
  t.mock.method(TicketDatabase.prototype,'exec',function(sql){if(phase==='begin')throw primary;return exec.call(this,sql)})
  t.mock.method(TicketDatabase.prototype,'prepare',function(sql){if(['service','slots','batches'].includes(phase)&&sql.includes('FROM '+phase))throw primary;return prepare.call(this,sql)})
  t.mock.method(TicketDatabase.prototype,'close',function(){closes++;closeDb.call(this);if(closeFails)throw cleanup})
  try{result=f.read()}catch(error){caught=error;threw=true}finally{t.mock.restoreAll()}
  assert.equal(closes,1);assert(fs.readFileSync(f.dbPath).equals(f.before),'readonly ledger changed')
  if(mode==='success'){
    assert.equal(threw,false);assert.equal(result.current.value,'private-fixture')
    assert.deepEqual(Array.from(result.slots,row=>row.target_tick),Array.from({length:28},(_,i)=>i+1))
    assert.deepEqual(Array.from(result.batches,row=>row.seq),Array.from({length:15},(_,i)=>i+1))
  }else{
    assert.equal(threw,true)
    if(mode==='close-only')assert.equal(caught,cleanup)
    else if(mode==='primary-only')assert.equal(caught,primary)
    else{
      assert(caught instanceof AggregateError);assert.equal(caught.errors.length,2);assert.equal(caught.errors[1],cleanup);assert.equal(caught.errors[0],caught.cause)
      if(phase==='real-sqlite'){assert.equal(caught.cause.code,'ERR_SQLITE_ERROR');assert.match(caught.cause.message,/no such table: batches/)}
      else assert.equal(caught.cause,primary)
    }
  }
  if(phase!=='real-sqlite')assert.equal(f.read().slots.length,28)
})

// Exercise the actual SQL-owning regions. Admission and record validation stay
// covered by their store checks; no formal database or world state is modified.
const consoleEvidenceTargets = [
  ['control-transaction-store', 'ensureAiConsoleControlTransaction', 'write'],
  ['formal-evidence-index', 'ensureAiConsoleFormalEvidenceRegistration', 'write'],
  ['control-transaction-store', 'readAiConsoleControlTransactionStore', 'read'],
  ['formal-evidence-index', 'readAiConsoleFormalEvidenceIndex', 'read'],
  ['formal-evidence-index', 'readAiConsoleFormalEvidenceArtifact', 'read'],
]

function consoleEvidenceRegion([module, name, kind], phase, primary, cleanupFails) {
  const simpleStore = /^(task-capsule|policy-boundary-report|task-registry|training-design|capability-lifecycle|review-adjudication|runtime-release-registry|world-control-registry)-store$/u.test(module)
  const file = `src/server/ai-console-control/${module}.ts`
  const source = ts.createSourceFile(file, fs.readFileSync(file, 'utf8'), ts.ScriptTarget.Latest, true)
  assert.equal(source.parseDiagnostics.length, 0, file + ': invalid source syntax')
  const declaration = source.statements.find(n => ts.isFunctionDeclaration(n) && n.name?.text === name)
  assert(declaration, name)
  const statements = [...declaration.body.statements]
  const start = statements.findIndex(n => ts.isVariableStatement(n)
    && n.declarationList.declarations.some(d => d.name.getText(source) === 'database'))
  const end = statements.findIndex((n, i) => i > start && ts.isTryStatement(n))
  assert(start >= 0 && end > start)
  const operations = [], rollback = new Error('console rollback failed'), close = new Error('console close failed')
  let closed = 0
  class DatabaseSync {
    exec(sql) {
      operations.push(sql)
      if (phase === 'begin' && sql === 'BEGIN IMMEDIATE'
        || phase === 'commit' && sql === 'COMMIT'
        || phase === 'read' && sql.startsWith('PRAGMA')) throw primary
      if (sql === 'ROLLBACK' && cleanupFails) throw rollback
    }
    prepare() {
      if (phase === 'lookup') throw primary
      return { get: () => ['replay', 'identity-conflict'].includes(phase) || kind === 'write' && !simpleStore ? {} : undefined, all: () => [] }
    }
    close() { closed++; if (cleanupFails) throw close }
  }
  const context = vm.createContext({ Error, DatabaseSync, openWritableDatabase: () => new DatabaseSync(),
    openWritableStore: () => new DatabaseSync(),
    storePath: 'private.sqlite', storeIdentity: 'fixture', sourceTaskRegistryIdentity: 'fixture',
    sourcePolicyEngineIdentity: 'fixture', taskCapsuleStoreLogicalPath: 'fixture', policyBoundaryReportStoreLogicalPath: 'fixture',
    input: {}, payload: { inputEvidenceIds: [], resultEvidenceIds: [], detectionEvidenceIds: [], preservedStateEvidenceIds: [] },
    contentSha256: 'hash', contentBlob: new Uint8Array(), capsuleId: 'capsule', policyBoundaryReportId: 'report',
    capsuleSelectSql: 'SELECT fixture', reportSelectSql: 'SELECT fixture', sha256Text: () => 'hash',
    storedCapsuleFromRow: value => value, storedReportFromRow: value => value,
    verifyStoredCapsule() {}, verifyStoredReport() {},
    insertCapsule() { if (phase === 'insert') throw primary },
    insertReport() { if (phase === 'insert') throw primary },
    updateMetadata() { if (phase === 'update') throw primary },
    taskRegistryStoreLogicalPath: 'fixture', trainingDesignStoreLogicalPath: 'fixture',
    commandId: 'command', inputSha256: 'input', registryIdentity: 'fixture', executorIdentity: 'fixture',
    receiptSelectSql: 'SELECT fixture', taskSelectSql: 'SELECT fixture', eventSelectSql: 'SELECT fixture',
    modelSelectSql: 'SELECT fixture', planSelectSql: 'SELECT fixture',
    receiptFromRow: () => ({ inputSha256: phase === 'identity-conflict' ? 'conflict' : 'input', eventId: null, targetTaskId: null }),
    verifyReceipt() {}, verifyStoreRecords() {}, taskFromRow: value => value, eventFromRow: value => value,
    modelFromRow: value => value, planFromRow: value => value,
    stripCreationContentBlob: value => value, stripModelBlob: value => value, stripPlanBlob: value => value,
    insertReceipt() { if (phase === 'insert') throw primary },
    capabilityLifecycleStoreLogicalPath: 'fixture', reviewAdjudicationStoreLogicalPath: 'fixture',
    runtimeReleaseRegistryStoreLogicalPath: 'fixture', worldControlRegistryStoreLogicalPath: 'fixture',
    verifyDatabase() {}, verifyRecords() {}, verifyExternalBindings() {}, verifyCandidateCreationContent() {},
    sha256: () => 'hash', sha256Record: () => 'hash',
    parseRecord: () => ({ inputSha256: phase === 'identity-conflict' ? 'conflict' : 'input', eventId: null, targetIdentity: null }),
    parseStoredCandidate: value => value, contractFromRow: value => value, resultFromRow: value => value,
    activationFromRow: value => value, candidateFromRow: value => value, publicationFromRow: value => value, stateFromRow: value => value,
    stripContractBlob: value => value, stripResultBlob: value => value, stripBlob: value => value,
    contractSelectSql: 'SELECT fixture', resultSelectSql: 'SELECT fixture', activationSelectSql: 'SELECT fixture',
    candidateSelectSql: 'SELECT fixture', publicationSelectSql: 'SELECT fixture', stateSelectSql: 'SELECT fixture',
    readAiConsoleRuntimeReleaseRegistryStore: () => ({ status: 'connected', publications: [] }),
    getStorePath: () => 'private.sqlite', getIndexPath: () => 'private.sqlite',
    receipt: { commandId: 'command' }, transaction: { transactionSequence: 1, transactionId: 'transaction' },
    event: { transactionId: 'transaction' }, transactionSelectByIdSql: 'SELECT fixture',
    transactionSelectSql: 'SELECT fixture', registrationSelectSql: 'SELECT fixture', evidenceSelectSql: 'SELECT fixture',
    evidenceId: 'evidence', verifiedPublicRecord: {},
    readAndVerifyMetadata() { if (phase === 'query') throw primary; return { registryRevision: 0, indexRevision: 0, evidenceRecordCount: 0, capsuleCount: 0, reportCount: 0,
      storeRevision: 0, headCapsuleRecordSha256: null, headPolicyBoundaryReportSha256: null } },
    recordFromRow: () => ({ transactionSequence: 1, previousTransactionSha256: null }),
    registrationFromRow: () => ({ commandId: 'command', registrationId: 'registration', indexRevision: 1 }),
    deriveRegistrationId: () => 'registration', readStoredRecordsForRegistration: () => [],
    verifyTransactionRecord() {}, verifyTransactionBindings() {}, verifyRegistration() {},
    verifyDatabaseSchema() {}, verifyDatabaseVersion() {}, verifyDatabaseIntegrity() {},
    storedEvidenceRecordFromRow: value => value, stripContentBlob: value => value,
  })
  const code = statements.slice(start, end + 1).map(n => n.getText(source)).join('\n')
  vm.runInContext(ts.transpileModule(`globalThis.invoke = async () => { ${code} };`,
    { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.None } }).outputText, context)
  return { invoke: context.invoke, operations, rollback, close, closed: () => closed }
}

for (const target of consoleEvidenceTargets) {
  const label = `console evidence storage ${target[1]}`
  for (const [kind, primary] of [['undefined', undefined], ['null', null], ['false', false],
    ['frozen Error', Object.freeze(new Error('console primary failure'))]]) {
    for (const phase of target[2] === 'write' ? ['begin', 'query', 'commit'] : ['read']) {
      for (const cleanupFails of [false, true]) {
        test(`${label}: ${kind} at ${phase}, cleanup failure ${cleanupFails}`, async () => {
          const f = consoleEvidenceRegion(target, phase, primary, cleanupFails)
          let thrown = false, caught, result
          try { result = await f.invoke() } catch (error) { thrown = true; caught = error }
          if (target[2] === 'read' && !cleanupFails) {
            assert.equal(thrown, false)
            assert.equal(result.status, 'unknown_or_stale')
            assert.equal(result.reasonCode, primary instanceof Error ? primary.message
              : target[1] === 'readAiConsoleControlTransactionStore' ? 'ai_console_control_transaction_store_read_failed'
                : target[1] === 'readAiConsoleFormalEvidenceIndex' ? 'ai_console_formal_evidence_index_read_failed'
                  : 'ai_console_formal_evidence_artifact_read_failed')
          } else {
            assert.equal(thrown, true)
            if (!cleanupFails) assert.equal(caught, primary)
            else {
              assert.equal(caught?.name, 'AggregateError')
              assert.equal(caught.cause, primary)
              assert.deepEqual([...caught.errors], [primary,
                ...(target[2] === 'write' && phase !== 'begin' ? [f.rollback] : []), f.close])
            }
          }
          assert.equal(f.closed(), 1)
          assert.equal(f.operations.includes('ROLLBACK'), target[2] === 'write' && phase !== 'begin')
        })
      }
    }
  }
  for (const closeFails of [false, true]) {
    test(`${label}: normal path, close failure ${closeFails}`, async () => {
      const f = consoleEvidenceRegion(target, 'success', undefined, closeFails)
      if (closeFails) await assert.rejects(f.invoke, e => e === f.close)
      else {
        const result = await f.invoke()
        if (target[2] === 'read') assert.equal(result.status,
          target[1] === 'readAiConsoleFormalEvidenceArtifact' ? 'not_found' : 'connected')
      }
      assert.equal(f.closed(), 1)
      assert.equal(f.operations.includes('ROLLBACK'), false)
      assert.equal(f.operations.includes('COMMIT'), target[2] === 'write')
    })
  }
}


const consoleRecordTargets = ['TaskCapsule', 'PolicyBoundaryReport'].flatMap(type => {
  const moduleName = type === 'TaskCapsule' ? 'task-capsule-store' : 'policy-boundary-report-store'
  return [['initializeAiConsole' + type + 'Store', 'initialize'], ['writeAiConsole' + type, 'write'],
    ['readAiConsole' + type + 'Store', 'read']].map(([name, kind]) => [moduleName, name, kind])
})
consoleRecordTargets.push(
  ['task-registry-store', 'initializeAiConsoleTaskRegistryStore', 'initialize'],
  ['task-registry-store', 'executeAiConsoleTaskRegistryCommand', 'write'],
  ['task-registry-store', 'readAiConsoleTaskRegistryStore', 'read'],
  ['training-design-store', 'initializeAiConsoleTrainingDesignStore', 'initialize'],
  ['training-design-store', 'executeAiConsoleTrainingDesignCommand', 'write'],
  ['training-design-store', 'readAiConsoleTrainingDesignStore', 'read'],
)
consoleRecordTargets.push(
  ['capability-lifecycle-store', 'initializeAiConsoleCapabilityLifecycleStore', 'initialize'],
  ['capability-lifecycle-store', 'executeAiConsoleCapabilityCommand', 'write'],
  ['capability-lifecycle-store', 'readAiConsoleCapabilityLifecycleStore', 'read'],
  ['review-adjudication-store', 'initializeAiConsoleReviewAdjudicationStore', 'initialize'],
  ['review-adjudication-store', 'executeAiConsoleReviewCommand', 'write'],
  ['review-adjudication-store', 'readAiConsoleReviewAdjudicationStore', 'read'],
  ['runtime-release-registry-store', 'initializeAiConsoleRuntimeReleaseRegistryStore', 'initialize'],
  ['runtime-release-registry-store', 'executeAiConsoleRuntimeReleaseCommand', 'write'],
  ['runtime-release-registry-store', 'readAiConsoleRuntimeReleaseRegistryStore', 'read'],
  ['world-control-registry-store', 'initializeAiConsoleWorldControlRegistryStore', 'initialize'],
  ['world-control-registry-store', 'executeAiConsoleWorldControlCommand', 'write'],
  ['world-control-registry-store', 'readAiConsoleWorldControlRegistryStore', 'read'],
)
const consoleReadFailureCodes = {
  'task-capsule-store': 'ai_console_task_capsule_store_read_failed',
  'policy-boundary-report-store': 'ai_console_policy_boundary_report_store_read_failed',
  'task-registry-store': 'ai_console_task_registry_store_read_failed',
  'training-design-store': 'ai_console_training_design_store_read_failed',
  'capability-lifecycle-store': 'ai_console_capability_lifecycle_store_read_failed',
  'review-adjudication-store': 'ai_console_review_adjudication_store_read_failed',
  'runtime-release-registry-store': 'ai_console_runtime_release_registry_read_failed',
  'world-control-registry-store': 'ai_console_world_control_registry_read_failed',
}
const consoleStorageTestLabel = target => ['task-registry-store', 'training-design-store'].includes(target[0])
  ? 'task training storage ' : ['task-capsule-store', 'policy-boundary-report-store'].includes(target[0])
    ? 'capsule report storage ' : 'control lifecycle storage '
for (const target of consoleRecordTargets) {
  const commandStore = !['task-capsule-store', 'policy-boundary-report-store'].includes(target[0])
  const label = consoleStorageTestLabel(target) + target[1], kind = target[2]
  for (const [labelValue, primary] of [['undefined', undefined], ['null', null], ['false', false],
    ['frozen Error', Object.freeze(new Error('report primary failed'))]]) {
    for (const phase of kind === 'write' ? [...(commandStore ? ['query'] : []), 'lookup', 'begin', 'insert', 'update', 'commit'] : ['query']) {
      for (const cleanupFails of [false, true]) {
        test(label + ': ' + labelValue + ' at ' + phase + ', cleanup failure ' + cleanupFails, async () => {
          const f = consoleEvidenceRegion(target, phase, primary, cleanupFails)
          let thrown = false, caught, result
          try { result = await f.invoke() } catch (error) { thrown = true; caught = error }
          const needsRollback = kind === 'write' && ['insert', 'update', 'commit'].includes(phase)
          if (kind === 'read' && !cleanupFails) {
            assert.equal(thrown, false)
            assert.equal(result.status, 'unknown_or_stale')
            assert.equal(result.reasonCode, primary instanceof Error ? primary.message : consoleReadFailureCodes[target[0]])
          } else {
            assert.equal(thrown, true)
            if (!cleanupFails) assert.equal(caught, primary)
            else {
              assert.equal(caught?.name, 'AggregateError')
              assert.equal(caught.cause, primary)
              assert.deepEqual([...caught.errors], [primary, ...(needsRollback ? [f.rollback] : []), f.close])
            }
          }
          assert.equal(f.closed(), 1)
          assert.equal(f.operations.includes('ROLLBACK'), needsRollback)
        })
      }
    }
  }
  for (const closeFails of [false, true]) {
    test(label + ': success, close failure ' + closeFails, async () => {
      const f = consoleEvidenceRegion(target, 'success', undefined, closeFails)
      if (closeFails) await assert.rejects(f.invoke, error => error === f.close)
      else {
        const result = await f.invoke()
        assert(result)
        if (kind === 'read') assert.equal(result.status, 'connected')
      }
      assert.equal(f.closed(), 1)
      assert.equal(f.operations.includes('COMMIT'), kind === 'write')
      assert.equal(f.operations.includes('ROLLBACK'), false)
    })
  }
}


for (const target of consoleRecordTargets.filter(t => !['task-capsule-store', 'policy-boundary-report-store'].includes(t[0]) && t[2] === 'write')) {
  for (const cleanupFails of [false, true]) {
    test(consoleStorageTestLabel(target) + target[1] + ': idempotent replay, close failure ' + cleanupFails, async () => {
      const f = consoleEvidenceRegion(target, 'replay', undefined, cleanupFails)
      if (cleanupFails) await assert.rejects(f.invoke, e => e === f.close)
      else {
        const result = await f.invoke()
        assert.equal(result.replayed, true)
        assert.equal(result.httpStatus, 200)
      }
      assert.equal(f.closed(), 1)
      assert.equal(f.operations.length, 0)
    })
    test(consoleStorageTestLabel(target) + target[1] + ': idempotency conflict, close failure ' + cleanupFails, async () => {
      const f = consoleEvidenceRegion(target, 'identity-conflict', undefined, cleanupFails)
      await assert.rejects(f.invoke, error => {
        const primary = cleanupFails ? error.cause : error
        assert.match(primary.message, /idempotency_conflict$/u)
        if (cleanupFails) {
          assert.equal(error.name, 'AggregateError')
          assert.deepEqual([...error.errors], [primary, f.close])
        }
        return true
      })
      assert.equal(f.closed(), 1)
      assert.equal(f.operations.length, 0)
    })
  }
}
