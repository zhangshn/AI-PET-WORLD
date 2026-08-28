import { aiConsoleModules } from "@/app/ai-console/ai-console-catalog"
import { getAiConsoleWorkspaces } from "@/app/ai-console/ai-console-workspace-catalog"
import { createNotConnectedProjection, createProjection, type AiConsoleProjectionResult } from "./projection-contract"

type DictionaryRecord = {
  dictionaryEntryId: string
  canonicalName: string
  displayNameZh: string
  dataType: string
  sourceOfTruth: string
  supersededBy: string | null
  moduleSlug: string
  workspaceSlug: string
  dictionaryRevision: number
}

const dictionaryRevision = 1
const dataGovernanceRevision = 1

const releaseGateRecords = [
  releaseGate("source_identity", 1, "all_sources_have_stable_identity_and_version", "source_registry_and_content_hash"),
  releaseGate("license_and_usage", 2, "license_and_intended_use_are_explicit", "license_identity_and_usage_record"),
  releaseGate("schema_compatibility", 3, "records_validate_against_registered_schema", "schema_validation_report"),
  releaseGate("split_isolation", 4, "training_validation_test_and_challenge_splits_are_isolated", "split_manifest_and_leakage_report"),
  releaseGate("capacity_and_uniqueness", 5, "qualified_capacity_and_unique_identity_are_recomputed", "capacity_report_and_duplicate_report"),
  releaseGate("quality_qualification", 6, "all_required_quality_gates_have_machine_results", "quality_report_identity_set"),
  releaseGate("atomic_release", 7, "release_identity_is_recomputed_and_atomically_registered", "dataset_release_transaction_evidence"),
] as const

const conditionSchemaRecords = [
  conditionSchema("structured_world_facts_v1", ["worldId", "regionId", "tick", "factHash"], "structured", "schema_defined_per_field", "required_identity_fields_fail_closed", "not_applicable"),
  conditionSchema("image_conditioning_v1", ["semanticLayers", "spatialMasks", "layoutConstraints"], "structured", "normalized_per_registered_channel", "required_channels_fail_closed", "schema_versioned_spatial_resampling"),
  conditionSchema("text_language_conditioning_v1", ["language", "instruction", "contextRefs"], "structured", "unicode_and_schema_constrained", "required_language_and_instruction_fail_closed", "not_applicable"),
  conditionSchema("speech_audio_conditioning_v1", ["sampleRate", "channelLayout", "audioFeatures"], "structured", "registered_numeric_ranges", "required_audio_contract_fields_fail_closed", "schema_versioned_audio_resampling"),
  conditionSchema("video_conditioning_v1", ["frameRate", "duration", "frameConditions"], "structured", "registered_temporal_ranges", "required_timeline_fields_fail_closed", "schema_versioned_temporal_resampling"),
  conditionSchema("multimodal_conditioning_v1", ["modalityBindings", "alignmentIdentity", "worldFactRefs"], "structured", "registered_per_modality", "missing_required_modality_fails_closed", "registered_alignment_contract_only"),
] as const

const qualityGateRecords = [
  qualityGate("completeness", "completeness", "required_fields_and_artifacts_are_present", "all_registered_modalities"),
  qualityGate("consistency", "consistency", "identity_schema_and_relation_bindings_are_consistent", "all_registered_modalities"),
  qualityGate("distribution", "distribution", "split_and_class_distribution_report_is_available", "training_eligible_modalities"),
  qualityGate("duplicate", "duplicate", "content_and_semantic_duplicates_are_checked", "all_registered_modalities"),
  qualityGate("leakage", "leakage", "cross_split_identity_and_content_leakage_are_checked", "training_eligible_modalities"),
  qualityGate("drift", "drift", "release_to_release_distribution_drift_is_measured", "versioned_modalities"),
  qualityGate("anomaly", "anomaly", "outliers_and_invalid_records_are_classified", "all_registered_modalities"),
] as const

function releaseGate(
  gateId: string,
  gateOrder: number,
  qualificationRequirement: string,
  evidenceRequirement: string,
) {
  return {
    releaseGateId: `dataset_release_gate:${gateId}`,
    gateOrder,
    qualificationRequirement,
    evidenceRequirement,
    failureTerminal: "failure_closed",
    datasetReleaseIdentity: null,
  }
}

function conditionSchema(
  schemaId: string,
  fieldOrChannelOrder: readonly string[],
  dataType: string,
  valueRange: string,
  missingValueRule: string,
  resamplingRule: string,
) {
  return {
    conditionSchemaId: `ai_console:${schemaId}`,
    fieldOrChannelOrder,
    dataType,
    valueRange,
    missingValueRule,
    resamplingRule,
  }
}

function qualityGate(
  gateId: string,
  qualityDimension: string,
  evaluationRequirement: string,
  modalityScope: string,
) {
  return {
    qualityGateId: `dataset_quality_gate:${gateId}`,
    qualityDimension,
    evaluationRequirement,
    failureTerminal: "failure_closed",
    modalityScope,
    qualityReportId: null,
  }
}

function dictionaryProvenance() {
  return {
    sourceIdentity: "ai_console_workspace_dictionary_v1",
    writerIdentity: "source_controlled_product_catalog",
    observedAtUtc: new Date().toISOString(),
    sourceRevision: dictionaryRevision,
    evidenceReferences: [
      "docs/ai-console/AI_CONSOLE_DATA_DICTIONARY_AND_API_CONTRACT.md",
      "src/app/ai-console/ai-console-workspace-catalog.ts",
    ],
    trustStatus: "verified_registry" as const,
  }
}

function workspaceDefinitions() {
  return aiConsoleModules.flatMap((consoleModule) => getAiConsoleWorkspaces(consoleModule.slug))
}

