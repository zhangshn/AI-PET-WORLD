import { readFile, stat } from "node:fs/promises"
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

type CandidateQualityGateReport = {
  schemaVersion?: string
  stageId?: string
  status?: string
  canShowToPlayer?: boolean
  rows?: Array<{
    sampleId?: string
    passed?: boolean
    quantizedColorCount?: number
    luminanceStdDev?: number
    edgeDensity?: number
    laplacianVariance?: number
    dominantColorRatio?: number
  }>
}

type GeneratedQualityGateReport = TrainingQualityGateReport | CandidateQualityGateReport

type GeneratedResult = {
  id?: string
  stage: string
  title: string
  view: string
  imageUrl?: string
  file: string
  sourceFile?: string
  summaryFile?: string
  diagnosisFile?: string
  qualityGateFile?: string
  rowArchiveDir?: string
  rowCount?: number
  rejectedRowCount?: number
  trainingStartedAt?: string
  trainingFinishedAt?: string | null
  trainingDurationSeconds?: number
  trainingDurationText?: string
  description: string
  reviewStatus: ReviewStatus
}

type FileMeta = {
  modifiedAt: string
  sizeKiB: number
}

type TrainingSummary = {
  status?: string
  stageId?: string
  trainingVersion?: string
  modelVersion?: string
  epochs?: number
  steps?: number
  bestValidationLoss?: number
  bestSelectionLoss?: number
  bestStructureIoU?: number
  parameterCount?: number
  rowCount?: number
  passedForNextTraining?: number
  rejectedTrainingCandidate?: number
  averageScore?: number
  bestScore?: number
  worstScore?: number
  resourceEstimate?: {
    trainingStartedAt?: string
    trainingFinishedAt?: string | null
    trainingDurationSeconds?: number
    trainingDurationText?: string
    startedAt?: string
    finishedAt?: string | null
    estimatedPowerWatts?: number
    estimatedKwh?: number
    estimatedCny?: number
    cnyPerKwh?: number
    externalApiTokens?: number
    externalApiCostCny?: number
    localComputeTokenEstimate?: number
    totalExpertTrainingSeconds?: number
    note?: string
  }
  qualityGate?: GeneratedQualityGateReport
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
  failures?: Array<{ code?: string; severity?: string; message?: string }>
}

type ApprovedFrameRecord = {
  worldId?: string
  tick?: number
  savedAt?: string
  approvedFrame?: {
    frameId?: string
    reviewScore?: number
    imageUrl?: string
    sourceImageSha256?: string
    sourceImageByteLength?: number
    approvedForProduction?: boolean
  }
}

type ArchivedGeneratedResult = {
  id: string
  stage: string
  title: string
  description: string
  reviewStatus: ReviewStatus
  imageFile: string
  sourceFile?: string
  summaryFile: string
  diagnosisFile: string
  qualityGateFile?: string
  rowArchiveDir?: string
  rowCount?: number
  rejectedRowCount?: number
  trainingStartedAt?: string
  trainingFinishedAt?: string | null
  trainingDurationSeconds?: number
  trainingDurationText?: string
}

