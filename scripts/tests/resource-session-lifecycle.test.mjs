import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import test from 'node:test'
import ts from 'typescript'
import {EventEmitter} from 'node:events'

const flush=()=>new Promise(resolve=>setImmediate(resolve))
const deferred=()=>{let resolve;const promise=new Promise(r=>{resolve=r});return {promise,resolve}}
function fixture({holdSample=0,failAppendAt=0,failFinalWrite=false,atomicFailure=null}={}) {
  const files=new Map(),timers=[],operations=[],held=deferred()
  let calls=0,active=0,maxActive=0,appends=0,temporaryIdentity=0
  const sample=async()=>{
    calls++;active++;maxActive=Math.max(maxActive,active)
    if(calls===holdSample)await held.promise
    active--
    return {stdout:'Private GPU, 100, 10, 10, 40, 50, 100, private-driver'}
  }
  const failure=Object.assign(Error('private resource write failure'),{code:'EIO'})
  const io={
    mkdir:async()=>{},
    writeFile:async(file,text)=>{operations.push(['write',path.basename(file)]);if((failFinalWrite||atomicFailure==='write')&&file.includes('latest-session.json')){files.set(file,'partial');throw failure};files.set(file,Buffer.isBuffer(text)?text.toString():text)},
    appendFile:async(file,text)=>{appends++;if(appends===failAppendAt)throw failure;operations.push(['append',path.basename(file)]);files.set(file,(files.get(file)??'')+text)},
    readFile:async file=>{if(!files.has(file))throw Object.assign(Error('absent'),{code:'ENOENT'});return files.get(file)},
    rm:async file=>{operations.push(['rm',path.basename(file)]);files.delete(file)},
    open:async(file,mode)=>{assert.equal(mode,'wx');assert(!files.has(file));return {
      writeFile:bytes=>io.writeFile(file,bytes),
      sync:async()=>{operations.push(['sync',path.basename(file)]);if(atomicFailure==='sync'&&file.includes('latest-session.json'))throw failure},
      close:async()=>{operations.push(['close',path.basename(file)])},
    }},
    rename:async(from,to)=>{operations.push(['rename',path.basename(to)]);if(atomicFailure==='rename'&&to.endsWith('latest-session.json'))throw failure;files.set(to,files.get(from));files.delete(from)},
  }
  const source=fs.readFileSync('src/server/ai-painter-resource-usage.ts','utf8')
  const output=ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,esModuleInterop:true}}).outputText
  const exports={}
  const resolve=id=>{
    if(id==='node:path')return path
    if(id==='node:fs/promises')return io
    if(id==='node:child_process')return {execFile:()=>{throw Error('real subprocess forbidden')}}
    if(id==='node:util')return {promisify:()=>sample}
    if(id==='node:crypto')return {randomUUID:()=>String(++temporaryIdentity)}
    if(id==='@/server/ai-pet-world-storage')return {aiPainterRuntimeRoot:path.resolve('private-resource-session/.runtime/ai-painter')}
    if(id==='@/server/ai-pet-world-storage-catalog')return {}
    if(id==='./ai-painter-training-state'){
      const writer={}
      const code=ts.transpileModule(fs.readFileSync('src/server/ai-painter-training-state.ts','utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,esModuleInterop:true}}).outputText
      new Function('require','exports',code)(resolve,writer)
      return writer
    }
    if(id.endsWith('runtime-working-directory.mjs'))return {runtimeWorkingDirectory:()=>path.resolve('private-resource-session')}
    throw Error('unexpected dependency '+id)
  }
  new Function('require','exports','setInterval','clearInterval',output)(resolve,exports,callback=>{const timer={callback,active:true};timers.push(timer);return timer},timer=>{timer.active=false})
  return {exports,files,operations,held,failure,get calls(){return calls},get maxActive(){return maxActive},tick(){for(const timer of timers)if(timer.active)timer.callback()}}
}
const completed={status:'completed',error:null}

// Run the actual POSIX launcher bodies with fake OS boundaries, including on Windows.
// No process is spawned and no project log is opened by these failure injections.
const backgroundLaunchers = [
  ['scripts/lib/ai-painter-autonomous-background-launcher-v1.mjs', 'launchCommandDetached'],
  ['scripts/launch-ai-painter-stage4-v2-readonly-gpu-qualification-background.mjs', 'launchPosixDetachedProcess'],
  ['scripts/lib/ai-painter-autonomous-background-launcher-v1.mjs', 'launchWithDetachedProcess'],
]
function backgroundLogFixture([file, name], mode) {
  const tree = ts.createSourceFile(file, fs.readFileSync(file, 'utf8'), ts.ScriptTarget.Latest, true)
  const declaration = tree.statements.find(n => ts.isFunctionDeclaration(n) && n.name?.text === name)
  assert(declaration, `${file}: missing ${name}`)
  const failure = Object.assign(Error(`injected ${mode}`), {code: 'EIO'})
  const secondFailure = Object.assign(Error('second descriptor close failed'), {code: 'EBADF'})
  const opened = [], closed = [], spawned = [], identityReads = []
  const stderrFd = mode === 'stderr-zero' ? 0 : 42
  const io = {
    openSync(filePath, flags) {
      assert.equal(flags, 'ax')
      opened.push(path.basename(filePath))
      if ((opened.length === 1 && mode === 'stdout-open-failure') ||
          (opened.length === 2 && mode === 'stderr-open-failure')) throw failure
      return opened.length === 1 ? 41 : stderrFd
    },
    closeSync(fd) {
      closed.push(fd)
      if (fd === 41 && ['stdout-close-failure', 'both-close-failure'].includes(mode)) throw failure
      if (fd === stderrFd && mode === 'stderr-close-failure') throw failure
      if (fd === stderrFd && ['both-close-failure', 'spawn-and-close-failure'].includes(mode)) throw secondFailure
    },
  }
  const attempt = {runnerArgs: ['--bound', 'argument with spaces']}
  const absoluteRunner = path.resolve('private-background/runner.mjs')
  const expectedArgs = ['--title=private-bound-attempt', absoluteRunner, ...attempt.runnerArgs]
  const spawn = (executable, args, options) => {
    spawned.push({executable, args, options})
    assert.equal(executable, 'private-node')
    assert.deepEqual(args, expectedArgs)
    assert.deepEqual(options.stdio, ['ignore', 41, stderrFd])
    assert.equal(options.detached, true)
    assert.equal(options.windowsHide, true)
    if (name === 'launchWithDetachedProcess') {
      assert.equal(options.env.AI_PAINTER_AUTONOMOUS_BACKGROUND, '1')
      assert.equal(options.env.FIXTURE_PARENT, 'keep')
    }
    if (['spawn-failure', 'spawn-and-close-failure'].includes(mode)) throw failure
    const child = new EventEmitter()
    child.pid = 99
    child.unref = () => { if (mode === 'unref-failure') throw failure }
    queueMicrotask(() => child.emit(mode === 'async-spawn-failure' ? 'error' : 'spawn', failure))
    return child
  }
  const exactArgs = (value, runner) => {
    assert.equal(value, attempt)
    assert.equal(runner, absoluteRunner)
    if (mode === 'bound-args-failure') throw failure
    return expectedArgs
  }
  const identity = (command, args) => {
    identityReads.push({command, args})
    assert.equal(command, 'ps')
    assert.deepEqual(closed, [41, stderrFd], 'logs must close before identity lookup')
    if (mode === 'identity-failure') throw failure
    return '2026-11-14T01:00:00.000Z'
  }
  const launch = new Function('fs', 'path', 'spawn', 'exactSpawnNodeArguments', 'execFileSync', 'process', 'assert', 'projectLogicalPath',
    `return (${declaration.getText(tree)})`)(io, path, spawn, exactArgs, identity, {execPath: 'private-node', env: {FIXTURE_PARENT: 'keep'}}, assert,
    (root, filePath) => path.relative(root, filePath).replaceAll('\\', '/'))
  const root = path.resolve('private-background'), launchRoot = path.join(root, 'logs')
  return {failure, secondFailure, opened, closed, spawned, identityReads, stderrFd,
    call: () => launch({root, launchRoot, executable: 'private-node', nodeExecutable: 'private-node', absoluteRunner,
      runnerArgs: ['untrusted caller arguments'], attempt, spawnAttempt: attempt,
      stdoutAbsolute: path.join(launchRoot, 'stdout.log'), stderrAbsolute: path.join(launchRoot, 'stderr.log')})}
}
for (const target of backgroundLaunchers) {
  const modes = ['stdout-open-failure', 'stderr-open-failure', 'bound-args-failure', 'spawn-failure', 'unref-failure',
    'stdout-close-failure', 'stderr-close-failure', 'both-close-failure', 'spawn-and-close-failure', 'identity-failure', 'success', 'stderr-zero']
  if (target[1] !== 'launchCommandDetached') modes.push('async-spawn-failure')
  for (const mode of modes) test(`background log cleanup: ${target[1]} / ${mode}`, async () => {
    const f = backgroundLogFixture(target, mode)
    if (mode === 'success' || mode === 'stderr-zero') {
      const result = await f.call()
      assert.equal(result.processId, 99)
      assert.equal(f.identityReads.length, 1)
      if (target[1] !== 'launchCommandDetached') {
        assert.equal(result.stdoutPath, 'logs/stdout.log')
        assert.equal(result.stderrPath, 'logs/stderr.log')
      }
    } else if (['both-close-failure', 'spawn-and-close-failure'].includes(mode)) {
      await assert.rejects(async () => f.call(), error => {
        assert(error instanceof AggregateError)
        assert.deepEqual(error.errors, [f.failure, f.secondFailure])
        return true
      })
    } else await assert.rejects(async () => f.call(), error => error === f.failure)
    const expectedClosed = mode === 'stdout-open-failure' ? [] : mode === 'stderr-open-failure' ? [41] : [41, f.stderrFd]
    assert.deepEqual(f.closed, expectedClosed)
    assert.equal(f.spawned.length, mode.endsWith('open-failure') || mode === 'bound-args-failure' ? 0 : 1)
  })
}

for(const phase of ['write','sync','rename'])test(`resource latest summary preserves prior bytes on atomic ${phase} failure`,async()=>{
  const f=fixture({atomicFailure:phase}),session=await f.exports.startResourceUsageSession('private')
  const latest=path.resolve('private-resource-session/.runtime/ai-painter/training-resource-usage/latest-session.json')
  f.files.set(latest,'previous valid summary')
  await assert.rejects(session.finish(completed),error=>error===f.failure)
  assert.equal(f.files.get(latest),'previous valid summary')
  assert(!f.operations.some(([operation,file])=>operation==='append'&&file==='session-history.jsonl'))
  assert([...f.files.keys()].some(file=>file.endsWith('current-session.json')))
})

test('resource finish joins pending sampling and prevents late current-session resurrection',async()=>{
  const f=fixture({holdSample:2}),session=await f.exports.startResourceUsageSession('private')
  f.tick();await flush()
  let finished=false
  const terminal=session.finish(completed).then(value=>{finished=true;return value})
  await flush();const finishedBeforeSample=finished
  f.held.resolve();const result=await terminal;await flush()
  assert.equal(finishedBeforeSample,false)
  assert.equal(f.maxActive,1)
  assert.equal(result.sampleCount,3)
  assert(![...f.files.keys()].some(file=>file.endsWith('current-session.json')))
  assert.equal(f.operations.at(-1)[0],'rm')
})

test('resource repeated finish stays bound to the original session after another session completes',async()=>{
  const f=fixture(),a=await f.exports.startResourceUsageSession('private-a')
  const first=a.finish(completed),result=await first
  const b=await f.exports.startResourceUsageSession('private-b');await b.finish(completed)
  const repeated=a.finish({status:'failed',error:'late conflicting request'})
  assert.equal(await repeated,result)
  assert.equal(repeated,first)
  assert.equal(result.sessionId,a.sessionId)
  const history=[...f.files.entries()].find(([file])=>file.endsWith('session-history.jsonl'))[1]
  assert.equal(history.trim().split('\n').length,2)
})

test('resource timer coalesces overlap and captures sampling IO failure separately from training outcome',async()=>{
  const f=fixture({holdSample:2,failAppendAt:2}),session=await f.exports.startResourceUsageSession('private')
  f.tick();f.tick();f.tick();await flush()
  f.held.resolve();await flush()
  const result=await session.finish(completed)
  assert.equal(f.maxActive,1)
  assert.equal(f.calls,3)
  assert.equal(result.status,'completed')
  assert.equal(result.samplingStatus,'degraded')
  assert.equal(result.samplingError,'resource_sample_collection_failed:EIO')
})

test('resource initial and final write failures are not replaced by a fabricated latest summary',async()=>{
  const initial=fixture({failAppendAt:1})
  await assert.rejects(initial.exports.startResourceUsageSession('private'),error=>error===initial.failure)
  const final=fixture({failFinalWrite:true}),session=await final.exports.startResourceUsageSession('private')
  const first=session.finish(completed)
  await assert.rejects(first,error=>error===final.failure)
  const second=session.finish(completed)
  assert.equal(second,first)
  await assert.rejects(second,error=>error===final.failure)
  assert([...final.files.keys()].some(file=>file.endsWith('current-session.json')))
})

const legacyLockTargets = [
  ['scripts/run-ai-assisted-v7-r5-stage4-coverage-convergence-full-training.mjs', 'ai-assisted-v7-r5-stage4-full-training-lock-v1', 'chainId'],
  ['scripts/run-ai-assisted-v7-r5-stage4-bounded-repair-smoke.mjs', 'stage4-bounded-repair-smoke-lock-v1', 'runId'],
  ['scripts/run-stage4-semantic-mixture-formal-stage.mjs', null, 'runId'],
]
function legacyLockFixture([file], mode) {
  const sf = ts.createSourceFile(file, fs.readFileSync(file, 'utf8'), ts.ScriptTarget.Latest, true)
  const fn = sf.statements.find(n => ts.isFunctionDeclaration(n) && n.name?.text === 'acquireLock')
  assert(fn)
  const primary = Object.assign(new Error(`private ${mode}`), { code: mode === 'open-collision' ? 'EEXIST' : 'EIO' })
  const closeError = new Error('private close failure')
  const fd = mode === 'descriptor-zero' ? 0 : 41
  let bytes = mode === 'open-collision' ? 'foreign-existing-lock' : null
  let ino = 7, device = 1, symlink = false, regular = true, closes = 0, deletes = 0, owner = null
  const readBytes = () => { if (mode === 'read-failure') throw primary; return bytes }
  const info = () => ({ ino, dev: device, isFile: () => regular, isSymbolicLink: () => symlink })
  const io = {
    mkdirSync() {},
    openSync() { if (mode.startsWith('open')) throw primary; bytes = ''; owner = 'lock'; return fd },
    writeFileSync(actual, text) { assert.equal(actual, fd); if (mode.startsWith('write')) throw primary; bytes = text },
    fstatSync(actual) { assert.equal(actual, fd); if (mode === 'stat-failure') throw primary; return info() },
    closeSync(actual) { assert.equal(actual, fd); closes++; owner = null; if (mode.includes('close')) { owner = 'unrelated-file'; throw closeError } },
    lstatSync() { if (bytes === null) throw Object.assign(new Error('missing'), { code: 'ENOENT' }); if (mode === 'lstat-failure') throw primary; return info() },
    existsSync() { return bytes !== null },
    readFileSync: readBytes,
    unlinkSync() { if (mode === 'unlink-failure') throw primary; deletes++; bytes = null },
    rmSync() { this.unlinkSync() },
  }
  const readJson = () => { try { return JSON.parse(readBytes()) } catch { return null } }
  const helperPath = 'scripts/lib/exclusive-file-lock.mjs'
  const helperTree = ts.createSourceFile(helperPath, fs.readFileSync(helperPath, 'utf8'), ts.ScriptTarget.Latest, true)
  const helper = helperTree.statements.find(n => ts.isFunctionDeclaration(n) && n.name?.text === 'acquireExclusiveFileLock')
  assert(helper)
  const acquireExclusiveFileLock = new Function('fs', helper.getText(helperTree).replace(/^export /u, '') + ';return acquireExclusiveFileLock;')(io)
  const invoke = new Function('fs', 'path', 'process', 'MODEL_ROOT', 'LOCK_PATH', 'lockPath', 'chainId', 'runId', 'args', 'stage', 'readJson', 'read', 'acquireExclusiveFileLock', `${fn.getText(sf)};return acquireLock;`)(io, path, { pid: 123 }, 'private-root', 'private-lock', 'private-lock', 'private-run', 'private-run', { runId: 'private-run' }, 0, readJson, readJson, acquireExclusiveFileLock)
  return { invoke, primary, closeError, state: () => ({ bytes, closes, deletes, owner }),
    replace(kind, original) { bytes = original; if (kind === 'inode') ino++; if (kind === 'device') device++; if (kind === 'symlink') symlink = true; if (kind === 'directory') regular = false; if (kind === 'content') bytes = JSON.stringify({ ...JSON.parse(bytes), extra: 'foreign-change' }); if (kind === 'missing') bytes = null },
  }
}
for (const target of legacyLockTargets) {
  for (const mode of ['success', 'descriptor-zero', 'open-collision', 'write-failure', 'write-close-failure', 'stat-failure', 'close-failure',
    'replacement-inode', 'replacement-device', 'replacement-content', 'replacement-symlink', 'replacement-directory', 'missing', 'second-release', 'lstat-failure', 'read-failure', 'unlink-failure']) {
    test(`legacy lock ${target[1] ?? 'semantic-mixture'}: ${mode}`, () => {
      const f = legacyLockFixture(target, mode)
      if (['open-collision', 'write-failure', 'write-close-failure', 'stat-failure', 'close-failure'].includes(mode)) {
        assert.throws(f.invoke, error => {
          if (mode === 'write-close-failure') { assert.equal(error.name, 'AggregateError'); assert.deepEqual(Array.from(error.errors), [f.primary, f.closeError]); assert.equal(error.cause, f.primary); return true }
          return error === (mode === 'close-failure' ? f.closeError : f.primary)
        })
        assert.equal(f.state().closes, mode === 'open-collision' ? 0 : 1)
        assert.equal(f.state().deletes, 0)
        assert.notEqual(f.state().bytes, null)
        return
      }
      const release = f.invoke(), original = f.state().bytes, payload = JSON.parse(original)
      assert.equal(payload.pid, 123); assert.equal(payload[target[2]], 'private-run')
      if (target[1]) { assert.equal(payload.schemaVersion, target[1]); assert(!Number.isNaN(Date.parse(payload.createdAtUtc))) }
      else assert.equal(payload.stage, 0)
      if (mode.startsWith('replacement-')) f.replace(mode.slice(12), original)
      if (mode === 'missing') f.replace('missing', original)
      if (['lstat-failure', 'read-failure', 'unlink-failure'].includes(mode)) {
        assert.throws(release, error => error === f.primary)
        assert.equal(f.state().bytes, original); assert.equal(f.state().deletes, 0)
      } else {
        release()
        if (mode.startsWith('replacement-')) { assert.notEqual(f.state().bytes, null); assert.equal(f.state().deletes, 0) }
        else if (mode === 'missing') assert.equal(f.state().deletes, 0)
        else assert.equal(f.state().deletes, 1)
        if (mode === 'second-release') { f.replace('inode', original); release(); assert.equal(f.state().bytes, original); assert.equal(f.state().deletes, 1) }
      }
      assert.equal(f.state().closes, 1)
    })
  }
}

for (const scenario of ['normal', 'substituted', 'same-inode', 'repeat-release']) {
  test(`shared exclusive lock real files: ${scenario}`, async t => {
    const { acquireExclusiveFileLock } = await import('../lib/exclusive-file-lock.mjs')
    const os = await import('node:os')
    const parent = fs.realpathSync(os.tmpdir()), root = fs.mkdtempSync(path.join(parent, 'exclusive-lock-check-'))
    t.after(() => {
      assert.equal(path.dirname(root), parent)
      assert(path.basename(root).startsWith('exclusive-lock-check-'))
      assert.equal(fs.realpathSync(root), root)
      assert(!fs.lstatSync(root).isSymbolicLink())
      fs.rmSync(root, { recursive: true })
    })
    const file = path.join(root, 'task.lock'), bytes = JSON.stringify({ runId: 'private-run', note: '锁文件原字节' })
    const release = acquireExclusiveFileLock(file, bytes)
    assert.throws(() => acquireExclusiveFileLock(file, bytes), error => error.code === 'EEXIST')
    assert.equal(fs.readFileSync(file, 'utf8'), bytes)
    if (scenario === 'substituted') {
      const original = path.join(root, 'original.lock')
      fs.renameSync(file, original)
      fs.writeFileSync(file, bytes, { flag: 'wx' })
      release()
      assert.equal(fs.readFileSync(file, 'utf8'), bytes)
      assert.equal(fs.readFileSync(original, 'utf8'), bytes)
    } else if (scenario === 'same-inode') {
      fs.writeFileSync(file, 'changed-owner')
      release()
      assert.equal(fs.readFileSync(file, 'utf8'), 'changed-owner')
    } else {
      release()
      assert(!fs.existsSync(file))
      if (scenario === 'repeat-release') {
        const releaseNext = acquireExclusiveFileLock(file, bytes)
        release()
        assert.equal(fs.readFileSync(file, 'utf8'), bytes)
        releaseNext()
        assert(!fs.existsSync(file))
      }
    }
  })
}


const exclusiveEvidenceTargets = [
  'scripts/lib/ai-painter-parameter60-owned-worker-v1.mjs',
  'scripts/lib/ai-painter-decode1-entry-qualification-owned-worker-v2.mjs',
  'scripts/lib/ai-painter-decode1-entry-qualification-owned-worker-v3.mjs',
  'scripts/lib/ai-painter-decode1-entry-qualification-owned-worker-v4.mjs',
  'scripts/lib/ai-painter-owned-worker-native-v1.mjs',
  'scripts/lib/ai-painter-ecology-decode1-native-owner-v2.mjs',
  'scripts/lib/ai-painter-decode1-entry-completion-native-owner-v1.mjs',
]

function exclusiveEvidenceFixture(file, mode) {
  const calls = [], primary = new Error('original evidence write failure'), cleanup = new Error('evidence close failure')
  const memoryFs = {
    openSync(target, flags) { calls.push(['open', target, flags]); if (mode === 'open') throw primary; return 73 },
    writeFileSync(fd, bytes) { calls.push(['write', fd, bytes]); if (mode.startsWith('write')) throw primary },
    fsyncSync(fd) { calls.push(['sync', fd]); if (mode.startsWith('sync')) throw primary },
    closeSync(fd) { calls.push(['close', fd]); if (mode.includes('close')) throw cleanup },
  }
  const extract = (sourcePath, name) => {
    const sf = ts.createSourceFile(sourcePath, fs.readFileSync(sourcePath, 'utf8'), ts.ScriptTarget.Latest, true)
    const fn = sf.statements.find(node => ts.isFunctionDeclaration(node) && node.name?.text === name)
    assert(fn, `${sourcePath}: ${name}`)
    return fn.getText(sf).replace(/^export\s+/u, '')
  }
  const source = extract(file, 'put')
  let shared
  if (source.includes('writeExclusiveEvidence')) {
    shared = new Function('fs', `return (${extract('scripts/lib/exclusive-evidence-write.mjs', 'writeExclusiveEvidence')})`)(memoryFs)
  }
  const invoke = new Function('fs', 'writeExclusiveEvidence', `return (${source})`)(memoryFs, shared)
  return { invoke, calls, primary, cleanup }
}

for (const file of exclusiveEvidenceTargets) {
  for (const mode of ['open', 'write', 'sync', 'close', 'write-close', 'sync-close', 'success']) {
    test(`${path.basename(file)} exclusive evidence preserves ${mode}`, () => {
      const f = exclusiveEvidenceFixture(file, mode), bytes = Buffer.from('原始证据\0\xff')
      if (mode === 'success') assert.equal(f.invoke('/private/evidence', bytes), undefined)
      else assert.throws(() => f.invoke('/private/evidence', bytes), error => {
        if (mode === 'write-close' || mode === 'sync-close') {
          assert(error instanceof AggregateError)
          assert.deepEqual(error.errors, [f.primary, f.cleanup])
          assert.equal(error.cause, f.primary)
          return true
        }
        return error === (mode === 'close' ? f.cleanup : f.primary)
      })
      assert.deepEqual(f.calls[0], ['open', '/private/evidence', 'wx'])
      assert.equal(f.calls.filter(call => call[0] === 'close').length, mode === 'open' ? 0 : 1)
      assert.equal(f.calls.filter(call => call[0] === 'sync').length, mode === 'open' || mode.startsWith('write') ? 0 : 1)
      if (mode !== 'open') assert.strictEqual(f.calls[1][2], bytes)
    })
  }
}


for (const mode of ['success', 'sync-failure']) {
  test(`exclusive evidence real file: ${mode}`, async t => {
    const os = await import('node:os')
    const parent = fs.realpathSync(os.tmpdir()), root = fs.mkdtempSync(path.join(parent, 'exclusive-evidence-check-'))
    t.after(() => {
      assert.equal(path.dirname(root), parent)
      assert(path.basename(root).startsWith('exclusive-evidence-check-'))
      assert.equal(fs.realpathSync(root), root)
      assert(!fs.lstatSync(root).isSymbolicLink())
      fs.rmSync(root, { recursive: true })
    })
    const { writeExclusiveEvidence } = await import('../lib/exclusive-evidence-write.mjs')
    const file = path.join(root, 'evidence.bin'), bytes = Buffer.from([0, 255, 13, 10, 65]), primary = new Error('injected fsync failure')
    if (mode === 'success') writeExclusiveEvidence(file, bytes)
    else {
      const sourcePath = 'scripts/lib/exclusive-evidence-write.mjs'
      const sf = ts.createSourceFile(sourcePath, fs.readFileSync(sourcePath, 'utf8'), ts.ScriptTarget.Latest, true)
      const fn = sf.statements.find(node => ts.isFunctionDeclaration(node) && node.name?.text === 'writeExclusiveEvidence')
      const faultFs = { ...fs, fsyncSync() { throw primary } }
      const invoke = new Function('fs', `return (${fn.getText(sf).replace(/^export\s+/u, '')})`)(faultFs)
      assert.throws(() => invoke(file, bytes), error => error === primary)
    }
    assert.deepEqual(fs.readFileSync(file), bytes)
    assert.throws(() => writeExclusiveEvidence(file, Buffer.from('replacement')), error => error.code === 'EEXIST')
    assert.deepEqual(fs.readFileSync(file), bytes)
  })
}


test("qualification runtime versions reject each other's accounting instances before worker invocation", async () => {
  const versions=await Promise.all([
    import('../lib/ai-painter-qualification-phase-runtime-v1.mjs'),
    import('../lib/ai-painter-qualification-phase-runtime-v2.mjs'),
    import('../lib/ai-painter-qualification-phase-runtime-v3.mjs'),
  ])
  const root=path.resolve('private-no-io-qualification-fixture'),absolute=path.join(root,'output','run')
  const policy={outputRoot:'output',allowedModes:['cpu_prepare','gpu_qualify'],resources:{cpuOutputBytes:8388608,gpuOutputBytes:16777216,totalOutputBytes:134217728,maxStreamBytes:8388608,failureReserveBytes:65536,cpuPreparationSeconds:240,gpuQualificationSeconds:720,threads:2}}
  const ledgers=versions.map(version=>version.createAccounting(root,absolute,policy))
  for(let i=0;i<versions.length;i++){
    assert.equal(versions[i].createAccounting.name,'createAccounting')
    assert.equal(versions[i].runOwnedPhase.name,'runOwnedPhase')
    assert.equal(versions[i].createAccounting.length,3)
    assert.equal(versions[i].runOwnedPhase.length,3)
    for(let j=0;j<versions.length;j++)await assert.rejects(versions[i].runOwnedPhase(ledgers[j],'not-executed',[]),i===j?/one fixed native invocation/:/local accounting instance required/)
  }
})
