import { createHash } from "node:crypto"
import type { VerifiedOperatorSession } from "./operator-session"
import {
  aiConsoleTrainingCapabilityDomains,
  executeAiConsoleTrainingDesignCommand,
  type AiConsoleTrainingCapabilityDomain,
  type AiConsoleTrainingDesignCommandInput,
  type AiConsoleTrainingDesignCommandResult,
} from "./training-design-store"

const supportedCommandTypes = ["register_model_structure", "register_training_plan"] as const

type ParsedTrainingDesignCommand =
  | {
      commandType: "register_model_structure"
      capabilityDomain: AiConsoleTrainingCapabilityDomain
      modelFamily: string
      architectureDefinitionSha256: string
      sourceCodeSha256: string
      inputConditionSchemaId: string
      outputSchemaId: string
      parameterCount: number
      expectedRegistryRevision: number
      idempotencyKey: string
      reasonText: string
    }
  | {
      commandType: "register_training_plan"
      capabilityDomain: AiConsoleTrainingCapabilityDomain
      modelStructureId: string
      datasetReleaseIdentity: string
      splitIdentity: string
      randomSeed: number
      nativeResolution: string
      epochBudget: number
      parentTerminalRule: string
      optimizerConfigSha256: string
      resourceProfileIdentity: string
      expectedRegistryRevision: number
      idempotencyKey: string
      reasonText: string
    }

export function parseAiConsoleTrainingDesignCommandInput(value: unknown):
  | { ok: true; input: ParsedTrainingDesignCommand }
  | { ok: false; errorCode: string } {
  if (!isPlainRecord(value)) return { ok: false, errorCode: "training_design_command_body_invalid" }
  if (!supportedCommandTypes.includes(value.commandType as (typeof supportedCommandTypes)[number])) return { ok: false, errorCode: "training_design_command_type_not_allowed" }
  const common = ["commandType", "expectedRegistryRevision", "idempotencyKey", "reasonText"]
  const specific = value.commandType === "register_model_structure"
    ? ["capabilityDomain", "modelFamily", "architectureDefinitionSha256", "sourceCodeSha256", "inputConditionSchemaId", "outputSchemaId", "parameterCount"]
    : ["capabilityDomain", "modelStructureId", "datasetReleaseIdentity", "splitIdentity", "randomSeed", "nativeResolution", "epochBudget", "parentTerminalRule", "optimizerConfigSha256", "resourceProfileIdentity"]
  if (JSON.stringify(Object.keys(value).sort()) !== JSON.stringify([...common, ...specific].sort())) return { ok: false, errorCode: "training_design_command_field_set_invalid" }
  if (!Number.isInteger(value.expectedRegistryRevision) || Number(value.expectedRegistryRevision) < 0) return { ok: false, errorCode: "training_design_command_expected_revision_invalid" }
  if (typeof value.idempotencyKey !== "string" || !/^[A-Za-z0-9_-]{16,128}$/u.test(value.idempotencyKey)) return { ok: false, errorCode: "training_design_command_idempotency_key_invalid" }
  if (!isBoundedText(value.reasonText, 4, 240)) return { ok: false, errorCode: "training_design_command_reason_invalid" }
  if (!aiConsoleTrainingCapabilityDomains.includes(value.capabilityDomain as AiConsoleTrainingCapabilityDomain)) return { ok: false, errorCode: "training_design_capability_domain_invalid" }
  const base = {
    capabilityDomain: value.capabilityDomain as AiConsoleTrainingCapabilityDomain,
    expectedRegistryRevision: Number(value.expectedRegistryRevision),
    idempotencyKey: value.idempotencyKey,
    reasonText: value.reasonText.trim(),
  }
  if (value.commandType === "register_model_structure") {
    if (!isRegisteredIdentity(value.modelFamily) || !isSha256(value.architectureDefinitionSha256) || !isSha256(value.sourceCodeSha256) || !isRegisteredIdentity(value.inputConditionSchemaId) || !isRegisteredIdentity(value.outputSchemaId)) return { ok: false, errorCode: "model_structure_contract_invalid" }
    if (!Number.isSafeInteger(value.parameterCount) || Number(value.parameterCount) < 1) return { ok: false, errorCode: "model_structure_parameter_count_invalid" }
    return { ok: true, input: { ...base, commandType: "register_model_structure", modelFamily: value.modelFamily, architectureDefinitionSha256: value.architectureDefinitionSha256, sourceCodeSha256: value.sourceCodeSha256, inputConditionSchemaId: value.inputConditionSchemaId, outputSchemaId: value.outputSchemaId, parameterCount: Number(value.parameterCount) } }
  }
  if (!isSha256(value.modelStructureId) || !isRegisteredIdentity(value.datasetReleaseIdentity) || !isRegisteredIdentity(value.splitIdentity) || !isRegisteredIdentity(value.parentTerminalRule) || !isSha256(value.optimizerConfigSha256) || !isRegisteredIdentity(value.resourceProfileIdentity)) return { ok: false, errorCode: "training_plan_contract_invalid" }
  if (!Number.isSafeInteger(value.randomSeed) || Number(value.randomSeed) < 0 || Number(value.randomSeed) > 2147483647) return { ok: false, errorCode: "training_plan_seed_invalid" }
  if (typeof value.nativeResolution !== "string" || !/^\d{2,5}x\d{2,5}$/u.test(value.nativeResolution)) return { ok: false, errorCode: "training_plan_resolution_invalid" }
  if (!Number.isInteger(value.epochBudget) || Number(value.epochBudget) < 1 || Number(value.epochBudget) > 1000000) return { ok: false, errorCode: "training_plan_epoch_budget_invalid" }
  return { ok: true, input: { ...base, commandType: "register_training_plan", modelStructureId: value.modelStructureId, datasetReleaseIdentity: value.datasetReleaseIdentity, splitIdentity: value.splitIdentity, randomSeed: Number(value.randomSeed), nativeResolution: value.nativeResolution, epochBudget: Number(value.epochBudget), parentTerminalRule: value.parentTerminalRule, optimizerConfigSha256: value.optimizerConfigSha256, resourceProfileIdentity: value.resourceProfileIdentity } }
}

