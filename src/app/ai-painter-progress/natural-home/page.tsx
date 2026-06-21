import { readFile } from "node:fs/promises"
import path from "node:path"
import type { Metadata } from "next"
import Link from "next/link"
import styles from "../page.module.css"

export const dynamic = "force-dynamic"

export const metadata: Metadata = {
  title: "纯自然家园训练阶段 | AI-PET-WORLD",
}

type TargetMetrics = {
  contrast?: number
  edgeDensity?: number
  laplacianVariance?: number
  colorRangeMean?: number
  uniqueColorRatio?: number
  brightness?: number
}

type QualityReport = {
  sampleCount?: number
  minimumMvpSampleCount?: number
  blockedSampleCount?: number
  forbiddenPixelTotal?: number
  conflictPixelTotal?: number
  imageQualityBlockedSampleCount?: number
  warningCounts?: Record<string, number>
  status?: string
  canTrainExperiment?: boolean
  canTrainMvpV1?: boolean
  missingVarietyChannels?: string[]
  optionalLowVarietyChannels?: string[]
  nextActions?: string[]
  samples?: Array<{
    sampleId: string
    status?: string
    warnings?: string[]
    conflictPixels?: Record<string, number>
    targetMetrics?: TargetMetrics
  }>
}

type DatasetManifest = {
  status?: string
  sampleCount?: number
  sourceSampleCount?: number
  cleanSampleCount?: number
  blockedSampleCount?: number
  trainCount?: number
  validationCount?: number
  createdAt?: string
  warningCounts?: Record<string, number>
}

type TrainingSummary = {
  status?: string
  trainingVersion?: string
  modelVersion?: string
  epochs?: number
  bestSelectionLoss?: number
  bestStructureIoU?: number
  bestValidationLoss?: number
  device?: string
  parameterCount?: number
  trainSampleCount?: number
  validationSampleCount?: number
  lossWeights?: Record<string, number>
}

type RefinerDiagnosis = {
  status?: string
  metrics?: {
    sharpnessRatio?: number
    edgeDensityRatio?: number
    comparison?: { mae?: number; psnr?: number }
  }
  failures?: Array<{ code: string; severity?: string; message?: string }>
  nextTrainingPlan?: string[]
}

type NextTrainingPlan = {
  status?: string
  decisions?: Array<{ code: string; reason?: string }>
  dataActions?: string[]
  nextConfigPreview?: {
    maxEpochs?: number
    learningRate?: number
    lossWeights?: { edge?: number; texture?: number }
  }
}

