import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import { pathToFileURL } from 'node:url'
import { DatabaseSync } from 'node:sqlite'
import { BASELINE_IDENTITY, baselineSha256 } from './natural-world-baseline-proof.mjs'
import { createEvolutionInputReader, EVOLUTION_STORE } from './natural-world-evolution-input.mjs'
import { readCommittedHeadBundle } from './natural-world-current-head-baseline.mjs'
import { scheduledAuthority, checkScheduledLedger } from './natural-world-scheduled-head.mjs'
import { readScheduledWeatherHistory, WEATHER_NEXT_VERSION, WEATHER_EPOCH } from './world-weather-scheduled-history.mjs'
import { loadAndValidateReleasedCapabilityBinding, TRUSTED_RELEASE_REGISTRY_PATH } from './ai-painter-autonomous-package-decision-core-v3.mjs'
import { validateProjectCommandBackgroundReceipt } from './ai-painter-autonomous-background-launcher-v1.mjs'

const service = '.runtime/ai-painter/world-weather-service/' + BASELINE_IDENTITY.worldId
const database = service + '/accounting/accounting.sqlite'
const journal = EVOLUTION_STORE + '.transaction.json'
const parse = r => JSON.parse(r.bytes)
const binding = r => ({ path: r.path, sha256: r.sha256, bytes: r.bytes.length })

// This inspector only accepts a settled database. Immutable SQLite ignores WAL,
// so reject a nonempty WAL both before and after the read instead of hiding charges.
function frozenLedger(root, read) {
  const dbFile = read(database)
  const walSize = () => {
    try { return fs.lstatSync(path.resolve(root, database + '-wal')).size }
    catch (error) { if (error.code === 'ENOENT') return 0; throw error }
  }
  assert.equal(walSize(), 0, 'ledger WAL contains an uncheckpointed transaction')
  const uri = pathToFileURL(fs.realpathSync(path.resolve(root, database)))
  uri.search = '?mode=ro&immutable=1'
  const db = new DatabaseSync(uri.href, { readOnly: true })
  try {
    db.exec('PRAGMA query_only=ON; BEGIN')
    assert.equal(db.prepare('PRAGMA quick_check').get().quick_check, 'ok', 'damaged accounting database')
    const current = db.prepare('SELECT * FROM service WHERE id=1').get()
    const slots = db.prepare('SELECT * FROM slots ORDER BY target_tick LIMIT 28').all()
    const batches = db.prepare('SELECT * FROM batches ORDER BY seq LIMIT 15').all()
    assert.equal(walSize(), 0, 'ledger changed while reading')
    return { current, slots, batches, binding: binding(dbFile) }
  } finally { db.close() }
}

