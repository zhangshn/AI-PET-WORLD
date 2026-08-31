import { createHash } from "node:crypto"
import { readFile } from "node:fs/promises"
import path from "node:path"
import {
  CURRENT_EXECUTION_REGISTRY_PATH,
  readCurrentExecutionRegistry,
} from "../ai-painter-current-execution-registry.mjs"
import {
  createProjection,
  createUnknownOrStaleProjection,
  type AiConsoleProjectionResult,
} from "./projection-contract"

type JsonRecord = Record<string, unknown>

export type AiPainterMachineReviewNode = {
  epoch: number
  passed: boolean
  issueCodes: readonly string[]
  previewPath: string
  previewSha256: string
  reproductionPath: string | null
  reproductionSha256: string | null
  normalizedPath: string | null
  normalizedSha256: string | null
}

export type AiPainterMachineReviewSummary = {
  availability: "available" | "unavailable"
  reasonCode: string | null
  sourcePath: string | null
  sourceSha256: string | null
  integrityStatus: "verified" | "unavailable"
  schemaVersion: string | null
  status: string | null
  runId: string | null
  sampleId: string | null
  sampleSplit: string | null
  completedReviewCount: number | null
  targetReviewCount: number | null
  previewPassCount: number | null
  previewFailCount: number | null
  updatedAtUtc: string | null
  completedAtUtc: string | null
  reviews: readonly AiPainterMachineReviewNode[]
}

export type AiPainterCurrentExecutionSnapshot = {
  ok: boolean
  schemaVersion: "ai_console_ai_painter_current_execution_projection_v1"
  dataStatus: "connected" | "unknown_or_stale"
  reasonCode: string | null
  sourceIdentity: "ai-painter-current-execution"
  sourcePath: typeof CURRENT_EXECUTION_REGISTRY_PATH
  sourceSha256: string | null
  integrityStatus: "verified" | "unavailable"
  registryRevision: number | null
  writerIdentity: string | null
  currentProjectTask: {
    taskId: string | null
    taskKind: string | null
    taskGoal: string | null
    priority: number | null
    queueStatus: string | null
    nextMachineAction: string | null
    queuedAtUtc: string | null
    capabilityVersion: string | null
    packageId: string | null
    runId: string | null
    lifecycleStage: string | null
    executionState: string | null
    activity: string | null
    terminalStatus: string | null
    terminalPath: string | null
    terminalSha256: string | null
  } | null
  activeExecution: JsonRecord | null
  latestTrainingTerminal: {
    runId: string | null
    status: string | null
    path: string | null
    sha256: string | null
  } | null
  selectedHistoricalRun: JsonRecord | null
  machineReview: AiPainterMachineReviewSummary
  recordedAtUtc: string | null
  recordedAtAsiaShanghai: string | null
  observedAtUtc: string
  evidenceReferences: readonly string[]
}

