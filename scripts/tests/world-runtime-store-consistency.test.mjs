import assert from "node:assert/strict"
import { createHash } from "node:crypto"
import fs from "node:fs"
import * as fsp from "node:fs/promises"
import os from "node:os"
import path from "node:path"
import { createRequire } from "node:module"
import { fileURLToPath } from "node:url"
import test from "node:test"
import ts from "typescript"

// Load the actual adapters with a private cwd and guarded filesystem calls.
// Path-security implementation is outside this task: its root-ancestor checks
// are replaced with a fixture-only boundary check, without changing production.
// No service, native owner, GPU, production root or process-wide cwd is used.
const require = createRequire(import.meta.url)
const sourceRoot = fileURLToPath(new URL("../../src/world/runtime/", import.meta.url))
const compiled = new Map()
for (const name of ["world-runtime-store", "world-runtime-production-store", "world-runtime-record-validation", "world-runtime-write-cleanup", "world-evolution-transaction", "runtime-path-security"]) {
  const result = ts.transpileModule(fs.readFileSync(path.join(sourceRoot, `${name}.ts`), "utf8"), {
    fileName: `${name}.ts`, reportDiagnostics: true,
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true },
  })
  assert.deepEqual(result.diagnostics.filter((item) => item.category === ts.DiagnosticCategory.Error), [])
  compiled.set(name, result.outputText)
}

function fixture(t, kind) {
  const fixtureParent = process.env.WORLD_RUNTIME_TEST_OUTPUT_ROOT ?? os.tmpdir()
  fs.mkdirSync(fixtureParent, { recursive: true })
  const privateRoot = fs.mkdtempSync(path.join(fixtureParent, "world-runtime-store-consistency-"))
  const root = path.join(privateRoot, "data", "world-runtime")
  const recordPath = path.join(root, "owner-fixture", "world-fixture.json")
  const latestPath = path.join(root, "latest-world.json")
  const transactionPath = `${recordPath}.transaction.json`
  const cache = new Map()
  let fault = null
  let fired = false
  let retained = false
  const io = []

  function assertPrivate(target) {
    const relative = path.relative(privateRoot, path.resolve(target))
    assert.ok(relative === "" || (!relative.startsWith("..") && !path.isAbsolute(relative)), `fixture escaped: ${target}`)
  }
  const guarded = {}
  for (const name of ["mkdir", "open", "readFile", "rename", "rm", "readdir", "lstat", "realpath", "stat"]) {
    guarded[name] = async (...args) => {
      assertPrivate(args[0])
      if (name === "rename") assertPrivate(args[1])
      io.push({ operation: name, path: args[0], target: name === "rename" ? args[1] : null })
      const committedRename = name === "rename" && args[1] === transactionPath && JSON.parse(fs.readFileSync(args[0], "utf8")).state === "committed"
      const inject = (fault === "record" || fault?.startsWith("record_and_lock_")) && name === "rename" && args[1] === recordPath
        || fault === "latest" && name === "rename" && args[1] === latestPath
        || fault === "commit" && committedRename
        || fault === "cleanup" && name === "rm" && args[0] === transactionPath
        || (fault === "lock_release" || fault === "record_and_lock_release") && name === "rm" && args[0] === `${recordPath}.lock`
      if (inject) {
        fired = true
        throw new Error(`fixture_fault:${fault}`)
      }
      const result = await fsp[name](...args)
      if (name === "open" && fault === "record_close" && args[0].startsWith(`${recordPath}.${process.pid}.`) && args[0].endsWith(".tmp")) {
        const originalClose = result.close.bind(result)
        result.close = async () => {
          await originalClose()
          fired = true
          throw new Error("fixture_fault:record_close")
        }
      }
      if (name === "open" && ["lock_close", "record_and_lock_close", "lock_release", "record_and_lock_release", "lock_foreign", "lock_corrupt"].includes(fault) && args[0] === `${recordPath}.lock`) {
        const originalClose = result.close.bind(result)
        result.close = async () => {
          io.push({operation:"close_lock", path:args[0], target:null})
          await originalClose()
          if (fault.endsWith("close")) { fired = true; throw new Error("fixture_lock_close_failed") }
          if (fault === "lock_foreign" || fault === "lock_corrupt") {
            fired = true
            fs.writeFileSync(args[0], fault === "lock_foreign" ? JSON.stringify({lockToken:"foreign-token"}) : "corrupted lock bytes")
          }
        }
      }
      return result
    }
  }
  function load(name) {
    if (cache.has(name)) return cache.get(name)
    const exports = {}
    cache.set(name, exports)
    const privateRequire = (id) => {
      if (id === "../../../scripts/lib/runtime-working-directory.mjs") return {
        runtimeWorkingDirectory: () => privateRoot, resolveRuntimePath: path.resolve,
      }
      if (id === "node:fs/promises") return guarded
      if (id === "node:fs") return { existsSync: (target) => { assertPrivate(target); return fs.existsSync(target) } }
      if (id === "./runtime-path-security") return {
        assertRuntimePath: async (target) => { assertPrivate(target); return path.resolve(target) },
        assertRuntimePathSegment: load("runtime-path-security").assertRuntimePathSegment,
      }
      if (id.startsWith("./")) return load(id.slice(2))
      assert.ok(["node:crypto", "node:os", "node:path"].includes(id), `unexpected runtime dependency: ${id}`)
      return require(id)
    }
    assert.ok(compiled.has(name), `unexpected local dependency: ${name}`)
    new Function("require", "exports", "process", compiled.get(name))(privateRequire, exports, { cwd: () => privateRoot, pid: process.pid })
    return exports
  }
  const store = kind === "development"
    ? load("world-runtime-store").localFileRuntimeStore
    : load("world-runtime-production-store").createProductionWorldRuntimeStore(root)
  const reload = () => {
    cache.clear()
    return kind === "development" ? load("world-runtime-store").localFileRuntimeStore
      : load("world-runtime-production-store").createProductionWorldRuntimeStore(root)
  }
  t.after(() => {
    assertPrivate(privateRoot)
    assert.ok(path.basename(privateRoot).startsWith("world-runtime-store-consistency-"))
    if (retained || process.env.WORLD_RUNTIME_TEST_RETAIN === "1") {
      t.diagnostic(`retained private recovery evidence: ${privateRoot}`)
      return
    }
    // Only this test's generated fixture bytes are removed.
    fs.rmSync(privateRoot, { recursive: true, force: true })
  })
  return {
    store, reload, recordPath, latestPath, transactionPath, io,
    retainFailure: (result, journal) => {
      retained = true
      fs.writeFileSync(path.join(privateRoot, "failure-result.json"), json(result), { flag: "wx" })
      fs.writeFileSync(path.join(privateRoot, "failed-transaction.snapshot.json"), journal, { flag: "wx" })
    },
    validator: load("world-runtime-record-validation").isWorldRuntimeSaveRecord,
    inject: (stage) => { fault = stage },
    faultFired: () => fired,
    seed: (value) => {
      fs.mkdirSync(path.dirname(recordPath), { recursive: true })
      fs.writeFileSync(recordPath, typeof value === "string" ? value : json(value), "utf8")
    },
  }
}

