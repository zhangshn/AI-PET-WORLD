import { createHash } from "node:crypto"
import type { VerifiedOperatorSession } from "./operator-session"
import {
  aiConsoleReviewCapabilityDomains,
  aiConsoleThresholdOperators,
  executeAiConsoleReviewCommand,
  type AiConsoleReviewCapabilityDomain,
  type AiConsoleReviewCommandInput,
  type AiConsoleReviewCommandResult,
  type AiConsoleThresholdOperator,
} from "./review-adjudication-store"

const supportedCommandTypes = ["register_review_contract", "register_machine_review_observation"] as const

export type ParsedReviewAdjudicationCommand =
  | {
      commandType: "register_review_contract"
      capabilityDomain: AiConsoleReviewCapabilityDomain
      reviewerIdentity: string
      reviewerVersion: string
      metricDefinitionId: string
      thresholdOperator: AiConsoleThresholdOperator
      thresholdValue: number
      thresholdUnit: string
      evidenceRequirementId: string
      failureCode: string
      previousReviewContractId: string | null
      expectedRegistryRevision: number
      idempotencyKey: string
      reasonText: string
    }
  | {
      commandType: "register_machine_review_observation"
      reviewContractId: string
      reviewRunId: string
      validationInputIdentity: string
      machineReviewerIdentity: string
      metricValue: number
      affectedScope: string
      evidenceTypeId: string
      evidenceSha256: string
      expectedRegistryRevision: number
      idempotencyKey: string
      reasonText: string
    }

export function parseAiConsoleReviewAdjudicationCommandInput(value: unknown):
  | { ok: true; input: ParsedReviewAdjudicationCommand }
  | { ok: false; errorCode: string } {
  if (!isPlainRecord(value)) return { ok: false, errorCode: "review_adjudication_command_body_invalid" }
  if (!supportedCommandTypes.includes(value.commandType as (typeof supportedCommandTypes)[number])) return { ok: false, errorCode: "review_adjudication_command_type_not_allowed" }
  const common = ["commandType", "expectedRegistryRevision", "idempotencyKey", "reasonText"]
  const specific = value.commandType === "register_review_contract"
    ? ["capabilityDomain", "reviewerIdentity", "reviewerVersion", "metricDefinitionId", "thresholdOperator", "thresholdValue", "thresholdUnit", "evidenceRequirementId", "failureCode", "previousReviewContractId"]
    : ["reviewContractId", "reviewRunId", "validationInputIdentity", "machineReviewerIdentity", "metricValue", "affectedScope", "evidenceTypeId", "evidenceSha256"]
  if (JSON.stringify(Object.keys(value).sort()) !== JSON.stringify([...common, ...specific].sort())) return { ok: false, errorCode: "review_adjudication_command_field_set_invalid" }
  if (!Number.isInteger(value.expectedRegistryRevision) || Number(value.expectedRegistryRevision) < 0) return { ok: false, errorCode: "review_adjudication_expected_revision_invalid" }
  if (typeof value.idempotencyKey !== "string" || !/^[A-Za-z0-9_-]{16,128}$/u.test(value.idempotencyKey)) return { ok: false, errorCode: "review_adjudication_idempotency_key_invalid" }
  if (!isBoundedText(value.reasonText, 4, 240)) return { ok: false, errorCode: "review_adjudication_reason_invalid" }
  const commonResult = {
    expectedRegistryRevision: Number(value.expectedRegistryRevision),
    idempotencyKey: value.idempotencyKey,
    reasonText: value.reasonText.trim(),
  }
  if (value.commandType === "register_review_contract") {
    if (!aiConsoleReviewCapabilityDomains.includes(value.capabilityDomain as AiConsoleReviewCapabilityDomain)) return { ok: false, errorCode: "review_capability_domain_invalid" }
    if (!isRegisteredIdentity(value.reviewerIdentity) || !isRegisteredIdentity(value.reviewerVersion) || !isRegisteredIdentity(value.metricDefinitionId) || !isRegisteredIdentity(value.thresholdUnit) || !isRegisteredIdentity(value.evidenceRequirementId) || !isFailureCode(value.failureCode)) return { ok: false, errorCode: "review_contract_identity_invalid" }
    if (!aiConsoleThresholdOperators.includes(value.thresholdOperator as AiConsoleThresholdOperator)) return { ok: false, errorCode: "review_threshold_operator_invalid" }
    if (!isFiniteMetric(value.thresholdValue)) return { ok: false, errorCode: "review_threshold_value_invalid" }
    if (value.previousReviewContractId !== null && !isSha256(value.previousReviewContractId)) return { ok: false, errorCode: "previous_review_contract_id_invalid" }
    return {
      ok: true,
      input: {
        ...commonResult,
        commandType: "register_review_contract",
        capabilityDomain: value.capabilityDomain as AiConsoleReviewCapabilityDomain,
        reviewerIdentity: value.reviewerIdentity,
        reviewerVersion: value.reviewerVersion,
        metricDefinitionId: value.metricDefinitionId,
        thresholdOperator: value.thresholdOperator as AiConsoleThresholdOperator,
        thresholdValue: Number(value.thresholdValue),
        thresholdUnit: value.thresholdUnit,
        evidenceRequirementId: value.evidenceRequirementId,
        failureCode: value.failureCode,
        previousReviewContractId: value.previousReviewContractId,
      },
    }
  }
  if (!isSha256(value.reviewContractId) || !isRegisteredIdentity(value.reviewRunId) || !isRegisteredIdentity(value.validationInputIdentity) || !isRegisteredIdentity(value.machineReviewerIdentity) || !isRegisteredIdentity(value.affectedScope) || !isRegisteredIdentity(value.evidenceTypeId) || !isSha256(value.evidenceSha256)) return { ok: false, errorCode: "machine_review_observation_identity_invalid" }
  if (!isFiniteMetric(value.metricValue)) return { ok: false, errorCode: "machine_review_metric_value_invalid" }
  return {
    ok: true,
    input: {
      ...commonResult,
      commandType: "register_machine_review_observation",
      reviewContractId: value.reviewContractId,
      reviewRunId: value.reviewRunId,
      validationInputIdentity: value.validationInputIdentity,
      machineReviewerIdentity: value.machineReviewerIdentity,
      metricValue: Number(value.metricValue),
      affectedScope: value.affectedScope.trim(),
      evidenceTypeId: value.evidenceTypeId,
      evidenceSha256: value.evidenceSha256,
    },
  }
}

