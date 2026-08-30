import { createHash } from "node:crypto"
import { existsSync, mkdtempSync, readFileSync, rmSync } from "node:fs"
import { tmpdir } from "node:os"
import path from "node:path"
import { pathToFileURL } from "node:url"
import { DatabaseSync } from "node:sqlite"

const projectRoot = process.cwd()
const storeSourcePath = path.join(projectRoot, "src", "server", "ai-console-control", "review-adjudication-store.ts")
const serviceSourcePath = path.join(projectRoot, "src", "server", "ai-console-control", "review-adjudication-command-service.ts")
const projectionSourcePath = path.join(projectRoot, "src", "server", "ai-console", "review-adjudication-projection.ts")
const routeSourcePath = path.join(projectRoot, "src", "app", "api", "ai-console", "control", "reviews", "route.ts")
const schemaPath = path.join(projectRoot, "data", "ai-console", "schemas", "ai-console-review-adjudication-v1.schema.json")
const storePath = path.join(projectRoot, ".runtime", "ai-console", "reviews", "review-adjudication-registry-v1.sqlite")
const failures = []

for (const sourcePath of [storeSourcePath, serviceSourcePath, projectionSourcePath, routeSourcePath, schemaPath]) {
  if (!existsSync(sourcePath)) failures.push(`missing_file:${path.relative(projectRoot, sourcePath)}`)
}
if (failures.length === 0) {
  const productSource = [storeSourcePath, serviceSourcePath, projectionSourcePath, routeSourcePath].map((sourcePath) => readFileSync(sourcePath, "utf8")).join("\n")
  if (/ai-painter-progress|\/api\/ai-painter|(?:\.runtime|data)[\\/]ai-painter/u.test(productSource)) failures.push("legacy_source_coupling")
  for (const marker of [
    "new_ai_console_only", "ai_console_review_adjudication_writer_v1", "ai_console_review_adjudication_executor_v1",
    "register_review_contract", "register_machine_review_observation", "registered_frozen", "BEGIN IMMEDIATE",
    "creation_content_blob BLOB NOT NULL", "ai_console_review_command_idempotency_conflict",
    "server_recomputes_terminal_status_from_frozen_contract", "review_run_contract_already_adjudicated",
  ]) if (!productSource.includes(marker)) failures.push(`missing_marker:${marker}`)
  const schema = JSON.parse(readFileSync(schemaPath, "utf8"))
  if (schema.title !== "AI Console Review Adjudication V1" || schema.oneOf?.length !== 2) failures.push("schema_contract_invalid")
  for (const definition of ["reviewContract", "machineReviewResult"]) if (!schema.$defs?.[definition]) failures.push(`schema_definition_missing:${definition}`)
}

let actualReviewContractCount = null
let actualReviewResultCount = null
let actualRegistryRevision = null
if (!existsSync(storePath)) failures.push("review_adjudication_store_not_initialized")
else {
  const database = new DatabaseSync(storePath, { open: true, readOnly: true })
  try {
    const integrity = database.prepare("PRAGMA integrity_check").get()
    if (!integrity || !Object.values(integrity).includes("ok")) failures.push("review_adjudication_integrity_failed")
    const metadata = database.prepare("SELECT * FROM metadata").get()
    actualReviewContractCount = Number(database.prepare("SELECT COUNT(*) AS count FROM review_contracts").get().count)
    actualReviewResultCount = Number(database.prepare("SELECT COUNT(*) AS count FROM review_results").get().count)
    actualRegistryRevision = Number(metadata?.registry_revision)
    if (metadata?.source_boundary !== "new_ai_console_only" || metadata?.writer_identity !== "ai_console_review_adjudication_writer_v1") failures.push("review_adjudication_metadata_identity_invalid")
    if (Number(metadata?.review_contract_count) !== actualReviewContractCount || Number(metadata?.review_result_count) !== actualReviewResultCount) failures.push("review_adjudication_metadata_count_invalid")
    if (actualReviewContractCount !== 0 || actualReviewResultCount !== 0 || actualRegistryRevision !== 0) failures.push("actual_review_adjudication_store_must_start_empty")
  } finally { database.close() }
}

