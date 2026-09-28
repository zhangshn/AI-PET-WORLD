"use client"

import { currentExecutionRefreshMs, useAiConsoleCurrentExecution } from "./ai-console-current-execution-store"
import { AiConsoleTrainingSummary } from "./ai-console-training-summary"
import styles from "./page.module.css"

const refreshIntervalMs = currentExecutionRefreshMs

export function AiConsoleCurrentExecutionStatus() {
  const state = useAiConsoleCurrentExecution()

  const snapshot = state.snapshot
  const verified = state.connection === "ready" && snapshot?.ok === true && snapshot.integrityStatus === "verified"
    && snapshot.dataStatus === "connected" && (state.observedNowMs ?? 0) - Date.parse(snapshot.observedAtUtc) >= 0
    && (state.observedNowMs ?? 0) - Date.parse(snapshot.observedAtUtc) <= 10_000
  const task = snapshot?.currentProjectTask
  const review = snapshot?.machineReview
  const reviewSummary = review?.availability === "available"
    ? `${review.previewPassCount ?? "—"} / ${review.targetReviewCount ?? "—"} 通过 · ${review.previewFailCount ?? "—"} 失败`
    : "不可用"

  return (
    <section className={styles.currentExecutionPanel} aria-label="AI Painter当前执行受信投影">
      <header>
        <div><span>CURRENT EXECUTION REGISTRY</span><strong>AI Painter 当前执行</strong></div>
        <div className={verified ? styles.currentExecutionVerified : styles.currentExecutionUnavailable}>
          <i />{state.connection === "connecting" ? "正在核验" : state.connection === "failed" ? "断线／旧快照已过期" : verified ? "已核验登记" : "不可用／过期"}
        </div>
      </header>
      <AiConsoleTrainingSummary />
      <details><summary>登记技术详情与机器审核</summary><div className={styles.currentExecutionGrid}>
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
      </div></details>
      <footer>
        <span>来源 <code>{snapshot?.sourcePath ?? ".runtime/ai-painter/current-execution-registry/current.json"}</code></span>
        <span>完整性 <strong>{snapshot?.integrityStatus ?? "unavailable"}</strong></span>
        <span>刷新 <strong>{refreshIntervalMs} ms</strong></span>
        <span>{state.errorCode ?? "仅按当前登记读取 · 禁止历史扫描回退"}</span>
      </footer>
    </section>
  )
}
