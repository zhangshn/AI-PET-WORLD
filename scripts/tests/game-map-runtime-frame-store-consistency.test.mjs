import assert from "node:assert/strict"
import fs from "node:fs"
import * as fsp from "node:fs/promises"
import os from "node:os"
import path from "node:path"
import { createRequire } from "node:module"
import { fileURLToPath } from "node:url"
import test from "node:test"
import ts from "typescript"

// CPU-only: actual store and schema, closed import table, private cwd and I/O.
// No child process, native owner, service, GPU or production runtime access.
// Each fixture retains its bytes for controller inspection, including failures.
const require = createRequire(import.meta.url)
const sources = new Map()
for (const relative of [
  "game-map-frame/game-map-runtime-frame-store",
  "game-map-frame/game-map-runtime-frame-schema",
  "game-map-frame/game-map-composite-schema",
  "runtime/runtime-path-security",
]) {
  const file = fileURLToPath(new URL(`../../src/world/${relative}.ts`, import.meta.url))
  const result = ts.transpileModule(fs.readFileSync(file, "utf8"), {
    fileName: file, reportDiagnostics: true,
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true },
  })
  assert.deepEqual(result.diagnostics.filter((d) => d.category === ts.DiagnosticCategory.Error), [])
  sources.set(relative, result.outputText)
}

const timestamp = "2026-10-13T00:00:00.000Z"
function json(value) { return `${JSON.stringify(value, null, 2)}\n` }
function frame(worldId = "world-a", tick = 7, ready = true) {
  const sourceFactIds = [`fact-${worldId}`]
  const bounds = { x: 0, y: 0, width: 1, height: 1 }
  const image = { imageUrl: "/private-fixture.png", imageSha256: "a".repeat(64), imageWidth: 1024, imageHeight: 768, imageFormat: "png" }
  return {
    schemaVersion: "game-map-runtime-frame-v1", runtimeFrameId: `frame-${worldId}-${tick}`,
    gameMapFrameId: "map-fixture", structureId: "structure-fixture", worldId, ownerId: "owner-fixture", tick, sourceFactIds,
    layers: { terrain: [], objects: [], walkable: [], collision: [], interactions: [] },
    runtimeState: { phase: "natural_home_static_mvp", stateRefs: [] },
    composition: {
      schemaVersion: "game-map-composite-manifest-v1", manifestId: "manifest-fixture",
      gameMapFrameId: "map-fixture", structureId: "structure-fixture", worldId, ownerId: "owner-fixture", tick, sourceFactIds,
      tileChunks: [{ chunkId: "chunk-fixture", layer: "terrain", kind: "terrain_region", sourceId: "terrain-fixture", sourceFactIds, bounds, zIndex: 0, canRepeat: false, requiresAiPainterMaterial: true }],
      visualUnitSlots: [{ slotId: "slot-fixture", unitKind: "grass_texture", sourceId: "terrain-fixture", sourceFactIds, bounds,
        maskGeometry: { kind: "rect", rect: bounds }, zIndex: 0,
        painterContract: { inputKind: "condition_mask_region", mustPreserveFacts: [], forbiddenPayloads: ["new_world_fact", "program_final_render"] } }],
      visualMaterialBindings: ready ? [{ bindingId: "binding-fixture", slotId: "slot-fixture", source: "ai_painter_region_texture", approvedAssetId: "approved-fixture", ...image, sourceFactIds, tags: [] }] : [],
      compositeOutput: ready ? { source: "runtime_compositor_from_ai_visual_units", ...image, sourceFactIds, tags: ["runtime_compositor_from_ai_visual_units"] } : null,
      compositionStatus: { mode: "chunked_runtime_map", canEnterWorld: ready, blockedReasons: ready ? [] : ["composite_output_missing"] },
      tags: ["p7_7_composite_map_manifest", "not_program_final_render", ...(ready ? ["composite_game_map_runtime_frame"] : [])],
    },
    visual: { source: "structured_fallback_skin", approvedFrameId: null, candidateId: null, imageUrl: null,
      imageSha256: null, imageWidth: 1024, imageHeight: 768, imageFormat: null },
    worldPageContract: { page: "/world", mode: "game_runtime", canShowInWorld: ready,
      forbiddenPayloads: ["training_image", "candidate_image", "partial_crop_image", "single_model_output_only"] },
    tags: ready ? ["composite_game_map_runtime_frame"] : [],
  }
}