function json(value) { return `${JSON.stringify(value, null, 2)}\n` }
function record(tick = 0) {
  return {
    version: "v2.6-runtime-00", ownerId: "owner-fixture", worldId: "world-fixture",
    tick, savedAt: "2026-10-13T00:00:00.000Z",
    butlerProfile: {}, butlerRuntimeProfile: {}, butlerBirthInput: {},
    butlerMappingMode: "self", butlerConstructionStyle: {}, worldCreationStyleSource: "fixture",
    homeMapState: {
      ownerId: "owner-fixture", worldId: "world-fixture", seed: "private-fixture",
      mapSize: { columns: 1, rows: 1, tileSize: 16 }, zones: [], placements: [],
      resources: { groundHealth: 0, naturalGrowth: 0, materialReadiness: 0, careReadiness: 0, spacePressure: 0, tags: [] },
      constructionPlans: [], mapDiffs: [], createdAt: 0, updatedAt: 1, tags: [],
    },
    recentEvents: [{ id: "fixture-event", tick, title: "fixture", body: "fixture", source: "runtime", createdAt: "2026-10-13T00:00:00.000Z", tags: [] }],
    tags: [],
  }
}

const invalidCases = [
  ["wrong version", (r) => { r.version = "invalid" }],
  ["negative tick", (r) => { r.tick = -1 }],
  ["fractional tick", (r) => { r.tick = 0.5 }],
  ["empty owner", (r) => { r.ownerId = "" }],
  ["empty world", (r) => { r.worldId = " " }],
  ["invalid timestamp", (r) => { r.savedAt = "invalid" }],
  ["missing butler profile", (r) => { delete r.butlerProfile }],
  ["missing runtime profile", (r) => { delete r.butlerRuntimeProfile }],
  ["missing birth input", (r) => { delete r.butlerBirthInput }],
  ["missing mapping mode", (r) => { delete r.butlerMappingMode }],
  ["missing construction style", (r) => { delete r.butlerConstructionStyle }],
  ["missing world style", (r) => { delete r.worldCreationStyleSource }],
  ["invalid map size", (r) => { r.homeMapState.mapSize = {} }],
  ["invalid resources", (r) => { r.homeMapState.resources = {} }],
  ["invalid zones", (r) => { r.homeMapState.zones = null }],
  ["invalid placements", (r) => { r.homeMapState.placements = null }],
  ["invalid construction plans", (r) => { r.homeMapState.constructionPlans = null }],
  ["invalid map diffs", (r) => { r.homeMapState.mapDiffs = null }],
  ["invalid seed", (r) => { r.homeMapState.seed = 4 }],
  ["time reversal", (r) => { r.homeMapState.updatedAt = -1 }],
  ["world identity mismatch", (r) => { r.homeMapState.worldId = "other-world" }],
  ["owner identity mismatch", (r) => { r.homeMapState.ownerId = "other-owner" }],
  ["invalid map tags", (r) => { r.homeMapState.tags = [1] }],
  ["invalid save tags", (r) => { r.tags = [1] }],
  ["missing events", (r) => { delete r.recentEvents }],
  ["empty event id", (r) => { r.recentEvents[0].id = "" }],
  ["invalid event source", (r) => { r.recentEvents[0].source = "invalid" }],
  ["negative event tick", (r) => { r.recentEvents[0].tick = -1 }],
  ["fractional event tick", (r) => { r.recentEvents[0].tick = 0.5 }],
  ["future event", (r) => { r.recentEvents[0].tick = 2 }],
  ["invalid event timestamp", (r) => { r.recentEvents[0].createdAt = "invalid" }],
  ["invalid event tags", (r) => { r.recentEvents[0].tags = [1] }],
]