export default async function NaturalHomePage() {
  const quality = await readJson<QualityReport>(".runtime/ai-painter/natural-home-quality/report.json")
  const dataset = await readJson<DatasetManifest>(".runtime/ai-painter/natural-home-dataset/dataset-manifest.json")
  const cleanDataset = await readJson<DatasetManifest>(".runtime/ai-painter/natural-home-clean-dataset/dataset-manifest.json")
  const baseTraining = await readJson<TrainingSummary>(".runtime/ai-painter/natural-home-training/training-summary.json")
  const structureTraining = await readJson<TrainingSummary>(".runtime/ai-painter/natural-home-structure-guided-training/training-summary.json")
  const refinerTraining = await readJson<TrainingSummary>(".runtime/ai-painter/natural-home-rgb-refiner-training/training-summary.json")
  const refinerDiagnosis = await readJson<RefinerDiagnosis>(".runtime/ai-painter/natural-home-rgb-refiner-diagnosis/report.json")
  const cleanStructureTraining = await readJson<TrainingSummary>(".runtime/ai-painter/natural-home-clean-structure-guided-training/training-summary.json")
  const cleanRefinerTraining = await readJson<TrainingSummary>(".runtime/ai-painter/natural-home-clean-rgb-refiner-training/training-summary.json")
  const cleanRefinerDiagnosis = await readJson<RefinerDiagnosis>(".runtime/ai-painter/natural-home-clean-rgb-refiner-diagnosis/report.json")
  const cleanRefinerV2Training = await readJson<TrainingSummary>(".runtime/ai-painter/natural-home-clean-rgb-refiner-v2-training/training-summary.json")
  const cleanRefinerV2Diagnosis = await readJson<RefinerDiagnosis>(".runtime/ai-painter/natural-home-clean-rgb-refiner-v2-diagnosis/report.json")
  const nextTrainingPlan = await readJson<NextTrainingPlan>(".runtime/ai-painter/natural-home-next-training-plan/plan.json")
  const blockedSamples = (quality?.samples ?? []).filter((sample) => sample.status !== "pass").slice(0, 10)

  return (
    <main className={styles.page}>
      <header className={styles.header}>
        <Link className={styles.back} href="/ai-painter-progress">
          返回训练主页
        </Link>
        <p className={styles.kicker}>STAGE 00 / NATURAL HOME</p>
        <h1>纯自然家园训练阶段</h1>
        <p>
          当前阶段只训练自然世界底图：草地、水体、水岸、自然小路、树、石头、花草和空间深度。
          不训练建筑、施工、角色、动物和管家。所有输出都只是本地模型候选图，未通过 VisualJudge 前不会进入正式世界。
        </p>
        <dl className={styles.metrics}>
          <Metric label="原始样本" value={`${dataset?.sampleCount ?? quality?.sampleCount ?? 0} 张`} />
          <Metric label="清洁样本" value={`${cleanDataset?.cleanSampleCount ?? 0} 张`} />
          <Metric label="隔离样本" value={`${cleanDataset?.blockedSampleCount ?? quality?.blockedSampleCount ?? 0} 张`} />
          <Metric label="训练 / 验证" value={`${cleanDataset?.trainCount ?? dataset?.trainCount ?? 0} / ${cleanDataset?.validationCount ?? dataset?.validationCount ?? 0}`} />
        </dl>
      </header>

      <section className={styles.panel}>
        <p className={styles.kicker}>CURRENT GATE</p>
        <h2>当前训练入口状态</h2>
        <div className={styles.qualityList}>
          <ProgressRow
            title="原始训练集"
            status={`${dataset?.sampleCount ?? quality?.sampleCount ?? 0} 张`}
            detail="这是导入后的完整自然家园样本池，不等于正式训练入口。"
          />
          <ProgressRow
            title="图像质量闸门"
            status={quality?.canTrainMvpV1 ? "通过" : "未通过"}
            detail={`阻断 ${quality?.blockedSampleCount ?? 0} 张，其中图像质量阻断 ${quality?.imageQualityBlockedSampleCount ?? 0} 张。`}
          />
          <ProgressRow
            title="清洁训练集"
            status={cleanDataset ? "已生成" : "未生成"}
            detail={cleanDataset ? `正式下一轮训练应使用 ${cleanDataset.cleanSampleCount ?? 0} 张清洁样本；创建时间 ${formatDate(cleanDataset.createdAt)}。` : "等待运行清洁训练集生成命令。"}
          />
          <ProgressRow
            title="正式世界展示"
            status="未通过"
            detail="当前自然家园输出仍不能进入 /world；只有 ApprovedFrame 才能给玩家展示。"
          />
        </div>
      </section>

      <section className={styles.resultGrid}>
        <ImageCard
          badge="原始训练池"
          title="原始自然家园样本总览"
          description="包含全部导入样本，其中有低对比或低边缘密度样本，因此不能直接作为下一轮正式训练入口。"
          src="/api/ai-painter/natural-home/dataset"
        />
        <ImageCard
          badge="清洁训练集"
          title="质量闸门后的清洁样本"
          description="只保留通过图像质量门的样本。下一轮自然家园模型训练必须优先使用这组数据。"
          src="/api/ai-painter/natural-home/cleanDataset"
        />
        <ImageCard
          badge="本地模型输出"
          title="Tiny U-Net 推理图"
          description="本地小模型直接从 14 通道条件生成 RGB 图，证明链路可运行，但画质未达标。"
          src="/api/ai-painter/natural-home/inference"
          failed
        />
        <ImageCard
          badge="结构引导输出"
          title="结构引导推理图"
          description="结构比基础模型稳定，但仍偏模糊，不能作为正式世界画面。"
          src="/api/ai-painter/natural-home/structureInference"
          failed
        />
        <ImageCard
          badge="RGB 细化输出"
          title="RGB Refiner 推理图"
          description="当前已知较好的本地细化结果，仍未通过正式视觉质量。"
          src="/api/ai-painter/natural-home/rgbRefinerInference"
          failed
        />
        <ImageCard
          badge="清洁结构输出"
          title="清洁集结构引导推理图"
          description="基于 82 张清洁样本重新训练的结构引导模型输出，结构理解强，但仍不是玩家画面。"
          src="/api/ai-painter/natural-home/cleanStructureInference"
          failed
        />
        <ImageCard
          badge="清洁 RGB 输出"
          title="清洁集 RGB Refiner 推理图"
          description="基于清洁训练集重新训练后的 RGB 输出，仍未通过 VisualJudge，只能作为训练诊断图。"
          src="/api/ai-painter/natural-home/cleanRgbRefinerInference"
          failed
        />
        <ImageCard
          badge="RGB Refiner v2"
          title="清洁集 RGB 细节金字塔推理图"
          description="本轮新增的本地 v2 细节模型输出，重点检查锐度、边缘密度、水岸、树冠和岩石像素细节。未通过 VisualJudge 前仍不进入正式世界。"
          src="/api/ai-painter/natural-home/cleanRgbRefinerV2Inference"
          failed
        />
        <ImageCard
          badge="能力验证通过"
          title="单样本 Direct Output 推理图"
          description="本地模型直接输出 RGB 后，单样本能力验证已达到候选通过。它证明模型结构能学清楚目标图，但还不是多场景泛化结果。"
          src="/api/ai-painter/natural-home/singleDirectOverfitInference"
        />
        <ImageCard
          badge="多样本未通过"
          title="清洁集 Direct Output 多样本推理图"
          description="同一 Direct Output 路线扩展到 82 张清洁样本后仍然平均化，说明下一阶段要转向局部 patch 细节训练，而不是继续堆整图 epoch。"
          src="/api/ai-painter/natural-home/cleanDirectInference"
          failed
        />
        <ImageCard
          badge="结构检查"
          title="14 通道结构预览"
          description="这不是玩家画面，只用于检查模型条件是否表达了草地、水岸、道路、树和岩石结构。"
          src="/api/ai-painter/natural-home/structurePreview"
        />
        <ImageCard
          badge="清洁结构检查"
          title="清洁集 14 通道结构预览"
          description="清洁结构引导模型输出的结构检查图，用于确认条件结构是否被模型保留。"
          src="/api/ai-painter/natural-home/cleanStructurePreview"
        />
      </section>

      <section className={styles.panel}>
        <p className={styles.kicker}>MODEL STATUS</p>
        <h2>本地模型训练结果</h2>
        <div className={styles.qualityList}>
          <ProgressRow title="基础 Tiny U-Net" status={trainingStatus(baseTraining)} detail={`best loss ${formatNumber(baseTraining?.bestSelectionLoss)}，训练样本 ${baseTraining?.trainSampleCount ?? "--"}。`} />
          <ProgressRow title="结构引导模型" status={trainingStatus(structureTraining)} detail={`structure IoU ${formatNumber(structureTraining?.bestStructureIoU)}。`} />
          <ProgressRow title="RGB Refiner" status={trainingStatus(refinerTraining)} detail={`validation loss ${formatNumber(refinerTraining?.bestValidationLoss)}。`} />
          <ProgressRow title="RGB 诊断" status={translateDiagnosisStatus(refinerDiagnosis?.status)} detail={diagnosisMetricLine(refinerDiagnosis)} />
          <ProgressRow title="清洁结构引导模型" status={trainingStatus(cleanStructureTraining)} detail={`structure IoU ${formatNumber(cleanStructureTraining?.bestStructureIoU)}，训练/验证 ${cleanStructureTraining?.trainSampleCount ?? "--"} / ${cleanStructureTraining?.validationSampleCount ?? "--"}。`} />
          <ProgressRow title="清洁 RGB Refiner" status={trainingStatus(cleanRefinerTraining)} detail={`validation loss ${formatNumber(cleanRefinerTraining?.bestValidationLoss)}，训练/验证 ${cleanRefinerTraining?.trainSampleCount ?? "--"} / ${cleanRefinerTraining?.validationSampleCount ?? "--"}。`} />
          <ProgressRow title="清洁 RGB 诊断" status={translateDiagnosisStatus(cleanRefinerDiagnosis?.status)} detail={diagnosisMetricLine(cleanRefinerDiagnosis)} />
          <ProgressRow title="下一轮决策" status={translatePlanStatus(nextTrainingPlan?.status)} detail={planConfigLine(nextTrainingPlan)} />
        </div>
      </section>

      <section className={styles.panel}>
        <p className={styles.kicker}>QUALITY REPORT</p>
        <h2>质量阻断原因</h2>
        <div className={styles.qualityList}>
          <ProgressRow title="阻断统计" status={`${quality?.blockedSampleCount ?? 0} 张`} detail={warningCountLine(quality?.warningCounts)} />
          <ProgressRow title="禁用内容通道" status={`${quality?.forbiddenPixelTotal ?? 0} 像素`} detail="自然家园阶段建筑、施工、人物、动物通道必须为空。" />
          <ProgressRow title="通道冲突" status={`${quality?.conflictPixelTotal ?? 0} 像素`} detail="水体、道路、树冠、岩石等关键通道不能大面积互相覆盖。" />
          <ProgressRow title="下一步" status="清洁训练" detail={translateNextActions(quality?.nextActions)} />
        </div>
      </section>

      <section className={styles.panel}>
        <p className={styles.kicker}>QUARANTINE</p>
        <h2>被隔离样本</h2>
        <div className={styles.qualityList}>
          {blockedSamples.length ? (
            blockedSamples.map((sample) => (
              <article key={sample.sampleId}>
                <strong>{sample.sampleId}</strong>
                <span>{translateWarnings(sample.warnings)}</span>
                <small>{sampleMetricLine(sample.targetMetrics)}；{topConflicts(sample.conflictPixels)}</small>
              </article>
            ))
          ) : (
            <p>暂无阻断样本。</p>
          )}
        </div>
      </section>
    </main>
  )
}

