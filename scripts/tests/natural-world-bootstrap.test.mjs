import test from "node:test"
import assert from "node:assert/strict"
import fs from "node:fs"
import fsp from "node:fs/promises"
import path from "node:path"
import { createHash, randomUUID } from "node:crypto"
import { createRequire, syncBuiltinESMExports } from "node:module"
import { fileURLToPath } from "node:url"
import { spawn } from "node:child_process"
import ts from "typescript"
import sharp from "sharp"

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..")
const evidence = path.resolve(process.env.NATURAL_WORLD_TEST_OUTPUT_ROOT ?? path.join(root, ".runtime/ai-painter/controller-repair-reviews/natural-world-facts-098-20261028/implementation/test-fixtures"))
const hash = bytes => createHash("sha256").update(bytes).digest("hex")
const json = value => JSON.stringify(value, null, 2) + "\n"
const self = fileURLToPath(import.meta.url), require = createRequire(import.meta.url)
const reads = [], writes = [], asyncReadReceipts = [], asyncWriteOperations = []
const originals = { read: fs.readFileSync, write: fs.writeFileSync, mkdir: fs.mkdirSync }
function inside(p) {
  const rel = path.relative(evidence, path.resolve(String(p)))
  assert(rel === "" || !rel.startsWith("..") && !path.isAbsolute(rel), "test write escaped private evidence: " + p)
}
fs.mkdirSync(evidence, { recursive: true })
fs.readFileSync = function(p, ...args) {
  if (typeof p === "string" || p instanceof URL) {
    const actual = p instanceof URL ? fileURLToPath(p) : path.resolve(p)
    if (actual.startsWith(root + path.sep) && /[\\/](data|\.runtime|src|scripts)[\\/]/.test(actual)) reads.push(actual)
  }
  return originals.read.call(this, p, ...args)
}
fs.writeFileSync = function(p, data, ...args) { inside(p); writes.push({ path: String(p), bytes: Buffer.byteLength(data) }); return originals.write.call(this, p, data, ...args) }
fs.mkdirSync = function(p, ...args) { if (!fs.existsSync(p)) inside(p); return originals.mkdir.call(this, p, ...args) }
for (const name of ["mkdir", "open", "rename", "rm"]) {
  const original = fsp[name]
  fsp[name] = async function(...args) {
    if (name !== "mkdir" || !fs.existsSync(args[0])) inside(args[0])
    if (name === "rename") inside(args[1])
    asyncWriteOperations.push({ operation: name, path: String(args[0]), target: name === "rename" ? String(args[1]) : null })
    const result = await original.apply(this, args)
    if (name === "open") {
      const write = result.writeFile.bind(result)
      result.writeFile = async (data, ...rest) => { writes.push({ path: String(args[0]), bytes: Buffer.byteLength(data), operation: "FileHandle.writeFile" }); return write(data, ...rest) }
    }
    return result
  }
}
const readAsync = fsp.readFile
fsp.readFile = async function(p, ...rest) {
  reads.push(path.resolve(String(p)))
  const data = await readAsync.call(this, p, ...rest), bytes = Buffer.isBuffer(data) ? data : Buffer.from(data)
  asyncReadReceipts.push({ path: path.resolve(String(p)), fileSha256: hash(bytes), bytes: bytes.length })
  return data
}
syncBuiltinESMExports()
const importWriteStart = writes.length
const moduleFiles = ["build-earth-geospatial-complete-map-conditions", "build-current-world-visual-fact-manifest", "build-current-world-visual-generation-task-package", "compile-current-world-visual-conditions"]
const modules = new Map()
for (const name of moduleFiles) modules.set(path.join(root, "scripts", name + ".mjs"), await import("../" + name + ".mjs"))
const governance = await import("../lib/real-earth-region-governance.mjs")
modules.set(path.join(root, "scripts/lib/real-earth-region-governance.mjs"), governance)
assert.equal(writes.length, importWriteStart, "import executed a historical writer")
const generator = modules.get(path.join(root, "scripts/build-earth-geospatial-complete-map-conditions.mjs"))
const compiler = modules.get(path.join(root, "scripts/compile-current-world-visual-conditions.mjs"))
const cache = new Map()
function loadTs(file) {
  file = path.resolve(file)
  if (cache.has(file)) return cache.get(file)
  const code = ts.transpileModule(fs.readFileSync(file, "utf8"), { fileName: file, reportDiagnostics: true,
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true } })
  assert.deepEqual(code.diagnostics.filter(d => d.category === ts.DiagnosticCategory.Error), [])
  const exports = {}; cache.set(file, exports)
  const get = id => {
    if (!id.startsWith(".")) { assert(id.startsWith("node:"), "unexpected runtime dependency " + id); return require(id) }
    const resolved = path.resolve(path.dirname(file), id)
    if (modules.has(resolved)) return modules.get(resolved)
    return loadTs(resolved.endsWith(".ts") ? resolved : resolved + ".ts")
  }
  new Function("require", "exports", code.outputText)(get, exports)
  return exports
}
const bootstrap = loadTs(path.join(root, "src/world/runtime/natural-world-bootstrap.ts"))
const facade = loadTs(path.join(root, "src/world/runtime/world-runtime-store-adapter.ts"))
const input = () => ({ schemaVersion: "natural-world-bootstrap-input-v1", ownerId: "natural-098-private-owner", playerId: "natural-098-private-user",
  worldId: "natural-098-" + randomUUID(), worldSeed: "fresh-real-measurement-world-098-seed-A", regionId: "natural-098-region-" + randomUUID(),
  worldProfileId: "mainland-southeast-asia-tropical-monsoon-natural-home-v1", createdAtUtc: new Date().toISOString() })
