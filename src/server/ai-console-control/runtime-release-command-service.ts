import { createHash } from "node:crypto"
import type { VerifiedOperatorSession } from "./operator-session"
import { executeAiConsoleRuntimeReleaseCommand, type AiConsoleRuntimeReleaseCommandInput, type AiConsoleRuntimeReleaseCommandResult } from "./runtime-release-registry-store"

const supportedCommandTypes = ["activate_qualified_release", "register_runtime_frame_candidate", "publish_reviewed_runtime_frame"] as const

export type ParsedRuntimeReleaseCommand =
  | { commandType: "activate_qualified_release"; capabilityReleaseIdentity: string; expectedPreviousActivationId: string | null; expectedRegistryRevision: number; idempotencyKey: string; reasonText: string }
  | { commandType: "register_runtime_frame_candidate"; activationId: string; worldId: string; tick: number; worldFactIdentity: string; conditionPackageIdentity: string; visualArtifactIdentity: string; imageSha256: string; frameManifestSha256: string; expectedRegistryRevision: number; idempotencyKey: string; reasonText: string }
  | { commandType: "publish_reviewed_runtime_frame"; runtimeFrameCandidateIdentity: string; reviewResultId: string; expectedPreviousRuntimeFrameIdentity: string | null; expectedRegistryRevision: number; idempotencyKey: string; reasonText: string }

export function parseAiConsoleRuntimeReleaseCommandInput(value: unknown): { ok: true; input: ParsedRuntimeReleaseCommand } | { ok: false; errorCode: string } {
  if (!isPlainRecord(value)) return { ok: false, errorCode: "runtime_release_command_body_invalid" }
  if (!supportedCommandTypes.includes(value.commandType as (typeof supportedCommandTypes)[number])) return { ok: false, errorCode: "runtime_release_command_type_not_allowed" }
  const common = ["commandType", "expectedRegistryRevision", "idempotencyKey", "reasonText"]
  const specific = value.commandType === "activate_qualified_release" ? ["capabilityReleaseIdentity", "expectedPreviousActivationId"] : value.commandType === "register_runtime_frame_candidate" ? ["activationId", "worldId", "tick", "worldFactIdentity", "conditionPackageIdentity", "visualArtifactIdentity", "imageSha256", "frameManifestSha256"] : ["runtimeFrameCandidateIdentity", "reviewResultId", "expectedPreviousRuntimeFrameIdentity"]
  if (JSON.stringify(Object.keys(value).sort()) !== JSON.stringify([...common, ...specific].sort())) return { ok: false, errorCode: "runtime_release_command_field_set_invalid" }
  if (!Number.isInteger(value.expectedRegistryRevision) || Number(value.expectedRegistryRevision) < 0) return { ok: false, errorCode: "runtime_release_expected_revision_invalid" }
  if (typeof value.idempotencyKey !== "string" || !/^[A-Za-z0-9_-]{16,128}$/u.test(value.idempotencyKey)) return { ok: false, errorCode: "runtime_release_idempotency_key_invalid" }
  if (!isText(value.reasonText, 4, 240)) return { ok: false, errorCode: "runtime_release_reason_invalid" }
  const shared = { expectedRegistryRevision: Number(value.expectedRegistryRevision), idempotencyKey: value.idempotencyKey, reasonText: value.reasonText.trim() }
  if (value.commandType === "activate_qualified_release") {
    if (!isSha256(value.capabilityReleaseIdentity) || (value.expectedPreviousActivationId !== null && !isSha256(value.expectedPreviousActivationId))) return { ok: false, errorCode: "capability_activation_identity_invalid" }
    return { ok: true, input: { ...shared, commandType: value.commandType, capabilityReleaseIdentity: value.capabilityReleaseIdentity, expectedPreviousActivationId: value.expectedPreviousActivationId } }
  }
  if (value.commandType === "register_runtime_frame_candidate") {
    if (!isSha256(value.activationId) || !isIdentity(value.worldId) || !Number.isSafeInteger(value.tick) || Number(value.tick) < 0 || !isIdentity(value.worldFactIdentity) || !isIdentity(value.conditionPackageIdentity) || !isIdentity(value.visualArtifactIdentity) || !isSha256(value.imageSha256) || !isSha256(value.frameManifestSha256)) return { ok: false, errorCode: "runtime_frame_candidate_contract_invalid" }
    return { ok: true, input: { ...shared, commandType: value.commandType, activationId: value.activationId, worldId: value.worldId, tick: Number(value.tick), worldFactIdentity: value.worldFactIdentity, conditionPackageIdentity: value.conditionPackageIdentity, visualArtifactIdentity: value.visualArtifactIdentity, imageSha256: value.imageSha256, frameManifestSha256: value.frameManifestSha256 } }
  }
  if (value.commandType !== "publish_reviewed_runtime_frame") return { ok: false, errorCode: "runtime_release_command_type_not_allowed" }
  if (!isSha256(value.runtimeFrameCandidateIdentity) || !isSha256(value.reviewResultId) || (value.expectedPreviousRuntimeFrameIdentity !== null && !isSha256(value.expectedPreviousRuntimeFrameIdentity))) return { ok: false, errorCode: "runtime_frame_publication_contract_invalid" }
  return { ok: true, input: { ...shared, commandType: value.commandType, runtimeFrameCandidateIdentity: value.runtimeFrameCandidateIdentity, reviewResultId: value.reviewResultId, expectedPreviousRuntimeFrameIdentity: value.expectedPreviousRuntimeFrameIdentity } }
}

