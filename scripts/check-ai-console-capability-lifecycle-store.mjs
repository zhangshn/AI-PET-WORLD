import { createHash } from "node:crypto"
import { existsSync, mkdtempSync, readFileSync, rmSync } from "node:fs"
import { tmpdir } from "node:os"
import path from "node:path"
import { pathToFileURL } from "node:url"
import { DatabaseSync } from "node:sqlite"

const projectRoot = process.cwd()
const storeSourcePath = path.join(projectRoot, "src", "server", "ai-console-control", "capability-lifecycle-store.ts")
const serviceSourcePath = path.join(projectRoot, "src", "server", "ai-console-control", "capability-command-service.ts")
const projectionSourcePath = path.join(projectRoot, "src", "server", "ai-console", "capability-projection.ts")
const routeSourcePath = path.join(projectRoot, "src", "app", "api", "ai-console", "control", "capabilities", "route.ts")
const schemaPath = path.join(projectRoot, "data", "ai-console", "schemas", "ai-console-capability-lifecycle-v1.schema.json")
const storePath = path.join(projectRoot, ".runtime", "ai-console", "capabilities", "capability-lifecycle-v1.sqlite")
const failures = []

for (const sourcePath of [storeSourcePath, serviceSourcePath, projectionSourcePath, routeSourcePath, schemaPath]) {
  if (!existsSync(sourcePath)) failures.push(`missing_file:${path.relative(projectRoot, sourcePath)}`)
}
if (failures.length === 0) {
  const productSource = [storeSourcePath, serviceSourcePath, projectionSourcePath, routeSourcePath].map((sourcePath) => readFileSync(sourcePath, "utf8")).join("\n")
  if (/ai-painter-progress|\/api\/ai-painter|(?:\.runtime|data)[\\/]ai-painter/u.test(productSource)) failures.push("legacy_source_coupling")
  for (const marker of [
    "new_ai_console_only", "ai_console_capability_lifecycle_writer_v1", "ai_console_capability_lifecycle_executor_v1",
    "register_capability_candidate", "record_capability_qualification", "register_qualified_capability_release",
    "BEGIN IMMEDIATE", "creation_content_blob BLOB NOT NULL", "ai_console_capability_command_idempotency_conflict",
    "ai_console_capability_lifecycle_registry", "new_ai_console_capability_registry_only",
  ]) if (!productSource.includes(marker)) failures.push(`missing_marker:${marker}`)
  const schema = JSON.parse(readFileSync(schemaPath, "utf8"))
  if (schema.title !== "AI Console Capability Lifecycle V1" || schema.oneOf?.length !== 3) failures.push("schema_contract_invalid")
  for (const definition of ["candidate", "qualification", "release"]) if (!schema.$defs?.[definition]) failures.push(`schema_definition_missing:${definition}`)
}

let actualCandidateCount = null
let actualQualificationCount = null
let actualReleaseCount = null
let actualRegistryRevision = null
if (!existsSync(storePath)) failures.push("capability_lifecycle_store_not_initialized")
else {
  const database = new DatabaseSync(storePath, { open: true, readOnly: true })
  try {
    const integrity = database.prepare("PRAGMA integrity_check").get()
    if (!integrity || !Object.values(integrity).includes("ok")) failures.push("capability_lifecycle_integrity_failed")
    const metadata = database.prepare("SELECT * FROM metadata").get()
    actualCandidateCount = Number(database.prepare("SELECT COUNT(*) AS count FROM candidates").get().count)
    actualQualificationCount = Number(database.prepare("SELECT COUNT(*) AS count FROM qualification_results").get().count)
    actualReleaseCount = Number(database.prepare("SELECT COUNT(*) AS count FROM releases").get().count)
    actualRegistryRevision = Number(metadata?.registry_revision)
    if (metadata?.source_boundary !== "new_ai_console_only" || metadata?.writer_identity !== "ai_console_capability_lifecycle_writer_v1") failures.push("capability_lifecycle_metadata_identity_invalid")
    if (Number(metadata?.candidate_count) !== actualCandidateCount || Number(metadata?.qualification_count) !== actualQualificationCount || Number(metadata?.release_count) !== actualReleaseCount) failures.push("capability_lifecycle_metadata_count_invalid")
    if (actualCandidateCount !== 0 || actualQualificationCount !== 0 || actualReleaseCount !== 0 || actualRegistryRevision !== 0) failures.push("actual_capability_lifecycle_store_must_start_empty")
  } finally { database.close() }
}