for (const kind of ["development", "production"]) {
  for (const explicit of [false, true]) {
    const mode = explicit ? "explicit path" : "latest index"
    for (const expectedTick of [0, 7]) {
      test(`${kind}/${mode}: missing record rejects expectedTick=${expectedTick}`, async (t) => {
        const f = fixture(t, kind)
        const result = await f.store.write({ record: record(expectedTick + 1), expectedTick, ...(explicit ? { filePath: f.recordPath } : {}) })
        assert.equal(result.ok, false)
        assert.equal(result.code, "conflict")
        assert.ok(result.tags.includes("runtime_tick_cas_rejected"))
        assert.ok(result.warnings.includes("actual_tick:-1"))
        assert.equal(fs.existsSync(f.recordPath), false)
        assert.equal(fs.existsSync(f.latestPath), false)
        assert.equal(fs.existsSync(f.transactionPath), false)
      })
    }

    test(`${kind}/${mode}: -1 initializes a truly empty slot, matching tick updates, stale/-1 rejects`, async (t) => {
      const f = fixture(t, kind)
      const options = explicit ? { filePath: f.recordPath } : {}
      assert.equal((await f.store.write({ record: record(), expectedTick: -1, ...options })).ok, true)
      assert.deepEqual((await f.store.read(explicit ? options : undefined)).record, record())
      assert.equal((await f.store.write({ record: record(3), expectedTick: 0, ...options })).ok, true)
      const before = fs.readFileSync(f.recordPath, "utf8")
      const latestBefore = explicit ? null : fs.readFileSync(f.latestPath, "utf8")
      for (const expectedTick of [-1, 0, 2, 4]) {
        const result = await f.store.write({ record: record(4), expectedTick, ...options })
        assert.equal(result.ok, false)
        assert.equal(result.code, "conflict")
        assert.equal(fs.readFileSync(f.recordPath, "utf8"), before)
        if (!explicit) assert.equal(fs.readFileSync(f.latestPath, "utf8"), latestBefore)
      }
      assert.equal((await f.store.write({ record: record(4), expectedTick: 3, ...options })).ok, true)
      assert.equal((await f.store.read(explicit ? options : undefined)).record.tick, 4)
    })
  }

  test(`${kind}: optional expectedTick retains valid create/update behavior`, async (t) => {
    const f = fixture(t, kind)
    assert.equal((await f.store.write({ record: record() })).ok, true)
    assert.equal((await f.store.write({ record: record(1) })).ok, true)
    assert.deepEqual((await f.store.read()).record, record(1))
  })

  test(`${kind}: missing latest index is empty, malformed latest index is invalid`, async (t) => {
    const f = fixture(t, kind)
    assert.equal((await f.store.read()).status, "empty")
    fs.mkdirSync(path.dirname(f.latestPath), { recursive: true })
    for (const index of [{}, [], 7, null, { path: f.recordPath }]) {
      const bytes = json(index)
      fs.writeFileSync(f.latestPath, bytes)
      const result = await f.store.read()
      assert.equal(result.status, "invalid")
      assert.equal(result.record, null)
      assert.equal(fs.readFileSync(f.latestPath, "utf8"), bytes)
    }
  })

  test(`${kind}: latest identity or record hash mismatch is invalid without changing saved bytes`, async (t) => {
    const f = fixture(t, kind)
    assert.equal((await f.store.write({ record: record() })).ok, true)
    const savedBytes = fs.readFileSync(f.recordPath, "utf8")
    const index = JSON.parse(fs.readFileSync(f.latestPath, "utf8"))
    for (const changes of [{ recordSha256: "f".repeat(64) }, { ownerId: "different-owner" }, { tick: "0" }]) {
      const bytes = json({ ...index, ...changes })
      fs.writeFileSync(f.latestPath, bytes)
      assert.equal((await f.store.read()).status, "invalid")
      assert.equal(fs.readFileSync(f.latestPath, "utf8"), bytes)
      assert.equal(fs.readFileSync(f.recordPath, "utf8"), savedBytes)
    }
  })

  test(`${kind}: matching latest hash cannot authorize a record for a different owner or world`, async (t) => {
    const f = fixture(t, kind)
    assert.equal((await f.store.write({ record: record() })).ok, true)
    const index = JSON.parse(fs.readFileSync(f.latestPath, "utf8"))
    for (const fields of [{ ownerId: "other-owner" }, { worldId: "other-world" }, { ownerId: "other-owner", worldId: "other-world" }]) {
      const other = { ...record(), ...fields }
      other.homeMapState.ownerId = other.ownerId
      other.homeMapState.worldId = other.worldId
      assert.equal(f.validator(other), true)
      const bytes = json(other)
      fs.writeFileSync(f.recordPath, bytes)
      const latest = json({ ...index, recordSha256: createHash("sha256").update(bytes).digest("hex") })
      fs.writeFileSync(f.latestPath, latest)
      assert.equal((await f.store.read()).status, "invalid")
      assert.equal(fs.readFileSync(f.recordPath, "utf8"), bytes)
      assert.equal(fs.readFileSync(f.latestPath, "utf8"), latest)
    }
  })

  for (const [name, mutate] of invalidCases) {
    test(`${kind}: existing validation rejects ${name} on read and write`, async (t) => {
      const f = fixture(t, kind)
      const invalid = record()
      mutate(invalid)
      assert.equal(f.validator(invalid), false)
      // Invalid incoming records cannot create an empty save.
      const incoming = await f.store.write({ record: invalid, expectedTick: -1, filePath: f.recordPath })
      assert.equal(incoming.ok, false)
      assert.equal(fs.existsSync(f.recordPath), false)
      f.seed(invalid)
      const before = fs.readFileSync(f.recordPath, "utf8")
      assert.equal((await f.store.read({ filePath: f.recordPath })).status, "invalid")
      // A damaged existing save must never be converted to an empty slot,
      // even when compare-and-set is omitted or initialization is requested.
      for (const expectedTick of [-1, 0, undefined]) {
        const result = await f.store.write({ record: record(1), expectedTick })
        assert.equal(result.ok, false)
        assert.equal(result.code, "persistence_error")
        assert.equal(fs.readFileSync(f.recordPath, "utf8"), before)
        assert.equal(fs.existsSync(f.transactionPath), false)
        assert.equal(fs.existsSync(f.latestPath), false)
      }
    })
  }

  for (const raw of ["{broken-json", "null", "[]", "42"]) {
    test(`${kind}: corrupt JSON value ${raw} cannot be initialized or overwritten`, async (t) => {
      const f = fixture(t, kind)
      f.seed(raw)
      const resultRead = await f.store.read({ filePath: f.recordPath })
      assert.ok(["invalid", "failed"].includes(resultRead.status))
      for (const expectedTick of [-1, 0, undefined]) {
        const result = await f.store.write({ record: record(), expectedTick, filePath: f.recordPath })
        assert.equal(result.ok, false)
        assert.equal(fs.readFileSync(f.recordPath, "utf8"), raw)
        assert.equal(fs.existsSync(f.transactionPath), false)
      }
    })
  }

  test(`${kind}: existing optional fields and numeric shape semantics are unchanged`, async (t) => {
    const f = fixture(t, kind)
    const value = record()
    value.homeMapState.seed = ""
    value.homeMapState.mapSize = { columns: 0, rows: -1, tileSize: 0.5 }
    value.homeMapState.resources.tags = [7]
    value.recentEvents = []
    value.worldProfileId = "optional-profile"
    value.traceField = { fixture: "not recursively validated by the existing contract" }
    assert.equal(f.validator(value), true)
    assert.equal((await f.store.write({ record: value, expectedTick: -1 })).ok, true)
    assert.deepEqual((await f.store.read()).record, value)
  })

  for (const stage of ["record", "latest", "commit", "cleanup"]) {
    test(`${kind}: ${stage} failure reports actual replacement and preserves transaction`, async (t) => {
      const f = fixture(t, kind)
      const old = record()
      const next = record(1)
      assert.equal((await f.store.write({ record: old, expectedTick: -1 })).ok, true)
      const latestBefore = fs.readFileSync(f.latestPath, "utf8")
      f.inject(stage)
      const result = await f.store.write({ record: next, expectedTick: 0 })
      assert.equal(f.faultFired(), true)
      assert.equal(result.ok, false)
      assert.equal(result.code, "persistence_error")
      assert.ok(result.warnings.includes(`fixture_fault:${stage}`))
      const replaced = stage !== "record"
      assert.equal(result.tags.includes("old_save_preserved"), !replaced)
      assert.equal(result.tags.includes("runtime_save_record_replaced"), replaced)
      if (replaced) assert.match(result.message, /replaced; transaction finalization failed/)
      assert.deepEqual(JSON.parse(fs.readFileSync(f.recordPath, "utf8")), replaced ? next : old)
      assert.equal(fs.existsSync(f.transactionPath), true)
      const journalBefore = fs.readFileSync(f.transactionPath, "utf8")
      f.retainFailure(result, journalBefore)
      assert.equal(JSON.parse(journalBefore).state, stage === "cleanup" ? "committed" : "prepared")
      if (["record", "latest"].includes(stage)) assert.equal(fs.readFileSync(f.latestPath, "utf8"), latestBefore)
      else assert.equal(JSON.parse(fs.readFileSync(f.latestPath, "utf8")).tick, 1)
      if (stage !== "cleanup") {
        assert.equal((await f.store.read({ ownerId: old.ownerId, worldId: old.worldId })).status, "invalid")
        f.inject(null)
        const reopened = f.reload()
        for (const expectedTick of [-1, replaced ? 1 : 0, undefined]) {
          const retry = await reopened.write({ record: record(2), expectedTick })
          assert.equal(retry.ok, false)
          assert.ok(retry.warnings.includes("runtime_transaction_incomplete"))
          assert.equal(fs.readFileSync(f.transactionPath, "utf8"), journalBefore)
          assert.deepEqual(JSON.parse(fs.readFileSync(f.recordPath, "utf8")), replaced ? next : old)
        }
      } else {
        assert.equal((await f.store.read()).record.tick, 1)
        f.inject(null)
        const reopened = f.reload()
        const stale = await reopened.write({ record: record(2), expectedTick: 0 })
        assert.equal(stale.ok, false)
        assert.equal(stale.code, "conflict")
        assert.equal(fs.readFileSync(f.transactionPath, "utf8"), journalBefore)
        assert.equal((await reopened.write({ record: record(2), expectedTick: 1 })).ok, true)
        assert.equal(fs.existsSync(f.transactionPath), false)
        assert.equal(fs.existsSync(`${f.recordPath}.lock`), false)
        const savedBytes = fs.readFileSync(f.recordPath, "utf8")
        const index = JSON.parse(fs.readFileSync(f.latestPath, "utf8"))
        assert.equal(index.path, f.recordPath)
        assert.equal(index.worldId, next.worldId)
        assert.equal(index.ownerId, next.ownerId)
        assert.equal(index.tick, 2)
        assert.equal(index.recordSha256, createHash("sha256").update(savedBytes).digest("hex"))
        assert.deepEqual((await reopened.read()).record, record(2))
        assert.equal((await reopened.read({ filePath: f.recordPath, worldId: "other-world" })).status, "invalid")
      }
    })
  }

  test(`${kind}: invalid transaction journals reject reads and updates without overwriting evidence`, async (t) => {
    const f = fixture(t, kind)
    assert.equal((await f.store.write({ record: record() })).ok, true)
    const saved = fs.readFileSync(f.recordPath, "utf8")
    const latest = fs.readFileSync(f.latestPath, "utf8")
    const valid = { schemaVersion: "world-runtime-transaction-v1", state: "committed", recordPath: f.recordPath, tick: 0 }
    for (const value of [null, [], 7, "committed", {},
      { ...valid, state: "unknown" }, { ...valid, state: null },
      { ...valid, schemaVersion: "unknown" }, { ...valid, recordPath: path.join(path.dirname(f.recordPath), "other.json") },
      { ...valid, tick: -1 }, { ...valid, tick: "0" }, { ...valid, tick: 0.5 },
      { ...valid, recordKind: "natural_world" }]) {
      const journal = json(value)
      fs.writeFileSync(f.transactionPath, journal)
      const observed = await f.store.read({ filePath: f.recordPath })
      assert.notEqual(observed.status, "found", JSON.stringify(value))
      assert.notEqual(observed.status, "empty", JSON.stringify(value))
      assert.equal(observed.record, null)
      assert(observed.warnings.includes("runtime_transaction_journal_invalid"))
      const result = await f.store.write({ record: record(1), expectedTick: 0 })
      assert.equal(result.ok, false, JSON.stringify(value))
      assert(result.warnings.includes("runtime_transaction_journal_invalid"))
      assert.equal(fs.readFileSync(f.recordPath, "utf8"), saved)
      assert.equal(fs.readFileSync(f.latestPath, "utf8"), latest)
      assert.equal(fs.readFileSync(f.transactionPath, "utf8"), journal)
    }
    fs.writeFileSync(f.transactionPath, json(valid))
    assert.deepEqual((await f.store.read({ filePath: f.recordPath })).record, record())
    assert.equal((await f.store.write({ record: record(1), expectedTick: 0 })).ok, true)
  })

  test(`${kind}: invalid transaction with no record is not an empty slot`, async (t) => {
    const f = fixture(t, kind)
    fs.mkdirSync(path.dirname(f.transactionPath), { recursive: true })
    const journal = json({ state: "unrecognized" })
    fs.writeFileSync(f.transactionPath, journal)
    const result = await f.store.write({ record: record(), expectedTick: -1 })
    assert.equal(result.ok, false)
    assert(result.warnings.includes("runtime_transaction_journal_invalid"))
    assert.equal(fs.existsSync(f.recordPath), false)
    assert.equal(fs.existsSync(f.latestPath), false)
    assert.equal(fs.readFileSync(f.transactionPath, "utf8"), journal)
  })

  test(`${kind}: prepared transaction without a record is not a truly empty slot`, async (t) => {
    const f = fixture(t, kind)
    fs.mkdirSync(path.dirname(f.transactionPath), { recursive: true })
    const journal = json({ schemaVersion: "world-runtime-transaction-v1", state: "prepared", recordPath: f.recordPath, tick: 0 })
    fs.writeFileSync(f.transactionPath, journal, "utf8")
    const result = await f.store.write({ record: record(), expectedTick: -1 })
    assert.equal(result.ok, false)
    assert.ok(result.warnings.includes("runtime_transaction_incomplete"))
    assert.equal(fs.existsSync(f.recordPath), false)
    assert.equal(fs.readFileSync(f.transactionPath, "utf8"), journal)
  })
}