const fallbackResults: GeneratedResult[] = [
  fallbackQuality("V91 / CURRENT MVP VJ-1 REVIEW", "Natural Home V91 current MVP VisualJudge review", "naturalHomeV91CurrentMvpVj1Review", ".runtime/ai-painter/natural-home-v91-current-mvp-vj1-review/contact-sheet.png", ".runtime/ai-painter/natural-home-v91-current-mvp-vj1-review/latest.json", ".runtime/ai-painter/natural-home-v91-current-mvp-vj1-review/review-report.json"),
  fallbackQuality("V91 / CURRENT MVP QUALITY SELECTION", "Natural Home V91 current MVP natural-only quality selection", "naturalHomeV91CurrentMvpQualitySelection", ".runtime/ai-painter/natural-home-v91-current-mvp-quality-selection/contact-sheet.png", ".runtime/ai-painter/natural-home-v91-current-mvp-quality-selection/latest.json", ".runtime/ai-painter/natural-home-v91-current-mvp-quality-selection/selection-report.json"),
  fallbackGeneration("V91 / CURRENT MVP GENERATION", "Natural Home V91 current MVP natural-only inference", "naturalHomeV91CurrentMvpGeneration", ".runtime/ai-painter/natural-home-v91-current-mvp-quality-ready-generation/contact-sheet.png", ".runtime/ai-painter/natural-home-v91-current-mvp-quality-ready-generation/latest.json"),
  fallbackQuality("V51 / SAFE CANDIDATE PACK", "Natural Home V51 strict safe candidate pack", "naturalHomeV51SafeCandidatePack", ".runtime/ai-painter/natural-home-v51-safe-candidate-pack/contact-sheet.png", ".runtime/ai-painter/natural-home-v51-safe-candidate-pack/latest.json", ".runtime/ai-painter/natural-home-v51-safe-candidate-pack/safe-candidate-pack.json"),
  fallbackQuality("V50 / DIVERSITY WATER GATE", "Natural Home V50 diversity coverage and water-artifact gate", "naturalHomeV50DiversityWaterGate", ".runtime/ai-painter/natural-home-v50-diversity-water-gate/contact-sheet.png", ".runtime/ai-painter/natural-home-v50-diversity-water-gate/latest.json", ".runtime/ai-painter/natural-home-v50-diversity-water-gate/diversity-report.json"),
  fallbackQuality("V49 / V32 DIVERSITY SWEEP QUALITY", "Natural Home V49 V32 diversity sweep quality selection", "naturalHomeV49QualitySelection", ".runtime/ai-painter/natural-home-v49-quality-selection/contact-sheet.png", ".runtime/ai-painter/natural-home-v49-quality-selection/latest.json", ".runtime/ai-painter/natural-home-v49-quality-selection/selection-report.json"),
  fallbackGeneration("V49 / V32 DIVERSITY SWEEP", "Natural Home V49 V32 best-checkpoint diversity sweep inference", "naturalHomeV49V32DiversitySweepGeneration", ".runtime/ai-painter/natural-home-v49-v32-diversity-sweep-generation/contact-sheet.png", ".runtime/ai-painter/natural-home-v49-v32-diversity-sweep-generation/latest.json"),
  fallbackQuality("V48 / SPLIT EXPERT MERGE GATE", "Natural Home V48 conservative merge gate selection", "naturalHomeV48MergeGateSelection", ".runtime/ai-painter/natural-home-v48-merge-gate-selection/contact-sheet.png", ".runtime/ai-painter/natural-home-v48-merge-gate-selection/latest.json", ".runtime/ai-painter/natural-home-v48-merge-gate-selection/selection-report.json"),
  fallbackQuality("V48 / REPAIR QUALITY", "Natural Home V48 water/shoreline expert repair quality selection", "naturalHomeV48RepairQualitySelection", ".runtime/ai-painter/natural-home-v48-repair-quality-selection/contact-sheet.png", ".runtime/ai-painter/natural-home-v48-repair-quality-selection/latest.json", ".runtime/ai-painter/natural-home-v48-repair-quality-selection/selection-report.json"),
  fallbackGeneration("V48 / WATER SHARPNESS EXPERT FIX", "Natural Home V48 local water and shoreline expert fixed inference", "naturalHomeV48WaterSharpnessExpertFixGeneration", ".runtime/ai-painter/natural-home-v48-water-sharpness-expert-fix-generation/contact-sheet.png", ".runtime/ai-painter/natural-home-v48-water-sharpness-expert-fix-generation/latest.json"),
  fallbackQuality("V47 / HARD FAILURE STABILIZATION QUALITY", "Natural Home V47 hard failure stabilization quality selection", "naturalHomeV47QualitySelection", ".runtime/ai-painter/natural-home-v47-quality-selection/contact-sheet.png", ".runtime/ai-painter/natural-home-v47-quality-selection/latest.json", ".runtime/ai-painter/natural-home-v47-quality-selection/selection-report.json"),
  fallbackGeneration("V47 / HARD FAILURE STABILIZATION", "Natural Home V47 hard failure stabilization inference", "naturalHomeV47HardFailureStabilizationGeneration", ".runtime/ai-painter/natural-home-v47-hard-failure-stabilization-generation/contact-sheet.png", ".runtime/ai-painter/natural-home-v47-hard-failure-stabilization-generation/latest.json"),
  fallbackQuality("V46 / V45 FAILURE FOCUS QUALITY", "Natural Home V46 V45 failure-focus quality selection", "naturalHomeV46QualitySelection", ".runtime/ai-painter/natural-home-v46-quality-selection/contact-sheet.png", ".runtime/ai-painter/natural-home-v46-quality-selection/latest.json", ".runtime/ai-painter/natural-home-v46-quality-selection/selection-report.json"),
  fallbackGeneration("V46 / V45 FAILURE FOCUS", "Natural Home V46 V45 failure-focus inference", "naturalHomeV46V45FailureFocusRepairGeneration", ".runtime/ai-painter/natural-home-v46-v45-failure-focus-repair-generation/contact-sheet.png", ".runtime/ai-painter/natural-home-v46-v45-failure-focus-repair-generation/latest.json"),
  fallbackQuality("V45 / GENERALIZATION DATASET QUALITY", "Natural Home V45 generalization quality selection", "naturalHomeV45QualitySelection", ".runtime/ai-painter/natural-home-v45-quality-selection/contact-sheet.png", ".runtime/ai-painter/natural-home-v45-quality-selection/latest.json", ".runtime/ai-painter/natural-home-v45-quality-selection/selection-report.json"),
  fallbackGeneration("V45 / GENERALIZATION DATASET", "Natural Home V45 generalization inference", "naturalHomeV45GeneralizationGeneration", ".runtime/ai-painter/natural-home-v45-generalization-generation/contact-sheet.png", ".runtime/ai-painter/natural-home-v45-generalization-generation/latest.json"),
  fallbackQuality("V44 / V32 STABLE GENERALIZATION QUALITY", "Natural Home V44 V32 stable generalization quality selection", "naturalHomeV44QualitySelection", ".runtime/ai-painter/natural-home-v44-quality-selection/contact-sheet.png", ".runtime/ai-painter/natural-home-v44-quality-selection/latest.json", ".runtime/ai-painter/natural-home-v44-quality-selection/selection-report.json"),
  fallbackGeneration("V44 / V32 STABLE GENERALIZATION", "Natural Home V44 V32 stable generalization inference", "naturalHomeV44V32StableGeneralizationGeneration", ".runtime/ai-painter/natural-home-v44-v32-stable-generalization-generation/contact-sheet.png", ".runtime/ai-painter/natural-home-v44-v32-stable-generalization-generation/latest.json"),
  fallbackQuality("V43 / V32 FAILURE FOCUS QUALITY", "Natural Home V43 V32 failure-focus quality selection", "naturalHomeV43QualitySelection", ".runtime/ai-painter/natural-home-v43-quality-selection/contact-sheet.png", ".runtime/ai-painter/natural-home-v43-quality-selection/latest.json", ".runtime/ai-painter/natural-home-v43-quality-selection/selection-report.json"),
  fallbackGeneration("V43 / V32 FAILURE FOCUS", "Natural Home V43 V32 failure-focus inference", "naturalHomeV43V32FailureFocusRepairGeneration", ".runtime/ai-painter/natural-home-v43-v32-failure-focus-repair-generation/contact-sheet.png", ".runtime/ai-painter/natural-home-v43-v32-failure-focus-repair-generation/latest.json"),
  fallbackQuality("V42 / WATER EXPERT FIX QUALITY", "Natural Home V42 water expert fix quality selection", "naturalHomeV42QualitySelection", ".runtime/ai-painter/natural-home-v42-quality-selection/contact-sheet.png", ".runtime/ai-painter/natural-home-v42-quality-selection/latest.json", ".runtime/ai-painter/natural-home-v42-quality-selection/selection-report.json"),
  fallbackGeneration("V42 / WATER EXPERT FIX", "Natural Home V42 water expert fixed inference", "naturalHomeV42WaterExpertFixGeneration", ".runtime/ai-painter/natural-home-v42-v32-water-expert-fix-generation/contact-sheet.png", ".runtime/ai-painter/natural-home-v42-v32-water-expert-fix-generation/latest.json"),
  fallbackQuality("V41 / V32 WATER RESCUE QUALITY", "Natural Home V41 V32 water rescue quality selection", "naturalHomeV41QualitySelection", ".runtime/ai-painter/natural-home-v41-quality-selection/contact-sheet.png", ".runtime/ai-painter/natural-home-v41-quality-selection/latest.json", ".runtime/ai-painter/natural-home-v41-quality-selection/selection-report.json"),
  fallbackGeneration("V41 / V32 WATER RESCUE", "Natural Home V41 V32 water rescue inference", "naturalHomeV41V32WaterRescueGeneration", ".runtime/ai-painter/natural-home-v41-v32-water-rescue-generation/contact-sheet.png", ".runtime/ai-painter/natural-home-v41-v32-water-rescue-generation/latest.json"),
  fallbackQuality("V40 / SHARPNESS LOCK QUALITY", "Natural Home V40 sharpness-lock quality selection", "naturalHomeV40QualitySelection", ".runtime/ai-painter/natural-home-v40-quality-selection/contact-sheet.png", ".runtime/ai-painter/natural-home-v40-quality-selection/latest.json", ".runtime/ai-painter/natural-home-v40-quality-selection/selection-report.json"),
  fallbackGeneration("V40 / SHARPNESS LOCK", "Natural Home V40 sharpness-lock inference", "naturalHomeV40SharpnessLockRepairGeneration", ".runtime/ai-painter/natural-home-v40-sharpness-lock-repair-generation/contact-sheet.png", ".runtime/ai-painter/natural-home-v40-sharpness-lock-repair-generation/latest.json"),
  fallbackQuality("V39 / FAILURE FOCUS QUALITY", "Natural Home V39 failure-focus quality selection", "naturalHomeV39QualitySelection", ".runtime/ai-painter/natural-home-v39-quality-selection/contact-sheet.png", ".runtime/ai-painter/natural-home-v39-quality-selection/latest.json", ".runtime/ai-painter/natural-home-v39-quality-selection/selection-report.json"),
  fallbackGeneration("V39 / FAILURE FOCUS", "Natural Home V39 failure-focus inference", "naturalHomeV39FailureFocusRepairGeneration", ".runtime/ai-painter/natural-home-v39-failure-focus-repair-generation/contact-sheet.png", ".runtime/ai-painter/natural-home-v39-failure-focus-repair-generation/latest.json"),
  fallbackQuality("V38 / WATER EDGE BALANCE QUALITY", "Natural Home V38 water edge balance quality selection", "naturalHomeV38QualitySelection", ".runtime/ai-painter/natural-home-v38-quality-selection/contact-sheet.png", ".runtime/ai-painter/natural-home-v38-quality-selection/latest.json", ".runtime/ai-painter/natural-home-v38-quality-selection/selection-report.json"),
  fallbackQuality("V37 / WATER FAILURE REPAIR QUALITY", "Natural Home V37 water failure repair quality selection", "naturalHomeV37QualitySelection", ".runtime/ai-painter/natural-home-v37-quality-selection/contact-sheet.png", ".runtime/ai-painter/natural-home-v37-quality-selection/latest.json", ".runtime/ai-painter/natural-home-v37-quality-selection/selection-report.json"),
  fallbackQuality("V36 / BALANCED GENERALIZATION QUALITY", "Natural Home V36 balanced generalization quality selection", "naturalHomeV36QualitySelection", ".runtime/ai-painter/natural-home-v36-quality-selection/contact-sheet.png", ".runtime/ai-painter/natural-home-v36-quality-selection/latest.json", ".runtime/ai-painter/natural-home-v36-quality-selection/selection-report.json"),
  fallbackQuality("V35 / BALANCED WATER DETAIL QUALITY", "Natural Home V35 balanced water detail quality selection", "naturalHomeV35QualitySelection", ".runtime/ai-painter/natural-home-v35-quality-selection/contact-sheet.png", ".runtime/ai-painter/natural-home-v35-quality-selection/latest.json", ".runtime/ai-painter/natural-home-v35-quality-selection/selection-report.json"),
  fallbackQuality("V34 / WATER STABILITY QUALITY", "Natural Home V34 water stability quality selection", "naturalHomeV34QualitySelection", ".runtime/ai-painter/natural-home-v34-quality-selection/contact-sheet.png", ".runtime/ai-painter/natural-home-v34-quality-selection/latest.json", ".runtime/ai-painter/natural-home-v34-quality-selection/selection-report.json"),
  fallbackQuality("V33 / WATER ARTIFACT GUARD QUALITY", "Natural Home V33 water artifact guard quality selection", "naturalHomeV33QualitySelection", ".runtime/ai-painter/natural-home-v33-quality-selection/contact-sheet.png", ".runtime/ai-painter/natural-home-v33-quality-selection/latest.json", ".runtime/ai-painter/natural-home-v33-quality-selection/selection-report.json"),
  fallbackQuality("V32 / PATCHGAN QUALITY", "Natural Home V32 PatchGAN quality selection", "naturalHomeV32QualitySelection", ".runtime/ai-painter/natural-home-v32-quality-selection/contact-sheet.png", ".runtime/ai-painter/natural-home-v32-quality-selection/latest.json", ".runtime/ai-painter/natural-home-v32-quality-selection/selection-report.json"),
  fallbackGeneration("V32 / PATCHGAN", "Natural Home V32 PatchGAN inference", "naturalHomeV32PatchganRefinerGeneration", ".runtime/ai-painter/natural-home-v32-patchgan-refiner-generation/contact-sheet.png", ".runtime/ai-painter/natural-home-v32-patchgan-refiner-generation/latest.json"),
  fallbackQuality("V31 / EDGE REFINER QUALITY", "Natural Home V31 edge refiner quality selection", "naturalHomeV31QualitySelection", ".runtime/ai-painter/natural-home-v31-quality-selection/contact-sheet.png", ".runtime/ai-painter/natural-home-v31-quality-selection/latest.json", ".runtime/ai-painter/natural-home-v31-quality-selection/selection-report.json"),
]

