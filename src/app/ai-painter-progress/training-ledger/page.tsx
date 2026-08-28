import Link from "next/link"
import { readFile } from "node:fs/promises"
import path from "node:path"
import { readTrainingLogTail, readTrainingProcessLedger } from "@/server/ai-painter-training-state"
import styles from "../detail.module.css"

export const dynamic = "force-dynamic"

const statusLabel: Record<string, string> = {
  running: "运行中",
  success: "成功",
  failed: "失败",
  error: "错误",
  blocked: "阻断",
  info: "信息",
}

export default async function TrainingLedgerPage() {
  const ledger = await readTrainingProcessLedger(120)
  const logs = await readTrainingLogTail(80)
  const autoJudgeLearning = await readAutoVisualJudgeLearning()
  const failedCount = ledger.summary.failed + ledger.summary.error

  return (
    <main className={styles.page}>
      <header className={styles.header}>
        <Link className={styles.back} href="/ai-painter-progress">
          返回训练主控台
        </Link>
        <p className={styles.kicker}>TRAINING PROCESS LEDGER</p>
        <h1>自动训练日志</h1>
        <p>
          这里读取的是本地训练程序自动写入的持久账本，不是聊天记录。正式账本位置：
          `.runtime/ai-painter/training-process-ledger/events.jsonl` 和
          `.runtime/ai-painter/training-process-ledger/latest.json`。
        </p>
        <p className={styles.note}>
          这里的“成功 / 失败”是程序事件统计，不是最终地图审核结论。命令成功只代表步骤完成；闸门失败代表质量检查阻断；最终游戏地图成功必须由本地程序保存完整 RuntimeFrame、机器审核、能力发布身份和世界写入事务。
        </p>
        <dl className={styles.metrics}>
          <div>
            <dt>总事件</dt>
            <dd>{ledger.summary.total}</dd>
          </div>
          <div>
            <dt>步骤成功</dt>
            <dd>{ledger.summary.success}</dd>
          </div>
          <div>
            <dt>步骤失败 / 错误</dt>
            <dd>{failedCount}</dd>
          </div>
          <div>
            <dt>质量阻断</dt>
            <dd>{ledger.summary.blocked}</dd>
          </div>
        </dl>
      </header>

      <section className={styles.panel}>
        <p className={styles.kicker}>RECORD RULE</p>
        <h2>谁在记录日志</h2>
        <p>
          自动训练日志由项目程序写入：训练控制器、归档脚本、审核脚本和本地小模型流水线会把事件追加到账本。
          Codex 只负责执行、检查和在聊天里打印进度表；如果页面没有记录，就代表程序没有把那次训练落盘，不能算正式训练证据。
        </p>
      </section>

      <section className={styles.panel}>
        <p className={styles.kicker}>AUTO JUDGE LEARNING</p>
        <h2>程序自动判断学习记忆</h2>
        <p>
          这里不是 Codex 解释，而是程序从材料质量报告、FormalVisualJudge、人工审核和漏判诊断里自动学习出的判断记忆。
        </p>
        <dl className={styles.metrics}>
          <div>
            <dt>当前判断</dt>
            <dd>{autoJudgeLearning?.currentDecision?.statusZh ?? "--"}</dd>
          </div>
          <div>
            <dt>失败模式</dt>
            <dd>{autoJudgeLearning?.learnedFailurePatterns?.length ?? 0}</dd>
          </div>
          <div>
            <dt>材料报告</dt>
            <dd>{autoJudgeLearning?.evidenceSummary?.materialQualityReportCount ?? 0}</dd>
          </div>
          <div>
            <dt>漏判诊断</dt>
            <dd>{autoJudgeLearning?.evidenceSummary?.reviewDiagnosisCount ?? 0}</dd>
          </div>
        </dl>
        <div className={styles.learningList}>
          {(autoJudgeLearning?.nextAutonomousJudgeInputs ?? []).slice(0, 8).map((item) => (
            <article key={item.code}>
              <strong>{item.code}</strong>
              <small>
                区域：{item.targetArea} / 次数：{item.occurrenceCount} / 动作：{item.actionZh}
              </small>
              <small>证据：{item.evidencePaths.join(" / ")}</small>
            </article>
          ))}
          {autoJudgeLearning ? null : <p className={styles.note}>暂无自动判断学习记忆；运行训练或 npm run learn:game-map-auto-visual-judge 后生成。</p>}
        </div>
      </section>

      <section className={styles.history}>
        <p className={styles.kicker}>LATEST EVENTS</p>
        <h2>最近 {ledger.events.length} 条程序事件</h2>
        <div className={styles.historyList}>
          {ledger.events.map((event) => {
            const display = buildLedgerEventDisplay(event)
            return (
              <article className={styles.historyItem} key={event.id}>
                <div>
                  <strong>{event.titleZh ?? event.title}</strong>
                  {event.titleZh ? <small>EN: {event.title}</small> : null}
                  <p>{event.detailZh ?? event.detail ?? event.errorZh ?? event.error ?? "无补充说明"}</p>
                  {event.detailZh && event.detail ? <small>EN: {event.detail}</small> : null}
                  <small>结果范围：{display.resultScopeZh}</small>
                  <small>成功定义：{display.successMeaningZh}</small>
                  <small>失败定义：{display.failureMeaningZh}</small>
                  <small>最终地图结论：{display.finalGameMapMeaningZh}</small>
                  <small>能否进入 /world：{display.canEnterWorld ? "本地机器发布门已确认可进入原子写入" : "不可以作为玩家可见最终地图"}</small>
                  <small>下一步：{display.nextActionZh}</small>
                  {display.evidenceRequirementZh ? <small>证据要求：{display.evidenceRequirementZh}</small> : null}
                  {event.errorZh ? <small className={styles.eventError}>错误代码：{event.errorZh}</small> : null}
                  {event.evidencePath ? <small>证据：{event.evidencePath}</small> : null}
                  <span>{event.script ?? event.currentStep ?? event.action}</span>
                </div>
                <span>{formatTime(event.timestamp)}</span>
                <span>{statusLabel[event.status] ?? event.status}</span>
                <span>{event.kind}</span>
              </article>
            )
          })}
          {ledger.events.length === 0 ? (
            <article className={styles.historyItem}>
              <div>
                <strong>暂无程序日志</strong>
                <p>训练程序还没有写入 events.jsonl。</p>
              </div>
              <span>--</span>
              <span>--</span>
              <span>--</span>
            </article>
          ) : null}
        </div>
      </section>

      <section className={styles.history}>
        <p className={styles.kicker}>CONSOLE TAIL</p>
        <h2>训练控制台尾部日志</h2>
        <div className={styles.consoleLog}>
          {logs.length > 0 ? logs.map((line, index) => <code key={`${index}-${line}`}>{line}</code>) : <code>暂无 console.log</code>}
        </div>
      </section>
    </main>
  )
}