// Exercise the actual private writer bodies without reaching production files.
for (const [adapter, functionName] of [["world-runtime-store", "writeJsonAtomic"], ["world-runtime-production-store", "writeAtomic"]]) {
  const source = fs.readFileSync(path.join(sourceRoot, `${adapter}.ts`), "utf8")
  const ast = ts.createSourceFile(`${adapter}.ts`, source, ts.ScriptTarget.Latest, true)
  const declaration = ast.statements.find(node => ts.isFunctionDeclaration(node) && node.name?.text === functionName)
  assert.ok(declaration)
  const writerSource = ts.transpileModule(declaration.getText(ast), {
    compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS },
  }).outputText
  for (const failedStages of [[], ["mkdir"], ["open"], ["write"], ["sync"], ["close"], ["write", "close"], ["sync", "close"], ["rename"]]) {
    test(`${adapter}: atomic write reports ${failedStages.join("+") || "success"} without premature publication`, async () => {
      const calls = [], errors = new Map(failedStages.map(stage => [stage, new Error(`fixture:${stage}`)]))
      const invoke = (stage, args) => { calls.push({stage, args}); if (errors.has(stage)) throw errors.get(stage) }
      const handle = {
        writeFile: async (...args) => invoke("write", args),
        sync: async (...args) => invoke("sync", args),
        close: async (...args) => invoke("close", args),
      }
      const writer = new Function("mkdir", "open", "rename", "path", "process", "randomUUID", `${writerSource};return ${functionName}`)(
        async (...args) => invoke("mkdir", args),
        async (...args) => { invoke("open", args); return handle },
        async (...args) => invoke("rename", args), path, {pid: 123}, () => "fixture-uuid",
      )
      const target = path.join("private-fixture", "world.json"), value = {worldId:"fixture", tick:3}
      let failure
      try { await writer(target, value) } catch (error) { failure = error }
      if (failedStages.length === 0) assert.equal(failure, undefined)
      else if (failedStages.length === 1) assert.equal(failure, errors.get(failedStages[0]))
      else {
        assert.ok(failure instanceof AggregateError)
        assert.deepEqual(failure.errors, failedStages.map(stage => errors.get(stage)))
        assert.equal(failure.cause, errors.get(failedStages[0]))
      }
      const expected = ["mkdir"]
      if (!errors.has("mkdir")) expected.push("open")
      if (!errors.has("mkdir") && !errors.has("open")) {
        expected.push("write")
        if (!errors.has("write")) expected.push("sync")
        expected.push("close")
        if (!["write", "sync", "close"].some(stage => errors.has(stage))) expected.push("rename")
      }
      assert.deepEqual(calls.map(call => call.stage), expected)
      const write = calls.find(call => call.stage === "write")
      if (write) assert.deepEqual(write.args, [json(value), "utf8"])
      const opened = calls.find(call => call.stage === "open")
      if (opened) assert.deepEqual(opened.args, [`${target}.123.fixture-uuid.tmp`, "wx"])
      const renamed = calls.find(call => call.stage === "rename")
      if (renamed) assert.deepEqual(renamed.args, [`${target}.123.fixture-uuid.tmp`, target])
    })
  }
}