export default async function GeneratedResultsPage() {
  const archivedResults = await readArchivedGeneratedResults()
  const allGeneratedResults = mergeGeneratedResults(archivedResults, fallbackResults)
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
          这里专门保留本地小模型推理后的 PNG、生成时间、质量筛选、失败记录、资源消耗和 ApprovedFrame。
          原稿、结构草图、Mask 调试图不放在这里，避免和真正训练后的内容混在一起。
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
              这是隐藏 Candidate 通过闸门后生成的 ApprovedFrame。它允许在开发环境进入 /world，但仍然不是生产批准。
              生产环境必须继续经过完整 VisualJudge。
            </p>
            <p>
              生成时间：<strong>{formatDateValue(approvedRecord.savedAt)}</strong>
              <br />
              worldId：<code>{approvedRecord.worldId ?? "--"}</code>
              <br />
              tick：<strong>{approvedRecord.tick ?? "--"}</strong>
              <br />
              reviewScore：<strong>{formatNumber(approvedRecord.approvedFrame.reviewScore)}</strong>
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
          <article className={styles.resultCard} key={`${result.file}-${result.id ?? result.view}`}>
            <span className={result.reviewStatus === "failed" ? styles.fail : styles.pass}>{statusLabel(result)}</span>
            <p className={styles.kicker}>{result.stage}</p>
            <h2>{result.title}</h2>
            <p>{result.description}</p>
            <p>
              生成时间：<strong>{result.meta?.modifiedAt ?? "文件不存在"}</strong>
              <br />
              训练开始：<strong>{formatDateValue(result.trainingStartedAt ?? result.summary?.resourceEstimate?.trainingStartedAt ?? result.summary?.resourceEstimate?.startedAt)}</strong>
              <br />
              训练结束：<strong>{formatDateValue(result.trainingFinishedAt ?? result.summary?.resourceEstimate?.trainingFinishedAt ?? result.summary?.resourceEstimate?.finishedAt)}</strong>
              <br />
              训练耗时：<strong>{formatDurationValue(result.trainingDurationText, result.trainingDurationSeconds ?? result.summary?.resourceEstimate?.trainingDurationSeconds ?? result.summary?.resourceEstimate?.totalExpertTrainingSeconds)}</strong>
              <br />
              文件位置：<code>{result.file}</code>
              <br />
              原始输出：<code>{result.sourceFile ?? "--"}</code>
              <br />
              文件大小：<strong>{result.meta ? `${result.meta.sizeKiB} KiB` : "--"}</strong>
              {result.rowCount !== undefined ? (
                <>
                  <br />
                  候选明细：<strong>{result.rowCount} 条，打回 {result.rejectedRowCount ?? 0} 条</strong>
                </>
              ) : null}
              {result.rowArchiveDir ? (
                <>
                  <br />
                  明细归档：<code>{result.rowArchiveDir}</code>
                </>
              ) : null}
            </p>
            <ResultMetrics summary={result.summary} diagnosis={result.diagnosis} />
            <TrainingQualityGate qualityGate={result.qualityGate} />
            <ResourceEstimate summary={result.summary} />
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
          训练后的生成图必须留档：通过的保留，失败的也保留。失败记录用于判断训练路线有没有退步，
          但不会进入 /world，也不会被标记为正式世界画面。
        </p>
        <p>
          正式世界只读取 ApprovedFrame。Candidate、训练输出、调试图、原稿图都不能绕过 VisualJudge。
        </p>
      </section>
    </main>
  )
}

