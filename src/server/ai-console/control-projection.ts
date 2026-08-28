import { createProjection, type AiConsoleProjectionResult } from "./projection-contract"

const controlDefinitions = {
  tasks: [
    command("tasks", "start_registered_task", "registered_task", "operator", "task_start_validation_v1", "task_start_parameters_v1", "registered_task_only"),
    command("tasks", "pause_task_queue", "task_queue", "operator", "task_queue_transition_v1", "task_queue_pause_parameters_v1", "queue_safe_point_required"),
    command("tasks", "resume_task_queue", "task_queue", "operator", "task_queue_transition_v1", "task_queue_resume_parameters_v1", "expected_revision_required"),
    command("tasks", "cancel_unstarted_task", "queued_task", "operator", "task_cancel_validation_v1", "task_cancel_parameters_v1", "unstarted_task_only"),
  ],
  training: [
    command("training", "start_qualified_training", "training_plan", "operator", "training_admission_validation_v1", "training_start_parameters_v1", "qualified_plan_and_resource_window_required"),
    command("training", "pause_at_safe_point", "training_run", "operator", "training_safe_point_validation_v1", "training_pause_parameters_v1", "safe_point_only"),
    command("training", "resume_qualified_training", "training_run", "operator", "training_resume_validation_v1", "training_resume_parameters_v1", "checkpoint_and_registry_revision_required"),
    command("training", "safe_stop_training", "training_run", "operator", "training_safe_stop_validation_v1", "training_stop_parameters_v1", "preserve_checkpoint_and_failure_evidence"),
    command("training", "set_training_window", "resource_window", "system_administrator", "training_window_validation_v1", "training_window_parameters_v1", "registered_resource_limits_only"),
  ],
  reviews: [
    command("reviews", "verify_primary_registry", "primary_registry", "operator", "primary_registry_verification_v1", "primary_registry_verify_parameters_v1", "new_ai_console_registry_only", "ai_console_primary_registry_verifier_v1"),
    command("reviews", "start_formal_validation", "validation_input", "operator", "formal_validation_admission_v1", "validation_start_parameters_v1", "frozen_contract_required"),
    command("reviews", "rerun_readonly_review", "review_run", "operator", "readonly_review_validation_v1", "readonly_review_parameters_v1", "readonly_no_conclusion_override"),
    command("reviews", "rebuild_registered_projection", "projection_identity", "system_administrator", "projection_rebuild_validation_v1", "projection_rebuild_parameters_v1", "source_evidence_unchanged"),
    command("reviews", "verify_review_evidence", "evidence_set", "operator", "review_evidence_validation_v1", "evidence_verify_parameters_v1", "no_evidence_mutation"),
  ],
  capabilities: [
    command("capabilities", "activate_qualified_release", "capability_release", "operator", "capability_activation_validation_v1", "capability_activation_parameters_v1", "machine_qualification_required"),
    command("capabilities", "deactivate_release", "capability_release", "operator", "capability_deactivation_validation_v1", "capability_deactivation_parameters_v1", "preserve_rollback_chain"),
    command("capabilities", "rollback_capability_release", "capability_release", "operator", "capability_rollback_validation_v1", "capability_rollback_parameters_v1", "registered_rollback_only"),
    command("capabilities", "set_auto_update_policy", "capability_domain", "system_administrator", "capability_policy_validation_v1", "capability_policy_parameters_v1", "policy_boundary_unchanged"),
  ],
  world: [
    command("world", "pause_frame_publish", "world_runtime", "operator", "world_publish_transition_v1", "world_publish_pause_parameters_v1", "world_facts_unchanged"),
    command("world", "resume_frame_publish", "world_runtime", "operator", "world_publish_transition_v1", "world_publish_resume_parameters_v1", "expected_world_revision_required"),
    command("world", "rollback_runtime_frame", "runtime_frame", "operator", "runtime_frame_rollback_validation_v1", "runtime_frame_rollback_parameters_v1", "registered_formal_frame_only"),
    command("world", "freeze_visual_updates", "world_runtime", "operator", "world_visual_freeze_validation_v1", "world_visual_freeze_parameters_v1", "world_facts_unchanged"),
  ],
  resources: [
    command("resources", "set_resource_window", "resource_window", "system_administrator", "resource_window_validation_v1", "resource_window_parameters_v1", "registered_limits_only"),
    command("resources", "set_resource_limit", "resource_limit_set", "system_administrator", "resource_limit_validation_v1", "resource_limit_parameters_v1", "safety_upper_bound_cannot_increase"),
    command("resources", "clear_safe_cache", "safe_cache", "system_administrator", "safe_cache_validation_v1", "safe_cache_clear_parameters_v1", "registered_cache_scope_only"),
    command("resources", "manage_registered_service", "background_service", "system_administrator", "service_management_validation_v1", "service_management_parameters_v1", "registered_service_only"),
  ],
  emergency: [
    command("emergency", "emergency_stop", "local_ai_platform", "emergency_operator", "emergency_stop_validation_v1", "emergency_stop_parameters_v1", "preserve_runtime_snapshot_and_incomplete_writes"),
    command("emergency", "freeze_new_tasks", "task_scheduler", "emergency_operator", "emergency_task_freeze_validation_v1", "emergency_task_freeze_parameters_v1", "existing_evidence_unchanged"),
    command("emergency", "freeze_world_publish", "world_runtime", "emergency_operator", "emergency_world_freeze_validation_v1", "emergency_world_freeze_parameters_v1", "world_facts_unchanged"),
  ],
} as const

export function getAiConsoleControlProjectionAvailability(workspaceSlug: string): "partial" | "not_connected" {
  return workspaceSlug in controlDefinitions ? "partial" : "not_connected"
}

export function queryAiConsoleControlProjection(workspaceSlug: string): AiConsoleProjectionResult {
  const records = controlDefinitions[workspaceSlug as keyof typeof controlDefinitions]
  if (!records) {
    return createProjection({
      sourceIdentity: "ai_console_control_command_catalog_v1",
      writerIdentity: "source_controlled_product_catalog",
      observedAtUtc: new Date().toISOString(),
      records: [],
      dataStatus: "partial",
      reasonCode: "control_workspace_definition_not_registered",
      unavailableFields: ["executorIdentity"],
      sourceRevision: 1,
      trustStatus: "verified_registry",
    })
  }
  return createProjection({
    sourceIdentity: "ai_console_control_command_catalog_v1",
    writerIdentity: "source_controlled_product_catalog",
    observedAtUtc: new Date().toISOString(),
    records,
    dataStatus: "partial",
    reasonCode: "local_control_executor_not_connected",
    unavailableFields: ["executorIdentity"],
    sourceRevision: 1,
    evidenceReferences: [
      "docs/ai-console/AI_CONSOLE_FORMAL_PRODUCT_AND_INFORMATION_ARCHITECTURE_SPEC.md",
      "docs/ai-console/AI_CONSOLE_DATA_DICTIONARY_AND_API_CONTRACT.md",
    ],
    trustStatus: "verified_registry",
  })
}

function command(
  workspaceSlug: string,
  commandType: string,
  targetType: string,
  requiredRole: string,
  validationRuleSetId: string,
  parameterSchemaId: string,
  safetyBoundary: string,
  executorIdentity: string | null = null,
) {
  return {
    commandDefinitionId: `command_definition:${workspaceSlug}:${commandType}`,
    commandType,
    targetType,
    requiredRole,
    validationRuleSetId,
    parameterSchemaId,
    safetyBoundary,
    executorIdentity,
  }
}
