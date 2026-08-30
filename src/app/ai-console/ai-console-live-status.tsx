"use client"

import type { CSSProperties } from "react"
import Link from "next/link"
import { useState } from "react"
import { refreshAiConsoleLiveObservability, useAiConsoleLiveObservability } from "./ai-console-live-observability"
import styles from "./ai-console-live-status.module.css"

function percent(value: number | null): string {
  return value === null ? "—" : `${value.toFixed(1)}%`
}

function numberWithUnit(value: number | null, unit: string, digits = 0): string {
  return value === null ? "—" : `${value.toFixed(digits)}${unit}`
}

function bytes(value: number | null): string {
  if (value === null) return "—"
  return `${(value / 1024 ** 3).toFixed(1)} GiB`
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

function milliseconds(value: number | null, digits = 0): string {
  return value === null ? "—" : `${value.toFixed(digits)} ms`
}

function Metric({ label, value, utilization }: { label: string; value: string; utilization: number | null }) {
  const meterStyle = { "--live-meter": `${Math.max(0, Math.min(100, utilization ?? 0))}%` } as CSSProperties
  return <div className={styles.metric} style={meterStyle}><span>{label}</span><strong>{value}</strong><i /></div>
}

export function AiConsoleLiveStatus() {
  const { connection, snapshot, errorCode, roundTripDurationMs } = useAiConsoleLiveObservability()
  const [expanded, setExpanded] = useState(false)
  const snapshotAgeMs = ageMilliseconds(snapshot?.sampleCompletedAtUtc)
  const gpuAgeMs = ageMilliseconds(snapshot?.channelTimings.gpu.sampledAtUtc)
  const telemetry = snapshot?.trainingTelemetry.latest
  const observedProcessCount = snapshot?.trainingProcesses.records.length ?? 0
  const trainingSummary = telemetry
    ? `${telemetry.trainingStage ?? "TRAINING"} · E${telemetry.epoch ?? "—"} · LOSS ${telemetry.loss?.toFixed(4) ?? "—"}`
    : observedProcessCount > 0
      ? `发现 ${observedProcessCount} 个训练进程 · 指标未上报`
      : "新平台训练指标未上报"

  return (
    <section className={styles.liveBar} aria-label="全局实时运行状态">
      <button
        aria-expanded={expanded}
        className={styles.liveIdentity}
        onClick={() => setExpanded((current) => !current)}
        type="button"
      >
        <span className={connection === "connected" ? styles.livePulse : connection === "failed" ? styles.failedPulse : styles.connectingPulse} />
        <div><small>{snapshot ? `LIVE · #${snapshot.sampleSequence} · ${snapshotAgeMs ?? "—"}MS` : "LIVE OBSERVABILITY"}</small><strong>{connection === "connected" ? "本机精确实时状态" : connection === "failed" ? "实时探针中断" : "正在连接探针"}</strong></div>
        <i>{expanded ? "收起" : "展开"}</i>
      </button>
      <div className={styles.compactMetrics} aria-live="polite">
        <Metric label="CPU" value={percent(snapshot?.resources.cpuUtilization ?? null)} utilization={snapshot?.resources.cpuUtilization ?? null} />
        <Metric label="内存" value={percent(snapshot?.resources.memoryUtilization ?? null)} utilization={snapshot?.resources.memoryUtilization ?? null} />
        <Metric label="GPU" value={percent(snapshot?.resources.gpuUtilization ?? null)} utilization={snapshot?.resources.gpuUtilization ?? null} />
        <Metric label="显存" value={percent(snapshot?.resources.vramUtilization ?? null)} utilization={snapshot?.resources.vramUtilization ?? null} />
        <Metric label="温度" value={numberWithUnit(snapshot?.resources.gpuTemperatureCelsius ?? null, "°C")} utilization={snapshot?.resources.gpuTemperatureCelsius ?? null} />
      </div>
      <button className={styles.trainingSummary} onClick={() => setExpanded(true)} type="button">
        <span>TRAINING</span><strong>{trainingSummary}</strong><i>›</i>
      </button>

      {expanded ? (
        <div className={styles.liveDrawer}>
          <header>
            <div><span>GLOBAL LIVE OBSERVABILITY</span><strong>不离开当前页面的实时观察面</strong></div>
            <div><small>{snapshot ? `${millisecondTime(snapshot.sampleCompletedAtUtc)} · AGE ${snapshotAgeMs ?? "—"} ms` : "等待首个采样"}</small><button onClick={() => { void refreshAiConsoleLiveObservability() }} type="button">立即刷新</button><button onClick={() => setExpanded(false)} type="button">关闭</button></div>
          </header>
          <div className={styles.drawerGrid}>
            <section>
              <span>RESOURCE SNAPSHOT</span><strong>本机资源</strong>
              <dl>
                <div><dt>CPU</dt><dd>{percent(snapshot?.resources.cpuUtilization ?? null)}</dd></div>
                <div><dt>内存</dt><dd>{bytes(snapshot?.resources.memoryUsedBytes ?? null)} / {bytes(snapshot?.resources.memoryTotalBytes ?? null)}</dd></div>
                <div><dt>GPU</dt><dd>{percent(snapshot?.resources.gpuUtilization ?? null)}</dd></div>
                <div><dt>显存</dt><dd>{bytes(snapshot?.resources.gpuMemoryUsedBytes ?? null)} / {bytes(snapshot?.resources.gpuMemoryTotalBytes ?? null)}</dd></div>
                <div><dt>温度</dt><dd>{numberWithUnit(snapshot?.resources.gpuTemperatureCelsius ?? null, "°C")}</dd></div>
                <div><dt>功耗</dt><dd>{numberWithUnit(snapshot?.resources.gpuPowerDrawWatts ?? null, " W", 1)}</dd></div>
                <div><dt>采样序号</dt><dd>{snapshot ? `#${snapshot.sampleSequence}` : "—"}</dd></div>
                <div><dt>采样完成</dt><dd>{millisecondTime(snapshot?.sampleCompletedAtUtc)}</dd></div>
                <div><dt>采样耗时</dt><dd>{milliseconds(snapshot?.sampleDurationMs ?? null, 3)}</dd></div>
                <div><dt>往返 / GPU年龄</dt><dd>{milliseconds(roundTripDurationMs, 3)} / {milliseconds(gpuAgeMs)}</dd></div>
              </dl>
              <Link href="/ai-console/system/resources">打开完整资源仪表盘 <i>→</i></Link>
            </section>
            <section>
              <span>TRAINING OBSERVABILITY</span><strong>训练运行</strong>
              {telemetry ? (
                <dl>
                  <div><dt>Run</dt><dd>{telemetry.runId}</dd></div>
                  <div><dt>Stage / Epoch</dt><dd>{telemetry.trainingStage ?? "—"} / {telemetry.epoch ?? "—"}</dd></div>
                  <div><dt>优化步</dt><dd>{telemetry.optimizationStep ?? "—"}</dd></div>
                  <div><dt>Loss</dt><dd>{telemetry.loss?.toFixed(6) ?? "—"}</dd></div>
                  <div><dt>吞吐</dt><dd>{numberWithUnit(telemetry.throughputSamplesPerSecond, " samples/s", 2)}</dd></div>
                  <div><dt>预计完成</dt><dd>{telemetry.estimatedCompletionAtUtc ? new Date(telemetry.estimatedCompletionAtUtc).toLocaleString("zh-CN", { hour12: false }) : "—"}</dd></div>
                </dl>
              ) : (
                <div className={styles.telemetryEmpty}><strong>{observedProcessCount > 0 ? `已直接观测到 ${observedProcessCount} 个疑似训练进程` : "当前没有新平台训练语义上报"}</strong><p>硬件仍持续采样；进程观测不会被冒充为正式Run、Epoch或Loss。</p><code>{snapshot?.trainingTelemetry.reasonCode ?? errorCode ?? "awaiting_live_snapshot"}</code></div>
              )}
              <Link href="/ai-console/training/overview">打开完整训练仪表盘 <i>→</i></Link>
            </section>
          </div>
        </div>
      ) : null}
    </section>
  )
}
