"use client"

import { useEffect, useMemo, useState } from "react"
import { InfoCard } from "./_components/info-card"
import { StageCard } from "./_components/stage-card"
import type { Progress, TrainingAction } from "./_lib/progress-types"
import {
  buildNaturalHomeAction,
  buildNaturalHomeDescription,
  buildNaturalHomeStatus,
  calculateMvpPercent,
  calculateVisiblePercent,
  formatNumber,
  translateNextActions,
  translateQualityStatus,
} from "./_lib/progress-view-model"
import styles from "./page.module.css"

const businessCapabilityPlan = [
  {
    name: "自然环境视觉底座",
    state: "当前主线",
    detail: "草地、水体、水岸、自然路径、树木、岩石、花草和深度层。当前 V89 仍是隐藏候选，用来继续训练和筛选。",
  },
  {
    name: "人物 / 管家视觉单元",
    state: "未开始",
    detail: "未来要拆成人物体型、头部、服装、表情、朝向、待机、行走、劳动和互动状态帧。",
  },
  {
    name: "设施 / 建筑视觉单元",
    state: "未开始",
    detail: "未来要覆盖地基、墙体、屋顶、门窗、内部空间、家具、材料堆和建造阶段，不混入当前纯自然训练。",
  },
  {
    name: "动态状态帧",
    state: "未开始",
    detail: "水流、树叶、草地、天气、光影、动物和昆虫都应是状态帧或循环帧，不靠一张静态图硬撑。",
  },
  {
    name: "运行时合成",
    state: "待接入",
    detail: "后端世界事实决定对象和状态，小模型生成视觉表达，Runtime 再把地表、对象、状态帧和动效层组合成玩家画面。",
  },
  {
    name: "VisualJudge / ApprovedFrame",
    state: "框架中",
    detail: "VJ-0/VJ-1 已有闸门基础；VJ-2 还要判断语义、风格、状态一致性。通过后才写入正式 ApprovedFrame。",
  },
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

  const busy = data?.control.status === "running"
  const resource = data?.resourceUsage?.current ?? data?.resourceUsage?.latest ?? null
  const visiblePercent = useMemo(() => calculateVisiblePercent(data, busy), [data, busy])
  const mvpPercent = useMemo(() => calculateMvpPercent(data), [data])
  const quality = data?.naturalHomeQuality
  const missingChannels = data?.mvpGap?.missingRealAssetChannels ?? []
  const naturalHomeAction = buildNaturalHomeAction(data)
  const trainingQualityGate = data?.trainingQualityGate
  const bestTrainingCandidate = data?.naturalHomeBestTrainingCandidate
  const generatedCount =
    bestTrainingCandidate?.summary?.rowCount ??
    bestTrainingCandidate?.latest?.rowCount ??
    bestTrainingCandidate?.latest?.sampleCount ??
    data?.naturalHomeV49V32DiversitySweep?.latest?.summary?.rowCount ??
    data?.naturalHomeV49V32DiversitySweep?.latest?.rowCount ??
    data?.naturalHomeV49V32DiversitySweep?.latest?.sampleCount ??
    data?.naturalHomeV48SplitExpertMergeGate?.latest?.summary?.rowCount ??
    data?.naturalHomeV48SplitExpertMergeGate?.latest?.rowCount ??
    data?.naturalHomeV48SplitExpertMergeGate?.latest?.sampleCount ??
    data?.naturalHomeV47HardFailureStabilization?.latest?.rowCount ??
    data?.naturalHomeV47HardFailureStabilization?.latest?.sampleCount ??
    data?.naturalHomeV46V45FailureFocusRepair?.latest?.rowCount ??
    data?.naturalHomeV46V45FailureFocusRepair?.latest?.sampleCount ??
    data?.naturalHomeV45Generalization?.latest?.rowCount ??
    data?.naturalHomeV45Generalization?.latest?.sampleCount ??
    data?.naturalHomeV44V32StableGeneralization?.latest?.rowCount ??
    data?.naturalHomeV44V32StableGeneralization?.latest?.sampleCount ??
    data?.naturalHomeV43V32FailureFocusRepair?.latest?.rowCount ??
    data?.naturalHomeV43V32FailureFocusRepair?.latest?.sampleCount ??
    data?.naturalHomeV42WaterExpertFix?.latest?.rowCount ??
    data?.naturalHomeV42WaterExpertFix?.latest?.sampleCount ??
    data?.naturalHomeV41V32WaterRescue?.latest?.rowCount ??
    data?.naturalHomeV41V32WaterRescue?.latest?.sampleCount ??
    data?.naturalHomeV40SharpnessLockRepair?.latest?.rowCount ??
    data?.naturalHomeV40SharpnessLockRepair?.latest?.sampleCount ??
    data?.naturalHomeV36BalancedGeneralization?.latest?.rowCount ??
    data?.naturalHomeV36BalancedGeneralization?.latest?.sampleCount ??
    data?.naturalHomeV35BalancedWaterDetail?.latest?.rowCount ??
    data?.naturalHomeV35BalancedWaterDetail?.latest?.sampleCount ??
    data?.naturalHomeV34WaterStability?.latest?.rowCount ??
    data?.naturalHomeV34WaterStability?.latest?.sampleCount ??
    data?.naturalHomeV33WaterArtifactGuard?.latest?.rowCount ??
    data?.naturalHomeV33WaterArtifactGuard?.latest?.sampleCount ??
    data?.naturalHomeV28RealMaskRemix?.latest?.sampleCount ??
    data?.naturalHomeV27AugmentedDiversity?.latest?.sampleCount ??
    data?.naturalHomeDiversityRefiner?.latest?.sampleCount ??
    data?.naturalHomeDiversityGeneralization?.latest?.sampleCount ??
    data?.naturalHomeDiversityGeneration?.latest?.sampleCount ??
    0

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
          value={
            resource
              ? `${resource.status === "running" ? "记录中" : "已记录"} / ${resource.telemetrySampleCount ?? resource.sampleCount} 个采样点`
              : "暂无记录"
          }
          detail={resource ? `任务 ${resource.action}` : "从页面启动训练后会自动生成"}
        />
        <InfoCard
          label="功耗估算"
          value={`${formatNumber(resource?.averagePowerWatts)} W`}
          detail={`峰值 GPU ${formatNumber(resource?.maxGpuUtilizationPercent)}%`}
        />
        <InfoCard
          label="电量 / 电费"
          value={`${formatNumber(resource?.electricity.estimatedKwh, 4)} kWh`}
          detail={`约 ${formatNumber(resource?.electricity.estimatedCny, 4)} 元，按 ${resource?.electricity.cnyPerKwh ?? 0.6} 元/度`}
        />
        <InfoCard
          label="Token 账本"
          value={`外部 ${resource?.tokenLedger.externalApiTokens ?? 0}`}
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
              : message || "正式世界仍受 VisualJudge 闸门控制。未通过审核的图不会进入 /world。"}
          </p>
        </div>
        <div className={styles.compactProgress}>
          <strong>{visiblePercent}%</strong>
          <span>{busy ? "运行中" : "空闲"}</span>
        </div>
      </section>

      <section className={styles.summaryStrip}>
        <span>
          整体 MVP 进度：<strong>{mvpPercent}%</strong>
        </span>
        <span>
          当前主线：<strong>纯自然家园视觉底座 / 本地自研小模型 / 不进正式世界</strong>
        </span>
        <span>
          外部在线绘图 API：<strong>0</strong>
        </span>
      </section>

      <section className={styles.panel}>
        <p className={styles.kicker}>BUSINESS CAPABILITY MAP</p>
        <h2>动态世界不是一张图，是可组合视觉单元</h2>
        <p>
          当前训练只推进“纯自然环境底座”。正式业务还需要人物、管家、设施、建筑、内部空间、状态帧和运行时合成。
          静态图只作为训练证据和视觉单元基础，未来玩家看到的是世界事实驱动后的动态 ApprovedFrame / RuntimeFrame。
        </p>
        <div className={styles.capabilityGrid}>
          {businessCapabilityPlan.map((item) => (
            <article key={item.name} className={styles.capabilityCard}>
              <span>{item.state}</span>
              <h3>{item.name}</h3>
              <p>{item.detail}</p>
            </article>
          ))}
        </div>
      </section>

      <section className={styles.panel}>
        <p className={styles.kicker}>INFORMATION ARCHITECTURE</p>
        <h2>主页只放入口，训练后的图片集中归档</h2>
        <p>
          V19 到 V89 的训练输出不堆在主页。图片、时间戳、文件位置、质量门结论、失败原因和资源账本，都进入“训练后生成内容”模块。
          主页只负责告诉我们：当前阶段、当前最佳候选、下一步该跑什么。
        </p>
      </section>

      {trainingQualityGate ? (
        <section className={styles.panel}>
          <p className={styles.kicker}>TRAINING QUALITY GATE</p>
          <h2>训练结果质量门</h2>
          <p>
            这里只判断本地小模型输出能不能作为下一轮训练依据。它不是正式 VJ-2，也不会把候选图直接放进 /world。
          </p>
          <dl className={styles.metrics}>
            <div>
              <dt>质量门状态</dt>
              <dd>{qualityGateLabel(trainingQualityGate.status)}</dd>
            </div>
            <div>
              <dt>综合分</dt>
              <dd>{formatNumber(trainingQualityGate.overallScore, 2)}</dd>
            </div>
            <div>
              <dt>下一轮训练</dt>
              <dd>{trainingQualityGate.canEnterNextTraining ? "允许作为依据" : "阻断"}</dd>
            </div>
            <div>
              <dt>正式世界展示</dt>
              <dd>{trainingQualityGate.canPromoteToWorld ? "允许" : "禁止"}</dd>
            </div>
          </dl>
          <div className={styles.qualityList}>
            {(trainingQualityGate.rows ?? []).map((row) => (
              <article key={row.sourceId}>
                <strong>{row.sourceId}</strong>
                <span>{qualityGateRowLabel(row.status)} / 分数 {formatNumber(row.score, 2)}</span>
                <small>
                  MAE {formatNumber(row.mae ?? undefined, 4)} / PSNR {formatNumber(row.psnr ?? undefined, 2)} /
                  锐度 {formatNumber(row.sharpnessRatio ?? undefined, 3)} / 边缘{" "}
                  {formatNumber(row.edgeDensityRatio ?? undefined, 3)}
                </small>
                <small>{(row.reasons ?? []).join("；")}</small>
              </article>
            ))}
          </div>
        </section>
      ) : null}

      <section className={styles.stageGrid}>
        <StageCard
          href="/ai-painter-progress/natural-home"
          label="STAGE 00"
          title="纯世界家园训练"
          status={buildNaturalHomeStatus(data)}
          description={buildNaturalHomeDescription(data)}
          actionLabel={naturalHomeAction?.label}
          disabled={busy}
          onAction={naturalHomeAction ? () => void start(naturalHomeAction.action) : undefined}
          danger={quality?.status === "blocked"}
        />
        <StageCard
          href="/ai-painter-progress/bootstrap"
          label="STAGE 01"
          title="单图训练验证"
          status={data?.training.inferenceReady ? "已完成" : "未完成"}
          description="验证本地 PyTorch、CUDA、权重保存和 PNG 推理链路是否真实可运行。"
          actionLabel="重新训练"
          disabled={busy}
          onAction={() => void start("full")}
        />
        <StageCard
          href="/ai-painter-progress/generated-results"
          label="STAGE 02"
          title="训练后生成内容"
          status={generatedCount > 0 ? `已有 ${generatedCount} 张最新候选` : "查看记录"}
          description="集中查看本地模型推理后的 PNG、生成时间、文件位置、审核状态和失败记录。"
        />
        <StageCard
          href="/ai-painter-progress/history"
          label="STAGE 03"
          title="训练历史"
          status="查看记录"
          description="集中查看每次训练摘要、资源账本和审核结论。失败记录也必须保留。"
        />
        <StageCard
          href="/ai-painter-progress/dataset-inventory"
          label="STAGE 04"
          title="数据与资产清单"
          status={`${data?.dataset.formalSceneSamples ?? 0} 个正式样本`}
          description="查看训练样本、条件通道、图像尺寸和当前可用数据范围。"
        />
        <StageCard
          href="/ai-painter-progress/local-assets"
          label="STAGE 05"
          title="本地资产库"
          status={data?.localAssets.compositeReady ? "已生成资产" : "准备中"}
          description="查看本地导入、候选资产和可信资产状态。原始素材不直接进入世界。"
        />
        <StageCard
          href="/ai-painter-progress/structure-guided"
          label="STAGE 06"
          title="结构引导模型"
          status={data?.naturalHomeStructure?.inferenceReady ? "已完成" : "未完成"}
          description="查看结构条件、Mask 和结构推理结果。它负责让世界事实约束画面布局。"
        />
        <StageCard
          href="/ai-painter-progress/rgb-refiner"
          label="STAGE 07"
          title="RGB 细化模型"
          status={data?.naturalHomeRefiner?.inferenceReady ? "已完成" : "未完成"}
          description="查看 RGB 细化训练与推理结果。它只负责视觉表达，不新增世界事实。"
        />
        <StageCard
          href="/ai-painter-progress/component-readiness"
          label="STAGE 08"
          title="部件实例闸门"
          status={
            data?.componentReadiness?.canStartAutonomousTraining
              ? "可自训"
              : `${data?.componentReadiness?.blockedChannelCount ?? 14} 类阻断`
          }
          description="检查 14 类结构部件是否有足够样本覆盖。当前不作为纯自然世界主线入口。"
          actionLabel="重新检查"
          disabled={busy}
          onAction={() => void start("prepare_component_instances")}
          danger={!data?.componentReadiness?.canStartAutonomousTraining}
        />
        <StageCard
          href="/ai-painter-progress"
          label="STAGE 08B"
          title="VisualUnit v0"
          status={data?.visualUnitV0 ? "schema 已建立" : "未接入"}
          description={
            data?.visualUnitV0
              ? `当前 MVP 单元 ${data.visualUnitV0.currentMvpUnitCount} 类，未来动态世界缺口 ${data.visualUnitV0.missingForDynamicWorld.length} 类。下一步：${data.visualUnitV0.nextModule}。`
              : "建立可组合视觉单元：自然、管家、人物、建筑、设施、道具、动物和动效。"
          }
        />
        <StageCard
          href="/ai-painter-progress/dataset-inventory"
          label="STAGE 08C"
          title="VisualUnit 数据目录"
          status={
            data?.visualUnitData
              ? `${data.visualUnitData.sampleCount} 个契约样例 / ${data.visualUnitData.trainingReadySampleCount} 个可训练`
              : "未建立"
          }
          description={
            data?.visualUnitData
              ? `当前只建立 VisualUnit 数据契约，正式世界展示=${data.visualUnitData.formalWorldDisplay ? "允许" : "禁止"}。下一步：${data.visualUnitData.nextRequiredWork?.[0] ?? "补齐同源 target 和 mask"}。`
              : "建立 data/visual-units，用来保存未来自然、人物、建筑、设施、物品、动物和动效的可组合训练数据。"
          }
        />
        <StageCard
          href="/ai-painter-progress/training-expansion"
          label="STAGE 09"
          title="训练扩张"
          status={`${data?.trainingExpansion.manifest?.sampleCount ?? 0} 张样本`}
          description="继续扩充同源训练场景，为完整世界训练准备。"
          actionLabel="重新编译"
          disabled={busy}
          onAction={() => void start("prepare_training_expansion")}
        />
        <StageCard
          href="/ai-painter-progress/autonomous-training"
          label="STAGE 10"
          title="自主训练闭环"
          status={data?.autonomousTraining.latestDiscrete ? "已跑过一轮" : "待启动"}
          description="未来串起结构、RGB、局部资产和离散像素，形成完整本地闭环。当前先不作为主训练入口。"
          disabled
        />
      </section>

      <section className={styles.summaryStrip}>
        <span>
          纯世界样本：<strong>{data?.naturalHomeTraining?.datasetManifest?.sampleCount ?? 0}</strong>
        </span>
        <span>
          质量报告：<strong>{quality ? translateQualityStatus(quality.status) : "未生成"}</strong>
        </span>
        <span>
          MVP 目标：<strong>{quality?.minimumMvpSampleCount ?? 50} 张</strong>
        </span>
        <span>
          可用资产：<strong>{data?.mvpGap?.assetSummary?.totalUsableAssets ?? 0}</strong>
        </span>
        <span>
          缺失通道：<strong>{missingChannels.length}</strong>
        </span>
      </section>

      {quality?.nextActions?.length ? (
        <section className={styles.summaryStrip}>
          <span>
            下一步：<strong>{translateNextActions(quality.nextActions)}</strong>
          </span>
        </section>
      ) : null}

      {data?.control.error ? <p className={styles.error}>{data.control.error}</p> : null}
    </>
  )
}

function qualityGateLabel(status?: string) {
  if (status === "passed_for_next_training") return "通过，可进入下一轮训练"
  if (status === "warning_keep_candidate") return "候选保留，需要观察"
  if (status === "failed_keep_for_history") return "失败，仅保留历史"
  return "暂无质量门结论"
}

function qualityGateRowLabel(status?: string) {
  if (status === "passed") return "通过"
  if (status === "warning") return "警告"
  if (status === "failed") return "失败"
  return "未知"
}
