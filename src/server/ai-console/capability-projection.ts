import { aiCapabilityDomains } from "@/app/ai-console/ai-console-catalog"
import {
  aiConsoleQualificationGates,
  capabilityLifecycleStoreLogicalPath,
  readAiConsoleCapabilityLifecycleStore,
  type AiConsoleCapabilityLifecycleRead,
  type AiConsoleCapabilityQualificationRecord,
} from "@/server/ai-console-control/capability-lifecycle-store"
import { readAiConsoleRuntimeReleaseRegistryStore } from "@/server/ai-console-control/runtime-release-registry-store"
import { createNotConnectedProjection, createProjection, createUnknownOrStaleProjection, type AiConsoleProjectionResult } from "./projection-contract"

const capabilityDirectoryRevision = 1

const qualificationRequirements = {
  cpu_contract: "deterministic_cpu_contract_evidence",
  readonly_gpu: "readonly_gpu_qualification_evidence",
  controlled_smoke: "controlled_smoke_terminal_evidence",
  formal_stage: "formal_stage_terminal_evidence",
  independent_regression: "independent_regression_evidence",
  machine_release_adjudication: "atomic_machine_release_adjudication",
} as const

export function getAiConsoleCapabilityProjectionAvailability(workspaceSlug: string): "connected" | "partial" | "not_connected" {
  if (workspaceSlug === "candidates" || workspaceSlug === "releases" || workspaceSlug === "migration") return "connected"
  if (workspaceSlug === "domains" || workspaceSlug === "qualification") return "partial"
  return "not_connected"
}

export async function queryAiConsoleCapabilityProjection(workspaceSlug: string, selectedView?: string): Promise<AiConsoleProjectionResult> {
  if (workspaceSlug === "domains") return queryCapabilityDomains()
  if (workspaceSlug === "qualification" && selectedView === "资格阶段图") return queryQualificationContract()
  if (workspaceSlug === "migration" && selectedView === "迁移门禁") return queryMigrationContract()
  if (!["candidates", "qualification", "releases", "migration"].includes(workspaceSlug)) return createNotConnectedProjection()

  const store = readAiConsoleCapabilityLifecycleStore()
  if (store.status !== "connected") {
    if (store.status === "not_connected") return createNotConnectedProjection(store.reasonCode)
    return createUnknownOrStaleProjection({
      sourceIdentity: "ai_console_capability_lifecycle_registry",
      writerIdentity: "ai_console_capability_lifecycle_writer_v1",
      reasonCode: store.reasonCode,
      evidenceReferences: store.evidenceReferences,
    })
  }
  if (workspaceSlug === "candidates") return queryCandidates(store, selectedView)
  if (workspaceSlug === "qualification") return queryQualifications(store, selectedView)
  if (workspaceSlug === "releases") return queryReleases(store, selectedView)
  return queryMigrationAssessments(store, selectedView)
}

function queryCapabilityDomains(): AiConsoleProjectionResult {
  return createProjection({
    dataStatus: "partial",
    sourceIdentity: "ai_console_capability_domain_catalog_v1",
    writerIdentity: "source_controlled_product_catalog",
    observedAtUtc: new Date().toISOString(),
    sourceRevision: capabilityDirectoryRevision,
    evidenceReferences: [
      "docs/ai-console/AI_CONSOLE_FORMAL_PRODUCT_AND_INFORMATION_ARCHITECTURE_SPEC.md",
      "src/app/ai-console/ai-console-catalog.ts",
      capabilityLifecycleStoreLogicalPath,
    ],
    trustStatus: "verified_registry",
    reasonCode: "machine_migration_acceptance_registry_empty",
    unavailableFields: ["maturityLevel", "migrationAssessmentId"],
    records: aiCapabilityDomains.map((domain) => ({
      capabilityDomain: domain.id,
      displayNameZh: domain.name,
      modalities: domain.modalities,
      responsibilityBoundary: domain.description,
      adoptionStatus: domain.status,
      maturityLevel: null,
      migrationAssessmentId: null,
    })),
  })
}

function queryCandidates(store: ConnectedCapabilityStore, selectedView?: string): AiConsoleProjectionResult {
  let records = store.candidates
  if (selectedView === "父子血缘") records = records.filter((record) => record.parentCapabilityVersionId !== null)
  if (selectedView === "资格阶段") records = records.filter((record) => record.qualificationStage !== "not_started")
  return lifecycleProjection(store, records)
}

function queryQualifications(store: ConnectedCapabilityStore, selectedView?: string): AiConsoleProjectionResult {
  if (selectedView === "当前门禁") {
    const records = store.candidates
      .filter((candidate) => candidate.candidateStatus === "registered" || candidate.candidateStatus === "qualifying")
      .map((candidate) => {
        const completed = store.qualifications.filter((record) => record.capabilityVersionId === candidate.capabilityVersionId)
        const qualificationGateId = aiConsoleQualificationGates[completed.length]
        return {
          qualificationResultId: null,
          qualificationGateId,
          capabilityVersionId: candidate.capabilityVersionId,
          gateOrder: qualificationGateId ? aiConsoleQualificationGates.indexOf(qualificationGateId) + 1 : null,
          qualificationStatus: "pending",
          evidenceRequirement: qualificationGateId ? qualificationRequirements[qualificationGateId] : null,
          evidenceSha256: null,
          failureTerminal: "failure_closed",
          qualifiedAtUtc: null,
          qualificationRecordSha256: null,
        }
      })
    return lifecycleProjection(store, records)
  }
  let records: readonly AiConsoleCapabilityQualificationRecord[] = store.qualifications
  if (selectedView === "失败终态") records = records.filter((record) => record.qualificationStatus === "failed")
  if (selectedView === "发布准入") records = records.filter((record) => record.qualificationGateId === "machine_release_adjudication" && record.qualificationStatus === "passed")
  return lifecycleProjection(store, records)
}

