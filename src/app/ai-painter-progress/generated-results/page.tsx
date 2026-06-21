import { readdir, readFile, stat } from "node:fs/promises"
import path from "node:path"
import type { Metadata } from "next"
import Link from "next/link"
import { buildTrainingQualityGateReport, type TrainingQualityGateReport } from "@/server/ai-painter-training-quality-gate"
import styles from "../detail.module.css"

export const dynamic = "force-dynamic"

export const metadata: Metadata = {
  title: "训练后生成结果 | AI-PET-WORLD",
}

type ReviewStatus = "failed" | "candidate" | "approved"

type GeneratedResult = {
  id?: string
  stage: string
  title: string
  view: string
  imageUrl?: string
  file: string
  summaryFile?: string
  diagnosisFile?: string
  qualityGateFile?: string
  description: string
  reviewStatus: ReviewStatus
}

type FileMeta = {
  modifiedAt: string
  sizeKiB: number
}

type TrainingSummary = {
  status?: string
  trainingVersion?: string
  modelVersion?: string
  epochs?: number
  steps?: number
  bestValidationLoss?: number
  bestSelectionLoss?: number
  bestStructureIoU?: number
  parameterCount?: number
  sourceCount?: number
  rows?: Array<{
    sourceId?: string
    diagnosisStatus?: string
    mae?: number
    psnr?: number
    sharpnessRatio?: number
    edgeDensityRatio?: number
    trainSampleCount?: number
    validationSampleCount?: number
  }>
  resourceEstimate?: {
    source?: string
    totalExpertTrainingSeconds?: number
    estimatedPowerWatts?: number
    estimatedKwh?: number
    estimatedCny?: number
    cnyPerKwh?: number
    externalApiTokens?: number
    externalApiCostCny?: number
    localComputeTokenEstimate?: number
    note?: string
  }
  qualityGate?: TrainingQualityGateReport
}

type DiagnosisReport = {
  status?: string
  displayAllowed?: boolean
  metrics?: {
    mae?: number
    psnr?: number
    sharpnessRatio?: number
    edgeDensityRatio?: number
    comparison?: { mae?: number; psnr?: number }
  }
  failures?: Array<{ code: string; severity?: string; message?: string }>
}

type ApprovedFrameRecord = {
  worldId?: string
  tick?: number
  savedAt?: string
  canShowToPlayer?: boolean
  approvedFrame?: {
    frameId?: string
    reviewScore?: number
    imageUrl?: string
    sourceImageSha256?: string
    sourceImageByteLength?: number
    vj0Status?: string
    vj1Status?: string
    vj2Status?: string
    approvalScope?: string
    approvedForProduction?: boolean
  }
}

type ApprovedFrameIndex = {
  path?: string
  updatedAt?: string
}

type ArchivedGeneratedResult = {
  id: string
  stage: string
  title: string
  description: string
  reviewStatus: ReviewStatus
  imageFile: string
  summaryFile: string
  diagnosisFile: string
  qualityGateFile?: string
}

