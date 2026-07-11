"use client"

import Link from "next/link"
import { useEffect, useMemo, useState } from "react"
import styles from "./page.module.css"

type RuntimeStatusSnapshot = {
  status?: string
  statusSource?: string
  stale?: boolean
  ageMs?: number | null
  staleAfterMs?: number
  heartbeatPath?: string
  heartbeat?: {
    timestampUtc?: string
    timestampLocal?: string
    status?: string
    activeTaskId?: string | null
    activeAction?: string | null
    activeModelRole?: string | null
    activeStep?: string | null
    activeScript?: string | null
    lastOutputRef?: string | null
  } | null
}

type TrainingProgressSummary = {
  runtimeStatus?: RuntimeStatusSnapshot
  control?: {
    status?: string
    currentStep?: string
    error?: string
    liveDetected?: boolean
    statusSource?: string
    controlFileStatus?: string
    runtimeStatus?: RuntimeStatusSnapshot
  }
  gameMapRuntimeFrame?: {
    ready?: boolean
    recordId?: string
    worldId?: string
    tick?: number
    formalJudge?: {
      issues?: number
    }
  }
  trainingRunArchive?: {
    ready?: boolean
    status?: string
    manualReviewStatus?: string
  }
  trainingProcessLedger?: {
    updatedAt?: string | null
    summary?: {
      total?: number
      running?: number
      success?: number
      failed?: number
      error?: number
      blocked?: number
      info?: number
      lastEvent?: {
        title?: string
        status?: string
        timestamp?: string
      } | null
    }
  }
  system?: {
    name?: string
    gpuAvailable?: boolean
    memoryUsedMiB?: number
    memoryTotalMiB?: number
    utilizationPercent?: number
    activeComputeProcessCount?: number
    gpuBusy?: boolean
  }
}

const mainEntrances = [
  {
    href: "/ai-painter-progress/natural-home",
    label: "WORLD MAP",
    title: "完整世界地图训练",
    body: "查看第一版世界地图主线。这里看完整地图候选，不把局部素材当成最终游戏画面。",
  },
  {
    href: "/ai-painter-progress/trial-reviews",
    label: "REVIEWS",
    title: "训练候选图审核",
    body: "查看已经存储的候选图、失败码、正负标签和人工审核状态。",
  },
  {
    href: "/ai-painter-progress/training-ledger",
    label: "LEDGER",
    title: "自动训练日志",
    body: "查看本地训练程序自动写入的成功、失败、错误、阻断和归档记录。",
  },
  {
    href: "/ai-painter-progress/world-visual-dictionary",
    label: "DICTIONARY",
    title: "世界视觉数据字典",
    body: "查看单一地图范围的数据字典、视觉标准、失败码和训练接入规则。",
  },
  {
    href: "/ai-painter-progress/generated-results",
    label: "ARCHIVE",
    title: "生成结果归档",
    body: "查看生成图、失败图、候选图和历史产物。所有训练结果必须可追溯。",
  },
  {
    href: "/ai-painter-progress/training-directory",
    label: "DIRECTORY",
    title: "训练目录",
    body: "查看所有训练线路入口。主页不再堆放每一条训练内容。",
  },
]

