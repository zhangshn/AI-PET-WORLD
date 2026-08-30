"use client"

import { useEffect, useState } from "react"
import type { AiPainterCurrentExecutionSnapshot } from "@/server/ai-console/ai-painter-current-execution-projection"
import styles from "./page.module.css"

type ReadState = {
  connection: "connecting" | "ready" | "failed"
  snapshot: AiPainterCurrentExecutionSnapshot | null
  errorCode: string | null
}

const refreshIntervalMs = 1_000

export function AiConsoleCurrentExecutionStatus() {
  const [state, setState] = useState<ReadState>({ connection: "connecting", snapshot: null, errorCode: null })

  useEffect(() => {
    const controller = new AbortController()
    let requestInFlight = false
    const refresh = async () => {
      if (requestInFlight) return
      requestInFlight = true
      try {
        const response = await fetch("/api/ai-console/observability/current-execution", {
          cache: "no-store",
          credentials: "same-origin",
          signal: controller.signal,
        })
        const payload = await response.json() as unknown
        if (!isCurrentExecutionSnapshot(payload)) throw new Error("current_execution_projection_response_invalid")
        setState({ connection: "ready", snapshot: payload, errorCode: payload.reasonCode })
      } catch (error) {
        if (!(error instanceof DOMException && error.name === "AbortError")) {
          setState((current) => ({
            ...current,
            connection: "failed",
            errorCode: error instanceof Error ? error.message : "current_execution_projection_request_failed",
          }))
        }
      } finally {
        requestInFlight = false
      }
    }
    void refresh()
    const intervalId = window.setInterval(() => { void refresh() }, refreshIntervalMs)
    return () => {
      controller.abort()
      window.clearInterval(intervalId)
    }
  }, [])

  const snapshot = state.snapshot
  const task = snapshot?.currentProjectTask
  const review = snapshot?.machineReview
  const reviewSummary = review?.availability === "available"
    ? `${review.previewPassCount ?? "—"} / ${review.targetReviewCount ?? "—"} 通过 · ${review.previewFailCount ?? "—"} 失败`
    : "不可用"

  return (
    <section className={styles.currentExecutionPanel} aria-label="AI Painter当前执行受信投影">
      <header>
        <div><span>CURRENT EXECUTION REGISTRY</span><strong>AI Painter 当前执行</strong></div>
        <div className={snapshot?.ok ? styles.currentExecutionVerified : styles.currentExecutionUnavailable}>
          <i />{state.connection === "connecting" ? "正在核验" : snapshot?.ok ? "VERIFIED" : "UNAVAILABLE"}
        </div>
      </header>
      <div className={styles.currentExecutionGrid} aria-live="polite">
        <div><span>登记修订</span><strong>{snapshot?.registryRevision ?? "不可用"}</strong><code>registryRevision</code></div>
        <div><span>当前项目任务</span><strong>{task?.taskId ?? "不可用"}</strong><code>currentProjectTask.taskId</code></div>
        <div><span>当前任务Run</span><strong>{task?.runId ?? "不可用"}</strong><code>currentProjectTask.runId</code></div>
        <div><span>生命周期阶段</span><strong>{task?.lifecycleStage ?? "不可用"}</strong><code>lifecycleStage</code></div>
        <div><span>执行状态</span><strong>{task?.executionState ?? "不可用"}</strong><code>executionState</code></div>
        <div><span>活动执行</span><strong>{snapshot?.activeExecution ? "已登记" : snapshot?.ok ? "未登记" : "不可用"}</strong><code>activeExecution</code></div>
        <div><span>最近训练终态</span><strong>{snapshot?.latestTrainingTerminal?.status ?? "不可用"}</strong><code>latestTrainingTerminal</code></div>
        <div><span>机器审核</span><strong>{reviewSummary}</strong><code>machineReviewTimeline</code></div>
        <div><span>历史选择</span><strong>{snapshot?.selectedHistoricalRun ? "已显式选择" : snapshot?.ok ? "未选择" : "不可用"}</strong><code>selectedHistoricalRun</code></div>
        <div><span>北京时间登记</span><strong>{snapshot?.recordedAtAsiaShanghai ?? "不可用"}</strong><code>recordedAtAsiaShanghai</code></div>
      </div>
      <footer>
        <span>来源 <code>{snapshot?.sourcePath ?? ".runtime/ai-painter/current-execution-registry/current.json"}</code></span>
        <span>完整性 <strong>{snapshot?.integrityStatus ?? "unavailable"}</strong></span>
        <span>刷新 <strong>{refreshIntervalMs} ms</strong></span>
        <span>{state.errorCode ?? "仅按当前登记读取 · 禁止历史扫描回退"}</span>
      </footer>
    </section>
  )
}

function isCurrentExecutionSnapshot(value: unknown): value is AiPainterCurrentExecutionSnapshot {
  if (typeof value !== "object" || value === null) return false
  const candidate = value as Partial<AiPainterCurrentExecutionSnapshot>
  return candidate.schemaVersion === "ai_console_ai_painter_current_execution_projection_v1"
    && candidate.sourceIdentity === "ai-painter-current-execution"
    && candidate.sourcePath === ".runtime/ai-painter/current-execution-registry/current.json"
    && ["connected", "unknown_or_stale"].includes(candidate.dataStatus ?? "")
}