function fallbackQuality(
  stage: string,
  title: string,
  view: string,
  file: string,
  summaryFile: string,
  diagnosisFile: string,
): GeneratedResult {
  return {
    stage,
    title,
    view,
    file,
    summaryFile,
    diagnosisFile,
    description: "本地小模型候选证据，只用于训练后对比和失败复盘；未通过 VisualJudge 与 ApprovedFrame 前不能进入 /world。",
    reviewStatus: "candidate",
  }
}

function fallbackGeneration(stage: string, title: string, view: string, file: string, summaryFile: string): GeneratedResult {
  return {
    stage,
    title,
    view,
    file,
    summaryFile,
    diagnosisFile: summaryFile,
    description: "本地小模型推理输出，只用于候选观察；正式展示必须等质量筛选、VisualJudge 和 ApprovedFrame。",
    reviewStatus: "candidate",
  }
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
    sourceFile: result.sourceFile,
    summaryFile: result.summaryFile,
    diagnosisFile: result.diagnosisFile,
    qualityGateFile: result.qualityGateFile,
    rowArchiveDir: result.rowArchiveDir,
    rowCount: result.rowCount,
    rejectedRowCount: result.rejectedRowCount,
    trainingStartedAt: result.trainingStartedAt,
    trainingFinishedAt: result.trainingFinishedAt,
    trainingDurationSeconds: result.trainingDurationSeconds,
    trainingDurationText: result.trainingDurationText,
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
  const archivedSourceKeys = new Set(
    archived.flatMap((result) => (result.sourceFile ? [normalizePathKey(result.sourceFile)] : [])),
  )
  const seen = new Set<string>()
  const merged: GeneratedResult[] = []
  for (const result of archived) {
    const key = normalizePathKey(result.file)
    if (seen.has(key)) continue
    seen.add(key)
    merged.push(result)
  }
  for (const result of fallback) {
    const fileKey = normalizePathKey(result.file)
    if (archivedSourceKeys.has(fileKey) || seen.has(fileKey)) continue
    seen.add(fileKey)
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
    result.qualityGateFile ? readJson<GeneratedQualityGateReport>(result.qualityGateFile) : Promise.resolve(null),
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
      <br />
      平均分 / 最佳分：<strong>{formatNumber(props.summary?.averageScore)} / {formatNumber(props.summary?.bestScore)}</strong>
    </p>
  )
}

