import { copyFile, cp, mkdir, readFile, readdir, stat, writeFile } from "node:fs/promises"
import path from "node:path"
import type { ResourceUsageSessionSummary } from "./ai-painter-resource-usage"
import { buildTrainingQualityGateReport } from "./ai-painter-training-quality-gate"
import { aiPainterRuntimeRoot } from "./ai-painter-training-state"

type ResultManifest = {
  schemaVersion?: string
  status?: string
  stageId?: string
  trainingVersion?: string
  modelVersion?: string
  contactSheet?: string
  generated?: string
  rows?: Array<Record<string, unknown>>
  resourceEstimate?: Record<string, unknown>
  qualityGate?: Record<string, unknown>
}

export type ArchivedTrainingResult = {
  id: string
  action: string
  stage: string
  title: string
  description: string
  reviewStatus: "failed" | "candidate" | "approved"
  imageFile: string
  sourceFile?: string
  summaryFile: string
  diagnosisFile: string
  qualityGateFile?: string
  rowArchiveDir?: string
  rowCount?: number
  rejectedRowCount?: number
  dataRetention?: {
    rowArchiveStored: boolean
    rowArchiveDir?: string
    rowCount: number
    rejectedRowCount: number
    preservedFields: string[]
  }
  trainingStartedAt?: string
  trainingFinishedAt?: string | null
  trainingDurationSeconds?: number
  trainingDurationText?: string
  resourceEstimate?: Record<string, unknown>
  archivedAt: string
  modifiedAt: string
  sizeKiB: number
}

type GeneratedResultsIndex = {
  schemaVersion: "ai-painter-generated-results-index-v1"
  updatedAt: string
  results: ArchivedTrainingResult[]
}

const archiveDir = path.join(aiPainterRuntimeRoot, "generated-results")
const archivedImageDir = path.join(archiveDir, "images")
const summaryDir = path.join(archiveDir, "summaries")
const diagnosisDir = path.join(archiveDir, "diagnoses")
const qualityGateDir = path.join(archiveDir, "quality-gates")
const rowArchiveRoot = path.join(archiveDir, "rows")
const indexPath = path.join(archiveDir, "index.json")

