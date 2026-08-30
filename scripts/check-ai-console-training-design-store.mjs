import { createHash } from "node:crypto"
import { existsSync, mkdtempSync, readFileSync, rmSync } from "node:fs"
import { tmpdir } from "node:os"
import path from "node:path"
import { pathToFileURL } from "node:url"
import { DatabaseSync } from "node:sqlite"

const projectRoot = process.cwd()
const storeSourcePath = path.join(projectRoot, "src", "server", "ai-console-control", "training-design-store.ts")
const serviceSourcePath = path.join(projectRoot, "src", "server", "ai-console-control", "training-design-command-service.ts")
const projectionSourcePath = path.join(projectRoot, "src", "server", "ai-console", "training-design-projection.ts")
const routeSourcePath = path.join(projectRoot, "src", "app", "api", "ai-console", "control", "training", "route.ts")
const schemaPath = path.join(projectRoot, "data", "ai-console", "schemas", "ai-console-training-design-v1.schema.json")
const storePath = path.join(projectRoot, ".runtime", "ai-console", "training", "training-design-registry-v1.sqlite")
const failures = []

for (const sourcePath of [storeSourcePath, serviceSourcePath, projectionSourcePath, routeSourcePath, schemaPath]) {
  if (!existsSync(sourcePath)) failures.push(`missing_file:${path.relative(projectRoot, sourcePath)}`)
}
if (failures.length === 0) {
  const productSource = [storeSourcePath, serviceSourcePath, projectionSourcePath, routeSourcePath].map((sourcePath) => readFileSync(sourcePath, "utf8")).join("\n")
  if (/ai-painter-progress|\/api\/ai-painter|(?:\.runtime|data)[\\/]ai-painter/u.test(productSource)) failures.push("legacy_source_coupling")
  for (const marker of [
    "new_ai_console_only", "ai_console_training_design_writer_v1", "ai_console_training_design_executor_v1",
    "register_model_structure", "register_training_plan", "registered_inactive", "BEGIN IMMEDIATE",
    "creation_content_blob BLOB NOT NULL", "ai_console_training_design_command_idempotency_conflict",
    "ai_console_training_design_registry", "new_ai_console_training_design_registry_only",
  ]) if (!productSource.includes(marker)) failures.push(`missing_marker:${marker}`)
  const schema = JSON.parse(readFileSync(schemaPath, "utf8"))
  if (schema.title !== "AI Console Training Design V1" || schema.oneOf?.length !== 2) failures.push("schema_contract_invalid")
  for (const definition of ["modelStructure", "trainingPlan"]) if (!schema.$defs?.[definition]) failures.push(`schema_definition_missing:${definition}`)
}

let actualModelStructureCount = null
let actualTrainingPlanCount = null
let actualRegistryRevision = null
if (!existsSync(storePath)) failures.push("training_design_store_not_initialized")
else {
  const database = new DatabaseSync(storePath, { open: true, readOnly: true })
  try {
    const integrity = database.prepare("PRAGMA integrity_check").get()
    if (!integrity || !Object.values(integrity).includes("ok")) failures.push("training_design_integrity_failed")
    const metadata = database.prepare("SELECT * FROM metadata").get()
    actualModelStructureCount = Number(database.prepare("SELECT COUNT(*) AS count FROM model_structures").get().count)
    actualTrainingPlanCount = Number(database.prepare("SELECT COUNT(*) AS count FROM training_plans").get().count)
    actualRegistryRevision = Number(metadata?.registry_revision)
    if (metadata?.source_boundary !== "new_ai_console_only" || metadata?.writer_identity !== "ai_console_training_design_writer_v1") failures.push("training_design_metadata_identity_invalid")
    if (Number(metadata?.model_structure_count) !== actualModelStructureCount || Number(metadata?.training_plan_count) !== actualTrainingPlanCount) failures.push("training_design_metadata_count_invalid")
    if (actualModelStructureCount !== 0 || actualTrainingPlanCount !== 0 || actualRegistryRevision !== 0) failures.push("actual_training_design_store_must_start_empty")
  } finally { database.close() }
}

