import { createHash } from "node:crypto"
import type { VerifiedOperatorSession } from "./operator-session"
import {
  executeAiConsoleWorldControlCommand,
  type AiConsoleWorldControlCommandInput,
  type AiConsoleWorldControlCommandResult,
} from "./world-control-registry-store"

const supportedCommandTypes = [
  "consume_registered_runtime_frame",
  "pause_frame_publish",
  "resume_frame_publish",
  "rollback_runtime_frame",
  "freeze_visual_updates",
] as const

type CommonCommand = {
  expectedRegistryRevision: number
  expectedWorldRevision: number
  idempotencyKey: string
  reasonText: string
}

export type ParsedWorldControlCommand =
  | (CommonCommand & { commandType: "consume_registered_runtime_frame"; runtimeFrameIdentity: string })
  | (CommonCommand & { commandType: "pause_frame_publish"; worldId: string })
  | (CommonCommand & { commandType: "resume_frame_publish"; worldId: string })
  | (CommonCommand & { commandType: "rollback_runtime_frame"; worldId: string; targetRuntimeFrameIdentity: string })
  | (CommonCommand & { commandType: "freeze_visual_updates"; worldId: string })

export function parseAiConsoleWorldControlCommandInput(
  value: unknown,
): { ok: true; input: ParsedWorldControlCommand } | { ok: false; errorCode: string } {
  if (!isPlainRecord(value)) return { ok: false, errorCode: "world_control_command_body_invalid" }
  if (!supportedCommandTypes.includes(value.commandType as (typeof supportedCommandTypes)[number])) {
    return { ok: false, errorCode: "world_control_command_type_not_allowed" }
  }
  const common = ["commandType", "expectedRegistryRevision", "expectedWorldRevision", "idempotencyKey", "reasonText"]
  const specific = value.commandType === "consume_registered_runtime_frame"
    ? ["runtimeFrameIdentity"]
    : value.commandType === "rollback_runtime_frame"
      ? ["worldId", "targetRuntimeFrameIdentity"]
      : ["worldId"]
  if (JSON.stringify(Object.keys(value).sort()) !== JSON.stringify([...common, ...specific].sort())) {
    return { ok: false, errorCode: "world_control_command_field_set_invalid" }
  }
  if (!Number.isInteger(value.expectedRegistryRevision) || Number(value.expectedRegistryRevision) < 0) {
    return { ok: false, errorCode: "world_control_expected_registry_revision_invalid" }
  }
  if (!Number.isInteger(value.expectedWorldRevision) || Number(value.expectedWorldRevision) < 0) {
    return { ok: false, errorCode: "world_control_expected_world_revision_invalid" }
  }
  if (typeof value.idempotencyKey !== "string" || !/^[A-Za-z0-9_-]{16,128}$/u.test(value.idempotencyKey)) {
    return { ok: false, errorCode: "world_control_idempotency_key_invalid" }
  }
  if (!isText(value.reasonText, 4, 240)) return { ok: false, errorCode: "world_control_reason_invalid" }
  const shared = {
    expectedRegistryRevision: Number(value.expectedRegistryRevision),
    expectedWorldRevision: Number(value.expectedWorldRevision),
    idempotencyKey: value.idempotencyKey,
    reasonText: value.reasonText.trim(),
  }
  if (value.commandType === "consume_registered_runtime_frame") {
    if (!isSha256(value.runtimeFrameIdentity)) return { ok: false, errorCode: "world_control_runtime_frame_identity_invalid" }
    return { ok: true, input: { ...shared, commandType: value.commandType, runtimeFrameIdentity: value.runtimeFrameIdentity } }
  }
  if (!isIdentity(value.worldId)) return { ok: false, errorCode: "world_control_world_identity_invalid" }
  if (value.commandType === "rollback_runtime_frame") {
    if (!isSha256(value.targetRuntimeFrameIdentity)) return { ok: false, errorCode: "world_control_rollback_target_invalid" }
    return { ok: true, input: { ...shared, commandType: value.commandType, worldId: value.worldId, targetRuntimeFrameIdentity: value.targetRuntimeFrameIdentity } }
  }
  return { ok: true, input: { ...shared, commandType: value.commandType as "pause_frame_publish" | "resume_frame_publish" | "freeze_visual_updates", worldId: value.worldId } }
}

export function executeAiConsoleWorldControlRegistryCommand(
  input: ParsedWorldControlCommand,
  session: VerifiedOperatorSession,
): AiConsoleWorldControlCommandResult {
  const common = {
    expectedRegistryRevision: input.expectedRegistryRevision,
    expectedWorldRevision: input.expectedWorldRevision,
    idempotencyKeySha256: sha256(input.idempotencyKey),
    reasonText: input.reasonText,
    actorIdentity: session.actorIdentity,
    role: session.role,
    requestedAtUtc: new Date().toISOString(),
  } as const
  const storeInput: AiConsoleWorldControlCommandInput = input.commandType === "consume_registered_runtime_frame"
    ? { ...common, commandType: input.commandType, runtimeFrameIdentity: input.runtimeFrameIdentity }
    : input.commandType === "rollback_runtime_frame"
      ? { ...common, commandType: input.commandType, worldId: input.worldId, targetRuntimeFrameIdentity: input.targetRuntimeFrameIdentity }
      : { ...common, commandType: input.commandType, worldId: input.worldId }
  return executeAiConsoleWorldControlCommand(storeInput)
}

function sha256(value: string) { return createHash("sha256").update(value, "utf8").digest("hex") }
function isSha256(value: unknown): value is string { return typeof value === "string" && /^[a-f0-9]{64}$/u.test(value) }
function isIdentity(value: unknown): value is string { return typeof value === "string" && /^[A-Za-z0-9][A-Za-z0-9._:/-]{2,159}$/u.test(value) }
function isText(value: unknown, minimum: number, maximum: number): value is string { return typeof value === "string" && value === value.trim() && value.length >= minimum && value.length <= maximum && !/[\u0000-\u001f\u007f]/u.test(value) }
function isPlainRecord(value: unknown): value is Record<string, unknown> { return typeof value === "object" && value !== null && !Array.isArray(value) }
