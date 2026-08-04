import crypto from "node:crypto"
import fs from "node:fs"
import path from "node:path"
import sharp from "sharp"
import {
  appendAiPainterProgramEvent,
  formatShanghai,
  projectPath,
  writeImmutableProgramRun,
} from "./lib/ai-painter-program-event-store.mjs"

const ROOT = process.cwd()
const OUTPUT_ROOT = ".runtime/ai-painter/v7-validation-failure-root-cause-analyses"
const RECONCILIATION_POINTER = ".runtime/ai-painter/v7-post-training-validation-reconciliations/latest.json"
const args = parseArgs(process.argv.slice(2))

const reconciliationPointerPath = path.resolve(ROOT, args.reconciliationPointer ?? RECONCILIATION_POINTER)
const reconciliationPointer = readJson(reconciliationPointerPath)
const reconciliationPath = path.resolve(ROOT, reconciliationPointer.reportPath)
const reconciliation = readJson(reconciliationPath)
assert(reconciliation.status === "reconciled_machine_failed_not_formal", "V7 validation reconciliation is not a machine-failed terminal record")
const canonicalPath = path.resolve(ROOT, reconciliation.canonicalBatch.reportPath)
const canonical = readJson(canonicalPath)
assert(canonical.completedTrajectoryCount === 8, "root-cause analysis requires eight completed canonical trajectories")
assert(canonical.machinePassedCount === 0 && canonical.machineRejectedCount === 8, "root-cause analysis requires the recorded 0/8 machine result")

const existing = readExistingAnalysis(canonicalPath)
if (existing) {
  console.log(JSON.stringify({ ok: true, status: "existing_root_cause_analysis_reused", ...existing }, null, 2))
  process.exit(0)
}

const trajectoryEvidence = canonical.trajectories.map((trajectory) => {
  const manifest = readJson(path.resolve(ROOT, trajectory.manifestPath))
  const review = readJson(path.resolve(ROOT, trajectory.machineReviewPath))
  const pathAudit = review.conditionAlignmentAudit?.channelAudits?.find((entry) => entry.channelId === "terrain_path_ground") ?? null
  return {
    recordId: trajectory.recordId,
    conditionLabel: trajectory.conditionLabel,
    seed: trajectory.seed,
    runId: trajectory.runId,
    split: trajectory.split,
    imagePath: trajectory.outputImagePath,
    imageSha256: trajectory.outputImageSha256,
    manifestPath: trajectory.manifestPath,
    manifestSha256: sha256File(path.resolve(ROOT, trajectory.manifestPath)),
    machineReviewPath: trajectory.machineReviewPath,
    machineReviewSha256: trajectory.machineReviewSha256,
    issueCodes: review.issues.map((issue) => issue.code),
    professionalMetrics: {
      edgeDensity: review.metrics?.pixel?.edgeDensity ?? null,
      quietRegionVariance: review.professionalAestheticAudit?.candidate?.quietRegionVariance ?? null,
      textureHierarchyRatio: review.professionalAestheticAudit?.candidate?.textureHierarchyRatio ?? null,
      textureViolationCount: review.professionalAestheticAudit?.textureViolations?.length ?? 0,
    },
    pathAlignment: pathAudit ? {
      expectedNonZeroRatio: pathAudit.expectedNonZeroRatio,
      actualSignalRatio: pathAudit.actualSignalRatio,
      coverageRatio: pathAudit.coverageRatio,
      spatialIntersection: pathAudit.spatialIntersection,
      centroidDistance: pathAudit.centroidDistance,
      boundaryContactPassed: pathAudit.boundaryContactAudit?.passed ?? null,
      issueCodes: (pathAudit.issues ?? []).map((issue) => issue.code),
    } : null,
    sourceIndexPath: manifest.sourceIndexPath,
  }
})

