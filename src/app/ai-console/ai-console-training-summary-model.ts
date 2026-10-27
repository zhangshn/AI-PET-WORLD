import type { AiPainterCurrentExecutionSnapshot } from "@/server/ai-console/ai-painter-current-execution-projection"
import type { AiConsoleLiveSnapshot } from "./ai-console-live-observability"
import { mapWorkerTiming, type WorkerExecutionTiming } from "./ai-console-training-time"
import type { ExperimentTiming } from "./ai-console-experiment-time"

export type CurrentTrainingMetrics = {
  availability: "available" | "unavailable"
  reasonCode: string | null
  runId: string | null
  processId: number | null
  processStartIdentity: string | null
  phase: "preparing" | "executing" | "validating" | "completed" | "failed_closed" | null
  epoch: number | null
  optimizationStep: number | null
  discriminatorOptimizerSteps: number | null
  loss: number | null
  learningRate: number | null
  batchIndex: number | null
  batchCount: number | null
  throughputSamplesPerSecond: number | null
  estimatedCompletionAtUtc: string | null
  checkpointIdentity: string | null
  reportedAtUtc: string | null
  heartbeatAtUtc: string | null
  sourcePath: string | null
  sourceSha256: string | null
  progressTtlSeconds: 120
  sourceIdentity: "current_registry_bound_progress_v1"
}

export type TrainingPresentation = {
  availability: "available" | "unavailable"
  reasonCode: string | null
  runId: string | null
  scope: string | null
  resolution: { width: number; height: number } | null
  targetEpochs: number | null
  targetOptimizerSteps: number | null
  targetDiscriminatorOptimizerSteps?: number | null
  completedEpochs: number | null
  actualOptimizerSteps: { generator: number; critic: number } | null
  errorCode: string | null
  packagePath: string | null
  packageSha256: string | null
  currentMetrics?: CurrentTrainingMetrics | null
  workerExecutionTiming?: WorkerExecutionTiming | null
  experimentTiming?: ExperimentTiming | null
}

export type CurrentSummarySnapshot = Omit<AiPainterCurrentExecutionSnapshot, "trainingPresentation"> & { trainingPresentation?: TrainingPresentation | null }
export type CurrentSummaryReadState = {
  connection: "connecting" | "ready" | "failed"
  snapshot: CurrentSummarySnapshot | null
  errorCode: string | null
  observedNowMs?: number
}
type LiveReadState = { connection: "connecting" | "connected" | "failed"; snapshot: AiConsoleLiveSnapshot | null }

function fresh(timestamp: unknown, now: number, maximumAge: number) {
  if (typeof timestamp !== "string") return false
  const age = now - Date.parse(timestamp)
  return Number.isFinite(age) && age >= 0 && age <= maximumAge
}
function text(value: unknown): string | null {
  return typeof value === "string" && value.trim().length > 0 ? value : null
}
function finite(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null
}
function count(value: unknown): number | null {
  return typeof value === "number" && Number.isSafeInteger(value) && value >= 0 ? value : null
}
function safeErrorLabel(value: unknown): string | null {
  if (typeof value !== "string" || !value.trim()) return null
  return /^[a-zA-Z0-9_.:-]{1,128}$/.test(value) ? value : "错误详情见已绑定终态证据"
}
// ENOENT is expected only for this exact observation file, not a missing lock,
// package, parent directory, or another Run. Paths are compared, never read here.
function missingProgress(reason: unknown, directory: string) {
  if (typeof reason !== "string") return false
  const match = /^ENOENT: no such file or directory, (?:realpath|open) '([^'\r\n]+)'$/.exec(reason)
  if (!match) return false
  const filename = match[1].replaceAll("\\", "/")
  return !filename.split("/").some(part => part === "." || part === "..")
    && (filename === `${directory}/progress.json` || filename.endsWith(`/${directory}/progress.json`))
}
export function terminalLabel(status: string | null | undefined) {
  if (!status) return "尚无最近训练终态"
  if (/fail|error|interrupt|blocked/i.test(status)) return "已失败或受阻，证据保留"
  if (/complete|executed|qualified|passed/i.test(status)) return "执行已结束，正式资格另行裁决"
  return "已登记终态，结论见历史证据"
}