export async function readAiPainterCurrentExecutionSnapshot(
  projectRoot = process.cwd(),
): Promise<AiPainterCurrentExecutionSnapshot> {
  const observedAtUtc = new Date().toISOString()
  const read = await readCurrentExecutionRegistry(projectRoot)
  if (!read.ok || !isRecord(read.registry)) {
    return unavailableSnapshot(read.errorCode ?? "current_execution_registry_unavailable", observedAtUtc)
  }

  const registry = read.registry
  try {
    const registryRevision = requiredInteger(registry.registryRevision, "registry_revision_invalid")
    const taskId = requiredString(registry.taskId, "current_project_task_id_missing")
    const runId = requiredString(registry.runId, "current_project_run_id_missing")
    const lifecycleStage = requiredString(registry.lifecycleStage, "current_project_lifecycle_stage_missing")
    const executionState = requiredString(registry.executionState, "current_project_execution_state_missing")
    const terminalBinding = requiredBinding(registry.terminalEvidence, "current_project_terminal")
    const latestBinding = optionalLatestTrainingTerminal(registry.latestTrainingTerminal)
    const machineReview = await readBoundMachineReview(projectRoot, latestBinding)
    const evidenceReferences = [
      CURRENT_EXECUTION_REGISTRY_PATH,
      terminalBinding.path,
      ...(latestBinding ? [latestBinding.path] : []),
      ...(machineReview.sourcePath ? [machineReview.sourcePath] : []),
    ]

    return {
      ok: true,
      schemaVersion: "ai_console_ai_painter_current_execution_projection_v1",
      dataStatus: "connected",
      reasonCode: null,
      sourceIdentity: "ai-painter-current-execution",
      sourcePath: CURRENT_EXECUTION_REGISTRY_PATH,
      sourceSha256: read.registrySha256,
      integrityStatus: "verified",
      registryRevision,
      writerIdentity: stringOrNull(registry.writerIdentity),
      currentProjectTask: {
        taskId,
        taskKind: stringOrNull(registry.taskKind),
        taskGoal: stringOrNull(registry.taskGoal),
        priority: integerOrNull(registry.priority),
        queueStatus: stringOrNull(registry.queueStatus),
        nextMachineAction: stringOrNull(registry.nextMachineAction),
        queuedAtUtc: stringOrNull(registry.queuedAtUtc),
        capabilityVersion: stringOrNull(registry.capabilityVersion),
        packageId: stringOrNull(registry.packageId),
        runId,
        lifecycleStage,
        executionState,
        activity: stringOrNull(registry.activity),
        terminalStatus: stringOrNull(terminalBinding.source.status),
        terminalPath: terminalBinding.path,
        terminalSha256: terminalBinding.sha256,
      },
      activeExecution: isRecord(registry.activeExecution) ? registry.activeExecution : null,
      latestTrainingTerminal: latestBinding ? {
        runId: stringOrNull(latestBinding.source.runId),
        status: stringOrNull(latestBinding.source.status),
        path: latestBinding.path,
        sha256: latestBinding.sha256,
      } : null,
      selectedHistoricalRun: isRecord(registry.selectedHistoricalRun) ? registry.selectedHistoricalRun : null,
      machineReview,
      recordedAtUtc: stringOrNull(registry.recordedAtUtc),
      recordedAtAsiaShanghai: stringOrNull(registry.recordedAtAsiaShanghai),
      observedAtUtc,
      evidenceReferences: [...new Set(evidenceReferences)],
    }
  } catch (error) {
    return unavailableSnapshot(
      error instanceof Error ? error.message : "current_execution_projection_failed",
      observedAtUtc,
    )
  }
}

export async function queryAiPainterCurrentTaskProjection(): Promise<AiConsoleProjectionResult> {
  const snapshot = await readAiPainterCurrentExecutionSnapshot()
  if (!snapshot.ok || !snapshot.currentProjectTask) return staleProjection(snapshot)
  const task = snapshot.currentProjectTask
  const unavailableFields = [
    ["taskGoal", task.taskGoal],
    ["priority", task.priority],
    ["queueStatus", task.queueStatus],
    ["nextMachineAction", task.nextMachineAction],
    ["queuedAtUtc", task.queuedAtUtc],
  ].filter(([, value]) => value === null).map(([field]) => field as string)
  return createProjection({
    ...projectionProvenance(snapshot),
    records: [{
      taskId: task.taskId,
      taskGoal: task.taskGoal,
      capabilityDomain: "ai_painter",
      priority: task.priority,
      lifecycleStatus: task.lifecycleStage,
      lifecycleStage: task.lifecycleStage,
      executionState: task.executionState,
      queueStatus: task.queueStatus,
      nextMachineAction: task.nextMachineAction,
      taskRevision: snapshot.registryRevision,
      registryRevision: snapshot.registryRevision,
      runId: task.runId,
      activeExecution: snapshot.activeExecution !== null,
      queuedAtUtc: task.queuedAtUtc,
      recordedAtUtc: snapshot.recordedAtUtc,
      recordedAtAsiaShanghai: snapshot.recordedAtAsiaShanghai,
      evidenceIntegrity: snapshot.integrityStatus,
      evidenceSha256: task.terminalSha256,
    }],
    dataStatus: unavailableFields.length === 0 ? "connected" : "partial",
    reasonCode: unavailableFields.length === 0 ? null : "current_task_control_metadata_not_registered",
    unavailableFields,
  })
}

export async function queryAiPainterActiveExecutionProjection(): Promise<AiConsoleProjectionResult> {
  const snapshot = await readAiPainterCurrentExecutionSnapshot()
  if (!snapshot.ok) return staleProjection(snapshot)
  if (!snapshot.activeExecution) {
    return createProjection({
      ...projectionProvenance(snapshot),
      records: [],
      dataStatus: "connected",
      reasonCode: "active_execution_not_registered",
      unavailableFields: [],
    })
  }
  return createProjection({
    ...projectionProvenance(snapshot),
    records: [snapshot.activeExecution],
  })
}