function TrainingQualityGate(props: { qualityGate: GeneratedQualityGateReport | null }) {
  if (!props.qualityGate) return null
  const rejectedReasons = getQualityGateRejectedReasons(props.qualityGate)
  return (
    <p>
      训练质量闸门：<strong>{props.qualityGate.status}</strong>
      <br />
      可进入下一轮训练：<strong>{getQualityGateCanEnterNextTraining(props.qualityGate) ? "是" : "否"}</strong>
      <br />
      通过 / 警告 / 打回：<strong>{getQualityGatePassedCount(props.qualityGate)} / {getQualityGateWarningCount(props.qualityGate)} / {getQualityGateFailedCount(props.qualityGate)}</strong>
      <br />
      主要原因：<strong>{rejectedReasons.length ? rejectedReasons.join("，") : "--"}</strong>
    </p>
  )
}

function getQualityGatePassedCount(qualityGate: GeneratedQualityGateReport) {
  if (isTrainingQualityGateReport(qualityGate)) return qualityGate.summary.passedCount
  return (qualityGate.rows ?? []).filter((row) => row.passed === true).length
}

function getQualityGateWarningCount(qualityGate: GeneratedQualityGateReport) {
  if (isTrainingQualityGateReport(qualityGate)) return qualityGate.summary.warningCount
  return 0
}