const generatedResults: GeneratedResult[] = [
  {
    stage: "V29 / DIVERSE SOURCE REFINER",
    title: "自然家园 V29 跨源候选推理",
    view: "naturalHomeV29DiverseSourceRefinerGeneration",
    file: ".runtime/ai-painter/natural-home-v29-diverse-source-refiner-generation/contact-sheet.png",
    summaryFile: ".runtime/ai-painter/natural-home-v29-diverse-source-refiner-generation/latest.json",
    diagnosisFile: ".runtime/ai-painter/natural-home-v29-diverse-source-refiner-generation/latest.json",
    description:
      "使用 V28 已训练好的结构模型和 RGB refiner，从真实 Mask 重组数据集中跨多个源场景抽样生成候选图。目标是验证模型能否输出多种自然家园，而不是只围绕单个训练样本变化。当前仍是隐藏候选，必须经过 VisualJudge 后才可能进入 /world。",
    reviewStatus: "failed",
  },
  {
    stage: "V28 / REAL MASK REMIX REFINER",
    title: "自然家园 V28 真实 Mask 重组推理",
    view: "naturalHomeV28DiversityRefinerGeneration",
    file: ".runtime/ai-painter/natural-home-v28-diversity-refiner-generation/contact-sheet.png",
    summaryFile: ".runtime/ai-painter/natural-home-v28-diversity-refiner-generation/latest.json",
    diagnosisFile: ".runtime/ai-painter/natural-home-v28-diversity-refiner-generation/latest.json",
    description:
      "用真实 accepted 样本的 target.png 与 14 通道 masks_v1 同步重组训练；目标是让本地小模型学习多种自然家园结构，而不是贴着单一样本或简单程序结构变化。当前仍需 VisualJudge，未进入 /world。",
    reviewStatus: "failed",
  },
  {
    stage: "V27 / AUGMENTED DIVERSITY REFINER",
    title: "自然家园 V27 增强泛化推理",
    view: "naturalHomeV27DiversityRefinerGeneration",
    file: ".runtime/ai-painter/natural-home-v27-diversity-refiner-generation/contact-sheet.png",
    summaryFile: ".runtime/ai-painter/natural-home-v27-diversity-refiner-generation/latest.json",
    diagnosisFile: ".runtime/ai-painter/natural-home-v27-diversity-refiner-generation/latest.json",
    description:
      "用 328 张同源增强监督样本训练 V27 结构模型与 RGB refiner，再对自动生成的多种自然家园结构进行推理。当前仍需 VisualJudge，未进入 /world。",
    reviewStatus: "failed",
  },
  {
    stage: "V26 / FULL SCENE REFINER",
    title: "自然家园 V26 全图 Refiner 候选",
    view: "naturalHomeV26DiversityRefinerGeneration",
    file: ".runtime/ai-painter/natural-home-v26-diversity-refiner-generation/contact-sheet.png",
    summaryFile: ".runtime/ai-painter/natural-home-v26-diversity-refiner-generation/latest.json",
    diagnosisFile: ".runtime/ai-painter/natural-home-v26-diversity-refiner-generation/latest.json",
    description:
      "把 V25 自动生成的结构条件交给全图结构模型与 RGB refiner 推理。证明链路可跑通，但画面偏灰偏糊，不能进入正式世界。",
    reviewStatus: "failed",
  },
  {
    stage: "V25 / DIVERSITY GENERALIZATION",
    title: "自然家园 v25 多样泛化训练",
    view: "naturalHomeV25DiversityGeneration",
    file: ".runtime/ai-painter/natural-home-v25-diversity-generation/contact-sheet.png",
    summaryFile: ".runtime/ai-painter/natural-home-v25-diversity-generation/latest.json",
    diagnosisFile: ".runtime/ai-painter/natural-home-v25-diversity-generation/latest.json",
    description:
      "多样自然家园泛化实验。训练不绑定固定 source/coord 的本地自然家园小模型，再对自动生成的自然家园结构条件进行推理；仍需 VisualJudge，不直接进入 /world。",
    reviewStatus: "failed",
  },
  {
    stage: "V24 / DIVERSITY GENERATION",
    title: "自然家园 v24 多样候选生成",
    view: "naturalHomeV24DiversityGeneration",
    file: ".runtime/ai-painter/natural-home-v24-diversity-generation/contact-sheet.png",
    summaryFile: ".runtime/ai-painter/natural-home-v24-diversity-generation/latest.json",
    diagnosisFile: ".runtime/ai-painter/natural-home-v24-diversity-generation/latest.json",
    description:
      "当前多样化实验主线。后端自动生成多套自然家园结构条件和 14 通道 Mask，再调用本地 V23 小模型专家生成多张候选图；仍然只是候选训练证据，不直接进入 /world。",
    reviewStatus: "failed",
  },
  {
    stage: "V23 / CANDIDATE CONSOLIDATION",
    title: "自然家园 v23 候选整合",
    view: "localDetailV23CandidateConsolidation",
    file: ".runtime/ai-painter/natural-home-local-detail-v23-candidate-consolidation/contact-sheet.png",
    summaryFile: ".runtime/ai-painter/natural-home-local-detail-v23-candidate-consolidation/latest.json",
    diagnosisFile: ".runtime/ai-painter/natural-home-local-detail-v23-candidate-consolidation/latest.json",
    description:
      "整合 V20 多源和 V22 弱项强化方向，继续训练纯自然家园静态画面；只是候选训练证据，不直接进入 /world。",
    reviewStatus: "candidate",
  },
  {
    stage: "V22 / WARNING SOURCE FOCUS",
    title: "自然家园 v22 警告源强化",
    view: "localDetailV22WarningFocus",
    file: ".runtime/ai-painter/natural-home-local-detail-v22-warning-focus/contact-sheet.png",
    summaryFile: ".runtime/ai-painter/natural-home-local-detail-v22-warning-focus/latest.json",
    diagnosisFile: ".runtime/ai-painter/natural-home-local-detail-v22-warning-focus/latest.json",
    description:
      "针对 V20 中较弱的自然源继续训练，重点观察水岸与森林溪流表现；只是候选训练证据，不直接进入 /world。",
    reviewStatus: "candidate",
  },
  {
    stage: "V20 / MULTISOURCE GENERALIZATION",
    title: "自然家园 v20 多源泛化",
    view: "localDetailV20MultisourceGeneralization",
    file: ".runtime/ai-painter/natural-home-local-detail-v20-multisource-generalization/contact-sheet.png",
    summaryFile: ".runtime/ai-painter/natural-home-local-detail-v20-multisource-generalization/latest.json",
    diagnosisFile: ".runtime/ai-painter/natural-home-local-detail-v20-multisource-generalization/latest.json",
    description:
      "下一轮主线。使用多个自然源进行泛化训练，让模型学习自然家园类型，而不是只记住单一来源；仍然只是候选训练证据，不直接进入 /world。",
    reviewStatus: "candidate",
  },
  {
    stage: "V19 / PROMOTED SOURCE EXPERT",
    title: "自然家园 v19 晋级源强化",
    view: "localDetailV19PromotedSource",
    file: ".runtime/ai-painter/natural-home-local-detail-v19-promoted-source/contact-sheet.png",
    summaryFile: ".runtime/ai-painter/natural-home-local-detail-v19-promoted-source/latest.json",
    diagnosisFile: ".runtime/ai-painter/natural-home-local-detail-v19-promoted-source/latest.json",
    description:
      "当前最新路线。使用 V18 自动筛出的最佳自然源继续强化训练，提升纯自然世界细节；仍然只是候选训练证据，不直接进入 /world。",
    reviewStatus: "candidate",
  },
  {
    stage: "V18 / SOURCE EXPERT BANK",
    title: "自然家园 v18 多源专家银行",
    view: "localDetailV18SourceExpertBank",
    file: ".runtime/ai-painter/natural-home-local-detail-v18-source-expert-bank/contact-sheet.png",
    summaryFile: ".runtime/ai-painter/natural-home-local-detail-v18-source-expert-bank/latest.json",
    diagnosisFile: ".runtime/ai-painter/natural-home-local-detail-v18-source-expert-bank/latest.json",
    description:
      "当前最新路线。三个自然源分别训练局部专家，再各自组合整图；不把多源直接混成一锅，避免平均化和发糊。",
    reviewStatus: "candidate",
  },
  {
    stage: "V17 / SINGLE SOURCE EXPERT",
    title: "自然家园 v17 单源专家合成",
    view: "localDetailV17SourceExpertCompose",
    file: ".runtime/ai-painter/natural-home-local-detail-v17-source-expert-compose-inference/contact-sheet.png",
    summaryFile: ".runtime/ai-painter/natural-home-local-detail-v17-source-expert-compose-training/training-summary.json",
    diagnosisFile: ".runtime/ai-painter/natural-home-local-detail-v17-source-expert-compose-diagnosis/report.json",
    description:
      "上一轮可用候选。它证明本地小模型可以在一个可信自然源上学出清晰像素表达，并已接入隐藏 Candidate 与 ApprovedFrame 链路。",
    reviewStatus: "candidate",
  },
  {
    stage: "V16 / STYLE MULTISOURCE",
    title: "自然家园 v16 多源风格约束",
    view: "localDetailV16StyleMultisourceCompose",
    file: ".runtime/ai-painter/natural-home-local-detail-v16-style-multisource-compose-inference/contact-sheet.png",
    summaryFile: ".runtime/ai-painter/natural-home-local-detail-v16-style-multisource-compose-training/training-summary.json",
    diagnosisFile: ".runtime/ai-painter/natural-home-local-detail-v16-style-multisource-compose-diagnosis/report.json",
    description: "失败对照。多源直接训练仍有平均化问题，保留用于判断路线是否退步，不进入正式世界。",
    reviewStatus: "failed",
  },
  {
    stage: "V15 / MULTISOURCE COMPOSE",
    title: "自然家园 v15 多源合成",
    view: "localDetailV15MultisourceCompose",
    file: ".runtime/ai-painter/natural-home-local-detail-v15-multisource-compose-inference/contact-sheet.png",
    summaryFile: ".runtime/ai-painter/natural-home-local-detail-v15-multisource-compose-training/training-summary.json",
    diagnosisFile: ".runtime/ai-painter/natural-home-local-detail-v15-multisource-compose-diagnosis/report.json",
    description: "失败对照。它说明不能把多源样本粗暴混训后直接期待高质量整图。",
    reviewStatus: "failed",
  },
  {
    stage: "V14 / SINGLE SOURCE COMPOSE",
    title: "自然家园 v14 单源合成",
    view: "localDetailV14SingleSourceCompose",
    file: ".runtime/ai-painter/natural-home-local-detail-v14-single-source-compose-inference/contact-sheet.png",
    summaryFile: ".runtime/ai-painter/natural-home-local-detail-v14-single-source-compose-training/training-summary.json",
    diagnosisFile: ".runtime/ai-painter/natural-home-local-detail-v14-single-source-compose-diagnosis/report.json",
    description: "早期单源专家路线，保留为 V17/V18 的历史参照。",
    reviewStatus: "candidate",
  },
]

