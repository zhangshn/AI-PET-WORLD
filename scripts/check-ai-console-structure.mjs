import fs from "node:fs"
import path from "node:path"
import process from "node:process"

const projectRoot = process.cwd()
const consoleRoot = path.join(projectRoot, "src", "app", "ai-console")
const catalogPath = path.join(consoleRoot, "ai-console-workspace-catalog.ts")
const rendererPath = path.join(consoleRoot, "ai-console-workspace.tsx")
const interactionsPath = path.join(consoleRoot, "ai-console-workspace-interactions.tsx")
const rootStylePath = path.join(consoleRoot, "page.module.css")
const workspaceStylePath = path.join(consoleRoot, "ai-console-workspace.module.css")
const themeStylePath = path.join(consoleRoot, "ai-console-theme.module.css")
const liveStylePath = path.join(consoleRoot, "ai-console-live-status.module.css")
const catalogApiPath = path.join(projectRoot, "src", "app", "api", "ai-console", "catalog", "route.ts")
const workspaceApiPath = path.join(projectRoot, "src", "app", "api", "ai-console", "workspaces", "[moduleSlug]", "[workspaceSlug]", "route.ts")
const projectionRoot = path.join(projectRoot, "src", "server", "ai-console")
const controlServiceRoot = path.join(projectRoot, "src", "server", "ai-console-control")
const controlSurfacePath = path.join(consoleRoot, "ai-console-control-surface.tsx")
const controlSessionApiPath = path.join(projectRoot, "src", "app", "api", "ai-console", "control", "session", "route.ts")
const controlCommandsApiPath = path.join(projectRoot, "src", "app", "api", "ai-console", "control", "commands", "route.ts")
const taskControlApiPath = path.join(projectRoot, "src", "app", "api", "ai-console", "control", "tasks", "route.ts")
const capabilityControlApiPath = path.join(projectRoot, "src", "app", "api", "ai-console", "control", "capabilities", "route.ts")
const trainingControlApiPath = path.join(projectRoot, "src", "app", "api", "ai-console", "control", "training", "route.ts")
const reviewControlApiPath = path.join(projectRoot, "src", "app", "api", "ai-console", "control", "reviews", "route.ts")
const runtimeControlApiPath = path.join(projectRoot, "src", "app", "api", "ai-console", "control", "runtime", "route.ts")
const worldControlApiPath = path.join(projectRoot, "src", "app", "api", "ai-console", "control", "world", "route.ts")
const evidenceArtifactDetailApiPath = path.join(projectRoot, "src", "app", "api", "ai-console", "evidence", "artifacts", "[evidenceId]", "route.ts")
const liveObservabilityApiPath = path.join(projectRoot, "src", "app", "api", "ai-console", "observability", "live", "route.ts")
const observabilityServiceRoot = path.join(projectRoot, "src", "server", "ai-console-observability")
const liveStatusPath = path.join(consoleRoot, "ai-console-live-status.tsx")
const liveClientPath = path.join(consoleRoot, "ai-console-live-observability.ts")
const observabilityPanelPath = path.join(consoleRoot, "ai-console-observability-panel.tsx")

const expectedWorkspaces = {
  tasks: ["current", "active", "queue", "flows", "history"],
  capabilities: ["domains", "candidates", "qualification", "releases", "migration"],
  training: ["overview", "plans", "models", "checkpoints", "runs"],
  reviews: ["current", "results", "evidence", "contracts", "failures"],
  data: ["releases", "samples", "conditions", "dictionary", "quality"],
  runtime: ["facts", "generations", "candidates", "frames", "world"],
  evidence: ["artifacts", "events", "capsules", "transactions", "policies"],
  system: ["resources", "services", "scheduler", "health", "telemetry"],
  archive: ["search", "training", "reviews", "generations", "contracts"],
  control: ["tasks", "training", "reviews", "capabilities", "world", "resources", "emergency"],
}