let dynamicCommandTest = false
if (failures.length === 0) {
  const storeModule = await import(pathToFileURL(storeSourcePath).href)
  const temporaryRoot = mkdtempSync(path.join(tmpdir(), "ai-console-review-adjudication-check-"))
  try {
    process.chdir(temporaryRoot)
    const initialized = storeModule.initializeAiConsoleReviewAdjudicationStore()
    if (initialized.registryRevision !== 0 || initialized.reviewContractCount !== 0 || initialized.reviewResultCount !== 0) failures.push("temporary_store_initial_state_invalid")
    const contractInput = {
      commandType: "register_review_contract", capabilityDomain: "visual_world_generation", reviewerIdentity: "reviewer:map-integrity", reviewerVersion: "reviewer:map-integrity/v1",
      metricDefinitionId: "metric:coverage/v1", thresholdOperator: "greater_or_equal", thresholdValue: 0.98, thresholdUnit: "unit:ratio",
      evidenceRequirementId: "evidence:normalized-map/v1", failureCode: "review_coverage_not_met", previousReviewContractId: null,
      expectedRegistryRevision: 0, idempotencyKeySha256: sha256("contract-key"), reasonText: "登记新平台冻结审核合同",
      actorIdentity: "local_console_operator", role: "operator", requestedAtUtc: "2026-08-28T03:00:00.000Z",
    }
    const createdContract = storeModule.executeAiConsoleReviewCommand(contractInput)
    const replayedContract = storeModule.executeAiConsoleReviewCommand(contractInput)
    if (createdContract.httpStatus !== 201 || !createdContract.reviewContract || replayedContract.receipt.commandId !== createdContract.receipt.commandId || !replayedContract.replayed) failures.push("review_contract_create_or_replay_invalid")

    let idempotencyClosed = false
    try { storeModule.executeAiConsoleReviewCommand({ ...contractInput, thresholdValue: 0.99 }) }
    catch (error) { idempotencyClosed = error instanceof Error && error.message === "ai_console_review_command_idempotency_conflict" }
    if (!idempotencyClosed) failures.push("review_adjudication_idempotency_conflict_not_closed")

    const duplicateContract = storeModule.executeAiConsoleReviewCommand({ ...contractInput, expectedRegistryRevision: 1, idempotencyKeySha256: sha256("duplicate-contract"), requestedAtUtc: "2026-08-28T03:01:00.000Z" })
    const missingPrevious = storeModule.executeAiConsoleReviewCommand({ ...contractInput, previousReviewContractId: sha256("missing-previous"), expectedRegistryRevision: 1, idempotencyKeySha256: sha256("missing-previous-key"), requestedAtUtc: "2026-08-28T03:02:00.000Z" })
    const observationBase = {
      commandType: "register_machine_review_observation", reviewContractId: createdContract.reviewContract.reviewContractId,
      reviewRunId: "review:run/pass", validationInputIdentity: "validation:input/pass", machineReviewerIdentity: "reviewer:map-integrity", metricValue: 0.99,
      affectedScope: "scope:map/pass", evidenceTypeId: "evidence:normalized-map/v1", evidenceSha256: sha256("pass-evidence"),
      expectedRegistryRevision: 1, idempotencyKeySha256: sha256("pass-observation"), reasonText: "登记机器审核观测并自动裁决",
      actorIdentity: "local_console_operator", role: "operator", requestedAtUtc: "2026-08-28T03:03:00.000Z",
    }
    const missingContract = storeModule.executeAiConsoleReviewCommand({ ...observationBase, reviewContractId: sha256("missing-contract"), idempotencyKeySha256: sha256("missing-contract-key") })
    const reviewerConflict = storeModule.executeAiConsoleReviewCommand({ ...observationBase, machineReviewerIdentity: "reviewer:wrong", idempotencyKeySha256: sha256("reviewer-conflict") })
    const passed = storeModule.executeAiConsoleReviewCommand(observationBase)
    const duplicateResult = storeModule.executeAiConsoleReviewCommand({ ...observationBase, expectedRegistryRevision: 2, idempotencyKeySha256: sha256("duplicate-result"), requestedAtUtc: "2026-08-28T03:04:00.000Z" })
    const conflictingResult = storeModule.executeAiConsoleReviewCommand({ ...observationBase, expectedRegistryRevision: 2, metricValue: 0.50, evidenceSha256: sha256("conflicting-evidence"), idempotencyKeySha256: sha256("conflicting-result"), requestedAtUtc: "2026-08-28T03:05:00.000Z" })
    const failed = storeModule.executeAiConsoleReviewCommand({ ...observationBase, expectedRegistryRevision: 2, reviewRunId: "review:run/fail", validationInputIdentity: "validation:input/fail", metricValue: 0.50, affectedScope: "scope:map/fail", evidenceSha256: sha256("fail-evidence"), idempotencyKeySha256: sha256("failed-result"), requestedAtUtc: "2026-08-28T03:06:00.000Z" })
    const revisionConflict = storeModule.executeAiConsoleReviewCommand({ ...contractInput, reviewerVersion: "reviewer:map-integrity/v2", expectedRegistryRevision: 999, idempotencyKeySha256: sha256("revision-conflict") })
    let actorClosed = false
    try { storeModule.executeAiConsoleReviewCommand({ ...contractInput, idempotencyKeySha256: sha256("external-actor"), actorIdentity: "external_actor" }) }
    catch (error) { actorClosed = error instanceof Error && error.message === "ai_console_review_command_common_field_invalid" }
    if (!actorClosed) failures.push("review_adjudication_external_actor_not_closed")

    const read = storeModule.readAiConsoleReviewAdjudicationStore()
    dynamicCommandTest = duplicateContract.receipt.failureCode === "ai_console_review_contract_already_registered"
      && missingPrevious.receipt.failureCode === "ai_console_previous_review_contract_not_found"
      && missingContract.receipt.failureCode === "ai_console_review_contract_not_found"
      && reviewerConflict.receipt.failureCode === "ai_console_machine_reviewer_identity_conflict"
      && passed.reviewResult?.reviewStatus === "passed" && passed.reviewResult?.failureCode === null
      && duplicateResult.receipt.failureCode === "ai_console_machine_review_result_already_registered"
      && conflictingResult.receipt.failureCode === "ai_console_review_run_contract_already_adjudicated"
      && failed.reviewResult?.reviewStatus === "failed" && failed.reviewResult?.failureCode === "review_coverage_not_met"
      && revisionConflict.receipt.failureCode === "ai_console_review_registry_revision_conflict"
      && read.status === "connected" && read.metadata.registryRevision === 3 && read.metadata.commandCount === 10
      && read.reviewContracts.length === 1 && read.reviewResults.length === 2 && read.events.length === 3
    if (!dynamicCommandTest) failures.push("review_adjudication_dynamic_command_test_invalid")
  } finally {
    process.chdir(projectRoot)
    const resolved = path.resolve(temporaryRoot)
    if (resolved.startsWith(path.resolve(tmpdir()) + path.sep)) rmSync(resolved, { recursive: true, force: true })
  }
}

console.log(JSON.stringify({ ok: failures.length === 0, registryIdentity: "ai_console_review_adjudication_registry", actualReviewContractCount, actualReviewResultCount, actualRegistryRevision, dynamicCommandTest, failures }, null, 2))
if (failures.length > 0) process.exitCode = 1

function sha256(value) { return createHash("sha256").update(value, "utf8").digest("hex") }
