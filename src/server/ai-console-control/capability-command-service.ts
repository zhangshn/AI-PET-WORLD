import { createHash } from "node:crypto"
import type { VerifiedOperatorSession } from "./operator-session"
import {
  aiConsoleCapabilityDomains,
  aiConsoleQualificationGates,
  executeAiConsoleCapabilityCommand,
  type AiConsoleCapabilityCommandInput,
  type AiConsoleCapabilityCommandResult,
  type AiConsoleCapabilityDomain,
  type AiConsoleQualificationGateId,
} from "./capability-lifecycle-store"

const supportedCommandTypes = [
  "register_capability_candidate",
  "record_capability_qualification",
  "register_qualified_capability_release",
] as const

type ParsedCapabilityCommand =
  | {
      commandType: "register_capability_candidate"
      capabilityDomain: AiConsoleCapabilityDomain
      parentCapabilityVersionId: string | null
      modelIdentity: string
      datasetReleaseIdentity: string
      trainingParadigm: string
      expectedRegistryRevision: number
      idempotencyKey: string
      reasonText: string
    }
  | {
      commandType: "record_capability_qualification"
      capabilityVersionId: string
      qualificationGateId: AiConsoleQualificationGateId
      qualificationStatus: "passed" | "failed"
      evidenceSha256: string
      expectedRegistryRevision: number
      idempotencyKey: string
      reasonText: string
    }
  | {
      commandType: "register_qualified_capability_release"
      capabilityVersionId: string
      conditionSchemaId: string
      previousReleaseIdentity: string | null
      rollbackReleaseIdentity: string | null
      expectedRegistryRevision: number
      idempotencyKey: string
      reasonText: string
    }

export function parseAiConsoleCapabilityCommandInput(value: unknown):
  | { ok: true; input: ParsedCapabilityCommand }
  | { ok: false; errorCode: string } {
  if (!isPlainRecord(value)) return { ok: false, errorCode: "capability_command_body_invalid" }
  if (!supportedCommandTypes.includes(value.commandType as (typeof supportedCommandTypes)[number])) return { ok: false, errorCode: "capability_command_type_not_allowed" }
  const commonFields = ["commandType", "expectedRegistryRevision", "idempotencyKey", "reasonText"]
  const specificFields = value.commandType === "register_capability_candidate"
    ? ["capabilityDomain", "parentCapabilityVersionId", "modelIdentity", "datasetReleaseIdentity", "trainingParadigm"]
    : value.commandType === "record_capability_qualification"
      ? ["capabilityVersionId", "qualificationGateId", "qualificationStatus", "evidenceSha256"]
      : ["capabilityVersionId", "conditionSchemaId", "previousReleaseIdentity", "rollbackReleaseIdentity"]
  if (JSON.stringify(Object.keys(value).sort()) !== JSON.stringify([...commonFields, ...specificFields].sort())) return { ok: false, errorCode: "capability_command_field_set_invalid" }
  if (!Number.isInteger(value.expectedRegistryRevision) || Number(value.expectedRegistryRevision) < 0) return { ok: false, errorCode: "capability_command_expected_revision_invalid" }
  if (typeof value.idempotencyKey !== "string" || !/^[A-Za-z0-9_-]{16,128}$/u.test(value.idempotencyKey)) return { ok: false, errorCode: "capability_command_idempotency_key_invalid" }
  if (!isBoundedText(value.reasonText, 4, 240)) return { ok: false, errorCode: "capability_command_reason_invalid" }

  const common = {
    expectedRegistryRevision: Number(value.expectedRegistryRevision),
    idempotencyKey: value.idempotencyKey,
    reasonText: value.reasonText.trim(),
  }
  if (value.commandType === "register_capability_candidate") {
    if (!aiConsoleCapabilityDomains.includes(value.capabilityDomain as AiConsoleCapabilityDomain)) return { ok: false, errorCode: "capability_domain_invalid" }
    if (value.parentCapabilityVersionId !== null && !isSha256(value.parentCapabilityVersionId)) return { ok: false, errorCode: "parent_capability_version_identity_invalid" }
    if (![value.modelIdentity, value.datasetReleaseIdentity, value.trainingParadigm].every(isRegisteredIdentity)) return { ok: false, errorCode: "capability_candidate_asset_identity_invalid" }
    return {
      ok: true,
      input: {
        ...common,
        commandType: value.commandType,
        capabilityDomain: value.capabilityDomain as AiConsoleCapabilityDomain,
        parentCapabilityVersionId: value.parentCapabilityVersionId as string | null,
        modelIdentity: String(value.modelIdentity),
        datasetReleaseIdentity: String(value.datasetReleaseIdentity),
        trainingParadigm: String(value.trainingParadigm),
      },
    }
  }
  if (!isSha256(value.capabilityVersionId)) return { ok: false, errorCode: "capability_version_identity_invalid" }
  if (value.commandType === "record_capability_qualification") {
    if (!aiConsoleQualificationGates.includes(value.qualificationGateId as AiConsoleQualificationGateId)) return { ok: false, errorCode: "qualification_gate_identity_invalid" }
    if (value.qualificationStatus !== "passed" && value.qualificationStatus !== "failed") return { ok: false, errorCode: "qualification_status_invalid" }
    if (!isSha256(value.evidenceSha256)) return { ok: false, errorCode: "qualification_evidence_sha256_invalid" }
    return {
      ok: true,
      input: {
        ...common,
        commandType: value.commandType,
        capabilityVersionId: value.capabilityVersionId,
        qualificationGateId: value.qualificationGateId as AiConsoleQualificationGateId,
        qualificationStatus: value.qualificationStatus,
        evidenceSha256: value.evidenceSha256,
      },
    }
  }
  if (!isRegisteredIdentity(value.conditionSchemaId)) return { ok: false, errorCode: "condition_schema_identity_invalid" }
  if (value.previousReleaseIdentity !== null && !isSha256(value.previousReleaseIdentity)) return { ok: false, errorCode: "previous_release_identity_invalid" }
  if (value.rollbackReleaseIdentity !== null && !isSha256(value.rollbackReleaseIdentity)) return { ok: false, errorCode: "rollback_release_identity_invalid" }
  return {
    ok: true,
    input: {
      ...common,
      commandType: "register_qualified_capability_release",
      capabilityVersionId: value.capabilityVersionId,
      conditionSchemaId: String(value.conditionSchemaId),
      previousReleaseIdentity: value.previousReleaseIdentity as string | null,
      rollbackReleaseIdentity: value.rollbackReleaseIdentity as string | null,
    },
  }
}

