"use client"

import { useEffect, useMemo, useState } from "react"
import { InfoCard } from "./_components/info-card"
import { StageCard } from "./_components/stage-card"
import type { Progress, TrainingAction } from "./_lib/progress-types"
import styles from "./page.module.css"

type StartableAction = {
  label: string
  action: TrainingAction
}

const nextFullTrainingSteps: Array<{
  ready: (data: Progress) => boolean
  action: TrainingAction
  label: string
}> = [
  { ready: (data) => Boolean(data.naturalHomeTraining?.inferenceReady), action: "full_natural_home", label: "启动基础自然家园训练" },
  { ready: (data) => Boolean(data.naturalHomeStructure?.inferenceReady), action: "full_natural_home_structure_guided", label: "启动结构引导训练" },
  { ready: (data) => Boolean(data.naturalHomeRefiner?.inferenceReady), action: "full_natural_home_rgb_refiner", label: "启动 RGB 细化训练" },
  { ready: (data) => Boolean(data.naturalHomeV87QualityLedger?.inferenceReady), action: "full_natural_home_v87_quality_ledger", label: "生成质量账本" },
  { ready: (data) => Boolean(data.naturalHomeV88QualityAllowlistDataset?.inferenceReady), action: "full_natural_home_v88_quality_allowlist_dataset", label: "准备 allowlist 数据集" },
  { ready: (data) => Boolean(data.naturalHomeV89QualityAllowlistTraining?.inferenceReady), action: "full_natural_home_v89_quality_allowlist_training", label: "启动 allowlist 训练" },
  { ready: (data) => Boolean(data.naturalHomeV96CleanMultilayout?.inferenceReady), action: "full_natural_home_v96_clean_multilayout", label: "启动 V96 完整自然家园训练" },
  { ready: (data) => Boolean(data.naturalHomeV97EdgeBoundaryRepair?.inferenceReady), action: "full_natural_home_v97_edge_boundary_repair", label: "启动 V97 边缘与边界修复训练" },
  { ready: (data) => Boolean(data.naturalHomeV98Vj1SignalRepair?.inferenceReady), action: "full_natural_home_v98_vj1_signal_repair", label: "启动 V98 VJ-1 失败信号修复训练" },
  { ready: (data) => Boolean(data.naturalHomeV99Vj1BoundarySimilarityRepair?.inferenceReady), action: "full_natural_home_v99_vj1_boundary_similarity_repair", label: "启动 V99 边界与相似度修复训练" },
]