export function executeAiConsoleRuntimeReleaseRegistryCommand(input: ParsedRuntimeReleaseCommand, session: VerifiedOperatorSession): AiConsoleRuntimeReleaseCommandResult {
  const common = { expectedRegistryRevision: input.expectedRegistryRevision, idempotencyKeySha256: sha256(input.idempotencyKey), reasonText: input.reasonText, actorIdentity: session.actorIdentity, role: session.role, requestedAtUtc: new Date().toISOString() } as const
  const storeInput: AiConsoleRuntimeReleaseCommandInput = input.commandType === "activate_qualified_release" ? { ...common, commandType: input.commandType, capabilityReleaseIdentity: input.capabilityReleaseIdentity, expectedPreviousActivationId: input.expectedPreviousActivationId } : input.commandType === "register_runtime_frame_candidate" ? { ...common, commandType: input.commandType, activationId: input.activationId, worldId: input.worldId, tick: input.tick, worldFactIdentity: input.worldFactIdentity, conditionPackageIdentity: input.conditionPackageIdentity, visualArtifactIdentity: input.visualArtifactIdentity, imageSha256: input.imageSha256, frameManifestSha256: input.frameManifestSha256 } : { ...common, commandType: input.commandType, runtimeFrameCandidateIdentity: input.runtimeFrameCandidateIdentity, reviewResultId: input.reviewResultId, expectedPreviousRuntimeFrameIdentity: input.expectedPreviousRuntimeFrameIdentity }
  return executeAiConsoleRuntimeReleaseCommand(storeInput)
}

function sha256(value: string) { return createHash("sha256").update(value, "utf8").digest("hex") }
function isSha256(value: unknown): value is string { return typeof value === "string" && /^[a-f0-9]{64}$/u.test(value) }
function isIdentity(value: unknown): value is string { return typeof value === "string" && /^[A-Za-z0-9][A-Za-z0-9._:/-]{2,159}$/u.test(value) }
function isText(value: unknown, minimum: number, maximum: number): value is string { return typeof value === "string" && value === value.trim() && value.length >= minimum && value.length <= maximum && !/[\u0000-\u001f\u007f]/u.test(value) }
function isPlainRecord(value: unknown): value is Record<string, unknown> { return typeof value === "object" && value !== null && !Array.isArray(value) }