function fixture(t) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "game-map-runtime-frame-consistency-"))
  assert.ok(!fs.lstatSync(root).isSymbolicLink())
  const outputRoot = path.join(root, "private-store")
  const io = []
  let hook = async () => undefined
  let bytes = 0
  const limit = 8 * 1024 * 1024
  function account(value) {
    bytes += Buffer.byteLength(typeof value === "string" ? value : json(value))
    assert.ok(bytes <= limit, "private fixture I/O exceeds 8MiB")
  }
  function inside(target) {
    assert.equal(typeof target, "string")
    const relative = path.relative(root, path.resolve(target))
    assert.ok(relative === "" || (!relative.startsWith("..") && !path.isAbsolute(relative)), `fixture escape: ${target}`)
    let current = root
    for (const segment of relative.split(path.sep).filter(Boolean)) {
      current = path.join(current, segment)
      if (fs.existsSync(current)) assert.ok(!fs.lstatSync(current).isSymbolicLink(), `fixture link: ${current}`)
    }
  }
  const guarded = {}
  for (const operation of ["mkdir", "open", "readFile", "rename", "rm", "lstat"]) {
    guarded[operation] = async (...args) => {
      inside(args[0])
      if (operation === "rename") inside(args[1])
      if (operation === "rm") {
        assert.ok(args[0].endsWith(".lock"), "store may remove only its own lease")
        assert.equal(args[1], undefined, "no force/recursive removal")
      }
      if (operation === "open") assert.equal(args[1], "wx", "all file creation must be exclusive")
      const event = { operation, path: args[0], target: operation === "rename" ? args[1] : null }
      io.push(event)
      assert.ok(io.length <= 512, "private fixture I/O call limit")
      await hook(event)
      const value = await fsp[operation](...args)
      if (operation === "readFile") account(value)
      if (operation !== "open") return value
      // Restrict every method exposed by the file handle as well as paths.
      return {
        writeFile: async (content, encoding) => {
          account(content)
          await hook({ operation: "handle.writeFile", path: args[0], content })
          return value.writeFile(content, encoding)
        },
        sync: async () => { await hook({ operation: "handle.sync", path: args[0] }); return value.sync() },
        stat: () => value.stat(), close: () => value.close(),
      }
    }
  }
  function loadStore() {
    const cache = new Map()
    function load(name) {
      if (cache.has(name)) return cache.get(name)
      assert.ok(sources.has(name), `unexpected fixture dependency: ${name}`)
      const exports = {}
      cache.set(name, exports)
      const imports = (id) => {
        if (id === "node:fs/promises") return guarded
        if (["node:crypto", "node:path"].includes(id)) return require(id)
        if (id === "../runtime/runtime-path-security") {
          return { assertRuntimePathSegment: load("runtime/runtime-path-security").assertRuntimePathSegment }
        }
        if (id.startsWith("./")) return load(`game-map-frame/${id.slice(2)}`)
        throw new Error(`unexpected fixture import: ${id}`)
      }
      new Function("require", "exports", "process", sources.get(name))(imports, exports, { cwd: () => root, pid: process.pid })
      return exports
    }
    return load("game-map-frame/game-map-runtime-frame-store")
  }
  const store = loadStore()
  const latest = (world = "world-a") => path.join(outputRoot, "worlds", world, "latest-runtime-frame.json")
  const journal = (world = "world-a") => `${latest(world)}.transaction.json`
  const lock = (world = "world-a") => `${latest(world)}.lock`
  const rootLatest = path.join(outputRoot, "latest-runtime-frame.json")
  function seed(target, value) {
    inside(target)
    fs.mkdirSync(path.dirname(target), { recursive: true })
    const content = typeof value === "string" ? value : json(value)
    account(content)
    fs.writeFileSync(target, content, { flag: "wx" })
  }
  function raw(target) { inside(target); const value = fs.readFileSync(target, "utf8"); account(value); return value }
  function overwrite(target, value) {
    inside(target)
    assert.ok(fs.existsSync(target), "mutation fixture must already exist")
    const content = typeof value === "string" ? value : json(value)
    account(content)
    fs.writeFileSync(target, content, "utf8")
  }
  t.after(() => t.diagnostic(`retained private fixture: ${root}; accounted I/O: ${bytes}/${limit} bytes`))
  return {
    root, outputRoot, io, latest, journal, lock, rootLatest, seed, raw, overwrite, loadStore,
    hook: (next) => { hook = next },
    write: (value = frame(), api = store) => api.writeGameMapRuntimeFrameRecord({ runtimeFrame: value, createdAt: timestamp, outputRoot }),
    read: (worldId = "world-a", extra = {}, api = store) => api.readLatestGameMapRuntimeFrameRecord({ worldId, outputRoot, ...extra }),
  }
}