function Metric(props: { label: string; value: string }) {
  return (
    <div>
      <dt>{props.label}</dt>
      <dd>{props.value}</dd>
    </div>
  )
}

function ProgressRow(props: { title: string; status: string; detail: string }) {
  return (
    <article>
      <strong>{props.title}</strong>
      <span>{props.status}</span>
      <small>{props.detail}</small>
    </article>
  )
}

function ImageCard(props: { badge: string; title: string; description: string; src: string; failed?: boolean }) {
  return (
    <article className={styles.resultCard}>
      <span className={props.failed ? styles.fail : styles.pass}>{props.badge}</span>
      <h2>{props.title}</h2>
      <p>{props.description}</p>
      <img src={props.src} alt={props.title} />
    </article>
  )
}

async function readJson<T>(file: string): Promise<T | null> {
  try {
    return JSON.parse(await readFile(path.join(/* turbopackIgnore: true */ process.cwd(), file), "utf8")) as T
  } catch {
    return null
  }
}

function trainingStatus(summary?: TrainingSummary | null) {
  if (summary?.status === "completed") return "已完成"
  if (summary) return "已有记录"
  return "未生成"
}

function translateDiagnosisStatus(status?: string) {
  if (status === "failed") return "未通过"
  if (status === "pass_candidate") return "候选通过"
  return "未生成"
}

