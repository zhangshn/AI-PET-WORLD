import { createHash } from "node:crypto"
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import path from "node:path"
import { pathToFileURL } from "node:url"
import { DatabaseSync } from "node:sqlite"

const projectRoot = process.cwd()
const sourceRoot = path.join(projectRoot, "src", "server", "ai-console-control")
const storeSourcePath = path.join(sourceRoot, "world-control-registry-store.ts")
const serviceSourcePath = path.join(sourceRoot, "world-control-command-service.ts")
const projectionSourcePath = path.join(projectRoot, "src", "server", "ai-console", "runtime-projection.ts")
const routeSourcePath = path.join(projectRoot, "src", "app", "api", "ai-console", "control", "world", "route.ts")
const controlSurfacePath = path.join(projectRoot, "src", "app", "ai-console", "ai-console-control-surface.tsx")
const schemaPath = path.join(projectRoot, "data", "ai-console", "schemas", "ai-console-world-control-registry-v1.schema.json")
const storePath = path.join(projectRoot, ".runtime", "ai-console", "runtime", "world-control-registry-v1.sqlite")
const failures = []

for (const sourcePath of [storeSourcePath, serviceSourcePath, projectionSourcePath, routeSourcePath, controlSurfacePath, schemaPath]) {
  if (!existsSync(sourcePath)) failures.push(`missing_file:${path.relative(projectRoot, sourcePath)}`)
}
if (failures.length === 0) {
  const productSource = [storeSourcePath, serviceSourcePath, projectionSourcePath, routeSourcePath, controlSurfacePath].map((sourcePath) => readFileSync(sourcePath, "utf8")).join("\n")
  if (/ai-painter-progress|\/api\/ai-painter|world-runtime-store-adapter|data[\\/]world-runtime/u.test(productSource)) failures.push("legacy_source_coupling")
  for (const marker of [
    "new_ai_console_only", "ai_console_world_control_registry_writer_v1", "ai_console_world_control_executor_v1",
    "consume_registered_runtime_frame", "pause_frame_publish", "resume_frame_publish", "rollback_runtime_frame", "freeze_visual_updates",
    "registered_formal_unconsumed", "runtime_frame_lineage_conflict", "rollback_requires_publish_pause", "BEGIN IMMEDIATE",
    "creation_content_blob BLOB NOT NULL", "ai_console_world_control_command_idempotency_conflict",
  ]) if (!productSource.includes(marker)) failures.push(`missing_marker:${marker}`)
  const schema = JSON.parse(readFileSync(schemaPath, "utf8"))
  if (schema.title !== "AI Console World Control Registry Records V1" || schema.oneOf?.length !== 2) failures.push("schema_contract_invalid")
  for (const definition of ["worldControlState", "worldControlEvent"]) if (!schema.$defs?.[definition]) failures.push(`schema_definition_missing:${definition}`)
}

const moduleRoot = mkdtempSync(path.join(tmpdir(), "ai-console-world-control-modules-"))
let capabilityModule
let reviewModule
let runtimeModule
let worldModule
try {
  for (const file of ["capability-lifecycle-store.ts", "review-adjudication-store.ts"]) {
    writeFileSync(path.join(moduleRoot, file), readFileSync(path.join(sourceRoot, file), "utf8"), "utf8")
  }
  writeFileSync(path.join(moduleRoot, "runtime-release-registry-store.ts"), readFileSync(path.join(sourceRoot, "runtime-release-registry-store.ts"), "utf8")
    .replace('from "./capability-lifecycle-store"', 'from "./capability-lifecycle-store.ts"')
    .replace('from "./review-adjudication-store"', 'from "./review-adjudication-store.ts"'), "utf8")
  writeFileSync(path.join(moduleRoot, "world-control-registry-store.ts"), readFileSync(storeSourcePath, "utf8")
    .replace('from "./runtime-release-registry-store"', 'from "./runtime-release-registry-store.ts"'), "utf8")
  capabilityModule = await import(pathToFileURL(path.join(moduleRoot, "capability-lifecycle-store.ts")).href)
  reviewModule = await import(pathToFileURL(path.join(moduleRoot, "review-adjudication-store.ts")).href)
  runtimeModule = await import(pathToFileURL(path.join(moduleRoot, "runtime-release-registry-store.ts")).href)
  worldModule = await import(pathToFileURL(path.join(moduleRoot, "world-control-registry-store.ts")).href)
} catch (error) {
  failures.push(`world_control_module_load_failed:${error instanceof Error ? error.message : String(error)}`)
}

