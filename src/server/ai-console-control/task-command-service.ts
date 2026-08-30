import { createHash } from "node:crypto"
import type { VerifiedOperatorSession } from "./operator-session"
import {
  executeAiConsoleTaskRegistryCommand,
  type AiConsoleTaskRegistryCapabilityDomain,
  type AiConsoleTaskRegistryCommandInput,
  type AiConsoleTaskRegistryCommandResult,
} from "./task-registry-store"

const capabilityDomains = [
  "visual_world_generation",
  "text_and_language",
  "speech_and_audio",
  "video_generation",
  "multimodal_orchestration",
] as const
const supportedCommandTypes = ["create_registered_task", "set_queued_task_priority", "cancel_unstarted_task"] as const

type ParsedTaskCommand =
  | {
      commandType: "create_registered_task"
      taskGoal: string
      capabilityDomain: AiConsoleTaskRegistryCapabilityDomain
      priority: number
      expectedRegistryRevision: number
      idempotencyKey: string
      reasonText: string
    }
  | {
      commandType: "set_queued_task_priority"
      taskId: string
      priority: number
      expectedRegistryRevision: number
      idempotencyKey: string
      reasonText: string
    }
  | {
      commandType: "cancel_unstarted_task"
      taskId: string
      expectedRegistryRevision: number
      idempotencyKey: string
      reasonText: string
    }

export function parseAiConsoleTaskCommandInput(value: unknown):
  | { ok: true; input: ParsedTaskCommand }
  | { ok: false; errorCode: string } {
  if (!isPlainRecord(value)) return { ok: false, errorCode: "task_command_body_invalid" }
  if (!supportedCommandTypes.includes(value.commandType as (typeof supportedCommandTypes)[number])) return { ok: false, errorCode: "task_command_type_not_allowed" }
  const commonFields = ["commandType", "expectedRegistryRevision", "idempotencyKey", "reasonText"]
  const specificFields = value.commandType === "create_registered_task" ? ["taskGoal", "capabilityDomain", "priority"] : value.commandType === "set_queued_task_priority" ? ["taskId", "priority"] : ["taskId"]
  if (JSON.stringify(Object.keys(value).sort()) !== JSON.stringify([...commonFields, ...specificFields].sort())) return { ok: false, errorCode: "task_command_field_set_invalid" }
  if (!Number.isInteger(value.expectedRegistryRevision) || Number(value.expectedRegistryRevision) < 0) return { ok: false, errorCode: "task_command_expected_revision_invalid" }
  if (typeof value.idempotencyKey !== "string" || !/^[A-Za-z0-9_-]{16,128}$/u.test(value.idempotencyKey)) return { ok: false, errorCode: "task_command_idempotency_key_invalid" }
  if (!isBoundedText(value.reasonText, 4, 240)) return { ok: false, errorCode: "task_command_reason_invalid" }

  const base = {
    expectedRegistryRevision: Number(value.expectedRegistryRevision),
    idempotencyKey: value.idempotencyKey,
    reasonText: value.reasonText.trim(),
  }
  if (value.commandType === "create_registered_task") {
    if (!isBoundedText(value.taskGoal, 4, 2000)) return { ok: false, errorCode: "task_goal_invalid" }
    if (!capabilityDomains.includes(value.capabilityDomain as AiConsoleTaskRegistryCapabilityDomain)) return { ok: false, errorCode: "task_capability_domain_invalid" }
    if (!isPriority(value.priority)) return { ok: false, errorCode: "task_priority_invalid" }
    return { ok: true, input: { ...base, commandType: value.commandType, taskGoal: value.taskGoal.trim(), capabilityDomain: value.capabilityDomain as AiConsoleTaskRegistryCapabilityDomain, priority: Number(value.priority) } }
  }
  if (typeof value.taskId !== "string" || !/^[a-f0-9]{64}$/u.test(value.taskId)) return { ok: false, errorCode: "task_identity_invalid" }
  if (value.commandType === "set_queued_task_priority") {
    if (!isPriority(value.priority)) return { ok: false, errorCode: "task_priority_invalid" }
    return { ok: true, input: { ...base, commandType: value.commandType, taskId: value.taskId, priority: Number(value.priority) } }
  }
  return { ok: true, input: { ...base, commandType: "cancel_unstarted_task", taskId: value.taskId } }
}

export function executeAiConsoleTaskCommand(input: ParsedTaskCommand, session: VerifiedOperatorSession): AiConsoleTaskRegistryCommandResult {
  const common = {
    expectedRegistryRevision: input.expectedRegistryRevision,
    idempotencyKeySha256: sha256(input.idempotencyKey),
    reasonText: input.reasonText,
    actorIdentity: session.actorIdentity,
    role: session.role,
    requestedAtUtc: new Date().toISOString(),
  } as const
  let storeInput: AiConsoleTaskRegistryCommandInput
  if (input.commandType === "create_registered_task") storeInput = { ...common, commandType: input.commandType, taskGoal: input.taskGoal, capabilityDomain: input.capabilityDomain, priority: input.priority }
  else if (input.commandType === "set_queued_task_priority") storeInput = { ...common, commandType: input.commandType, taskId: input.taskId, priority: input.priority }
  else storeInput = { ...common, commandType: input.commandType, taskId: input.taskId }
  return executeAiConsoleTaskRegistryCommand(storeInput)
}

function sha256(value: string): string { return createHash("sha256").update(value, "utf8").digest("hex") }
function isPriority(value: unknown): boolean { return Number.isInteger(value) && Number(value) >= 1 && Number(value) <= 9 }
function isBoundedText(value: unknown, minimum: number, maximum: number): value is string { return typeof value === "string" && value === value.trim() && value.length >= minimum && value.length <= maximum && !/[\u0000-\u001f\u007f]/u.test(value) }
function isPlainRecord(value: unknown): value is Record<string, unknown> { return typeof value === "object" && value !== null && !Array.isArray(value) }