for (const kind of ["development", "production"]) {
  for (const initialized of [false, true]) {
    test(`${kind}: record close failure preserves ${initialized ? "existing save" : "empty slot"} and temporary evidence`, async t => {
      const f = fixture(t, kind)
      if (initialized) assert.equal((await f.store.write({record:record(), expectedTick:-1, filePath:f.recordPath})).ok, true)
      const before = initialized ? fs.readFileSync(f.recordPath) : null
      f.inject("record_close")
      const result = await f.store.write({record:record(initialized ? 1 : 0), expectedTick:initialized ? 0 : -1, filePath:f.recordPath})
      assert.equal(f.faultFired(), true)
      assert.equal(result.ok, false)
      assert.equal(result.code, "persistence_error")
      assert.match(JSON.stringify(result), /fixture_fault:record_close/)
      if (initialized) assert.deepEqual(fs.readFileSync(f.recordPath), before)
      else assert.equal(fs.existsSync(f.recordPath), false)
      const directory = path.dirname(f.recordPath), name = path.basename(f.recordPath)
      assert.equal(fs.readdirSync(directory).filter(entry => entry.startsWith(`${name}.`) && entry.endsWith(".tmp")).length, 1)
      assert.equal(fs.existsSync(f.transactionPath), true)
    })
  }
}

