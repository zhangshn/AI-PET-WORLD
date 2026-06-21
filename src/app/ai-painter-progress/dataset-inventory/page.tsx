import { readdir, readFile, stat } from "node:fs/promises"
import path from "node:path"
import type { Metadata } from "next"
import Link from "next/link"
import styles from "../detail.module.css"

export const dynamic = "force-dynamic"

export const metadata: Metadata = {
  title: "自然家园训练数据清单 | AI-PET-WORLD",
}

const runtimeRoot = ".runtime/ai-painter"
const originalDatasetRoot = `${runtimeRoot}/natural-home-dataset`
const cleanDatasetRoot = `${runtimeRoot}/natural-home-clean-dataset`
const v14InferenceRoot = `${runtimeRoot}/natural-home-local-detail-v14-single-source-compose-inference`
const v14TrainingRoot = `${runtimeRoot}/natural-home-local-detail-v14-single-source-compose-training`
const v14DiagnosisRoot = `${runtimeRoot}/natural-home-local-detail-v14-single-source-compose-diagnosis`
const v15InferenceRoot = `${runtimeRoot}/natural-home-local-detail-v15-multisource-compose-inference`
const v15TrainingRoot = `${runtimeRoot}/natural-home-local-detail-v15-multisource-compose-training`
const v15DiagnosisRoot = `${runtimeRoot}/natural-home-local-detail-v15-multisource-compose-diagnosis`
const v16InferenceRoot = `${runtimeRoot}/natural-home-local-detail-v16-style-multisource-compose-inference`
const v16TrainingRoot = `${runtimeRoot}/natural-home-local-detail-v16-style-multisource-compose-training`
const v16DiagnosisRoot = `${runtimeRoot}/natural-home-local-detail-v16-style-multisource-compose-diagnosis`
const v17InferenceRoot = `${runtimeRoot}/natural-home-local-detail-v17-source-expert-compose-inference`
const v17TrainingRoot = `${runtimeRoot}/natural-home-local-detail-v17-source-expert-compose-training`
const v17DiagnosisRoot = `${runtimeRoot}/natural-home-local-detail-v17-source-expert-compose-diagnosis`

type DatasetManifest = {
  status?: string
  scope?: string
  blueprintVersion?: string
  conditionChannels?: number
  sampleCount?: number
  sourceSampleCount?: number
  cleanSampleCount?: number
  blockedSampleCount?: number
  trainCount?: number
  validationCount?: number
  sampleIds?: string[]
  blockedSampleIds?: string[]
  warningCounts?: Record<string, number>
  createdAt?: string
  note?: string
  policy?: string
}

type QuarantineReport = {
  blockedSampleCount?: number
  blockedSamples?: Array<{
    sampleId: string
    warnings?: string[]
    status?: string
    targetMetrics?: {
      contrast?: number
      edgeDensity?: number
      laplacianVariance?: number
      brightness?: number
    }
  }>
}

type V14Latest = {
  status?: string
  displayAllowed?: boolean
  sourceId?: string
  device?: string
  generated?: string
  target?: string
  contactSheet?: string
  patchSize?: number
  stride?: number
  categories?: Array<{
    category: string
    patchCount?: number
    epoch?: number
    step?: number
    loss?: number
  }>
}

type DiagnosisReport = {
  status?: string
  displayAllowed?: boolean
  metrics?: {
    sharpnessRatio?: number
    edgeDensityRatio?: number
    comparison?: {
      mae?: number
      psnr?: number
    }
  }
  failures?: Array<{ code?: string; message?: string; severity?: string }>
}

type SampleRow = {
  sampleId: string
  split: "训练" | "验证" | "未进入索引"
  target: FileStatus
  blueprint: FileStatus
  maskCount: number
  status: "可训练" | "隔离" | "缺文件"
  warningText: string
}

type FileStatus = {
  exists: boolean
  sizeKiB?: number
  modifiedAt?: string
}

