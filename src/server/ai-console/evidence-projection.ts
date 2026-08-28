import { createNotConnectedProjection, createProjection, type AiConsoleProjectionResult } from "./projection-contract"
import { isAiConsoleControlEventLedgerInitialized } from "@/server/ai-console-control/control-event-ledger"
import { isAiConsoleControlTransactionStoreInitialized } from "@/server/ai-console-control/control-transaction-store"
import { isAiConsoleFormalEvidenceIndexInitialized } from "@/server/ai-console-control/formal-evidence-index"
import { queryAiConsoleControlEventProjection } from "./control-event-projection"
import { queryAiConsoleControlTransactionProjection } from "./control-transaction-projection"
import { queryAiConsoleFormalEvidenceProjection } from "./formal-evidence-projection"

const governanceContractRevision = 1

const evidenceTypeRecords = [
  evidenceType("source_artifact", ["sourceIdentity", "sourceVersion", "contentSha256"], "content_addressed_append_only", "hash_and_source_must_match", "retain_with_all_derived_assets"),
  evidenceType("dataset_release", ["datasetReleaseIdentity", "datasetSha256", "licenseIdentity"], "immutable_release_record", "release_identity_is_recomputed", "retain_with_dependent_capabilities"),
  evidenceType("model_asset", ["modelIdentity", "modelStateSha256", "capabilityVersionId"], "immutable_versioned_asset", "model_and_lineage_hashes_must_match", "retain_with_release_and_rollback_chain"),
  evidenceType("task_capsule", ["capsuleId", "taskId", "terminalStatus"], "immutable_terminal_capsule", "task_event_and_result_bindings_must_match", "retain_for_task_lifecycle"),
  evidenceType("event_record", ["eventId", "eventSequence", "transactionId"], "monotonic_append_only", "event_sequence_and_transaction_must_match", "retain_without_sequence_reuse"),
  evidenceType("transaction_record", ["transactionId", "registryRevision", "recoveryStatus"], "append_only_recovery_record", "file_event_and_index_commits_must_reconcile", "retain_success_failure_and_recovery"),
  evidenceType("policy_boundary_report", ["policyBoundaryReportId", "failureCode", "affectedScope"], "immutable_failure_closure", "prohibited_action_and_safe_alternative_required", "retain_with_blocked_route"),
  evidenceType("runtime_frame", ["runtimeFrameIdentity", "worldId", "tick"], "append_only_formal_runtime_record", "schema_world_facts_and_publish_bindings_must_match", "retain_with_world_rollback_chain"),
] as const

const transactionGateRecords = [
  transactionGate("identity_preparation", 1, "registry", "stable_transaction_identity_and_expected_revision_required"),
  transactionGate("immutable_file_commit", 2, "immutable_file", "content_hash_and_logical_path_must_be_verified"),
  transactionGate("event_append", 3, "event_ledger", "event_sequence_must_be_monotonic_and_bind_transaction"),
  transactionGate("sqlite_index_commit", 4, "sqlite_index", "index_revision_must_bind_same_file_and_event"),
  transactionGate("current_pointer_commit", 5, "current_pointer", "pointer_changes_only_after_file_event_and_index_commit"),
  transactionGate("post_commit_reconciliation", 6, "reconciliation", "all_commit_surfaces_must_recompute_same_identity"),
  transactionGate("bounded_recovery", 7, "recovery", "partial_commit_uses_registered_recovery_point"),
  transactionGate("conflict_failure_closure", 8, "conflict", "unresolved_conflict_returns_unknown_or_stale"),
] as const

const policyRuleRecords = [
  policyRule("long_term_business_goal", "change_long_term_business_goal_without_registered_contract", "preserve_current_goal_and_emit_boundary_report"),
  policyRule("source_and_license", "use_unregistered_or_incompatible_source_license", "exclude_source_and_select_registered_licensed_input"),
  policyRule("external_cost", "incur_unregistered_external_cost", "remain_local_or_use_registered_budgeted_resource"),
  policyRule("irreversible_operation", "perform_unrecoverable_destructive_action_without_scope_contract", "stop_before_write_and_propose_recoverable_operation"),
  policyRule("safety_upper_bound", "raise_or_bypass_registered_safety_limit", "keep_limit_and_close_affected_route"),
  policyRule("audit_integrity", "delete_failure_evidence_or_rewrite_audit_truth", "preserve_all_evidence_and_record_conflict"),
] as const

function evidenceType(
  evidenceTypeId: string,
  requiredIdentityFields: readonly string[],
  immutabilityRule: string,
  integrityRule: string,
  retentionRule: string,
) {
  return {
    evidenceTypeId: `evidence_type:${evidenceTypeId}`,
    requiredIdentityFields,
    immutabilityRule,
    integrityRule,
    retentionRule,
    evidenceId: null,
  }
}

