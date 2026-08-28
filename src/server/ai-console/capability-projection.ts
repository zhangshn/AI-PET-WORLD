import { aiCapabilityDomains } from "@/app/ai-console/ai-console-catalog"
import { createNotConnectedProjection, createProjection, type AiConsoleProjectionResult } from "./projection-contract"

const capabilityDirectoryRevision = 1

export function getAiConsoleCapabilityProjectionAvailability(workspaceSlug: string): "partial" | "not_connected" {
  return workspaceSlug === "domains" || workspaceSlug === "qualification" || workspaceSlug === "migration" ? "partial" : "not_connected"
}

export async function queryAiConsoleCapabilityProjection(workspaceSlug: string, selectedView?: string): Promise<AiConsoleProjectionResult> {
  if (workspaceSlug === "qualification") return queryQualificationContract(selectedView)
  if (workspaceSlug === "migration") return queryMigrationContract(selectedView)
  if (workspaceSlug !== "domains") return createNotConnectedProjection()
  const observedAtUtc = new Date().toISOString()

  return createProjection({
    dataStatus: "partial",
    sourceIdentity: "ai_console_capability_domain_catalog_v1",
    writerIdentity: "source_controlled_product_catalog",
    observedAtUtc,
    sourceRevision: capabilityDirectoryRevision,
    evidenceReferences: [
      "docs/ai-console/AI_CONSOLE_FORMAL_PRODUCT_AND_INFORMATION_ARCHITECTURE_SPEC.md",
      "src/app/ai-console/ai-console-catalog.ts",
    ],
    trustStatus: "verified_registry",
    reasonCode: "capability_maturity_registry_not_connected",
    unavailableFields: ["maturityLevel"],
    records: aiCapabilityDomains.map((domain) => ({
      capabilityDomain: domain.id,
      displayNameZh: domain.name,
      modalities: domain.modalities,
      responsibilityBoundary: domain.description,
      adoptionStatus: domain.status,
      maturityLevel: null,
    })),
  })
}

const qualificationGateOrder = [
  ["cpu_contract", "deterministic_cpu_contract_evidence"],
  ["readonly_gpu", "readonly_gpu_qualification_evidence"],
  ["controlled_smoke", "controlled_smoke_terminal_evidence"],
  ["formal_stage", "formal_stage_terminal_evidence"],
  ["independent_regression", "independent_regression_evidence"],
  ["machine_release_adjudication", "atomic_machine_release_adjudication"],
] as const

function qualificationGateRecord(gateId: string, evidenceRequirement: string, gateOrder: number) {
  return {
    qualificationGateId: `qualification_gate:${gateId}`,
    capabilityVersionId: null,
    gateOrder,
    qualificationStatus: "contract_required",
    evidenceRequirement,
    failureTerminal: "failure_closed",
  }
}

function queryQualificationContract(selectedView?: string): AiConsoleProjectionResult {
  if (selectedView === "当前门禁") {
    return createNotConnectedProjection("capability_version_qualification_registry_not_connected")
  }

  let gates: readonly (readonly [string, string])[] = qualificationGateOrder
  if (selectedView === "发布准入") gates = qualificationGateOrder.slice(-2)
  if (selectedView === "失败终态") {
    return createProjection({
      dataStatus: "partial",
      sourceIdentity: "ai_console_capability_qualification_contract_v1",
      writerIdentity: "source_controlled_product_catalog",
      observedAtUtc: new Date().toISOString(),
      sourceRevision: 1,
      evidenceReferences: [
        "docs/ai-console/AI_CONSOLE_FORMAL_PRODUCT_AND_INFORMATION_ARCHITECTURE_SPEC.md#76-状态机分层",
        "docs/LOCAL_SELF_DEVELOPED_AI_CAPABILITY_AND_CODEX_MIGRATION_ARCHITECTURE.md#15-每项能力的迁移条件",
      ],
      trustStatus: "verified_registry",
      reasonCode: "capability_version_qualification_results_not_joined",
      unavailableFields: ["capabilityVersionId"],
      records: [{
        qualificationGateId: "qualification_terminal:failure_closed",
        capabilityVersionId: null,
        gateOrder: 0,
        qualificationStatus: "terminal_contract",
        evidenceRequirement: "failed_gate_evidence_must_be_preserved",
        failureTerminal: "failure_closed",
      }],
    })
  }

  return createProjection({
    dataStatus: "partial",
    sourceIdentity: "ai_console_capability_qualification_contract_v1",
    writerIdentity: "source_controlled_product_catalog",
    observedAtUtc: new Date().toISOString(),
    sourceRevision: 1,
    evidenceReferences: [
      "docs/ai-console/AI_CONSOLE_FORMAL_PRODUCT_AND_INFORMATION_ARCHITECTURE_SPEC.md#76-状态机分层",
      "docs/LOCAL_SELF_DEVELOPED_AI_CAPABILITY_AND_CODEX_MIGRATION_ARCHITECTURE.md#15-每项能力的迁移条件",
    ],
    trustStatus: "verified_registry",
    reasonCode: "capability_version_qualification_results_not_joined",
    unavailableFields: ["capabilityVersionId"],
    records: gates.map(([gateId, evidenceRequirement]) => qualificationGateRecord(
      gateId,
      evidenceRequirement,
      qualificationGateOrder.findIndex(([registeredGateId]) => registeredGateId === gateId) + 1,
    )),
  })
}