export default async function GeneratedResultsPage() {
  const archivedResults = await readArchivedGeneratedResults()
  const allGeneratedResults = mergeGeneratedResults(archivedResults, generatedResults)
  const [results, approvedRecord] = await Promise.all([
    Promise.all(allGeneratedResults.map(readResult)),
    readLatestApprovedFrameRecord(),
  ])
  const existingResults = results.filter((result) => result.meta)
  const failedCount = existingResults.filter((result) => result.reviewStatus === "failed").length
  const candidateCount = existingResults.filter((result) => result.reviewStatus === "candidate").length
  const approvedCount = approvedRecord?.approvedFrame?.imageUrl ? 1 : 0

  return (
    <main className={styles.page}>
      <header className={styles.header}>
        <Link className={styles.back} href="/ai-painter-progress">
          返回训练主页
        </Link>
        <p className={styles.kicker}>MODEL GENERATED OUTPUT HISTORY</p>
        <h1>训练后生成结果</h1>
        <p>
          这里专门保留本地小模型推理后的 PNG、诊断指标、失败记录和 ApprovedFrame。原稿、结构草图、Mask
          调试图不放在这里，避免和真正训练后的内容混在一起。
        </p>
        <dl className={styles.metrics}>
          <Metric label="已记录推理结果" value={`${existingResults.length} 张`} />
          <Metric label="失败记录" value={`${failedCount} 张`} />
          <Metric label="候选记录" value={`${candidateCount} 张`} />
          <Metric label="ApprovedFrame" value={`${approvedCount} 张`} />
        </dl>
      </header>

      {approvedRecord?.approvedFrame?.imageUrl ? (
        <section className={styles.resultGrid}>
          <article className={styles.resultCard}>
            <span className={styles.pass}>已进入受控 MVP ApprovedFrame</span>
            <p className={styles.kicker}>FORMAL APPROVED FRAME</p>
            <h2>当前 /world 可读取画面</h2>
            <p>
              这是隐藏 Candidate 通过闸门后生成的 ApprovedFrame。它允许在开发环境进入 /world，但仍不是生产批准。
            </p>
            <p>
              生成时间：<strong>{formatDateValue(approvedRecord.savedAt)}</strong>
              <br />
              worldId：<code>{approvedRecord.worldId ?? "--"}</code>
              <br />
              tick：<strong>{approvedRecord.tick ?? "--"}</strong>
              <br />
              reviewScore：<strong>{approvedRecord.approvedFrame.reviewScore ?? "--"}</strong>
              <br />
              SHA：<code>{approvedRecord.approvedFrame.sourceImageSha256?.slice(0, 16) ?? "--"}</code>
              <br />
              字节数：<strong>{formatInteger(approvedRecord.approvedFrame.sourceImageByteLength)}</strong>
            </p>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={approvedRecord.approvedFrame.imageUrl} alt="当前 ApprovedFrame" />
          </article>
        </section>
      ) : null}

      <section className={styles.resultGrid}>
        {results.map((result) => (
          <article className={styles.resultCard} key={result.file}>
            <span className={result.reviewStatus === "failed" ? styles.fail : styles.pass}>{statusLabel(result)}</span>
            <p className={styles.kicker}>{result.stage}</p>
            <h2>{result.title}</h2>
            <p>{result.description}</p>
            <p>
              生成时间：<strong>{result.meta?.modifiedAt ?? "文件不存在"}</strong>
              <br />
              文件位置：<code>{result.file}</code>
              <br />
              文件大小：<strong>{result.meta ? `${result.meta.sizeKiB} KiB` : "--"}</strong>
            </p>
            <ResultMetrics summary={result.summary} diagnosis={result.diagnosis} />
            <TrainingQualityGate qualityGate={result.qualityGate} />
            <ResourceEstimate summary={result.summary} />
            <PromotionDecision summary={result.summary} />
            <SourceRows summary={result.summary} />
            <FailureList diagnosis={result.diagnosis} />
            {result.meta ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={result.imageUrl ?? `/api/ai-painter/natural-home/${result.view}`} alt={result.title} />
            ) : null}
          </article>
        ))}
      </section>

      <section className={styles.panel}>
        <h2>记录规则</h2>
        <p>
          训练后生成图必须留档：通过的保留，失败的也保留。失败记录用于判断训练路线有没有退步，但不会进入
          /world，也不会被标记为正式世界画面。
        </p>
        <p>正式世界只读 ApprovedFrame。Candidate、训练输出、调试图、原稿图都不能绕过 VisualJudge。</p>
      </section>
    </main>
  )
}