let actualWorldCount = null
let actualStateCount = null
let actualCommandCount = null
let actualRegistryRevision = null
if (worldModule && !existsSync(storePath)) worldModule.initializeAiConsoleWorldControlRegistryStore()
if (!existsSync(storePath)) failures.push("world_control_registry_not_initialized")
else {
  const database = new DatabaseSync(storePath, { open: true, readOnly: true })
  try {
    const integrity = database.prepare("PRAGMA integrity_check").get()
    if (!integrity || !Object.values(integrity).includes("ok")) failures.push("world_control_integrity_failed")
    const metadata = database.prepare("SELECT * FROM metadata").get()
    actualWorldCount = Number(metadata?.world_count)
    actualStateCount = Number(database.prepare("SELECT COUNT(*) count FROM world_state_revisions").get().count)
    actualCommandCount = Number(database.prepare("SELECT COUNT(*) count FROM command_receipts").get().count)
    actualRegistryRevision = Number(metadata?.registry_revision)
    if (metadata?.source_boundary !== "new_ai_console_only" || metadata?.writer_identity !== "ai_console_world_control_registry_writer_v1") failures.push("world_control_metadata_identity_invalid")
    if (Number(metadata?.world_state_count) !== actualStateCount || Number(metadata?.command_count) !== actualCommandCount) failures.push("world_control_metadata_count_invalid")
    if (actualWorldCount !== 0 || actualStateCount !== 0 || actualCommandCount !== 0 || actualRegistryRevision !== 0) failures.push("actual_world_control_store_must_start_empty")
  } finally { database.close() }
}

