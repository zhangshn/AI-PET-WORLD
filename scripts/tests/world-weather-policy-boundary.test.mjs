import './weather-display-release-cache.test.mjs'
import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import {parse} from '@babel/parser'
import {DatabaseSync} from 'node:sqlite'
import {spawn} from 'node:child_process'
import {once} from 'node:events'
import {createEvolutionInputReader} from '../lib/natural-world-evolution-input.mjs'
import {baselineSha256} from '../lib/natural-world-baseline-proof.mjs'
import * as reader from '../lib/world-weather-release-policy-reader.mjs'
import * as compatibility from '../lib/world-weather-release-policy.mjs'

function lifecycleFixture(t) {
  const root = fs.realpathSync.native(fs.mkdtempSync(path.join(fs.realpathSync.native(os.tmpdir()), 'weather-lifecycle-reader-')))
  t.after(() => {
    assert.equal(path.dirname(fs.realpathSync.native(root)), fs.realpathSync.native(os.tmpdir()))
    fs.rmSync(root, { recursive: true, force: true })
  })
  const directory = path.join(root, '.runtime/ai-painter/capability-lifecycle', reader.WEATHER_VERSION)
  fs.mkdirSync(directory, { recursive: true })
  const candidate = { schemaVersion: 'ai-painter-capability-change-candidate-v1', capabilityVersion: reader.WEATHER_VERSION,
    changeClass: 'runtime_interface', ownerAuthorizationRequired: false, ownerInLifecycle: false,
    sourceEvidence: [{ path: reader.WEATHER_POLICY_PATH, sha256: baselineSha256(fs.readFileSync(reader.WEATHER_POLICY_PATH)) }] }
  const state = { capabilityVersion: reader.WEATHER_VERSION, changeClass: 'runtime_interface', state: 'candidate_registered', sequence: 0 }
  fs.writeFileSync(path.join(directory, 'candidate.json'), JSON.stringify(candidate))
  fs.writeFileSync(path.join(directory, 'state.json'), JSON.stringify(state))
  const database = path.join(directory, 'lifecycle.sqlite'), db = new DatabaseSync(database)
  // DELETE mode makes a competing exclusive lock deterministic. This fixture
  // does not change the production WAL mode or any real lifecycle database.
  db.exec('PRAGMA journal_mode=DELETE; CREATE TABLE capabilities(capability_version TEXT, state TEXT, change_class TEXT); CREATE TABLE lifecycle_transitions(capability_version TEXT, to_state TEXT, sequence INTEGER)')
  db.prepare('INSERT INTO capabilities VALUES(?,?,?)').run(reader.WEATHER_VERSION, state.state, state.changeClass)
  db.prepare('INSERT INTO lifecycle_transitions VALUES(?,?,?)').run(reader.WEATHER_VERSION, state.state, state.sequence)
  db.close()
  return { root, directory, database, state,
    read: () => reader.readWeatherPolicyLifecycle(root, createEvolutionInputReader(root).read, reader.WEATHER_VERSION) }
}

async function lockLifecycle(database, durationMs) {
  const child = spawn(process.execPath, ['--input-type=module', '-e',
    'import {DatabaseSync} from "node:sqlite"; const db=new DatabaseSync(process.argv[1]);db.exec("BEGIN EXCLUSIVE"); console.log("LOCKED"); setTimeout(()=>{db.exec("ROLLBACK");db.close()},Number(process.argv[2]));',
    database, String(durationMs)], { windowsHide: true, stdio: ['ignore', 'pipe', 'pipe'] })
  let output = '', errors = ''
  child.stdout.on('data', chunk => { output += chunk })
  child.stderr.on('data', chunk => { errors += chunk })
  const exit = once(child, 'exit')
  while (!output.includes('LOCKED')) {
    if (child.exitCode !== null) throw new Error('private lock worker failed: ' + errors)
    await new Promise(resolve => setTimeout(resolve, 10))
  }
  return async () => { const [code] = await exit; assert.equal(code, 0, errors) }
}

