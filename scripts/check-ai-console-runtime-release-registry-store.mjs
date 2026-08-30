import { createHash } from "node:crypto"
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import path from "node:path"
import { pathToFileURL } from "node:url"
import { DatabaseSync } from "node:sqlite"

const projectRoot = process.cwd()
const sourceRoot = path.join(projectRoot, "src", "server", "ai-console-control")
const storeSourcePath = path.join(sourceRoot, "runtime-release-registry-store.ts")
const serviceSourcePath = path.join(sourceRoot, "runtime-release-command-service.ts")
const projectionSourcePath = path.join(projectRoot, "src", "server", "ai-console", "runtime-projection.ts")
const capabilityProjectionPath = path.join(projectRoot, "src", "server", "ai-console", "capability-projection.ts")
const controlProjectionPath = path.join(projectRoot, "src", "server", "ai-console", "control-projection.ts")
const routeSourcePath = path.join(projectRoot, "src", "app", "api", "ai-console", "control", "runtime", "route.ts")
const controlSurfacePath = path.join(projectRoot, "src", "app", "ai-console", "ai-console-control-surface.tsx")
const schemaPath = path.join(projectRoot, "data", "ai-console", "schemas", "ai-console-runtime-release-registry-v1.schema.json")
const storePath = path.join(projectRoot, ".runtime", "ai-console", "runtime", "runtime-release-registry-v1.sqlite")
const failures = []

for (const sourcePath of [storeSourcePath, serviceSourcePath, projectionSourcePath, capabilityProjectionPath, controlProjectionPath, routeSourcePath, controlSurfacePath, schemaPath]) {
  if (!existsSync(sourcePath)) failures.push(`missing_file:${path.relative(projectRoot, sourcePath)}`)
}
if (failures.length === 0) {
  const productSource = [storeSourcePath, serviceSourcePath, projectionSourcePath, capabilityProjectionPath, controlProjectionPath, routeSourcePath, controlSurfacePath].map((sourcePath) => readFileSync(sourcePath, "utf8")).join("\n")
  if (/ai-painter-progress|\/api\/ai-painter|(?:\.runtime|data)[\\/]ai-painter/u.test(productSource)) failures.push("legacy_source_coupling")
  for (const marker of [
    "new_ai_console_only", "ai_console_runtime_release_registry_writer_v1", "ai_console_runtime_release_executor_v1",
    "activate_qualified_release", "register_runtime_frame_candidate", "publish_reviewed_runtime_frame",
    "registered_for_review", "registered_formal_unconsumed", "BEGIN IMMEDIATE", "creation_content_blob BLOB NOT NULL",
    "ai_console_runtime_release_command_idempotency_conflict", "passed_machine_review_and_current_activation_required",
  ]) if (!productSource.includes(marker)) failures.push(`missing_marker:${marker}`)
  const schema = JSON.parse(readFileSync(schemaPath, "utf8"))
  if (schema.title !== "AI Console Runtime Release Registry Records V1" || schema.oneOf?.length !== 3) failures.push("schema_contract_invalid")
  for (const definition of ["capabilityActivation", "runtimeFrameCandidate", "runtimeFramePublication"]) if (!schema.$defs?.[definition]) failures.push(`schema_definition_missing:${definition}`)
}

const moduleRoot = mkdtempSync(path.join(tmpdir(), "ai-console-runtime-release-modules-"))
let capabilityModule
let reviewModule
let runtimeModule
try {
  const capabilityTarget = path.join(moduleRoot, "capability-lifecycle-store.ts")
  const reviewTarget = path.join(moduleRoot, "review-adjudication-store.ts")
  const runtimeTarget = path.join(moduleRoot, "runtime-release-registry-store.ts")
  writeFileSync(capabilityTarget, readFileSync(path.join(sourceRoot, "capability-lifecycle-store.ts"), "utf8"), "utf8")
  writeFileSync(reviewTarget, readFileSync(path.join(sourceRoot, "review-adjudication-store.ts"), "utf8"), "utf8")
  const runtimeSource = readFileSync(storeSourcePath, "utf8")
    .replace('from "./capability-lifecycle-store"', 'from "./capability-lifecycle-store.ts"')
    .replace('from "./review-adjudication-store"', 'from "./review-adjudication-store.ts"')
  writeFileSync(runtimeTarget, runtimeSource, "utf8")
  capabilityModule = await import(pathToFileURL(capabilityTarget).href)
  reviewModule = await import(pathToFileURL(reviewTarget).href)
  runtimeModule = await import(pathToFileURL(runtimeTarget).href)
} catch (error) {
  failures.push(`runtime_release_module_load_failed:${error instanceof Error ? error.message : String(error)}`)
}