const actionLabels: Record<string, { stage: string; title: string; description: string }> = {
  full_natural_home_v18_source_expert_bank: {
    stage: "V18 / SOURCE EXPERT BANK",
    title: "Natural Home v18 Source Expert Bank",
    description:
      "Local model candidate evidence only. It trains source experts and cannot enter /world without VisualJudge and ApprovedFrame.",
  },
  full_natural_home_v19_promoted_source: {
    stage: "V19 / PROMOTED SOURCE EXPERT",
    title: "Natural Home v19 Promoted Source Expert",
    description:
      "Local model candidate evidence only. It strengthens the promoted natural source and cannot enter /world without VisualJudge and ApprovedFrame.",
  },
  full_natural_home_v20_multisource_generalization: {
    stage: "V20 / MULTISOURCE GENERALIZATION",
    title: "Natural Home v20 Multisource Generalization",
    description:
      "Local model candidate evidence only. It learns natural-home type generalization from multiple sources and cannot enter /world without VisualJudge and ApprovedFrame.",
  },
  full_natural_home_v22_warning_focus: {
    stage: "V22 / WARNING SOURCE FOCUS",
    title: "Natural Home v22 Warning Source Focus",
    description:
      "Local model candidate evidence only. It reinforces the weaker natural-home sources from v20 and cannot enter /world without VisualJudge and ApprovedFrame.",
  },
  full_natural_home_v23_candidate_consolidation: {
    stage: "V23 / CANDIDATE CONSOLIDATION",
    title: "Natural Home v23 Candidate Consolidation",
    description:
      "Local model candidate evidence only. It consolidates v20 and v22 natural-home training direction and cannot enter /world without VisualJudge and ApprovedFrame.",
  },
  full_natural_home_v24_diversity_generation: {
    stage: "V24 / DIVERSITY GENERATION",
    title: "Natural Home v24 Diversity Generation",
    description:
      "Local model candidate evidence only. It generates multiple new natural-home structure conditions and renders them with local source experts; it cannot enter /world without VisualJudge and ApprovedFrame.",
  },
  full_natural_home_v25_diversity_generalization: {
    stage: "V25 / DIVERSITY GENERALIZATION",
    title: "Natural Home v25 Diversity Generalization",
    description:
      "Local model candidate evidence only. It trains a no-source/no-coordinate natural-home generalization model and renders multiple generated blueprints; it cannot enter /world without VisualJudge and ApprovedFrame.",
  },
  full_natural_home_v31_edge_refiner: {
    stage: "V31 / EDGE FOCUS REFINER",
    title: "Natural Home v31 Edge Focus Refiner",
    description:
      "Local model candidate evidence only. It trains, generates, and quality-screens edge-focused natural-home candidates; every accepted and rejected row is archived automatically and cannot enter /world without VisualJudge and ApprovedFrame.",
  },
  full_natural_home_v32_patchgan_refiner: {
    stage: "V32 / PATCHGAN REFINER",
    title: "Natural Home v32 PatchGAN Refiner",
    description:
      "Local model candidate evidence only. It trains, generates, and quality-screens PatchGAN-refined natural-home candidates; every accepted and rejected row is archived automatically and cannot enter /world without VisualJudge and ApprovedFrame.",
  },
  full_natural_home_v33_water_artifact_guard: {
    stage: "V33 / WATER ARTIFACT GUARD",
    title: "Natural Home v33 Water Artifact Guard",
    description:
      "Local model candidate evidence only. It trains, generates, and quality-screens water-artifact guarded natural-home candidates; every accepted and rejected row is archived automatically and cannot enter /world without VisualJudge and ApprovedFrame.",
  },
  full_natural_home_v34_water_stability: {
    stage: "V34 / WATER STABILITY",
    title: "Natural Home v34 Water Stability",
    description:
      "Local model candidate evidence only. It fine-tunes from V33 with stronger water artifact suppression, generates candidates, and archives every accepted and rejected row automatically; it cannot enter /world without VisualJudge and ApprovedFrame.",
  },
  full_natural_home_v35_balanced_water_detail: {
    stage: "V35 / BALANCED WATER DETAIL",
    title: "Natural Home v35 Balanced Water Detail",
    description:
      "Local model candidate evidence only. It fine-tunes from V34 to balance water artifact suppression with sharpness and edge detail, then archives every accepted and rejected row automatically; it cannot enter /world without VisualJudge and ApprovedFrame.",
  },
  full_natural_home_v36_balanced_generalization: {
    stage: "V36 / BALANCED GENERALIZATION",
    title: "Natural Home v36 Balanced Generalization",
    description:
      "Local model candidate evidence only. It fine-tunes from V35 to improve multi-source natural-home generalization while preserving water stability and sharp detail; it archives every accepted and rejected row automatically and cannot enter /world without VisualJudge and ApprovedFrame.",
  },
  full_natural_home_v37_water_failure_repair: {
    stage: "V37 / WATER FAILURE REPAIR",
    title: "Natural Home v37 Water Failure Repair",
    description:
      "Local model candidate evidence only. It fine-tunes from V36 to repair rejected water-artifact and edge-density cases, archives every accepted and rejected row automatically, and cannot enter /world without VisualJudge and ApprovedFrame.",
  },
  full_natural_home_v38_water_edge_balance: {
    stage: "V38 / WATER EDGE BALANCE",
    title: "Natural Home v38 Water Edge Balance",
    description:
      "Local model candidate evidence only. It fine-tunes from V37 to balance water artifact suppression with edge density and pixel texture, archives every accepted and rejected row automatically, and cannot enter /world without VisualJudge and ApprovedFrame.",
  },
  full_natural_home_v39_failure_focus_repair: {
    stage: "V39 / FAILURE FOCUS REPAIR",
    title: "Natural Home v39 Failure Focus Repair",
    description:
      "Local model candidate evidence only. It starts from the best V37 checkpoint, prepares a failure-weighted dataset from rejected water/edge rows, archives every accepted and rejected row automatically, and cannot enter /world without VisualJudge and ApprovedFrame.",
  },
  full_natural_home_v40_sharpness_lock_repair: {
    stage: "V40 / SHARPNESS LOCK REPAIR",
    title: "Natural Home v40 Sharpness Lock Repair",
    description:
      "Local model candidate evidence only. It starts from the current best V37 checkpoint with a conservative sharpness-lock repair pass, archives every accepted and rejected row automatically, and cannot enter /world without VisualJudge and ApprovedFrame.",
  },
  full_natural_home_v41_v32_water_rescue: {
    stage: "V41 / V32 WATER RESCUE",
    title: "Natural Home v41 V32 Water Rescue",
    description:
      "Local model candidate evidence only. It starts from the historical best V32 checkpoint and conservatively repairs water-periodicity failures, archives every accepted and rejected row automatically, and cannot enter /world without VisualJudge and ApprovedFrame.",
  },
  full_natural_home_v42_water_expert_fix: {
    stage: "V42 / WATER EXPERT FIX",
    title: "Natural Home v42 Water Expert Fix",
    description:
      "Local model candidate evidence only. It applies mask-bound local water and shoreline experts to V32 hidden candidates, archives every accepted and rejected row automatically, and cannot enter /world without VisualJudge and ApprovedFrame.",
  },
  full_natural_home_v43_v32_failure_focus_repair: {
    stage: "V43 / V32 FAILURE FOCUS REPAIR",
    title: "Natural Home v43 V32 Failure Focus Repair",
    description:
      "Local model candidate evidence only. It starts from the historical best V32 checkpoint, weights V32 rejected water-artifact rows, archives every accepted and rejected row automatically, and cannot enter /world without VisualJudge and ApprovedFrame.",
  },
  full_natural_home_v44_v32_stable_generalization: {
    stage: "V44 / V32 STABLE GENERALIZATION",
    title: "Natural Home v44 V32 Stable Generalization",
    description:
      "Local model candidate evidence only. It starts from the historical best V32 checkpoint, runs a conservative stable-generalization fine-tune across the same-source natural-home dataset, archives every accepted and rejected row automatically, and cannot enter /world without VisualJudge and ApprovedFrame.",
  },
  full_natural_home_v45_generalization: {
    stage: "V45 / GENERALIZATION DATASET",
    title: "Natural Home v45 Generalization Dataset",
    description:
      "Local model candidate evidence only. It starts from the historical best V32 checkpoint, trains on a balanced same-source generalization dataset, archives every accepted and rejected row automatically, and cannot enter /world without VisualJudge and ApprovedFrame.",
  },
  full_natural_home_v46_v45_failure_focus_repair: {
    stage: "V46 / V45 FAILURE FOCUS REPAIR",
    title: "Natural Home v46 V45 Failure Focus Repair",
    description:
      "Local model candidate evidence only. It starts from the historical best V32 checkpoint, weights V45 failed and low-pass same-source samples, archives every accepted and rejected row automatically, and cannot enter /world without VisualJudge and ApprovedFrame.",
  },
  full_natural_home_v47_hard_failure_stabilization: {
    stage: "V47 / HARD FAILURE STABILIZATION",
    title: "Natural Home v47 Hard Failure Stabilization",
    description:
      "Local model candidate evidence only. It starts from the V46 checkpoint, overweights hard failed water, stream, edge-density and blur samples, archives every accepted and rejected row automatically, and cannot enter /world without VisualJudge and ApprovedFrame.",
  },
  full_natural_home_v48_split_expert_merge_gate: {
    stage: "V48 / SPLIT EXPERT MERGE GATE",
    title: "Natural Home v48 Split Expert Merge Gate",
    description:
      "Local model candidate evidence only. It applies local water and shoreline expert repair to V47 candidates, compares source and repaired images row by row, archives every merge decision automatically, and cannot enter /world without VisualJudge and ApprovedFrame.",
  },
  full_natural_home_v49_v32_diversity_sweep: {
    stage: "V49 / V32 DIVERSITY SWEEP",
    title: "Natural Home v49 V32 Diversity Sweep",
    description:
      "Local model candidate evidence only. It uses the current best V32 checkpoint to render a wider spread of same-source natural-home structure conditions, archives every accepted and rejected row automatically, and cannot enter /world without VisualJudge and ApprovedFrame.",
  },
  full_natural_home_v50_diversity_water_gate: {
    stage: "V50 / DIVERSITY WATER GATE",
    title: "Natural Home v50 Diversity Water Gate",
    description:
      "Local audit evidence only. It checks V49 strict-pass diversity, required structure-channel coverage and water-artifact blocking failures, archives the report automatically, and cannot enter /world without VisualJudge and ApprovedFrame.",
  },
  full_natural_home_v51_safe_candidate_pack: {
    stage: "V51 / SAFE CANDIDATE PACK",
    title: "Natural Home v51 Strict Safe Candidate Pack",
    description:
      "Local candidate-pack evidence only. It copies only V50 strict-pass rows into a safe training pack, archives every copied row automatically, and cannot enter /world without VisualJudge and ApprovedFrame.",
  },
  full_natural_home_v87_quality_ledger: {
    stage: "V87 / QUALITY LEDGER",
    title: "Natural Home v87 Quality Ledger",
    description:
      "Local quality ledger only. It freezes the V82 baseline, stores next-training allowlist rows and rejected negative examples separately, and prevents failed candidates from becoming future training targets.",
  },
  full_natural_home_v88_quality_allowlist_dataset: {
    stage: "V88 / QUALITY ALLOWLIST DATASET",
    title: "Natural Home v88 Quality Allowlist Dataset",
    description:
      "Local dataset preparation only. It converts V87 allowlist rows into the next training target dataset and keeps failed negative examples out of target.png.",
  },
}