// Pure comparison of individually authenticated ledger and history artifacts.
// No caller-supplied facts enter the production inspector.
export function verifyDay30TransferBoundary({ history, cfg, ledger, loggedUsage, usage }) {
  assert.deepEqual(history.identity, BASELINE_IDENTITY, 'wrong history world')
  assert.deepEqual(cfg.identity, BASELINE_IDENTITY, 'wrong accounting world')
  assert.equal(history.originalCutoffUtc, WEATHER_EPOCH)
  assert.equal(cfg.originalCutoffUtc, WEATHER_EPOCH)
  assert.equal(cfg.version, WEATHER_NEXT_VERSION)
  assert.equal(history.maximumValidatedForecastDays, 30)
  assert.equal(cfg.validatedForecastDays, 30)
  const h = history.before
  assert.deepEqual([h.tick, h.stateVersion, h.eventCursor], [30, 31, 31], 'not the terminal day-30 head')
  assert.equal(ledger.current.tick, h.tick)
  assert.equal(ledger.current.file_sha, h.fileSha256)
  assert.equal(ledger.current.event_sha, history.head.eventSha256)
  assert.equal(ledger.current.business_key, history.head.businessKey)
  assert.equal(ledger.current.history_sha, history.historyValueSha256)
  assert.equal(usage.remaining, 0)
  assert.equal(usage.outstanding, null)
  assert.equal(loggedUsage.outstanding, null)
  assert.equal(loggedUsage.remainingOriginalValidatedDays, 0)
  assert.equal(loggedUsage.scope, ledger.current.scope)
  assert.deepEqual([loggedUsage.chargedModelStartSlots, loggedUsage.batchesIssued, loggedUsage.cumulativeIncludingPriorDays,
    loggedUsage.remainingModelStarts, loggedUsage.remainingBatchIssues, loggedUsage.remainingAuthorizedDays, loggedUsage.committedTick],
    [27, 14, 30, 0, 0, 0, 30], 'incomplete original lifetime')
  assert.equal(cfg.origin.tick, 3)
  assert.equal(usage.accounted, 27)
  assert.equal(usage.reserved, 27)
  assert.equal(usage.batches, 14)
  assert.equal(ledger.slots.length, 27)
  assert.equal(ledger.batches.length, 14)
  const trace = history.verifiedTrace.filter(x => x.tick > cfg.origin.tick)
  assert.equal(trace.length, ledger.slots.length, 'weather event count differs')
  const keys = new Set(), events = new Set(), tokens = new Set()
  for (const [index, slot] of ledger.slots.entries()) {
    const event = trace[index], day = 4 + index
    assert.equal(event.tick, day)
    assert.equal(slot.target_tick, day)
    assert.equal(slot.status, 'committed', 'pending/failed model charge')
    assert.equal(slot.commit_file, event.fileSha256)
    assert.equal(slot.commit_event, event.eventSha256)
    assert.equal(slot.input_sha, event.inputSha256)
    assert.equal(event.modelVersion, cfg.version)
    assert(!keys.has(event.businessKey) && !events.has(event.eventSha256) && !tokens.has(slot.token), 'duplicate event or model charge')
    keys.add(event.businessKey); events.add(event.eventSha256); tokens.add(slot.token)
  }
}

function registryPosition(root, reg, authority) {
  const rows = reg.releaseRecords
  assert(Array.isArray(rows) && rows.length <= 256, 'invalid registry size')
  const scoped = rows.filter(r => r.capabilityScope === 'world_evolution')
  const preceding = scoped.filter(r => r.capabilityReleaseIdentity === WEATHER_NEXT_VERSION)
  assert.equal(preceding.length, 1, 'v5 registry identity must be unique')
  const v5 = preceding[0]
  assert.equal(v5.status, 'released_trusted')
  assert.equal(v5.releaseSha256, authority.capability.sha256)
  const newer = scoped.filter(r => r.registryRevision > v5.registryRevision)
  assert(newer.length <= 8, 'successor inspection exceeds bounded release count')
  const inspected = newer.map(r => {
    const id = r.capabilityReleaseIdentity
    assert(typeof id === 'string' && /^[A-Za-z0-9_-]{1,128}$/.test(id))
    assert.equal(r.releasePath, 'data/ai-painter/capability-releases/' + id + '/release.json')
    try {
      const verified = loadAndValidateReleasedCapabilityBinding({ projectRoot: root, capabilityReleasePath: r.releasePath,
        trustedReleaseRegistryPath: TRUSTED_RELEASE_REGISTRY_PATH, requiredCapabilityScope: 'world_evolution' })
      assert.equal(verified.verificationStatus, 'verified_from_machine_adjudication_and_trusted_registry')
      assert.equal(verified.release.capabilityReleaseIdentity, id)
      assert.equal(verified.capabilityReleaseSha256, r.releaseSha256)
      // The current business contract defines no successor admission from registry membership alone.
      return { id, releaseSha256: r.releaseSha256, status: 'release_verified_no_day30_continuation_contract' }
    } catch {
      return { id, releaseSha256: r.releaseSha256, status: 'release_not_independently_verified' }
    }
  })
  return { verifiedPredecessor: v5.capabilityReleaseIdentity, predecessorRegistryRevision: v5.registryRevision,
    registryRevision: reg.registryRevision, worldEvolutionReleaseIdentities: scoped.map(r => r.capabilityReleaseIdentity),
    status: inspected.length ? 'no_qualified_continuation' : 'no_successor_release_registered',
    inspected, eligible: false }
}