let actualActivationCount = null
let actualCandidateCount = null
let actualPublicationCount = null
let actualRegistryRevision = null
if (runtimeModule && !existsSync(storePath)) runtimeModule.initializeAiConsoleRuntimeReleaseRegistryStore()
if (!existsSync(storePath)) failures.push("runtime_release_registry_not_initialized")
else {
  const database = new DatabaseSync(storePath, { open: true, readOnly: true })
  try {
    const integrity = database.prepare("PRAGMA integrity_check").get()
    if (!integrity || !Object.values(integrity).includes("ok")) failures.push("runtime_release_integrity_failed")
    const metadata = database.prepare("SELECT * FROM metadata").get()
    actualActivationCount = Number(database.prepare("SELECT COUNT(*) AS count FROM capability_activations").get().count)
    actualCandidateCount = Number(database.prepare("SELECT COUNT(*) AS count FROM runtime_frame_candidates").get().count)
    actualPublicationCount = Number(database.prepare("SELECT COUNT(*) AS count FROM runtime_frame_publications").get().count)
    actualRegistryRevision = Number(metadata?.registry_revision)
    if (metadata?.source_boundary !== "new_ai_console_only" || metadata?.writer_identity !== "ai_console_runtime_release_registry_writer_v1") failures.push("runtime_release_metadata_identity_invalid")
    if (Number(metadata?.activation_count) !== actualActivationCount || Number(metadata?.candidate_count) !== actualCandidateCount || Number(metadata?.publication_count) !== actualPublicationCount) failures.push("runtime_release_metadata_count_invalid")
    if (actualActivationCount !== 0 || actualCandidateCount !== 0 || actualPublicationCount !== 0 || actualRegistryRevision !== 0) failures.push("actual_runtime_release_store_must_start_empty")
  } finally { database.close() }
}