const maturityDefinitions = [
  ["L0", "外部执行为主，本地无可靠记录"],
  ["L1", "本地完整记录但不能执行"],
  ["L2", "本地辅助执行，关键步骤仍依赖外部能力"],
  ["L3", "本地可执行，仍需外部逐项核验"],
  ["L4", "本地可执行、验证、记录、失败停止和恢复"],
  ["L5", "本地独立闭环，外部执行能力可完全离线"],
] as const

const migrationSequence = [
  "local_recording",
  "local_knowledge",
  "local_planning",
  "local_readonly_checks",
  "local_software_execution",
  "local_training_operations",
  "local_validation_review",
  "local_inference_generation",
  "local_runtime_interface",
  "external_execution_exit",
] as const

const migrationConditions = [
  "io_state_failure_contracts_defined",
  "independent_start_pause_stop_resume",
  "permission_secret_and_destructive_guards",
  "formal_path_locally_independent",
  "idempotent_automatic_recording",
  "failure_closure_and_evidence_preservation",
  "positive_negative_and_regression_tests",
  "shadow_comparison_available",
  "resource_and_cost_budget_passed",
  "rollback_and_recovery_drill",
  "source_license_and_dependency_declarations",
  "machine_acceptance_atomically_registered",
] as const

function queryMigrationContract(selectedView?: string): AiConsoleProjectionResult {
  let records: readonly Record<string, unknown>[]
  let unavailableFields: readonly string[] = ["rollbackIdentity"]

  if (selectedView === "能力成熟度") {
    records = maturityDefinitions.map(([level, definition]) => ({
      capabilityId: `maturity_definition:${level}`,
      currentMaturityLevel: level,
      targetMaturityLevel: level,
      externalDependency: definition,
      machineAcceptanceStatus: "definition_only",
      rollbackIdentity: null,
    }))
  } else if (selectedView === "迁移门禁") {
    unavailableFields = ["currentMaturityLevel", "machineAcceptanceStatus", "rollbackIdentity"]
    records = migrationConditions.map((condition, index) => ({
      capabilityId: `migration_gate:${String(index + 1).padStart(2, "0")}`,
      currentMaturityLevel: null,
      targetMaturityLevel: "L5",
      externalDependency: condition,
      machineAcceptanceStatus: null,
      rollbackIdentity: null,
    }))
  } else if (selectedView === "回退准备") {
    unavailableFields = ["currentMaturityLevel", "machineAcceptanceStatus", "rollbackIdentity"]
    records = [{
      capabilityId: "migration_rollback_contract",
      currentMaturityLevel: null,
      targetMaturityLevel: "L5",
      externalDependency: "rollback_version_and_recovery_drill_required_before_switch",
      machineAcceptanceStatus: null,
      rollbackIdentity: null,
    }]
  } else {
    unavailableFields = ["currentMaturityLevel", "machineAcceptanceStatus", "rollbackIdentity"]
    records = migrationSequence.map((capabilityId, index) => ({
      capabilityId: `migration_step:${String(index + 1).padStart(2, "0")}:${capabilityId}`,
      currentMaturityLevel: null,
      targetMaturityLevel: "L5",
      externalDependency: capabilityId === "external_execution_exit" ? "must_be_zero_for_mature_capabilities" : "machine_acceptance_required_before_exit",
      machineAcceptanceStatus: null,
      rollbackIdentity: null,
      migrationOrder: index + 1,
    }))
  }

  return createProjection({
    dataStatus: "partial",
    sourceIdentity: "ai_console_local_capability_migration_contract_v1",
    writerIdentity: "source_controlled_product_catalog",
    observedAtUtc: new Date().toISOString(),
    sourceRevision: 1,
    evidenceReferences: [
      "docs/LOCAL_SELF_DEVELOPED_AI_CAPABILITY_AND_CODEX_MIGRATION_ARCHITECTURE.md#13-能力成熟度框架",
      "docs/LOCAL_SELF_DEVELOPED_AI_CAPABILITY_AND_CODEX_MIGRATION_ARCHITECTURE.md#14-能力迁移顺序",
      "docs/LOCAL_SELF_DEVELOPED_AI_CAPABILITY_AND_CODEX_MIGRATION_ARCHITECTURE.md#15-每项能力的迁移条件",
    ],
    trustStatus: "verified_registry",
    reasonCode: "machine_migration_acceptance_registry_not_connected",
    unavailableFields,
    records,
  })
}
