import { executeAiConsoleTrainingDesignRegistryCommand, parseAiConsoleTrainingDesignCommandInput } from "@/server/ai-console-control/training-design-command-service"
import { readAiConsoleTrainingDesignStore, trainingDesignStoreLogicalPath } from "@/server/ai-console-control/training-design-store"
import { verifyLocalControlRead, verifyLocalOperatorMutation } from "@/server/ai-console-control/operator-session"

export const dynamic = "force-dynamic"

export function GET(request: Request) {
  const localRead = verifyLocalControlRead(request)
  if (!localRead.ok) return trainingDesignError(localRead.errorCode, localRead.status)
  const store = readAiConsoleTrainingDesignStore()
  if (store.status !== "connected") return trainingDesignError(store.reasonCode, store.status === "not_connected" ? 503 : 409)
  return Response.json({
    ok: true,
    schemaVersion: "ai_console_training_design_command_service_v1",
    serviceStatus: "ready",
    executorIdentity: "ai_console_training_design_executor_v1",
    executionBoundary: "new_ai_console_training_design_registry_only",
    supportedCommandTypes: ["register_model_structure", "register_training_plan"],
    registryRevision: store.metadata.registryRevision,
    storeRevision: store.metadata.storeRevision,
    modelStructureCount: store.metadata.modelStructureCount,
    trainingPlanCount: store.metadata.trainingPlanCount,
    modelStructures: store.modelStructures.map((model) => ({
      modelStructureId: model.modelStructureId,
      capabilityDomain: model.capabilityDomain,
      modelFamily: model.modelFamily,
      parameterCount: model.parameterCount,
      modelStructureStatus: model.modelStructureStatus,
    })),
    trainingPlans: store.trainingPlans.map((plan) => ({
      trainingPlanId: plan.trainingPlanId,
      capabilityDomain: plan.capabilityDomain,
      modelStructureId: plan.modelStructureId,
      datasetReleaseIdentity: plan.datasetReleaseIdentity,
      planStatus: plan.planStatus,
    })),
    storeLogicalPath: trainingDesignStoreLogicalPath,
  }, { headers: { "Cache-Control": "no-store" } })
}

export async function POST(request: Request) {
  const verification = verifyLocalOperatorMutation(request)
  if (!verification.ok) return trainingDesignError(verification.errorCode, verification.status)
  const contentLength = Number(request.headers.get("content-length") ?? "0")
  if (!Number.isFinite(contentLength) || contentLength > 12288) return trainingDesignError("training_design_command_body_too_large", 413)
  const rawBody = await request.text()
  if (rawBody.length > 12288) return trainingDesignError("training_design_command_body_too_large", 413)
  let parsed: unknown
  try { parsed = JSON.parse(rawBody) } catch { return trainingDesignError("training_design_command_body_invalid_json", 400) }
  const parsedInput = parseAiConsoleTrainingDesignCommandInput(parsed)
  if (!parsedInput.ok) return trainingDesignError(parsedInput.errorCode, 400)
  try {
    const result = executeAiConsoleTrainingDesignRegistryCommand(parsedInput.input, verification.session)
    return Response.json({
      ok: result.receipt.executionStatus === "succeeded",
      schemaVersion: "ai_console_training_design_command_service_v1",
      replayed: result.replayed,
      integrityStatus: "verified",
      storeLogicalPath: trainingDesignStoreLogicalPath,
      receipt: result.receipt,
      modelStructure: result.modelStructure,
      trainingPlan: result.trainingPlan,
      event: result.event,
    }, { status: result.httpStatus, headers: { "Cache-Control": "no-store" } })
  } catch (error) {
    const errorCode = error instanceof Error ? error.message : "ai_console_training_design_command_failed"
    return trainingDesignError(errorCode, errorCode === "ai_console_training_design_command_idempotency_conflict" ? 409 : 500)
  }
}

function trainingDesignError(errorCode: string, status: number) {
  return Response.json({ ok: false, schemaVersion: "ai_console_training_design_command_service_v1", errorCode }, { status, headers: { "Cache-Control": "no-store" } })
}