export function executeAiConsoleTrainingDesignRegistryCommand(input: ParsedTrainingDesignCommand, session: VerifiedOperatorSession): AiConsoleTrainingDesignCommandResult {
  const common = {
    expectedRegistryRevision: input.expectedRegistryRevision,
    idempotencyKeySha256: sha256(input.idempotencyKey),
    reasonText: input.reasonText,
    actorIdentity: session.actorIdentity,
    role: session.role,
    requestedAtUtc: new Date().toISOString(),
  } as const
  const storeInput: AiConsoleTrainingDesignCommandInput = input.commandType === "register_model_structure"
    ? { ...common, commandType: input.commandType, capabilityDomain: input.capabilityDomain, modelFamily: input.modelFamily, architectureDefinitionSha256: input.architectureDefinitionSha256, sourceCodeSha256: input.sourceCodeSha256, inputConditionSchemaId: input.inputConditionSchemaId, outputSchemaId: input.outputSchemaId, parameterCount: input.parameterCount }
    : { ...common, commandType: input.commandType, capabilityDomain: input.capabilityDomain, modelStructureId: input.modelStructureId, datasetReleaseIdentity: input.datasetReleaseIdentity, splitIdentity: input.splitIdentity, randomSeed: input.randomSeed, nativeResolution: input.nativeResolution, epochBudget: input.epochBudget, parentTerminalRule: input.parentTerminalRule, optimizerConfigSha256: input.optimizerConfigSha256, resourceProfileIdentity: input.resourceProfileIdentity }
  return executeAiConsoleTrainingDesignCommand(storeInput)
}

function sha256(value: string): string { return createHash("sha256").update(value, "utf8").digest("hex") }
function isSha256(value: unknown): value is string { return typeof value === "string" && /^[a-f0-9]{64}$/u.test(value) }
function isRegisteredIdentity(value: unknown): value is string { return typeof value === "string" && /^[A-Za-z0-9][A-Za-z0-9._:/-]{2,159}$/u.test(value) }
function isBoundedText(value: unknown, minimum: number, maximum: number): value is string { return typeof value === "string" && value === value.trim() && value.length >= minimum && value.length <= maximum && !/[\u0000-\u001f\u007f]/u.test(value) }
function isPlainRecord(value: unknown): value is Record<string, unknown> { return typeof value === "object" && value !== null && !Array.isArray(value) }
