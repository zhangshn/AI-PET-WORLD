"use client"

import type { CSSProperties } from "react"
import { refreshAiConsoleLiveObservability, type AiConsoleLiveHistoryPoint, useAiConsoleLiveObservability } from "./ai-console-live-observability"
import styles from "./ai-console-live-status.module.css"

type ObservabilityPanelMode = "resources" | "training" | "telemetry"

function metricValue(value: number | null, unit = "%", digits = 1): string {
  return value === null ? "—" : `${value.toFixed(digits)}${unit}`
}

function bytes(value: number | null): string {
  return value === null ? "—" : `${(value / 1024 ** 3).toFixed(2)} GiB`
}

function millisecondTime(value: string | null | undefined): string {
  if (!value) return "--:--:--.---"
  const timestamp = new Date(value)
  if (!Number.isFinite(timestamp.getTime())) return "--:--:--.---"
  const clock = timestamp.toLocaleTimeString("zh-CN", { hour12: false, hour: "2-digit", minute: "2-digit", second: "2-digit" })
  return `${clock}.${String(timestamp.getMilliseconds()).padStart(3, "0")}`
}

function ageMilliseconds(value: string | null | undefined): number | null {
  if (!value) return null
  const timestamp = Date.parse(value)
  return Number.isFinite(timestamp) ? Math.max(0, Date.now() - timestamp) : null
}

function Sparkline({ field, history, maximum = 100 }: { field: keyof AiConsoleLiveHistoryPoint; history: readonly AiConsoleLiveHistoryPoint[]; maximum?: number }) {
  const values = history.map((point) => point[field]).filter((value): value is number => typeof value === "number" && Number.isFinite(value))
  if (values.length < 2) return <div className={styles.sparklineEmpty}>等待连续采样</div>
  const max = Math.max(maximum, ...values, 1)
  const points = values.map((value, index) => `${(index / Math.max(1, values.length - 1)) * 300},${64 - (value / max) * 58}`).join(" ")
  return <svg aria-hidden="true" className={styles.sparkline} preserveAspectRatio="none" viewBox="0 0 300 64"><polyline points={points} /></svg>
}

function ResourceGauge({ label, value, detail }: { label: string; value: number | null; detail: string }) {
  const style = { "--gauge-value": `${Math.max(0, Math.min(100, value ?? 0))}%` } as CSSProperties
  return <article className={styles.resourceGauge} style={style}><header><span>{label}</span><strong>{metricValue(value)}</strong></header><div><i /></div><p>{detail}</p></article>
}

function ProcessTable({ records }: { records: readonly {
  processId: number
  processName: string
  commandSummary: string
  workingSetBytes: number | null
  gpuMemoryBytes: number | null
}[] }) {
  return (
    <section className={styles.processPanel}>
      <header><div><span>DIRECT PROCESS OBSERVATION</span><strong>训练进程观测</strong></div><small>{records.length} PROCESSES</small></header>
      <div className={styles.processTable}>
        <div><span>PID</span><span>进程</span><span>工作集</span><span>GPU显存</span><span>观测边界</span></div>
        {records.length > 0 ? records.map((record) => (
          <div key={record.processId}><code>{record.processId}</code><strong>{record.commandSummary}</strong><span>{bytes(record.workingSetBytes)}</span><span>{bytes(record.gpuMemoryBytes)}</span><small>进程匹配，不等于正式Run</small></div>
        )) : <div className={styles.processEmpty}><strong>当前未观测到训练特征进程</strong><span>进程列表只用于资源定位，不推断activeExecution。</span></div>}
      </div>
    </section>
  )
}

