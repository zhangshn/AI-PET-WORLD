import crypto from "node:crypto"
import fs from "node:fs"
import path from "node:path"
import sharp from "sharp"
import { auditAiAssistedConditionAlignment } from "./lib/ai-assisted-condition-alignment.mjs"
import { auditAiAssistedCompositionNovelty } from "./lib/ai-assisted-composition-novelty.mjs"
import { auditAiAssistedProfessionalAesthetic } from "./lib/ai-assisted-professional-aesthetic.mjs"
import { auditImageAgainstLatestStyleFingerprint } from "./lib/ai-assisted-style-fingerprint.mjs"
import { appendAiPainterProgramEvent, projectPath as ledgerProjectPath } from "./lib/ai-painter-program-event-store.mjs"
import { refreshGameMapAutoVisualJudgeLearning } from "./lib/game-map-auto-visual-judge-learning.mjs"

const ROOT = process.cwd()
const manifestArgument = argumentValue("--manifest")
assert(manifestArgument, "--manifest is required")
const manifestPath = resolveProjectPath(manifestArgument)
assert(fs.existsSync(manifestPath), "validation manifest is missing")
const manifest = readJson(manifestPath)
const imagePath = resolveProjectPath(manifest.outputImagePath)
const conditionPackPath = resolveProjectPath(manifest.conditionPackPath)
assert(fs.existsSync(imagePath), "validation image is missing")
assert(fs.existsSync(conditionPackPath), "validation condition pack is missing")

const conditionPack = readJson(conditionPackPath)
const sourceIndex = manifest.sourceIndexPath ? readJson(resolveProjectPath(manifest.sourceIndexPath)) : null
const referenceSample = (sourceIndex?.samples ?? []).find((sample) =>
  sample.conditionLabel === manifest.conditionLabel
  && sample.split === manifest.sourceSplit
  && sample.v7CapacityContributionRegistered === true
)
assert(referenceSample?.imagePath, "held-out object semantic review reference is missing")
const imageBytes = fs.readFileSync(imagePath)
const imageSha256 = sha256(imageBytes)
const image = await sharp(imageBytes, { failOn: "error" }).removeAlpha().raw().toBuffer({ resolveWithObject: true })
const timestamp = new Date().toISOString()
const reviewId = `ai-assisted-inference-machine-review-${manifest.runId}-${timestamp.replace(/[:.]/g, "-")}`
const reviewPath = path.join(path.dirname(manifestPath), "machine-review.json")

assert(imageSha256 === manifest.outputImageSha256, "validation image identity mismatch")
assert(conditionPack.conditionPackId === manifest.conditionPackId, "validation condition identity mismatch")
assert(conditionPack.conditionPackSha256 === manifest.conditionPackSha256, "validation condition hash mismatch")

const syntheticRecord = {
  recordId: manifest.runId,
  conditionBinding: {
    conditionPackPath: manifest.conditionPackPath,
    worldId: conditionPack.worldId,
    tick: conditionPack.tick,
  },
  classification: {
    monsoonSeason: conditionPack.categoricalConditions?.ecologyPlan?.season ?? null,
  },
}
const conditionAlignmentAudit = await auditAiAssistedConditionAlignment({
  record: syntheticRecord,
  imagePath,
  referenceImagePath: referenceSample.imagePath,
})
const styleFingerprintAudit = await auditImageAgainstLatestStyleFingerprint(imagePath)
const compositionNoveltyAudit = await auditAiAssistedCompositionNovelty({ record: syntheticRecord, imagePath })
const professionalAestheticAudit = await auditAiAssistedProfessionalAesthetic(imagePath)
const pixelMetrics = measurePixels(image.data, image.info.width, image.info.height)
const issues = []

