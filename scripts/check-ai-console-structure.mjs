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
const catalogApiPath = path.join(projectRoot, "src", "app", "api", "ai-console", "catalog", "route.ts")
const workspaceApiPath = path.join(projectRoot, "src", "app", "api", "ai-console", "workspaces", "[moduleSlug]", "[workspaceSlug]", "route.ts")
const projectionRoot = path.join(projectRoot, "src", "server", "ai-console")
const controlServiceRoot = path.join(projectRoot, "src", "server", "ai-console-control")
const controlSurfacePath = path.join(consoleRoot, "ai-console-control-surface.tsx")
const controlSessionApiPath = path.join(projectRoot, "src", "app", "api", "ai-console", "control", "session", "route.ts")
const controlCommandsApiPath = path.join(projectRoot, "src", "app", "api", "ai-console", "control", "commands", "route.ts")

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
    if (pattern.test(source)) {
      failures.push(`${couplingName}:${path.relative(projectRoot, sourceFile)}`)
    }
  }
}

for (const marker of ["useState", "aria-pressed", "type=\"search\"", "AiConsoleFieldDictionary"]) {
  if (!interactionsSource.includes(marker)) failures.push(`workspace_interaction_missing:${marker}`)
}

for (const marker of ["requiredIdentityFields", "evidenceId", "transactionGateId", "transactionId", "preservationRequirement", "safeAlternativeRequirement", "policyBoundaryReportId"]) {
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
  ["capability-projection.ts", ["ai_console_capability_domain_catalog_v1", "capability_maturity_registry_not_connected", 'unavailableFields: ["maturityLevel"]', "ai_console_capability_qualification_contract_v1", "ai_console_local_capability_migration_contract_v1", "machine_migration_acceptance_registry_not_connected"]],
  ["system-projection.ts", ["ai_console_local_resource_probe_v1", "ai_console_runtime_service_probe_v1", "ai_console_deterministic_health_probe_v1", "gpu_telemetry_adapter_not_connected"]],
  ["data-projection.ts", ["ai_console_workspace_dictionary_v1", "source_controlled_product_catalog", "unit_registry_not_connected", "ai_console_dataset_release_gate_catalog_v1", "ai_console_multimodal_condition_schema_catalog_v1", "ai_console_dataset_quality_gate_catalog_v1", "dataset_release_registry_not_connected", 'workspaceSlug === "dictionary" || workspaceSlug === "conditions"']],
  ["evidence-projection.ts", ["ai_console_evidence_type_contract_catalog_v1", "ai_console_recoverable_transaction_gate_catalog_v1", "ai_console_policy_boundary_rule_catalog_v1", "queryAiConsoleFormalEvidenceProjection", "formal_evidence_records_are_separate_view", "policy_boundary_report_index_not_joined", "evidenceId: null", "transactionId: null", "policyBoundaryReportId: null", "preservationRequirement"]],
  ["formal-evidence-projection.ts", ["queryAiConsoleFormalEvidenceProjection", "ai_console_formal_evidence_index_v1", "verified_registry", "storageMode", "evidenceRecordSha256"]],
  ["control-event-projection.ts", ["queryAiConsoleControlEventProjection", "ai_console_control_event_ledger_v1", "verified_registry", "eventSequence", "eventSha256"]],
  ["control-transaction-projection.ts", ["queryAiConsoleControlTransactionProjection", "ai_console_control_transaction_registry_v1", "verified_registry", "transactionRecordSha256"]],
  ["registry-store.ts", ["ai_console_primary_registry_v1", "new_ai_console_only", "ai_console_primary_registry_sha256_mismatch", "training/overview", "reviews/current", "archive/search"]],
  ["registry-projection.ts", ["queryAiConsolePrimaryRegistryProjection", "verified_registry", "ai_console_primary_registry_unregistered_field", "ai_console_primary_registry_required_field_missing", "ai_console_primary_registry_field_type_mismatch"]],
  ["control-projection.ts", ["ai_console_control_command_catalog_v1", "local_control_executor_not_connected", "commandDefinitionId", "validationRuleSetId", "parameterSchemaId", "executorIdentity: string | null = null", "verify_primary_registry", "ai_console_primary_registry_verifier_v1"]],
  ["task-projection.ts", ["ai_console_autonomous_flow_catalog_v1", "failure_closed", "blocked_policy_boundary"]],
  ["runtime-projection.ts", ["formal_game_map_runtime_frame_store_v1", "formal_world_runtime_store_adapter_v1", "readLatestGameMapRuntimeFrameRecord", "readWorldRuntimeSaveRecord"]],
  ["workspace-projection.ts", ["queryAiConsoleWorkspaceProjection", 'workspace.moduleSlug === "system"', 'workspace.moduleSlug === "capabilities"', 'workspace.moduleSlug === "data"', 'workspace.moduleSlug === "tasks"', 'workspace.moduleSlug === "runtime"', 'workspace.moduleSlug === "evidence"', 'workspace.moduleSlug === "training"', 'workspace.moduleSlug === "reviews"', 'workspace.moduleSlug === "archive"', 'workspace.moduleSlug === "control"']],
]) {
  const sourcePath = path.join(projectionRoot, fileName)
  const source = fs.existsSync(sourcePath) ? fs.readFileSync(sourcePath, "utf8") : ""
  if (!source) failures.push(`projection_source_missing:${fileName}`)
  for (const marker of markers) {
    if (!source.includes(marker)) failures.push(`projection_contract_missing:${fileName}:${marker}`)
  }
}