export function executeAiConsoleReviewAdjudicationRegistryCommand(input: ParsedReviewAdjudicationCommand, session: VerifiedOperatorSession): AiConsoleReviewCommandResult {
  const common = {
    expectedRegistryRevision: input.expectedRegistryRevision,
    idempotencyKeySha256: sha256(input.idempotencyKey),
    reasonText: input.reasonText,
    actorIdentity: session.actorIdentity,
    role: session.role,
    requestedAtUtc: new Date().toISOString(),
  } as const
  const storeInput: AiConsoleReviewCommandInput = input.commandType === "register_review_contract"
    ? { ...common, commandType: input.commandType, capabilityDomain: input.capabilityDomain, reviewerIdentity: input.reviewerIdentity, reviewerVersion: input.reviewerVersion, metricDefinitionId: input.metricDefinitionId, thresholdOperator: input.thresholdOperator, thresholdValue: input.thresholdValue, thresholdUnit: input.thresholdUnit, evidenceRequirementId: input.evidenceRequirementId, failureCode: input.failureCode, previousReviewContractId: input.previousReviewContractId }
    : { ...common, commandType: input.commandType, reviewContractId: input.reviewContractId, reviewRunId: input.reviewRunId, validationInputIdentity: input.validationInputIdentity, machineReviewerIdentity: input.machineReviewerIdentity, metricValue: input.metricValue, affectedScope: input.affectedScope, evidenceTypeId: input.evidenceTypeId, evidenceSha256: input.evidenceSha256 }
  return executeAiConsoleReviewCommand(storeInput)
}

function sha256(value: string): string { return createHash("sha256").update(value, "utf8").digest("hex") }
function isSha256(value: unknown): value is string { return typeof value === "string" && /^[a-f0-9]{64}$/u.test(value) }
function isRegisteredIdentity(value: unknown): value is string { return typeof value === "string" && /^[A-Za-z0-9][A-Za-z0-9._:/-]{2,159}$/u.test(value) }
function isFailureCode(value: unknown): value is string { return typeof value === "string" && /^[a-z][a-z0-9_]{2,95}$/u.test(value) }
function isFiniteMetric(value: unknown): value is number { return typeof value === "number" && Number.isFinite(value) && Math.abs(value) <= 1_000_000_000 }
function isBoundedText(value: unknown, minimum: number, maximum: number): value is string { return typeof value === "string" && value === value.trim() && value.length >= minimum && value.length <= maximum && !/[\u0000-\u001f\u007f]/u.test(value) }
function isPlainRecord(value: unknown): value is Record<string, unknown> { return typeof value === "object" && value !== null && !Array.isArray(value) }