export function ProgressClient() {
  const [data, setData] = useState<Progress | null>(null)
  const [message, setMessage] = useState("")

  useEffect(() => {
    let cancelled = false

    const refresh = async () => {
      const response = await fetch("/api/ai-painter/training-progress", { cache: "no-store" })
      if (!response.ok || cancelled) return
      setData((await response.json()) as Progress)
    }

    void refresh()
    const timer = window.setInterval(() => void refresh(), 2000)
    return () => {
      cancelled = true
      window.clearInterval(timer)
    }
  }, [])

  const busy = data?.control.status === "running"
  const resource = data?.resourceUsage?.current ?? data?.resourceUsage?.latest ?? null
  const fullAction = useMemo(() => getNextFullTrainingAction(data), [data])
  const currentPercent = useMemo(() => getCurrentPercent(data, busy), [data, busy])
  const mvpPercent = useMemo(() => getMvpPercent(data), [data])
  const generatedCount = getGeneratedCount(data)
  const qualityGate = data?.trainingQualityGate

  const start = async (action: TrainingAction) => {
    setMessage("正在提交本地训练任务...")
    const response = await fetch("/api/ai-painter/training-control", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ action }),
    })
    const result = (await response.json()) as { ok: boolean; message?: string }
    setMessage(result.ok ? "任务已提交到本地训练控制器。" : result.message ?? "任务启动失败。")
  }

  return (
    <>
      <section className={styles.systemGrid}>
        <InfoCard
          label="GPU"
          value={data?.system.name ?? "检测中"}
          detail={data?.system.gpuAvailable ? "CUDA 可用" : "未检测到可用 CUDA"}
        />
        <InfoCard
          label="显存 / 使用率"
          value={`${data?.system.memoryUsedMiB ?? 0} / ${data?.system.memoryTotalMiB ?? 0} MiB`}
          detail={`当前占用 ${data?.system.utilizationPercent ?? 0}%`}
        />
        <InfoCard
          label="温度 / 驱动"
          value={`${data?.system.temperatureCelsius ?? 0}°C`}
          detail={`驱动 ${data?.system.driver ?? "--"}`}
        />
        <InfoCard label="模型" value={data?.model.name ?? "读取中"} detail={data?.model.framework ?? "--"} />
      </section>

      <section className={styles.systemGrid}>
        <InfoCard
          label="资源账本"
          value={resource ? `${resource.status === "running" ? "记录中" : "已记录"} / ${resource.sampleCount} 点` : "暂无记录"}
          detail={resource ? `任务 ${resource.action}` : "从页面启动训练后自动生成"}
        />
        <InfoCard
          label="功耗估算"
          value={`${formatNumber(resource?.averagePowerWatts)} W`}
          detail={`峰值 GPU ${formatNumber(resource?.maxGpuUtilizationPercent)}%`}
        />
        <InfoCard
          label="电量 / 电费"
          value={`${formatNumber(resource?.electricity.estimatedKwh, 4)} kWh`}
          detail={`约 ${formatNumber(resource?.electricity.estimatedCny, 4)} 元`}
        />
        <InfoCard
          label="本地计算账本"
          value={`外部绘图 token ${resource?.tokenLedger.externalApiTokens ?? 0}`}
          detail={`本地计算 token ${resource?.tokenLedger.localComputeTokens ?? 0}`}
        />
      </section>

      <section className={styles.currentTask}>
        <div>
          <p className={styles.kicker}>CURRENT TASK</p>
          <h2>{busy ? data?.control.currentStep ?? "本地训练进行中" : "等待下一次训练"}</h2>
          <p>
            {busy
              ? "页面会持续刷新 GPU、训练状态、电费估算和当前阶段。"
              : message || "当前主线是完整自然家园小模型训练。未通过 VisualJudge 与 ApprovedFrame 的图不会进入 /world。"}
          </p>
        </div>
        <div className={styles.compactProgress}>
          <strong>{currentPercent}%</strong>
          <span>{busy ? "运行中" : "空闲"}</span>
        </div>
      </section>

      <section className={styles.panel}>
        <p className={styles.kicker}>TRAINING ENTRANCES</p>
        <h2>训练入口分线</h2>
        <p>
          主页面只放入口和状态。完整训练负责自然家园主世界画面，局部训练负责未来可复用视觉单元。
          当前主线仍是完整自然家园训练；局部训练不能把任何候选图写入 /world。
        </p>
        <div className={styles.stageGrid}>
          <StageCard
            href="/ai-painter-progress/natural-home"
            label="完整训练入口"
            title="完整自然家园训练"
            status={getFullTrainingStatus(data)}
            description="训练完整自然家园候选图，目标是生成非局部、非 crop、完整尺寸、当前事实匹配的 ApprovedFrame。"
            actionLabel={fullAction?.label}
            disabled={busy}
            onAction={fullAction ? () => void start(fullAction.action) : undefined}
            danger={Boolean(data?.naturalHomeQuality?.status === "blocked")}
          />
          <StageCard
            href="/ai-painter-progress/local-assets"
            label="局部训练入口"
            title="局部视觉单元训练"
            status="后置 / 只查看"
            description="未来训练草、水、树、石、人物、建筑、状态帧等 VisualUnit。当前不抢完整自然家园主线。"
          />
          <StageCard
            href="/ai-painter-progress/generated-results"
            label="结果归档入口"
            title="训练后生成内容"
            status={generatedCount > 0 ? `${generatedCount} 张候选记录` : "暂无候选统计"}
            description="集中查看训练输出、候选图、失败图、时间戳、耗时、资源账本和审核结果。失败图也必须保留。"
          />
        </div>
      </section>

      <section className={styles.summaryStrip}>
        <span>
          整体 MVP 进度：<strong>{mvpPercent}%</strong>
        </span>
        <span>
          当前主线：<strong>完整自然家园训练 + VisualJudge + ApprovedFrame</strong>
        </span>
        <span>
          外部在线绘图 API：<strong>0</strong>
        </span>
      </section>

      <section className={styles.stageGrid}>
        <StageCard
          href="/ai-painter-progress/history"
          label="训练历史"
          title="历史记录与资源账本"
          status={resource ? "已有记录" : "待生成"}
          description="查看每次训练摘要、GPU 使用、电费估算、耗时和失败记录。"
        />
        <StageCard
          href="/ai-painter-progress/dataset-inventory"
          label="数据清单"
          title="数据与资产清单"
          status={`${data?.dataset.formalSceneSamples ?? 0} 个正式样本`}
          description="查看训练样本、条件通道、图像尺寸和当前可用数据范围。"
        />
        <StageCard
          href="/ai-painter-progress/component-readiness"
          label="局部准备度"
          title="VisualUnit 准备状态"
          status={`${data?.componentReadiness?.blockedChannelCount ?? 0} 类阻断`}
          description="检查局部视觉单元是否具备训练条件。该模块当前后置，不能抢完整训练主线。"
          actionLabel="重新检查"
          disabled={busy}
          onAction={() => void start("prepare_component_instances")}
          danger={!data?.componentReadiness?.canStartAutonomousTraining}
        />
      </section>

      <section className={styles.panel}>
        <p className={styles.kicker}>QUALITY GATE</p>
        <h2>当前审核边界</h2>
        <dl className={styles.metrics}>
          <div>
            <dt>训练质量闸门</dt>
            <dd>{qualityGateLabel(qualityGate?.status)}</dd>
          </div>
          <div>
            <dt>下一轮训练</dt>
            <dd>{qualityGate?.canEnterNextTraining ? "允许" : "未允许"}</dd>
          </div>
          <div>
            <dt>正式世界展示</dt>
            <dd>{qualityGate?.canPromoteToWorld ? "允许" : "禁止"}</dd>
          </div>
          <div>
            <dt>/world 状态</dt>
            <dd>只展示完整 ApprovedFrame</dd>
          </div>
        </dl>
        <p>
          候选图、训练图、失败图、局部图和 crop 图都只进入训练归档页。
          /world 是玩家主世界页面，不是训练预览页。
        </p>
      </section>

      {data?.control.error ? <p className={styles.error}>{data.control.error}</p> : null}
    </>
  )
}