test('weather lifecycle reader waits for a short real database lock and retains the exact state', async t => {
  const fixture = lifecycleFixture(t), expected = fixture.read()
  const finished = await lockLifecycle(fixture.database, 400)
  try { assert.deepEqual(fixture.read(), expected) } finally { await finished() }
})

test('weather lifecycle reader fails within its wait budget for a persistent lock, then recovers', async t => {
  const fixture = lifecycleFixture(t), expected = fixture.read()
  const finished = await lockLifecycle(fixture.database, 12500), start = performance.now()
  try {
    assert.throws(() => fixture.read(), error => error.code === 'ERR_SQLITE_ERROR' && /locked/u.test(error.message))
    t.diagnostic('persistent lock read elapsed milliseconds: ' + Math.round(performance.now() - start))
    assert(performance.now() - start >= 4000, 'reader must honor its bounded wait')
    assert(performance.now() - start < 12000, 'reader must not wait beyond the lock lifetime')
  } finally { await finished() }
  assert.deepEqual(fixture.read(), expected)
})

test('weather lifecycle reader still rejects conflicting file and database state', t => {
  const fixture = lifecycleFixture(t)
  fs.writeFileSync(path.join(fixture.directory, 'state.json'), JSON.stringify({ ...fixture.state, sequence: 1 }))
  assert.throws(fixture.read, /lifecycle_state_conflict/u)
})

test('the compatibility entry keeps its public contract and uses the same readonly implementation', () => {
  const names = ['WEATHER_VERSION','WEATHER_POLICY_PATH','WEATHER_RELEASE_PATH','FIRST_WEATHER_VERSION',
    'FIRST_WEATHER_POLICY_PATH','FIRST_WEATHER_RELEASE_PATH','inspectWeatherReleasePolicy','requireWeatherProductionAdmission']
  assert.deepEqual(Object.keys(compatibility).sort(), [...names,'registerWeatherPolicyCandidate'].sort())
  for (const name of names) assert.equal(compatibility[name], reader[name])
  assert.equal(Object.hasOwn(reader, 'registerWeatherPolicyCandidate'), false)
})

test('readonly weather assessment cannot import lifecycle or publication writers, including deferred imports', () => {
  const seen = new Set(), root = path.resolve(import.meta.dirname, '../..')
  const forbidden = new Set(['world-weather-release-policy.mjs','ai-painter-capability-lifecycle-v1.mjs',
    'ai-painter-machine-capability-release-orchestrator-v1.mjs','ai-painter-autonomous-package-decision-core-v3.mjs'])
  function visit(file) {
    assert.equal(forbidden.has(path.basename(file)), false, 'readonly weather assessment reached writer: '+file)
    if (seen.has(file)) return
    seen.add(file)
    const tree = parse(fs.readFileSync(file,'utf8'), {sourceType:'module', plugins:['typescript']})
    const imports = []
    function walk(node) {
      if (!node || typeof node !== 'object') return
      if ((node.type==='ImportDeclaration'||node.type==='ExportNamedDeclaration'||node.type==='ExportAllDeclaration') && node.source) imports.push(node.source.value)
      if (node.type==='CallExpression' && (node.callee.type==='Import'||node.callee.type==='Identifier'&&node.callee.name==='require') && node.arguments[0]?.type==='StringLiteral') imports.push(node.arguments[0].value)
      for (const [key,value] of Object.entries(node)) {
        if (key==='loc'||key==='tokens'||key==='comments') continue
        if (Array.isArray(value)) value.forEach(walk)
        else if (value && typeof value==='object') walk(value)
      }
    }
    walk(tree)
    for (const specifier of imports) if (specifier.startsWith('.')) {
      const target=path.resolve(path.dirname(file),specifier)
      if (/\.[cm]?[jt]sx?$/.test(target)) visit(target)
    }
  }
  visit(path.join(root,'scripts/lib/world-weather-release-policy-reader.mjs'))
  assert.ok(seen.size>1)
  const decision=parse(fs.readFileSync(path.join(root,'scripts/lib/ai-painter-autonomous-package-decision-core-v3.mjs'),'utf8'),{sourceType:'module'})
  const imports=decision.program.body.filter(n=>n.type==='ImportDeclaration').map(n=>n.source.value)
  assert.ok(imports.includes('./world-weather-release-policy-reader.mjs'))
  assert.equal(imports.includes('./world-weather-release-policy.mjs'),false)
})

