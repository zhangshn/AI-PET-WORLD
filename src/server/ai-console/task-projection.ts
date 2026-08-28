import { createNotConnectedProjection, createProjection, type AiConsoleProjectionResult } from "./projection-contract"

type TaskFlowRecord = {
  flowDefinitionId: string
  capabilityDomain: string
  sourceState: string
  targetState: string
  transitionGuard: string
  failureTerminal: string
}

const taskFlowCatalogRevision = 1

const taskFlowViews: Readonly<Record<string, readonly TaskFlowRecord[]>> = {
  正常闭环: [
    flow("flow-read-facts", "facts_and_release_ready", "task_planned", "world_facts_and_capability_release_bound"),
    flow("flow-local-execution", "world_facts_and_capability_release_bound", "local_execution_active", "registered_task_identity_and_resource_contract_valid"),
    flow("flow-machine-adjudication", "local_execution_active", "machine_reviewed", "immutable_result_and_fixed_review_contract_available"),
    flow("flow-publish-or-rollback", "machine_reviewed", "published_or_rolled_back", "machine_release_gate_recomputed_from_evidence"),
    flow("flow-ledger-sync", "published_or_rolled_back", "evidence_synchronized", "file_event_and_index_transaction_consistent"),
  ],
  资格门禁: [
    flow("flow-input-qualification", "candidate_registered", "input_qualified", "source_license_schema_and_hash_valid"),
    flow("flow-machine-qualification", "input_qualified", "machine_qualified", "fixed_validation_and_review_nodes_pass"),
    flow("flow-release-qualification", "machine_qualified", "release_qualified", "immutable_release_identity_recomputed"),
  ],
  失败关闭: [
    flow("flow-validation-failure", "validation_active", "failure_closed", "fixed_validation_gate_failed"),
    flow("flow-evidence-conflict", "evidence_reconciliation", "failure_closed", "file_event_or_index_conflict_detected"),
    flow("flow-policy-boundary", "boundary_evaluation", "blocked_policy_boundary", "long_term_business_license_or_safety_boundary_reached"),
  ],
  回退关系: [
    flow("flow-release-rollback", "active_release", "previous_qualified_release", "registered_rollback_identity_and_target_revision_valid"),
    flow("flow-runtime-rollback", "active_runtime_frame", "previous_formal_runtime_frame", "runtime_gate_failed_and_previous_frame_remains_valid"),
  ],
}

function flow(
  flowDefinitionId: string,
  sourceState: string,
  targetState: string,
  transitionGuard: string,
): TaskFlowRecord {
  return {
    flowDefinitionId,
    capabilityDomain: "all_registered_domains",
    sourceState,
    targetState,
    transitionGuard,
    failureTerminal: "failure_closed",
  }
}

export function getAiConsoleTaskProjectionAvailability(workspaceSlug: string): "connected" | "not_connected" {
  return workspaceSlug === "flows" ? "connected" : "not_connected"
}

export async function queryAiConsoleTaskProjection(
  workspaceSlug: string,
  selectedView: string,
): Promise<AiConsoleProjectionResult> {
  if (workspaceSlug !== "flows") return createNotConnectedProjection()
  const records = taskFlowViews[selectedView]
  if (!records) return createNotConnectedProjection("task_flow_view_not_registered")

  return createProjection({
    sourceIdentity: "ai_console_autonomous_flow_catalog_v1",
    writerIdentity: "source_controlled_product_catalog",
    observedAtUtc: new Date().toISOString(),
    sourceRevision: taskFlowCatalogRevision,
    evidenceReferences: [
      "docs/BUSINESS_SPEC.md#01-本地自研ai原生业务闭环",
      "docs/ARCHITECTURE.md",
      "docs/ai-console/AI_CONSOLE_FUNCTIONAL_SPEC.md",
    ],
    trustStatus: "verified_registry",
    records,
  })
}