export default async function DatasetInventoryPage() {
  const [
    originalManifest,
    cleanManifest,
    quarantine,
    v14Latest,
    v14Diagnosis,
    v15Latest,
    v15Diagnosis,
    v16Latest,
    v16Diagnosis,
    v17Latest,
    v17Diagnosis,
  ] = await Promise.all([
    readJson<DatasetManifest>(`${originalDatasetRoot}/dataset-manifest.json`),
    readJson<DatasetManifest>(`${cleanDatasetRoot}/dataset-manifest.json`),
    readJson<QuarantineReport>(`${cleanDatasetRoot}/quarantine/quarantined-samples.json`),
    readJson<V14Latest>(`${v14InferenceRoot}/latest.json`),
    readJson<DiagnosisReport>(`${v14DiagnosisRoot}/report.json`),
    readJson<V14Latest>(`${v15InferenceRoot}/latest.json`),
    readJson<DiagnosisReport>(`${v15DiagnosisRoot}/report.json`),
    readJson<V14Latest>(`${v16InferenceRoot}/latest.json`),
    readJson<DiagnosisReport>(`${v16DiagnosisRoot}/report.json`),
    readJson<V14Latest>(`${v17InferenceRoot}/latest.json`),
    readJson<DiagnosisReport>(`${v17DiagnosisRoot}/report.json`),
  ])

  const rows = await buildSampleRows(cleanManifest, quarantine)
  const visibleRows = rows.slice(0, 40)
  const v14OutputFiles = await Promise.all([
    fileStatus(`${v14InferenceRoot}/generated.png`),
    fileStatus(`${v14InferenceRoot}/contact-sheet.png`),
    fileStatus(`${v14InferenceRoot}/target.png`),
    fileStatus(`${v14TrainingRoot}/training-summary.json`),
    fileStatus(`${v14DiagnosisRoot}/report.json`),
  ])
  const v15OutputFiles = await Promise.all([
    fileStatus(`${v15InferenceRoot}/generated.png`),
    fileStatus(`${v15InferenceRoot}/contact-sheet.png`),
    fileStatus(`${v15TrainingRoot}/training-summary.json`),
    fileStatus(`${v15DiagnosisRoot}/report.json`),
  ])
  const v16OutputFiles = await Promise.all([
    fileStatus(`${v16InferenceRoot}/generated.png`),
    fileStatus(`${v16InferenceRoot}/contact-sheet.png`),
    fileStatus(`${v16TrainingRoot}/training-summary.json`),
    fileStatus(`${v16DiagnosisRoot}/report.json`),
  ])
  const v17OutputFiles = await Promise.all([
    fileStatus(`${v17InferenceRoot}/generated.png`),
    fileStatus(`${v17InferenceRoot}/contact-sheet.png`),
    fileStatus(`${v17TrainingRoot}/training-summary.json`),
    fileStatus(`${v17DiagnosisRoot}/report.json`),
  ])

  return (
    <main className={styles.page}>
      <header className={styles.header}>
        <Link className={styles.back} href="/ai-painter-progress">
          返回训练主页
        </Link>
        <p className={styles.kicker}>NATURAL HOME DATA INVENTORY</p>
        <h1>自然家园训练数据清单</h1>
        <p>
          这个页面只整理小模型当前阶段的数据来源：原稿、可训练数据、隔离数据、训练后推理结果。
          它不是正式世界展示页，也不会让任何未审核图片进入 /world。
        </p>
        <dl className={styles.metrics}>
          <Metric label="原始样本" value={`${originalManifest?.sampleCount ?? 0} 张`} />
          <Metric label="可训练清洁样本" value={`${cleanManifest?.cleanSampleCount ?? 0} 张`} />
          <Metric label="训练 / 验证" value={`${cleanManifest?.trainCount ?? 0} / ${cleanManifest?.validationCount ?? 0}`} />
          <Metric label="隔离样本" value={`${cleanManifest?.blockedSampleCount ?? quarantine?.blockedSampleCount ?? 0} 张`} />
        </dl>
      </header>

      <section className={styles.panel}>
        <p className={styles.kicker}>CURRENT TRUTH</p>
        <h2>现在到底有什么数据</h2>
        <div className={styles.qualityList}>
          <InventoryRow
            title="原稿数据"
            status={`${originalManifest?.sampleCount ?? 0} 张`}
            detail={`目录：${originalDatasetRoot}。用途：原始自然家园图和结构条件来源，不直接等于正式训练入口。`}
          />
          <InventoryRow
            title="正式可训练数据"
            status={`${cleanManifest?.cleanSampleCount ?? 0} 张`}
            detail={`目录：${cleanDatasetRoot}。用途：当前自然家园小模型训练主入口，已排除低质量样本。`}
          />
          <InventoryRow
            title="隔离数据"
            status={`${cleanManifest?.blockedSampleCount ?? 0} 张`}
            detail={`这些图没有删除，只是不进入训练。主要原因：${warningSummary(cleanManifest?.warningCounts)}。`}
          />
          <InventoryRow
            title="当前训练后生成图"
            status={translateStatus(v17Diagnosis?.status ?? v16Diagnosis?.status ?? v15Diagnosis?.status ?? v14Diagnosis?.status)}
            detail={`最新为 V17 来源专家合成。displayAllowed=${String(v17Diagnosis?.displayAllowed ?? false)}，当前只是训练候选，不会直接进入 /world。`}
          />
        </div>
      </section>

      <section className={styles.panel}>
        <p className={styles.kicker}>MODEL OUTPUT</p>
        <h2>训练后生成结果</h2>
        <div className={styles.qualityList}>
          <InventoryRow
            title="V17 生成图 generated.png"
            status={formatFile(v17OutputFiles[0])}
            detail={v17Latest?.generated ?? `${v17InferenceRoot}/generated.png`}
          />
          <InventoryRow
            title="V17 对照图 contact-sheet.png"
            status={formatFile(v17OutputFiles[1])}
            detail={v17Latest?.contactSheet ?? `${v17InferenceRoot}/contact-sheet.png`}
          />
          <InventoryRow
            title="V17 训练摘要"
            status={formatFile(v17OutputFiles[2])}
            detail={`${v17TrainingRoot}/training-summary.json`}
          />
          <InventoryRow
            title="V17 诊断报告"
            status={formatFile(v17OutputFiles[3])}
            detail={`${v17DiagnosisRoot}/report.json`}
          />
          <InventoryRow
            title="V16 上一轮失败对照图"
            status={formatFile(v16OutputFiles[1])}
            detail={v16Latest?.contactSheet ?? `${v16InferenceRoot}/contact-sheet.png`}
          />
          <InventoryRow
            title="V15 上一轮失败对照图"
            status={formatFile(v15OutputFiles[1])}
            detail={v15Latest?.contactSheet ?? `${v15InferenceRoot}/contact-sheet.png`}
          />
          <InventoryRow
            title="V14 候选对照图"
            status={formatFile(v14OutputFiles[1])}
            detail={v14Latest?.contactSheet ?? `${v14InferenceRoot}/contact-sheet.png`}
          />
        </div>
        <p>
          V17 当前指标：MAE {formatNumber(v17Diagnosis?.metrics?.comparison?.mae)}，PSNR{" "}
          {formatNumber(v17Diagnosis?.metrics?.comparison?.psnr)}，锐度比{" "}
          {formatNumber(v17Diagnosis?.metrics?.sharpnessRatio)}，边缘密度比{" "}
          {formatNumber(v17Diagnosis?.metrics?.edgeDensityRatio)}。
        </p>
        {v17OutputFiles[1].exists ? (
          <img src="/api/ai-painter/natural-home/localDetailV17SourceExpertCompose" alt="V17 来源专家合成结果" />
        ) : null}
      </section>

      <section className={styles.panel}>
        <p className={styles.kicker}>CATEGORY ROUTE</p>
        <h2>V14 使用的局部模型</h2>
        <div className={styles.qualityList}>
          {(v14Latest?.categories ?? []).map((item) => (
            <InventoryRow
              key={item.category}
              title={categoryName(item.category)}
              status={`${item.patchCount ?? 0} 个 patch`}
              detail={`epoch ${item.epoch ?? "--"}，step ${item.step ?? "--"}，loss ${formatNumber(item.loss)}。`}
            />
          ))}
        </div>
      </section>

      <section className={styles.panel}>
        <p className={styles.kicker}>TRAINABLE SAMPLE LIST</p>
        <h2>可训练样本明细</h2>
        <p>
          下面只展示前 {visibleRows.length} 条，完整清单来自 clean dataset manifest。每条样本应包含 target.png、blueprint.v1.json 和 14 通道 masks_v1。
        </p>
        <div className={styles.qualityList}>
          {visibleRows.map((row) => (
            <InventoryRow
              key={row.sampleId}
              title={row.sampleId}
              status={`${row.status} / ${row.split}`}
              detail={`target ${formatFile(row.target)}；blueprint ${formatFile(row.blueprint)}；mask ${row.maskCount}/14；${row.warningText}`}
            />
          ))}
        </div>
      </section>

      <section className={styles.panel}>
        <p className={styles.kicker}>NEXT STEP</p>
        <h2>下一步该做什么</h2>
        <p>
          数据清单已经说明：当前不是只有一张训练图，而是已有 82 张清洁自然家园样本。下一步应基于这批清洁数据做多源训练，
          同时保留所有失败生成结果，继续禁止未审核图片进入正式世界。
        </p>
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

function InventoryRow(props: { title: string; status: string; detail: string }) {
  return (
    <article>
      <strong>{props.title}</strong>
      <span>{props.status}</span>
      <small>{props.detail}</small>
    </article>
  )
}

async function buildSampleRows(manifest: DatasetManifest | null, quarantine: QuarantineReport | null): Promise<SampleRow[]> {
  const sampleIds = manifest?.sampleIds ?? []
  const trainIds = await readStringSet(`${cleanDatasetRoot}/indexes/train.json`)
  const validationIds = await readStringSet(`${cleanDatasetRoot}/indexes/validation.json`)
  const blocked = new Map((quarantine?.blockedSamples ?? []).map((item) => [item.sampleId, item]))

  return Promise.all(
    sampleIds.map(async (sampleId) => {
      const root = `${cleanDatasetRoot}/accepted/dataset_v0/scene/world/${sampleId}`
      const [target, blueprint, maskCount] = await Promise.all([
        fileStatus(`${root}/target.png`),
        fileStatus(`${root}/blueprint.v1.json`),
        countMasks(`${root}/masks_v1`),
      ])
      const blockedItem = blocked.get(sampleId)
      const hasRequiredFiles = target.exists && blueprint.exists && maskCount === 14
      return {
        sampleId,
        split: trainIds.has(sampleId) ? "训练" : validationIds.has(sampleId) ? "验证" : "未进入索引",
        target,
        blueprint,
        maskCount,
        status: blockedItem ? "隔离" : hasRequiredFiles ? "可训练" : "缺文件",
        warningText: blockedItem ? `隔离原因：${translateWarnings(blockedItem.warnings)}` : "无隔离原因",
      }
    }),
  )
}

async function readStringSet(file: string) {
  const value = await readJson<unknown>(file)
  if (Array.isArray(value)) return new Set(value.filter((item): item is string => typeof item === "string"))
  if (value && typeof value === "object" && Array.isArray((value as { sampleIds?: unknown }).sampleIds)) {
    return new Set((value as { sampleIds: unknown[] }).sampleIds.filter((item): item is string => typeof item === "string"))
  }
  return new Set<string>()
}

async function countMasks(directory: string) {
  try {
    const entries = await readdir(abs(directory), { withFileTypes: true })
    return entries.filter((entry) => entry.isFile() && entry.name.endsWith(".png")).length
  } catch {
    return 0
  }
}

async function fileStatus(file: string): Promise<FileStatus> {
  try {
    const info = await stat(abs(file))
    return {
      exists: true,
      sizeKiB: Math.round(info.size / 1024),
      modifiedAt: formatDate(info.mtime),
    }
  } catch {
    return { exists: false }
  }
}

async function readJson<T>(file: string): Promise<T | null> {
  try {
    return JSON.parse(await readFile(abs(file), "utf8")) as T
  } catch {
    return null
  }
}

function abs(file: string) {
  return path.join(/* turbopackIgnore: true */ process.cwd(), file)
}

function formatFile(file: FileStatus) {
  if (!file.exists) return "不存在"
  return `${file.sizeKiB ?? 0} KiB / ${file.modifiedAt ?? "--"}`
}

function formatDate(date: Date) {
  return new Intl.DateTimeFormat("zh-CN", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  }).format(date)
}

function formatNumber(value?: number) {
  return typeof value === "number" && Number.isFinite(value) ? value.toFixed(4) : "--"
}

function warningSummary(warnings?: Record<string, number>) {
  if (!warnings || !Object.keys(warnings).length) return "无"
  return Object.entries(warnings)
    .map(([key, count]) => `${translateWarning(key)} ${count} 张`)
    .join("；")
}

function translateWarnings(warnings?: string[]) {
  if (!warnings?.length) return "无"
  return warnings.map(translateWarning).join("；")
}

function translateWarning(code: string) {
  const labels: Record<string, string> = {
    target_contrast_too_low: "对比度过低",
    target_edge_density_too_low: "边缘密度过低",
    target_too_blurry: "目标图过模糊",
    target_color_range_too_low: "颜色范围过低",
  }
  return labels[code] ?? code
}

function translateStatus(status?: string) {
  const labels: Record<string, string> = {
    completed: "已完成",
    failed: "未通过",
    pass_candidate: "候选通过",
  }
  return labels[status ?? ""] ?? "未知"
}

function categoryName(category: string) {
  const labels: Record<string, string> = {
    grass: "草地区域",
    water: "水体内部",
    shoreline: "水岸过渡",
    road: "自然道路",
    tree: "树木",
    rock: "岩石",
  }
  return labels[category] ?? category
}