export async function archiveTrainingResult(input: {
  action: string
  resourceSummary: ResourceUsageSessionSummary
}) {
  const manifestEntry = await findLatestResultManifest(input.resourceSummary.startedAt)
  if (!manifestEntry) return null

  const manifest = {
    ...manifestEntry.manifest,
    resourceEstimate: buildResourceEstimate(input.resourceSummary),
  }
  const qualityGate = buildTrainingQualityGateReport(manifest)
  manifest.qualityGate = qualityGate
  await writeJson(manifestEntry.file, manifest)

  const imagePath = resolveImagePath(manifest)
  if (!imagePath) return null

  const imageMeta = await stat(imagePath)
  const labels = actionLabels[input.action] ?? buildGenericLabels(input.action, manifest)
  const id = buildArchiveId(manifest.stageId ?? manifest.trainingVersion ?? input.action, input.resourceSummary.sessionId)
  await mkdir(archivedImageDir, { recursive: true })
  await mkdir(summaryDir, { recursive: true })
  await mkdir(diagnosisDir, { recursive: true })
  await mkdir(qualityGateDir, { recursive: true })
  await mkdir(rowArchiveRoot, { recursive: true })
  const archivedImageFile = path.join(archivedImageDir, `${id}.png`)
  const summaryFile = path.join(summaryDir, `${id}.json`)
  const diagnosisFile = path.join(diagnosisDir, `${id}.json`)
  const qualityGateFile = path.join(qualityGateDir, `${id}.json`)
  const rowArchiveDir = path.join(rowArchiveRoot, id)
  await copyFile(imagePath, archivedImageFile)
  await writeJson(summaryFile, manifest)
  await writeJson(diagnosisFile, manifest)
  await writeJson(qualityGateFile, qualityGate)
  const rowArchive = await archiveRowAssets(manifest, rowArchiveDir)

  const record: ArchivedTrainingResult = {
    id,
    action: input.action,
    stage: labels.stage,
    title: labels.title,
    description: labels.description,
    reviewStatus: reviewStatusForManifest(manifest),
    imageFile: toProjectRelativePath(archivedImageFile),
    sourceFile: toProjectRelativePath(imagePath),
    summaryFile: toProjectRelativePath(summaryFile),
    diagnosisFile: toProjectRelativePath(diagnosisFile),
    qualityGateFile: toProjectRelativePath(qualityGateFile),
    rowArchiveDir: rowArchive.rowCount > 0 ? toProjectRelativePath(rowArchiveDir) : undefined,
    rowCount: rowArchive.rowCount,
    rejectedRowCount: rowArchive.rejectedRowCount,
    dataRetention: {
      rowArchiveStored: rowArchive.rowCount > 0,
      rowArchiveDir: rowArchive.rowCount > 0 ? toProjectRelativePath(rowArchiveDir) : undefined,
      rowCount: rowArchive.rowCount,
      rejectedRowCount: rowArchive.rejectedRowCount,
      preservedFields: ["generated", "target", "contactSheet", "blueprint", "masks_v1", "row.json"],
    },
    trainingStartedAt: input.resourceSummary.startedAt,
    trainingFinishedAt: input.resourceSummary.finishedAt,
    trainingDurationSeconds: input.resourceSummary.durationSeconds,
    trainingDurationText: formatDuration(input.resourceSummary.durationSeconds),
    resourceEstimate: manifest.resourceEstimate,
    archivedAt: new Date().toISOString(),
    modifiedAt: imageMeta.mtime.toISOString(),
    sizeKiB: Math.round(imageMeta.size / 1024),
  }

  await upsertGeneratedResult(record)
  return record
}