const requiredPresentations = ["registry", "timeline", "topology", "matrix", "monitor", "search", "control_contract"]
const failures = []
const catalogSource = fs.readFileSync(catalogPath, "utf8")
const rendererSource = fs.readFileSync(rendererPath, "utf8")
const interactionsSource = fs.readFileSync(interactionsPath, "utf8")
const rootStyleSource = fs.readFileSync(rootStylePath, "utf8")
const workspaceStyleSource = fs.readFileSync(workspaceStylePath, "utf8")
const themeStyleSource = fs.existsSync(themeStylePath) ? fs.readFileSync(themeStylePath, "utf8") : ""
const liveStyleSource = fs.existsSync(liveStylePath) ? fs.readFileSync(liveStylePath, "utf8") : ""
const catalogApiSource = fs.existsSync(catalogApiPath) ? fs.readFileSync(catalogApiPath, "utf8") : ""
const workspaceApiSource = fs.existsSync(workspaceApiPath) ? fs.readFileSync(workspaceApiPath, "utf8") : ""
const controlSurfaceSource = fs.existsSync(controlSurfacePath) ? fs.readFileSync(controlSurfacePath, "utf8") : ""

function collectSourceFiles(root) {
  if (!fs.existsSync(root)) return []
  return fs.readdirSync(root, { recursive: true, withFileTypes: true })
    .filter((entry) => entry.isFile() && /\.(?:css|js|jsx|mjs|ts|tsx)$/u.test(entry.name))
    .map((entry) => path.join(entry.parentPath, entry.name))
}

let workspaceCount = 0
for (const [moduleSlug, workspaceSlugs] of Object.entries(expectedWorkspaces)) {
  const routeFile = path.join(consoleRoot, moduleSlug, "[[...view]]", "page.tsx")
  if (!fs.existsSync(routeFile)) {
    failures.push(`missing_route_wrapper:${moduleSlug}`)
  } else if (!fs.readFileSync(routeFile, "utf8").includes(`moduleSlug="${moduleSlug}"`)) {
    failures.push(`route_wrapper_module_mismatch:${moduleSlug}`)
  }

  for (const workspaceSlug of workspaceSlugs) {
    workspaceCount += 1
    const directDefinition = new RegExp(`moduleSlug:\\s*"${moduleSlug}"[\\s\\S]{0,220}?slug:\\s*"${workspaceSlug}"`)
    const listedDefinition = new RegExp(`listedWorkspace\\(\\s*"${moduleSlug}",\\s*"${workspaceSlug}"`)
    if (!directDefinition.test(catalogSource) && !listedDefinition.test(catalogSource)) {
      failures.push(`missing_workspace_definition:${moduleSlug}/${workspaceSlug}`)
    }
  }
}

for (const presentation of requiredPresentations) {
  if (!catalogSource.includes(`"${presentation}"`) || !rendererSource.includes(`${presentation}:`)) {
    failures.push(`missing_presentation:${presentation}`)
  }
}

const isolatedConsoleSources = [
  ...collectSourceFiles(consoleRoot),
  ...collectSourceFiles(path.join(projectRoot, "src", "app", "api", "ai-console")),
  ...collectSourceFiles(projectionRoot),
  ...collectSourceFiles(controlServiceRoot),
  ...collectSourceFiles(observabilityServiceRoot),
]