function getQualityGateFailedCount(qualityGate: GeneratedQualityGateReport) {
  if (isTrainingQualityGateReport(qualityGate)) return qualityGate.summary.failedCount
  return (qualityGate.rows ?? []).filter((row) => row.passed !== true).length
}

function getQualityGateCanEnterNextTraining(qualityGate: GeneratedQualityGateReport) {
  if (isTrainingQualityGateReport(qualityGate)) return qualityGate.canEnterNextTraining
  return (qualityGate.rows ?? []).length > 0 && (qualityGate.rows ?? []).every((row) => row.passed === true)
}

function getQualityGateRejectedReasons(qualityGate: GeneratedQualityGateReport) {
  if (isTrainingQualityGateReport(qualityGate)) {
    return qualityGate.rows
      .filter((row) => row.status !== "passed")
      .flatMap((row) => row.reasons)
      .slice(0, 6)
  }
  return (qualityGate.rows ?? [])
    .filter((row) => row.passed !== true)
    .map((row) => row.sampleId ?? "unknown_sample")
    .slice(0, 6)
}

function isTrainingQualityGateReport(
  qualityGate: GeneratedQualityGateReport,
): qualityGate is TrainingQualityGateReport {
  return (
    qualityGate.schemaVersion === "ai-painter-training-quality-gate-v1" &&
    "summary" in qualityGate &&
    typeof qualityGate.summary === "object" &&
    qualityGate.summary !== null &&
    "passedCount" in qualityGate.summary
  )
}