export async function queryAiPainterCurrentReviewProjection(
  workspaceSlug: "current" | "results" | "evidence",
): Promise<AiConsoleProjectionResult> {
  const snapshot = await readAiPainterCurrentExecutionSnapshot()
  if (!snapshot.ok) return staleProjection(snapshot)
  const review = snapshot.machineReview
  if (review.availability !== "available") {
    return createProjection({
      ...projectionProvenance(snapshot),
      records: [],
      dataStatus: "partial",
      reasonCode: review.reasonCode ?? "machine_review_timeline_unavailable",
      unavailableFields: workspaceSlug === "current"
        ? ["validationRunId", "inputRunId", "validationStage", "reviewerIdentity", "nodeProgress", "validationStatus"]
        : [],
    })
  }

  if (workspaceSlug === "current") {
    return createProjection({
      ...projectionProvenance(snapshot),
      records: [{
        validationRunId: review.runId,
        inputRunId: snapshot.latestTrainingTerminal?.runId ?? null,
        validationStage: snapshot.currentProjectTask?.lifecycleStage ?? null,
        reviewerIdentity: null,
        nodeProgress: `${review.completedReviewCount}/${review.targetReviewCount}`,
        validationStatus: review.status,
        previewPassCount: review.previewPassCount,
        previewFailCount: review.previewFailCount,
        evidenceIntegrity: review.integrityStatus,
        evidencePath: review.sourcePath,
        evidenceSha256: review.sourceSha256,
        completedAtUtc: review.completedAtUtc,
        recordedAtAsiaShanghai: snapshot.recordedAtAsiaShanghai,
      }],
      dataStatus: "partial",
      reasonCode: "reviewer_identity_not_registered_in_bound_timeline",
      unavailableFields: ["reviewerIdentity"],
    })
  }

  if (workspaceSlug === "evidence") {
    return createProjection({
      ...projectionProvenance(snapshot),
      records: review.reviews.map((node) => ({
        evidenceId: `${review.runId}:epoch-${String(node.epoch).padStart(3, "0")}`,
        reviewRunId: review.runId,
        originalArtifactPath: node.previewPath,
        normalizedArtifactPath: node.normalizedPath,
        evidenceSha256: node.previewSha256,
        reproductionIdentity: node.reproductionSha256,
        epoch: node.epoch,
        reviewStatus: node.passed ? "passed" : "failed",
        timelinePath: review.sourcePath,
        timelineSha256: review.sourceSha256,
      })),
    })
  }

  return createProjection({
    ...projectionProvenance(snapshot),
    records: review.reviews.map((node, index) => ({
      reviewResultId: `${review.runId}:epoch-${String(node.epoch).padStart(3, "0")}`,
      resultSequence: index + 1,
      reviewRunId: review.runId,
      validationInputIdentity: review.sampleId,
      capabilityDomain: "ai_painter",
      reviewContractId: null,
      reviewContractRecordSha256: null,
      reviewNodeId: `epoch_${node.epoch}`,
      reviewerIdentity: null,
      metricDefinitionId: null,
      metricValue: null,
      thresholdOperator: null,
      thresholdValue: null,
      thresholdUnit: null,
      reviewStatus: node.passed ? "passed" : "failed",
      failureCode: node.issueCodes.length > 0 ? node.issueCodes.join(",") : null,
      affectedScope: null,
      evidenceTypeId: "fixed_epoch_preview",
      evidenceSha256: node.previewSha256,
      resultTerminalStatus: review.status,
      commandId: null,
      registeredAtUtc: review.completedAtUtc,
      creationContentSha256: null,
      reviewResultRecordSha256: null,
      epoch: node.epoch,
      timelinePath: review.sourcePath,
      timelineSha256: review.sourceSha256,
    })),
    dataStatus: "partial",
    reasonCode: "projection_fields_not_present_in_bound_machine_review_timeline",
    unavailableFields: [
      "reviewContractId",
      "reviewContractRecordSha256",
      "reviewerIdentity",
      "metricDefinitionId",
      "metricValue",
      "thresholdOperator",
      "thresholdValue",
      "thresholdUnit",
      "affectedScope",
      "commandId",
      "creationContentSha256",
      "reviewResultRecordSha256",
    ],
  })
}

function projectionProvenance(snapshot: AiPainterCurrentExecutionSnapshot) {
  return {
    sourceIdentity: snapshot.sourceIdentity,
    writerIdentity: snapshot.writerIdentity ?? "local_ai_capability_lifecycle_orchestrator",
    observedAtUtc: snapshot.observedAtUtc,
    sourceRevision: snapshot.registryRevision,
    evidenceReferences: snapshot.evidenceReferences,
    trustStatus: "verified_registry" as const,
  }
}