function queryQualificationContract(): AiConsoleProjectionResult {
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
    reasonCode: "qualification_contract_view",
    unavailableFields: ["qualificationResultId", "capabilityVersionId", "evidenceSha256", "qualifiedAtUtc", "qualificationRecordSha256"],
    records: aiConsoleQualificationGates.map((qualificationGateId, index) => ({
      qualificationResultId: null,
      qualificationGateId,
      capabilityVersionId: null,
      gateOrder: index + 1,
      qualificationStatus: "contract_required",
      evidenceRequirement: qualificationRequirements[qualificationGateId],
      evidenceSha256: null,
      failureTerminal: "failure_closed",
      qualifiedAtUtc: null,
      qualificationRecordSha256: null,
    })),
  })
}

function queryReleases(store: ConnectedCapabilityStore, selectedView?: string): AiConsoleProjectionResult {
  const runtimeStore = readAiConsoleRuntimeReleaseRegistryStore()
  if (runtimeStore.status !== "connected") {
    return createUnknownOrStaleProjection({
      sourceIdentity: "ai_console_capability_lifecycle_and_runtime_release_join_v1",
      writerIdentity: "ai_console_runtime_release_registry_writer_v1",
      reasonCode: runtimeStore.reasonCode,
      evidenceReferences: [...store.evidenceReferences, ...runtimeStore.evidenceReferences],
    })
  }
  const currentActivationByDomain = new Map(runtimeStore.activations.map((activation) => [activation.capabilityDomain, activation]))
  const activationByRelease = new Map(runtimeStore.activations.map((activation) => [activation.capabilityReleaseIdentity, activation]))
  let records = store.releases.map((record) => {
    const activation = activationByRelease.get(record.capabilityReleaseIdentity)
    const currentActivation = currentActivationByDomain.get(record.capabilityDomain)
    return {
      ...record,
      releaseStatus: currentActivation?.capabilityReleaseIdentity === record.capabilityReleaseIdentity
        ? "active"
        : activation ? "superseded" : "registered_inactive",
      activationId: activation?.activationId ?? null,
      activatedAtUtc: activation?.activatedAtUtc ?? null,
      activationRecordSha256: activation?.activationRecordSha256 ?? null,
    }
  })
  if (selectedView === "活动发布") records = records.filter((record) => record.releaseStatus === "active")
  if (selectedView === "前序版本") records = records.filter((record) => record.previousReleaseIdentity !== null)
  if (selectedView === "回退关系") records = records.filter((record) => record.rollbackReleaseIdentity !== null)
  return createProjection({
    sourceIdentity: "ai_console_capability_lifecycle_and_runtime_release_join_v1",
    writerIdentity: runtimeStore.metadata.writerIdentity,
    observedAtUtc: runtimeStore.metadata.updatedAtUtc,
    sourceRevision: store.metadata.registryRevision + runtimeStore.metadata.registryRevision,
    evidenceReferences: [...store.evidenceReferences, ...runtimeStore.evidenceReferences],
    trustStatus: "verified_registry",
    records,
  })
}

function queryMigrationAssessments(store: ConnectedCapabilityStore, selectedView?: string): AiConsoleProjectionResult {
  let records = store.migrationAssessments
  if (selectedView === "依赖退出") records = records.filter((record) => record.externalDependency === "none")
  if (selectedView === "回退准备") records = records.filter((record) => Boolean(record.rollbackIdentity))
  return lifecycleProjection(store, records)
}

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

function queryMigrationContract(): AiConsoleProjectionResult {
  return createProjection({
    dataStatus: "partial",
    sourceIdentity: "ai_console_local_capability_migration_contract_v1",
    writerIdentity: "source_controlled_product_catalog",
    observedAtUtc: new Date().toISOString(),
    sourceRevision: 1,
    evidenceReferences: [
      "docs/LOCAL_SELF_DEVELOPED_AI_CAPABILITY_AND_CODEX_MIGRATION_ARCHITECTURE.md#13-能力成熟度框架",
      "docs/LOCAL_SELF_DEVELOPED_AI_CAPABILITY_AND_CODEX_MIGRATION_ARCHITECTURE.md#15-每项能力的迁移条件",
    ],
    trustStatus: "verified_registry",
    reasonCode: "migration_machine_acceptance_contract_view",
    unavailableFields: ["migrationAssessmentId", "currentMaturityLevel", "machineAcceptanceStatus", "rollbackIdentity", "assessedAtUtc", "assessmentRecordSha256"],
    records: migrationConditions.map((condition, index) => ({
      migrationAssessmentId: null,
      capabilityId: `migration_gate:${String(index + 1).padStart(2, "0")}`,
      capabilityDomain: null,
      currentMaturityLevel: null,
      targetMaturityLevel: "L5",
      externalDependency: condition,
      machineAcceptanceStatus: null,
      rollbackIdentity: null,
      assessedAtUtc: null,
      assessmentRecordSha256: null,
    })),
  })
}

function lifecycleProjection(store: ConnectedCapabilityStore, records: readonly Record<string, unknown>[]): AiConsoleProjectionResult {
  return createProjection({
    sourceIdentity: "ai_console_capability_lifecycle_registry",
    writerIdentity: store.metadata.writerIdentity,
    observedAtUtc: new Date().toISOString(),
    sourceRevision: store.metadata.registryRevision,
    evidenceReferences: store.evidenceReferences,
    trustStatus: "verified_registry",
    records,
  })
}

type ConnectedCapabilityStore = Extract<AiConsoleCapabilityLifecycleRead, { status: "connected" }>