export async function inspectWorldWeatherHandoff(...args) {
  assert.equal(args.length, 0, 'fixed production handoff inspection takes no arguments')
  const root = process.cwd(), sources = new Map()
  const reader = createEvolutionInputReader(root)
  const read = (logical, maxBytes = 1024 * 1024) => {
    const bytes = reader.read(logical, maxBytes), item = { path: logical, bytes, sha256: baselineSha256(bytes) }
    sources.set(logical, item.sha256)
    return item
  }
  function noJournal() {
    try { fs.lstatSync(path.resolve(root,journal)) }
    catch (error) { if (error.code === 'ENOENT') return; throw error }
    throw new Error('world transaction outstanding; handoff not settled')
  }
  noJournal()
  const live = read(EVOLUTION_STORE), registry = read(TRUSTED_RELEASE_REGISTRY_PATH)
  const history = await readScheduledWeatherHistory()
  assert.equal(history.before.fileSha256, live.sha256)
  assert.equal(history.before.tick, 30)
  const authority = scheduledAuthority(root, read)
  const { cfg } = authority
  const previous = history.verifiedTrace.find(e => e.tick === 29)
  assert(previous, 'missing previous day-29 weather record')
  const head = readCommittedHeadBundle(read, root, EVOLUTION_STORE, live, previous.fileSha256)
  assert.equal(head.eventSha, history.head.eventSha256)
  const marker = read(service + '/accounting/identity.json'), account = read(service + '/accounting/contract.json')
  const ledger = frozenLedger(root, read)
  const usage = checkScheduledLedger(authority, ledger, parse(account), parse(marker), head)
  const last = cfg.maximumActivations
  assert.equal(last, 14)
  const name = 'scheduled-weather-v5-production-' + last, launchDir = service + '/launches/' + name
  const terminal = read(launchDir+'/background-process-terminal.json'), completed = read(service+'/completed-'+last+'.json')
  const end = parse(completed), exit = parse(terminal), launch = parse(read(launchDir+'/launch-receipt.json'))
  validateProjectCommandBackgroundReceipt({ root, launchIdentity: name, runnerPath: cfg.entry.path, runnerArgs: ['--serve',String(last)], receiptRoot: service + '/launches', receipt: launch })
  assert.equal(end.status, 'cumulative_lifetime_exhausted')
  assert.deepEqual(end.after, history.before)
  assert.equal(end.parent.serverPid, launch.processId)
  assert.equal(exit.status, 'runner_process_exited')
  assert.equal(exit.commandIdentitySha256, launch.commandIdentitySha256)
  assert.equal(exit.processStartIdentity, launch.processStartIdentity)
  assert.equal(exit.runnerSha256, cfg.entry.sha256)
  assert.equal(exit.exitCode, 0)
  assert.equal(exit.processId, launch.processId)
  verifyDay30TransferBoundary({ history, cfg, ledger, loggedUsage:end.usage, usage })
  const successor = registryPosition(root, parse(registry), authority)
  // Reject a live revision change instead of mixing a previous Store with a newer release/ledger.
  noJournal()
  const fresh = createEvolutionInputReader(root)
  for (const [name, expected] of sources) assert.equal(baselineSha256(fresh.read(name,1024*1024)),expected,'handoff source changed: '+name)
  try { assert.equal(fs.statSync(path.resolve(root,database+'-wal')).size,0,'new ledger transaction') }
  catch (error) { if(error.code!=='ENOENT')throw error }
  return { schema:'natural-world-weather-handoff-inspection-v1', checkedAtUtc:new Date().toISOString(), identity:cfg.identity,
    originalCutoffUtc:cfg.originalCutoffUtc, current:{...history.before,...history.head,historyValueSha256:history.historyValueSha256},
    predecessor:{ status:'verified_exhausted', capability:authority.capability, budget:authority.budget, lifetime:ledger.current.scope,
      committedModelStarts:ledger.slots.length, committedRange:[4,30], priorDays:3, cumulativeDays:30,
      batchesIssued:ledger.batches.length, remainingModelStarts:0, outstanding:null, nativeExitCode:exit.exitCode },
    successor, hypotheticalWindow:{ firstDay:31,lastDay:37,maximumAdditionalDays:7,authorizedModelStarts:0 },
    evidence:{ store:binding(live),registry:binding(registry),ledger:ledger.binding,marker:binding(marker),accountingContract:binding(account),
      terminal:binding(terminal),completed:binding(completed),committedEventSha256:head.eventSha,receiptSha256:head.receiptSha } }
}
