import { createHash } from "node:crypto"
import { mkdir, readFile, writeFile } from "node:fs/promises"
import path from "node:path"
import { readAiConsoleRegistryWorkspace } from "@/server/ai-console/registry-store"
import { ensureAiConsoleControlReceiptEvent, type AiConsoleControlEvent } from "./control-event-ledger"
import { ensureAiConsoleControlTransaction, type AiConsoleControlTransaction } from "./control-transaction-store"
import {
  ensureAiConsoleFormalEvidenceRegistration,
  type AiConsoleFormalEvidenceRecord,
  type AiConsoleFormalEvidenceRegistration,
} from "./formal-evidence-index"
import type { VerifiedOperatorSession } from "./operator-session"

const receiptDirectoryLogicalPath = ".runtime/ai-console/control/command-receipts"
const supportedCommandType = "verify_primary_registry"

export type AiConsoleControlCommandReceipt = {
  schemaVersion: "ai_console_control_command_receipt_v1"
  commandId: string
  commandType: typeof supportedCommandType
  targetType: "primary_registry"
  targetId: "ai_console_primary_registry"
  actorIdentity: "local_console_operator"
  role: "operator"
  requestedAtUtc: string
  reasonText: string
  expectedRegistryRevision: number
  idempotencyKeySha256: string
  validationStatus: "accepted" | "rejected"
  executionStatus: "succeeded" | "rejected" | "failed_closed"
  executorIdentity: "ai_console_primary_registry_verifier_v1"
  finishedAtUtc: string
  resultTerminalId: "registry_verified" | "registry_revision_conflict" | "registry_verification_failed"
  resultEvidencePath: string | null
  resultEvidenceSha256: string | null
  failureCode: string | null
  receiptSha256: string
}

export type ExecuteControlCommandResult = {
  receipt: AiConsoleControlCommandReceipt
  event: AiConsoleControlEvent
  transaction: AiConsoleControlTransaction
  evidenceRegistration: AiConsoleFormalEvidenceRegistration
  evidenceRecords: readonly AiConsoleFormalEvidenceRecord[]
  replayed: boolean
  httpStatus: 200 | 201 | 409 | 503
}

type VerifyRegistryCommandInput = {
  commandType: typeof supportedCommandType
  targetType: "primary_registry"
  targetId: "ai_console_primary_registry"
  expectedRegistryRevision: number
  idempotencyKey: string
  reasonText: string
}

export function parseVerifyRegistryCommandInput(value: unknown):
  | { ok: true; input: VerifyRegistryCommandInput }
  | { ok: false; errorCode: string } {
  if (!isPlainRecord(value)) return { ok: false, errorCode: "control_command_body_invalid" }
  const allowedFields = new Set(["commandType", "targetType", "targetId", "expectedRegistryRevision", "idempotencyKey", "reasonText"])
  if (Object.keys(value).some((field) => !allowedFields.has(field))) {
    return { ok: false, errorCode: "control_command_field_not_allowed" }
  }
  if (value.commandType !== supportedCommandType) return { ok: false, errorCode: "control_command_type_not_allowed" }
  if (value.targetType !== "primary_registry" || value.targetId !== "ai_console_primary_registry") {
    return { ok: false, errorCode: "control_command_target_not_allowed" }
  }
  if (!Number.isInteger(value.expectedRegistryRevision) || Number(value.expectedRegistryRevision) < 1) {
    return { ok: false, errorCode: "control_command_expected_revision_invalid" }
  }
  if (typeof value.idempotencyKey !== "string" || !/^[A-Za-z0-9_-]{16,128}$/u.test(value.idempotencyKey)) {
    return { ok: false, errorCode: "control_command_idempotency_key_invalid" }
  }
  if (typeof value.reasonText !== "string" || value.reasonText.trim().length < 4 || value.reasonText.trim().length > 240 || /[\u0000-\u001f\u007f]/u.test(value.reasonText)) {
    return { ok: false, errorCode: "control_command_reason_invalid" }
  }

  return {
    ok: true,
    input: {
      commandType: value.commandType,
      targetType: value.targetType,
      targetId: value.targetId,
      expectedRegistryRevision: Number(value.expectedRegistryRevision),
      idempotencyKey: value.idempotencyKey,
      reasonText: value.reasonText.trim(),
    },
  }
}