function legacyJournal(worldId = "world-a", state = "prepared") {
  return { schemaVersion: "game-map-runtime-frame-transaction-v1", worldId, tick: 7, state }
}
function rejected(result, code) {
  assert.equal(result.status, "failed")
  assert.ok(result.warnings.some((warning) => warning.includes(code)), json(result))
}
function gate() {
  let release
  let entered
  return { wait: new Promise((done) => { release = done }), entered: new Promise((done) => { entered = done }), release: () => release(), enter: () => entered() }
}

test("world latest commits with immutable records and retained prepared/committed evidence", async (t) => {
  const f = fixture(t)
  const a = await f.write()
  assert.equal(a.status, "written")
  assert.equal((await f.read()).status, "found")
  const original = f.raw(a.recordPath)
  const b = await f.write(frame("world-a", 8))
  assert.equal(b.status, "written")
  assert.equal(f.raw(a.recordPath), original)
  assert.equal((await f.read()).record.tick, 8)
  const transactionDir = path.join(path.dirname(f.latest()), "transactions")
  assert.equal(fs.readdirSync(transactionDir).length, 4)
  assert.equal(JSON.parse(f.raw(f.journal())).state, "committed")
  assert.equal(fs.existsSync(f.lock()), false)
  assert.ok(f.io.filter((event) => event.operation === "open").every((event) => event.path.startsWith(f.root)))
})

test("stale tick refuses without changing old bytes; same tick/same timestamp republishes separately", async (t) => {
  const f = fixture(t)
  const first = await f.write(frame("world-a", 9))
  assert.equal(first.status, "written")
  const original = f.raw(first.recordPath)
  const latest = f.raw(f.latest())
  const journal = f.raw(f.journal())
  rejected(await f.write(frame("world-a", 8)), "stale_tick")
  assert.equal(f.raw(f.latest()), latest)
  assert.equal(f.raw(f.journal()), journal)
  assert.equal(fs.existsSync(f.lock()), false)
  const republished = await f.write(frame("world-a", 9))
  assert.equal(republished.status, "written")
  assert.notEqual(republished.recordPath, first.recordPath)
  assert.notEqual(republished.record.recordId, first.record.recordId)
  assert.equal(f.raw(first.recordPath), original)
  assert.equal((await f.read()).record.recordId, republished.record.recordId)
})

test("two isolated store instances contend on world A while world B commits", { timeout: 10000 }, async (t) => {
  const f = fixture(t)
  const paused = gate()
  f.hook(async (event) => {
    if (event.operation === "rename" && event.target === f.latest()) {
      paused.enter()
      await paused.wait
    }
  })
  const writer = f.write(frame("world-a", 10))
  try {
    await Promise.race([
      paused.entered,
      writer.then((result) => { throw new Error(`writer finished before barrier: ${json(result)}`) }),
    ])
    const intent = f.raw(f.journal())
    rejected(await f.write(frame("world-a", 11), f.loadStore()), "EEXIST")
    assert.equal(f.raw(f.journal()), intent)
    assert.equal((await f.read()).status, "invalid")
    assert.equal((await f.write(frame("world-b", 3), f.loadStore())).status, "written")
    assert.equal((await f.read("world-b")).record.tick, 3)
  } finally {
    paused.release()
  }
  assert.equal((await writer).status, "written")
  rejected(await f.write(frame("world-a", 9), f.loadStore()), "stale_tick")
  assert.equal((await f.read()).record.tick, 10)
})

