import type { AiPainterCurrentExecutionSnapshot } from "@/server/ai-console/ai-painter-current-execution-projection"
import type { AiConsoleLiveSnapshot } from "./ai-console-live-observability"

export type TrainingPresentation = {
  availability: "available" | "unavailable"
  reasonCode: string | null
  runId: string | null
  scope: string | null
  resolution: { width: number; height: number } | null
  targetEpochs: number | null
  targetOptimizerSteps: number | null
  completedEpochs: number | null
  actualOptimizerSteps: { generator: number; critic: number } | null
  errorCode: string | null
  packagePath: string | null
  packageSha256: string | null
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
function count(value: unknown): number | null {
  return typeof value === "number" && Number.isSafeInteger(value) && value >= 0 ? value : null
}
export function terminalLabel(status: string | null | undefined) {
  if (!status) return "尚无最近训练终态"
  if (/fail|error|interrupt|blocked/i.test(status)) return "已失败或受阻，证据保留"
  if (/complete|executed|qualified|passed/i.test(status)) return "执行已结束，正式资格另行裁决"
  return "已登记终态，结论见历史证据"
}

/** Only the verified registry chooses identity; telemetry supplies active numbers. */
export function mapTrainingSummary(current: CurrentSummaryReadState, live: LiveReadState, now = Date.now()) {
  const registry = current.snapshot
  const registryFresh = current.connection === "ready" && registry?.ok === true
    && registry.dataStatus === "connected" && registry.integrityStatus === "verified"
    && fresh(registry.observedAtUtc, now, 10_000)
  const active = registryFresh ? registry?.activeExecution : null
  const activeRunId = typeof active?.runId === "string" && active.runId ? active.runId : null
  const pid = count(active?.processId)
  const task = registry?.currentProjectTask
  const telemetry = live.snapshot?.trainingTelemetry.latest
  const liveFresh = live.connection === "connected" && live.snapshot?.ok === true
    && fresh(live.snapshot.sampleCompletedAtUtc, now, 10_000)
  const matched = !!activeRunId && pid !== null && pid > 0 && liveFresh
    && live.snapshot?.trainingTelemetry.status === "connected"
    && telemetry?.runId === activeRunId && telemetry.processId === pid
    && fresh(telemetry.heartbeatAtUtc, now, 15_000) && fresh(telemetry.reportedAtUtc, now, 15_000)
  const readOnly = !!task?.taskKind?.includes("readonly")
  const training = matched && !readOnly && active?.executionState === "executing"
  const presentation = registryFresh && registry?.trainingPresentation?.availability === "available"
    && registry.trainingPresentation.runId === (activeRunId ?? registry.latestTrainingTerminal?.runId)
    ? registry.trainingPresentation : null
  const latest = registryFresh ? registry?.latestTrainingTerminal : null
  const phase = String(active?.executionState ?? "")
  const phases: Record<string, string> = { preflight: "准备与检查中", validating: "验证中（非训练）", reviewing: "审核中（非训练）", adjudicating: "裁决中（非训练）", finalizing: "收尾中（非训练）" }
  let status = "当前执行不可用"
  let reason = "等待受信当前登记"
  if (current.connection === "failed" || !registryFresh && registry) {
    status = "当前执行断线或过期"
    reason = "保留的快照已过期，不代表当前正常运行"
  } else if (registryFresh && !active) {
    status = "当前无活动执行"
    reason = "最近结束记录不代表正在训练"
  } else if (activeRunId) {
    status = readOnly ? "只读诊断中（非训练）" : training ? "正在训练（身份与遥测已匹配）" : phases[phase] ?? "执行已登记，训练状态待核验"
    reason = training ? "仅显示匹配 Run、PID 且新鲜的训练遥测" : "当前训练指标未核验，不以 GPU 占用推断训练"
    if (!liveFresh && !phases[phase] && !readOnly) reason = "实时遥测断线或过期，保留值不作为当前指标"
  }
  const resolution = presentation?.resolution
  const width = count(resolution?.width), height = count(resolution?.height)
  return {
    status, reason, training, registryFresh,
    tone: training ? "active" : !registryFresh || !!activeRunId && !matched ? "warning" : "neutral",
    activeRunId, processId: pid,
    epoch: training ? count(telemetry?.epoch) : null,
    optimizerStep: training ? count(telemetry?.optimizationStep) : null,
    targetEpochs: count(presentation?.targetEpochs), targetOptimizerSteps: count(presentation?.targetOptimizerSteps),
    resolution: width && height ? `${width} × ${height}` : "未知（绑定包未提供）",
    lastMetricAt: training ? telemetry?.reportedAtUtc ?? null : null,
    eta: training && typeof telemetry?.estimatedCompletionAtUtc === "string" && Number.isFinite(Date.parse(telemetry.estimatedCompletionAtUtc)) ? telemetry.estimatedCompletionAtUtc : null,
    loss: training && typeof telemetry?.loss === "number" && Number.isFinite(telemetry.loss) ? telemetry.loss : null,
    latestRunId: latest?.runId ?? null, latestStatus: registryFresh ? terminalLabel(latest?.status) : "不可用（当前登记未核验）",
    terminalEpochs: !active && presentation ? count(presentation.completedEpochs) : null,
    terminalGeneratorSteps: !active && presentation ? count(presentation.actualOptimizerSteps?.generator) : null,
    terminalCriticSteps: !active && presentation ? count(presentation.actualOptimizerSteps?.critic) : null,
    errorCode: current.errorCode ?? (presentation?.errorCode || presentation?.reasonCode)
      ?? (registryFresh && registry?.trainingPresentation?.runId === (activeRunId ?? registry.latestTrainingTerminal?.runId)
        ? registry?.trainingPresentation?.reasonCode : null) ?? registry?.reasonCode ?? null,
    packagePath: presentation?.packagePath ?? null, packageSha256: presentation?.packageSha256 ?? null,
    telemetryRunId: telemetry?.runId ?? null, telemetryProcessId: telemetry?.processId ?? null,
    rawMetricAt: telemetry?.reportedAtUtc ?? null,
  }
}