function staleProjection(snapshot: AiPainterCurrentExecutionSnapshot): AiConsoleProjectionResult {
  return createUnknownOrStaleProjection({
    sourceIdentity: snapshot.sourceIdentity,
    writerIdentity: snapshot.writerIdentity ?? "ai_console_current_execution_reader",
    reasonCode: snapshot.reasonCode ?? "current_execution_registry_unavailable",
    evidenceReferences: [snapshot.sourcePath],
  })
}

async function readBoundMachineReview(
  projectRoot: string,
  latestBinding: ReturnType<typeof optionalLatestTrainingTerminal>,
): Promise<AiPainterMachineReviewSummary> {
  if (!latestBinding) return unavailableReview("latest_training_terminal_not_registered")
  const evidence = latestBinding.source.evidence
  if (!isRecord(evidence)) return unavailableReview("latest_training_evidence_not_registered")
  const binding = evidence.machineReviewTimeline
  if (!isRecord(binding)) return unavailableReview("machine_review_timeline_not_bound")
  const sourcePath = requiredString(binding.path, "machine_review_timeline_path_missing")
  const sourceSha256 = requiredSha256(binding.sha256, "machine_review_timeline_sha256_invalid")
  const bytes = await readExactProjectFile(projectRoot, sourcePath)
  if (sha256(bytes) !== sourceSha256) throw new Error("machine_review_timeline_sha256_mismatch")
  const value = JSON.parse(bytes.toString("utf8")) as unknown
  if (!isRecord(value)) throw new Error("machine_review_timeline_json_invalid")
  if (stringOrNull(value.runId) !== stringOrNull(latestBinding.source.runId)) {
    throw new Error("machine_review_timeline_run_id_mismatch")
  }
  const completedReviewCount = requiredNonNegativeInteger(value.completedReviewCount, "machine_review_completed_count_invalid")
  const targetReviewCount = requiredNonNegativeInteger(value.targetReviewCount, "machine_review_target_count_invalid")
  const previewPassCount = requiredNonNegativeInteger(value.previewPassCount, "machine_review_pass_count_invalid")
  const previewFailCount = requiredNonNegativeInteger(value.previewFailCount, "machine_review_fail_count_invalid")
  if (completedReviewCount > targetReviewCount || previewPassCount + previewFailCount !== completedReviewCount) {
    throw new Error("machine_review_count_identity_invalid")
  }
  if (!Array.isArray(value.reviews) || value.reviews.length !== completedReviewCount) {
    throw new Error("machine_review_nodes_invalid")
  }
  const reviews = value.reviews.map((item, index) => normalizeReviewNode(item, index))
  return {
    availability: "available",
    reasonCode: null,
    sourcePath: normalizeProjectRelativePath(sourcePath),
    sourceSha256,
    integrityStatus: "verified",
    schemaVersion: stringOrNull(value.schemaVersion),
    status: stringOrNull(value.status),
    runId: stringOrNull(value.runId),
    sampleId: stringOrNull(value.sampleId),
    sampleSplit: stringOrNull(value.sampleSplit),
    completedReviewCount,
    targetReviewCount,
    previewPassCount,
    previewFailCount,
    updatedAtUtc: stringOrNull(value.updatedAtUtc),
    completedAtUtc: stringOrNull(value.completedAtUtc),
    reviews,
  }
}

function normalizeReviewNode(value: unknown, index: number): AiPainterMachineReviewNode {
  if (!isRecord(value)) throw new Error(`machine_review_node_${index}_invalid`)
  const issueCodes = Array.isArray(value.issueCodes)
    ? value.issueCodes.map((code) => requiredString(code, `machine_review_node_${index}_issue_code_invalid`))
    : []
  return {
    epoch: requiredNonNegativeInteger(value.epoch, `machine_review_node_${index}_epoch_invalid`),
    passed: requiredBoolean(value.passed, `machine_review_node_${index}_passed_invalid`),
    issueCodes,
    previewPath: requiredString(value.previewPath, `machine_review_node_${index}_preview_path_missing`),
    previewSha256: requiredSha256(value.previewSha256, `machine_review_node_${index}_preview_sha256_invalid`),
    reproductionPath: stringOrNull(value.reproductionPath),
    reproductionSha256: sha256OrNull(value.reproductionSha256),
    normalizedPath: stringOrNull(value.normalizedPath),
    normalizedSha256: sha256OrNull(value.normalizedSha256),
  }
}

