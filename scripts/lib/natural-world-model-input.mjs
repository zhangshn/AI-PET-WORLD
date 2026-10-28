/** Target-free natural input descriptor. No checkpoint, renderer or registry. */
import fs from "node:fs"
import path from "node:path"
import { createHash } from "node:crypto"
import { registerHooks } from "node:module"
import { pathToFileURL } from "node:url"
import { verifyNaturalWorldFactRelease } from "../build-earth-geospatial-complete-map-conditions.mjs"
import { buildInitialNaturalWorldVisualTask } from "../build-current-world-visual-generation-task-package.mjs"
import { verifyNaturalWorldConditionPackage } from "../compile-current-world-visual-conditions.mjs"
import { naturalWorldDigest } from "./real-earth-region-governance.mjs"

const HASH = /^[a-f0-9]{64}$/
const SCOPE = "natural_world_runtime_v1"
const ROLES = Object.freeze({ tree: "object_tree", rock: "object_rock", shrub: "object_vegetation", grass_detail: "object_vegetation" })
const PYTHON_DEPS = ["natural_world_input_v1.py", "native_stage_geometry_v1.py", "object_instance_supervision_cpu.py", "dataset.py",
  "object_ecology_regime_input_cpu.py", "object_appearance_regime_input_cpu.py"].map(n => "ml/ai-painter/src/ai_painter/complete_world/" + n)