const issueCounts = countValues(trajectoryEvidence.flatMap((row) => row.issueCodes))
const sourceIndex = readJson(path.resolve(ROOT, readJson(path.resolve(ROOT, canonical.trajectories[0].manifestPath)).sourceIndexPath))
const sourceRows = new Map(sourceIndex.samples.map((row) => [row.recordId, row]))
const outputFeatures = await Promise.all(trajectoryEvidence.map(async (row) => ({
  id: `${row.conditionLabel}:${row.seed}`,
  conditionLabel: row.conditionLabel,
  recordId: row.recordId,
  pixels: await structuralPixels(path.resolve(ROOT, row.imagePath)),
})))
const uniqueRecords = [...new Set(trajectoryEvidence.map((row) => row.recordId))]
const targetFeatures = await Promise.all(uniqueRecords.map(async (recordId) => {
  const source = sourceRows.get(recordId)
  assert(source?.imagePath, `target image is missing for ${recordId}`)
  return { recordId, imagePath: source.imagePath, pixels: await structuralPixels(path.resolve(ROOT, source.imagePath)) }
}))
const outputPairs = pairwise(outputFeatures, (left, right) => ({
  relation: left.recordId === right.recordId ? "same_condition_different_seed" : "different_condition",
  difference: meanAbsoluteDifference(left.pixels, right.pixels),
}))
const targetPairs = pairwise(targetFeatures, (left, right) => ({
  relation: "different_target",
  difference: meanAbsoluteDifference(left.pixels, right.pixels),
}))
const ownTargetRanks = outputFeatures.map((output) => {
  const comparisons = targetFeatures
    .map((target) => ({ recordId: target.recordId, difference: meanAbsoluteDifference(output.pixels, target.pixels) }))
    .sort((left, right) => left.difference - right.difference)
  return {
    outputId: output.id,
    expectedRecordId: output.recordId,
    nearestRecordId: comparisons[0].recordId,
    expectedTargetRank: comparisons.findIndex((row) => row.recordId === output.recordId) + 1,
    expectedTargetDifference: comparisons.find((row) => row.recordId === output.recordId).difference,
    nearestTargetDifference: comparisons[0].difference,
  }
})

const withinConditionDifference = average(outputPairs.filter((row) => row.relation === "same_condition_different_seed").map((row) => row.difference))
const crossConditionDifference = average(outputPairs.filter((row) => row.relation === "different_condition").map((row) => row.difference))
const targetDifference = average(targetPairs.map((row) => row.difference))
const conditionResponseRatio = ratio(crossConditionDifference, targetDifference)
const expectedTargetNearestCount = ownTargetRanks.filter((row) => row.expectedTargetRank === 1).length

const stageRuns = [
  ".runtime/ai-painter/project-owned-complete-world-conditional-denoiser-v7/ai-assisted-conditional-denoiser-v7-stage-0-2026-08-02T04-56-52-635Z/manifest.json",
  ".runtime/ai-painter/project-owned-complete-world-conditional-denoiser-v7/ai-assisted-conditional-denoiser-v7-stage-1-2026-08-02T05-08-54-120Z/manifest.json",
  ".runtime/ai-painter/project-owned-complete-world-conditional-denoiser-v7/ai-assisted-conditional-denoiser-v7-stage-2-2026-08-02T05-20-16-111Z/manifest.json",
].map((manifestPath) => summarizeStage(manifestPath))