addIssue(manifest.schemaVersion !== "ai-assisted-complete-world-inference-validation-manifest-v1", "vj0_validation_manifest_invalid", "VJ-0", "验证清单身份无效。", "Validation manifest identity is invalid.", "whole_frame", "inference_identity")
addIssue(manifest.outputSource !== "fresh_local_ai_assisted_checkpoint_validation", "vj0_output_source_invalid", "VJ-0", "验证图不是本轮本地模型的新推理结果。", "The validation image is not a fresh local-model inference result.", "whole_frame", "inference_identity")
addIssue(manifest.reusedExistingImage !== false || manifest.targetImageUsed !== false || manifest.programDrawnRgbUsed !== false, "vj0_generation_boundary_failed", "VJ-0", "验证图违反非复用、无目标图或非程序绘图边界。", "The validation image violates no-reuse, no-target, or non-program-RGB boundaries.", "whole_frame", "inference_identity")
addIssue(manifest.thirdPartyWeightsLoaded !== false || manifest.aiGenerationDependencyDeclared !== true, "vj0_model_provenance_invalid", "VJ-0", "模型来源或 AI 冷启动数据依赖声明不完整。", "Model provenance or AI-assisted training-data dependency is incomplete.", "whole_frame", "model_provenance")
addIssue(!Array.isArray(manifest.conditionChannels) || manifest.conditionChannels.length !== 23, "vj0_condition_channel_evidence_incomplete", "VJ-0", "23 通道条件证据不完整。", "The 23-channel condition evidence is incomplete.", "whole_frame", "condition_identity")
addIssue(image.info.width !== 1024 || image.info.height !== 768 || image.info.channels !== 3, "vj1_formal_resolution_invalid", "VJ-1", "验证图不是原生 1024x768 RGB 完整画面。", "The validation image is not a native 1024x768 RGB complete frame.", "whole_frame", "native_formal_resolution")
addIssue(pixelMetrics.edgeDensity < 0.035, "vj1_low_detail_blur_artifact", "VJ-1", "整图边缘密度过低，画面模糊或细节不足。", "Whole-frame edge density is too low and indicates blur or insufficient detail.", "whole_frame", "native_resolution_detail")
addIssue(pixelMetrics.stripeAnisotropy > 1.65, "vj1_vertical_stripe_artifact", "VJ-1", "整图存在明显纵向条纹或扫描线伪影。", "The frame contains strong vertical stripe or scan-line artifacts.", "whole_frame", "artifact_suppression")
addIssue(pixelMetrics.quantizedColorCount < 650, "vj1_palette_collapse", "VJ-1", "整图有效色彩变化不足，材质语言发生塌缩。", "The frame has insufficient effective color variation and collapsed material language.", "whole_frame", "complete_frame_color_language")
for (const issue of conditionAlignmentAudit.issues ?? []) issues.push(normalizeIssue(issue, "VJ-2"))
const expectedSceneType = ["v7", "v7-repair-r1"].includes(manifest.modelVersion)
  && manifest.validationConditionContract === "v7_capacity_natural_region_complete_map_v1"
  ? "training_complete_natural_region_map"
  : "training_complete_natural_home_map"
addIssue(conditionPack.canvas?.frameScope !== "complete_runtime_frame" || conditionPack.categoricalConditions?.sceneIntent?.sceneType !== expectedSceneType, "vj2_complete_map_scope_contract_missing", "VJ-2", "条件包没有保持完整地图范围。", "The condition pack does not preserve complete-map scope.", "whole_frame", "complete_map_scope")
for (const issue of styleFingerprintAudit.issues ?? []) issues.push(normalizeIssue(issue, "Professional Aesthetic"))
for (const issue of compositionNoveltyAudit.issues ?? []) issues.push(normalizeIssue(issue, "Professional Aesthetic"))
for (const issue of professionalAestheticAudit.issues ?? []) issues.push(normalizeIssue(issue, "Professional Aesthetic"))

const gates = ["VJ-0", "VJ-1", "VJ-2", "Professional Aesthetic"].map((gate) => {
  const gateIssues = issues.filter((issue) => issue.gate === gate)
  return { gate, passed: gateIssues.length === 0, issueCodes: gateIssues.map((issue) => issue.code) }
})
const passed = gates.every((gate) => gate.passed)
const report = {
  schemaVersion: "ai-assisted-conditional-inference-machine-review-v1",
  reviewId,
  reviewerVersion: "ai-assisted-conditional-inference-vj0-vj1-vj2-professional-v2",
  createdAtUtc: timestamp,
  createdAtAsiaShanghai: formatShanghai(timestamp),
  status: passed ? "machine_passed_waiting_owner_review" : "machine_rejected",
  passed,
  title: passed ? "AI-assisted conditional inference validation passed machine review" : "AI-assisted conditional inference validation failed machine review",
  titleZh: passed ? "AI 辅助条件推理验证通过机器审核" : "AI 辅助条件推理验证未通过机器审核",
  summary: passed ? "All current machine gates passed; owner review is still required." : `Machine review recorded ${issues.length} durable issue(s).`,
  summaryZh: passed ? "当前机器门禁全部通过，仍需项目所有者审核。" : `机器审核记录了 ${issues.length} 个可追溯问题。`,
  validationManifestPath: projectPath(manifestPath),
  runId: manifest.runId,
  conditionLabel: manifest.conditionLabel,
  conditionPackId: manifest.conditionPackId,
  imagePath: manifest.outputImagePath,
  imageSha256,
  gates,
  metrics: { pixel: pixelMetrics },
  conditionAlignmentAudit,
  objectSemanticReferenceEvidence: {
    mode: "post_generation_review_only_not_inference_input",
    referenceImagePath: referenceSample.imagePath,
    referenceImageSha256: referenceSample.imageSha256,
    targetImageUsedByInference: false,
  },
  styleFingerprintAudit,
  compositionNoveltyAudit,
  professionalAestheticAudit,
  issues,
  affectedRegions: Array.from(new Set(issues.map((issue) => issue.affectedRegion))),
  nextTrainingTargets: Array.from(new Set(issues.map((issue) => issue.nextFixTarget))),
  formalCandidate: false,
  formalInferenceEligible: false,
  runtimeFrameEligible: false,
  canEnterWorld: false,
  ownerReviewRequired: true,
  automaticStorage: true,
}
writeJson(reviewPath, report)
const event = appendAiPainterProgramEvent({
  action: "review_ai_assisted_conditional_inference_validation",
  runId: reviewId,
  kind: passed ? "review_completed" : "step_failed",
  status: passed ? "info" : "failed",
  title: report.title,
  titleZh: report.titleZh,
  detail: report.summary,
  detailZh: report.summaryZh,
  script: "scripts/review-ai-assisted-conditional-inference-validation.mjs",
  currentStep: passed ? "waiting_owner_review" : "failure_backwrite",
  error: passed ? null : issues.map((issue) => issue.code).join(","),
  errorZh: passed ? null : issues.map((issue) => issue.messageZh).join("；"),
  finalGameMapSuccess: false,
  canEnterWorld: false,
  archiveId: manifest.runId,
  evidencePath: ledgerProjectPath(reviewPath),
  nextAction: passed ? "wait_for_owner_review" : "feed_machine_review_failure_into_next_training_round",
  nextActionZh: passed ? "等待项目所有者审核" : "将机器审核失败写入下一轮训练",
})
if (!passed) refreshGameMapAutoVisualJudgeLearning({ trigger: "ai_assisted_conditional_inference_machine_review_failed", triggerEventId: event.id })
console.log(JSON.stringify({ status: report.status, reviewId, reviewPath: projectPath(reviewPath), issueCodes: issues.map((issue) => issue.code) }, null, 2))