for (const stage of ["prepared-evidence-write", "intent", "record", "record-sync", "latest", "commit-evidence", "commit", "release"]) {
  test(`failure at ${stage} keeps evidence and own lock; no replay; other world remains available`, async (t) => {
    const f = fixture(t)
    const previous = await f.write(frame("world-a", 6))
    assert.equal(previous.status, "written")
    const previousBytes = f.raw(previous.recordPath)
    let fired = false
    f.hook(async (event) => {
      const committed = event.operation === "rename" && event.target === f.journal()
        && JSON.parse(f.raw(event.path)).state === "committed"
      const recordFile = event.path.includes(`${path.sep}records${path.sep}world-a${path.sep}7${path.sep}`)
      const match = stage === "prepared-evidence-write" && event.operation === "handle.writeFile" && event.path.endsWith(".prepared.json")
        || stage === "intent" && event.operation === "rename" && event.target === f.journal() && !committed
        || stage === "record" && event.operation === "open" && recordFile
        || stage === "record-sync" && event.operation === "handle.sync" && recordFile
        || stage === "latest" && event.operation === "rename" && event.target === f.latest()
        || stage === "commit-evidence" && event.operation === "open" && event.path.endsWith(".committed.json")
        || stage === "commit" && committed
        || stage === "release" && event.operation === "rm" && event.path === f.lock()
      if (!fired && match) {
        fired = true
        if (stage === "prepared-evidence-write") f.overwrite(event.path, event.content.slice(0, 32))
        throw Object.assign(new Error(`private fault: ${stage}`), { code: "EACCES" })
      }
    })
    const failed = await f.write()
    rejected(failed, "EACCES")
    assert.equal(fired, true)
    assert.equal(f.raw(previous.recordPath), previousBytes)
    assert.equal(fs.existsSync(f.lock()), true)
    const journalBytes = f.raw(f.journal())
    const files = fs.readdirSync(path.join(path.dirname(f.latest()), "transactions"))
    assert.ok(files.filter((file) => file.endsWith(".prepared.json")).length >= 2)
    rejected(await f.write(frame("world-a", 8)), "EEXIST")
    assert.equal(f.raw(f.journal()), journalBytes)
    if (!["prepared-evidence-write", "intent", "release"].includes(stage)) {
      assert.equal((await f.read()).status, "invalid")
      assert.equal(JSON.parse(journalBytes).state, "prepared")
    }
    assert.equal((await f.write(frame("world-b", 2))).status, "written")
    assert.equal((await f.read("world-b")).status, "found")
    assert.ok(!f.io.some((event) => event.operation === "rm" && event.path.endsWith(".transaction.json")))
  })
}

test("root diagnostic rename failure is a warning after a complete world commit", async (t) => {
  const f = fixture(t)
  f.hook(async (event) => {
    if (event.operation === "rename" && event.target === f.rootLatest) throw Object.assign(new Error("private diagnostic fault"), { code: "EACCES" })
  })
  const result = await f.write()
  assert.equal(result.status, "written")
  assert.ok(result.warnings.some((warning) => warning.includes("diagnostic_write_failed:EACCES")))
  assert.equal((await f.read()).status, "found")
  assert.equal(fs.existsSync(f.lock()), false)
})

test("reopened store continues after committed publication and diagnostic failure, retaining original evidence", async (t) => {
  const f = fixture(t)
  f.hook(async (event) => {
    if (event.operation === "rename" && event.target === f.rootLatest) {
      throw Object.assign(new Error("private diagnostic interruption"), { code: "EACCES" })
    }
  })
  const committed = await f.write()
  assert.equal(committed.status, "written")
  assert.ok(committed.warnings.some((warning) => warning.includes("diagnostic_write_failed:EACCES")))
  assert.equal(fs.existsSync(f.lock()), false)
  f.seed(path.join(f.root, "diagnostic-failure-result.json"), committed)
  const originalRecord = f.raw(committed.recordPath)
  const originalJournal = f.raw(f.journal())
  const journal = JSON.parse(originalJournal)
  const transactionDir = path.join(path.dirname(f.latest()), "transactions")
  const preparedPath = path.join(transactionDir, `${journal.transactionId}.prepared.json`)
  const committedPath = path.join(transactionDir, `${journal.transactionId}.committed.json`)
  const preparedEvidence = f.raw(preparedPath)
  const committedEvidence = f.raw(committedPath)
  assert.equal(committedEvidence, originalJournal)
  assert.equal(f.raw(f.latest()), originalRecord)
  assert.equal(journal.worldId, "world-a")
  assert.equal(journal.tick, 7)

  f.hook(async () => undefined)
  const reopened = f.loadStore()
  assert.equal((await f.read("world-a", { currentTick: 7 }, reopened)).status, "found")
  assert.equal((await f.read("world-a", { currentTick: 8 }, reopened)).status, "invalid")
  rejected(await f.write(frame("world-a", 6), reopened), "stale_tick")
  assert.equal(f.raw(f.journal()), originalJournal)
  const next = await f.write(frame("world-a", 8), reopened)
  assert.equal(next.status, "written")
  assert.equal(fs.existsSync(f.lock()), false)
  assert.equal(f.raw(f.latest()), f.raw(next.recordPath))
  assert.equal(JSON.parse(f.raw(f.journal())).recordId, next.record.recordId)
  assert.equal((await f.read("world-a", { currentTick: 8 }, reopened)).record.recordId, next.record.recordId)
  assert.equal((await f.read("world-b", { filePath: f.latest() }, reopened)).status, "invalid")
  assert.equal(f.raw(committed.recordPath), originalRecord)
  assert.equal(f.raw(preparedPath), preparedEvidence)
  assert.equal(f.raw(committedPath), committedEvidence)
})