export async function readGeneratedResultsIndex(): Promise<GeneratedResultsIndex> {
  try {
    const parsed = JSON.parse(await readFile(indexPath, "utf8")) as GeneratedResultsIndex
    return {
      schemaVersion: "ai-painter-generated-results-index-v1",
      updatedAt: parsed.updatedAt,
      results: Array.isArray(parsed.results) ? parsed.results : [],
    }
  } catch {
    return { schemaVersion: "ai-painter-generated-results-index-v1", updatedAt: new Date(0).toISOString(), results: [] }
  }
}

async function upsertGeneratedResult(record: ArchivedTrainingResult) {
  await mkdir(archiveDir, { recursive: true })
  const index = await readGeneratedResultsIndex()
  const results = [record, ...index.results.filter((item) => item.id !== record.id)]
    .sort(compareArchivedResultDesc)
  await writeJson(indexPath, {
    schemaVersion: "ai-painter-generated-results-index-v1",
    updatedAt: new Date().toISOString(),
    results,
  } satisfies GeneratedResultsIndex)
}

function compareArchivedResultDesc(left: ArchivedTrainingResult, right: ArchivedTrainingResult) {
  return archiveTime(right).localeCompare(archiveTime(left))
}

function archiveTime(record: ArchivedTrainingResult) {
  return record.archivedAt ?? record.modifiedAt ?? ""
}