/** Pure read-only mapping shared by the summary and AP-03; no runtime or resource IO. */
export function mapTrainingSummary(current: CurrentSummaryReadState, live: LiveReadState, now = Date.now()) {
  const registry = current.snapshot
  const registryFresh = current.connection === "ready" && registry?.ok === true
    && registry.dataStatus === "connected" && registry.integrityStatus === "verified"
    && fresh(registry.observedAtUtc, now, 10_000)
  const active = registryFresh ? registry?.activeExecution : null
  const activeRunId = typeof active?.runId === "string" && active.runId ? active.runId : null
  const pid = count(active?.processId)
  const task = registry?.currentProjectTask
  const telemetry = live.snapshot?.trainingTelemetry?.latest
  const liveFresh = live.connection === "connected" && live.snapshot?.ok === true
    && fresh(live.snapshot.sampleCompletedAtUtc, now, 10_000)
  const legacyMatched = !!activeRunId && pid !== null && pid > 0 && liveFresh
    && live.snapshot?.trainingTelemetry?.status === "connected"
    && telemetry?.runId === activeRunId && telemetry.processId === pid
    && fresh(telemetry.heartbeatAtUtc, now, 15_000) && fresh(telemetry.reportedAtUtc, now, 15_000)
  const readOnly = /readonly|read_only/i.test(task?.taskKind ?? "")
  const presentation = registryFresh && registry?.trainingPresentation?.availability === "available"
    && registry.trainingPresentation.runId === (activeRunId ?? registry.latestTrainingTerminal?.runId)
    ? registry.trainingPresentation : null
  const latest = registryFresh ? registry?.latestTrainingTerminal : null
  const latestFailed = !!text(latest?.runId) && !!latest?.status && /fail|error|interrupt|blocked/i.test(latest.status)
  // A current Run's error must not be attributed to a different, previous Run.
  const terminalErrorCode = !active && latestFailed && presentation?.runId === latest?.runId
    ? safeErrorLabel(presentation?.errorCode) : null
  const phase = String(active?.executionState ?? "")
  const phases: Record<string, string> = { package_materialized: "执行包已准备（非训练）", preflight: "准备／CPU检查阶段（非训练）", validating: "验证中（非训练）", reviewing: "审核中（非训练）", adjudicating: "裁决中（非训练）", finalizing: "收尾中（非训练）", completed: "执行已完成（非训练）", failed_closed: "执行已失败关闭（非训练）", blocked_policy_boundary: "政策边界阻断（非训练）" }
  const registeredStage = Object.prototype.hasOwnProperty.call(phases, phase) ? phases[phase] : null
  const rawPresentation = registry?.trainingPresentation
  // Presence is decisive: a rejected or null extension must never fall back to SQLite.
  const hasBoundMetrics = !!rawPresentation && Object.prototype.hasOwnProperty.call(rawPresentation, "currentMetrics")
  const bound = hasBoundMetrics ? rawPresentation?.currentMetrics : null
  let metricReasonCode: string | null = null
  if (!registryFresh) metricReasonCode = current.errorCode ?? registry?.reasonCode ?? "current_execution_registry_stale"
  else if (!activeRunId) metricReasonCode = "active_execution_not_registered"
  else if (readOnly) metricReasonCode = "readonly_execution_has_no_training_metrics"
  else if (phase !== "executing" && !Object.prototype.hasOwnProperty.call(phases, phase)) metricReasonCode = "training_execution_phase_invalid"
  else if (hasBoundMetrics) {
    if (!presentation || !bound || bound.availability !== "available") {
      metricReasonCode = bound?.reasonCode ?? rawPresentation?.reasonCode ?? "training_bound_progress_unavailable"
    } else if (bound.sourceIdentity !== "current_registry_bound_progress_v1" || bound.progressTtlSeconds !== 120
      || !text(bound.sourcePath) || !/^[a-f0-9]{64}$/.test(bound.sourceSha256 ?? "")
      || (Object.prototype.hasOwnProperty.call(presentation, "packageSha256") && !/^[a-f0-9]{64}$/.test(presentation.packageSha256 ?? ""))) {
      metricReasonCode = "training_bound_progress_source_invalid"
    } else if (bound.runId !== activeRunId || rawPresentation?.runId !== activeRunId
      || task?.runId !== activeRunId || pid === null || pid <= 0 || bound.processId !== pid
      || !text(active?.processStartIdentity) || bound.processStartIdentity !== active?.processStartIdentity
      || (task?.packageId != null && task.packageId !== active?.packageId)
      || (task?.capabilityVersion != null && task.capabilityVersion !== active?.capabilityVersion)) {
      metricReasonCode = "training_bound_progress_identity_mismatch"
    } else if (!["preparing", "executing", "validating", "completed", "failed_closed"].includes(bound.phase ?? "")) {
      metricReasonCode = "training_bound_progress_phase_invalid"
    } else if (!fresh(bound.reportedAtUtc, now, 120_000)) {
      metricReasonCode = "training_bound_progress_stale_or_future"
    } else if (!fresh(bound.heartbeatAtUtc, now, 15_000)) {
      metricReasonCode = "training_bound_heartbeat_stale_or_future"
    } else if ([bound.epoch, bound.optimizationStep, bound.discriminatorOptimizerSteps, bound.batchIndex, bound.batchCount]
      .some(value => value !== null && count(value) === null)
      || [bound.loss, bound.learningRate, bound.throughputSamplesPerSecond].some(value => value !== null && finite(value) === null)
      || (bound.learningRate !== null && bound.learningRate < 0)
      || (bound.throughputSamplesPerSecond !== null && bound.throughputSamplesPerSecond < 0)
      || (bound.estimatedCompletionAtUtc !== null && !Number.isFinite(Date.parse(bound.estimatedCompletionAtUtc)))) {
      metricReasonCode = "training_bound_progress_values_invalid"
    } else if ((bound.epoch !== null && count(presentation.targetEpochs) !== null && bound.epoch > presentation.targetEpochs!)
      || (bound.optimizationStep !== null && count(presentation.targetOptimizerSteps) !== null && bound.optimizationStep > presentation.targetOptimizerSteps!)
      || (bound.discriminatorOptimizerSteps !== null && count(presentation.targetDiscriminatorOptimizerSteps) !== null && bound.discriminatorOptimizerSteps > presentation.targetDiscriminatorOptimizerSteps!)
      || (bound.batchIndex !== null && bound.batchCount !== null && bound.batchIndex > bound.batchCount)) {
      metricReasonCode = "training_bound_progress_limit_conflict"
    }
  } else if (!legacyMatched) metricReasonCode = "active_execution_has_no_matching_training_telemetry"
  else if ([telemetry?.epoch, telemetry?.optimizationStep, telemetry?.batchIndex, telemetry?.batchCount]
    .some(value => value != null && count(value) === null)
    || [telemetry?.loss, telemetry?.learningRate, telemetry?.throughputSamplesPerSecond]
      .some(value => value != null && finite(value) === null)) metricReasonCode = "training_telemetry_values_invalid"
  const matched = metricReasonCode === null
  const metrics = matched ? hasBoundMetrics ? bound : telemetry : null
  const metricPhase = matched ? hasBoundMetrics ? bound?.phase : phase : null
  const training = matched && active?.executionState === "executing" && metricPhase === "executing"
  const preparing = matched && metricPhase === "preparing"
  const lastKnown = matched && !training && !preparing && !["preflight", "package_materialized"].includes(phase)
  const metricSource = matched ? hasBoundMetrics ? "current_registry_bound_progress_v1" : "matched_training_telemetry_v1" : null
  // A verified registry authenticates stage evidence, not training. In particular
  // dispatch activity can remain pending while a fresh worker progress supersedes it.
  const stageIdentity = registryFresh && !!activeRunId && task?.runId === activeRunId
    && pid !== null && pid > 0 && !!text(active?.processStartIdentity)
    && task?.executionState === phase
    && !!text(task?.capabilityVersion) && task?.capabilityVersion === active?.capabilityVersion
    && !!text(task?.packageId) && task?.packageId === active?.packageId
  const heartbeat = active?.heartbeat as { path?: unknown } | undefined
  const lock = active?.lock as { path?: unknown } | undefined
  const heartbeatPath = text(heartbeat?.path)
  const directory = heartbeatPath?.endsWith("/heartbeat.json") ? heartbeatPath.slice(0, -15) : null
  const emptyBound = bound?.availability === "unavailable" && bound.runId === activeRunId
    && bound.sourceIdentity === "current_registry_bound_progress_v1" && bound.progressTtlSeconds === 120
    && [bound.processId, bound.processStartIdentity, bound.phase, bound.sourcePath, bound.sourceSha256,
      bound.reportedAtUtc, bound.heartbeatAtUtc, bound.epoch, bound.optimizationStep, bound.discriminatorOptimizerSteps,
      bound.loss, bound.learningRate, bound.batchIndex, bound.batchCount, bound.throughputSamplesPerSecond,
      bound.estimatedCompletionAtUtc, bound.checkpointIdentity].every(value => value === null)
  const stagePresentation = !!presentation && !presentation.reasonCode && !presentation.errorCode
    && !current.errorCode && !registry?.reasonCode
    && !!text(presentation.packagePath) && /^[a-f0-9]{64}$/.test(presentation.packageSha256 ?? "")
  const expectedProgressMissing = !!stageIdentity && !readOnly && phase === "executing"
    && ["diagnostic_gpu_qualification_pending", "gpu_qualification_pending"].includes(task?.activity ?? "")
    && task?.terminalStatus === "qualification_pending"
    && !!directory && directory.startsWith(".runtime/ai-painter/")
    && lock?.path === `${directory}/execution-lock.json`
    && task?.terminalPath === `${directory}/dispatched.json` && /^[a-f0-9]{64}$/.test(task?.terminalSha256 ?? "")
    && stagePresentation && emptyBound
    && missingProgress(metricReasonCode, directory)
  const nonTrainingStage = !!stageIdentity && stagePresentation && emptyBound
    && Object.prototype.hasOwnProperty.call(phases, phase)
    && metricReasonCode === "training_progress_active_phase_not_training"
  let status = "当前执行不可用"
  let reason = "等待受信当前登记"
  if (current.connection === "failed" || !registryFresh && registry) {
    status = "当前执行断线或过期"
    reason = "保留的快照已过期，不代表当前正常运行"
  } else if (registryFresh && !active) {
    status = "当前无活动执行"
    reason = "最近结束记录不代表正在训练"
    if (task && Object.prototype.hasOwnProperty.call(phases, task.executionState ?? "")) {
      status += ` · ${phases[task.executionState!]}`
      reason = "当前任务阶段来自已核验登记；无活动执行，不代表训练仍在运行"
    }
  } else if (activeRunId) {
    const progressStatus = metricPhase === "preparing" ? "加载／零更新检查中（尚未开始训练）" : metricPhase === "validating" ? "验证中（非训练）"
      : metricPhase === "completed" ? "训练已完成（非训练）"
        : metricPhase === "failed_closed" ? "训练已失败关闭（非训练）" : null
    status = readOnly ? "只读诊断中（非训练）" : training ? "正在训练（身份与进度已匹配）"
      : metricPhase === "failed_closed" ? progressStatus! : registeredStage ?? progressStatus ?? "执行已登记，训练状态待核验"
    reason = preparing ? "已核验的worker仍在加载或零更新检查；尚未报告权重更新，不以进程存活冒充训练开始"
      :training ? hasBoundMetrics ? "仅显示匹配 Run、PID、进程启动身份的绑定进度；进度有效期 120 秒，心跳有效期 15 秒"
      : "仅显示匹配 Run、PID 且新鲜的训练遥测"
      : lastKnown ? "优化训练已停止；最后核验的计数单独保留，验证或审核不计作训练"
        : "当前训练指标未核验，不以 GPU 占用推断训练"
    if (expectedProgressMissing) {
      status = "GPU准入检查阶段（尚未进入训练）"
      reason = "当前登记仍为准入待回执，训练进度尚未生成；不据此认定准入通过或训练开始"
    } else if (nonTrainingStage) {
      reason = "当前阶段来自同Run已核验登记，不作为优化训练；该阶段未提供当前训练进度"
    } else if (hasBoundMetrics && metricReasonCode && !readOnly) {
      status = "当前阶段／训练进度待核验"
      reason = `当前绑定进度不可用（${safeErrorLabel(metricReasonCode) === metricReasonCode ? metricReasonCode : "读取异常，原始原因见技术详情"}）`
    }
    else if (!liveFresh && !registeredStage && !readOnly && !hasBoundMetrics) reason = "实时遥测断线或过期，保留值不作为当前指标"
  }
  const resolution = presentation?.resolution
  const width = count(resolution?.width), height = count(resolution?.height)
  const currentFailure = registryFresh && ["failed_closed", "blocked_policy_boundary"].includes(active ? phase : task?.executionState ?? "")
  return {
    status, reason, training, registryFresh, metricSource, metricReasonCode, metricPhase,
    tone: training ? "active" : !registryFresh || !!activeRunId && !matched && !expectedProgressMissing && !nonTrainingStage
      || metricPhase === "failed_closed" || currentFailure ? "warning" : "neutral",
    activeRunId, processId: pid,
    epoch: training ? count(metrics?.epoch) : null,
    optimizerStep: training || preparing ? count(metrics?.optimizationStep) : null,
    discriminatorOptimizerSteps: (training || preparing) && hasBoundMetrics ? count(bound?.discriminatorOptimizerSteps) : null,
    targetEpochs: count(presentation?.targetEpochs), targetOptimizerSteps: count(presentation?.targetOptimizerSteps),
    targetDiscriminatorOptimizerSteps: count(presentation?.targetDiscriminatorOptimizerSteps),
    resolution: width && height ? `${width} × ${height}` : "未知（绑定包未提供）",
    lastMetricAt: training ? metrics?.reportedAtUtc ?? null : null,
    eta: training && typeof metrics?.estimatedCompletionAtUtc === "string" && Number.isFinite(Date.parse(metrics.estimatedCompletionAtUtc)) ? metrics.estimatedCompletionAtUtc : null,
    loss: training ? finite(metrics?.loss) : null,
    batchIndex: training ? count(metrics?.batchIndex) : null,
    batchCount: training ? count(metrics?.batchCount) : null,
    learningRate: training ? finite(metrics?.learningRate) : null,
    throughputSamplesPerSecond: training ? finite(metrics?.throughputSamplesPerSecond) : null,
    checkpointIdentity: training ? text(metrics?.checkpointIdentity) : null,
    heartbeatAtUtc: matched ? metrics?.heartbeatAtUtc ?? null : null,
    metricSourcePath: matched && hasBoundMetrics ? bound?.sourcePath ?? null : null,
    metricSourceSha256: matched && hasBoundMetrics ? bound?.sourceSha256 ?? null : null,
    lastKnownEpoch: lastKnown ? count(metrics?.epoch) : null,
    lastKnownGeneratorSteps: lastKnown ? count(metrics?.optimizationStep) : null,
    lastKnownCriticSteps: lastKnown && hasBoundMetrics ? count(bound?.discriminatorOptimizerSteps) : null,
    lastKnownMetricAt: lastKnown ? metrics?.reportedAtUtc ?? null : null,
    latestRunId: latest?.runId ?? null,
    latestStatus: registryFresh ? latestFailed ? "最近训练失败或受阻（不是正在运行） · 证据保留" : terminalLabel(latest?.status) : "不可用（当前登记未核验）",
    latestFailed, terminalErrorCode,
    activeTiming: mapWorkerTiming(activeRunId && presentation?.runId === activeRunId ? presentation.workerExecutionTiming : null),
    latestTiming: mapWorkerTiming(latest?.runId && presentation?.runId === latest.runId ? presentation.workerExecutionTiming : null),
    latestExperimentTiming: latest?.runId && presentation?.runId === latest.runId ? presentation.experimentTiming ?? null : null,
    terminalEpochs: !active && presentation ? count(presentation.completedEpochs) : null,
    terminalGeneratorSteps: !active && presentation ? count(presentation.actualOptimizerSteps?.generator) : null,
    terminalCriticSteps: !active && presentation ? count(presentation.actualOptimizerSteps?.critic) : null,
    errorCode: safeErrorLabel(current.errorCode ?? (hasBoundMetrics ? metricReasonCode : null) ?? (presentation?.errorCode || presentation?.reasonCode)
      ?? (registryFresh && registry?.trainingPresentation?.runId === (activeRunId ?? registry.latestTrainingTerminal?.runId)
        ? registry?.trainingPresentation?.reasonCode : null) ?? registry?.reasonCode ?? null),
    packagePath: presentation?.packagePath ?? null, packageSha256: presentation?.packageSha256 ?? null,
    telemetryRunId: telemetry?.runId ?? null, telemetryProcessId: telemetry?.processId ?? null,
    rawMetricAt: telemetry?.reportedAtUtc ?? null,
    rawActivity: text(task?.activity), rawExecutionState: text(active?.executionState ?? task?.executionState),
    rawTerminalStatus: text(task?.terminalStatus),
  }
}