for (const functionName of ["atomic", "createLock"]) {
  const source = fs.readFileSync(path.join(sourceRoot, "world-evolution-transaction.ts"), "utf8")
  const ast = ts.createSourceFile("world-evolution-transaction.ts", source, ts.ScriptTarget.Latest, true)
  const selected = ast.statements.filter(node => ts.isFunctionDeclaration(node) && [functionName, "withClosedFile"].includes(node.name?.text))
  assert.ok(selected.some(node => node.name.text === functionName))
  const compiled = ts.transpileModule(selected.map(node => node.getText(ast)).join("\n"), {
    compilerOptions: {target:ts.ScriptTarget.ES2022, module:ts.ModuleKind.CommonJS},
  }).outputText
  for (const failedStages of [[], ["open"], ["write"], ["sync"], ["close"], ["write", "close"], ["sync", "close"]]) {
    test(`world transaction ${functionName}: ${failedStages.join("+") || "success"} preserves causes and closes once`, async () => {
      const calls = [], errors = new Map(failedStages.map(stage => [stage, new Error(`fixture:${stage}`)]))
      const step = stage => { calls.push(stage); if (errors.has(stage)) throw errors.get(stage) }
      const file = {writeFile:async () => step("write"), sync:async () => step("sync"), close:async () => step("close")}
      const run = new Function("guarded", "mkdir", "path", "randomUUID", "open", "rename", "release", "bytes", "JOURNAL_LIMIT", "hostname", "process", `${compiled};return ${functionName}`)(
        async()=>{}, async()=>{}, path, ()=>"fixture-token", async()=>{step("open");return file},
        async()=>step("rename"), async()=>step("release"), value=>Buffer.from(JSON.stringify(value)), 32768, ()=>"fixture-host", {pid:123},
      )
      let failure
      try { await run("fixture-root", "fixture-path", functionName === "atomic" ? Buffer.from("fixture-bytes") : {worldId:"fixture",ownerId:"fixture"}) }
      catch (error) { failure = error }
      if (!failedStages.length) assert.equal(failure, undefined)
      else if (failedStages.length === 1) assert.equal(failure, errors.get(failedStages[0]))
      else {
        assert.ok(failure instanceof AggregateError)
        assert.deepEqual(failure.errors, failedStages.map(stage=>errors.get(stage)))
        assert.equal(failure.cause, errors.get(failedStages[0]))
        for (const stage of failedStages) assert.ok(failure.message.includes(`fixture:${stage}`))
      }
      const expected = ["open"]
      if (!errors.has("open")) {
        expected.push("write")
        if (!errors.has("write")) expected.push("sync")
        expected.push("close")
        if (functionName === "createLock" && failedStages.length) expected.push("release")
        if (functionName === "atomic" && !failedStages.length) expected.push("rename")
      }
      assert.deepEqual(calls, expected)
    })
  }
}