async function archiveRowAssets(manifest: ResultManifest, outputDir: string) {
  const rows = Array.isArray(manifest.rows) ? manifest.rows : []
  if (!rows.length) return { rowCount: 0, rejectedRowCount: 0 }

  await mkdir(outputDir, { recursive: true })
  let rejectedRowCount = 0
  const archivedRows = await Promise.all(
    rows.map(async (row, index) => {
      const sampleId = stringValue(row.sampleId ?? row.sourceId ?? row.id) ?? `row-${index + 1}`
      const status = stringValue(row.status ?? row.diagnosisStatus) ?? "unknown"
      if (isRejectedRowStatus(status)) rejectedRowCount += 1

      const rowId = `${String(index + 1).padStart(3, "0")}-${sanitizeId(sampleId)}`
      const rowDir = path.join(outputDir, rowId)
      await mkdir(rowDir, { recursive: true })

      const copiedFiles: Record<string, string> = {}
      for (const field of ["generated", "target", "contactSheet", "blueprint"]) {
        const source = stringValue(row[field])
        if (!source) continue
        const copied = await copyOptionalRowFile(source, rowDir, field)
        if (copied) copiedFiles[field] = toProjectRelativePath(copied)
      }
      const copiedMaskDir = await copySiblingMaskDirectory(stringValue(row.blueprint), rowDir)
      if (copiedMaskDir) copiedFiles.masks_v1 = toProjectRelativePath(copiedMaskDir)

      const archivedRow = {
        ...row,
        archive: {
          rowId,
          status,
          files: copiedFiles,
        },
      }
      await writeJson(path.join(rowDir, "row.json"), archivedRow)
      return archivedRow
    }),
  )

  await writeJson(path.join(outputDir, "rows-index.json"), {
    schemaVersion: "ai-painter-generated-result-row-archive-v1",
    archivedAt: new Date().toISOString(),
    rowCount: archivedRows.length,
    rejectedRowCount,
    rows: archivedRows,
  })

  return { rowCount: archivedRows.length, rejectedRowCount }
}