async function readArchivedGeneratedResults(): Promise<GeneratedResult[]> {
  const index = await readGeneratedResultsIndex()
  return index.results.map((result) => ({
    id: result.id,
    stage: result.stage,
    title: result.title,
    view: result.id,
    imageUrl: `/api/ai-painter/generated-results/${result.id}/image`,
    file: result.imageFile,
    summaryFile: result.summaryFile,
    diagnosisFile: result.diagnosisFile,
    qualityGateFile: result.qualityGateFile,
    description: result.description,
    reviewStatus: result.reviewStatus,
  }))
}

async function readGeneratedResultsIndex(): Promise<{ results: ArchivedGeneratedResult[] }> {
  try {
    const file = path.join(
      /* turbopackIgnore: true */ process.cwd(),
      ".runtime",
      "ai-painter",
      "generated-results",
      "index.json",
    )
    const parsed = JSON.parse(await readFile(/* turbopackIgnore: true */ file, "utf8")) as {
      results?: ArchivedGeneratedResult[]
    }
    return { results: Array.isArray(parsed.results) ? parsed.results : [] }
  } catch {
    return { results: [] }
  }
}

function mergeGeneratedResults(archived: GeneratedResult[], fallback: GeneratedResult[]) {
  const seen = new Set<string>()
  const merged: GeneratedResult[] = []
  for (const result of [...archived, ...fallback]) {
    const key = normalizePathKey(result.file)
    if (seen.has(key)) continue
    seen.add(key)
    merged.push(result)
  }
  return merged
}

