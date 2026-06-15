"use client"

import Link from "next/link"
import { useCallback, useEffect, useState } from "react"
import styles from "./page.module.css"

type Action = "full" | "full_multiscene"
type Progress = {
  system: { gpuAvailable: boolean; name: string; memoryTotalMiB: number; memoryUsedMiB: number; utilizationPercent: number; temperatureCelsius: number; driver: string }
  dataset: { formalSceneSamples: number; bootstrapSamples: number }
  model: { name: string; framework: string }
  multiscene: { samples: number; baseSummary: { bestSelectionLoss?: number } | null; ganSummary: { bestGeneratorLoss?: number } | null; inferenceReady: boolean; reviewStatus: string }
  control: { status: "idle" | "running" | "completed" | "failed"; currentStep: string | null; error: string | null }
  training: { status: "not_started" | "running" | "completed"; epoch: number; targetEpochs: number; percent: number; loss: number | null; checkpointReady: boolean; inferenceReady: boolean }
}

export function ProgressClient() {
  const [data, setData] = useState<Progress | null>(null)
  const [message, setMessage] = useState("")
  const refresh = useCallback(async () => {
    const response = await fetch("/api/ai-painter/training-progress", { cache: "no-store" })
    if (response.ok) setData(await response.json())
  }, [])

  useEffect(() => {
    void refresh()
    const timer = window.setInterval(() => void refresh(), 2000)
    return () => window.clearInterval(timer)
  }, [refresh])

  const start = async (action: Action) => {
    setMessage("正在启动本地任务……")
    const response = await fetch("/api/ai-painter/training-control", {
      method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ action }),
    })
    const result = await response.json() as { ok: boolean; message?: string }
    setMessage(result.ok ? "任务已经在本机启动。" : result.message ?? "启动失败。")
    await refresh()
  }

  const busy = data?.control.status === "running"
  return (
    <>
      <section className={styles.systemGrid}>
        <InfoCard label="GPU" value={data?.system.name ?? "检测中"} detail={data?.system.gpuAvailable ? "CUDA 可用" : "GPU 不可用"} />
        <InfoCard label="显存" value={`${data?.system.memoryUsedMiB ?? 0} / ${data?.system.memoryTotalMiB ?? 0} MiB`} detail={`占用 ${data?.system.utilizationPercent ?? 0}%`} />
        <InfoCard label="温度" value={`${data?.system.temperatureCelsius ?? 0}°C`} detail={`驱动 ${data?.system.driver ?? "--"}`} />
        <InfoCard label="模型" value={data?.model.name ?? "读取中"} detail={data?.model.framework ?? "--"} />
      </section>

      <section className={styles.currentTask}>
        <div>
          <p className={styles.kicker}>CURRENT TASK</p>
          <h2>{busy ? data?.control.currentStep ?? "本地训练进行中" : "等待下一次训练"}</h2>
          <p>{busy ? "页面每 2 秒自动更新 GPU 与任务状态。" : message || "选择下方阶段进入详情，或直接重新运行对应实验。"}</p>
        </div>
        <div className={styles.compactProgress}><strong>{busy ? data?.training.percent ?? 0 : 100}%</strong><span>{busy ? "运行中" : "空闲"}</span></div>
      </section>

      <section className={styles.stageGrid}>
        <StageCard href="/ai-painter-progress/bootstrap" label="STAGE 01" title="单图训练验证" status={data?.training.inferenceReady ? "已完成" : "未完成"} description="查看单图过拟合结果、权重、Loss 与实时日志。" actionLabel="重新训练" disabled={busy} onAction={() => void start("full")} />
        <StageCard href="/ai-painter-progress/multiscene" label="STAGE 02" title="多场景结构训练" status={data?.multiscene.reviewStatus === "failed_visual_quality" ? "三轮审核未通过" : "进行中"} description={`${data?.multiscene.samples ?? 0} 张场景；基础、GAN、结构加权 V2 均已完成真实验收。`} actionLabel="重新运行实验" disabled={busy} onAction={() => void start("full_multiscene")} danger />
        <StageCard href="/ai-painter-progress/history" label="TRAINING RECORDS" title="训练历史与结果" status="查看记录" description="集中查看每次训练摘要、输出图片与审核结论。" />
      </section>

      <section className={styles.summaryStrip}>
        <span>正式训练场景：<strong>{data?.dataset.formalSceneSamples ?? 0}</strong></span>
        <span>多场景实验：<strong>{data?.multiscene.samples ?? 0}</strong></span>
        <span>下一重点：<strong>14 通道显式结构监督</strong></span>
      </section>
      {data?.control.error ? <p className={styles.error}>{data.control.error}</p> : null}
    </>
  )
}

function InfoCard({ label, value, detail }: { label: string; value: string; detail: string }) {
  return <article className={styles.infoCard}><small>{label}</small><strong>{value}</strong><span>{detail}</span></article>
}

function StageCard({ href, label, title, status, description, actionLabel, disabled, onAction, danger }: {
  href: string; label: string; title: string; status: string; description: string; actionLabel?: string; disabled?: boolean; onAction?: () => void; danger?: boolean
}) {
  return <article className={styles.stageCard}>
    <p className={styles.kicker}>{label}</p><div className={styles.stageTitle}><h2>{title}</h2><span data-danger={danger}>{status}</span></div><p>{description}</p>
    <div className={styles.stageActions}><Link href={href}>进入详情</Link>{actionLabel ? <button disabled={disabled} onClick={onAction}>{actionLabel}</button> : null}</div>
  </article>
}