function translatePlanStatus(status?: string) {
  if (status === "needs_data_or_model_change") return "需补数据或改模型"
  if (status === "ready_for_next_run") return "可继续训练"
  if (status === "ready_for_visual_judge") return "可进入审核"
  return "未生成"
}

function translateNextActions(actions?: string[]) {
  if (!actions?.length) return "等待质量报告。"
  const labels: Record<string, string> = {
    add_more_natural_home_training_png: "继续补充纯自然家园训练图",
    improve_or_quarantine_blocked_samples: "修复或隔离阻断样本",
    add_missing_channel_variety: "补齐缺失通道变化",
    train_natural_home_mvp_v1: "继续训练自然家园 MVP v1",
  }
  return actions.map((action) => labels[action] ?? action).join("；")
}

function translateWarnings(warnings?: string[]) {
  if (!warnings?.length) return "无警告"
  const labels: Record<string, string> = {
    missing_core_channel: "缺少核心通道",
    forbidden_channel_not_empty: "包含禁用通道",
    channel_conflict_too_high: "通道冲突过高",
    grass_coverage_too_low: "草地覆盖过低",
    tree_crown_coverage_too_high: "树冠覆盖过高",
    water_without_shoreline: "水体缺少水岸",
    target_missing: "目标图缺失",
    target_too_blurry: "目标图过糊",
    target_edge_density_too_low: "目标图边缘密度过低",
    target_contrast_too_low: "目标图对比度过低",
    target_color_range_too_low: "目标图颜色范围过低",
    target_pixel_detail_density_too_low: "目标图像素细节密度过低",
  }
  return warnings.map((warning) => labels[warning] ?? warning).join("；")
}