export function executeAiConsoleCapabilityLifecycleCommand(input: ParsedCapabilityCommand, session: VerifiedOperatorSession): AiConsoleCapabilityCommandResult {
  const common = {
    expectedRegistryRevision: input.expectedRegistryRevision,
    idempotencyKeySha256: sha256(input.idempotencyKey),
    reasonText: input.reasonText,
    actorIdentity: session.actorIdentity,
    role: session.role,
    requestedAtUtc: new Date().toISOString(),
  } as const
  let storeInput: AiConsoleCapabilityCommandInput
  if (input.commandType === "register_capability_candidate") {
    storeInput = {
      ...common,
      commandType: input.commandType,
      capabilityDomain: input.capabilityDomain,
      parentCapabilityVersionId: input.parentCapabilityVersionId,
      modelIdentity: input.modelIdentity,
      datasetReleaseIdentity: input.datasetReleaseIdentity,
      trainingParadigm: input.trainingParadigm,
    }
  } else if (input.commandType === "record_capability_qualification") {
    storeInput = {
      ...common,
      commandType: input.commandType,
      capabilityVersionId: input.capabilityVersionId,
      qualificationGateId: input.qualificationGateId,
      qualificationStatus: input.qualificationStatus,
      evidenceSha256: input.evidenceSha256,
    }
  } else {
    storeInput = {
      ...common,
      commandType: input.commandType,
      capabilityVersionId: input.capabilityVersionId,
      conditionSchemaId: input.conditionSchemaId,
      previousReleaseIdentity: input.previousReleaseIdentity,
      rollbackReleaseIdentity: input.rollbackReleaseIdentity,
    }
  }
  return executeAiConsoleCapabilityCommand(storeInput)
}

function sha256(value: string): string { return createHash("sha256").update(value, "utf8").digest("hex") }
function isSha256(value: unknown): value is string { return typeof value === "string" && /^[a-f0-9]{64}$/u.test(value) }
function isRegisteredIdentity(value: unknown): value is string { return typeof value === "string" && /^[A-Za-z0-9][A-Za-z0-9._:/-]{2,159}$/u.test(value) }
function isBoundedText(value: unknown, minimum: number, maximum: number): value is string { return typeof value === "string" && value === value.trim() && value.length >= minimum && value.length <= maximum && !/[\u0000-\u001f\u007f]/u.test(value) }
function isPlainRecord(value: unknown): value is Record<string, unknown> { return typeof value === "object" && value !== null && !Array.isArray(value) }