for (const kind of ['exclusive', 'atomic']) for (const phase of ['success', 'open', 'write', 'sync', 'close', 'write+close', 'sync+close', 'null+close', 'frozen+close']) {
  test(`frame evidence ${kind} preserves ${phase} without publishing failed bytes`, async () => {
    const name = 'src/world/game-map-frame/game-map-runtime-frame-store.ts'
    const tree = ts.createSourceFile(name, fs.readFileSync(name, 'utf8'), ts.ScriptTarget.Latest, true)
    const functions = tree.statements.filter(node => ts.isFunctionDeclaration(node) && ['writeExclusive','writeAtomic'].includes(node.name?.text))
    assert.equal(functions.length, 2)
    const code = ts.transpileModule(functions.map(node => node.getText(tree)).join('\n'), {compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.CommonJS}}).outputText
    const primary = phase === 'null+close' ? null : Object.freeze(new Error(`frame primary ${phase}`)), secondary = new Error('frame close failure')
    const calls = [], writes = [], bytes = 'private frame bytes\n'
    const handle = {
      writeFile: async (...args) => { calls.push('write'); writes.push(args); if (['write','write+close','null+close','frozen+close'].includes(phase)) throw primary },
      sync: async () => { calls.push('sync'); if (['sync','sync+close'].includes(phase)) throw primary },
      close: async () => { calls.push('close'); if (phase === 'close') throw primary; if (phase.endsWith('+close')) throw secondary },
    }
    const invoke = new Function('open','rename','process','randomUUID','jsonBytes', `${code};return ${kind === 'exclusive' ? 'writeExclusive' : 'writeAtomic'};`)(
      async (file, flag) => { calls.push('open'); assert.equal(flag,'wx'); assert.equal(file,kind === 'atomic' ? 'private-frame.json.123.fixture.tmp' : 'private-frame.json'); if (phase === 'open') throw primary; return handle },
      async () => calls.push('rename'), {pid:123}, () => 'fixture', () => bytes,
    )
    if (phase === 'success') await invoke('private-frame.json', bytes)
    else await assert.rejects(invoke('private-frame.json', bytes), error => {
      if (phase.endsWith('+close')) { assert(error instanceof AggregateError); assert.deepEqual(error.errors,[primary,secondary]); assert.equal(error.cause,primary); assert(error.message.includes(secondary.message)); assert(error.message.includes(primary === null ? 'null' : primary.message)) }
      else assert.equal(error,primary)
      return true
    })
    assert.equal(calls.filter(v => v === 'close').length, phase === 'open' ? 0 : 1)
    assert.equal(calls.includes('rename'), kind === 'atomic' && phase === 'success')
    if (writes.length) assert.deepEqual(writes,[[bytes,'utf8']])
  })
}


