export type TrainingQualityRow = {
  sourceId: string
  status: "passed" | "warning" | "failed"
  score: number
  mae: number | null
  psnr: number | null
  sharpnessRatio: number | null
  edgeDensityRatio: number | null
  trainSampleCount: number | null
  validationSampleCount: number | null
  reasons: string[]
}

export type TrainingQualityGateReport = {
  schemaVersion: "ai-painter-training-quality-gate-v1"
  status: "passed_for_next_training" | "warning_keep_candidate" | "failed_keep_for_history"
  canPromoteToWorld: false
  canEnterNextTraining: boolean
  overallScore: number
  generatedAt: string
  thresholds: {
    maxMae: number
    minPsnr: number
    minSharpnessRatio: number
    minEdgeDensityRatio: number
  }
  rows: TrainingQualityRow[]
  summary: {
    rowCount: number
    passedCount: number
    warningCount: number
    failedCount: number
    note: string
  }
}

type TrainingResultManifestLike = {
  status?: string
  rows?: Array<{
    sourceId?: string
    diagnosisStatus?: string
    mae?: number
    psnr?: number
    sharpnessRatio?: number
    edgeDensityRatio?: number
    trainSampleCount?: number
    validationSampleCount?: number
    failures?: Array<unknown>
  }>
}

const thresholds = {
  maxMae: 0.03,
  minPsnr: 24,
  minSharpnessRatio: 0.82,
  minEdgeDensityRatio: 0.9,
} as const

export function buildTrainingQualityGateReport(
  manifest: TrainingResultManifestLike,
  now = new Date(),
): TrainingQualityGateReport {
  const rows = (manifest.rows ?? []).map(buildRow)
  const failedCount = rows.filter((row) => row.status === "failed").length
  const warningCount = rows.filter((row) => row.status === "warning").length
  const passedCount = rows.filter((row) => row.status === "passed").length
  const averageScore = rows.length ? rows.reduce((total, row) => total + row.score, 0) / rows.length : 0

  const status =
    failedCount > 0 || manifest.status !== "pass_candidate"
      ? "failed_keep_for_history"
      : warningCount > 0
        ? "warning_keep_candidate"
        : "passed_for_next_training"

  return {
    schemaVersion: "ai-painter-training-quality-gate-v1",
    status,
    canPromoteToWorld: false,
    canEnterNextTraining: status !== "failed_keep_for_history",
    overallScore: round(averageScore),
    generatedAt: now.toISOString(),
    thresholds: { ...thresholds },
    rows,
    summary: {
      rowCount: rows.length,
      passedCount,
      warningCount,
      failedCount,
      note:
        "training_quality_gate_only_not_vj2_not_world_display",
    },
  }
}

function buildRow(row: NonNullable<TrainingResultManifestLike["rows"]>[number]): TrainingQualityRow {
  const mae = numberOrNull(row.mae)
  const psnr = numberOrNull(row.psnr)
  const sharpnessRatio = numberOrNull(row.sharpnessRatio)
  const edgeDensityRatio = numberOrNull(row.edgeDensityRatio)
  const reasons: string[] = []

  if (row.diagnosisStatus !== "pass_candidate") reasons.push("diagnosis_status_not_pass_candidate")
  if (Array.isArray(row.failures) && row.failures.length > 0) reasons.push("diagnosis_has_failures")
  if (mae === null || mae > thresholds.maxMae) reasons.push("mae_over_threshold")
  if (psnr === null || psnr < thresholds.minPsnr) reasons.push("psnr_under_threshold")
  if (sharpnessRatio === null || sharpnessRatio < thresholds.minSharpnessRatio) {
    reasons.push("sharpness_ratio_under_threshold")
  }
  if (edgeDensityRatio === null || edgeDensityRatio < thresholds.minEdgeDensityRatio) {
    reasons.push("edge_density_ratio_under_threshold")
  }

  const score = scoreRow({ mae, psnr, sharpnessRatio, edgeDensityRatio, diagnosisStatus: row.diagnosisStatus })
  const warning =
    reasons.length === 0 &&
    ((mae !== null && mae > 0.025) ||
      (psnr !== null && psnr < 26) ||
      (sharpnessRatio !== null && sharpnessRatio < 0.9) ||
      (edgeDensityRatio !== null && edgeDensityRatio < 0.95))

  return {
    sourceId: row.sourceId ?? "unknown-source",
    status: reasons.length > 0 ? "failed" : warning ? "warning" : "passed",
    score,
    mae,
    psnr,
    sharpnessRatio,
    edgeDensityRatio,
    trainSampleCount: numberOrNull(row.trainSampleCount),
    validationSampleCount: numberOrNull(row.validationSampleCount),
    reasons: reasons.length > 0 ? reasons : warning ? ["passed_hard_gate_but_below_ideal_line"] : ["passed_training_quality_gate"],
  }
}

function scoreRow(input: {
  mae: number | null
  psnr: number | null
  sharpnessRatio: number | null
  edgeDensityRatio: number | null
  diagnosisStatus?: string
}) {
  const maeScore = input.mae === null ? 0 : clamp(1 - input.mae / 0.06)
  const psnrScore = input.psnr === null ? 0 : clamp((input.psnr - 20) / 14)
  const sharpnessScore = input.sharpnessRatio === null ? 0 : clamp(input.sharpnessRatio)
  const edgeScore = input.edgeDensityRatio === null ? 0 : clamp(input.edgeDensityRatio)
  const passBonus = input.diagnosisStatus === "pass_candidate" ? 0.08 : 0
  return round((maeScore * 0.35 + psnrScore * 0.2 + sharpnessScore * 0.2 + edgeScore * 0.17 + passBonus) * 100)
}

function numberOrNull(value: unknown) {
  return typeof value === "number" && Number.isFinite(value) ? value : null
}

function clamp(value: number) {
  return Math.max(0, Math.min(1, value))
}

function round(value: number) {
  return Math.round(value * 10000) / 10000
}
