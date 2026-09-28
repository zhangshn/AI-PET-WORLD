"use client"

import Link from "next/link"
import { useAiConsoleCurrentExecution } from "./ai-console-current-execution-store"
import { useAiConsoleLiveObservability } from "./ai-console-live-observability"
import { mapTrainingSummary } from "./ai-console-training-summary-model"
import styles from "./ai-console-training-summary.module.css"

function beijingTime(value: string | null) {
  return value ? `${new Date(value).toLocaleString("zh-CN", { timeZone: "Asia/Shanghai", hour12: false })}（北京时间）` : "未知／未上报"
}
function progress(value: number | null, maximum: number | null) {
  return `${value ?? "未上报"} / ${maximum ?? "上限未知"}`
}
export function TrainingSummaryView({ summary }: { summary: ReturnType<typeof mapTrainingSummary> }) {
  return <section className={styles.summary} aria-label="当前训练易懂摘要" data-tone={summary.tone}>
    <header><h3>当前执行</h3><strong role="status">{summary.status}</strong></header>
    <p>{summary.reason}</p>
    <dl className={styles.facts}>
      <div><dt>本轮训练轮数／上限</dt><dd>{progress(summary.epoch, summary.targetEpochs)}</dd></div>
      <div><dt>真实优化步 G／上限</dt><dd>{progress(summary.optimizerStep, summary.targetOptimizerSteps)}</dd></div>
      <div><dt>绑定分辨率</dt><dd>{summary.resolution}</dd></div>
      <div><dt>最后核验的当前指标时间</dt><dd>{beijingTime(summary.lastMetricAt)}</dd></div>
      <div><dt>预计完成时间</dt><dd>{beijingTime(summary.eta)}</dd></div>
    </dl>
    <p>本摘要不提供实时训练图预览：当前图像生成状态未上报，不能推断已经生成或未生成。已保存且核验的图像请到<Link href="/ai-console/training/runs" prefetch={false}>训练历史与图像证据</Link>查看。</p>
    <div className={styles.terminal}><h4>最近结束的训练（不是当前执行）</h4><p>{summary.latestStatus}</p>
      {(summary.terminalEpochs !== null || summary.terminalGeneratorSteps !== null || summary.terminalCriticSteps !== null) && <p>终态完成 epoch：{summary.terminalEpochs ?? "未知"}；实际优化步 G：{summary.terminalGeneratorSteps ?? "未知"} / D：{summary.terminalCriticSteps ?? "未知"}</p>}
    </div>
    <p className={styles.boundary}>本轮进度不是 Stage4 晋级；实验结束不等于正式合格。资源图与 GPU 占用只说明资源情况。</p>
    <details><summary>技术身份、SHA、PID 与 Loss</summary><dl className={styles.technical}>
      <div><dt>活动 Run</dt><dd>{summary.activeRunId ?? "未核验／无活动"}</dd></div>
      <div><dt>活动 PID</dt><dd>{summary.processId ?? "未核验"}</dd></div>
      <div><dt>最近结束 Run</dt><dd>{summary.latestRunId ?? "未记录／未核验"}</dd></div>
      <div><dt>当前匹配 Loss</dt><dd>{summary.loss ?? "未上报／未核验"}</dd></div>
      <div><dt>遥测原 Run / PID（非当前判定）</dt><dd>{summary.telemetryRunId ?? "未上报"} / {summary.telemetryProcessId ?? "未知"}</dd></div>
      <div><dt>遥测原上报时间（可能过期）</dt><dd>{beijingTime(summary.rawMetricAt)}</dd></div>
      <div><dt>绑定包 / SHA</dt><dd>{summary.packagePath ?? "未知"}<br />{summary.packageSha256 ?? "未知"}</dd></div>
      <div><dt>诊断代码</dt><dd>{summary.errorCode ?? "无"}</dd></div>
    </dl></details>
  </section>
}
export function AiConsoleTrainingSummary() {
  const current = useAiConsoleCurrentExecution()
  const live = useAiConsoleLiveObservability()
  return <TrainingSummaryView summary={mapTrainingSummary(current, live)} />
}