function getNextFullTrainingAction(data: Progress | null): StartableAction | undefined {
  if (!data) return undefined
  if (!data.naturalHomeReadiness?.canStartTraining && !data.naturalHomeQuality) {
    return { label: "检查自然家园源图", action: "report_natural_home" }
  }

  for (const step of nextFullTrainingSteps) {
    if (!step.ready(data)) return { label: step.label, action: step.action }
  }

  return undefined
}

function getFullTrainingStatus(data: Progress | null) {
  if (!data) return "读取中"
  if (data.naturalHomeV99Vj1BoundarySimilarityRepair?.inferenceReady) return "V99 已生成候选，等待 VJ 复盘"
  if (data.naturalHomeV98Vj1SignalRepair?.inferenceReady) return "V98 已生成候选，等待 V99"
  if (data.naturalHomeV97EdgeBoundaryRepair?.inferenceReady) return "V97 已生成候选，等待 V98"
  if (data.naturalHomeV96CleanMultilayout?.inferenceReady) return "V96 已完成，等待 V97"
  if (data.naturalHomeV89QualityAllowlistTraining?.inferenceReady) return "V89 已完成，等待 V96"
  if (data.naturalHomeV88QualityAllowlistDataset?.inferenceReady) return "V88 数据集完成"
  if (data.naturalHomeV87QualityLedger?.inferenceReady) return "V87 质量账本完成"
  if (data.naturalHomeRefiner?.inferenceReady) return "RGB 细化已完成"
  if (data.naturalHomeStructure?.inferenceReady) return "结构推理已完成"
  if (data.naturalHomeTraining?.inferenceReady) return "基础推理已完成"
  if (data.naturalHomeQuality?.status === "blocked") return "质量阻断"
  if (data.naturalHomeReadiness?.canStartTraining) return "可开始训练"
  return `${data.naturalHomeReadiness?.blockedSampleCount ?? 0} 张阻断`
}