for (const [sourcePath, markers] of [
  [path.join(controlServiceRoot, "operator-session.ts"), ["isLoopbackRequest", "verifyLocalControlRead", "HttpOnly", "SameSite=Strict", "x-ai-console-csrf", "timingSafeEqual", 'request.headers.get("host")', 'request.headers.get("x-forwarded-host")']],
  [path.join(controlServiceRoot, "control-command-service.ts"), ["verify_primary_registry", "ai_console_primary_registry_verifier_v1", "expected_registry_revision_conflict", 'flag: "wx"', "isAiConsoleControlCommandReceipt", "ensureAiConsoleControlTransaction", "ensureAiConsoleFormalEvidenceRegistration"]],
  [path.join(controlServiceRoot, "control-event-ledger.ts"), ["control-event-ledger-v1.jsonl", "control-event-ledger-head-v1.json", "ensureAiConsoleControlReceiptEvent", "previousEventSha256", "eventSha256", "headRecordSha256"]],
  [path.join(controlServiceRoot, "control-transaction-store.ts"), ["control-transactions-v1.sqlite", "BEGIN IMMEDIATE", "PRAGMA integrity_check", "ensureAiConsoleControlTransaction", "transactionRecordSha256"]],
  [path.join(controlServiceRoot, "formal-evidence-index.ts"), ["formal-evidence-index-v1.sqlite", "BEGIN IMMEDIATE", "PRAGMA integrity_check", "ensureAiConsoleFormalEvidenceRegistration", "embedded_immutable_blob"]],
  [controlSessionApiPath, ["issueLocalOperatorSession", "allowedCommandTypes"]],
  [controlCommandsApiPath, ["verifyLocalControlRead", "verifyLocalOperatorMutation", "executeVerifyPrimaryRegistryCommand", "control_command_identity_invalid", 'integrityStatus: "verified"', "receiptLogicalPath", "transactionStoreStatus", "transactionBinding", "evidenceIndexStatus", "evidenceRegistration"]],
  [controlSurfacePath, ["AiConsoleRegistryVerificationControl", "x-ai-console-csrf", "verify_primary_registry", "EXACT RECEIPT LOOKUP", "lookupReceiptByCommandId", "transactionRecordSha256"]],
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