function transactionGate(
  gateId: string,
  gateOrder: number,
  commitSurface: string,
  consistencyRequirement: string,
) {
  return {
    transactionGateId: `transaction_gate:${gateId}`,
    gateOrder,
    commitSurface,
    consistencyRequirement,
    failureTerminal: "failure_closed",
    transactionId: null,
  }
}

function policyRule(
  boundaryCategory: string,
  prohibitedAction: string,
  safeAlternativeRequirement: string,
) {
  return {
    policyRuleId: `policy_rule:${boundaryCategory}`,
    boundaryCategory,
    prohibitedAction,
    failureTerminal: "blocked_policy_boundary",
    preservationRequirement: "preserve_current_formal_state_and_all_failure_evidence",
    safeAlternativeRequirement,
    policyBoundaryReportId: null,
  }
}

function governanceProvenance(sourceIdentity: string) {
  return {
    sourceIdentity,
    writerIdentity: "source_controlled_product_catalog",
    observedAtUtc: new Date().toISOString(),
    sourceRevision: governanceContractRevision,
    evidenceReferences: [
      "docs/BUSINESS_SPEC.md",
      "docs/ARCHITECTURE.md",
      "docs/LOCAL_SELF_DEVELOPED_AI_CAPABILITY_AND_CODEX_MIGRATION_ARCHITECTURE.md",
      "docs/ai-console/AI_CONSOLE_DATA_DICTIONARY_AND_API_CONTRACT.md",
    ],
    trustStatus: "verified_registry" as const,
  }
}

export function getAiConsoleEvidenceProjectionAvailability(workspaceSlug: string): "connected" | "partial" | "not_connected" {
  if (workspaceSlug === "artifacts") return isAiConsoleFormalEvidenceIndexInitialized() ? "connected" : "not_connected"
  if (workspaceSlug === "events") return isAiConsoleControlEventLedgerInitialized() ? "connected" : "not_connected"
  if (workspaceSlug === "transactions" && isAiConsoleControlTransactionStoreInitialized()) return "connected"
  return workspaceSlug === "transactions" || workspaceSlug === "policies" ? "partial" : "not_connected"
}

export async function queryAiConsoleEvidenceProjection(
  workspaceSlug: string,
  selectedView: string,
): Promise<AiConsoleProjectionResult> {
  if (workspaceSlug === "artifacts") return queryEvidenceTypeProjection(selectedView)
  if (workspaceSlug === "events") return queryAiConsoleControlEventProjection()
  if (workspaceSlug === "transactions") return selectedView === "控制提交事务" ? queryAiConsoleControlTransactionProjection() : queryTransactionGateProjection(selectedView)
  if (workspaceSlug === "policies") return queryPolicyRuleProjection()
  return createNotConnectedProjection()
}

async function queryEvidenceTypeProjection(selectedView: string): Promise<AiConsoleProjectionResult> {
  if (selectedView === "正式证据记录") {
    return queryAiConsoleFormalEvidenceProjection()
  }

  return createProjection({
    ...governanceProvenance("ai_console_evidence_type_contract_catalog_v1"),
    dataStatus: "partial",
    reasonCode: "formal_evidence_records_are_separate_view",
    unavailableFields: ["evidenceId", "evidenceSequence", "registrationId", "logicalPath", "contentByteLength", "contentSha256", "sourceRevision", "sourceBindingSha256", "transactionId", "commandId", "registeredAtUtc", "previousEvidenceRecordSha256", "evidenceRecordSha256"],
    records: evidenceTypeRecords.map((record) => ({
      ...record,
      evidenceType: record.evidenceTypeId,
      logicalPath: null,
      integrityStatus: null,
    })),
  })
}

function queryTransactionGateProjection(selectedView: string): AiConsoleProjectionResult {
  let records: readonly (typeof transactionGateRecords)[number][] = transactionGateRecords
  if (selectedView === "文件与事件") records = transactionGateRecords.slice(1, 3)
  if (selectedView === "SQLite一致性") records = transactionGateRecords.slice(2, 6)
  if (selectedView === "恢复与冲突") records = transactionGateRecords.slice(5)

  return createProjection({
    ...governanceProvenance("ai_console_recoverable_transaction_gate_catalog_v1"),
    dataStatus: "partial",
    reasonCode: "recoverable_transaction_index_not_joined",
    unavailableFields: ["transactionId", "transactionSequence", "commandId", "eventId", "commitSurfaceSet", "commitStatus", "recoveryStatus", "receiptPath", "receiptSha256", "eventSequence", "eventSha256", "eventLedgerRevision", "committedAtUtc", "previousTransactionSha256", "transactionRecordSha256"],
    records,
  })
}

function queryPolicyRuleProjection(): AiConsoleProjectionResult {
  return createProjection({
    ...governanceProvenance("ai_console_policy_boundary_rule_catalog_v1"),
    dataStatus: "partial",
    reasonCode: "policy_boundary_report_index_not_joined",
    unavailableFields: ["policyBoundaryReportId"],
    records: policyRuleRecords,
  })
}