async function copyOptionalRowFile(source: string, outputDir: string, field: string) {
  const sourceFile = resolveProjectPath(source)
  if (!sourceFile) return null
  try {
    const info = await stat(sourceFile)
    if (!info.isFile()) return null
    const extension = path.extname(sourceFile) || ".dat"
    const outputFile = path.join(outputDir, `${field}${extension}`)
    await copyFile(sourceFile, outputFile)
    return outputFile
  } catch {
    return null
  }
}

async function copySiblingMaskDirectory(blueprintSource: string | null, outputDir: string) {
  if (!blueprintSource) return null
  const blueprintFile = resolveProjectPath(blueprintSource)
  if (!blueprintFile) return null
  const sourceDir = path.join(path.dirname(blueprintFile), "masks_v1")
  const outputMaskDir = path.join(outputDir, "masks_v1")
  try {
    const info = await stat(sourceDir)
    if (!info.isDirectory()) return null
    await cp(sourceDir, outputMaskDir, { recursive: true })
    return outputMaskDir
  } catch {
    return null
  }
}

function resolveProjectPath(value: string) {
  const resolved = path.isAbsolute(value) ? value : path.join(/* turbopackIgnore: true */ process.cwd(), value)
  const relative = path.relative(/* turbopackIgnore: true */ process.cwd(), resolved)
  if (!relative || relative.startsWith("..") || path.isAbsolute(relative)) return null
  return resolved
}

function reviewStatusForManifest(manifest: ResultManifest): ArchivedTrainingResult["reviewStatus"] {
  if (manifest.status === "approved_frame") return "approved"
  if (
    manifest.status === "pass_candidate" ||
    manifest.status === "passed_for_next_training" ||
    manifest.status === "warning_keep_candidate" ||
    manifest.status === "needs_visual_judge" ||
    manifest.status === "needs_manual_review"
  ) {
    return "candidate"
  }
  return "failed"
}

function isRejectedRowStatus(status: string) {
  return status.includes("reject") || status.includes("failed") || status.includes("failure")
}

function buildArchiveId(base: string, sessionId: string) {
  return sanitizeId(`${base}-${sessionId}`)
}

function stringValue(value: unknown) {
  return typeof value === "string" && value.trim() ? value : null
}