let dynamicCommandTest = false
if (failures.length === 0) {
  const storeModule = await import(pathToFileURL(storeSourcePath).href)
  const temporaryRoot = mkdtempSync(path.join(tmpdir(), "ai-console-training-design-check-"))
  try {
    process.chdir(temporaryRoot)
    const initialized = storeModule.initializeAiConsoleTrainingDesignStore()
    if (initialized.registryRevision !== 0 || initialized.modelStructureCount !== 0 || initialized.trainingPlanCount !== 0) failures.push("temporary_store_initial_state_invalid")
    const modelInput = {
      commandType: "register_model_structure", capabilityDomain: "text_and_language", modelFamily: "model:text-transformer/v1",
      architectureDefinitionSha256: sha256("architecture"), sourceCodeSha256: sha256("source"),
      inputConditionSchemaId: "condition:text/v1", outputSchemaId: "output:text/v1", parameterCount: 125000000,
      expectedRegistryRevision: 0, idempotencyKeySha256: sha256("model-key"), reasonText: "登记新平台模型结构",
      actorIdentity: "local_console_operator", role: "operator", requestedAtUtc: "2026-08-28T02:00:00.000Z",
    }
    const createdModel = storeModule.executeAiConsoleTrainingDesignCommand(modelInput)
    const replayedModel = storeModule.executeAiConsoleTrainingDesignCommand(modelInput)
    if (createdModel.httpStatus !== 201 || !createdModel.modelStructure || replayedModel.receipt.commandId !== createdModel.receipt.commandId || !replayedModel.replayed) failures.push("model_create_or_replay_invalid")

    let idempotencyClosed = false
    try { storeModule.executeAiConsoleTrainingDesignCommand({ ...modelInput, modelFamily: "model:text-transformer/conflict" }) }
    catch (error) { idempotencyClosed = error instanceof Error && error.message === "ai_console_training_design_command_idempotency_conflict" }
    if (!idempotencyClosed) failures.push("training_design_idempotency_conflict_not_closed")

    const duplicateModel = storeModule.executeAiConsoleTrainingDesignCommand({ ...modelInput, expectedRegistryRevision: 1, idempotencyKeySha256: sha256("duplicate-model"), requestedAtUtc: "2026-08-28T02:01:00.000Z" })
    const planBase = {
      commandType: "register_training_plan", capabilityDomain: "text_and_language", modelStructureId: createdModel.modelStructure.modelStructureId,
      datasetReleaseIdentity: "dataset:text/v1", splitIdentity: "split:text/v1", randomSeed: 20260828, nativeResolution: "512x512",
      epochBudget: 24, parentTerminalRule: "terminal:parent-qualified/v1", optimizerConfigSha256: sha256("optimizer"),
      resourceProfileIdentity: "resource:cpu-safe/v1", expectedRegistryRevision: 1, idempotencyKeySha256: sha256("plan-key"),
      reasonText: "登记新平台非活动训练计划", actorIdentity: "local_console_operator", role: "operator", requestedAtUtc: "2026-08-28T02:02:00.000Z",
    }
    const missingModel = storeModule.executeAiConsoleTrainingDesignCommand({ ...planBase, modelStructureId: sha256("missing-model"), idempotencyKeySha256: sha256("missing-model-plan") })
    const domainConflict = storeModule.executeAiConsoleTrainingDesignCommand({ ...planBase, capabilityDomain: "video_generation", idempotencyKeySha256: sha256("domain-conflict") })
    const createdPlan = storeModule.executeAiConsoleTrainingDesignCommand(planBase)
    const duplicatePlan = storeModule.executeAiConsoleTrainingDesignCommand({ ...planBase, expectedRegistryRevision: 2, idempotencyKeySha256: sha256("duplicate-plan"), requestedAtUtc: "2026-08-28T02:03:00.000Z" })
    const revisionConflict = storeModule.executeAiConsoleTrainingDesignCommand({ ...modelInput, modelFamily: "model:text-transformer/v2", expectedRegistryRevision: 999, idempotencyKeySha256: sha256("revision-conflict") })
    let actorClosed = false
    try { storeModule.executeAiConsoleTrainingDesignCommand({ ...modelInput, idempotencyKeySha256: sha256("external-actor"), actorIdentity: "external_actor" }) }
    catch (error) { actorClosed = error instanceof Error && error.message === "ai_console_training_design_command_common_field_invalid" }
    if (!actorClosed) failures.push("training_design_external_actor_not_closed")

    const read = storeModule.readAiConsoleTrainingDesignStore()
    dynamicCommandTest = duplicateModel.receipt.failureCode === "ai_console_model_structure_already_registered"
      && missingModel.receipt.failureCode === "ai_console_training_plan_model_structure_not_found"
      && domainConflict.receipt.failureCode === "ai_console_training_plan_model_domain_conflict"
      && createdPlan.trainingPlan?.planStatus === "registered_inactive"
      && duplicatePlan.receipt.failureCode === "ai_console_training_plan_already_registered"
      && revisionConflict.receipt.failureCode === "ai_console_training_design_registry_revision_conflict"
      && read.status === "connected" && read.metadata.registryRevision === 2 && read.metadata.commandCount === 7
      && read.modelStructures.length === 1 && read.trainingPlans.length === 1 && read.events.length === 2
    if (!dynamicCommandTest) failures.push("training_design_dynamic_command_test_invalid")
  } finally {
    process.chdir(projectRoot)
    const resolved = path.resolve(temporaryRoot)
    if (resolved.startsWith(path.resolve(tmpdir()) + path.sep)) rmSync(resolved, { recursive: true, force: true })
  }
}

console.log(JSON.stringify({ ok: failures.length === 0, registryIdentity: "ai_console_training_design_registry", actualModelStructureCount, actualTrainingPlanCount, actualRegistryRevision, dynamicCommandTest, failures }, null, 2))
if (failures.length > 0) process.exitCode = 1

function sha256(value) { return createHash("sha256").update(value, "utf8").digest("hex") }