function ResourceEstimate(props: { summary: TrainingSummary | null }) {
  const resource = props.summary?.resourceEstimate
  if (!resource) return null
  return (
    <p>
      资源记录：<strong>{formatNumber(resource.estimatedKwh, 4)} kWh</strong>
      <br />
      训练耗时：<strong>{formatDurationValue(resource.trainingDurationText, resource.trainingDurationSeconds ?? resource.totalExpertTrainingSeconds)}</strong>
      <br />
      预估电费：<strong>{formatNumber(resource.estimatedCny, 4)} 元</strong>
      <br />
      外部 API token：<strong>{formatInteger(resource.externalApiTokens)}</strong>
      <br />
      本地计算 token 估算：<strong>{formatInteger(resource.localComputeTokenEstimate)}</strong>
    </p>
  )
}

function FailureList(props: { diagnosis: DiagnosisReport | null }) {
  const failures = props.diagnosis?.failures ?? []
  if (!failures.length) return null
  return (
    <p>
      打回原因：
      <br />
      {failures.slice(0, 6).map((failure, index) => (
        <span key={`${failure.code ?? "failure"}-${index}`}>
          {failure.severity ?? "failure"} / {failure.code ?? "unknown"}：{failure.message ?? "--"}
          <br />
        </span>
      ))}
    </p>
  )
}