export async function executeVerifyPrimaryRegistryCommand(
  input: VerifyRegistryCommandInput,
  session: VerifiedOperatorSession,
): Promise<ExecuteControlCommandResult> {
  const idempotencyKeySha256 = sha256(input.idempotencyKey)
  const commandId = sha256(`${session.actorIdentity}\n${input.commandType}\n${idempotencyKeySha256}`)
  const existingReceipt = await readAiConsoleControlCommandReceipt(commandId)
  if (existingReceipt) {
    const event = await ensureAiConsoleControlReceiptEvent(existingReceipt)
    const transaction = await ensureAiConsoleControlTransaction(existingReceipt, event)
    const evidence = await ensureAiConsoleFormalEvidenceRegistration(existingReceipt, transaction)
    return { receipt: existingReceipt, event, transaction, evidenceRegistration: evidence.registration, evidenceRecords: evidence.records, replayed: true, httpStatus: 200 }
  }

  const requestedAtUtc = new Date().toISOString()
  const registryRead = await readAiConsoleRegistryWorkspace("training/overview")
  let receipt: Omit<AiConsoleControlCommandReceipt, "receiptSha256">
  let httpStatus: ExecuteControlCommandResult["httpStatus"]

  if (registryRead.status !== "connected") {
    receipt = createReceiptBase(input, session, commandId, idempotencyKeySha256, requestedAtUtc, {
      validationStatus: "accepted",
      executionStatus: "failed_closed",
      resultTerminalId: "registry_verification_failed",
      resultEvidencePath: null,
      resultEvidenceSha256: null,
      failureCode: registryRead.reasonCode,
    })
    httpStatus = 503
  } else if (registryRead.registryRevision !== input.expectedRegistryRevision) {
    receipt = createReceiptBase(input, session, commandId, idempotencyKeySha256, requestedAtUtc, {
      validationStatus: "rejected",
      executionStatus: "rejected",
      resultTerminalId: "registry_revision_conflict",
      resultEvidencePath: null,
      resultEvidenceSha256: null,
      failureCode: "expected_registry_revision_conflict",
    })
    httpStatus = 409
  } else {
    receipt = createReceiptBase(input, session, commandId, idempotencyKeySha256, requestedAtUtc, {
      validationStatus: "accepted",
      executionStatus: "succeeded",
      resultTerminalId: "registry_verified",
      resultEvidencePath: "data/ai-console/registry/primary-registry-v1.json",
      resultEvidenceSha256: registryRead.registrySha256,
      failureCode: null,
    })
    httpStatus = 201
  }

  const persistedReceipt = await persistReceipt(receipt)
  const event = await ensureAiConsoleControlReceiptEvent(persistedReceipt)
  const transaction = await ensureAiConsoleControlTransaction(persistedReceipt, event)
  const evidence = await ensureAiConsoleFormalEvidenceRegistration(persistedReceipt, transaction)
  return { receipt: persistedReceipt, event, transaction, evidenceRegistration: evidence.registration, evidenceRecords: evidence.records, replayed: false, httpStatus }
}

export async function readAiConsoleControlCommandReceipt(commandId: string): Promise<AiConsoleControlCommandReceipt | null> {
  if (!/^[a-f0-9]{64}$/u.test(commandId)) return null
  const receiptPath = getReceiptAbsolutePath(commandId)
  let rawReceipt: string
  try {
    rawReceipt = await readFile(receiptPath, "utf8")
  } catch (error) {
    if (isPlainRecord(error) && error.code === "ENOENT") return null
    throw error
  }

  const parsedReceipt = JSON.parse(rawReceipt) as unknown
  if (!isAiConsoleControlCommandReceipt(parsedReceipt, commandId)) {
    throw new Error("ai_console_control_receipt_invalid")
  }
  const { receiptSha256, ...unsignedReceipt } = parsedReceipt
  if (sha256(JSON.stringify(unsignedReceipt)) !== receiptSha256) {
    throw new Error("ai_console_control_receipt_sha256_mismatch")
  }
  return parsedReceipt as AiConsoleControlCommandReceipt
}

function createReceiptBase(
  input: VerifyRegistryCommandInput,
  session: VerifiedOperatorSession,
  commandId: string,
  idempotencyKeySha256: string,
  requestedAtUtc: string,
  result: Pick<AiConsoleControlCommandReceipt, "validationStatus" | "executionStatus" | "resultTerminalId" | "resultEvidencePath" | "resultEvidenceSha256" | "failureCode">,
): Omit<AiConsoleControlCommandReceipt, "receiptSha256"> {
  return {
    schemaVersion: "ai_console_control_command_receipt_v1",
    commandId,
    commandType: input.commandType,
    targetType: input.targetType,
    targetId: input.targetId,
    actorIdentity: session.actorIdentity,
    role: session.role,
    requestedAtUtc,
    reasonText: input.reasonText,
    expectedRegistryRevision: input.expectedRegistryRevision,
    idempotencyKeySha256,
    ...result,
    executorIdentity: "ai_console_primary_registry_verifier_v1",
    finishedAtUtc: new Date().toISOString(),
  }
}