function privateDir(label) { return path.join(evidence, label + "-" + randomUUID()) }
function save(p, value) { fs.writeFileSync(p, json(value), { flag: "wx" }) }
function read(p) { return JSON.parse(fs.readFileSync(p, "utf8")) }
function binding(p) { return { path: path.relative(root, p).replace(/\\/g, "/"), sha256: hash(fs.readFileSync(p)) } }
function assertNoForbiddenReads(list) {
  const forbidden = list.filter(p => /(?:^|[\\/])(?:world-fact-blueprint|slot-world-facts|task-package|task-manifest|visual-fact-manifest|director-output|latest-world|latest-runtime-frame)\.json$/.test(p) ||
    p.includes("original-image-library") && /\.png$/i.test(p) || /earth-geospatial-v7.*[\\/]compiled-conditions[\\/]/.test(p) || /provisional-visual-snapshot|[\\/]design[\\/]/.test(p))
  assert.deepEqual(forbidden, [], "historical geometry/RGB/frame/latest/provisional input read")
}
if (process.argv[2] === "--natural-bootstrap-child") {
  const [action, requestPath, replyPath] = process.argv.slice(3), request = read(requestPath)
  const start = reads.length
  try {
    const result = action === "create" ? await bootstrap.createInitialNaturalWorld(request.input, { outputRoot: request.outputRoot })
      : await facade.readNaturalWorldRuntimeSaveRecord(request)
    const actualReads = reads.slice(start); assertNoForbiddenReads(actualReads)
    save(replyPath, { pid: process.pid, result, actualReads, writes, asyncReadReceipts, asyncWriteOperations, originalStoreCode: true })
  } catch (error) {
    save(replyPath, { pid: process.pid, error: error.message, stack: error.stack, actualReads: reads.slice(start), writes, asyncReadReceipts, asyncWriteOperations })
    process.exitCode = 1
  }
} else {
  const child = async (action, request, storeRoot) => {
    const id = randomUUID(), requestPath = path.join(evidence, id + "-request.json"), replyPath = path.join(evidence, id + "-reply.json")
    save(requestPath, request)
    const processChild = spawn(process.execPath, [self, "--natural-bootstrap-child", action, requestPath, replyPath], {
      cwd: root, windowsHide: true, env: { ...process.env, NODE_ENV: "production", AI_PET_WORLD_RUNTIME_STORE_ROOT: storeRoot,
        NATURAL_WORLD_TEST_OUTPUT_ROOT: evidence, UV_THREADPOOL_SIZE: "2", OMP_NUM_THREADS: "2" }, stdio: ["ignore", "pipe", "pipe"] })
    let stdout = "", stderr = ""
    processChild.stdout.on("data", b => stdout += b); processChild.stderr.on("data", b => stderr += b)
    const code = await new Promise((resolve, reject) => {
      const timeout = setTimeout(() => { processChild.kill(); reject(new Error("bounded bootstrap child timeout")) }, 120000)
      processChild.on("error", reject); processChild.on("close", c => { clearTimeout(timeout); resolve(c) })
    })
    save(replyPath + ".streams.json", { code, stdout, stderr })
    assert.equal(code, 0, fs.existsSync(replyPath) ? json(read(replyPath)) : stderr)
    return { ...read(replyPath), proofPath: replyPath }
  }
  let creation = null
  test("import-safe existing builders and compiler do not run their legacy CLI", () => {
    assert.equal(importWriteStart, writes.length)
    assert.equal(typeof compiler.compileCurrentWorldVisualConditions, "function")
    assert.equal(typeof generator.buildEarthGeospatialCompleteMapConditions, "function")
  })
  test("real measured source A generates facts/tasks/original23/store; exited process A is restored by process B", async () => {
    const identity = input(), outputRoot = privateDir("actual-world-A"), storeRoot = path.join(outputRoot, "runtime-store")
    const a = await child("create", { input: identity, outputRoot }, storeRoot)
    const result = a.result; assert.equal(result.status, "unpublished_natural_world_candidate_saved")
    const b = await child("read", { ownerId: identity.ownerId, worldId: identity.worldId, expectedPlayerId: identity.playerId,
      expectedTick: 0, expectedStateVersion: 0, expectedFileSha256: result.stored.fileSha256 }, storeRoot)
    assert.notEqual(a.pid, b.pid); assert.notEqual(a.pid, process.pid); assert.notEqual(b.pid, process.pid)
    assert.equal(b.result.status, "found"); assert.equal(b.result.fileSha256, result.stored.fileSha256)
    const generated = read(path.resolve(root, result.generatedFactsBinding.path)), record = b.result.record
    assert.equal(generated.sourcePackage.contractBinding.path, "data/ai-painter/system-governance/ai-painter-natural-world-bootstrap-contract-v2.json")
    assert.equal(generated.sourcePackage.contractBinding.sha256, "ec419bcd0adf167fdfed2004a44a6d6ae300e18829e547423708b12681887206")
    assert.deepEqual(record.worldFacts, generator.naturalWorldFactsEnvelope(generated)); assert.deepEqual(record.randomState, generated.randomState)
    assert.equal(record.worldFactsPayloadSha256, result.factHash)
    assert.deepEqual(record.worldState.payload.environment.weather, { status: "unknown", reason: "climatology_is_not_current_weather" })
    assert.equal(record.worldState.payload.environment.lighting.status, "unknown")
    assert.equal(record.worldState.payload.environment.seasonScenario.kind, "initial_simulation_scenario")
    assert.deepEqual(record.worldState.payload.objects, generated.geometry.objectFootprints)
    assert.deepEqual(record.worldState.payload.resources, []); assert.equal(record.eventCursor, 0)
    assert.equal(generated.sourcePackage.climateFacts.apiVersion, "v2.10.1")
    assert.match(generated.sourcePackage.climateFacts.period, /2001.*2025/)
    const nasa = read(path.resolve(root, "data/world-samples/earth-geospatial/regions/sakaerat-wang-nam-khiao-earth-geospatial-naturalization-v1/sources/nasa-power-climatology-acquisition-20261028-v1/response.json"))
    for (const k of ["PRECTOTCORR", "RH2M", "T2M", "WS2M"]) assert.deepEqual(generated.sourcePackage.climateFacts.parameters[k].values, nasa.properties.parameter[k])
    assertNoForbiddenReads(a.actualReads); assertNoForbiddenReads(b.actualReads)
    assert.equal(fs.existsSync(path.join(storeRoot, "latest-world.json")), false)
    const pack = read(path.resolve(root, result.conditionPackPath)), contract = read(path.join(root, "data/ai-painter/system-governance/ai-painter-complete-map-condition-contract-v1.json"))
    assert.equal(pack.scope, "natural_world_runtime_v1"); assert.equal(pack.newWorldIsDatasetSample, false)
    assert.equal(pack.datasetBindingPurpose, "model_training_knowledge_only"); assert.equal(pack.factHash, result.factHash)
    assert.equal(pack.channels.length, 23); assert.deepEqual(pack.channels.map(c => c.id), contract.tensorContract.channelOrder)
    const channelProof = []
    for (const c of pack.channels) {
      const p = path.resolve(root, c.path), bytes = fs.readFileSync(p), metadata = await sharp(bytes).metadata()
      assert.equal(hash(bytes), c.sha256); assert.equal(metadata.width, 1024); assert.equal(metadata.height, 768)
      assert.equal(c.dtype, "uint8"); assert.deepEqual(c.shape, [1, 768, 1024]); assert.deepEqual(c.valueRange, [0, 255])
      const raw = await sharp(bytes).greyscale().raw().toBuffer(); assert.equal(raw.length, 1024 * 768)
      channelProof.push({ ...binding(p), width: metadata.width, height: metadata.height, storedPngChannels: metadata.channels, tensorShape: c.shape })
    }
    creation = { identity, outputRoot, storeRoot, a, b, result, generated, pack, record }
    save(path.join(outputRoot, "independent-process-and-channel-proof.json"), { a: { pid: a.pid, proofPath: a.proofPath }, b: { pid: b.pid, proofPath: b.proofPath },
      fileSha256: b.result.fileSha256, factHash: result.factHash, sourcePackageIdentity: generated.sourcePackageIdentity, channelProof, noForbiddenHistoricalInputs: true })
  })
  test("same real measurement and seed reproduce; a fresh seed changes geometry; captured RNG continues exact sequence", async () => {
    assert(creation, "real bootstrap setup failed")
    const start = reads.length
    const same = await generator.buildEarthGeospatialCompleteMapConditions({ naturalWorldInput: creation.identity })
    assert.deepEqual(same, creation.generated)
    const changed = await generator.buildEarthGeospatialCompleteMapConditions({ naturalWorldInput: { ...creation.identity, worldSeed: "fresh-real-measurement-world-098-seed-B" } })
    assert.notEqual(governance.naturalWorldDigest(changed.geometry), governance.naturalWorldDigest(same.geometry))
    assert.equal(changed.sourcePackageIdentity, same.sourcePackageIdentity)
    assert(same.randomState.state.drawCount > 0)
    const rng = generator.createNaturalWorldRandom(same.initialRandomState.state.initialU32)
    for (let n = 0; n < same.randomState.state.drawCount; n++) rng.next()
    assert.deepEqual(rng.snapshot(), same.randomState)
    const restored = generator.createNaturalWorldRandom(same.randomState.state.initialU32, creation.record.randomState)
    const continuation = Array.from({ length: 32 }, () => rng.next()), restoredContinuation = Array.from({ length: 32 }, () => restored.next())
    assert.deepEqual(restoredContinuation, continuation)
    assert.throws(() => generator.createNaturalWorldRandom(same.randomState.state.initialU32, { ...same.randomState, state: { ...same.randomState.state, currentU32: 7 } }), /continuation state invalid/)
    assertNoForbiddenReads(reads.slice(start))
    save(path.join(creation.outputRoot, "seed-and-rng-proof.json"), { sameGeometrySha256: governance.naturalWorldDigest(same.geometry),
      differentGeometrySha256: governance.naturalWorldDigest(changed.geometry), sourcePackageIdentity: same.sourcePackageIdentity,
      actualInitial: same.initialRandomState, actualConsumedFinal: same.randomState, continuation, restoredContinuation, observedReads: reads.slice(start) })
    save(path.join(creation.outputRoot, "second-seed-generated-facts.json"), changed)
  })
  test("real source bytes tampered, binding missing, caller flags and missing identities fail closed", async () => {
    const d = privateDir("source-negative"); fs.mkdirSync(d)
    const source = path.join(root, "data/world-samples/earth-geospatial/regions/sakaerat-wang-nam-khiao-earth-geospatial-naturalization-v1/sources/nasa-power-climatology-acquisition-20261028-v1/response.json")
    const bytes = fs.readFileSync(source), p = path.join(d, "tampered-nasa-response.json")
    const tampered = Buffer.from(bytes); tampered[tampered.length - 2] ^= 1; fs.writeFileSync(p, tampered)
    const receipt = []
    assert.throws(() => governance.readNaturalWorldBinding(root, { path: binding(p).path, sha256: hash(bytes) }, receipt), /SHA mismatch/)
    assert.equal(receipt.length, 1); assert.equal(receipt[0].fileSha256, hash(tampered))
    assert.throws(() => governance.readNaturalWorldBinding(root, { path: binding(p).path }, []), /binding missing/)
    for (const key of ["worldSeed", "ownerId", "playerId", "regionId"]) { const v = input(); delete v[key]; assert.throws(() => governance.qualifyNaturalWorldSources({ input: v }), /fields invalid/) }
    assert.throws(() => governance.qualifyNaturalWorldSources({ input: { ...input(), sourceQualified: true } }), /fields invalid/)
    const accessor = input(); Object.defineProperty(accessor, "worldSeed", { enumerable: true, get() { throw new Error("accessor must never run") } })
    assert.throws(() => governance.validateNaturalWorldCreationInput(accessor), /plain JSON data/)
    await assert.rejects(() => generator.buildEarthGeospatialCompleteMapConditions({ naturalWorldInput: { ...input(), worldProfileId: "foreign-profile" } }), /profile outside/)
    save(path.join(d, "source-rejection-proof.json"), { actualTamperedBinding: binding(p), expectedOriginalSha256: hash(bytes), receipt, originalSourceUnchanged: hash(fs.readFileSync(source)) === hash(bytes) })
  })
  test("source release with forged flags/identity and intact-looking hashes cannot qualify altered facts", async () => {
    assert(creation)
    const d = privateDir("release-negative"); fs.mkdirSync(d)
    const release = read(path.resolve(root, creation.result.sourceFactReleaseBinding.path)), facts = structuredClone(creation.generated)
    facts.identity.worldId = "natural-wrong-world"; facts.sourceQualified = true
    const p = path.join(d, "natural-forged-generated-facts.json"); save(p, facts)
    release.generatedFactsBinding = binding(p); release.sourceQualified = true
    const { sourceFactReleaseIdentity: _old, ...payload } = release
    assert(_old)
    release.sourceFactReleaseIdentity = "natural-source-facts-" + governance.naturalWorldDigest(payload)
    const q = path.join(d, "natural-forged-release.json"); save(q, release)
    await assert.rejects(() => generator.verifyNaturalWorldFactRelease({ binding: binding(q) }), /release replay mismatch/)
    save(path.join(d, "forged-release-rejected.json"), { binding: binding(q), forgedGeneratedBinding: binding(p), rejectedByActualSourceReplay: true })
  })
  for (const variant of ["missing_license", "missing_acquisition_time", "wrong_climate_period", "changed_climate_value"]) test("actual source release rejects " + variant + " despite recomputed caller hashes", async () => {
    assert(creation)
    const d = privateDir("source-fields-negative-" + variant); fs.mkdirSync(d)
    const release = read(path.resolve(root, creation.result.sourceFactReleaseBinding.path)), sourcePackage = structuredClone(creation.generated.sourcePackage)
    const nasa = sourcePackage.sources.find(s => s.role === "regional_climate_and_monsoon_context")
    if (variant === "missing_license") delete nasa.license
    if (variant === "missing_acquisition_time") delete nasa.acquiredAtUtc
    if (variant === "wrong_climate_period") sourcePackage.climateFacts.period = "2001-2020"
    if (variant === "changed_climate_value") sourcePackage.climateFacts.parameters.T2M.values.ANN += 1
    const p = path.join(d, "natural-forged-source-package.json"); save(p, sourcePackage); release.sourcePackageBinding = binding(p)
    release.sourceQualified = true; const { sourceFactReleaseIdentity, ...payload } = release; assert(sourceFactReleaseIdentity)
    release.sourceFactReleaseIdentity = "natural-source-facts-" + governance.naturalWorldDigest(payload)
    const q = path.join(d, "natural-forged-source-release.json"); save(q, release)
    await assert.rejects(() => generator.verifyNaturalWorldFactRelease({ binding: binding(q) }), /release replay mismatch/)
    save(path.join(d, "source-field-rejection-proof.json"), { variant, release: binding(q), sourcePackage: binding(p), rejected: true })
  })
  for (const variant of ["wrong_world", "unknown_scope", "unknown_scope_without_condition_scope", "scope_removed", "dataset_sample_claim", "altered_geometry"]) test("condition compiler rejects " + variant + " before outputs", async () => {
    assert(creation)
    const d = privateDir("task-negative-" + variant); fs.mkdirSync(d)
    const m = read(path.resolve(root, creation.result.taskManifestBinding.path)), task = read(path.resolve(root, m.taskPath))
    if (variant === "wrong_world") { task.worldId = "natural-foreign-world"; m.worldId = task.worldId }
    if (variant === "unknown_scope") task.conditionScope = "unknown_runtime_scope"
    if (variant === "unknown_scope_without_condition_scope") { delete task.conditionScope; task.scope = "unknown_runtime_scope"; m.scope = task.scope }
    if (variant === "scope_removed") { delete task.conditionScope; delete task.scope; delete m.scope }
    if (variant === "dataset_sample_claim") task.newWorldIsDatasetSample = true
    if (variant === "altered_geometry") task.spatialLayers.terrainRegions[0].polygon[0].x += 1
    delete task.taskSha256; task.taskSha256 = hash(Buffer.from(JSON.stringify(task))); m.taskSha256 = task.taskSha256
    const p = path.join(d, "natural-task.json"); save(p, task); m.taskPath = binding(p).path
    const q = path.join(d, "natural-task-manifest.json"); save(q, m)
    await assert.rejects(() => compiler.compileCurrentWorldVisualConditions({ taskManifestPath: binding(q).path, quiet: true }), /identity mismatch|unsupported.*scope|natural source requires|cannot inherit|replay mismatch/)
    assert.equal(fs.existsSync(path.join(d, "compiled-conditions")), false)
    save(path.join(d, "task-rejected.json"), { variant, manifest: binding(q), task: binding(p), outputDirectoryCreated: false })
  })
  for (const variant of ["channel_bytes", "channel_missing", "channel_order", "channel_dtype", "channel_rgb_container", "unknown_pack_schema", "binding_hash", "unsupported_scope"]) test("typed natural condition reader rejects " + variant, async () => {
    assert(creation)
    const d = privateDir("channel-negative-" + variant); fs.mkdirSync(d)
    const target = path.join(d, "compiled-conditions"); fs.cpSync(path.dirname(path.resolve(root, creation.result.conditionPackPath)), target, { recursive: true, errorOnExist: true })
    const p = path.join(target, "condition-pack.json"), q = path.join(target, "manifest.json"), pack = read(p), manifest = read(q)
    for (const c of pack.channels) c.path = path.relative(root, path.join(target, "channels", path.basename(c.path))).replace(/\\/g, "/")
    pack.identityBindings.conditionPackagePath = binding(p).path
    if (variant === "channel_bytes") { const c = path.resolve(root, pack.channels[0].path), bytes = fs.readFileSync(c); bytes[bytes.length - 1] ^= 1; fs.writeFileSync(c, bytes) }
    if (variant === "channel_missing") pack.channels[0].path = pack.channels[0].path.replace(/\.png$/, "-missing.png")
    if (variant === "channel_order") [pack.channels[0], pack.channels[1]] = [pack.channels[1], pack.channels[0]]
    if (variant === "channel_dtype") pack.channels[0].dtype = "float32"
    if (variant === "channel_rgb_container") {
      const c = pack.channels[0], file = path.resolve(root, c.path)
      const bytes = await sharp(fs.readFileSync(file)).toColourspace("srgb").png().toBuffer()
      fs.writeFileSync(file, bytes); c.sha256 = hash(bytes)
    }
    if (variant === "unknown_pack_schema") pack.schemaVersion = "unknown-future-natural-pack"
    if (variant === "unsupported_scope") { pack.scope = "future_unknown_scope"; manifest.scope = pack.scope }
    const canonical = structuredClone(pack); delete canonical.conditionPackSha256; delete canonical.identityBindings.conditionPackageSha256
    pack.conditionPackSha256 = hash(Buffer.from(JSON.stringify(canonical))); pack.identityBindings.conditionPackageSha256 = pack.conditionPackSha256
    if (variant === "binding_hash") pack.identityBindings.conditionPackageSha256 = "f".repeat(64)
    manifest.conditionPackPath = pack.identityBindings.conditionPackagePath; manifest.conditionPackSha256 = pack.conditionPackSha256
    manifest.identityBindings = structuredClone(pack.identityBindings)
    fs.writeFileSync(p, json(pack)); fs.writeFileSync(q, json(manifest))
    await assert.rejects(() => compiler.verifyNaturalWorldConditionPackage({ manifestBinding: binding(q), expected: {
      worldId: creation.identity.worldId, regionId: creation.identity.regionId, tick: 0, factHash: creation.result.factHash,
        sourceFactReleaseIdentity: creation.pack.sourceFactReleaseIdentity } }), /hash mismatch|ENOENT|order mismatch|type mismatch|unsupported natural condition scope|schema mismatch|binding mismatch/)
    save(path.join(d, "typed-condition-rejected.json"), { variant, manifest: binding(q), conditionPackage: binding(p), rejected: true })
  })
  test("candidate execution cannot accidentally select the formal Store; production integration remains explicit", async () => {
    const d = privateDir("private-config-negative")
    await assert.rejects(() => bootstrap.createInitialNaturalWorld(input(), { outputRoot: d, mode: "private_candidate" }), /private configured Runtime Store/)
    assert.equal(fs.existsSync(d), false)
    assert.equal(creation.result.executionMode, "private_candidate")
    assert.throws(() => governance.readNaturalWorldBinding(root, {
      path: ".runtime/ai-painter/controller-repair-reviews/natural-world-facts-098-20261028/design/implementation-plan.json",
      sha256: "12dbbc8d3733c179f78d4a985f737ed757ad33d6e205552588479a768e746e9d" }), /design is not a runtime source/)
  })
  test("post-commit result-write failure reports the real saved outcome and retains every artifact", async () => {
    const d = privateDir("post-commit-failure"), identity = input(), oldNodeEnv = process.env.NODE_ENV, oldStore = process.env.AI_PET_WORLD_RUNTIME_STORE_ROOT
    const write = fs.writeFileSync; let injected = false
    process.env.NODE_ENV = "production"; process.env.AI_PET_WORLD_RUNTIME_STORE_ROOT = path.join(d, "runtime-store")
    fs.writeFileSync = function(p, ...rest) {
      if (String(p) === path.join(d, "bootstrap-result.json")) { injected = true; throw new Error("natural_test_post_commit_result_failure") }
      return write.call(this, p, ...rest)
    }
    try {
      await assert.rejects(() => bootstrap.createInitialNaturalWorld(identity, { outputRoot: d, mode: "private_candidate" }), /natural_test_post_commit_result_failure/)
      assert(injected)
      const failure = read(path.join(d, "bootstrap-failure.json")); assert.equal(failure.naturalSaveAlreadyCommitted, true); assert.equal(failure.storeOutcome.ok, true)
      const restored = await facade.readNaturalWorldRuntimeSaveRecord({ ownerId: identity.ownerId, worldId: identity.worldId, expectedFileSha256: failure.storeOutcome.fileSha256 })
      const releaseArtifact = failure.artifacts.find(a => a.role === "natural_source_fact_release")
      assert.equal(restored.status, "found"); assert.equal(restored.record.worldFactsPayloadSha256, read(path.resolve(root, releaseArtifact.path)).factHash)
      save(path.join(d, "post-commit-truth-proof.json"), { injected, failureBinding: binding(path.join(d, "bootstrap-failure.json")), storeOutcome: failure.storeOutcome,
        restoredStatus: restored.status, restoredFileSha256: restored.fileSha256, failureEvidenceRetained: true })
    } finally {
      fs.writeFileSync = write
      if (oldNodeEnv === undefined) delete process.env.NODE_ENV; else process.env.NODE_ENV = oldNodeEnv
      if (oldStore === undefined) delete process.env.AI_PET_WORLD_RUNTIME_STORE_ROOT; else process.env.AI_PET_WORLD_RUNTIME_STORE_ROOT = oldStore
    }
  })
  test("existing explicit compiler/no-latest and old branch guards remain present", async () => {
    await assert.rejects(() => compiler.compileCurrentWorldVisualConditions({ quiet: true }), /--task-manifest is required/)
    await assert.rejects(() => generator.buildEarthGeospatialCompleteMapConditions(), /measurement-backed --v7-slot-id is required/)
    assert.equal(fs.existsSync(path.join(root, "data/world-runtime", "natural-098-private-owner")), false)
    if (creation) assertNoForbiddenReads(reads.filter(p => !p.includes("provisional-visual-snapshot")))
    save(path.join(evidence, "parent-read-write-audit.json"), { reads, writes, importsRanLegacyWriters: false, fixtureCleanupPerformed: false })
  })
}