test("reopened store reads committed frame after lease-release failure but cannot reclaim the retained lock", async (t) => {
  const f = fixture(t)
  f.hook(async (event) => {
    if (event.operation === "rm" && event.path === f.lock()) {
      throw Object.assign(new Error("private lease-release interruption"), { code: "EACCES" })
    }
  })
  const failed = await f.write()
  rejected(failed, "EACCES")
  f.seed(path.join(f.root, "lease-release-failure-result.json"), failed)
  const journalBytes = f.raw(f.journal())
  assert.equal(JSON.parse(journalBytes).state, "committed")
  const lockBytes = f.raw(f.lock())
  const originalRecord = f.raw(failed.recordPath)
  f.hook(async () => undefined)
  const reopened = f.loadStore()
  assert.equal((await f.read("world-a", { currentTick: 7 }, reopened)).status, "found")
  assert.equal((await f.read("world-a", { currentTick: 8 }, reopened)).status, "invalid")
  rejected(await f.write(frame("world-a", 8), reopened), "EEXIST")
  assert.equal(f.raw(f.lock()), lockBytes)
  assert.equal(f.raw(f.journal()), journalBytes)
  assert.equal(f.raw(failed.recordPath), originalRecord)
  assert.equal(f.raw(f.latest()), originalRecord)
  // A valid committed journal is not authority to release a lease from a
  // different invocation. No production recovery operation is defined here.
  assert.equal((await f.write(frame("world-b", 2), reopened)).status, "written")
  assert.equal((await f.read("world-b", { currentTick: 2 }, reopened)).status, "found")
})

test("legacy root prepared affects its world only, even beside a committed scoped journal", async (t) => {
  const f = fixture(t)
  assert.equal((await f.write()).status, "written")
  const rootJournal = `${f.rootLatest}.transaction.json`
  f.seed(rootJournal, legacyJournal())
  const original = f.raw(rootJournal)
  assert.equal((await f.read()).status, "invalid")
  rejected(await f.write(frame("world-a", 8)), "transaction_incomplete")
  assert.equal((await f.write(frame("world-b", 8))).status, "written")
  assert.equal((await f.read("world-b")).status, "found")
  assert.equal(f.raw(rootJournal), original)
})

for (const value of ["{", null, {}, { state: "prepared" }, legacyJournal("../unknown"), { ...legacyJournal(), state: "unknown" }]) {
  test(`unknown legacy root identity refuses without replacing evidence: ${json(value).trim()}`, async (t) => {
    const f = fixture(t)
    const rootJournal = `${f.rootLatest}.transaction.json`
    f.seed(rootJournal, typeof value === "string" ? value : json(value))
    const original = f.raw(rootJournal)
    assert.equal((await f.write()).status, "failed")
    assert.ok(["failed", "invalid"].includes((await f.read()).status))
    assert.equal(f.raw(rootJournal), original)
    assert.equal(fs.existsSync(f.latest()), false)
    assert.equal(fs.existsSync(f.journal()), false)
  })
}

test("old scoped prepared and unknown lock are never overwritten or removed", async (t) => {
  const f = fixture(t)
  f.seed(f.journal(), legacyJournal())
  const original = f.raw(f.journal())
  rejected(await f.write(), "transaction_incomplete")
  assert.equal(f.raw(f.journal()), original)
  f.seed(f.lock(), "unknown lock bytes\n")
  rejected(await f.write(), "EEXIST")
  assert.equal(f.raw(f.lock()), "unknown lock bytes\n")
  assert.equal(f.raw(f.journal()), original)
  assert.equal((await f.write(frame("world-b", 7))).status, "written")
})