export function AiConsoleObservabilityPanel({ mode }: { mode: ObservabilityPanelMode }) {
  const { connection, snapshot, history, errorCode, roundTripDurationMs } = useAiConsoleLiveObservability()
  const telemetry = snapshot?.trainingTelemetry.latest
  const snapshotAgeMs = ageMilliseconds(snapshot?.sampleCompletedAtUtc)
  const gpuAgeMs = ageMilliseconds(snapshot?.channelTimings.gpu.sampledAtUtc)
  const heading = mode === "training" ? "训练实时仪表盘" : mode === "telemetry" ? "浏览会话遥测趋势" : "本机资源实时仪表盘"
  const caption = mode === "training" ? "TRAINING LIVE OPERATIONS" : mode === "telemetry" ? "SESSION TELEMETRY TREND" : "LOCAL MACHINE OBSERVABILITY"

  return (
    <section className={styles.observabilityPanel} aria-label={heading}>
      <header className={styles.observabilityHeader}>
        <div><span>{caption}</span><h3>{heading}</h3><p>250毫秒目标刷新 · 毫秒时间合同 · 新平台本机探针</p></div>
        <div><small className={connection === "connected" ? styles.connectedState : connection === "failed" ? styles.failedState : styles.connectingState}>{connection.toUpperCase()}</small><strong>{millisecondTime(snapshot?.sampleCompletedAtUtc)}</strong><code>AGE {snapshotAgeMs ?? "—"} ms</code><button onClick={() => { void refreshAiConsoleLiveObservability() }} type="button">立即刷新</button></div>
      </header>

      {connection === "failed" ? <div className={styles.observabilityFailure}><strong>实时探针暂时不可用</strong><code>{errorCode}</code></div> : null}

      {mode === "training" ? (
        <div className={styles.trainingCommandDeck}>
          <section className={styles.trainingIdentityPanel}>
            <header><span>FORMAL TRAINING REPORT</span><strong>{telemetry ? "新平台训练上报已连接" : "训练语义等待上报"}</strong></header>
            {telemetry ? (
              <dl>
                <div><dt>Run</dt><dd>{telemetry.runId}</dd></div><div><dt>Execution</dt><dd>{telemetry.executionId}</dd></div>
                <div><dt>Stage</dt><dd>{telemetry.trainingStage ?? "—"}</dd></div><div><dt>Epoch</dt><dd>{telemetry.epoch ?? "—"}</dd></div>
                <div><dt>Batch</dt><dd>{telemetry.batchIndex ?? "—"} / {telemetry.batchCount ?? "—"}</dd></div><div><dt>优化步</dt><dd>{telemetry.optimizationStep ?? "—"}</dd></div>
                <div><dt>Loss</dt><dd>{telemetry.loss?.toFixed(6) ?? "—"}</dd></div><div><dt>学习率</dt><dd>{telemetry.learningRate?.toExponential(3) ?? "—"}</dd></div>
                <div><dt>吞吐</dt><dd>{metricValue(telemetry.throughputSamplesPerSecond, " samples/s", 2)}</dd></div><div><dt>预计完成</dt><dd>{telemetry.estimatedCompletionAtUtc ? new Date(telemetry.estimatedCompletionAtUtc).toLocaleString("zh-CN", { hour12: false }) : "—"}</dd></div>
                <div><dt>Checkpoint</dt><dd>{telemetry.checkpointIdentity ?? "—"}</dd></div><div><dt>心跳</dt><dd>{millisecondTime(telemetry.heartbeatAtUtc)}</dd></div>
              </dl>
            ) : (
              <div className={styles.trainingNotReported}><strong>硬件观测已工作，Run / Epoch / Loss 尚无新平台上报</strong><p>不会读取旧页面、旧API或训练目录补值；未来新平台训练执行器写入统一遥测登记后，本面板自动出现指标。</p><code>{snapshot?.trainingTelemetry.reasonCode ?? "awaiting_first_snapshot"}</code></div>
            )}
          </section>
          <section className={styles.trainingTrendPanel}><header><span>LOSS TREND</span><strong>训练指标趋势</strong><small>{history.filter((point) => point.loss !== null).length} SAMPLES</small></header><Sparkline field="loss" history={history} maximum={Math.max(1, ...history.map((point) => point.loss ?? 0))} /></section>
        </div>
      ) : null}

      <div className={styles.resourceGaugeGrid}>
        <ResourceGauge label="CPU" value={snapshot?.resources.cpuUtilization ?? null} detail={`${snapshot?.resources.logicalCpuCount ?? "—"} 逻辑核心`} />
        <ResourceGauge label="内存" value={snapshot?.resources.memoryUtilization ?? null} detail={`${bytes(snapshot?.resources.memoryUsedBytes ?? null)} / ${bytes(snapshot?.resources.memoryTotalBytes ?? null)}`} />
        <ResourceGauge label="GPU" value={snapshot?.resources.gpuUtilization ?? null} detail={snapshot?.gpu.adapters[0]?.name ?? "GPU探针等待连接"} />
        <ResourceGauge label="显存" value={snapshot?.resources.vramUtilization ?? null} detail={`${bytes(snapshot?.resources.gpuMemoryUsedBytes ?? null)} / ${bytes(snapshot?.resources.gpuMemoryTotalBytes ?? null)}`} />
      </div>

      <div className={styles.telemetryFacts}>
        <div><span>GPU温度</span><strong>{metricValue(snapshot?.resources.gpuTemperatureCelsius ?? null, "°C", 0)}</strong><small>nvidia-smi 直接观测</small></div>
        <div><span>GPU功耗</span><strong>{metricValue(snapshot?.resources.gpuPowerDrawWatts ?? null, " W", 1)}</strong><small>上限 {metricValue(snapshot?.resources.gpuPowerLimitWatts ?? null, " W", 0)}</small></div>
        <div><span>磁盘占用</span><strong>{metricValue(snapshot?.resources.diskUtilization ?? null)}</strong><small>可用 {bytes(snapshot?.resources.diskFreeBytes ?? null)}</small></div>
        <div><span>训练进程</span><strong>{snapshot?.trainingProcesses.records.length ?? 0}</strong><small>只读进程特征匹配</small></div>
        <div><span>采样序号</span><strong>{snapshot ? `#${snapshot.sampleSequence}` : "—"}</strong><small>{millisecondTime(snapshot?.sampleCompletedAtUtc)} · AGE {snapshotAgeMs ?? "—"} ms</small></div>
        <div><span>采样时延</span><strong>{roundTripDurationMs === null ? "—" : `${roundTripDurationMs.toFixed(1)} ms`}</strong><small>窗口 {snapshot?.sampleDurationMs.toFixed(3) ?? "—"} ms · GPU年龄 {gpuAgeMs ?? "—"} ms</small></div>
      </div>

      <div className={styles.trendGrid}>
        {([[
          "CPU趋势", "cpu"], ["内存趋势", "memory"], ["GPU趋势", "gpu"], ["显存趋势", "vram"],
        ] as const).map(([label, field]) => (
          <article key={field}><header><span>{label}</span><strong>{history.length} SAMPLES</strong></header><Sparkline field={field} history={history} /></article>
        ))}
      </div>

      <ProcessTable records={snapshot?.trainingProcesses.records ?? []} />
      <footer className={styles.observabilityBoundary}><strong>观察边界</strong><span>时间戳精确到毫秒，目标刷新周期为250毫秒；硬件计数器仍服从操作系统与驱动自身刷新粒度。浏览会话曲线不是不可变证据，正式训练指标只接受新平台训练遥测登记。</span></footer>
    </section>
  )
}