const createdAtUtc = new Date().toISOString()
const analysisId = `ai-assisted-v7-validation-failure-root-cause-analysis-${createdAtUtc.replace(/[:.]/g, "-")}`
const report = {
  schemaVersion: "ai-assisted-v7-validation-failure-root-cause-analysis-v1",
  analysisId,
  status: "root_cause_analysis_completed_repair_contract_pending",
  createdAtUtc,
  createdAtAsiaShanghai: formatShanghai(createdAtUtc),
  generatedBy: "local_ai_pet_world_program",
  source: {
    reconciliationPath: projectPath(reconciliationPath),
    reconciliationSha256: sha256File(reconciliationPath),
    canonicalValidationPath: projectPath(canonicalPath),
    canonicalValidationSha256: sha256File(canonicalPath),
    checkpointSha256: reconciliation.checkpointSha256,
  },
  scope: {
    uniqueConditionCount: uniqueRecords.length,
    seedCountPerCondition: 2,
    uniqueTrajectoryCount: trajectoryEvidence.length,
    machinePassedCount: 0,
    machineRejectedCount: trajectoryEvidence.length,
  },
  issueCounts,
  structuralResponseAudit: {
    method: "64x48_rgb_blur4_mean_absolute_difference_plus_expected_target_nearest_rank_v1",
    scale: "0_to_255",
    withinConditionDifferentSeedMeanDifference: withinConditionDifference,
    crossConditionMeanDifference: crossConditionDifference,
    sourceTargetCrossConditionMeanDifference: targetDifference,
    generatedToSourceConditionResponseRatio: conditionResponseRatio,
    expectedTargetNearestCount,
    expectedTargetNearestRatio: ratio(expectedTargetNearestCount, trajectoryEvidence.length),
    ownTargetRanks,
    interpretation: conditionResponseRatio < 0.5
      ? "generated_cross_condition_structure_is_less_than_half_of_source_target_separation"
      : "generated_cross_condition_structure_requires_additional_ablation",
  },
  progressiveTrainingEvidence: stageRuns,
  confirmedFindings: [
    {
      code: "v7_full_frame_texture_noise_and_hierarchy_collapse",
      severity: "blocking",
      confidence: "confirmed_by_8_of_8_machine_reviews_and_rgb_evidence",
      evidence: {
        textureNoiseFailureCount: issueCounts.professional_multiscale_texture_noise_overload ?? 0,
        textureHierarchyFailureCount: issueCounts.professional_texture_hierarchy_collapsed ?? 0,
        quietRegionFailureCount: issueCounts.professional_quiet_region_missing ?? 0,
      },
      conclusionZh: "8条轨迹全部出现多尺度纹理噪声和层次塌缩，画面退化为全幅均匀高频纹理，无法形成可读的道路、林地、空地与物体层级。",
    },
    {
      code: "v7_condition_specific_structure_response_collapsed",
      severity: "blocking",
      confidence: conditionResponseRatio < 0.5 ? "confirmed_by_cross_condition_structural_response" : "strong_visual_and_review_evidence_requires_condition_ablation",
      evidence: {
        generatedCrossConditionDifference: crossConditionDifference,
        sourceTargetCrossConditionDifference: targetDifference,
        conditionResponseRatio,
        expectedTargetNearestCount,
        trajectoryCount: trajectoryEvidence.length,
      },
      conclusionZh: "四组不同条件生成结果之间的结构差异显著弱于四张真实目标之间的差异，模型主要改变局部噪声，没有可靠恢复条件指定的大结构。",
    },
    {
      code: "v7_slot_204_path_semantic_decode_failure",
      severity: "blocking",
      confidence: "confirmed_by_both_slot_204_seeds",
      evidence: {
        affectedTrajectoryCount: trajectoryEvidence.filter((row) => row.recordId.includes("capacity-slot-204-")).length,
        coverageRatios: trajectoryEvidence.filter((row) => row.recordId.includes("capacity-slot-204-")).map((row) => row.pathAlignment?.coverageRatio),
        boundaryContactPassed: trajectoryEvidence.filter((row) => row.recordId.includes("capacity-slot-204-")).map((row) => row.pathAlignment?.boundaryContactPassed),
      },
      conclusionZh: "slot-204两个种子的道路覆盖率都接近零且均未接触规定入口边界，说明道路条件在完整去噪轨迹中没有被可靠解码。",
    },
    {
      code: "v7_checkpoint_metric_to_final_gate_alignment_gap",
      severity: "blocking",
      confidence: "confirmed_by_selected_checkpoint_and_0_of_8_final_result",
      evidence: {
        selectedStage2BestEpoch: stageRuns[2].bestEpoch,
        selectedStage2Metric: stageRuns[2].bestValidationMetric,
        strictFinalMachinePassedCount: 0,
        strictFinalMachineRejectedCount: 8,
      },
      conclusionZh: "训练内部checkpoint选择分数能够选出最佳epoch，但没有预测最终专业画质与道路连通门禁，训练目标和部署验收目标仍未闭合。",
    },
  ],
  boundedHypothesesRequiringTests: [
    {
      code: "decoded_rgb_and_sparse_semantic_loss_may_be_too_weak_against_global_texture_prior",
      status: "not_yet_proven",
      requiredTest: "loss_ablation_with_fixed_smoke_conditions_and_professional_gate_metrics",
    },
    {
      code: "progressive_resolution_transfer_may_degrade_full_trajectory_quality",
      status: "supported_by_worsening_stage_selection_scores_not_yet_causal",
      requiredTest: "compare_stage0_stage1_stage2_fixed_seed_preview_and_gate_metrics",
    },
    {
      code: "mvp64_capacity_may_be_insufficient_for_condition_generalization",
      status: "not_yet_proven",
      requiredTest: "capacity_learning_curve_or_augmented_condition_holdout_experiment",
    },
    {
      code: "autoencoder_latent_bottleneck_may_limit_semantic_reconstruction",
      status: "not_yet_proven",
      requiredTest: "challenge_target_autoencoder_roundtrip_audit_before_denoiser_changes",
    },
  ],
  requiredRepairContractInputs: [
    "fixed_seed_stage_preview_contract",
    "challenge_target_autoencoder_roundtrip_gate",
    "condition_swap_ablation_gate",
    "professional_texture_metrics_in_checkpoint_selection",
    "explicit_path_boundary_connectivity_loss_and_validation",
    "failure_return_to_root_cause_analysis",
  ],
  trajectories: trajectoryEvidence,
  disposition: {
    trainingWeightsModified: false,
    newGpuWorkStarted: false,
    repairAuthorized: false,
    retrainingAuthorized: false,
    revalidationAuthorized: false,
    formalInferenceEligible: false,
    runtimeFrameEligible: false,
    canEnterWorld: false,
    nextClosedLoopNode: "build_v7_repair_contract",
  },
  automaticStorage: true,
}