test("replaced lock bytes stay intact instead of being cleared by its former writer", async (t) => {
  const f = fixture(t)
  let replaced = false
  f.hook(async (event) => {
    if (!replaced && event.operation === "lstat" && event.path === f.lock()) {
      replaced = true
      f.overwrite(f.lock(), "replacement lock bytes\n")
    }
  })
  rejected(await f.write(), "lock_identity_conflict")
  assert.equal(replaced, true)
  assert.equal(f.raw(f.lock()), "replacement lock bytes\n")
  assert.ok(!f.io.some((event) => event.operation === "rm"))
})

test("legacy world indexes remain readable; wrapper mismatch and corrupt latest refuse writes", async (t) => {
  const f = fixture(t)
  const saved = await f.write()
  assert.equal(saved.status, "written")
  const legacy = fixture(t)
  legacy.seed(legacy.latest(), saved.record)
  assert.equal((await legacy.read()).status, "found")
  assert.equal((await legacy.write(frame("world-a", 8))).status, "written")
  for (const corrupt of ["{", { ...saved.record, tick: 999 }, { ...saved.record, worldId: "world-b" }]) {
    const invalid = fixture(t)
    invalid.seed(invalid.latest(), corrupt)
    const original = invalid.raw(invalid.latest())
    assert.equal((await invalid.write(frame("world-a", 8))).status, "failed")
    assert.equal(invalid.raw(invalid.latest()), original)
    assert.equal(fs.existsSync(invalid.journal()), false)
  }
})

test("current journal digest conflicts refuse reads and writes without overwriting", async (t) => {
  const f = fixture(t)
  const saved = await f.write()
  assert.equal(saved.status, "written")
  const corrupted = { ...saved.record, createdAt: "2026-10-13T01:00:00.000Z" }
  f.overwrite(f.latest(), corrupted)
  const original = f.raw(f.latest())
  rejected(await f.write(frame("world-a", 8)), "committed_record_conflict")
  assert.equal((await f.read()).status, "failed")
  assert.equal(f.raw(f.latest()), original)
})

test("publication changing after record read returns a conflict, not stale success", async (t) => {
  const f = fixture(t)
  assert.equal((await f.write()).status, "written")
  let reads = 0
  f.hook(async (event) => {
    if (event.operation === "readFile" && event.path === f.journal() && ++reads === 2) {
      const current = JSON.parse(f.raw(f.journal()))
      f.overwrite(f.journal(), { ...current, committedAtUtc: "changed-after-read" })
    }
  })
  const read = await f.read()
  assert.equal(read.status, "invalid")
  assert.ok(read.warnings.includes("game_map_runtime_frame_transaction_changed_during_read"))
})

test("root diagnostic bytes never select another world; unrelated root journal changes do not stale its read", async (t) => {
  const f = fixture(t)
  assert.equal((await f.write(frame("world-b", 2))).status, "written")
  assert.equal((await f.write(frame("world-a", 11))).status, "written")
  assert.equal(JSON.parse(f.raw(f.rootLatest)).worldId, "world-a")
  const rootJournal = `${f.rootLatest}.transaction.json`
  f.seed(rootJournal, legacyJournal("world-a"))
  let reads = 0
  f.hook(async (event) => {
    if (event.operation === "readFile" && event.path === rootJournal && ++reads === 2) {
      f.overwrite(rootJournal, { ...legacyJournal("world-a"), tick: 12 })
    }
  })
  const result = await f.read("world-b")
  assert.equal(result.status, "found")
  assert.equal(result.record.worldId, "world-b")
  assert.equal(result.record.tick, 2)
})

test("immutable record collision refuses and retains the preexisting bytes", async (t) => {
  const f = fixture(t)
  let collision = null
  f.hook(async (event) => {
    if (event.operation === "open" && event.path.includes(`${path.sep}records${path.sep}`)) {
      collision = event.path
      f.seed(collision, "preexisting immutable bytes\n")
    }
  })
  rejected(await f.write(), "EEXIST")
  assert.ok(collision)
  assert.equal(f.raw(collision), "preexisting immutable bytes\n")
  assert.equal(JSON.parse(f.raw(f.journal())).state, "prepared")
  assert.equal(fs.existsSync(f.lock()), true)
  assert.equal(fs.existsSync(f.latest()), false)
})

