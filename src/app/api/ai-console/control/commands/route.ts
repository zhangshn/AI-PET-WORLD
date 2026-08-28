import { executeVerifyPrimaryRegistryCommand, parseVerifyRegistryCommandInput, readAiConsoleControlCommandReceipt } from "@/server/ai-console-control/control-command-service"
import { controlEventLedgerLogicalPath, readAiConsoleControlEventLedger } from "@/server/ai-console-control/control-event-ledger"
import { controlTransactionStoreLogicalPath, readAiConsoleControlTransactionStore } from "@/server/ai-console-control/control-transaction-store"
import { formalEvidenceIndexLogicalPath, readAiConsoleFormalEvidenceIndex } from "@/server/ai-console-control/formal-evidence-index"
import { verifyLocalControlRead, verifyLocalOperatorMutation } from "@/server/ai-console-control/operator-session"
import { readAiConsoleRegistryWorkspace } from "@/server/ai-console/registry-store"

export const dynamic = "force-dynamic"

export async function GET(request: Request) {
  const localRead = verifyLocalControlRead(request)
  if (!localRead.ok) return commandError(localRead.errorCode, localRead.status)
  const commandId = new URL(request.url).searchParams.get("commandId")
  if (!commandId) {
    const registryRead = await readAiConsoleRegistryWorkspace("training/overview")
    return Response.json({
      ok: true,
      schemaVersion: "ai_console_control_command_service_v1",
      serviceStatus: registryRead.status === "connected" ? "ready" : "failed_closed",
      supportedCommandTypes: ["verify_primary_registry"],
      executorIdentity: "ai_console_primary_registry_verifier_v1",
      executionBoundary: "new_ai_console_registry_only",
      currentRegistryRevision: registryRead.status === "connected" ? registryRead.registryRevision : null,
      failureCode: registryRead.status === "connected" ? null : registryRead.reasonCode,
    }, { headers: { "Cache-Control": "no-store" } })
  }
  if (!/^[a-f0-9]{64}$/u.test(commandId)) {
    return commandError("control_command_identity_invalid", 400)
  }
  try {
    const receipt = await readAiConsoleControlCommandReceipt(commandId)
    if (!receipt) return commandError("control_command_receipt_not_found", 404)
    const ledger = await readAiConsoleControlEventLedger()
    const transactionStore = await readAiConsoleControlTransactionStore()
    const evidenceIndex = await readAiConsoleFormalEvidenceIndex()
    const eventBinding = ledger.status === "connected"
      ? ledger.events.find((event) => event.commandId === receipt.commandId) ?? null
      : null
    return Response.json({
      ok: true,
      schemaVersion: "ai_console_control_command_service_v1",
      integrityStatus: "verified",
      receiptLogicalPath: `.runtime/ai-console/control/command-receipts/${receipt.commandId}.json`,
      eventLedgerStatus: ledger.status,
      eventLedgerLogicalPath: controlEventLedgerLogicalPath,
      eventBinding,
      transactionStoreStatus: transactionStore.status,
      transactionStoreLogicalPath: controlTransactionStoreLogicalPath,
      transactionBinding: transactionStore.status === "connected"
        ? transactionStore.records.find((transaction) => transaction.commandId === receipt.commandId) ?? null
        : null,
      evidenceIndexStatus: evidenceIndex.status,
      evidenceIndexLogicalPath: formalEvidenceIndexLogicalPath,
      evidenceRegistration: evidenceIndex.status === "connected"
        ? evidenceIndex.registrations.find((registration) => registration.commandId === receipt.commandId) ?? null
        : null,
      receipt,
    }, { headers: { "Cache-Control": "no-store" } })
  } catch {
    return commandError("control_command_receipt_integrity_failure", 409)
  }
}

export async function POST(request: Request) {
  const verification = verifyLocalOperatorMutation(request)
  if (!verification.ok) return commandError(verification.errorCode, verification.status)

  const contentLength = Number(request.headers.get("content-length") ?? "0")
  if (!Number.isFinite(contentLength) || contentLength > 4096) return commandError("control_command_body_too_large", 413)
  const rawBody = await request.text()
  if (rawBody.length > 4096) return commandError("control_command_body_too_large", 413)

  let parsedBody: unknown
  try {
    parsedBody = JSON.parse(rawBody)
  } catch {
    return commandError("control_command_body_invalid_json", 400)
  }
  const parsedInput = parseVerifyRegistryCommandInput(parsedBody)
  if (!parsedInput.ok) return commandError(parsedInput.errorCode, 400)

  try {
    const result = await executeVerifyPrimaryRegistryCommand(parsedInput.input, verification.session)
    return Response.json({
      ok: result.receipt.executionStatus === "succeeded",
      schemaVersion: "ai_console_control_command_service_v1",
      replayed: result.replayed,
      integrityStatus: "verified",
      receiptLogicalPath: `.runtime/ai-console/control/command-receipts/${result.receipt.commandId}.json`,
      eventLedgerStatus: "connected",
      eventLedgerLogicalPath: controlEventLedgerLogicalPath,
      eventBinding: result.event,
      transactionStoreStatus: "connected",
      transactionStoreLogicalPath: controlTransactionStoreLogicalPath,
      transactionBinding: result.transaction,
      evidenceIndexStatus: "connected",
      evidenceIndexLogicalPath: formalEvidenceIndexLogicalPath,
      evidenceRegistration: result.evidenceRegistration,
      evidenceRecordSet: result.evidenceRecords,
      receipt: result.receipt,
    }, { status: result.httpStatus, headers: { "Cache-Control": "no-store" } })
  } catch {
    return commandError("control_command_receipt_write_failed", 500)
  }
}

function commandError(errorCode: string, status: number) {
  return Response.json({
    ok: false,
    schemaVersion: "ai_console_control_command_service_v1",
    errorCode,
  }, { status, headers: { "Cache-Control": "no-store" } })
}