function statusLabel(result: GeneratedResult) {
  if (result.reviewStatus === "approved") return "ApprovedFrame"
  if (result.reviewStatus === "failed") return "未通过，已留档"
  return "候选记录，不进正式世界"
}

async function readFileMeta(file: string): Promise<FileMeta | null> {
  try {
    const meta = await stat(path.join(/* turbopackIgnore: true */ process.cwd(), file))
    return { modifiedAt: meta.mtime.toLocaleString("zh-CN", { hour12: false }), sizeKiB: Math.round(meta.size / 1024) }
  } catch {
    return null
  }
}

async function readJson<T>(file: string): Promise<T | null> {
  try {
    return JSON.parse(await readFile(path.join(/* turbopackIgnore: true */ process.cwd(), file), "utf8")) as T
  } catch {
    return null
  }
}

async function readLatestApprovedFrameRecord() {
  try {
    const indexPath = path.join(
      /* turbopackIgnore: true */ process.cwd(),
      ".runtime",
      "world-visual-approved",
      "latest-approved-frame.json",
    )
    const index = JSON.parse(await readFile(indexPath, "utf8")) as { path?: string }
    if (!index.path) return null
    return JSON.parse(await readFile(path.join(/* turbopackIgnore: true */ process.cwd(), index.path), "utf8")) as ApprovedFrameRecord
  } catch {
    return null
  }
}

function formatNumber(value: unknown, digits = 4) {
  return typeof value === "number" && Number.isFinite(value) ? value.toFixed(digits) : "--"
}

function formatInteger(value: unknown) {
  return typeof value === "number" && Number.isFinite(value) ? Math.round(value).toLocaleString("zh-CN") : "--"
}

function formatDateValue(value: unknown) {
  return typeof value === "string" ? new Date(value).toLocaleString("zh-CN", { hour12: false }) : "--"
}

function formatDurationValue(text: unknown, seconds: unknown) {
  if (typeof text === "string" && text.trim()) return text
  if (typeof seconds !== "number" || !Number.isFinite(seconds)) return "--"
  const safeSeconds = Math.max(0, Math.round(seconds))
  const hours = Math.floor(safeSeconds / 3600)
  const minutes = Math.floor((safeSeconds % 3600) / 60)
  const restSeconds = safeSeconds % 60
  if (hours > 0) return `${hours}小时 ${minutes}分 ${restSeconds}秒`
  if (minutes > 0) return `${minutes}分 ${restSeconds}秒`
  return `${restSeconds}秒`
}