function normalizePathKey(value: string) {
  return value.replace(/\\/g, "/").toLowerCase()
}

async function readResult(result: GeneratedResult) {
  const [meta, summary, diagnosis, storedQualityGate] = await Promise.all([
    readFileMeta(result.file),
    result.summaryFile ? readJson<TrainingSummary>(result.summaryFile) : Promise.resolve(null),
    result.diagnosisFile ? readJson<DiagnosisReport>(result.diagnosisFile) : Promise.resolve(null),
    result.qualityGateFile ? readJson<TrainingQualityGateReport>(result.qualityGateFile) : Promise.resolve(null),
  ])
  const qualityGate = storedQualityGate ?? summary?.qualityGate ?? (summary ? buildTrainingQualityGateReport(summary) : null)
  return { ...result, meta, summary, diagnosis, qualityGate }
}

function Metric(props: { label: string; value: string }) {
  return (
    <div>
      <dt>{props.label}</dt>
      <dd>{props.value}</dd>
    </div>
  )
}

function ResultMetrics(props: { summary: TrainingSummary | null; diagnosis: DiagnosisReport | null }) {
  const comparison = props.diagnosis?.metrics?.comparison
  const mae = props.diagnosis?.metrics?.mae ?? comparison?.mae
  const psnr = props.diagnosis?.metrics?.psnr ?? comparison?.psnr
  return (
    <p>
      模型：<strong>{props.summary?.modelVersion ?? props.summary?.trainingVersion ?? "--"}</strong>
      <br />
      Epoch / Step：<strong>{props.summary?.epochs ?? "--"} / {props.summary?.steps ?? "--"}</strong>
      <br />
      参数量：<strong>{formatInteger(props.summary?.parameterCount)}</strong>
      <br />
      验证损失：<strong>{formatNumber(props.summary?.bestValidationLoss ?? props.summary?.bestSelectionLoss)}</strong>
      <br />
      结构 IoU：<strong>{formatNumber(props.summary?.bestStructureIoU)}</strong>
      <br />
      锐度比：<strong>{formatNumber(props.diagnosis?.metrics?.sharpnessRatio)}</strong>
      <br />
      边缘密度比：<strong>{formatNumber(props.diagnosis?.metrics?.edgeDensityRatio)}</strong>
      <br />
      MAE / PSNR：<strong>{formatNumber(mae)} / {formatNumber(psnr)}</strong>
    </p>
  )
}