let dynamicCommandTest = false
let dynamicDetails = null
if (failures.length === 0 && capabilityModule && reviewModule && runtimeModule && worldModule) {
  const temporaryRoot = mkdtempSync(path.join(tmpdir(), "ai-console-world-control-check-"))
  try {
    process.chdir(temporaryRoot)
    capabilityModule.initializeAiConsoleCapabilityLifecycleStore()
    reviewModule.initializeAiConsoleReviewAdjudicationStore()
    runtimeModule.initializeAiConsoleRuntimeReleaseRegistryStore()
    worldModule.initializeAiConsoleWorldControlRegistryStore()

    const base = (revision, key, time) => ({ expectedRegistryRevision: revision, idempotencyKeySha256: sha256(key), reasonText: "登记新平台世界控制验证合同", actorIdentity: "local_console_operator", role: "operator", requestedAtUtc: time })
    const capability = capabilityModule.executeAiConsoleCapabilityCommand({ commandType: "register_capability_candidate", capabilityDomain: "visual_world_generation", parentCapabilityVersionId: null, modelIdentity: "model:world-control/v1", datasetReleaseIdentity: "dataset:world-control/v1", trainingParadigm: "training:local/v1", ...base(0, "capability", "2026-08-29T01:00:00.000Z") })
    let capabilityRevision = 1
    for (const [index, qualificationGateId] of capabilityModule.aiConsoleQualificationGates.entries()) {
      capabilityModule.executeAiConsoleCapabilityCommand({ commandType: "record_capability_qualification", capabilityVersionId: capability.candidate.capabilityVersionId, qualificationGateId, qualificationStatus: "passed", evidenceSha256: sha256(`qualification-${index}`), ...base(capabilityRevision, `qualification-${index}`, `2026-08-29T01:0${index + 1}:00.000Z`) })
      capabilityRevision += 1
    }
    const release = capabilityModule.executeAiConsoleCapabilityCommand({ commandType: "register_qualified_capability_release", capabilityVersionId: capability.candidate.capabilityVersionId, conditionSchemaId: "condition:world-control/v1", previousReleaseIdentity: null, rollbackReleaseIdentity: null, ...base(capabilityRevision, "release", "2026-08-29T01:10:00.000Z") })
    const activation = runtimeModule.executeAiConsoleRuntimeReleaseCommand({ commandType: "activate_qualified_release", capabilityReleaseIdentity: release.release.capabilityReleaseIdentity, expectedPreviousActivationId: null, ...base(0, "activation", "2026-08-29T01:11:00.000Z") })
    const contract = reviewModule.executeAiConsoleReviewCommand({ commandType: "register_review_contract", capabilityDomain: "visual_world_generation", reviewerIdentity: "reviewer:world-control", reviewerVersion: "reviewer:world-control/v1", metricDefinitionId: "metric:world-control/v1", thresholdOperator: "greater_or_equal", thresholdValue: 0.95, thresholdUnit: "unit:ratio", evidenceRequirementId: "evidence:world-control/v1", failureCode: "world_control_quality_not_met", previousReviewContractId: null, ...base(0, "review-contract", "2026-08-29T01:12:00.000Z") })

    const publishFrame = (tick, previousIdentity, runtimeRevision, reviewRevision, suffix) => {
      const candidate = runtimeModule.executeAiConsoleRuntimeReleaseCommand({ commandType: "register_runtime_frame_candidate", activationId: activation.activation.activationId, worldId: "world:control-check", tick, worldFactIdentity: `worldfact:control-check/${tick}`, conditionPackageIdentity: `condition:control-check/${tick}`, visualArtifactIdentity: `artifact:control-check/${tick}`, imageSha256: sha256(`image-${suffix}`), frameManifestSha256: sha256(`manifest-${suffix}`), ...base(runtimeRevision, `candidate-${suffix}`, `2026-08-29T01:${13 + Number(suffix) * 3}:00.000Z`) })
      const review = reviewModule.executeAiConsoleReviewCommand({ commandType: "register_machine_review_observation", reviewContractId: contract.reviewContract.reviewContractId, reviewRunId: `review:world-control/${suffix}`, validationInputIdentity: candidate.candidate.runtimeFrameCandidateIdentity, machineReviewerIdentity: "reviewer:world-control", metricValue: 0.99, affectedScope: "scope:world-control/frame", evidenceTypeId: "evidence:world-control/v1", evidenceSha256: sha256(`review-${suffix}`), ...base(reviewRevision, `review-${suffix}`, `2026-08-29T01:${14 + Number(suffix) * 3}:00.000Z`) })
      return runtimeModule.executeAiConsoleRuntimeReleaseCommand({ commandType: "publish_reviewed_runtime_frame", runtimeFrameCandidateIdentity: candidate.candidate.runtimeFrameCandidateIdentity, reviewResultId: review.reviewResult.reviewResultId, expectedPreviousRuntimeFrameIdentity: previousIdentity, ...base(runtimeRevision + 1, `publication-${suffix}`, `2026-08-29T01:${15 + Number(suffix) * 3}:00.000Z`) }).publication
    }
    const first = publishFrame(42, null, 1, 1, "1")
    const second = publishFrame(43, first.runtimeFrameIdentity, 3, 2, "2")

    const worldBase = (registryRevision, worldRevision, key) => ({ expectedRegistryRevision: registryRevision, expectedWorldRevision: worldRevision, idempotencyKeySha256: sha256(key), reasonText: "登记新平台世界控制状态转换", actorIdentity: "local_console_operator", role: "operator", requestedAtUtc: `2026-08-29T02:${String(registryRevision).padStart(2, "0")}:00.000Z` })
    const consumeFirstInput = { commandType: "consume_registered_runtime_frame", runtimeFrameIdentity: first.runtimeFrameIdentity, ...worldBase(0, 0, "consume-first") }
    const consumeFirst = worldModule.executeAiConsoleWorldControlCommand(consumeFirstInput)
    const consumeReplay = worldModule.executeAiConsoleWorldControlCommand(consumeFirstInput)
    const consumeSecond = worldModule.executeAiConsoleWorldControlCommand({ commandType: "consume_registered_runtime_frame", runtimeFrameIdentity: second.runtimeFrameIdentity, ...worldBase(1, 1, "consume-second") })
    const rollbackRejected = worldModule.executeAiConsoleWorldControlCommand({ commandType: "rollback_runtime_frame", worldId: "world:control-check", targetRuntimeFrameIdentity: first.runtimeFrameIdentity, ...worldBase(2, 2, "rollback-rejected") })
    const pause = worldModule.executeAiConsoleWorldControlCommand({ commandType: "pause_frame_publish", worldId: "world:control-check", ...worldBase(2, 2, "pause") })
    const rollback = worldModule.executeAiConsoleWorldControlCommand({ commandType: "rollback_runtime_frame", worldId: "world:control-check", targetRuntimeFrameIdentity: first.runtimeFrameIdentity, ...worldBase(3, 3, "rollback") })
    const resume = worldModule.executeAiConsoleWorldControlCommand({ commandType: "resume_frame_publish", worldId: "world:control-check", ...worldBase(4, 4, "resume") })
    const freeze = worldModule.executeAiConsoleWorldControlCommand({ commandType: "freeze_visual_updates", worldId: "world:control-check", ...worldBase(5, 5, "freeze") })
    const read = worldModule.readAiConsoleWorldControlRegistryStore()

    dynamicDetails = {
      consumeStatus: consumeFirst.httpStatus,
      replayed: consumeReplay.replayed,
      secondTick: consumeSecond.worldState?.activeFrameTick,
      rollbackRejected: rollbackRejected.receipt.failureCode,
      rollbackTarget: rollback.worldState?.activeRuntimeFrameIdentity,
      resumeStatus: resume.worldState?.publishControlStatus,
      freezeStatus: freeze.worldState?.visualUpdateStatus,
      metadata: read.status === "connected" ? read.metadata : null,
    }
    dynamicCommandTest = consumeFirst.httpStatus === 201 && consumeReplay.replayed === true
      && consumeSecond.worldState?.activeFrameTick === 43
      && rollbackRejected.receipt.failureCode === "ai_console_world_control_rollback_requires_publish_pause"
      && pause.worldState?.publishControlStatus === "paused"
      && rollback.worldState?.activeRuntimeFrameIdentity === first.runtimeFrameIdentity
      && resume.worldState?.publishControlStatus === "publishing" && freeze.worldState?.visualUpdateStatus === "frozen"
      && read.status === "connected" && read.metadata.registryRevision === 6 && read.metadata.commandCount === 7
      && read.metadata.worldStateCount === 6 && read.events.length === 6 && read.currentWorldStates.length === 1
    if (!dynamicCommandTest) failures.push("world_control_dynamic_command_test_invalid")
  } finally {
    process.chdir(projectRoot)
    const resolved = path.resolve(temporaryRoot)
    if (resolved.startsWith(path.resolve(tmpdir()) + path.sep)) rmSync(resolved, { recursive: true, force: true })
  }
}

const resolvedModuleRoot = path.resolve(moduleRoot)
if (resolvedModuleRoot.startsWith(path.resolve(tmpdir()) + path.sep)) rmSync(resolvedModuleRoot, { recursive: true, force: true })
console.log(JSON.stringify({ ok: failures.length === 0, registryIdentity: "ai_console_world_control_registry", actualWorldCount, actualStateCount, actualCommandCount, actualRegistryRevision, dynamicCommandTest, dynamicDetails, failures }, null, 2))
if (failures.length > 0) process.exitCode = 1

function sha256(value) { return createHash("sha256").update(value, "utf8").digest("hex") }