async function persistReceipt(
  receipt: Omit<AiConsoleControlCommandReceipt, "receiptSha256">,
): Promise<AiConsoleControlCommandReceipt> {
  const persistedReceipt: AiConsoleControlCommandReceipt = {
    ...receipt,
    receiptSha256: sha256(JSON.stringify(receipt)),
  }
  const receiptDirectory = path.join(process.cwd(), ...receiptDirectoryLogicalPath.split("/"))
  await mkdir(receiptDirectory, { recursive: true })
  try {
    await writeFile(getReceiptAbsolutePath(receipt.commandId), `${JSON.stringify(persistedReceipt, null, 2)}\n`, { encoding: "utf8", flag: "wx" })
    const verifiedReceipt = await readAiConsoleControlCommandReceipt(receipt.commandId)
    if (!verifiedReceipt) throw new Error("ai_console_control_receipt_post_write_verification_failed")
    return verifiedReceipt
  } catch (error) {
    if (isPlainRecord(error) && error.code === "EEXIST") {
      const existingReceipt = await readAiConsoleControlCommandReceipt(receipt.commandId)
      if (existingReceipt) return existingReceipt
    }
    throw error
  }
}

function getReceiptAbsolutePath(commandId: string): string {
  return path.join(process.cwd(), ...receiptDirectoryLogicalPath.split("/"), `${commandId}.json`)
}

function sha256(value: string): string {
  return createHash("sha256").update(value, "utf8").digest("hex")
}

function isPlainRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value)
}

function isAiConsoleControlCommandReceipt(value: unknown, commandId: string): value is AiConsoleControlCommandReceipt {
  if (!isPlainRecord(value)) return false
  const requiredFields = [
    "schemaVersion", "commandId", "commandType", "targetType", "targetId", "actorIdentity", "role",
    "requestedAtUtc", "reasonText", "expectedRegistryRevision", "idempotencyKeySha256", "validationStatus",
    "executionStatus", "executorIdentity", "finishedAtUtc", "resultTerminalId", "resultEvidencePath",
    "resultEvidenceSha256", "failureCode", "receiptSha256",
  ]
  if (Object.keys(value).length !== requiredFields.length || requiredFields.some((field) => !(field in value))) return false
  if (value.schemaVersion !== "ai_console_control_command_receipt_v1" || value.commandId !== commandId) return false
  if (value.commandType !== supportedCommandType || value.targetType !== "primary_registry" || value.targetId !== "ai_console_primary_registry") return false
  if (value.actorIdentity !== "local_console_operator" || value.role !== "operator") return false
  if (value.executorIdentity !== "ai_console_primary_registry_verifier_v1") return false
  if (typeof value.reasonText !== "string" || value.reasonText.length < 4 || value.reasonText.length > 240) return false
  if (!Number.isInteger(value.expectedRegistryRevision) || Number(value.expectedRegistryRevision) < 1) return false
  if (typeof value.requestedAtUtc !== "string" || typeof value.finishedAtUtc !== "string") return false
  if (Number.isNaN(Date.parse(value.requestedAtUtc)) || Number.isNaN(Date.parse(value.finishedAtUtc))) return false
  if (typeof value.idempotencyKeySha256 !== "string" || !/^[a-f0-9]{64}$/u.test(value.idempotencyKeySha256)) return false
  if (typeof value.receiptSha256 !== "string" || !/^[a-f0-9]{64}$/u.test(value.receiptSha256)) return false

  if (value.resultTerminalId === "registry_verified") {
    return value.validationStatus === "accepted" && value.executionStatus === "succeeded"
      && value.resultEvidencePath === "data/ai-console/registry/primary-registry-v1.json"
      && typeof value.resultEvidenceSha256 === "string" && /^[a-f0-9]{64}$/u.test(value.resultEvidenceSha256)
      && value.failureCode === null
  }
  if (value.resultTerminalId === "registry_revision_conflict") {
    return value.validationStatus === "rejected" && value.executionStatus === "rejected"
      && value.resultEvidencePath === null && value.resultEvidenceSha256 === null
      && value.failureCode === "expected_registry_revision_conflict"
  }
  return value.resultTerminalId === "registry_verification_failed"
    && value.validationStatus === "accepted" && value.executionStatus === "failed_closed"
    && value.resultEvidencePath === null && value.resultEvidenceSha256 === null
    && typeof value.failureCode === "string" && value.failureCode.length > 0
}