function warningCountLine(warningCounts?: Record<string, number>) {
  if (!warningCounts || !Object.keys(warningCounts).length) return "暂无图像质量阻断。"
  return Object.entries(warningCounts)
    .map(([code, count]) => `${translateWarnings([code])}: ${count}`)
    .join("；")
}

function sampleMetricLine(metrics?: TargetMetrics) {
  if (!metrics) return "无图像质量指标"
  return `对比度 ${formatNumber(metrics.contrast)}，边缘 ${formatNumber(metrics.edgeDensity)}，锐度 ${formatNumber(metrics.laplacianVariance)}`
}

function topConflicts(conflicts?: Record<string, number>) {
  if (!conflicts) return "无冲突数据"
  const top = Object.entries(conflicts)
    .filter(([, value]) => value > 0)
    .sort((left, right) => right[1] - left[1])
    .slice(0, 3)
    .map(([name, value]) => `${name}: ${value}`)
  return top.length ? `主要冲突：${top.join("；")}` : "无主要冲突"
}

function diagnosisMetricLine(report?: RefinerDiagnosis | null) {
  if (!report) return "等待推理图和同源目标图对比。"
  return `锐度比 ${formatNumber(report.metrics?.sharpnessRatio)}，边缘密度比 ${formatNumber(report.metrics?.edgeDensityRatio)}，MAE ${formatNumber(report.metrics?.comparison?.mae)}。`
}

function planConfigLine(plan?: NextTrainingPlan | null) {
  const config = plan?.nextConfigPreview
  if (!config) return "等待诊断器生成下一轮配置建议。"
  return `epoch ${config.maxEpochs ?? "--"}，lr ${formatNumber(config.learningRate)}，edge ${formatNumber(config.lossWeights?.edge)}，texture ${formatNumber(config.lossWeights?.texture)}。`
}

function formatNumber(value?: number) {
  return typeof value === "number" && Number.isFinite(value) ? value.toFixed(4) : "--"
}

function formatDate(value?: string) {
  if (!value) return "--"
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return value
  return date.toLocaleString("zh-CN", { hour12: false })
}