let dynamicCommandTest = false
if (failures.length === 0) {
  const storeModule = await import(pathToFileURL(storeSourcePath).href)
  const temporaryRoot = mkdtempSync(path.join(tmpdir(), "ai-console-capability-lifecycle-check-"))
  try {
    process.chdir(temporaryRoot)
    const initialized = storeModule.initializeAiConsoleCapabilityLifecycleStore()
    if (initialized.registryRevision !== 0 || initialized.candidateCount !== 0) failures.push("temporary_store_initial_state_invalid")
    const createInput = {
      commandType: "register_capability_candidate",
      capabilityDomain: "text_and_language",
      parentCapabilityVersionId: null,
      modelIdentity: "model:text-language/v1",
      datasetReleaseIdentity: "dataset:text-language/v1",
      trainingParadigm: "training:supervised/v1",
      expectedRegistryRevision: 0,
      idempotencyKeySha256: sha256("candidate-key"),
      reasonText: "登记新平台能力候选",
      actorIdentity: "local_console_operator",
      role: "operator",
      requestedAtUtc: "2026-08-28T01:00:00.000Z",
    }
    const created = storeModule.executeAiConsoleCapabilityCommand(createInput)
    const replayed = storeModule.executeAiConsoleCapabilityCommand(createInput)
    if (created.httpStatus !== 201 || !created.candidate || replayed.receipt.commandId !== created.receipt.commandId || !replayed.replayed) failures.push("candidate_create_or_replay_invalid")

    let idempotencyClosed = false
    try { storeModule.executeAiConsoleCapabilityCommand({ ...createInput, modelIdentity: "model:text-language/conflict" }) }
    catch (error) { idempotencyClosed = error instanceof Error && error.message === "ai_console_capability_command_idempotency_conflict" }
    if (!idempotencyClosed) failures.push("capability_idempotency_conflict_not_closed")

    const duplicateCandidate = storeModule.executeAiConsoleCapabilityCommand({
      ...createInput,
      expectedRegistryRevision: 1,
      idempotencyKeySha256: sha256("duplicate-candidate"),
      requestedAtUtc: "2026-08-28T01:00:30.000Z",
    })
    const missingParent = storeModule.executeAiConsoleCapabilityCommand({ ...createInput, expectedRegistryRevision: 1, idempotencyKeySha256: sha256("missing-parent"), parentCapabilityVersionId: sha256("missing") })
    const outOfOrder = storeModule.executeAiConsoleCapabilityCommand({
      commandType: "record_capability_qualification", capabilityVersionId: created.candidate.capabilityVersionId,
      qualificationGateId: "readonly_gpu", qualificationStatus: "passed", evidenceSha256: sha256("out-of-order-evidence"),
      expectedRegistryRevision: 1, idempotencyKeySha256: sha256("out-of-order"), reasonText: "验证资格门禁顺序失败关闭",
      actorIdentity: "local_console_operator", role: "operator", requestedAtUtc: "2026-08-28T01:01:00.000Z",
    })

    let expectedRegistryRevision = 1
    const qualifications = []
    for (const [index, qualificationGateId] of storeModule.aiConsoleQualificationGates.entries()) {
      const result = storeModule.executeAiConsoleCapabilityCommand({
        commandType: "record_capability_qualification", capabilityVersionId: created.candidate.capabilityVersionId,
        qualificationGateId, qualificationStatus: "passed", evidenceSha256: sha256(`qualification-evidence-${index}`),
        expectedRegistryRevision, idempotencyKeySha256: sha256(`qualification-key-${index}`), reasonText: "登记顺序资格证据结果",
        actorIdentity: "local_console_operator", role: "operator", requestedAtUtc: `2026-08-28T01:0${index + 2}:00.000Z`,
      })
      qualifications.push(result)
      expectedRegistryRevision += 1
    }
    const released = storeModule.executeAiConsoleCapabilityCommand({
      commandType: "register_qualified_capability_release", capabilityVersionId: created.candidate.capabilityVersionId,
      conditionSchemaId: "condition:text-language/v1", previousReleaseIdentity: null, rollbackReleaseIdentity: null,
      expectedRegistryRevision, idempotencyKeySha256: sha256("release-key"), reasonText: "登记已资格化的非活动发布",
      actorIdentity: "local_console_operator", role: "operator", requestedAtUtc: "2026-08-28T01:10:00.000Z",
    })
    expectedRegistryRevision += 1
    const stateRejected = storeModule.executeAiConsoleCapabilityCommand({
      commandType: "record_capability_qualification", capabilityVersionId: created.candidate.capabilityVersionId,
      qualificationGateId: "cpu_contract", qualificationStatus: "passed", evidenceSha256: sha256("post-release-evidence"),
      expectedRegistryRevision, idempotencyKeySha256: sha256("post-release"), reasonText: "验证发布后资格不可重写",
      actorIdentity: "local_console_operator", role: "operator", requestedAtUtc: "2026-08-28T01:11:00.000Z",
    })
    const duplicateRelease = storeModule.executeAiConsoleCapabilityCommand({
      commandType: "register_qualified_capability_release", capabilityVersionId: created.candidate.capabilityVersionId,
      conditionSchemaId: "condition:text-language/v1", previousReleaseIdentity: null, rollbackReleaseIdentity: null,
      expectedRegistryRevision, idempotencyKeySha256: sha256("duplicate-release"), reasonText: "验证重复发布失败关闭",
      actorIdentity: "local_console_operator", role: "operator", requestedAtUtc: "2026-08-28T01:12:00.000Z",
    })
    let actorClosed = false
    try { storeModule.executeAiConsoleCapabilityCommand({ ...createInput, idempotencyKeySha256: sha256("external-actor"), actorIdentity: "external_actor" }) }
    catch (error) { actorClosed = error instanceof Error && error.message === "ai_console_capability_command_common_field_invalid" }
    if (!actorClosed) failures.push("capability_external_actor_not_closed")

    const read = storeModule.readAiConsoleCapabilityLifecycleStore()
    dynamicCommandTest = duplicateCandidate.receipt.failureCode === "ai_console_capability_candidate_already_registered"
      && missingParent.receipt.failureCode === "ai_console_parent_capability_candidate_not_found"
      && outOfOrder.receipt.failureCode === "ai_console_capability_qualification_gate_order_conflict"
      && qualifications.every((result) => result.receipt.resultTerminalId === "qualification_recorded")
      && released.release?.releaseStatus === "registered_inactive"
      && stateRejected.receipt.failureCode === "ai_console_capability_candidate_not_qualifiable"
      && duplicateRelease.receipt.failureCode === "ai_console_capability_release_already_registered"
      && read.status === "connected" && read.metadata.registryRevision === 8 && read.metadata.commandCount === 13
      && read.candidates.length === 1 && read.candidates[0].candidateStatus === "release_registered"
      && read.qualifications.length === 6 && read.releases.length === 1 && read.events.length === 8
    if (!dynamicCommandTest) failures.push("capability_lifecycle_dynamic_command_test_invalid")
  } finally {
    process.chdir(projectRoot)
    const resolved = path.resolve(temporaryRoot)
    if (resolved.startsWith(path.resolve(tmpdir()) + path.sep)) rmSync(resolved, { recursive: true, force: true })
  }
}

console.log(JSON.stringify({
  ok: failures.length === 0,
  registryIdentity: "ai_console_capability_lifecycle_registry",
  actualCandidateCount,
  actualQualificationCount,
  actualReleaseCount,
  actualRegistryRevision,
  dynamicCommandTest,
  failures,
}, null, 2))
if (failures.length > 0) process.exitCode = 1

function sha256(value) { return createHash("sha256").update(value, "utf8").digest("hex") }
