"use client"

import Link from "next/link"
import { useAiConsoleCurrentExecution } from "./ai-console-current-execution-store"
import { useAiConsoleLiveObservability } from "./ai-console-live-observability"
import { mapTrainingSummary } from "./ai-console-training-summary-model"
import { formatTrainingTime } from "./ai-console-training-time"
import styles from "./ai-console-training-summary.module.css"

function beijingTime(value: string | null) {
  return formatTrainingTime(value, "未知／未上报")
}
function progress(value: number | null, maximum: number | null) {
  return `${value ?? "未上报"} / ${maximum ?? "上限未知"}`
}
function WorkerTimingFacts({ timing }: { timing: ReturnType<typeof mapTrainingSummary>["latestTiming"] }) {
  return <div aria-label="训练worker起止与耗时"><dl className={styles.facts}>
    <div><dt>worker开始时间</dt><dd>{timing.startedAt}</dd></div>
    <div><dt>worker结束时间</dt><dd>{timing.endedAt}</dd></div>
    <div><dt>worker实际耗时（单调计时）</dt><dd>{timing.elapsed}</dd></div>
  </dl><p>计时范围：{timing.scope}</p><p>{timing.state}</p>
    <details><summary>计时来源与原始时间</summary><dl className={styles.technical}>
      {Object.entries({ reasonCode: timing.reasonCode, ...timing.raw }).map(([key, value]) => <div key={key}><dt>{key}</dt><dd>{String(value ?? "未记录")}</dd></div>)}
    </dl></details>
  </div>
}
export function TrainingSummaryView({ summary }: { summary: ReturnType<typeof mapTrainingSummary> }) {
  return <section className={styles.summary} aria-label="当前训练易懂摘要" data-tone={summary.tone}>
    <header><h3>当前执行</h3><strong role="status">{summary.status}</strong></header>
    <p>{summary.reason}</p>
    <dl className={styles.facts}>
      <div><dt>本轮训练轮数／上限</dt><dd>{progress(summary.epoch, summary.targetEpochs)}</dd></div>
      <div><dt>真实优化步 G／上限</dt><dd>{progress(summary.optimizerStep, summary.targetOptimizerSteps)}</dd></div>
      {(summary.discriminatorOptimizerSteps !== null || summary.targetDiscriminatorOptimizerSteps !== null) && <div><dt>真实优化步 D／上限</dt><dd>{progress(summary.discriminatorOptimizerSteps, summary.targetDiscriminatorOptimizerSteps)}</dd></div>}
      <div><dt>绑定分辨率</dt><dd>{summary.resolution}</dd></div>
      <div><dt>最后核验的当前指标时间</dt><dd>{beijingTime(summary.lastMetricAt)}</dd></div>
      <div><dt>预计完成时间</dt><dd>{beijingTime(summary.eta)}</dd></div>
    </dl>
    {summary.activeRunId && <WorkerTimingFacts timing={summary.activeTiming} />}
    {(summary.lastKnownEpoch !== null || summary.lastKnownGeneratorSteps !== null || summary.lastKnownCriticSteps !== null) && <div className={styles.terminal}>
      <h4>最后核验的训练计数（非当前训练）</h4>
      <p>epoch：{summary.lastKnownEpoch ?? "未上报"}；实际优化步 G：{summary.lastKnownGeneratorSteps ?? "未上报"} / D：{summary.lastKnownCriticSteps ?? "未上报"}</p>
      <p>指标时间：{beijingTime(summary.lastKnownMetricAt)}</p>
    </div>}
    <p>本摘要不提供实时训练图预览：{summary.latestFailed && !summary.activeRunId ? "最近失败 Run 的图像生成状态未记录或无法核验，不能据此断言未生成。" : "当前图像生成状态未上报，不能推断已经生成或未生成。"}已保存且核验的图像请到<Link href="/ai-console/training/runs" prefetch={false}>训练历史与图像证据</Link>查看。</p>
    <div className={styles.terminal}><h4>最近结束的训练（不是当前执行）</h4><p>{summary.latestStatus}</p>
      <WorkerTimingFacts timing={summary.latestTiming} />
      {summary.latestFailed && <p>失败原因：{summary.terminalErrorCode ?? "未记录或无法核验；请查看该 Run 的历史详情与已绑定终态证据。"}</p>}
      {summary.latestFailed && summary.latestRunId && <p>失败 Run：<code>{summary.latestRunId}</code> · <Link href="/ai-console/training/runs" prefetch={false}>在训练历史中查询详情与证据</Link></p>}
      {(summary.terminalEpochs !== null || summary.terminalGeneratorSteps !== null || summary.terminalCriticSteps !== null) && <p>终态完成 epoch：{summary.terminalEpochs ?? "未知"}；实际优化步 G：{summary.terminalGeneratorSteps ?? "未知"} / D：{summary.terminalCriticSteps ?? "未知"}</p>}
    </div>
    <p className={styles.boundary}>本轮进度不是 Stage4 晋级；实验结束不等于正式合格。资源图与 GPU 占用只说明资源情况。</p>
    <details><summary>技术身份、SHA、PID 与 Loss</summary><dl className={styles.technical}>
      <div><dt>活动 Run</dt><dd>{summary.activeRunId ?? "未核验／无活动"}</dd></div>
      <div><dt>活动 PID</dt><dd>{summary.processId ?? "未核验"}</dd></div>
      <div><dt>登记执行状态 / 活动 / 回执状态（原始值）</dt><dd>{summary.rawExecutionState ?? "未提供"} / {summary.rawActivity ?? "未提供"} / {summary.rawTerminalStatus ?? "未提供"}</dd></div>
      <div><dt>训练进度原始原因</dt><dd>{summary.metricReasonCode ?? "无"}</dd></div>
      <div><dt>最近结束 Run</dt><dd>{summary.latestRunId ?? "未记录／未核验"}</dd></div>
      <div><dt>当前匹配 Loss</dt><dd>{summary.loss ?? "未上报／未核验"}</dd></div>
      <div><dt>当前指标来源</dt><dd>{summary.metricSource ?? "未核验"}</dd></div>
      <div><dt>绑定进度 / SHA</dt><dd>{summary.metricSourcePath ?? "未提供"}<br />{summary.metricSourceSha256 ?? "未提供"}</dd></div>
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