function TrainingQualityGate(props: { qualityGate: TrainingQualityGateReport | null }) {
  const gate = props.qualityGate
  if (!gate) return <p>V21 训练质量门：<strong>暂无记录</strong></p>
  return (
    <p>
      V21 训练质量门：<strong>{qualityGateStatusLabel(gate.status)}</strong>
      <br />
      总分：<strong>{formatNumber(gate.overallScore, 2)}</strong>
      <br />
      下一轮训练：<strong>{gate.canEnterNextTraining ? "允许作为候选依据" : "禁止继续沿用，保留失败记录"}</strong>
      <br />
      世界展示：<strong>{gate.canPromoteToWorld ? "允许" : "禁止，仍必须经过 Candidate / VisualJudge / ApprovedFrame"}</strong>
      <br />
      来源明细：
      <br />
      {gate.rows
        .map((row) => `${row.sourceId}: ${qualityRowStatusLabel(row.status)} / ${formatNumber(row.score, 2)} / ${row.reasons.join("、")}`)
        .join("；")}
    </p>
  )
}

function ResourceEstimate(props: { summary: TrainingSummary | null }) {
  const estimate = props.summary?.resourceEstimate
  if (!estimate) return null
  return (
    <p>
      资源估算：<strong>{formatNumber(estimate.totalExpertTrainingSeconds)} 秒</strong>
      <br />
      功耗口径：<strong>{formatNumber(estimate.estimatedPowerWatts)} W</strong>
      <br />
      电量 / 电费：<strong>{formatNumber(estimate.estimatedKwh, 6)} kWh / {formatNumber(estimate.estimatedCny, 4)} 元</strong>
      <br />
      Token：<strong>外部 API {estimate.externalApiTokens ?? 0} / 本地计算 {formatInteger(estimate.localComputeTokenEstimate)}</strong>
      <br />
      口径：<strong>{estimate.source === "training_log_derived_estimate_no_sampler" ? "训练日志推导估算" : estimate.source ?? "--"}</strong>
    </p>
  )
}