test("input changes while waiting for I/O cannot change this call's identity or record", async (t) => {
  const f = fixture(t)
  const input = frame()
  let changed = false
  f.hook(async (event) => {
    if (!changed && event.operation === "mkdir") {
      changed = true
      input.worldId = "world-b"
      input.tick = 999
      input.sourceFactIds.push("mutated-fact")
    }
  })
  const result = await f.write(input)
  assert.equal(result.status, "written")
  assert.equal(result.record.runtimeFrame.worldId, "world-a")
  assert.equal(result.record.runtimeFrame.tick, 7)
  assert.deepEqual(result.record.sourceFactIds, ["fact-world-a"])
  assert.equal((await f.read()).status, "found")
})

test("explicit file's prepared journal is respected with and without requested world identity", async (t) => {
  const f = fixture(t)
  const saved = await f.write()
  assert.equal(saved.status, "written")
  f.seed(`${saved.recordPath}.transaction.json`, legacyJournal())
  assert.equal((await f.read("world-a", { filePath: saved.recordPath })).status, "invalid")
  assert.equal((await f.read(undefined, { worldId: undefined, filePath: saved.recordPath })).status, "invalid")
})

test("scoped journal world mismatch and missing commit identity fail closed", async (t) => {
  for (const worldId of ["world-b", "world-a"]) {
    const f = fixture(t)
    f.seed(f.journal(), legacyJournal(worldId, "committed"))
    const original = f.raw(f.journal())
    assert.equal((await f.write()).status, "failed")
    assert.equal(f.raw(f.journal()), original)
    assert.equal(fs.existsSync(f.latest()), false)
  }
})

test("immutable record corruption is rejected even while latest and journal still match", async (t) => {
  const f = fixture(t)
  const saved = await f.write()
  assert.equal(saved.status, "written")
  f.overwrite(saved.recordPath, "corrupt original bytes\n")
  const original = f.raw(f.latest())
  rejected(await f.write(frame("world-a", 8)), "committed_record_conflict")
  assert.equal((await f.read()).status, "failed")
  assert.equal(f.raw(f.latest()), original)
  assert.equal(f.raw(saved.recordPath), "corrupt original bytes\n")
})

test("world A journal read denial does not turn empty or touch world B", async (t) => {
  const f = fixture(t)
  f.hook(async (event) => {
    if (event.operation === "readFile" && event.path === f.journal()) {
      throw Object.assign(new Error("private read denial"), { code: "EACCES" })
    }
  })
  assert.equal((await f.read()).status, "failed")
  rejected(await f.write(), "EACCES")
  assert.equal((await f.write(frame("world-b", 7))).status, "written")
  assert.equal((await f.read("world-b")).status, "found")
})

test("a committed journal without a current record is invalid rather than a fresh empty slot", async (t) => {
  const f = fixture(t)
  f.seed(f.journal(), legacyJournal("world-a", "committed"))
  const result = await f.read()
  assert.equal(result.status, "invalid")
  assert.ok(result.warnings.includes("game_map_runtime_frame_committed_record_missing"))
  rejected(await f.write(), "previous_record_missing")
  assert.equal(fs.existsSync(f.latest()), false)
})

test("input/output API, explicit file reads, identity checks and existing display gates remain", async (t) => {
  const f = fixture(t)
  const saved = await f.write()
  assert.equal(saved.status, "written")
  assert.deepEqual(Object.keys(saved).sort(), ["latestPath", "record", "recordPath", "status", "tags", "warnings"])
  assert.equal((await f.read("world-a", { ownerId: "other-owner" })).status, "invalid")
  assert.equal((await f.read("world-a", { currentTick: 8 })).status, "invalid")
  assert.equal((await f.read("world-a", { currentSourceFactIds: ["other-fact"] })).status, "invalid")
  assert.equal((await f.read("world-b")).status, "empty")
  assert.equal((await f.read("world-a", { filePath: saved.recordPath })).status, "found")
  assert.equal((await f.read(undefined, { worldId: undefined, filePath: saved.recordPath })).status, "found")
  const blocked = await f.write(frame("world-a", 8, false))
  assert.equal(blocked.status, "written")
  assert.equal((await f.read()).status, "invalid")
  assert.equal((await f.write(frame("world-a", 8))).status, "written")
  assert.equal((await f.read()).status, "found")
  const broken = frame()
  broken.schemaVersion = "invalid"
  assert.equal((await f.write(broken)).status, "blocked_invalid_runtime_frame")
})