function getCurrentPercent(data: Progress | null, busy: boolean) {
  if (!data) return 0
  if (!busy) return 100
  return data.training.percent ?? 0
}

function getMvpPercent(data: Progress | null) {
  if (!data) return 0
  let score = 0
  if (data.naturalHomeReadiness?.canStartTraining || data.naturalHomeQuality) score += 10
  if (data.naturalHomeTraining?.inferenceReady) score += 15
  if (data.naturalHomeStructure?.inferenceReady) score += 15
  if (data.naturalHomeRefiner?.inferenceReady) score += 10
  if (data.naturalHomeV87QualityLedger?.inferenceReady) score += 10
  if (data.naturalHomeV88QualityAllowlistDataset?.inferenceReady) score += 10
  if (data.naturalHomeV89QualityAllowlistTraining?.inferenceReady) score += 10
  if (data.naturalHomeV96CleanMultilayout?.inferenceReady) score += 5
  if (data.naturalHomeV97EdgeBoundaryRepair?.inferenceReady) score += 5
  if (data.naturalHomeV98Vj1SignalRepair?.inferenceReady) score += 5
  if (data.naturalHomeV99Vj1BoundarySimilarityRepair?.inferenceReady) score += 5
  if (data.trainingQualityGate) score += 5
  if (data.componentReadiness) score += 3
  if ((data.trainingExpansion.manifest?.sampleCount ?? 0) > 0) score += 2
  return Math.min(100, score)
}

function getGeneratedCount(data: Progress | null) {
  return (
    data?.naturalHomeBestTrainingCandidate?.summary?.rowCount ??
    data?.naturalHomeBestTrainingCandidate?.latest?.rowCount ??
    data?.naturalHomeV99Vj1BoundarySimilarityRepair?.latest?.summary?.rowCount ??
    data?.naturalHomeV99Vj1BoundarySimilarityRepair?.latest?.rowCount ??
    data?.naturalHomeV98Vj1SignalRepair?.latest?.summary?.rowCount ??
    data?.naturalHomeV98Vj1SignalRepair?.latest?.rowCount ??
    data?.naturalHomeV97EdgeBoundaryRepair?.latest?.summary?.rowCount ??
    data?.naturalHomeV97EdgeBoundaryRepair?.latest?.rowCount ??
    data?.naturalHomeV89QualityAllowlistTraining?.latest?.summary?.rowCount ??
    data?.naturalHomeV89QualityAllowlistTraining?.latest?.rowCount ??
    data?.naturalHomeV51SafeCandidatePack?.latest?.summary?.safeRowCount ??
    data?.naturalHomeV49V32DiversitySweep?.latest?.rowCount ??
    0
  )
}

function qualityGateLabel(status?: string) {
  if (status === "passed_for_next_training") return "通过，可进入下一轮训练"
  if (status === "warning_keep_candidate") return "候选保留，需要观察"
  if (status === "failed_keep_for_history") return "失败，仅保留历史"
  return "暂无质量闸门结论"
}

function formatNumber(value?: number | null, digits = 2) {
  return typeof value === "number" && Number.isFinite(value) ? value.toFixed(digits) : "--"
}