function addIssue(failed, code, gate, messageZh, message, affectedRegion, nextFixTarget) {
  if (failed) issues.push({ code, severity: "error", gate, message, messageZh, affectedRegion, nextFixTarget })
}
function normalizeIssue(value, gate) {
  return {
    code: value.code,
    severity: value.severity ?? "error",
    gate,
    message: value.message ?? value.code,
    messageZh: value.messageZh ?? value.message ?? value.code,
    affectedRegion: value.affectedRegion ?? "whole_frame",
    nextFixTarget: value.nextTrainingTarget ?? value.nextFixTarget ?? "repair_validation_generation_constraints",
  }
}
function measurePixels(data, width, height) {
  let horizontalDiff = 0
  let verticalDiff = 0
  let horizontalEdges = 0
  let edgeComparisons = 0
  const colors = new Set()
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const offset = (y * width + x) * 3
      colors.add(`${data[offset] >> 3}:${data[offset + 1] >> 3}:${data[offset + 2] >> 3}`)
      if (x > 0) {
        const previous = offset - 3
        const difference = (Math.abs(data[offset] - data[previous]) + Math.abs(data[offset + 1] - data[previous + 1]) + Math.abs(data[offset + 2] - data[previous + 2])) / 3
        horizontalDiff += difference
        horizontalEdges += difference > 18 ? 1 : 0
        edgeComparisons += 1
      }
      if (y > 0) {
        const previous = offset - width * 3
        verticalDiff += (Math.abs(data[offset] - data[previous]) + Math.abs(data[offset + 1] - data[previous + 1]) + Math.abs(data[offset + 2] - data[previous + 2])) / 3
      }
    }
  }
  const horizontalMean = horizontalDiff / Math.max(1, height * (width - 1))
  const verticalMean = verticalDiff / Math.max(1, (height - 1) * width)
  return {
    width,
    height,
    edgeDensity: round(horizontalEdges / Math.max(1, edgeComparisons)),
    meanHorizontalDifference: round(horizontalMean),
    meanVerticalDifference: round(verticalMean),
    stripeAnisotropy: round(horizontalMean / Math.max(verticalMean, 0.0001)),
    quantizedColorCount: colors.size,
  }
}
function argumentValue(name) { const index = process.argv.indexOf(name); return index >= 0 ? process.argv[index + 1] : null }
function readJson(value) { return JSON.parse(fs.readFileSync(value, "utf8")) }
function writeJson(filePath, value) { fs.mkdirSync(path.dirname(filePath), { recursive: true }); fs.writeFileSync(filePath, `${JSON.stringify(value, null, 2)}\n`, "utf8") }
function resolveProjectPath(value) { const resolved = path.resolve(ROOT, value); assert(resolved === ROOT || resolved.startsWith(`${ROOT}${path.sep}`), `path escapes project: ${value}`); return resolved }
function projectPath(value) { return path.relative(ROOT, path.resolve(value)).replace(/\\/g, "/") }
function sha256(value) { return crypto.createHash("sha256").update(value).digest("hex") }
function round(value) { return Math.round(value * 10000) / 10000 }
function formatShanghai(iso) { return `${new Intl.DateTimeFormat("sv-SE", { timeZone: "Asia/Shanghai", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: false }).format(new Date(iso)).replace(" ", "T")}+08:00` }
function assert(condition, message) { if (!condition) throw new Error(message) }