async function findLatestResultManifest(startedAt: string) {
  const files = await findFiles(aiPainterRuntimeRoot, "latest.json")
  const startedMs = Date.parse(startedAt) - 10000
  const candidates = await Promise.all(
    files
      .filter((file) => !file.includes(`${path.sep}generated-results${path.sep}`))
      .filter((file) => !file.includes(`${path.sep}training-resource-usage${path.sep}`))
      .map(async (file) => {
        const manifest = await readJson<ResultManifest>(file)
        if (!manifest || (!manifest.contactSheet && !manifest.generated)) return null
        const info = await stat(file)
        return info.mtime.getTime() >= startedMs ? { file, manifest, modifiedAt: info.mtime.getTime() } : null
      }),
  )
  return (
    candidates
      .filter((item): item is { file: string; manifest: ResultManifest; modifiedAt: number } => Boolean(item))
      .sort((left, right) => right.modifiedAt - left.modifiedAt)[0] ?? null
  )
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

function resolveImagePath(manifest: ResultManifest) {
  const candidate = manifest.contactSheet ?? manifest.generated
  if (!candidate) return null
  return path.isAbsolute(candidate) ? candidate : path.join(/* turbopackIgnore: true */ process.cwd(), candidate)
}

function buildResourceEstimate(summary: ResourceUsageSessionSummary) {
  return {
    source: "training_controller_gpu_sampler",
    sessionId: summary.sessionId,
    startedAt: summary.startedAt,
    finishedAt: summary.finishedAt,
    trainingStartedAt: summary.startedAt,
    trainingFinishedAt: summary.finishedAt,
    trainingDurationSeconds: summary.durationSeconds,
    trainingDurationText: formatDuration(summary.durationSeconds),
    totalExpertTrainingSeconds: summary.durationSeconds,
    gpuName: summary.gpuName,
    driver: summary.driver,
    averageGpuUtilizationPercent: summary.averageGpuUtilizationPercent,
    maxGpuUtilizationPercent: summary.maxGpuUtilizationPercent,
    maxMemoryUsedMiB: summary.maxMemoryUsedMiB,
    maxTemperatureCelsius: summary.maxTemperatureCelsius,
    estimatedPowerWatts: summary.averagePowerWatts,
    maxPowerWatts: summary.maxPowerWatts,
    estimatedKwh: summary.electricity.estimatedKwh,
    estimatedCny: summary.electricity.estimatedCny,
    cnyPerKwh: summary.electricity.cnyPerKwh,
    externalApiTokens: summary.tokenLedger.externalApiTokens,
    externalApiCostCny: summary.tokenLedger.externalApiCostCny,
    localComputeTokenEstimate: summary.tokenLedger.localComputeTokens,
    note: "Archived automatically by the local training controller from sampled GPU telemetry.",
  }
}

function formatDuration(seconds: number) {
  const safeSeconds = Math.max(0, Math.round(seconds))
  const hours = Math.floor(safeSeconds / 3600)
  const minutes = Math.floor((safeSeconds % 3600) / 60)
  const restSeconds = safeSeconds % 60
  if (hours > 0) return `${hours}h ${minutes}m ${restSeconds}s`
  if (minutes > 0) return `${minutes}m ${restSeconds}s`
  return `${restSeconds}s`
}

function buildGenericLabels(action: string, manifest: ResultManifest) {
  const version = manifest.stageId ?? manifest.trainingVersion ?? action
  return {
    stage: version.toUpperCase(),
    title: `Local Model Training Result ${version}`,
    description:
      "Local model candidate evidence only. It cannot enter /world without VisualJudge and ApprovedFrame.",
  }
}

function sanitizeId(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9_-]+/g, "-").replace(/^-+|-+$/g, "") || "generated-result"
}

function toProjectRelativePath(file: string) {
  const relative = path.relative(/* turbopackIgnore: true */ process.cwd(), file)
  return relative && !relative.startsWith("..") ? relative : file
}

async function readJson<T>(file: string): Promise<T | null> {
  try {
    return JSON.parse(await readFile(file, "utf8")) as T
  } catch {
    return null
  }
}

async function writeJson(file: string, value: unknown) {
  await mkdir(path.dirname(file), { recursive: true })
  await writeFile(file, JSON.stringify(value, null, 2) + "\n", "utf8")
}