function pythonImportClosure(root) {
  const prefix = "ml/ai-painter/src/", seen = new Set(), pending = [...PYTHON_DEPS]
  const addModule = name => {
    if (!name.startsWith("ai_painter")) return
    const stem = prefix + name.replaceAll(".", "/")
    const file = fs.existsSync(path.join(root, stem + ".py")) ? stem + ".py" : stem + "/__init__.py"
    if (fs.existsSync(path.join(root, file))) pending.push(file)
  }
  while (pending.length) {
    const file = pending.pop(); if (seen.has(file)) continue; seen.add(file)
    const parts = file.slice(prefix.length).split("/")
    for (let i = 1; i < parts.length; i++) {
      const init = prefix + parts.slice(0, i).join("/") + "/__init__.py"
      if (fs.existsSync(path.join(root, init))) pending.push(init)
    }
    const packageName = parts.slice(0, -1)
    const source = fs.readFileSync(path.join(root, file), "utf8")
    for (const match of source.matchAll(/^from\s+([.\w]+)\s+import\s/gm)) {
      const specifier = match[1], dots = /^\.+/.exec(specifier)?.[0].length ?? 0
      addModule(dots ? [...packageName.slice(0, packageName.length - dots + 1), ...specifier.slice(dots).split(".").filter(Boolean)].join(".") : specifier)
    }
  }
  return [...seen].sort()
}
let runtimePromise
const requireValue = (value, message) => { if (!value) throw new Error(message) }
const sha = bytes => createHash("sha256").update(bytes).digest("hex")
const json = bytes => JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(bytes))
function relativeFile(p) {
  requireValue(typeof p === "string" && !path.isAbsolute(p) && !p.includes("\\") && !p.includes(":"), "model input path must be explicit project-relative")
  requireValue(p.split("/").every(x => x && ![".", "..", "latest", "latest.json"].includes(x)), "model input latest/traversal forbidden")
  return p
}
function readBound(root, binding, receipts) {
  requireValue(binding && HASH.test(binding.sha256 ?? ""), "model input file hash missing")
  const p = path.resolve(root, relativeFile(binding.path))
  const real = fs.realpathSync(p), project = fs.realpathSync(root), runtime = fs.realpathSync(path.join(root, ".runtime"))
  const inside = base => { const r = path.relative(base, real); return r && !r.startsWith("..") && !path.isAbsolute(r) }
  requireValue(inside(project) || binding.path.startsWith(".runtime/") && inside(runtime), "model input physical path escape")
  const bytes = fs.readFileSync(p)
  receipts.push({ path: binding.path, sha256: sha(bytes), bytes: bytes.length })
  requireValue(sha(bytes) === binding.sha256, "model input file hash mismatch:" + binding.path)
  return bytes
}
async function originalRuntime(root) {
  if (!runtimePromise) runtimePromise = (async () => {
    const prefix = pathToFileURL(path.join(root, "src/world/runtime") + path.sep).href
    const hooks = registerHooks({ resolve(specifier, context, next) {
      return next(context.parentURL?.startsWith(prefix) && specifier.startsWith(".") && !path.extname(specifier)
        ? new URL(specifier + ".ts", context.parentURL).href : specifier, context)
    } })
    try {
      return { facade: await import(pathToFileURL(path.join(root, "src/world/runtime/world-runtime-store-adapter.ts")).href),
        validator: await import(pathToFileURL(path.join(root, "src/world/runtime/world-runtime-record-validation.ts")).href) }
    } finally { hooks.deregister() }
  })()
  return runtimePromise
}
export function validateNaturalObjectTable(table, footprints) {
  requireValue(Array.isArray(table) && table.length > 0 && table.length <= 254 && Array.isArray(footprints) && footprints.length === table.length, "natural instance table missing or ambiguous")
  const ids = new Set()
  for (let i = 0; i < table.length; i++) {
    const row = table[i], original = footprints[i], b = row.footprint
    requireValue(ROLES[row.kind] && row.value === 1 + i % 254 && typeof row.objectId === "string" && row.objectId.length > 0 &&
      typeof row.blocksMovement === "boolean" && !ids.has(row.objectId), "unsupported natural object role or instance identity")
    ids.add(row.objectId)
    requireValue(b && [b.x, b.y, b.width, b.height].every(Number.isSafeInteger) && b.width > 0 && b.height > 0 && b.x >= 0 && b.y >= 0 && b.x + b.width <= 1024 && b.y + b.height <= 768, "natural footprint outside native coordinates")
    requireValue(naturalWorldDigest(row) === naturalWorldDigest({ value: 1 + i % 254, objectId: original.objectId, kind: original.kind,
      footprint: original.footprint, blocksMovement: original.blocksMovement }), "natural instance table differs from existing compiler semantics")
  }
  return structuredClone(table)
}
export async function buildNaturalWorldModelInputDescriptor({ request, root = process.cwd() }) {
  requireValue(fs.realpathSync(root) === fs.realpathSync(process.cwd()), "model input project cwd mismatch")
  const fields = ["schemaVersion", "scope", "identity", "tick", "stateVersion", "factHash", "sourceFactRelease", "taskManifest", "taskPackage", "conditionManifest", "conditionPackage", "runtimeSave"]
  requireValue(request && Object.keys(request).length === fields.length && fields.every(k => Object.hasOwn(request, k)) && request.schemaVersion === "natural-world-model-input-request-v1" && request.scope === SCOPE, "unsupported natural model request scope or fields")
  const identityKeys = ["ownerId", "playerId", "worldId", "worldSeed", "worldProfileId", "regionId"]
  requireValue(request.identity && Object.keys(request.identity).length === 6 && identityKeys.every(k => typeof request.identity[k] === "string" && request.identity[k].trim()), "natural model identity missing")
  requireValue(Number.isSafeInteger(request.tick) && request.tick >= 0 && Number.isSafeInteger(request.stateVersion) && request.stateVersion >= 0 && HASH.test(request.factHash), "natural model state expectation missing")
  request = structuredClone(request)
  const receipts = [], { facade, validator } = await originalRuntime(root)
  const savedBytes = readBound(root, request.runtimeSave, receipts), decoded = validator.decodeNaturalWorldRuntimeRecord(savedBytes)
  const found = await facade.readNaturalWorldRuntimeSaveRecord({ ownerId: request.identity.ownerId, worldId: request.identity.worldId,
    expectedPlayerId: request.identity.playerId, expectedTick: request.tick, expectedStateVersion: request.stateVersion, expectedFileSha256: request.runtimeSave.sha256 })
  requireValue(found.status === "found" && path.resolve(found.path) === path.resolve(root, request.runtimeSave.path) && found.fileSha256 === request.runtimeSave.sha256 &&
    naturalWorldDigest(found.record) === naturalWorldDigest(decoded.record), "original natural Store read or state identity differs")
  const record = decoded.record
  requireValue(identityKeys.every(k => record[k] === request.identity[k]) && record.tick === request.tick && record.stateVersion === request.stateVersion && record.worldFactsPayloadSha256 === request.factHash, "natural saved world identity differs")
  const storedRoles = { sourceFactRelease: "natural_source_fact_release", taskManifest: "visual_task_manifest", taskPackage: "visual_generation_task", conditionManifest: "condition_manifest", conditionPackage: "condition_package" }
  for (const [key, role] of Object.entries(storedRoles)) {
    const entries = record.sourceBindings.filter(b => b.role === role)
    requireValue(entries.length === 1 && entries[0].uri === request[key].path && entries[0].fileSha256 === request[key].sha256, "saved immutable binding differs:" + key)
  }
  const verified = await verifyNaturalWorldFactRelease({ root, binding: request.sourceFactRelease })
  requireValue(naturalWorldDigest(verified.factsEnvelope) === request.factHash && naturalWorldDigest(record.worldFacts) === naturalWorldDigest(verified.factsEnvelope) &&
    naturalWorldDigest(record.randomState) === naturalWorldDigest(verified.proposal.randomState), "natural source replay and saved facts/state differ")
  requireValue(naturalWorldDigest(record.worldState.payload.environment) === naturalWorldDigest({ ...verified.proposal.environment,
    resourceInitialization: "no_resource_instances_created", runtimeEvents: "none_created" }) &&
    naturalWorldDigest(record.worldState.payload.objects) === naturalWorldDigest(record.worldFacts.payload.objectFootprints) &&
    record.worldState.payload.resources.length === 0 && record.eventCursor === 0 && record.ruleVersion === verified.proposal.ruleVersion,
  "natural initial saved state differs from replay")
  const taskManifest = json(readBound(root, request.taskManifest, receipts)), task = json(readBound(root, request.taskPackage, receipts))
  requireValue(taskManifest.taskPath === request.taskPackage.path && task.scope === SCOPE && task.conditionScope === SCOPE && taskManifest.scope === SCOPE, "natural task binding or scope differs")
  const visual = record.sourceBindings.filter(b => b.role === "visual_fact_manifest"); requireValue(visual.length === 1, "saved visual fact binding missing")
  const rebuilt = await buildInitialNaturalWorldVisualTask({ sourceFactReleaseBinding: request.sourceFactRelease,
    visualFactManifestBinding: { path: visual[0].uri, sha256: visual[0].fileSha256 }, directorPath: taskManifest.directorPath, taskPath: request.taskPackage.path })
  requireValue(naturalWorldDigest(rebuilt.task) === naturalWorldDigest(task) && naturalWorldDigest(rebuilt.manifest) === naturalWorldDigest(taskManifest), "natural task replay differs")
  const typed = await verifyNaturalWorldConditionPackage({ manifestBinding: request.conditionManifest, expected: {
    worldId: record.worldId, regionId: record.regionId, tick: record.tick, factHash: request.factHash, sourceFactReleaseIdentity: verified.release.sourceFactReleaseIdentity } })
  const pack = json(readBound(root, request.conditionPackage, receipts))
  requireValue(typed.manifest.conditionPackPath === request.conditionPackage.path && naturalWorldDigest(pack) === naturalWorldDigest(typed.pack) &&
    pack.sourceBindings.taskPackagePath === request.taskPackage.path && pack.taskSha256 === task.taskSha256 && pack.datasetReleaseIdentity === verified.proposal.knowledgeDatasetBinding.identity &&
    pack.datasetBindingPurpose === "model_training_knowledge_only" && pack.newWorldIsDatasetSample === false, "natural condition/task/dataset binding differs")
  const table = validateNaturalObjectTable(pack.objectInstanceTable, record.worldFacts.payload.objectFootprints)
  for (const c of pack.channels) {
    const stored = record.sourceBindings.filter(b => b.role === `condition_channel_${c.id}`)
    requireValue(stored.length === 1 && stored[0].uri === c.path && stored[0].fileSha256 === c.sha256, "saved channel binding differs:" + c.id)
  }
  const ecology = task.singleMapEcologyFields, environment = record.worldState.payload.environment
  requireValue(naturalWorldDigest(ecology) === naturalWorldDigest(pack.categoricalConditions.ecologyPlan) &&
    naturalWorldDigest(ecology.environment.seasonScenario) === naturalWorldDigest(environment.seasonScenario) &&
    environment.seasonScenario.kind === "initial_simulation_scenario" && environment.seasonScenario.season === "wet_season" &&
    ["weather", "lighting", "wind", "localTime"].every(k => environment[k]?.status === "unknown" && environment[k].reason), "natural ecology/scenario/unknown state differs")
  const policyPath = "data/ai-painter/system-governance/ai-painter-native-stage-policy-v1.json", policyBytes = fs.readFileSync(path.join(root, policyPath))
  const nativePolicy = { path: policyPath, sha256: sha(policyBytes) }, policy = json(readBound(root, nativePolicy, receipts))
  requireValue(policy.schemaVersion === "native-stage-geometry-policy-v1" && policy.stages.length === 3 && policy.stages.every((s, i) => s.stage === i && s.width === 256 * 2 ** i && s.height === 192 * 2 ** i), "registered native geometry policy differs")
  const dependencies = new Map()
  for (const p of ["scripts/lib/natural-world-model-input.mjs", ...pythonImportClosure(root), ...verified.release.producerBindings.map(b => b.path)]) {
    const bytes = fs.readFileSync(path.join(root, p)); dependencies.set(p, { path: p, sha256: sha(bytes) })
  }
  for (const b of dependencies.values()) readBound(root, b, receipts)
  const rawClosure = new Map()
  for (const r of [...verified.inputReads, ...rebuilt.inputReads, ...typed.inputReads]) rawClosure.set(r.path, { path: r.path, sha256: r.fileSha256 })
  const descriptor = { schemaVersion: "natural-world-model-input-descriptor-v1", scope: SCOPE, status: "authenticated_input_only_no_model_qualification",
    identity: request.identity, tick: record.tick, stateVersion: record.stateVersion, factHash: request.factHash,
    statePayloadSha256: record.statePayloadSha256, recordContentSha256: record.recordContentSha256,
    bindings: Object.fromEntries(Object.keys(storedRoles).map(k => [k, request[k]]).concat([["runtimeSave", request.runtimeSave]])),
    sourceFactReleaseIdentity: verified.release.sourceFactReleaseIdentity, sourcePackageIdentity: verified.proposal.sourcePackageIdentity,
    channels: pack.channels.map(c => ({ id: c.id, kind: c.kind, path: c.path, sha256: c.sha256, dtype: c.dtype, nativeShape: c.shape,
      resize: c.kind === "distance" || c.kind === "coordinate" || c.kind === "continuous" || c.id.startsWith("signed_distance_") || ["coordinate_x", "coordinate_y", "moisture_proximity"].includes(c.id) ? "bilinear" : "nearest" })),
    tensorPolicy: { sourceWidth: 1024, sourceHeight: 768, dtype: "float32", layout: "NCHW", range: [0, 1], normalizationDivisor: 255, directFromOriginalForEveryStage: true },
    nativePolicy, nativeStages: policy.stages, objectInstanceTable: table, instanceCoordinateSpace: "original_1024x768", objectRoles: ROLES,
    ecology: { regionalLandscapeType: ecology.regionalLandscapeType, seasonScenario: environment.seasonScenario, environment },
    knowledgeDatasetBinding: verified.proposal.knowledgeDatasetBinding, newWorldIsDatasetSample: false,
    dependencyBindings: [...dependencies.values()], sourceReadBindings: [...rawClosure.values()],
    noModelExecutionQualification: true }
  const payloadSha256 = naturalWorldDigest(descriptor)
  return { descriptor: { ...descriptor, descriptorPayloadSha256: payloadSha256 }, inputReads: receipts }
}
export async function writeNaturalWorldModelInputDescriptor({ request, outputPath, root = process.cwd() }) {
  relativeFile(outputPath); requireValue(outputPath.startsWith(".runtime/"), "model descriptor output must be runtime evidence")
  const runtime = fs.realpathSync(path.join(root, ".runtime")), parent = fs.realpathSync(path.dirname(path.resolve(root, outputPath)))
  const inside = path.relative(runtime, parent)
  requireValue(inside === "" || !inside.startsWith("..") && !path.isAbsolute(inside), "model descriptor output physical escape")
  const result = await buildNaturalWorldModelInputDescriptor({ request, root }), bytes = Buffer.from(JSON.stringify(result.descriptor, null, 2) + "\n")
  requireValue(bytes.length <= 2 * 1024 * 1024, "natural input descriptor exceeded bound")
  fs.writeFileSync(path.resolve(root, outputPath), bytes, { flag: "wx" })
  return { ...result, binding: { path: outputPath, sha256: sha(bytes) }, bytes: bytes.length }
}
