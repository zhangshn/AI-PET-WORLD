import { executeAiConsoleTaskCommand, parseAiConsoleTaskCommandInput } from "@/server/ai-console-control/task-command-service"
import { readAiConsoleTaskRegistryStore, taskRegistryStoreLogicalPath } from "@/server/ai-console-control/task-registry-store"
import { verifyLocalControlRead, verifyLocalOperatorMutation } from "@/server/ai-console-control/operator-session"

export const dynamic = "force-dynamic"

export function GET(request: Request) {
  const localRead = verifyLocalControlRead(request)
  if (!localRead.ok) return taskCommandError(localRead.errorCode, localRead.status)
  const storeRead = readAiConsoleTaskRegistryStore()
  if (storeRead.status !== "connected") return taskCommandError(storeRead.reasonCode, storeRead.status === "not_connected" ? 503 : 409)
  return Response.json({
    ok: true,
    schemaVersion: "ai_console_task_command_service_v1",
    serviceStatus: "ready",
    executorIdentity: "ai_console_task_registry_executor_v1",
    executionBoundary: "new_ai_console_task_registry_only",
    supportedCommandTypes: ["create_registered_task", "set_queued_task_priority", "cancel_unstarted_task"],
    registryRevision: storeRead.metadata.registryRevision,
    storeRevision: storeRead.metadata.storeRevision,
    taskCount: storeRead.metadata.taskCount,
    queuedTasks: storeRead.tasks.filter((task) => task.lifecycleStatus === "queued").map((task) => ({
      taskId: task.taskId,
      taskGoal: task.taskGoal,
      capabilityDomain: task.capabilityDomain,
      priority: task.priority,
      taskRevision: task.taskRevision,
      queuedAtUtc: task.queuedAtUtc,
    })),
    storeLogicalPath: taskRegistryStoreLogicalPath,
  }, { headers: { "Cache-Control": "no-store" } })
}

export async function POST(request: Request) {
  const verification = verifyLocalOperatorMutation(request)
  if (!verification.ok) return taskCommandError(verification.errorCode, verification.status)
  const contentLength = Number(request.headers.get("content-length") ?? "0")
  if (!Number.isFinite(contentLength) || contentLength > 8192) return taskCommandError("task_command_body_too_large", 413)
  const rawBody = await request.text()
  if (rawBody.length > 8192) return taskCommandError("task_command_body_too_large", 413)
  let parsed: unknown
  try { parsed = JSON.parse(rawBody) } catch { return taskCommandError("task_command_body_invalid_json", 400) }
  const parsedInput = parseAiConsoleTaskCommandInput(parsed)
  if (!parsedInput.ok) return taskCommandError(parsedInput.errorCode, 400)
  try {
    const result = executeAiConsoleTaskCommand(parsedInput.input, verification.session)
    return Response.json({
      ok: result.receipt.executionStatus === "succeeded",
      schemaVersion: "ai_console_task_command_service_v1",
      replayed: result.replayed,
      integrityStatus: "verified",
      storeLogicalPath: taskRegistryStoreLogicalPath,
      receipt: result.receipt,
      task: result.task,
      event: result.event,
    }, { status: result.httpStatus, headers: { "Cache-Control": "no-store" } })
  } catch (error) {
    const errorCode = error instanceof Error ? error.message : "ai_console_task_command_failed"
    return taskCommandError(errorCode, errorCode === "ai_console_task_command_idempotency_conflict" ? 409 : 500)
  }
}

function taskCommandError(errorCode: string, status: number) {
  return Response.json({ ok: false, schemaVersion: "ai_console_task_command_service_v1", errorCode }, { status, headers: { "Cache-Control": "no-store" } })
}