function optionalLatestTrainingTerminal(value: unknown): { source: JsonRecord; path: string; sha256: string } | null {
  if (value === null || value === undefined) return null
  return requiredBinding(value, "latest_training_terminal")
}

function requiredBinding(value: unknown, role: string): { source: JsonRecord; path: string; sha256: string } {
  if (!isRecord(value)) throw new Error(`${role}_binding_missing`)
  return {
    source: value,
    path: normalizeProjectRelativePath(requiredString(value.path, `${role}_path_missing`)),
    sha256: requiredSha256(value.sha256, `${role}_sha256_invalid`),
  }
}

async function readExactProjectFile(projectRoot: string, relativePath: string): Promise<Buffer> {
  const normalized = normalizeProjectRelativePath(relativePath)
  const absoluteRoot = path.resolve(projectRoot)
  const absolutePath = path.resolve(absoluteRoot, ...normalized.split("/"))
  const relative = path.relative(absoluteRoot, absolutePath)
  if (relative === ".." || relative.startsWith(`..${path.sep}`) || path.isAbsolute(relative)) {
    throw new Error("machine_review_timeline_project_boundary_violation")
  }
  return readFile(absolutePath)
}

function normalizeProjectRelativePath(value: string): string {
  const candidate = value.replaceAll("\\", "/")
  if (path.posix.isAbsolute(candidate) || /^[A-Za-z]:\//u.test(candidate)) {
    throw new Error("absolute_evidence_path_forbidden")
  }
  const normalized = path.posix.normalize(candidate)
  if (normalized === ".." || normalized.startsWith("../")) {
    throw new Error("parent_evidence_path_forbidden")
  }
  return normalized
}

function unavailableSnapshot(reasonCode: string, observedAtUtc: string): AiPainterCurrentExecutionSnapshot {
  return {
    ok: false,
    schemaVersion: "ai_console_ai_painter_current_execution_projection_v1",
    dataStatus: "unknown_or_stale",
    reasonCode,
    sourceIdentity: "ai-painter-current-execution",
    sourcePath: CURRENT_EXECUTION_REGISTRY_PATH,
    sourceSha256: null,
    integrityStatus: "unavailable",
    registryRevision: null,
    writerIdentity: null,
    currentProjectTask: null,
    activeExecution: null,
    latestTrainingTerminal: null,
    selectedHistoricalRun: null,
    machineReview: unavailableReview("current_execution_registry_unavailable"),
    recordedAtUtc: null,
    recordedAtAsiaShanghai: null,
    observedAtUtc,
    evidenceReferences: [CURRENT_EXECUTION_REGISTRY_PATH],
  }
}

function unavailableReview(reasonCode: string): AiPainterMachineReviewSummary {
  return {
    availability: "unavailable",
    reasonCode,
    sourcePath: null,
    sourceSha256: null,
    integrityStatus: "unavailable",
    schemaVersion: null,
    status: null,
    runId: null,
    sampleId: null,
    sampleSplit: null,
    completedReviewCount: null,
    targetReviewCount: null,
    previewPassCount: null,
    previewFailCount: null,
    updatedAtUtc: null,
    completedAtUtc: null,
    reviews: [],
  }
}

function isRecord(value: unknown): value is JsonRecord {
  return typeof value === "object" && value !== null && !Array.isArray(value)
}

function stringOrNull(value: unknown): string | null {
  return typeof value === "string" && value.length > 0 ? value : null
}

function sha256OrNull(value: unknown): string | null {
  return typeof value === "string" && /^[a-f0-9]{64}$/u.test(value) ? value : null
}

function requiredString(value: unknown, code: string): string {
  if (typeof value !== "string" || value.length === 0) throw new Error(code)
  return value
}

function requiredSha256(value: unknown, code: string): string {
  if (typeof value !== "string" || !/^[a-f0-9]{64}$/u.test(value)) throw new Error(code)
  return value
}

function requiredInteger(value: unknown, code: string): number {
  if (!Number.isInteger(value)) throw new Error(code)
  return value as number
}

function integerOrNull(value: unknown): number | null {
  return Number.isInteger(value) ? value as number : null
}

function requiredNonNegativeInteger(value: unknown, code: string): number {
  const normalized = requiredInteger(value, code)
  if (normalized < 0) throw new Error(code)
  return normalized
}

function requiredBoolean(value: unknown, code: string): boolean {
  if (typeof value !== "boolean") throw new Error(code)
  return value
}

function sha256(bytes: Buffer): string {
  return createHash("sha256").update(bytes).digest("hex")
}