function qualityGateStatusLabel(status: TrainingQualityGateReport["status"]) {
  if (status === "passed_for_next_training") return "通过，可作为下一轮训练依据"
  if (status === "warning_keep_candidate") return "警告，保留候选但需要观察"
  return "失败，只保留历史记录"
}

function qualityRowStatusLabel(status: TrainingQualityGateReport["rows"][number]["status"]) {
  if (status === "passed") return "通过"
  if (status === "warning") return "警告"
  return "失败"
}

function PromotionDecision(props: { summary: TrainingSummary | null }) {
  const rows = props.summary?.rows ?? []
  if (!rows.length) return null
  const ranked = rows
    .map((row) => {
      const maeScore = typeof row.mae === "number" ? Math.max(0, 1 - row.mae / 0.06) : 0
      const sharpnessScore = typeof row.sharpnessRatio === "number" ? Math.min(row.sharpnessRatio, 1) : 0
      const edgeScore = typeof row.edgeDensityRatio === "number" ? Math.min(row.edgeDensityRatio, 1) : 0
      const passBonus = row.diagnosisStatus === "pass_candidate" ? 0.2 : 0
      return { row, score: maeScore * 0.45 + sharpnessScore * 0.25 + edgeScore * 0.25 + passBonus }
    })
    .sort((left, right) => right.score - left.score)
  const best = ranked[0]
  if (!best) return null
  return (
    <p>
      晋级判断：
      <strong>
        {best.row.sourceId ?? "--"}，评分 {formatNumber(best.score)}
      </strong>
      <br />
      结论：<strong>可作为下一轮训练参考，但不能直接进入 /world；正式展示仍必须生成 Candidate、通过 VisualJudge，再写入 ApprovedFrame。</strong>
    </p>
  )
}

function SourceRows(props: { summary: TrainingSummary | null }) {
  const rows = props.summary?.rows ?? []
  if (!rows.length) return null
  return (
    <p>
      多源结果：
      <br />
      {rows
        .map(
          (row) =>
            `${row.sourceId}: ${row.diagnosisStatus}, MAE ${formatNumber(row.mae)}, 锐度 ${formatNumber(
              row.sharpnessRatio,
            )}, 边缘 ${formatNumber(row.edgeDensityRatio)}`,
        )
        .join("；")}
    </p>
  )
}

