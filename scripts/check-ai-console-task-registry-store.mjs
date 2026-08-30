import { createHash } from "node:crypto"
import { existsSync, mkdtempSync, readFileSync, rmSync } from "node:fs"
import { tmpdir } from "node:os"
import path from "node:path"
import { pathToFileURL } from "node:url"
import { DatabaseSync } from "node:sqlite"

const projectRoot = process.cwd()
const storeSourcePath = path.join(projectRoot, "src", "server", "ai-console-control", "task-registry-store.ts")
const serviceSourcePath = path.join(projectRoot, "src", "server", "ai-console-control", "task-command-service.ts")
const projectionSourcePath = path.join(projectRoot, "src", "server", "ai-console", "task-projection.ts")
const routeSourcePath = path.join(projectRoot, "src", "app", "api", "ai-console", "control", "tasks", "route.ts")
const schemaPath = path.join(projectRoot, "data", "ai-console", "schemas", "ai-console-task-registry-v1.schema.json")
const storePath = path.join(projectRoot, ".runtime", "ai-console", "tasks", "task-registry-v1.sqlite")
const failures = []

for (const sourcePath of [storeSourcePath, serviceSourcePath, projectionSourcePath, routeSourcePath, schemaPath]) {
  if (!existsSync(sourcePath)) failures.push(`missing_file:${path.relative(projectRoot, sourcePath)}`)
}
if (failures.length === 0) {
  const productSource = [storeSourcePath, serviceSourcePath, projectionSourcePath, routeSourcePath].map((sourcePath) => readFileSync(sourcePath, "utf8")).join("\n")
  if (/ai-painter-progress|\/api\/ai-painter|(?:\.runtime|data)[\\/]ai-painter/u.test(productSource)) failures.push("legacy_source_coupling")
  for (const marker of [
    "new_ai_console_only", "ai_console_task_registry_writer_v1", "ai_console_task_registry_executor_v1",
    "create_registered_task", "set_queued_task_priority", "cancel_unstarted_task", "BEGIN IMMEDIATE",
    "creation_content_blob BLOB NOT NULL", "ai_console_task_command_idempotency_conflict",
    "queryTaskRegistryProjection", "new_ai_console_task_registry_only",
  ]) if (!productSource.includes(marker)) failures.push(`missing_marker:${marker}`)
  const schema = JSON.parse(readFileSync(schemaPath, "utf8"))
  if (schema.title !== "AI Console Task Registry Task V1" || schema.additionalProperties !== false) failures.push("schema_contract_invalid")
  for (const field of ["taskId", "taskGoal", "capabilityDomain", "lifecycleStatus", "taskRecordSha256"]) if (!schema.required?.includes(field)) failures.push(`schema_field_missing:${field}`)
}

let actualTaskCount = null
let actualRegistryRevision = null
if (!existsSync(storePath)) failures.push("task_registry_store_not_initialized")
else {
  const database = new DatabaseSync(storePath, { open: true, readOnly: true })
  try {
    const integrity = database.prepare("PRAGMA integrity_check").get()
    if (!integrity || !Object.values(integrity).includes("ok")) failures.push("task_registry_integrity_failed")
    const metadata = database.prepare("SELECT * FROM metadata").get()
    actualTaskCount = Number(database.prepare("SELECT COUNT(*) AS count FROM tasks").get().count)
    actualRegistryRevision = Number(metadata?.registry_revision)
    if (metadata?.source_boundary !== "new_ai_console_only" || metadata?.writer_identity !== "ai_console_task_registry_writer_v1") failures.push("task_registry_metadata_identity_invalid")
    if (Number(metadata?.task_count) !== actualTaskCount) failures.push("task_registry_metadata_task_count_invalid")
  } finally { database.close() }
}