for (const kind of ['development', 'production']) for (const initialized of [false, true])
for (const fault of ['lock_close','lock_release','record_and_lock_close','record_and_lock_release','lock_foreign','lock_corrupt']) {
  test(`runtime lock cleanup ${kind} ${fault}, initialized=${initialized} reports actual publication`, async t => {
    const f = fixture(t, kind)
    if (initialized) assert.equal((await f.store.write({record:record(), expectedTick:-1, filePath:f.recordPath})).ok,true)
    const original = initialized ? fs.readFileSync(f.recordPath) : null
    f.inject(fault)
    const value = record(initialized ? 1 : 0)
    const result = await f.store.write({record:value,expectedTick:initialized ? 0 : -1,filePath:f.recordPath})
    assert.equal(f.faultFired(),true)
    assert.equal(result.ok,false)
    assert.equal(result.code,'persistence_error')
    assert(result.tags.includes('runtime_write_lock_cleanup_failed'))
    assert(!result.tags.includes('ok'))
    assert(fs.existsSync(f.recordPath+'.lock'),'uncertain or failed lock cleanup remains for recovery')
    if (fault.startsWith('record_and_')) {
      if (initialized) assert.deepEqual(fs.readFileSync(f.recordPath),original)
      else assert.equal(fs.existsSync(f.recordPath),false)
      assert(result.warnings.some(v=>v.includes(`fixture_fault:${fault}`)))
      assert(result.tags.includes('old_save_preserved'))
    } else {
      assert.deepEqual(JSON.parse(fs.readFileSync(f.recordPath,'utf8')),value)
      assert(result.tags.includes('runtime_save_record_replaced'))
      assert(result.message.includes('replaced'))
    }
    if (fault === 'lock_foreign') {
      assert(result.warnings.some(v=>v.includes('runtime_write_lock_identity_changed')))
      assert.equal(fs.readFileSync(f.recordPath+'.lock','utf8'),JSON.stringify({lockToken:'foreign-token'}))
    } else if (fault === 'lock_corrupt') assert.equal(fs.readFileSync(f.recordPath+'.lock','utf8'),'corrupted lock bytes')
    else assert(result.warnings.some(v=>v.includes(fault.endsWith('close')?'fixture_lock_close_failed':`fixture_fault:${fault}`)))
    const again = await f.store.write({record:value,expectedTick:value.tick,filePath:f.recordPath})
    assert.equal(again.ok,false);assert.equal(again.code,'conflict')
  })
}