const stored = writeImmutableProgramRun({
  root: OUTPUT_ROOT,
  runId: analysisId,
  fileName: "root-cause-analysis.json",
  record: report,
  latest: {
    canonicalValidationSha256: report.source.canonicalValidationSha256,
    confirmedFindingCodes: report.confirmedFindings.map((row) => row.code),
    nextClosedLoopNode: report.disposition.nextClosedLoopNode,
    formalInferenceEligible: false,
  },
})
appendAiPainterProgramEvent({
  action: "analyze_ai_assisted_v7_validation_failures",
  runId: analysisId,
  kind: "validation_failure_root_cause_analysis_completed",
  status: "failed",
  title: "V7 validation failure root-cause analysis completed",
  titleZh: "V7验证失败根因分析已完成",
  detail: `confirmedFindings=${report.confirmedFindings.length}; trajectories=8; next=build_v7_repair_contract`,
  detailZh: `确认根因类=${report.confirmedFindings.length}；轨迹=8；下一闭环节点=建立V7修复合同`,
  script: "scripts/analyze-ai-assisted-v7-validation-failures.mjs",
  currentStep: "root_cause_analysis_completed_repair_contract_pending",
  evidencePath: stored.runPath,
  nextAction: "build_v7_repair_contract",
  nextActionZh: "根据自动根因报告建立有界V7修复合同；未经owner授权不得实施修复或重训。",
  finalGameMapSuccess: false,
  canEnterWorld: false,
})

console.log(JSON.stringify({
  ok: true,
  status: report.status,
  analysisId,
  reportPath: stored.runPath,
  reportSha256: sha256File(path.resolve(ROOT, stored.runPath)),
  issueCounts,
  structuralResponseAudit: report.structuralResponseAudit,
  confirmedFindings: report.confirmedFindings.map((row) => row.code),
  nextClosedLoopNode: report.disposition.nextClosedLoopNode,
}, null, 2))

function parseArgs(values) {
  const read = (name) => { const index = values.indexOf(name); return index >= 0 ? values[index + 1] : null }
  return { reconciliationPointer: read("--reconciliation-pointer") }
}
function readExistingAnalysis(canonicalReportPath) {
  const pointerPath = path.resolve(ROOT, OUTPUT_ROOT, "latest.json")
  if (!fs.existsSync(pointerPath)) return null
  const pointer = readJson(pointerPath)
  if (pointer.canonicalValidationSha256 !== sha256File(canonicalReportPath)) return null
  if (!pointer.runPath || !fs.existsSync(path.resolve(ROOT, pointer.runPath))) return null
  return { analysisId: pointer.runId, reportPath: pointer.runPath, reportSha256: sha256File(path.resolve(ROOT, pointer.runPath)) }
}
async function structuralPixels(imagePath) {
  const result = await sharp(imagePath, { failOn: "error" })
    .removeAlpha()
    .resize(64, 48, { fit: "fill" })
    .blur(4)
    .raw()
    .toBuffer()
  return result
}
function pairwise(rows, build) {
  const result = []
  for (let left = 0; left < rows.length; left += 1) {
    for (let right = left + 1; right < rows.length; right += 1) result.push(build(rows[left], rows[right]))
  }
  return result
}
function meanAbsoluteDifference(left, right) {
  assert(left.length === right.length, "image fingerprints have different lengths")
  let total = 0
  for (let index = 0; index < left.length; index += 1) total += Math.abs(left[index] - right[index])
  return round(total / left.length)
}
function summarizeStage(manifestPath) {
  const manifest = readJson(path.resolve(ROOT, manifestPath))
  const best = manifest.metrics.find((row) => row.epoch === manifest.bestEpoch)
  return {
    manifestPath,
    manifestSha256: sha256File(path.resolve(ROOT, manifestPath)),
    resolution: manifest.resolutionStage,
    bestEpoch: manifest.bestEpoch,
    bestValidationMetric: manifest.bestValidationMetric,
    bestValidationFixedGridScore: best?.validationFixedGridCompositeConditionQualityScore ?? null,
    bestValidationRolloutRgbQualityScore: best?.validationRolloutRgbQualityScore ?? null,
    bestValidationRolloutWorstTrajectoryQualityScore: best?.validationRolloutWorstTrajectoryQualityScore ?? null,
  }
}
function countValues(values) {
  return Object.fromEntries([...new Set(values)].sort().map((value) => [value, values.filter((entry) => entry === value).length]))
}
function average(values) { return round(values.reduce((sum, value) => sum + value, 0) / values.length) }
function ratio(numerator, denominator) { return denominator === 0 ? null : round(numerator / denominator) }
function round(value) { return Number(value.toFixed(6)) }
function readJson(value) { return JSON.parse(fs.readFileSync(value, "utf8")) }
function sha256File(value) { return crypto.createHash("sha256").update(fs.readFileSync(value)).digest("hex") }
function assert(condition, message) { if (!condition) throw new Error(message) }