const prohibitedLegacyCouplings = [
  ["legacy_page_route", /ai-painter-progress/u],
  ["legacy_page_api", /\/api\/ai-painter/u],
  ["legacy_page_entry", /current-training/u],
  ["legacy_page_import", /(?:from|import\()[^\n]*(?:ai-painter-progress|aiPainterProgress)/u],
  ["legacy_runtime_source", /(?:\.runtime|data|src)[\\/]ai-painter/u],
]

for (const sourceFile of isolatedConsoleSources) {
  const source = fs.readFileSync(sourceFile, "utf8")
  for (const [couplingName, pattern] of prohibitedLegacyCouplings) {
    if (couplingName === "legacy_runtime_source" && path.normalize(sourceFile) === path.normalize(path.join(consoleRoot, "ai-console-current-execution-status.tsx"))) {
      continue
    }
    if (pattern.test(source)) {
      failures.push(`${couplingName}:${path.relative(projectRoot, sourceFile)}`)
    }
  }
}

for (const marker of ["useState", "aria-pressed", "type=\"search\"", "AiConsoleFieldDictionary"]) {
  if (!interactionsSource.includes(marker)) failures.push(`workspace_interaction_missing:${marker}`)
}

for (const marker of ["requiredIdentityFields", "evidenceId", "transactionGateId", "transactionId", "preservationRequirement", "safeAlternativeRequirement", "policyBoundaryReportId", "receiptEvidenceId", "eventLedgerEvidenceId", "transactionRegistryEvidenceId", "crossSurfaceStatus", "capsuleSequence", "taskGoalSha256", "terminalEventId", "capsuleRecordSha256", "reportSequence", "boundaryEventId", "detectionEvidenceSetId", "policyBoundaryReportRecordSha256", "taskEventId", "taskRecordSha256", "targetLifecycleStatus", "qualificationResultId", "qualificationSetSha256", "releaseRecordSha256", "migrationAssessmentId", "modelStructureId", "modelStructureRecordSha256", "trainingPlanRecordSha256", "optimizerConfigSha256", "reviewResultId", "reviewContractRecordSha256", "resultTerminalStatus", "failureRecordSha256", "activationId", "runtimeFrameCandidateIdentity", "publicationRecordSha256", "worldStateRevisionId", "publishControlStatus", "visualUpdateStatus", "rollbackTargetRuntimeFrameIdentity"] ) {
  if (!catalogSource.includes(marker)) failures.push(`workspace_dictionary_contract_missing:${marker}`)
}

for (const [apiName, source, markers] of [
  ["catalog", catalogApiSource, ["ai_console_catalog_v1", 'dataStatus: "not_connected"', 'contractStatus: "ready"']],
  ["workspace", workspaceApiSource, ["ai_console_workspace_query_v1", "view_not_in_workspace_contract", "queryAiConsoleWorkspaceProjection"]],
]) {
  if (!source) failures.push(`query_api_missing:${apiName}`)
  for (const marker of markers) {
    if (!source.includes(marker)) failures.push(`query_api_contract_missing:${apiName}:${marker}`)
  }
  if (/api\/ai-painter|ai-painter-progress|server\/ai-painter/u.test(source)) failures.push(`query_api_legacy_coupling:${apiName}`)
}

if (!interactionsSource.includes("/api/ai-console/workspaces/")) failures.push("workspace_query_api_not_connected")

for (const [fileName, markers] of [
  ["projection-contract.ts", ["connected", "partial", "not_connected", "unknown_or_stale", "unavailableFields", "provenance", "createUnknownOrStaleProjection"]],
  ["capability-projection.ts", ["ai_console_capability_domain_catalog_v1", "ai_console_capability_lifecycle_registry", "readAiConsoleCapabilityLifecycleStore", "ai_console_capability_qualification_contract_v1", "ai_console_local_capability_migration_contract_v1", "machine_migration_acceptance_registry_empty"]],
  ["system-projection.ts", ["ai_console_local_observability_probe_v1", "ai_console_runtime_service_probe_v2", "ai_console_deterministic_health_probe_v2", "gpuTemperatureCelsius", "gpuPowerDrawWatts", 'workspaceSlug === "telemetry"']],
  ["training-observability-projection.ts", ["queryAiConsoleTrainingObservabilityProjection", "ai_painter_current_execution_with_live_resources_v1", "readAiPainterCurrentExecutionSnapshot", "snapshot.trainingTelemetry", "detectedTrainingProcessCount"]],
  ["data-projection.ts", ["ai_console_workspace_dictionary_v1", "source_controlled_product_catalog", "unit_registry_not_connected", "ai_console_dataset_release_gate_catalog_v1", "ai_console_multimodal_condition_schema_catalog_v1", "ai_console_dataset_quality_gate_catalog_v1", "dataset_release_registry_not_connected", 'workspaceSlug === "dictionary" || workspaceSlug === "conditions"']],
  ["evidence-projection.ts", ["ai_console_evidence_type_contract_catalog_v1", "ai_console_recoverable_transaction_gate_catalog_v1", "ai_console_policy_boundary_rule_catalog_v1", "queryAiConsoleFormalEvidenceProjection", "queryAiConsoleTaskCapsuleProjection", "queryAiConsolePolicyBoundaryReportProjection", "formal_evidence_records_are_separate_view", "formal_policy_boundary_reports_are_separate_view", "evidenceId: null", "transactionId: null", "policyBoundaryReportId: null", "preservationRequirement"]],
  ["formal-evidence-projection.ts", ["queryAiConsoleFormalEvidenceProjection", "ai_console_formal_evidence_index_v1", "verified_registry", "storageMode", "evidenceRecordSha256"]],
  ["evidence-reconciliation-projection.ts", ["queryAiConsoleEvidenceReconciliationProjection", "ai_console_evidence_reconciliation_v1", "fileConsistencyStatus", "eventConsistencyStatus", "sqliteConsistencyStatus", "crossSurfaceStatus"]],
  ["task-capsule-projection.ts", ["queryAiConsoleTaskCapsuleProjection", "ai_console_task_capsule_store_v1", "verified_registry", "storeRevision"]],
  ["policy-boundary-report-projection.ts", ["queryAiConsolePolicyBoundaryReportProjection", "ai_console_policy_boundary_report_store_v1", "verified_registry", "storeRevision"]],
  ["control-event-projection.ts", ["queryAiConsoleControlEventProjection", "ai_console_control_event_ledger_v1", "verified_registry", "eventSequence", "eventSha256"]],
  ["control-transaction-projection.ts", ["queryAiConsoleControlTransactionProjection", "ai_console_control_transaction_registry_v1", "verified_registry", "transactionRecordSha256"]],
  ["registry-store.ts", ["ai_console_primary_registry_v1", "new_ai_console_only", "ai_console_primary_registry_sha256_mismatch", "training/overview", "reviews/current", "archive/search"]],
  ["registry-projection.ts", ["queryAiConsolePrimaryRegistryProjection", "verified_registry", "ai_console_primary_registry_unregistered_field", "ai_console_primary_registry_required_field_missing", "ai_console_primary_registry_field_type_mismatch"]],
  ["control-projection.ts", ["ai_console_control_command_catalog_v1", "partial_control_executors_connected", "commandDefinitionId", "validationRuleSetId", "parameterSchemaId", "executorIdentity: string | null = null", "verify_primary_registry", "ai_console_primary_registry_verifier_v1"]],
  ["task-projection.ts", ["ai_console_autonomous_flow_catalog_v1", "ai_console_task_registry_store_v1", "queryTaskRegistryProjection", "queryAiPainterCurrentTaskProjection", "queryAiPainterActiveExecutionProjection", "failure_closed", "blocked_policy_boundary"]],
  ["training-design-projection.ts", ["queryAiConsoleTrainingDesignProjection", "ai_console_training_design_registry", "readAiConsoleTrainingDesignStore", "verified_registry", "models", "plans"]],
  ["review-adjudication-projection.ts", ["queryAiConsoleReviewAdjudicationProjection", "ai_console_review_adjudication_registry", "readAiConsoleReviewAdjudicationStore", "verified_registry", "contracts", "results", "failures"]],
  ["runtime-projection.ts", ["ai_console_runtime_release_registry", "readAiConsoleRuntimeReleaseRegistryStore", "ai_console_world_control_registry", "readAiConsoleWorldControlRegistryStore", "verified_registry"]],
  ["workspace-projection.ts", ["queryAiConsoleWorkspaceProjection", 'workspace.moduleSlug === "system"', 'workspace.moduleSlug === "capabilities"', 'workspace.moduleSlug === "data"', 'workspace.moduleSlug === "tasks"', 'workspace.moduleSlug === "runtime"', 'workspace.moduleSlug === "evidence"', 'workspace.moduleSlug === "training"', 'workspace.moduleSlug === "reviews"', 'workspace.moduleSlug === "archive"', 'workspace.moduleSlug === "control"']],
]) {
  const sourcePath = path.join(projectionRoot, fileName)
  const source = fs.existsSync(sourcePath) ? fs.readFileSync(sourcePath, "utf8") : ""
  if (!source) failures.push(`projection_source_missing:${fileName}`)
  for (const marker of markers) {
    if (!source.includes(marker)) failures.push(`projection_contract_missing:${fileName}:${marker}`)
  }
}

const runtimeProjectionSource = fs.readFileSync(path.join(projectionRoot, "runtime-projection.ts"), "utf8")
if (/world-runtime-store-adapter|readWorldRuntimeSaveRecord|data[\\/]world-runtime/u.test(runtimeProjectionSource)) {
  failures.push("runtime_projection_legacy_world_source_coupling")
}

for (const [sourcePath, markers] of [
  [path.join(controlServiceRoot, "operator-session.ts"), ["isLoopbackRequest", "verifyLocalControlRead", "HttpOnly", "SameSite=Strict", "x-ai-console-csrf", "timingSafeEqual", 'request.headers.get("host")', 'request.headers.get("x-forwarded-host")']],
  [path.join(controlServiceRoot, "control-command-service.ts"), ["verify_primary_registry", "ai_console_primary_registry_verifier_v1", "expected_registry_revision_conflict", 'flag: "wx"', "isAiConsoleControlCommandReceipt", "ensureAiConsoleControlTransaction", "ensureAiConsoleFormalEvidenceRegistration"]],
  [path.join(controlServiceRoot, "control-event-ledger.ts"), ["control-event-ledger-v1.jsonl", "control-event-ledger-head-v1.json", "ensureAiConsoleControlReceiptEvent", "previousEventSha256", "eventSha256", "headRecordSha256"]],
  [path.join(controlServiceRoot, "control-transaction-store.ts"), ["control-transactions-v1.sqlite", "BEGIN IMMEDIATE", "PRAGMA integrity_check", "ensureAiConsoleControlTransaction", "transactionRecordSha256"]],
  [path.join(controlServiceRoot, "formal-evidence-index.ts"), ["formal-evidence-index-v1.sqlite", "BEGIN IMMEDIATE", "PRAGMA integrity_check", "ensureAiConsoleFormalEvidenceRegistration", "embedded_immutable_blob"]],
  [path.join(controlServiceRoot, "task-capsule-store.ts"), ["task-capsule-index-v1.sqlite", "new_ai_console_only", "ai_console_task_capsule_writer_v1", "BEGIN IMMEDIATE", "PRAGMA integrity_check", "task_id TEXT NOT NULL UNIQUE", "content_blob BLOB NOT NULL", "ai_console_task_capsule_task_identity_conflict"]],
  [path.join(controlServiceRoot, "policy-boundary-report-store.ts"), ["policy-boundary-report-index-v1.sqlite", "new_ai_console_only", "ai_console_policy_boundary_report_writer_v1", "ai_console_policy_boundary_engine", "BEGIN IMMEDIATE", "PRAGMA integrity_check", "boundary_event_id TEXT NOT NULL UNIQUE", "content_blob BLOB NOT NULL", "ai_console_policy_boundary_event_identity_conflict"]],
  [path.join(controlServiceRoot, "task-registry-store.ts"), ["task-registry-v1.sqlite", "new_ai_console_only", "ai_console_task_registry_writer_v1", "ai_console_task_registry_executor_v1", "BEGIN IMMEDIATE", "PRAGMA integrity_check", "creation_content_blob BLOB NOT NULL", "ai_console_task_command_idempotency_conflict"]],
  [path.join(controlServiceRoot, "task-command-service.ts"), ["parseAiConsoleTaskCommandInput", "executeAiConsoleTaskCommand", "create_registered_task", "set_queued_task_priority", "cancel_unstarted_task"]],
  [path.join(controlServiceRoot, "capability-lifecycle-store.ts"), ["capability-lifecycle-v1.sqlite", "new_ai_console_only", "ai_console_capability_lifecycle_writer_v1", "ai_console_capability_lifecycle_executor_v1", "BEGIN IMMEDIATE", "PRAGMA integrity_check", "creation_content_blob BLOB NOT NULL", "ai_console_capability_command_idempotency_conflict"]],
  [path.join(controlServiceRoot, "capability-command-service.ts"), ["parseAiConsoleCapabilityCommandInput", "executeAiConsoleCapabilityLifecycleCommand", "register_capability_candidate", "record_capability_qualification", "register_qualified_capability_release"]],
  [path.join(controlServiceRoot, "training-design-store.ts"), ["training-design-registry-v1.sqlite", "new_ai_console_only", "ai_console_training_design_writer_v1", "ai_console_training_design_executor_v1", "BEGIN IMMEDIATE", "PRAGMA integrity_check", "creation_content_blob BLOB NOT NULL", "ai_console_training_design_command_idempotency_conflict"]],
  [path.join(controlServiceRoot, "training-design-command-service.ts"), ["parseAiConsoleTrainingDesignCommandInput", "executeAiConsoleTrainingDesignRegistryCommand", "register_model_structure", "register_training_plan"]],
  [path.join(controlServiceRoot, "review-adjudication-store.ts"), ["review-adjudication-registry-v1.sqlite", "new_ai_console_only", "ai_console_review_adjudication_writer_v1", "ai_console_review_adjudication_executor_v1", "BEGIN IMMEDIATE", "PRAGMA integrity_check", "creation_content_blob BLOB NOT NULL", "ai_console_review_command_idempotency_conflict", "review_run_contract_already_adjudicated"]],
  [path.join(controlServiceRoot, "review-adjudication-command-service.ts"), ["parseAiConsoleReviewAdjudicationCommandInput", "executeAiConsoleReviewAdjudicationRegistryCommand", "register_review_contract", "register_machine_review_observation"]],
  [path.join(controlServiceRoot, "runtime-release-registry-store.ts"), ["runtime-release-registry-v1.sqlite", "new_ai_console_only", "ai_console_runtime_release_registry_writer_v1", "ai_console_runtime_release_executor_v1", "BEGIN IMMEDIATE", "PRAGMA integrity_check", "creation_content_blob BLOB NOT NULL", "ai_console_runtime_release_command_idempotency_conflict", "registered_formal_unconsumed"]],
  [path.join(controlServiceRoot, "runtime-release-command-service.ts"), ["parseAiConsoleRuntimeReleaseCommandInput", "executeAiConsoleRuntimeReleaseRegistryCommand", "activate_qualified_release", "register_runtime_frame_candidate", "publish_reviewed_runtime_frame"]],
  [path.join(controlServiceRoot, "world-control-registry-store.ts"), ["world-control-registry-v1.sqlite", "new_ai_console_only", "ai_console_world_control_registry_writer_v1", "ai_console_world_control_executor_v1", "BEGIN IMMEDIATE", "PRAGMA integrity_check", "creation_content_blob BLOB NOT NULL", "registered_formal_unconsumed", "rollback_requires_publish_pause"]],
  [path.join(controlServiceRoot, "world-control-command-service.ts"), ["parseAiConsoleWorldControlCommandInput", "executeAiConsoleWorldControlRegistryCommand", "consume_registered_runtime_frame", "pause_frame_publish", "resume_frame_publish", "rollback_runtime_frame", "freeze_visual_updates"]],
  [controlSessionApiPath, ["issueLocalOperatorSession", "allowedCommandTypes"]],
  [controlCommandsApiPath, ["verifyLocalControlRead", "verifyLocalOperatorMutation", "executeVerifyPrimaryRegistryCommand", "control_command_identity_invalid", 'integrityStatus: "verified"', "receiptLogicalPath", "transactionStoreStatus", "transactionBinding", "evidenceIndexStatus", "evidenceRegistration"]],
  [taskControlApiPath, ["verifyLocalControlRead", "verifyLocalOperatorMutation", "parseAiConsoleTaskCommandInput", "executeAiConsoleTaskCommand", "new_ai_console_task_registry_only", 'integrityStatus: "verified"']],
  [capabilityControlApiPath, ["verifyLocalControlRead", "verifyLocalOperatorMutation", "parseAiConsoleCapabilityCommandInput", "executeAiConsoleCapabilityLifecycleCommand", "new_ai_console_capability_registry_only", 'integrityStatus: "verified"']],
  [trainingControlApiPath, ["verifyLocalControlRead", "verifyLocalOperatorMutation", "parseAiConsoleTrainingDesignCommandInput", "executeAiConsoleTrainingDesignRegistryCommand", "new_ai_console_training_design_registry_only", 'integrityStatus: "verified"']],
  [reviewControlApiPath, ["verifyLocalControlRead", "verifyLocalOperatorMutation", "parseAiConsoleReviewAdjudicationCommandInput", "executeAiConsoleReviewAdjudicationRegistryCommand", "new_ai_console_review_adjudication_registry_only", "server_recomputes_terminal_status_from_frozen_contract", 'integrityStatus: "verified"']],
  [runtimeControlApiPath, ["verifyLocalControlRead", "verifyLocalOperatorMutation", "parseAiConsoleRuntimeReleaseCommandInput", "executeAiConsoleRuntimeReleaseRegistryCommand", "new_ai_console_runtime_release_registry_only", 'integrityStatus: "verified"']],
  [worldControlApiPath, ["verifyLocalControlRead", "verifyLocalOperatorMutation", "parseAiConsoleWorldControlCommandInput", "executeAiConsoleWorldControlRegistryCommand", "new_ai_console_only", 'integrityStatus: "verified"']],
  [evidenceArtifactDetailApiPath, ["verifyLocalControlRead", "safeEvidenceIdentity", "readAiConsoleFormalEvidenceArtifact", "exact_evidence_identity", "binary_metadata_only", "X-Content-Type-Options"]],
  [liveObservabilityApiPath, ["sampleAiConsoleLiveObservability", "ai_console_live_observability_v2", "Cache-Control", "no-store", "X-Content-Type-Options"]],
  [path.join(observabilityServiceRoot, "local-observability.ts"), ["nvidia-smi", "--query-gpu=index,name,uuid,driver_version,utilization.gpu,memory.used,memory.total,temperature.gpu,power.draw,power.limit,fan.speed", "training_process_pattern_match", "sampleAiConsoleLiveObservability", "targetRefreshIntervalMs = 250", "channelTimings"]],
  [path.join(observabilityServiceRoot, "training-telemetry-store.ts"), ["training-telemetry-v1.sqlite", "ai_console_training_telemetry_writer_v1", "BEGIN IMMEDIATE", "recordSha256", "new_platform_training_telemetry_not_reported"]],
  [liveClientPath, ["useSyncExternalStore", "/api/ai-console/observability/live", "targetRefreshIntervalMs = 250", "sessionStorage", "maximumHistoryPoints = 600", "roundTripDurationMs"]],
  [liveStatusPath, ["AiConsoleLiveStatus", "LIVE OBSERVABILITY", "/ai-console/system/resources", "/ai-console/training/overview"]],
  [observabilityPanelPath, ["AiConsoleObservabilityPanel", "训练实时仪表盘", "进程匹配，不等于正式Run", "Sparkline"]],
  [controlSurfacePath, ["AiConsoleRegistryVerificationControl", "AiConsoleCapabilityLifecycleControl", "AiConsoleTrainingDesignControl", "AiConsoleReviewAdjudicationControl", "AiConsoleRuntimeReleaseControl", "AiConsoleWorldControl", "x-ai-console-csrf", "verify_primary_registry", "EXACT RECEIPT LOOKUP", "lookupReceiptByCommandId", "transactionRecordSha256", "register_capability_candidate", "record_capability_qualification", "register_qualified_capability_release", "register_model_structure", "register_training_plan", "register_review_contract", "register_machine_review_observation", "activate_qualified_release", "register_runtime_frame_candidate", "publish_reviewed_runtime_frame", "consume_registered_runtime_frame", "pause_frame_publish", "resume_frame_publish", "rollback_runtime_frame", "freeze_visual_updates", "服务端按冻结合同重新计算结果"]],
  [interactionsPath, ["EvidenceArtifactContentInspector", "EXACT CONTENT INSPECTION", "verified_utf8_preview", "binary_metadata_only", 'workspace.slug === "capsules"', "fieldNamesByView", "正式边界报告", "policyBoundaryReportId", "AiConsoleTaskRegistryControl", "AiConsoleCapabilityLifecycleControl", "AiConsoleTrainingDesignControl", "AiConsoleReviewAdjudicationControl", "AiConsoleRuntimeReleaseControl", "AiConsoleWorldControl", "7 SAFE COMMANDS READY", "4 SAFE COMMANDS READY", "3 SAFE COMMANDS READY", "2 SAFE COMMANDS READY"]],
]) {
  const source = fs.existsSync(sourcePath) ? fs.readFileSync(sourcePath, "utf8") : ""
  if (!source) failures.push(`control_source_missing:${path.relative(projectRoot, sourcePath)}`)
  for (const marker of markers) {
    if (!source.includes(marker)) failures.push(`control_contract_missing:${path.relative(projectRoot, sourcePath)}:${marker}`)
  }
}

if (!controlSurfaceSource.includes("不访问训练Run、Checkpoint、审核、Runtime或旧平台")) {
  failures.push("control_surface_boundary_missing")
}

if (!rendererSource.includes("<AiConsoleLiveStatus />") || !fs.readFileSync(path.join(consoleRoot, "page.tsx"), "utf8").includes("<AiConsoleLiveStatus />")) {
  failures.push("global_live_observability_bar_missing")
}

for (const sourceFile of collectSourceFiles(projectionRoot)) {
  const source = fs.readFileSync(sourceFile, "utf8")
  if (/node:child_process|\b(?:exec|execFile|spawn|fork)(?:Sync)?\s*\(/u.test(source)) {
    failures.push(`projection_external_process_side_effect:${path.relative(projectRoot, sourceFile)}`)
  }
  if (/\b(?:writeFile|appendFile|unlink|rename|mkdir|rm|createWriteStream)\s*\(/u.test(source)) {
    failures.push(`projection_filesystem_write_side_effect:${path.relative(projectRoot, sourceFile)}`)
  }
}

for (const [styleName, source] of [["root", rootStyleSource], ["workspace", workspaceStyleSource]]) {
  if (!source.includes("height: 100dvh") || !source.includes("overflow: hidden")) {
    failures.push(`fixed_shell_contract_missing:${styleName}`)
  }
  if (!source.includes("@media (max-width:") || !source.includes("height: auto") || !source.includes("overflow: visible")) {
    failures.push(`responsive_shell_contract_missing:${styleName}`)
  }
}

for (const marker of [
  "color-scheme: light",
  "--console-canvas",
  "--console-shell: #ffffff",
  "--console-text: #172033",
  "--console-surface-3",
  "--console-action",
  "--console-success",
  "--console-warning",
  "--console-danger",
  'data-module="training"',
  'data-module="system"',
  'data-module="control"',
  'data-framework="FRAME-04"',
]) {
  if (!themeStyleSource.includes(marker)) failures.push(`semantic_color_contract_missing:${marker}`)
}

for (const marker of [
  "Professional console palette V19: light-first enterprise layers plus module semantics.",
  "V19 inner-workspace surfaces: every secondary page stays inside the light shell.",
  ".projectionNotice",
  ".controlExecutionSurface",
  ".fieldTools input",
]) {
  if (!workspaceStyleSource.includes(marker)) failures.push(`light_workspace_surface_contract_missing:${marker}`)
}

if (!rendererSource.includes("themeStyles.theme") || !rendererSource.includes("data-module={consoleModule.slug}")) {
  failures.push("workspace_semantic_theme_not_connected")
}

if (!liveStyleSource.includes(".metric:nth-child(5)") || !liveStyleSource.includes(".resourceGauge:nth-child(4)")) {
  failures.push("observability_metric_color_channels_missing")
}

const uiSourceFiles = isolatedConsoleSources.filter((sourceFile) => sourceFile.endsWith(".tsx"))

for (const sourceFile of uiSourceFiles) {
  const source = fs.readFileSync(sourceFile, "utf8")
  if (/Codex|聊天|外部工具|[>\s]Token[<\s]/u.test(source)) {
    failures.push(`external_tool_wording:${path.relative(projectRoot, sourceFile)}`)
  }
}

const result = {
  ok: failures.length === 0 && workspaceCount === 52,
  moduleCount: Object.keys(expectedWorkspaces).length,
  workspaceCount,
  presentationCount: requiredPresentations.length,
  failures,
}

console.log(JSON.stringify(result, null, 2))
if (!result.ok) process.exitCode = 1
