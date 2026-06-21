import { copyFile, mkdir, readFile, readdir, stat, writeFile } from "node:fs/promises"
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
  summaryFile: string
  diagnosisFile: string
  qualityGateFile?: string
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
const qualityGateDir = path.join(archiveDir, "quality-gates")
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
  const id = sanitizeId(manifest.stageId ?? manifest.trainingVersion ?? input.action)
  await mkdir(archivedImageDir, { recursive: true })
  await mkdir(qualityGateDir, { recursive: true })
  const archivedImageFile = path.join(archivedImageDir, `${id}.png`)
  const qualityGateFile = path.join(qualityGateDir, `${id}.json`)
  await copyFile(imagePath, archivedImageFile)
  await writeJson(qualityGateFile, qualityGate)

  const record: ArchivedTrainingResult = {
    id,
    action: input.action,
    stage: labels.stage,
    title: labels.title,
    description: labels.description,
    reviewStatus: manifest.status === "pass_candidate" ? "candidate" : "failed",
    imageFile: toProjectRelativePath(archivedImageFile),
    summaryFile: toProjectRelativePath(manifestEntry.file),
    diagnosisFile: toProjectRelativePath(manifestEntry.file),
    qualityGateFile: toProjectRelativePath(qualityGateFile),
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
    .sort((left, right) => right.archivedAt.localeCompare(left.archivedAt))
    .slice(0, 50)
  await writeJson(indexPath, {
    schemaVersion: "ai-painter-generated-results-index-v1",
    updatedAt: new Date().toISOString(),
    results,
  } satisfies GeneratedResultsIndex)
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
