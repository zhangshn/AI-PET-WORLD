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
for (const name of ["world-runtime-store", "world-runtime-production-store", "world-runtime-record-validation", "runtime-path-security"]) {
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
      const inject = fault === "record" && name === "rename" && args[1] === recordPath
        || fault === "latest" && name === "rename" && args[1] === latestPath
        || fault === "commit" && committedRename
        || fault === "cleanup" && name === "rm" && args[0] === transactionPath
      if (inject) {
        fired = true
        throw new Error(`fixture_fault:${fault}`)
      }
      return fsp[name](...args)
    }
  }
  function load(name) {
    if (cache.has(name)) return cache.get(name)
    const exports = {}
    cache.set(name, exports)
    const privateRequire = (id) => {
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