export function ProgressClient() {
  const [progress, setProgress] = useState<TrainingProgressSummary | null>(null)
  const [progressError, setProgressError] = useState("")

  useEffect(() => {
    let cancelled = false
    let fallbackTimer: number | null = null

    async function refresh() {
      try {
        const response = await fetch("/api/ai-painter/training-progress", { cache: "no-store" })
        if (!cancelled && response.ok) {
          setProgress((await response.json()) as TrainingProgressSummary)
        }
      } catch (error) {
        if (!cancelled) {
          setProgressError(error instanceof Error ? error.message : "读取训练状态失败")
        }
      }
    }

    async function refreshAndScheduleFallback() {
      await refresh()
      if (!cancelled) {
        fallbackTimer = window.setTimeout(() => void refreshAndScheduleFallback(), 3000)
      }
    }

    void refresh()
    const stream = new EventSource("/api/ai-painter/training-progress/stream")
    stream.addEventListener("progress", (event) => {
      if (cancelled) return
      try {
        setProgress(JSON.parse((event as MessageEvent<string>).data) as TrainingProgressSummary)
        setProgressError("")
      } catch (error) {
        setProgressError(error instanceof Error ? error.message : "progress_stream_parse_failed")
      }
    })
    stream.addEventListener("error", () => {
      stream.close()
      if (!fallbackTimer) {
        void refreshAndScheduleFallback()
      }
    })
    return () => {
      cancelled = true
      stream.close()
      if (fallbackTimer) window.clearTimeout(fallbackTimer)
    }
  }, [])

  const ledger = progress?.trainingProcessLedger?.summary
  const failedCount = (ledger?.failed ?? 0) + (ledger?.error ?? 0)
  const runtimeSnapshot = progress?.control?.runtimeStatus ?? progress?.runtimeStatus
  const runtimeHeartbeat = runtimeSnapshot?.heartbeat
  const runtimeStatusSource = formatRuntimeStatusSource(
    progress?.control?.statusSource ?? runtimeSnapshot?.statusSource ?? "training_control",
  )
  const runningSourceText = runtimeHeartbeat
    ? `来源=${runtimeStatusSource} / 实时状态时间=${
        runtimeHeartbeat.timestampLocal ?? runtimeHeartbeat.timestampUtc ?? "--"
      }`
    : `来源=${runtimeStatusSource}`
  const busy = progress?.control?.status === "running"
  const runningText = busy
    ? progress?.control?.currentStep ?? "训练运行中"
    : progress?.system?.gpuBusy
      ? "GPU 繁忙，等待控制状态登记"
      : "空闲"
  const runtimeStatus = useMemo(() => {
    if (!progress?.gameMapRuntimeFrame) return "暂无候选"
    if (progress.gameMapRuntimeFrame.ready) return "机器检查通过，仍需人工终审"
    return "未通过，继续训练"
  }, [progress])

  return (
    <>
      <section className={styles.statusBar} aria-label="训练状态摘要">
        <article>
          <span>当前运行</span>
          <strong>{runningText}</strong>
          <small className={styles.statusHint}>{runningSourceText}</small>
        </article>
        <article>
          <span>RuntimeFrame</span>
          <strong>{runtimeStatus}</strong>
        </article>
        <article>
          <span>自动日志（程序事件）</span>
          <strong>
            {ledger?.success ?? 0} 成功 / {failedCount} 失败
          </strong>
          <small className={styles.statusHint}>成功=步骤完成；失败=步骤失败或质量阻断；不是最终地图结论</small>
        </article>
        <article>
          <span>GPU / 显存</span>
          <strong>
            {progress?.system?.gpuAvailable
              ? `${progress.system.name ?? "CUDA"} ${progress.system.memoryUsedMiB ?? 0}/${
                  progress.system.memoryTotalMiB ?? 0
                } MiB / ${progress.system.utilizationPercent ?? 0}% / ${
                  progress.system.activeComputeProcessCount ?? 0
                } 进程`
              : "等待读取"}
          </strong>
        </article>
      </section>

      <section className={styles.entryGrid} aria-label="训练内容入口">
        {mainEntrances.map((entry) => (
          <Link className={styles.entryCard} href={entry.href} key={entry.href}>
            <span>{entry.label}</span>
            <h2>{entry.title}</h2>
            <p>{entry.body}</p>
          </Link>
        ))}
      </section>

      <section className={styles.compactPanel}>
        <p className={styles.kicker}>RECORD OWNERSHIP</p>
        <h2>日志和图必须由程序自动存储</h2>
        <p>
          训练记录的正式来源是本地小模型训练程序写入的文件：候选图、review-record、训练总账、归档报告和失败码。
          我在聊天里打印的进度表只用于汇报当前工作，不替代项目数据。你要查当前训练内容，先从上面的“完整世界地图训练”“训练候选图审核”“自动训练日志”三个入口进入。
        </p>
      </section>

      <section className={styles.compactPanel}>
        <p className={styles.kicker}>LATEST LEDGER EVENT</p>
        <h2>{ledger?.lastEvent?.title ?? "暂无自动日志事件"}</h2>
        <p>
          状态：{ledger?.lastEvent?.status ?? "--"} / 更新时间：
          {progress?.trainingProcessLedger?.updatedAt ?? ledger?.lastEvent?.timestamp ?? "--"} / 总事件：
          {ledger?.total ?? 0}
        </p>
        <Link className={styles.textLink} href="/ai-painter-progress/training-ledger">
          查看自动训练日志
        </Link>
      </section>

      {progress?.control?.error || progressError ? (
        <p className={styles.error}>{progress?.control?.error ?? progressError}</p>
      ) : null}
    </>
  )
}

function formatRuntimeStatusSource(source: string) {
  const labels: Record<string, string> = {
    runtime_heartbeat: "程序实时状态",
    missing_heartbeat: "未发现实时状态",
    stale_runtime_heartbeat: "实时状态已过期",
    child_process: "任务子进程",
    gpu_compute_process: "GPU 计算进程",
    gpu_utilization: "GPU 使用率",
    stale_training_control: "过期控制记录",
    training_control: "训练控制器",
  }
  return labels[source] ?? source.replaceAll("heartbeat", "runtime_status")
}