function entityRecords(): DictionaryRecord[] {
  return workspaceDefinitions().map((workspace) => ({
    dictionaryEntryId: `entity:${workspace.moduleSlug}/${workspace.slug}:${workspace.primaryEntity}`,
    canonicalName: workspace.primaryEntity,
    displayNameZh: workspace.title,
    dataType: "entity",
    sourceOfTruth: workspace.sourceOfTruth,
    supersededBy: null,
    moduleSlug: workspace.moduleSlug,
    workspaceSlug: workspace.slug,
    dictionaryRevision,
  }))
}

function fieldRecords(): DictionaryRecord[] {
  return workspaceDefinitions().flatMap((workspace) => workspace.fields.map((field) => ({
    dictionaryEntryId: `field:${workspace.moduleSlug}/${workspace.slug}:${field.canonicalName}`,
    canonicalName: field.canonicalName,
    displayNameZh: field.displayName,
    dataType: field.dataType,
    sourceOfTruth: workspace.sourceOfTruth,
    supersededBy: null,
    moduleSlug: workspace.moduleSlug,
    workspaceSlug: workspace.slug,
    dictionaryRevision,
  })))
}

export function getAiConsoleDataProjectionAvailability(workspaceSlug: string): "connected" | "partial" | "not_connected" {
  if (workspaceSlug === "dictionary" || workspaceSlug === "conditions") return "connected"
  if (workspaceSlug === "releases" || workspaceSlug === "quality") return "partial"
  return "not_connected"
}

export async function queryAiConsoleDataProjection(workspaceSlug: string, selectedView: string): Promise<AiConsoleProjectionResult> {
  if (workspaceSlug === "releases") return queryReleaseGateProjection(selectedView)
  if (workspaceSlug === "conditions") return queryConditionSchemaProjection()
  if (workspaceSlug === "quality") return queryQualityGateProjection(selectedView)
  if (workspaceSlug !== "dictionary") return createNotConnectedProjection()

  const provenance = dictionaryProvenance()
  const allFields = fieldRecords()
  let records: readonly DictionaryRecord[]
  let dataStatus: "connected" | "partial" = "connected"
  let reasonCode: string | null = null

  if (selectedView === "实体目录") {
    records = entityRecords()
  } else if (selectedView === "枚举与单位") {
    records = allFields.filter((record) => record.dataType === "enum" || record.dataType === "scalar")
    dataStatus = "partial"
    reasonCode = "unit_registry_not_connected"
  } else {
    records = allFields
  }

  return createProjection({
    ...provenance,
    dataStatus,
    reasonCode,
    records,
  })
}

function dataGovernanceProvenance(sourceIdentity: string, evidenceReferences: readonly string[]) {
  return {
    sourceIdentity,
    writerIdentity: "source_controlled_product_catalog",
    observedAtUtc: new Date().toISOString(),
    sourceRevision: dataGovernanceRevision,
    evidenceReferences,
    trustStatus: "verified_registry" as const,
  }
}

function queryReleaseGateProjection(selectedView: string): AiConsoleProjectionResult {
  if (selectedView === "正式发布记录") {
    return createNotConnectedProjection("dataset_release_registry_not_connected")
  }

  let records: readonly (typeof releaseGateRecords)[number][] = releaseGateRecords
  if (selectedView === "来源与许可") records = releaseGateRecords.slice(0, 2)
  if (selectedView === "容量与Split") records = releaseGateRecords.slice(2, 5)

  return createProjection({
    ...dataGovernanceProvenance("ai_console_dataset_release_gate_catalog_v1", [
      "docs/ai-console/AI_CONSOLE_FORMAL_PRODUCT_AND_INFORMATION_ARCHITECTURE_SPEC.md",
      "docs/ai-console/AI_CONSOLE_DATA_DICTIONARY_AND_API_CONTRACT.md",
      "docs/ARCHITECTURE.md",
    ]),
    dataStatus: "partial",
    reasonCode: "dataset_release_registry_not_joined",
    unavailableFields: ["datasetReleaseIdentity"],
    records,
  })
}

function queryConditionSchemaProjection(): AiConsoleProjectionResult {
  return createProjection({
    ...dataGovernanceProvenance("ai_console_multimodal_condition_schema_catalog_v1", [
      "docs/ai-console/AI_CONSOLE_FORMAL_PRODUCT_AND_INFORMATION_ARCHITECTURE_SPEC.md",
      "docs/ai-console/AI_CONSOLE_DATA_DICTIONARY_AND_API_CONTRACT.md",
    ]),
    records: conditionSchemaRecords,
  })
}

function queryQualityGateProjection(selectedView: string): AiConsoleProjectionResult {
  let records: readonly (typeof qualityGateRecords)[number][] = qualityGateRecords
  if (selectedView === "完整性与一致性") records = qualityGateRecords.slice(0, 3)
  if (selectedView === "重复与泄漏") records = qualityGateRecords.slice(3, 5)
  if (selectedView === "漂移与异常") records = qualityGateRecords.slice(5)

  return createProjection({
    ...dataGovernanceProvenance("ai_console_dataset_quality_gate_catalog_v1", [
      "docs/ai-console/AI_CONSOLE_FORMAL_PRODUCT_AND_INFORMATION_ARCHITECTURE_SPEC.md",
      "docs/ai-console/AI_CONSOLE_DATA_DICTIONARY_AND_API_CONTRACT.md",
      "docs/ARCHITECTURE.md",
    ]),
    dataStatus: "partial",
    reasonCode: "dataset_quality_report_registry_not_joined",
    unavailableFields: ["qualityReportId"],
    records,
  })
}