test('tampered policies and unknown candidates fail before lifecycle creation', async t => {
  const temp = fs.mkdtempSync(path.join(fs.realpathSync(os.tmpdir()),'weather-read-boundary-'))
  t.after(() => {
    assert.equal(path.dirname(fs.realpathSync(temp)),fs.realpathSync(os.tmpdir()))
    fs.rmSync(temp,{recursive:true,force:true})
  })
  fs.mkdirSync(path.join(temp,'.runtime'))
  const target=path.join(temp,reader.WEATHER_POLICY_PATH)
  fs.mkdirSync(path.dirname(target),{recursive:true})
  fs.writeFileSync(target,'{"productionAdmitted":true}')
  for (const implementation of [reader,compatibility]) {
    assert.throws(()=>implementation.inspectWeatherReleasePolicy(temp),/policy_file_sha/)
    assert.throws(()=>implementation.requireWeatherProductionAdmission(temp),/policy_file_sha/)
  }
  await assert.rejects(compatibility.registerWeatherPolicyCandidate(temp,'forged-weather-version'),/unknown_weather_policy_version/)
  assert.deepEqual(fs.readdirSync(path.join(temp,'.runtime')),[])
})

// Inject faults only during the synchronous read of a private SQLite fixture.
// Always close the real connection before simulating a close failure.
for (const scenario of [
  {phase:'exec',closeFails:true},
  {phase:'prepare',closeFails:true},
  {phase:'get',closeFails:true},
  {phase:'state',closeFails:true},
  {phase:'none',closeFails:true},
  {phase:'get',closeFails:false},
  {phase:'none',closeFails:false},
  {phase:'undefined',closeFails:true},
  {phase:'undefined',closeFails:false},
]) test(`weather lifecycle diagnostic preserves ${scenario.phase} and close=${scenario.closeFails}`, t => {
  const fixture=lifecycleFixture(t), before=baselineSha256(fs.readFileSync(fixture.database))
  const primary=scenario.phase==='undefined'?undefined:new Error('private '+scenario.phase+' read failure')
  const cleanup=new Error('private lifecycle close failure'), prototype=DatabaseSync.prototype
  const original={exec:prototype.exec,prepare:prototype.prepare,close:prototype.close}
  let closeCalls=0, thrown=false, failure, result
  prototype.exec=function(...args){
    if(scenario.phase==='exec'||scenario.phase==='undefined')throw primary
    return original.exec.apply(this,args)
  }
  prototype.prepare=function(...args){
    if(scenario.phase==='prepare')throw primary
    const statement=original.prepare.apply(this,args)
    return {get(...values){
      const row=statement.get(...values)
      if(scenario.phase==='get')throw primary
      if(scenario.phase==='state')return {...row,sequence:row.sequence+1}
      return row
    }}
  }
  prototype.close=function(){
    closeCalls++
    original.close.call(this)
    if(scenario.closeFails)throw cleanup
  }
  try {result=fixture.read()} catch(error){thrown=true;failure=error}
  finally {Object.assign(prototype,original)}
  assert.equal(closeCalls,1)
  assert.equal(baselineSha256(fs.readFileSync(fixture.database)),before)
  const readFailed=scenario.phase!=='none'
  assert.equal(thrown,readFailed||scenario.closeFails)
  if(readFailed&&scenario.closeFails){
    assert(failure instanceof AggregateError,'both errors must be retained')
    assert.equal(failure.errors.length,2)
    if(scenario.phase==='state')assert.match(failure.errors[0].message,/lifecycle_state_conflict/)
    else assert.equal(failure.errors[0],primary)
    assert.equal(failure.errors[1],cleanup)
    assert.equal(failure.cause,failure.errors[0])
  }else if(readFailed)assert.equal(failure,primary)
  else if(scenario.closeFails)assert.equal(failure,cleanup)
  else assert.deepEqual(result,{state:fixture.state.state,sequence:fixture.state.sequence})
})