async function readAutoVisualJudgeLearning() {
  try {
    return JSON.parse(
      await readFile(
        path.join(/* turbopackIgnore: true */ process.cwd(), ".runtime", "ai-painter", "auto-visual-judge-learning", "latest.json"),
        "utf8",
      ),
    ) as {
      currentDecision?: { statusZh?: string }
      learnedFailurePatterns?: unknown[]
      evidenceSummary?: {
        materialQualityReportCount?: number
        reviewDiagnosisCount?: number
      }
      nextAutonomousJudgeInputs?: Array<{
        code: string
        targetArea: string
        occurrenceCount: number
        actionZh: string
        evidencePaths: string[]
      }>
    }
  } catch {
    return null
  }
}

function buildLedgerEventDisplay(event: {
  kind?: string
  status?: string
  currentStep?: string
  detail?: string
  detailZh?: string
  title?: string
  resultScopeZh?: string
  successMeaningZh?: string
  failureMeaningZh?: string
  finalGameMapMeaningZh?: string
  canEnterWorld?: boolean
  evidenceRequirementZh?: string
  nextActionZh?: string
}) {
  const text = `${event.kind ?? ""} ${event.currentStep ?? ""} ${event.detail ?? ""} ${event.detailZh ?? ""} ${event.title ?? ""}`
  const resultScopeZh =
    event.resultScopeZh ??
    (text.includes("owner")
      ? "历史人工记录（非现行发布闸门）"
      : text.includes("FormalVisualJudge")
        ? "正式画面机器评审闸门"
        : text.includes("judge:game-map-material-quality") || text.includes("material-quality")
          ? "材料质量机器评审闸门"
          : text.includes("train:game-map-material-slot")
            ? "本地小模型训练步骤"
            : text.includes("inference")
              ? "本地小模型推理步骤"
              : text.includes("archive") || text.includes("归档")
                ? "训练结果归档步骤"
                : text.includes("command")
                  ? "训练命令步骤"
                  : "程序事件")

  const isFailure = event.status === "failed" || event.status === "error" || event.status === "blocked"
  const isInfo = event.status === "info" || event.status === "running"

  return {
    resultScopeZh,
    successMeaningZh:
      event.successMeaningZh ??
      (isInfo
        ? "还没有判定成功；这只表示程序已经启动或记录了一个进度事件。"
        : "成功只代表这条事件自身范围通过，不代表最终游戏地图通过。"),
    failureMeaningZh:
      event.failureMeaningZh ??
      (isFailure
        ? "失败表示这个步骤、闸门或审核没有通过；需要根据证据路径查看退出码、失败码、缺失产物或画面质量问题。"
        : "如果该事件后续没有完成、阻断或失败记录，需要检查训练控制状态和证据文件。"),
    finalGameMapMeaningZh:
      event.finalGameMapMeaningZh ??
      "不是最终地图结论。只有已发布能力版本内的完整 RuntimeFrame 通过材料质量闸门、FormalVisualJudge、能力发布身份重算和 /world 原子写入闸门，才算最终游戏地图成功；正常运行不设置Owner逐次终审。",
    canEnterWorld: event.canEnterWorld === true,
    evidenceRequirementZh:
      event.evidenceRequirementZh ??
      "必须有持久证据文件，例如 run-report.json、material-quality-report.json、formal-visual-judge.json、能力发布身份、归档图片或世界写入事务。",
    nextActionZh:
      event.nextActionZh ??
      (isFailure
        ? "根据证据文件和失败码修复算法、数据字典或生成器，再进入下一轮训练。"
        : "继续按计划执行下一条程序事件或质量闸门。"),
  }
}

function formatTime(value: string) {
  try {
    return new Intl.DateTimeFormat("zh-CN", {
      dateStyle: "short",
      timeStyle: "medium",
      hour12: false,
      timeZone: "Asia/Shanghai",
    }).format(new Date(value))
  } catch {
    return value
  }
}