let dynamicCommandTest = false
if (failures.length === 0) {
  const storeModule = await import(pathToFileURL(storeSourcePath).href)
  const temporaryRoot = mkdtempSync(path.join(tmpdir(), "ai-console-task-registry-check-"))
  try {
    process.chdir(temporaryRoot)
    const initialized = storeModule.initializeAiConsoleTaskRegistryStore()
    if (initialized.registryRevision !== 0 || initialized.taskCount !== 0) failures.push("temporary_store_initial_state_invalid")
    const common = {
      expectedRegistryRevision: 0,
      idempotencyKeySha256: sha256("create-key"),
      reasonText: "登记新平台独立任务",
      actorIdentity: "local_console_operator",
      role: "operator",
      requestedAtUtc: "2026-08-28T00:00:00.000Z",
    }
    const createInput = { ...common, commandType: "create_registered_task", taskGoal: "验证新平台任务登记、优先级与取消状态机。", capabilityDomain: "text_and_language", priority: 5 }
    const created = storeModule.executeAiConsoleTaskRegistryCommand(createInput)
    const replayed = storeModule.executeAiConsoleTaskRegistryCommand(createInput)
    if (created.httpStatus !== 201 || !created.task || replayed.receipt.commandId !== created.receipt.commandId || !replayed.replayed) failures.push("task_create_or_replay_invalid")

    let idempotencyClosed = false
    try { storeModule.executeAiConsoleTaskRegistryCommand({ ...createInput, taskGoal: `${createInput.taskGoal}冲突` }) }
    catch (error) { idempotencyClosed = error instanceof Error && error.message === "ai_console_task_command_idempotency_conflict" }
    if (!idempotencyClosed) failures.push("task_idempotency_conflict_not_closed")

    const prioritized = storeModule.executeAiConsoleTaskRegistryCommand({
      commandType: "set_queued_task_priority", taskId: created.task.taskId, priority: 8, expectedRegistryRevision: 1,
      idempotencyKeySha256: sha256("priority-key"), reasonText: "提高新平台排队任务优先级", actorIdentity: "local_console_operator", role: "operator", requestedAtUtc: "2026-08-28T00:01:00.000Z",
    })
    const cancelled = storeModule.executeAiConsoleTaskRegistryCommand({
      commandType: "cancel_unstarted_task", taskId: created.task.taskId, expectedRegistryRevision: 2,
      idempotencyKeySha256: sha256("cancel-key"), reasonText: "取消尚未启动的新平台任务", actorIdentity: "local_console_operator", role: "operator", requestedAtUtc: "2026-08-28T00:02:00.000Z",
    })
    const stateRejected = storeModule.executeAiConsoleTaskRegistryCommand({
      commandType: "set_queued_task_priority", taskId: created.task.taskId, priority: 3, expectedRegistryRevision: 3,
      idempotencyKeySha256: sha256("state-key"), reasonText: "验证终态任务不能调整优先级", actorIdentity: "local_console_operator", role: "operator", requestedAtUtc: "2026-08-28T00:03:00.000Z",
    })
    const revisionRejected = storeModule.executeAiConsoleTaskRegistryCommand({
      commandType: "cancel_unstarted_task", taskId: created.task.taskId, expectedRegistryRevision: 2,
      idempotencyKeySha256: sha256("revision-key"), reasonText: "验证登记修订冲突失败关闭", actorIdentity: "local_console_operator", role: "operator", requestedAtUtc: "2026-08-28T00:04:00.000Z",
    })
    let actorClosed = false
    try { storeModule.executeAiConsoleTaskRegistryCommand({ ...createInput, idempotencyKeySha256: sha256("actor-key"), actorIdentity: "external_actor" }) }
    catch (error) { actorClosed = error instanceof Error && error.message === "ai_console_task_command_actor_invalid" }
    if (!actorClosed) failures.push("task_external_actor_not_closed")

    const read = storeModule.readAiConsoleTaskRegistryStore()
    dynamicCommandTest = prioritized.receipt.resultTerminalId === "task_priority_updated"
      && cancelled.receipt.resultTerminalId === "task_cancelled"
      && stateRejected.receipt.failureCode === "ai_console_task_not_queued"
      && revisionRejected.receipt.failureCode === "ai_console_task_registry_revision_conflict"
      && read.status === "connected" && read.metadata.registryRevision === 3 && read.metadata.commandCount === 5
      && read.tasks.length === 1 && read.tasks[0].lifecycleStatus === "cancelled" && read.tasks[0].taskRevision === 3
      && read.events.length === 3
    if (!dynamicCommandTest) failures.push("task_registry_dynamic_command_test_invalid")
  } finally {
    process.chdir(projectRoot)
    const resolved = path.resolve(temporaryRoot)
    if (resolved.startsWith(path.resolve(tmpdir()) + path.sep)) rmSync(resolved, { recursive: true, force: true })
  }
}

console.log(JSON.stringify({ ok: failures.length === 0, registryIdentity: "ai_console_task_registry", actualTaskCount, actualRegistryRevision, dynamicCommandTest, failures }, null, 2))
if (failures.length > 0) process.exitCode = 1

function sha256(value) { return createHash("sha256").update(value, "utf8").digest("hex") }