let dynamicCommandTest = false
let dynamicDetails = null
if (failures.length === 0 && capabilityModule && reviewModule && runtimeModule) {
  const temporaryRoot = mkdtempSync(path.join(tmpdir(), "ai-console-runtime-release-check-"))
  try {
    process.chdir(temporaryRoot)
    capabilityModule.initializeAiConsoleCapabilityLifecycleStore()
    reviewModule.initializeAiConsoleReviewAdjudicationStore()
    runtimeModule.initializeAiConsoleRuntimeReleaseRegistryStore()

    const common = (revision, key, time) => ({ expectedRegistryRevision: revision, idempotencyKeySha256: sha256(key), reasonText: "登记新平台正式运行发布合同", actorIdentity: "local_console_operator", role: "operator", requestedAtUtc: time })
    const capability = capabilityModule.executeAiConsoleCapabilityCommand({ commandType: "register_capability_candidate", capabilityDomain: "visual_world_generation", parentCapabilityVersionId: null, modelIdentity: "model:runtime/v1", datasetReleaseIdentity: "dataset:runtime/v1", trainingParadigm: "training:local/v1", ...common(0, "capability", "2026-08-28T05:00:00.000Z") })
    let capabilityRevision = 1
    for (const [index, qualificationGateId] of capabilityModule.aiConsoleQualificationGates.entries()) {
      capabilityModule.executeAiConsoleCapabilityCommand({ commandType: "record_capability_qualification", capabilityVersionId: capability.candidate.capabilityVersionId, qualificationGateId, qualificationStatus: "passed", evidenceSha256: sha256(`qualification-${index}`), ...common(capabilityRevision, `qualification-${index}`, `2026-08-28T05:0${index + 1}:00.000Z`) })
      capabilityRevision += 1
    }
    const release = capabilityModule.executeAiConsoleCapabilityCommand({ commandType: "register_qualified_capability_release", capabilityVersionId: capability.candidate.capabilityVersionId, conditionSchemaId: "condition:runtime/v1", previousReleaseIdentity: null, rollbackReleaseIdentity: null, ...common(capabilityRevision, "release", "2026-08-28T05:10:00.000Z") })

    const activationInput = { commandType: "activate_qualified_release", capabilityReleaseIdentity: release.release.capabilityReleaseIdentity, expectedPreviousActivationId: null, ...common(0, "activation", "2026-08-28T05:11:00.000Z") }
    const activation = runtimeModule.executeAiConsoleRuntimeReleaseCommand(activationInput)
    const activationReplay = runtimeModule.executeAiConsoleRuntimeReleaseCommand(activationInput)
    let idempotencyClosed = false
    try { runtimeModule.executeAiConsoleRuntimeReleaseCommand({ ...activationInput, capabilityReleaseIdentity: sha256("conflict") }) }
    catch (error) { idempotencyClosed = error instanceof Error && error.message === "ai_console_runtime_release_command_idempotency_conflict" }

    const candidate = runtimeModule.executeAiConsoleRuntimeReleaseCommand({ commandType: "register_runtime_frame_candidate", activationId: activation.activation.activationId, worldId: "world:runtime-check", tick: 42, worldFactIdentity: "worldfact:runtime-check/42", conditionPackageIdentity: "condition:package/runtime-check", visualArtifactIdentity: "artifact:visual/runtime-check", imageSha256: sha256("image"), frameManifestSha256: sha256("manifest"), ...common(1, "frame-candidate", "2026-08-28T05:12:00.000Z") })

    const reviewContract = reviewModule.executeAiConsoleReviewCommand({ commandType: "register_review_contract", capabilityDomain: "visual_world_generation", reviewerIdentity: "reviewer:runtime", reviewerVersion: "reviewer:runtime/v1", metricDefinitionId: "metric:runtime-quality/v1", thresholdOperator: "greater_or_equal", thresholdValue: 0.95, thresholdUnit: "unit:ratio", evidenceRequirementId: "evidence:runtime-frame/v1", failureCode: "runtime_quality_not_met", previousReviewContractId: null, ...common(0, "review-contract", "2026-08-28T05:13:00.000Z") })
    const failedReview = reviewModule.executeAiConsoleReviewCommand({ commandType: "register_machine_review_observation", reviewContractId: reviewContract.reviewContract.reviewContractId, reviewRunId: "review:runtime/fail", validationInputIdentity: candidate.candidate.runtimeFrameCandidateIdentity, machineReviewerIdentity: "reviewer:runtime", metricValue: 0.5, affectedScope: "scope:runtime/frame", evidenceTypeId: "evidence:runtime-frame/v1", evidenceSha256: sha256("failed-review"), ...common(1, "failed-review", "2026-08-28T05:14:00.000Z") })
    const rejectedPublication = runtimeModule.executeAiConsoleRuntimeReleaseCommand({ commandType: "publish_reviewed_runtime_frame", runtimeFrameCandidateIdentity: candidate.candidate.runtimeFrameCandidateIdentity, reviewResultId: failedReview.reviewResult.reviewResultId, expectedPreviousRuntimeFrameIdentity: null, ...common(2, "rejected-publication", "2026-08-28T05:15:00.000Z") })
    const passedReview = reviewModule.executeAiConsoleReviewCommand({ commandType: "register_machine_review_observation", reviewContractId: reviewContract.reviewContract.reviewContractId, reviewRunId: "review:runtime/pass", validationInputIdentity: candidate.candidate.runtimeFrameCandidateIdentity, machineReviewerIdentity: "reviewer:runtime", metricValue: 0.99, affectedScope: "scope:runtime/frame", evidenceTypeId: "evidence:runtime-frame/v1", evidenceSha256: sha256("passed-review"), ...common(2, "passed-review", "2026-08-28T05:16:00.000Z") })
    const publicationInput = { commandType: "publish_reviewed_runtime_frame", runtimeFrameCandidateIdentity: candidate.candidate.runtimeFrameCandidateIdentity, reviewResultId: passedReview.reviewResult.reviewResultId, expectedPreviousRuntimeFrameIdentity: null, ...common(2, "publication", "2026-08-28T05:17:00.000Z") }
    const publication = runtimeModule.executeAiConsoleRuntimeReleaseCommand(publicationInput)
    const publicationReplay = runtimeModule.executeAiConsoleRuntimeReleaseCommand(publicationInput)
    const read = runtimeModule.readAiConsoleRuntimeReleaseRegistryStore()

    dynamicDetails = {
      activationStatus: activation.httpStatus,
      activationReplay: activationReplay.replayed,
      idempotencyClosed,
      candidateStatus: candidate.httpStatus,
      rejectedFailure: rejectedPublication.receipt.failureCode,
      publicationStatus: publication.httpStatus,
      publicationTerminal: publication.publication?.runtimeFrameStatus,
      publicationReplay: publicationReplay.replayed,
      readStatus: read.status,
      readReason: read.reasonCode,
      metadata: read.status === "connected" ? read.metadata : null,
    }

    dynamicCommandTest = activation.httpStatus === 201 && activationReplay.replayed === true
      && idempotencyClosed && candidate.httpStatus === 201
      && rejectedPublication.receipt.failureCode === "ai_console_runtime_review_result_not_passed"
      && publication.publication?.runtimeFrameStatus === "registered_formal_unconsumed" && publicationReplay.replayed === true
      && read.status === "connected" && read.metadata.registryRevision === 3 && read.metadata.commandCount === 4
      && read.activations.length === 1 && read.candidates.length === 1 && read.publications.length === 1 && read.events.length === 3
    if (!dynamicCommandTest) failures.push("runtime_release_dynamic_command_test_invalid")
  } finally {
    process.chdir(projectRoot)
    const resolved = path.resolve(temporaryRoot)
    if (resolved.startsWith(path.resolve(tmpdir()) + path.sep)) rmSync(resolved, { recursive: true, force: true })
  }
}

const resolvedModuleRoot = path.resolve(moduleRoot)
if (resolvedModuleRoot.startsWith(path.resolve(tmpdir()) + path.sep)) rmSync(resolvedModuleRoot, { recursive: true, force: true })
console.log(JSON.stringify({ ok: failures.length === 0, registryIdentity: "ai_console_runtime_release_registry", actualActivationCount, actualCandidateCount, actualPublicationCount, actualRegistryRevision, dynamicCommandTest, dynamicDetails, failures }, null, 2))
if (failures.length > 0) process.exitCode = 1

function sha256(value) { return createHash("sha256").update(value, "utf8").digest("hex") }