function FailureList(props: { diagnosis: DiagnosisReport | null }) {
  const failures = props.diagnosis?.failures ?? []
  if (!props.diagnosis) return <p>诊断：<strong>暂无诊断文件</strong></p>
  if (!failures.length) return <p>诊断：<strong>未发现硬失败，仍需通过正式链路确认。</strong></p>
  return (
    <p>
      失败原因：
      <br />
      {failures.map((failure) => `${failure.code}: ${failure.message ?? failure.severity ?? "未说明"}`).join("；")}
    </p>
  )
}

function statusLabel(result: { reviewStatus: ReviewStatus; diagnosis: DiagnosisReport | null }) {
  if (result.reviewStatus === "approved") return "正式 ApprovedFrame"
  if (result.reviewStatus === "candidate") return "候选通过，不直接进世界"
  if (result.diagnosis?.displayAllowed) return "诊断允许，但仍需 ApprovedFrame"
  return "未通过，不进正式世界"
}

async function readLatestApprovedFrameRecord(): Promise<ApprovedFrameRecord | null> {
  const indexFiles = await findFiles(
    path.join(/* turbopackIgnore: true */ process.cwd(), "data", "world-approved-frames"),
    "latest-approved-frame.json",
  )
  const records = await Promise.all(
    indexFiles.map(async (indexFile) => {
      const index = await readAbsoluteJson<ApprovedFrameIndex>(indexFile)
      if (!index?.path) return null
      const recordPath = path.isAbsolute(index.path)
        ? index.path
        : path.join(/* turbopackIgnore: true */ process.cwd(), index.path)
      const record = await readAbsoluteJson<ApprovedFrameRecord>(recordPath)
      const meta = await readAbsoluteFileMeta(recordPath)
      if (!record || !meta) return null
      return { record, updatedAt: index.updatedAt ?? meta.modifiedAt }
    }),
  )

  return records
    .filter((entry): entry is { record: ApprovedFrameRecord; updatedAt: string } => Boolean(entry))
    .sort((left, right) => right.updatedAt.localeCompare(left.updatedAt))[0]?.record ?? null
}

async function findFiles(root: string, fileName: string): Promise<string[]> {
  try {
    const entries = await readdir(root, { withFileTypes: true })
    const children = await Promise.all(
      entries.map(async (entry) => {
        const fullPath = path.join(root, entry.name)
        if (entry.isDirectory()) return findFiles(fullPath, fileName)
        return entry.isFile() && entry.name === fileName ? [fullPath] : []
      }),
    )
    return children.flat()
  } catch {
    return []
  }
}

async function readJson<T>(file: string): Promise<T | null> {
  return readAbsoluteJson<T>(path.join(/* turbopackIgnore: true */ process.cwd(), file))
}

async function readAbsoluteJson<T>(file: string): Promise<T | null> {
  try {
    return JSON.parse(await readFile(file, "utf8")) as T
  } catch {
    return null
  }
}

async function readFileMeta(file: string): Promise<FileMeta | null> {
  return readAbsoluteFileMeta(path.join(/* turbopackIgnore: true */ process.cwd(), file))
}

async function readAbsoluteFileMeta(file: string): Promise<FileMeta | null> {
  try {
    const info = await stat(file)
    return {
      modifiedAt: formatDate(info.mtime),
      sizeKiB: Math.round(info.size / 1024),
    }
  } catch {
    return null
  }
}

function formatDateValue(value?: string) {
  if (!value) return "--"
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? value : formatDate(date)
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

function formatNumber(value?: number, digits = 4) {
  return typeof value === "number" && Number.isFinite(value) ? value.toFixed(digits) : "--"
}

function formatInteger(value?: number) {
  return typeof value === "number" && Number.isFinite(value) ? value.toLocaleString("zh-CN") : "--"
}
